/**
 * Plugins: optional sets of tools on top of the core palette (notes, text, shapes, boards, files).
 * A plugin only decides what you can *add*; cards it made always render, even with the plugin off,
 * so turning one off never hides anything on a board. Personal, per browser (settings.plugins).
 */
import { useSettings } from '../store/settings'

export type PluginId = 'story' | 'code'

export interface PluginDef {
  id: PluginId
  name: string
  icon: string
  description: string
  /** on until you turn it off */
  defaultOn: boolean
}

export const PLUGINS: PluginDef[] = [
  {
    id: 'story',
    name: 'Story',
    icon: '📖',
    description: 'Story planning cards: dialogue with choices, events, quests and scenes.',
    defaultOn: true,
  },
  {
    id: 'code',
    name: 'Code',
    icon: '{}',
    description: 'Flowchart blocks for sketching code: start and end, steps, decisions, input and output, loops, subroutines.',
    defaultOn: true,
  },
]

export const pluginOn = (plugins: Partial<Record<PluginId, boolean>>, id: PluginId) =>
  plugins[id] ?? PLUGINS.find((p) => p.id === id)?.defaultOn ?? false

/** whether a plugin is switched on in this browser */
export const usePlugin = (id: PluginId) => useSettings((s) => pluginOn(s.plugins, id))
