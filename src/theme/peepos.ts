export const PEEPOS = [
  'peepoHappy', 'peepoSad', 'peepoClap', 'peepoGiggles', 'peepoShy', 'peepoLeave',
  'peepoRun', 'peepoThink', 'peepoLove', 'peepoSit', 'peepoCheer', 'peepoHey',
  'PepeHands', 'monkaS', 'FeelsOkayMan', 'peepoGlad', 'peepoSmash', 'peepoPog',
] as const

export type PeepoName = (typeof PEEPOS)[number]

export const peepoSrc = (name: PeepoName) => `${import.meta.env.BASE_URL}peepo/${name}.webp`
