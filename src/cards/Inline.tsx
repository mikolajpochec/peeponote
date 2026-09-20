import { Fragment } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { isInternalLink, openLink, parseLink } from '../nav/links'

/** Link renderer shared by every card: internal links jump, web links open a tab. */
export const mdLink: Components['a'] = ({ href, children }) => {
  const url = href ?? ''
  const t = isInternalLink(url) ? parseLink(url) : null
  if (t) {
    return (
      <a
        href={url}
        data-nodrag
        className="cursor-pointer font-semibold underline decoration-dotted underline-offset-2"
        title="Jump to this place"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openLink(t)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </a>
    )
  }
  return (
    <a href={url} data-nodrag target="_blank" rel="noreferrer noopener" className="underline underline-offset-2" onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </a>
  )
}

const INLINE = ['p', 'strong', 'em', 'del', 'code', 'a', 'br', 'text'] as string[]
const passthrough: Components = {
  a: mdLink,
  // paragraphs become plain runs — a text card is one flow of text, not a document
  p: ({ children }) => <>{children}</>,
}

/**
 * Inline-only markdown: **bold**, _italic_, ~~strike~~, `code`, [links](…). Block syntax is rendered as
 * literal text, newlines are kept (the container uses `white-space: pre-wrap`).
 */
export function InlineMd({ text }: { text: string }) {
  if (!text) return null
  // one Markdown run per line, joined with <br>: newlines behave exactly like in the textarea
  // (a single markdown pass would emit newline text nodes that pre-wrap containers double up)
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line && (
            <Markdown allowedElements={INLINE} unwrapDisallowed skipHtml components={passthrough}>
              {line}
            </Markdown>
          )}
        </Fragment>
      ))}
    </>
  )
}
