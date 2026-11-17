import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Model-written Markdown sits under the page's own <h1>, so every heading moves down one level.
// The classes keep the original look (see .report .rh1 … in styles/index.css).
const HEADINGS = {
  h1: (props) => <h2 className="rh1" {...props} />,
  h2: (props) => <h3 className="rh2" {...props} />,
  h3: (props) => <h4 className="rh3" {...props} />,
  h4: (props) => <h5 className="rh4" {...props} />,
};

/** GitHub-flavoured Markdown from the agents: no raw HTML, external links open in a new tab. */
export function Markdown({ children, components }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        ...HEADINGS,
        a: ({ href, children: text }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {text}
          </a>
        ),
        ...components,
      }}
    >
      {children || ''}
    </ReactMarkdown>
  );
}
