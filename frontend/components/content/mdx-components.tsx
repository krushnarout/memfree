import * as React from 'react';
import NextImage, { ImageProps } from 'next/image';
import Link from 'next/link';
import { useMDXComponent } from 'next-contentlayer2/hooks';

import { cn } from '@/lib/utils';
import { MdxCard } from '@/components/content/mdx-card';
import { Callout } from '@/components/shared/callout';
import { CopyButton } from '@/components/shared/copy-button';

import { HTMLAttributes } from 'react';

const components = {
    h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h1 className={cn('mt-2 scroll-m-20 text-4xl font-bold tracking-tight', className)} {...props} />
    ),
    h2: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h2 className={cn('mt-10 scroll-m-20 border-b pb-1 text-2xl font-semibold tracking-tight first:mt-0', className)} {...props} />
    ),
    h3: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h3 className={cn('mt-8 scroll-m-20 text-xl font-semibold tracking-tight', className)} {...props} />
    ),
    h4: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h4 className={cn('mt-8 scroll-m-20 text-lg font-semibold tracking-tight', className)} {...props} />
    ),
    h5: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h5 className={cn('mt-8 scroll-m-20 text-lg font-semibold tracking-tight', className)} {...props} />
    ),
    h6: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h6 className={cn('mt-8 scroll-m-20 text-base font-semibold tracking-tight', className)} {...props} />
    ),
    a: ({ className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a className={cn('font-medium underline underline-offset-4 break-words overflow-hidden', className)} target="_blank" {...props} />
    ),
    p: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => <p className={cn('leading-7 [&:not(:first-child)]:mt-6', className)} {...props} />,
    ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => <ul className={cn('my-6 ml-6 list-disc', className)} {...props} />,
    ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => <ol className={cn('my-6 ml-6 list-decimal', className)} {...props} />,
    li: ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => <li className={cn('mt-2', className)} {...props} />,
    blockquote: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
        <blockquote className={cn('mt-6 border-l-2 pl-6 italic [&>*]:text-muted-foreground', className)} {...props} />
    ),
    img: ({ className, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={cn('rounded-md border', className)} alt={alt} {...props} />
    ),
    hr: ({ ...props }) => <hr className="my-4 md:my-8" {...props} />,
    table: ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
        <div className="my-6 w-full overflow-y-auto">
            <table className={cn('w-full', className)} {...props} />
        </div>
    ),
    tr: ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('m-0 border-t p-0 even:bg-muted', className)} {...props} />,
    th: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <th className={cn('border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right', className)} {...props} />
    ),
    td: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <td className={cn('border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right', className)} {...props} />
    ),
    pre: ({ className, __rawString__, ...props }: React.HTMLAttributes<HTMLPreElement> & { __rawString__?: string }) => (
        <div className="group relative w-full overflow-hidden">
            <pre className={cn('max-h-[650px] overflow-x-auto rounded-lg border bg-zinc-900 py-4 dark:bg-zinc-900', className)} {...props} />
            {__rawString__ && (
                <CopyButton
                    value={__rawString__}
                    className={cn('absolute right-4 top-4 z-20', 'duration-250 opacity-0 transition-all group-hover:opacity-100')}
                />
            )}
        </div>
    ),
    code: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <code className={cn('relative rounded-md border bg-muted px-[0.4rem] py-1 font-mono text-sm text-foreground', className)} {...props} />
    ),
    Image: (props: ImageProps) => <NextImage {...props} />,
    Callout,
    Card: MdxCard,
    Step: ({ className, ...props }: React.ComponentProps<'h3'>) => (
        <h3 className={cn('mt-8 scroll-m-20 font-heading text-xl font-semibold tracking-tight', className)} {...props} />
    ),
    Steps: ({ ...props }) => <div className="[&>h3]:step steps mb-12 ml-4 border-l pl-8 [counter-reset:step]" {...props} />,
    Link: ({ className, ...props }: React.ComponentProps<typeof Link>) => (
        <Link prefetch={false} className={cn('font-medium underline underline-offset-4', className)} {...props} />
    ),
    LinkedCard: ({ className, ...props }: React.ComponentProps<typeof Link>) => (
        <Link
            prefetch={false}
            className={cn(
                'flex w-full flex-col items-center rounded-xl border bg-card p-6 text-card-foreground shadow transition-colors hover:bg-muted/50 sm:p-10',
                className,
            )}
            {...props}
        />
    ),
};

interface MdxProps {
    code: string;
}

export function Mdx({ code }: MdxProps) {
    const Component = useMDXComponent(code);

    return (
        <div className="mdx mx-auto w-full" dir="auto">
            <Component components={components} />
        </div>
    );
}
