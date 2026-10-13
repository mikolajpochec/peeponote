import { useEffect, useState } from 'react'
import { useReview } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { Peepo } from '../ui/Peepo'
import { KeyForm, useSignIn } from '../ui/KeyForm'
import { Avatar } from './Avatar'
import { AvatarCropper } from './AvatarCropper'

const btn = 'rounded-md bg-swamp-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-500 disabled:opacity-40'
const primary = 'rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Sign in with GitHub, or (when you already are) see who you are here, change your picture and sign out.
 * Comments, reviews and saving all hang off this: a guest reads, a collaborator writes.
 */
export function SignInDialog({ onClose }: { onClose: () => void }) {
  const identity = useReview((s) => s.identity)
  const savePicture = useReview((s) => s.savePicture)
  const signOut = useReview((s) => s.signOut)
  const refreshAccess = useWorkspace((s) => s.refreshAccess)
  const access = useWorkspace((s) => s.access)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const [cropping, setCropping] = useState<File | null>(null)
  const form = useSignIn(async () => {
    await useReview.getState().refreshIdentity()
    await refreshAccess(true)
  })

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-md flex-col gap-3 overflow-auto rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <Peepo name={identity.kind === 'github' ? 'peepoHappy' : 'peepoShy'} size={40} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black">{identity.kind === 'github' ? 'Your GitHub account' : 'Sign in with GitHub'}</div>
            <div className="text-[12px] text-frog-200/60">
              {identity.kind === 'github'
                ? 'Saves, comments and reviews are written as this account.'
                : 'Boards can be read without signing in. Editing, comments and reviews need a GitHub account, and the repo decides what you may change.'}
            </div>
          </div>
          <button onClick={onClose} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>

        {identity.kind === 'github' ? (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-swamp-700/60 p-3">
              <Avatar person={identity.account} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{identity.account.name}</div>
                <a className="truncate text-[12px] text-frog-300 hover:underline" href={`https://github.com/${identity.account.login}`} target="_blank" rel="noreferrer">
                  @{identity.account.login} ↗
                </a>
              </div>
            </div>
            {remoteUrl && (
              <p className="text-[12px] text-frog-200/70">
                {access === 'write'
                  ? 'GitHub lets you push to this repo, so you can edit the boards, comment and review here.'
                  : access === 'read'
                    ? 'GitHub gives you read access to this repo. You can look around; ask the owner to add you as a collaborator to edit.'
                    : 'This account cannot reach the repo behind this workspace.'}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className={`${btn} cursor-pointer`}>
                {identity.account.picture ? 'Change picture…' : 'Add a picture…'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setCropping(e.target.files?.[0] ?? null)} />
              </label>
              {identity.account.picture && (
                <button className={btn} onClick={() => void savePicture(null)}>
                  Use my GitHub picture
                </button>
              )}
              <button
                className={`${btn} ml-auto text-red-100 hover:bg-red-900/50`}
                onClick={() => {
                  signOut()
                  void refreshAccess(true)
                  onClose()
                }}
              >
                Sign out
              </button>
            </div>
            {cropping && <AvatarCropper file={cropping} onCancel={() => setCropping(null)} onDone={(webp) => (setCropping(null), void savePicture(webp))} />}
          </>
        ) : (
          <>
            <KeyForm form={form} />
            <div className="flex items-center gap-2">
              <button className={primary} disabled={form.busy || !form.key.trim()} onClick={() => void form.check(form.key)}>
                {form.busy ? 'Checking…' : 'Sign in'}
              </button>
              <button className={btn} onClick={onClose}>
                Stay a guest
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
