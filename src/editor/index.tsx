import { lazy, Suspense } from 'react'
import type { MdEditorProps } from './MdEditor'

// CodeMirror is ~250 KB — loaded the first time something is edited
const Inner = lazy(() => import('./MdEditor').then((m) => ({ default: m.MdEditor })))

export function MdEditor(props: MdEditorProps) {
  return (
    <Suspense fallback={<div className={`whitespace-pre-wrap break-words opacity-70 ${props.className ?? ''}`}>{props.value || props.placeholder}</div>}>
      <Inner {...props} />
    </Suspense>
  )
}
