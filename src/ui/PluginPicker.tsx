import { PLUGINS, pluginOn } from '../plugins'
import { useSettings } from '../store/settings'
import { Peepo } from './Peepo'

/** one switch per plugin; used by onboarding, the "plugins are here" dialog and Settings → Plugins */
export function PluginPicker() {
  const plugins = useSettings((s) => s.plugins)
  const set = useSettings((s) => s.set)
  return (
    <div className="flex flex-col gap-2">
      {PLUGINS.map((p) => {
        const on = pluginOn(plugins, p.id)
        return (
          <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-lg bg-swamp-800/60 px-3 py-2.5 ring-1 ring-(--hair) hover:bg-(--hover)">
            <span className="w-6 text-center text-[20px] leading-none">{p.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">{p.name}</span>
              <span className="block text-[11px] leading-relaxed text-frog-200/50">{p.description}</span>
            </span>
            <input type="checkbox" className="mt-1 h-4 w-4 accent-frog-500" checked={on} onChange={(e) => set({ plugins: { ...plugins, [p.id]: e.target.checked } })} />
          </label>
        )
      })}
    </div>
  )
}

/**
 * Shown once to people who used peeponote before plugins existed: what a plugin is, and which ones they want.
 * New people answer the same question inside onboarding instead.
 */
export function PluginsIntroDialog({ onClose }: { onClose: () => void }) {
  const set = useSettings((s) => s.set)
  const done = () => {
    set({ pluginsChosen: true })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-(--hair) bg-swamp-800 shadow-2xl">
        <div className="flex items-start gap-3 px-5 pt-4">
          <Peepo name="peepoHey" size={44} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-xl font-black tracking-tight">peeponote has plugins now</div>
            <p className="text-[13px] text-frog-200/70">
              A plugin is an extra set of tools for the palette, for one kind of work. Pick the ones you want; the rest stay out of your way.
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 scrollbar-thin">
          <PluginPicker />
          <p className="mt-3 text-[11px] leading-relaxed text-frog-200/50">
            Story is the story planning you already know; Code is new. Turning a plugin off only takes its tools out of the palette: cards it made stay on your boards. You can change
            this any time in Settings → Plugins.
          </p>
        </div>
        <div className="flex justify-end border-t border-(--hair) px-5 py-2.5">
          <button onClick={done} className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
