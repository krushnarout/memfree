import { auth } from '@/auth';
import { getCache, setCache } from '@/lib/cache';
import { Message, chatStream } from '@/lib/chat';
import {
    DeepQueryPrompt,
    MoreQuestionsPrompt,
    RagQueryPrompt,
} from '@/lib/prompt';
import { AskMode, StreamHandler, CachedResult } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import util from 'util';

import { Ratelimit } from '@upstash/ratelimit';
import { incSearchCount, RATE_LIMIT_KEY, redisDB } from '@/lib/db';
import {
    getSearchEngine,
    getVectorSearch,
    ImageSource,
    SearchCategory,
    TextSource,
} from '@/lib/search/search';

const ratelimit = new Ratelimit({
    redis: redisDB,
    limiter: Ratelimit.slidingWindow(3, '1 d'),
    prefix: RATE_LIMIT_KEY,
    analytics: true,
});

const IMAGE_LIMIT = 8;

const formatModel = (model: string) => {
    switch (model) {
        case 'gpt-3.5':
            return 'gpt-3.5-turbo';
        case 'gpt4':
            return 'gpt-4o';
    }
};

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const session = await auth();
    let userId = '';
    if (session) {
        userId = session.user.id;
    } else {
        const ip = (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(
            ',',
        )[0];

        const { success } = await ratelimit.limit(ip);
        if (!success) {
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                },
                { status: 429 },
            );
        }
    }
    const { query, useCache, mode, model, source } = await req.json();

    try {
        const readableStream = new ReadableStream({
            async start(controller) {
                await ask(
                    query,
                    useCache,
                    userId,
                    (message: string | null, done: boolean) => {
                        if (done) {
                            controller.close();
                        } else {
                            const payload = `data: ${message} \n\n`;
                            controller.enqueue(payload);
                        }
                    },
                    mode,
                    formatModel(model),
                    source,
                );
            },
            cancel() {
                console.log('Stream canceled by client');
            },
        });
        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Request failed:', error);
        return NextResponse.json({ error: `${error}` }, { status: 500 });
    }
}

async function ask(
    query: string,
    useCache: boolean,
    userId?: string,
    onStream?: (...args: any[]) => void,
    mode: AskMode = 'simple',
    model = 'gpt-3.5-turbo',
    source = 'all',
) {
    let cachedResult: CachedResult | null = null;
    if (useCache) {
        query = query.trim();
        let cachedResult: CachedResult = await getCache(query);
        if (cachedResult) {
            const { webs, images, answer, related } = cachedResult;
            await streamResponse(
                { sources: webs, images, answer, related },
                onStream,
            );
            onStream?.(null, true);

            if (userId) {
                // Without awaiting incSearchCount to avoid blocking response time
                incSearchCount(userId).catch((error) => {
                    console.error(
                        `Failed to increment search count for user ${userId}:`,
                        error,
                    );
                });
            }
            return;
        }
    }

    let texts: TextSource[] = [];
    let images: ImageSource[] = [];
    const searchOptions = {
        categories: [source],
    };

    if (userId && source === SearchCategory.ALL) {
        const vectorSearchPromise = getVectorSearch(userId).search(query);
        const webSearchPromise = getSearchEngine(searchOptions).search(query);

        const [vectorResponse, webResponse] = await Promise.all([
            vectorSearchPromise,
            webSearchPromise,
        ]);

        ({ texts } = vectorResponse);

        const { texts: webTexts, images: webImages = [] } = webResponse;

        texts = [...texts, ...webTexts];
        images = [...images, ...webImages];
    }

    if (!texts.length) {
        ({ texts, images } =
            await getSearchEngine(searchOptions).search(query));
    }

    await streamResponse({ sources: texts, images }, onStream);

    let fullAnswer = '';
    const llmAnswerPromise = getLLMAnswer(model, query, texts, mode, (msg) => {
        fullAnswer += msg;
        onStream?.(JSON.stringify({ answer: msg }));
    });

    const imageFetchPromise =
        images.length === 0
            ? getSearchEngine({
                  categories: [SearchCategory.IMAGES],
              })
                  .search(query)
                  .then((results) =>
                      results.images
                          .filter((img) => img.image.startsWith('https'))
                          .slice(0, IMAGE_LIMIT),
                  )
            : Promise.resolve(images);

    // step 2: get llm answer and step 3: get images sources
    const [, fetchedImages] = await Promise.all([
        llmAnswerPromise,
        imageFetchPromise,
    ]);

    if (!images.length) {
        images = fetchedImages;
        await streamResponse({ images: fetchedImages }, onStream);
    }

    let fullRelated = '';
    // step 4: get related questions
    await getRelatedQuestions(model, query, texts, (msg) => {
        fullRelated += msg;
        onStream?.(JSON.stringify({ related: msg }));
    });

    cachedResult = {
        webs: texts,
        images: images,
        answer: fullAnswer,
        related: fullRelated,
    };

    if (userId) {
        // Without awaiting incSearchCount and setCache to avoid blocking response time
        incSearchCount(userId).catch((error) => {
            console.error(
                `Failed to increment search count for user ${userId}:`,
                error,
            );
        });
    }

    setCache(query, cachedResult).catch((error) => {
        console.error(`Failed to set cache for query ${query}:`, error);
    });
    onStream?.(null, true);
}

async function streamResponse(
    data: Record<string, any>,
    onStream?: (...args: any[]) => void,
) {
    for (const [key, value] of Object.entries(data)) {
        onStream?.(JSON.stringify({ [key]: value }));
    }
}

async function getLLMAnswer(
    model: string,
    query: string,
    contexts: TextSource[],
    mode: AskMode = 'simple',
    onStream: StreamHandler,
) {
    try {
        const { messages } = paramsFormatter(query, mode, contexts, 'answer');
        await chatStream(
            messages,
            (msg: string | null, done: boolean) => {
                onStream?.(msg, done);
            },
            model,
        );
    } catch (err: any) {
        console.error('[LLM Error]:', err);
        const msg = `[Oops~ Some errors seem to have occurred]: ${
            err?.message || 'Please check the console'
        }`;
        onStream?.(msg, true);
    }
}

async function getRelatedQuestions(
    model: string,
    query: string,
    contexts: TextSource[],
    onStream: StreamHandler,
) {
    try {
        const { messages } = paramsFormatter(
            query,
            undefined,
            contexts,
            'related',
        );
        await chatStream(messages, onStream, model);
    } catch (err) {
        console.error('[LLM Error]:', err);
        return [];
    }
}

function paramsFormatter(
    query: string,
    mode: AskMode = 'simple',
    contexts: any[],
    type: 'answer' | 'related',
) {
    const context = contexts
        .map((item, index) => `[citation:${index + 1}] ${item.content}`)
        .join('\n\n');
    let prompt = type === 'answer' ? RagQueryPrompt : MoreQuestionsPrompt;

    if (mode === 'deep' && type === 'answer') {
        prompt = DeepQueryPrompt;
    }

    const system = util.format(prompt, context);
    const messages: Message[] = [
        {
            role: 'user',
            content: `${system} ${query}`,
        },
    ];
    return {
        messages,
    };
}
