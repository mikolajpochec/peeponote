import { useMemo } from 'react'
import { highlight, languageFor } from './highlight'

export default function HighlightedCode({ code, name }: { code: string; name: string }) {
  const { lang, label } = languageFor(name)
  const html = useMemo(() => highlight(code, lang), [code, lang])
  const lines = useMemo(() => code.split('\n').length, [code])
  return (
    <div className="relative h-full w-full bg-black/30">
      <span className="pointer-events-none absolute right-1.5 top-1 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-frog-200/80">
        {label}
      </span>
      <pre
        data-nodrag
        className="hljs h-full w-full overflow-auto p-2 pr-14 font-mono text-[11px] leading-snug scrollbar-thin select-text"
        style={{ tabSize: 2 }}
      >
        <code className="grid" style={{ gridTemplateColumns: `${String(lines).length + 1}ch 1fr` }}>
          {html.split('\n').map((line, i) => (
            <LineRow key={i} n={i + 1} html={line} />
          ))}
        </code>
      </pre>
    </div>
  )
}

function LineRow({ n, html }: { n: number; html: string }) {
  return (
    <>
      <span className="select-none pr-2 text-right opacity-30">{n}</span>
      {/* hljs output is escaped markup from our own highlighter, not user HTML */}
      <span dangerouslySetInnerHTML={{ __html: html || ' ' }} />
    </>
  )
}
