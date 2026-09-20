import { useState } from 'react'
import { supportsFolderAccess } from '../fs'
import { useSettings } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { toast } from '../store/toast'
import { Peepo } from './Peepo'
import { TokenHelp } from './TokenHelp'

const field = 'w-full rounded-md bg-swamp-700 px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'
const primary = 'rounded-lg bg-frog-500 px-4 py-2 text-[14px] font-bold text-white hover:bg-frog-400 disabled:opacity-40'
const ghost = 'rounded-lg px-4 py-2 text-[14px] font-semibold text-frog-200 hover:bg-(--hover-strong)'

type Step = 'hello' | 'storage' | 'remote' | 'done'
const ORDER: Step[] = ['hello', 'storage', 'remote', 'done']

/** First-run wizard: git identity → where the repo lives → optional remote. Everything here is a local setting. */
export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const settings = useSettings()
  const fs = useWorkspace((s) => s.fs)
  const switchToFolder = useWorkspace((s) => s.switchToFolder)
  const switchToBrowser = useWorkspace((s) => s.switchToBrowser)
  const setRemote = useWorkspace((s) => s.setRemote)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const busy = useWorkspace((s) => s.busy)
  const [step, setStep] = useState<Step>('hello')
  const [remote, setRemoteDraft] = useState(remoteUrl ?? '')
  const idx = ORDER.indexOf(step)

  const finish = () => {
    settings.set({ onboarded: true })
    onFinish()
  }
  const next = () => setStep(ORDER[Math.min(idx + 1, ORDER.length - 1)])
  const back = () => setStep(ORDER[Math.max(idx - 1, 0)])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-(--hair) bg-swamp-800 p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-1.5">
          {ORDER.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-frog-400' : 'bg-swamp-600'}`} />
          ))}
        </div>

        {step === 'hello' && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Peepo name="peepoHey" size={56} />
              <div>
                <h2 className="text-2xl font-black tracking-tight">Welcome to peeponote</h2>
                <p className="text-[13px] text-frog-200/70">Boards that live in a git repo. Every save is a commit — so git needs to know who you are.</p>
              </div>
            </div>
            <div className="space-y-2">
              <input className={field} autoFocus placeholder="Your name (shows up as the commit author)" value={settings.authorName} onChange={(e) => settings.set({ authorName: e.target.value })} />
              <input className={field} type="email" placeholder="Email for commits" value={settings.authorEmail} onChange={(e) => settings.set({ authorEmail: e.target.value })} />
              <p className="text-[11px] text-frog-200/50">Stored only in this browser. Use the same email as your GitHub account if you want commits attributed to you there.</p>
            </div>
          </>
        )}

        {step === 'storage' && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Peepo name="peepoThink" size={56} />
              <div>
                <h2 className="text-2xl font-black tracking-tight">Where should the repo live?</h2>
                <p className="text-[13px] text-frog-200/70">Both options are full git repositories. You can switch later in Settings.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <button
                onClick={() => fs?.kind !== 'browser' && switchToBrowser()}
                className={`rounded-xl p-3 text-left ring-1 ${fs?.kind === 'browser' ? 'bg-frog-700/40 ring-frog-400' : 'ring-(--hair) hover:bg-(--hover)'}`}
              >
                <div className="text-[14px] font-bold">🧠 In this browser</div>
                <div className="text-[12px] text-frog-200/70">IndexedDB. Zero setup, works everywhere. Push to a remote to get it out.</div>
              </button>
              <button
                disabled={!supportsFolderAccess || !!busy}
                onClick={switchToFolder}
                title={supportsFolderAccess ? '' : 'Needs a Chromium browser (Chrome, Edge, Brave…)'}
                className={`rounded-xl p-3 text-left ring-1 disabled:opacity-40 ${fs?.kind === 'folder' ? 'bg-frog-700/40 ring-frog-400' : 'ring-(--hair) hover:bg-(--hover)'}`}
              >
                <div className="text-[14px] font-bold">📁 A folder on disk {fs?.kind === 'folder' && <span className="text-frog-300">— {fs.label.replace('Folder: ', '')}</span>}</div>
                <div className="text-[12px] text-frog-200/70">A real <code>.git</code> you can also use from a terminal or another editor. Chromium only.</div>
              </button>
            </div>
          </>
        )}

        {step === 'remote' && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Peepo name="peepoRun" size={56} />
              <div>
                <h2 className="text-2xl font-black tracking-tight">Connect a remote?</h2>
                <p className="text-[13px] text-frog-200/70">Optional. With a remote, Save also syncs with everyone else. You can set this up any time in Settings.</p>
              </div>
            </div>
            <div className="space-y-2">
              <input className={field} placeholder="https://github.com/you/my-boards.git" value={remote} onChange={(e) => setRemoteDraft(e.target.value)} />
              <input className={field} type="password" placeholder="Personal access token (repo / contents: read+write)" value={settings.token} onChange={(e) => settings.set({ token: e.target.value })} />
              <p className="text-[11px] text-frog-200/50">
                Create an empty repo first (e.g.{' '}
                <a className="underline hover:text-frog-200" href="https://github.com/new" target="_blank" rel="noreferrer">
                  github.com/new ↗
                </a>
                ) and paste its URL above. GitHub is talked to via its REST API directly; other hosts go through a CORS proxy (configurable in Settings).
              </p>
              <TokenHelp remote={remote} />
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <Peepo name="peepoClap" size={96} className="peepo-bounce" />
            <h2 className="text-2xl font-black tracking-tight">You're set{settings.authorName ? `, ${settings.authorName}` : ''}!</h2>
            <ul className="text-left text-[13px] text-frog-200/80">
              <li>· Grab items from the palette on the left, or double-click the canvas for a note</li>
              <li>· Drop any file onto the board — images, audio, 3D, code, fonts…</li>
              <li>· Drag from a card's edge dots to draw arrows</li>
              <li>· <b>⌘S</b> saves = commit{remote.trim() && settings.token ? ' + push' : ''}</li>
              <li>· Right-click for copy / paste / duplicate</li>
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button onClick={finish} className={ghost}>
            Skip
          </button>
          <div className="flex gap-2">
            {idx > 0 && (
              <button onClick={back} className={ghost}>
                Back
              </button>
            )}
            {step === 'done' ? (
              <button onClick={finish} className={primary}>
                Start
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (step === 'remote' && remote.trim() !== (remoteUrl ?? '')) {
                    await setRemote(remote)
                    if (remote.trim()) toast.ok('Remote saved', 'FeelsOkayMan')
                  }
                  next()
                }}
                disabled={step === 'hello' && !settings.authorName.trim()}
                className={primary}
              >
                {step === 'remote' && !remote.trim() ? 'Skip this' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
