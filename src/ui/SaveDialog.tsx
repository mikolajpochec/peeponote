import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useWorkspace } from '../store/workspace'
import { useSettings } from '../store/settings'
import { Peepo } from './Peepo'

/**
 * Save with a message when the top bar has no room for the message box — same commit, just typed here.
 * Portaled: the top bar is a CSS container, which would anchor a fixed overlay to the bar itself.
 */
export function SaveDialog({ onClose }: { onClose: () => void }) {
  const save = useWorkspace((s) => s.save)
  const busy = useWorkspace((s) => s.busy)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const token = useSettings((s) => s.token)
  const willPush = !!remoteUrl && !!token
  const [msg, setMsg] = useState('')

  const go = async () => {
    onClose()
    await save(msg)
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-20" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <Peepo name={willPush ? 'peepoRun' : 'peepoClap'} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-black tracking-tight">Save with a message</h2>
            <p className="mt-1 text-[13px] text-frog-200/70">
              {willPush ? "Commits here, brings in what others saved, then pushes." : 'Commits on this device.'} The message is optional.
            </p>
          </div>
        </div>
        <input
          autoFocus
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') void go()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="what changed?"
          className="mt-3 w-full rounded-md bg-swamp-700 px-2 py-1.5 text-[13px] outline-none placeholder:text-frog-200/40 focus:ring-1 focus:ring-frog-400"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md bg-swamp-700 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-600">
            Cancel
          </button>
          <button onClick={go} disabled={!!busy} className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:opacity-40">
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
