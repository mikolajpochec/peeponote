import type { StoryKind } from '../../model/types'

export interface StoryField {
  key: string
  label: string
  placeholder: string
  /** references other objects — gets a "+ link" button that opens the link picker */
  refs?: boolean
  /** taller textarea */
  long?: boolean
}

export interface StoryKindDef {
  kind: StoryKind
  label: string
  icon: string
  /** header strip color */
  color: string
  hint: string
  w: number
  h: number
  fields: StoryField[]
}

export const BEAT_STAGES = ['setup', 'complication', 'turning point', 'climax', 'resolution'] as const

export const STORY_KINDS: StoryKindDef[] = [
  {
    kind: 'character',
    label: 'Character',
    icon: '🧑',
    color: '#c9a8f5',
    hint: 'Who they are, what they want, how they change',
    w: 280,
    h: 300,
    fields: [
      { key: 'role', label: 'Role', placeholder: 'protagonist, mentor, rival…' },
      { key: 'traits', label: 'Traits', placeholder: 'stubborn, kind, afraid of water' },
      { key: 'motivation', label: 'Wants / needs', placeholder: 'what drives them', long: true },
      { key: 'arc', label: 'Arc', placeholder: 'from → to', long: true },
      { key: 'notes', label: 'Notes', placeholder: 'anything else', long: true },
    ],
  },
  {
    kind: 'location',
    label: 'Location',
    icon: '🗺️',
    color: '#a8d8c9',
    hint: 'A place where things happen',
    w: 280,
    h: 240,
    fields: [
      { key: 'description', label: 'Description', placeholder: 'what it looks like, who is there', long: true },
      { key: 'mood', label: 'Mood', placeholder: 'tense, cozy, decaying…' },
      { key: 'notes', label: 'Notes', placeholder: 'rules, history, secrets', long: true },
    ],
  },
  {
    kind: 'event',
    label: 'Event',
    icon: '⚡',
    color: '#f5d48a',
    hint: 'Something that happens — in the world, not necessarily on the page',
    w: 280,
    h: 230,
    fields: [
      { key: 'when', label: 'When', placeholder: 'day 3, before the storm, 1893…' },
      { key: 'description', label: 'What happens', placeholder: 'the event itself', long: true },
      { key: 'participants', label: 'Who', placeholder: 'link characters / places', refs: true },
      { key: 'consequences', label: 'Consequences', placeholder: 'what it sets in motion', long: true },
    ],
  },
  {
    kind: 'dialogue',
    label: 'Dialogue',
    icon: '💬',
    color: '#a8c8f5',
    hint: 'Lines between characters, with stage directions',
    w: 320,
    h: 260,
    fields: [{ key: 'context', label: 'Context', placeholder: 'where / why this exchange happens' }],
  },
  {
    kind: 'scene',
    label: 'Scene',
    icon: '🎬',
    color: '#f5a8a8',
    hint: 'A unit of the story on the page: place, people, goal, conflict, outcome',
    w: 300,
    h: 340,
    fields: [
      { key: 'location', label: 'Where', placeholder: 'link a location', refs: true },
      { key: 'characters', label: 'Who', placeholder: 'link characters', refs: true },
      { key: 'goal', label: 'Goal', placeholder: 'what the POV character wants here' },
      { key: 'conflict', label: 'Conflict', placeholder: 'what stands in the way' },
      { key: 'outcome', label: 'Outcome', placeholder: 'yes / no / yes-but / no-and…' },
      { key: 'summary', label: 'Summary', placeholder: 'what happens, beat by beat', long: true },
    ],
  },
  {
    kind: 'beat',
    label: 'Plot beat',
    icon: '📍',
    color: '#d8d8d8',
    hint: 'A structural point of the plot',
    w: 260,
    h: 170,
    fields: [{ key: 'description', label: 'Description', placeholder: 'what this beat does for the story', long: true }],
  },
]

export const storyKind = (kind: StoryKind) => STORY_KINDS.find((k) => k.kind === kind)!
