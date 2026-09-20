import { useEffect, useMemo, useRef, useState } from 'react'
import { useReview } from '../store/review'
import { useSettings } from '../store/settings'
import { toast } from '../store/toast'
import { Peepo } from '../ui/Peepo'
import { Avatar } from './Avatar'
import { AvatarCropper } from './AvatarCropper'
import { userKey, type Account } from './identity'

const field = 'w-full rounded-md bg-swamp-700 px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'
const btn = 'rounded-md bg-swamp-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-500 disabled:opacity-40'
const primary = 'rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40'

/** Plain-language reason, shown wherever we ask for the password. */
export function WhyPassword() {
  return (
    <p className="text-[12px] leading-relaxed text-frog-200/70">
      Boards are shared as plain files, so anyone with the repo could write a comment under your name. A password proves it's really you when you comment, ask for a
      review or vote. It <b>never leaves this browser</b> and we can't recover it — write it down somewhere safe. Without one you can still edit boards as a guest, just not
      comment.
    </p>
  )
}

type View = 'intro' | 'create' | 'login'

/**
 * Identify yourself: set a password (new account), log in to an account someone (you, on another device) already
 * committed, or stay a guest. Also where the profile picture is set.
 */
export function IdentityDialog({ onClose, intro = false }: { onClose: () => void; intro?: boolean }) {
  const settings = useSettings()
  const accounts = useReview((s) => s.accounts)
  const identity = useReview((s) => s.identity)
  const createAccount = useReview((s) => s.createAccount)
  const login = useReview((s) => s.login)
  const logout = useReview((s) => s.logout)
  const savePicture = useReview((s) => s.savePicture)
  const mine = accounts[userKey(settings.authorEmail)]
  const [view, setView] = useState<View>(intro ? 'intro' : identity.kind === 'verified' ? 'intro' : mine ? 'login' : 'create')
  const [name, setName] = useState(settings.authorName)
  const [email, setEmail] = useState(settings.authorEmail)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [picked, setPicked] = useState<Account | null>(mine ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const list = useMemo(() => Object.values(accounts).sort((a, b) => a.name.localeCompare(b.name)), [accounts])

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const doCreate = async () => {
    setError(null)
    if (pw !== pw2) return setError("The two passwords don't match.")
    setBusy(true)
    const err = await createAccount(name, email, pw)
    setBusy(false)
    if (err) return setError(err)
    toast.ok(`You're verified as ${name.trim()}.`, 'peepoPog')
    onClose()
  }
  const doLogin = async () => {
    if (!picked) return
    setError(null)
    setBusy(true)
    const ok = await login(picked, pw)
    setBusy(false)
    if (!ok) return setError(`That's not the password for ${picked.name} <${picked.email}>.`)
    toast.ok(`Welcome back, ${picked.name}.`, 'peepoHappy')
    onClose()
  }
  const later = () => {
    settings.set({ identityPromptSnoozedUntil: Date.now() + 7 * 24 * 3600 * 1000 })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <Peepo name="peepoShy" size={44} />
          <div className="flex-1">
            <div className="text-lg font-black">{identity.kind === 'verified' ? 'This is you' : 'Who are you?'}</div>
            <div className="text-[12px] text-frog-200/60">Needed for comments, reviews and notifications.</div>
          </div>
          <button onClick={onClose} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>

        {identity.kind === 'verified' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-swamp-700/60 p-3">
              <Avatar person={identity.account} size={56} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">{identity.account.name}</div>
                <div className="truncate text-[12px] text-frog-200/60">{identity.account.email}</div>
                <div className="mt-0.5 text-[11px] text-frog-300">✓ verified on this device</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => fileInput.current?.click()}>
                🖼 {identity.account.picture ? 'Change picture…' : 'Add a picture…'}
              </button>
              {identity.account.picture && (
                <button className={btn} onClick={() => savePicture(null)}>
                  Remove picture
                </button>
              )}
              <button
                className={`${btn} ml-auto text-red-200 hover:bg-red-900/40`}
                onClick={() => {
                  logout()
                  toast.info('Password forgotten on this device. You are a guest now.', 'peepoSit')
                  onClose()
                }}
              >
                Log out here
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) setCropFile(f)
              }}
            />
            <p className="text-[11px] text-frog-200/50">The picture is stored in the repo next to your account (256×256) and shows up beside your comments.</p>
          </div>
        ) : view === 'intro' ? (
          <div className="space-y-3">
            <WhyPassword />
            {identity.kind === 'mismatch' && (
              <div className="rounded-lg bg-amber-900/30 p-2 text-[12px] text-amber-100 ring-1 ring-amber-400/30">
                The password saved in this browser doesn't fit the account committed for <b>{settings.authorEmail}</b>. Log in again with the right one.
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {mine ? (
                <button className={primary} onClick={() => setView('login')}>
                  I have a password — log in
                </button>
              ) : (
                <button className={primary} onClick={() => setView('create')}>
                  Set my password
                </button>
              )}
              {list.length > 0 && !mine && (
                <button className={btn} onClick={() => setView('login')}>
                  I'm one of the {list.length} known people
                </button>
              )}
              {mine && (
                <button className={btn} onClick={() => setView('create')}>
                  I'm someone else
                </button>
              )}
              <button className={`${btn} ml-auto`} onClick={later}>
                Later (stay a guest)
              </button>
            </div>
          </div>
        ) : view === 'create' ? (
          <div className="space-y-2">
            <WhyPassword />
            <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input className={field} type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={field} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <input className={field} type="password" placeholder="Password again" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doCreate()} />
            {error && <div className="text-[12px] text-red-200">{error}</div>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={primary} disabled={busy || !name.trim() || !email.trim() || !pw} onClick={doCreate}>
                {busy ? 'Deriving keys…' : 'Set password'}
              </button>
              {list.length > 0 && (
                <button className={btn} onClick={() => setView('login')}>
                  I already have one
                </button>
              )}
              <button className={`${btn} ml-auto`} onClick={later}>
                Later
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[12px] text-frog-200/70">Pick yourself and type the password you chose earlier.</div>
            <div className="max-h-44 space-y-1 overflow-auto scrollbar-thin">
              {list.map((a) => (
                <button
                  key={a.email}
                  onClick={() => setPicked(a)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ring-1 ${picked?.email === a.email ? 'bg-frog-700/40 ring-frog-400' : 'ring-transparent hover:bg-(--hover)'}`}
                >
                  <Avatar person={a} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{a.name}</div>
                    <div className="truncate text-[11px] text-frog-200/50">{a.email}</div>
                  </div>
                </button>
              ))}
              {!list.length && <div className="p-2 text-[12px] text-frog-200/50">Nobody has set a password in this repo yet.</div>}
            </div>
            <input className={field} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLogin()} autoFocus />
            {error && <div className="text-[12px] text-red-200">{error}</div>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={primary} disabled={busy || !picked || !pw} onClick={doLogin}>
                {busy ? 'Checking…' : 'Log in'}
              </button>
              <button className={btn} onClick={() => setView('create')}>
                I'm new here
              </button>
              <button className={`${btn} ml-auto`} onClick={later}>
                Later
              </button>
            </div>
          </div>
        )}
      </div>
      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onDone={async (webp) => {
            setCropFile(null)
            await savePicture(webp)
            toast.ok('Picture saved.', 'peepoHappy')
          }}
        />
      )}
    </div>
  )
}

/** Should we ask this person to identify themselves right now? (existing user, no password, not snoozed) */
export function shouldPromptIdentity(): boolean {
  const s = useSettings.getState()
  const r = useReview.getState()
  if (!r.loaded) return false
  if (r.identity.kind === 'verified') return false
  if (!s.authorName.trim() || !s.authorEmail.trim()) return false // onboarding handles newcomers
  if (r.identity.kind === 'mismatch') return true
  return Date.now() > s.identityPromptSnoozedUntil
}
