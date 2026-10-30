import ReactMarkdown from "react-markdown";

/** Renders CMS Markdown. Raw HTML is not rendered (react-markdown default), so content cannot inject scripts. */
export function Markdown({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return (
    <div className="prose-cms">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined} target={href?.startsWith("http") ? "_blank" : undefined}>
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
