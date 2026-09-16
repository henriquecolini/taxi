import ReactMarkdown from "react-markdown";

/**
 * Renders summary markdown. Raw HTML is skipped and react-markdown's default
 * URL sanitizer drops `javascript:` and similar links.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
      <ReactMarkdown
        skipHtml
        components={{
          ul: (props) => <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1.5 pl-5 marker:text-muted-foreground" {...props} />,
          p: (props) => <p {...props} />,
          strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
          code: (props) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
          a: ({ href, children: text }) => (
            <a href={href} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer nofollow">
              {text}
            </a>
          ),
          h1: (props) => <p className="font-semibold" {...props} />,
          h2: (props) => <p className="font-semibold" {...props} />,
          h3: (props) => <p className="font-semibold" {...props} />,
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
