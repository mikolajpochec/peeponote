import { useEffect } from 'react'
import { useWorkspace } from '../store/workspace'
import { useReview } from '../store/review'
import { Peepo } from './Peepo'
import { KeyForm, useSignIn } from './KeyForm'

const btn = 'rounded-md bg-swamp-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-500 disabled:opacity-40'
const primary = 'rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Paste a new GitHub key without leaving the workspace. Comes up by itself when GitHub stops accepting the old
 * one (keys expire), and from "Use a new key" when you just want to swap it. Nothing is lost meanwhile: the
 * boards stay open, saves stay in this browser, and they go out the moment the new key works.
 */
export function NewKeyDialog() {
  const open = useWorkspace((s) => s.keyPrompt)
  if (!open) return null
  return <Dialog />
}

function Dialog() {
  const expired = useWorkspace((s) => s.keyExpired)
  const askForKey = useWorkspace((s) => s.askForKey)
  const keyRenewed = useWorkspace((s) => s.keyRenewed)
  const identity = useReview((s) => s.identity)
  const form = useSignIn(() => void keyRenewed())
  const close = () => askForKey(false)

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && askForKey(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [askForKey])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={close}>
      <div
        role="dialog"
        aria-label={expired ? 'Your GitHub key stopped working' : 'Use a new GitHub key'}
        className="flex max-h-full w-full max-w-md flex-col gap-3 overflow-auto rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <Peepo name="peepoShy" size={40} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black">{expired ? 'Your GitHub key stopped working' : 'Use a new GitHub key'}</div>
            <div className="text-[12px] text-frog-200/60">
              {expired
                ? 'Keys expire after a while. Make a new one and paste it below. Your boards and everything you saved are safe in this browser, and go out once you do.'
                : `Make a new key and paste it below${identity.kind === 'github' ? `; it replaces the one @${identity.account.login} is signed in with` : ''}. Your boards stay as they are.`}
            </div>
          </div>
          <button onClick={close} aria-label="Close" className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>
        <KeyForm form={form} />
        <div className="flex items-center gap-2">
          <button className={primary} disabled={form.busy || !form.key.trim()} onClick={() => void form.check(form.key)}>
            {form.busy ? 'Checking…' : 'Use this key'}
          </button>
          <button className={btn} onClick={close}>
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
