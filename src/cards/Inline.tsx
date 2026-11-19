import { Fragment } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { isInternalLink, openLink, parseLink } from '../nav/links'
import { MATH_TAGS, protectCurrency, useMath } from './math'

/** Link renderer shared by every card: internal links jump, web links open a tab. */
export const mdLink: Components['a'] = ({ href, children }) => {
  const url = href ?? ''
  // @mentions are pre-processed into mention: links → a chip
  if (url.startsWith('mention:')) {
    return (
      <span className="mention rounded bg-frog-700/50 px-1 font-semibold text-frog-100" data-mention={decodeURIComponent(url.slice(8))}>
        @{decodeURIComponent(url.slice(8))}
      </span>
    )
  }
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

const INLINE = ['p', 'strong', 'em', 'del', 'code', 'a', 'br', 'text', ...MATH_TAGS] as string[]

/** react-markdown drops unknown URL schemes by default — keep peepo:// (and the usual web ones) */
export const keepPeepoUrls = (url: string) => (/^(peepo:\/\/|mention:|https?:\/\/|mailto:|#|\/)/i.test(url) ? url : '')
const passthrough: Components = {
  a: mdLink,
  // paragraphs become plain runs — a text card is one flow of text, not a document
  p: ({ children }) => <>{children}</>,
}

/** `@[Full Name]` / `@Name` → `[@Name](mention:Name)` so react-markdown renders a chip (emails stay untouched) */
export function linkMentions(line: string): string {
  if (!line.includes('@')) return line
  // one pass, so a name produced by the bracket form can't be matched again by the bare form
  return line.replace(/(^|[^\p{L}\p{N}_\]/.])@(?:\[([^\]\n]{1,60})\]|([\p{L}\p{N}_-]{2,40})(?![\p{L}\p{N}_@.]))/gu, (_m, pre: string, bracketed?: string, bare?: string) => {
    const name = bracketed ?? bare ?? ''
    return `${pre}[@${name}](mention:${encodeURIComponent(name)})`
  })
}

/**
 * Keeps a line's block syntax as the text it was typed as. Markdown would otherwise read a leading `#`, `>`, `-`
 * or `1.` as a heading, quote or list: the marker vanished, stray blank lines appeared, and indentation was
 * swallowed, so the card showed something else than its editor. Returns the indentation (drawn as is) and the
 * rest with its first marker escaped.
 */
export function literalBlock(line: string): [indent: string, rest: string] {
  const indent = /^[ \t]*/.exec(line)![0]
  let rest = line.slice(indent.length)
  if (/^\d{1,9}[.)](\s|$)/.test(rest)) rest = rest.replace(/^(\d{1,9})([.)])/, '$1\\$2')
  else if (/^(#{1,6}(\s|$)|>|[-+*](\s|$)|```|~~~|([-*_][ \t]*){3,}$)/.test(rest)) rest = `\\${rest}`
  return [indent, rest]
}

/**
 * Inline-only markdown: **bold**, _italic_, ~~strike~~, `code`, [links](…). Block syntax is rendered as
 * literal text, newlines are kept (the container uses `white-space: pre-wrap`).
 */
export function InlineMd({ text }: { text: string }) {
  // before the early return: a hook that only runs once there is text crashes when an empty field gets its first letter
  const math = useMath(text)
  if (!text) return null
  // one Markdown run per line, joined with <br>: newlines behave exactly like in the textarea
  // (a single markdown pass would emit newline text nodes that pre-wrap containers double up)
  const lines = text.split('\n').map(literalBlock)
  return (
    <>
      {lines.map(([indent, line], i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {indent}
          {line && (
            <Markdown
              allowedElements={INLINE}
              unwrapDisallowed
              skipHtml
              components={passthrough}
              urlTransform={keepPeepoUrls}
              remarkPlugins={math?.remark}
              rehypePlugins={math?.rehype}
            >
              {linkMentions(protectCurrency(line))}
            </Markdown>
          )}
        </Fragment>
      ))}
    </>
  )
}
