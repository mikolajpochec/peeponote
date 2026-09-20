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

export const STORY_KINDS: StoryKindDef[] = [
  {
    kind: 'dialogue',
    label: 'Dialogue',
    icon: '💬',
    color: '#a8c8f5',
    hint: 'A dialogue node: what is said, and the choices that lead on — drag arrows from each choice to the next node',
    w: 300,
    h: 260,
    fields: [
      { key: 'speaker', label: 'Speaker', placeholder: 'who is talking', refs: true },
      { key: 'text', label: 'Says', placeholder: 'the line(s) spoken at this node', long: true },
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
      { key: 'participants', label: 'Who', placeholder: 'who is involved — link other cards', refs: true },
      { key: 'consequences', label: 'Consequences', placeholder: 'what it sets in motion', long: true },
    ],
  },
  {
    kind: 'quest',
    label: 'Quest',
    icon: '🗝️',
    color: '#c9a8f5',
    hint: 'A task with a goal, steps and a reward',
    w: 300,
    h: 320,
    fields: [
      { key: 'giver', label: 'Given by', placeholder: 'who hands it out — link a card', refs: true },
      { key: 'objective', label: 'Objective', placeholder: 'what must be done', long: true },
      { key: 'steps', label: 'Steps', placeholder: 'one per line — link scenes / events', refs: true, long: true },
      { key: 'reward', label: 'Reward', placeholder: 'what you get' },
      { key: 'failure', label: 'If it fails', placeholder: 'consequences of failing / skipping' },
    ],
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
      { key: 'location', label: 'Where', placeholder: 'the place' },
      { key: 'characters', label: 'Who', placeholder: 'who is in it — link other cards', refs: true },
      { key: 'goal', label: 'Goal', placeholder: 'what the POV character wants here' },
      { key: 'conflict', label: 'Conflict', placeholder: 'what stands in the way' },
      { key: 'outcome', label: 'Outcome', placeholder: 'yes / no / yes-but / no-and…' },
      { key: 'summary', label: 'Summary', placeholder: 'what happens, step by step', long: true },
    ],
  },
]

// unknown / legacy kinds (old files) render like an event
export const storyKind = (kind: StoryKind) => STORY_KINDS.find((k) => k.kind === kind) ?? STORY_KINDS.find((k) => k.kind === 'event')!
