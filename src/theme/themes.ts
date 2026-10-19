import type { IconStyle } from './glyphs'

/** one Look = a colour scheme and the icons drawn with it, picked together in Settings → Look */
export type LookName = 'pond' | 'swamp' | 'pop' | 'candy' | 'slate' | 'mocha' | 'ink'

/** what stands in for the frogs: the peepos themselves, colour-coded badges, or plain icons in the text colour */
export type LookIcons = 'peepo' | IconStyle

export interface Theme {
  /** surfaces, darkest → lightest */
  swamp: { 900: string; 800: string; 700: string; 600: string; 500: string }
  /** text tones (50 = primary), the accent (300–700) and its deep tints (800–950) */
  frog: { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string; 950: string }
  /** default board background */
  canvas: string
}

export interface Look {
  title: string
  /** one line under the swatch: what the look is for */
  sub: string
  icons: LookIcons
  theme: Theme
  /** the colour badge of the app's own marks (logo, board), in the look's accent rather than a fixed green */
  badge: { from: string; to: string; ink: string }
}

const GREEN = { 300: '#8ac47e', 400: '#5d9b4c', 500: '#4a8a3a', 600: '#3d7030', 700: '#2f5726', 800: '#24401e', 900: '#1c2a1e', 950: '#121a13' }
const GREEN_BADGE = { from: '#8fe07a', to: '#2a9a50', ink: '#2a7a43' }

/**
 * Each look pairs a palette with the icons it was made for, so the two can't clash (a plum app with green frogs, a
 * swamp with blue badges). The frogs are green, so their looks are green; the colour badges are bright and many-hued,
 * so their looks sit on quiet surfaces with an accent taken from the badges themselves; the plain icons are drawn in
 * the text colour, so their looks carry the colour in the surfaces and text instead.
 */
export const LOOKS: Record<LookName, Look> = {
  pond: {
    title: 'Pond',
    sub: 'Peepos on a calm dark grey',
    icons: 'peepo',
    badge: GREEN_BADGE,
    theme: {
      swamp: { 900: '#0f1113', 800: '#15181c', 700: '#1d2126', 600: '#282d34', 500: '#373d46' },
      frog: { 50: '#f1f3f5', 100: '#d5d9de', 200: '#a9b0b8', ...GREEN },
      canvas: '#15181c',
    },
  },
  swamp: {
    title: 'Swamp',
    sub: 'Peepos at home, all green',
    icons: 'peepo',
    badge: GREEN_BADGE,
    theme: {
      swamp: { 900: '#101610', 800: '#171f18', 700: '#1f2a21', 600: '#2a3a2c', 500: '#3a4f3d' },
      frog: { 50: '#eef7ec', 100: '#d6ebd1', 200: '#b3d9aa', ...GREEN },
      canvas: '#171f18',
    },
  },
  pop: {
    title: 'Pop',
    sub: 'Colour badges on neutral charcoal',
    icons: 'colour',
    badge: { from: '#86d3ff', to: '#2f86ec', ink: '#1b5498' },
    theme: {
      swamp: { 900: '#101113', 800: '#17181b', 700: '#202226', 600: '#2b2e33', 500: '#3b3f46' },
      frog: {
        50: '#f3f4f6', 100: '#d8dbe0', 200: '#a8aeb7',
        300: '#86c4ff', 400: '#4a9af0', 500: '#2f86ec', 600: '#236dc6', 700: '#1b5498', 800: '#163e6e', 900: '#112c4c', 950: '#0b1c31',
      },
      canvas: '#17181b',
    },
  },
  candy: {
    title: 'Candy',
    sub: 'Colour badges on deep berry',
    icons: 'colour',
    badge: { from: '#ff9cc2', to: '#e5306e', ink: '#8f1c45' },
    theme: {
      swamp: { 900: '#140d13', 800: '#1c131b', 700: '#271a25', 600: '#352433', 500: '#4a3347' },
      frog: {
        50: '#f9eff6', 100: '#ead5e3', 200: '#c4a7ba',
        300: '#ff9cc2', 400: '#f2649b', 500: '#e0407a', 600: '#b92e61', 700: '#8f2249', 800: '#661a36', 900: '#451226', 950: '#2c0b18',
      },
      canvas: '#1c131b',
    },
  },
  slate: {
    title: 'Slate',
    sub: 'Plain icons, cool blue',
    icons: 'line',
    badge: { from: '#8fbaff', to: '#3761a1', ink: '#2a4a7c' },
    theme: {
      swamp: { 900: '#0c1016', 800: '#121822', 700: '#1a2231', 600: '#252f41', 500: '#344054' },
      frog: {
        50: '#eff3f9', 100: '#d2dbe8', 200: '#9fadc0',
        300: '#8fbaff', 400: '#5a8fdd', 500: '#4479c6', 600: '#3761a1', 700: '#2a4a7c', 800: '#1f3659', 900: '#17283f', 950: '#101a2a',
      },
      canvas: '#121822',
    },
  },
  mocha: {
    title: 'Mocha',
    sub: 'Plain icons, warm coffee',
    icons: 'line',
    badge: { from: '#f0c17a', to: '#956225', ink: '#714a1d' },
    theme: {
      swamp: { 900: '#14100c', 800: '#1c1713', 700: '#26201a', 600: '#342c24', 500: '#473b31' },
      frog: {
        50: '#f7f2ea', 100: '#e5d9c9', 200: '#c0af99',
        300: '#f0c17a', 400: '#cf9440', 500: '#b87c2e', 600: '#956225', 700: '#714a1d', 800: '#563817', 900: '#3d2811', 950: '#28190a',
      },
      canvas: '#1c1713',
    },
  },
  ink: {
    title: 'Ink',
    sub: 'Plain icons, black and white',
    icons: 'line',
    badge: { from: '#d5dae1', to: '#6d7684', ink: '#4b5361' },
    theme: {
      swamp: { 900: '#0d0d0e', 800: '#141415', 700: '#1c1c1e', 600: '#27272a', 500: '#38383c' },
      frog: {
        50: '#f5f5f6', 100: '#dcdcdf', 200: '#aaaab0',
        300: '#e4e4e8', 400: '#b9b9c0', 500: '#8d8d96', 600: '#6c6c75', 700: '#4e4e56', 800: '#36363c', 900: '#25252a', 950: '#18181b',
      },
      canvas: '#141415',
    },
  },
}

/** the looks in the order Settings offers them, grouped by their icons */
export const LOOK_LIST: LookName[] = ['pond', 'swamp', 'pop', 'candy', 'slate', 'mocha', 'ink']

export const lookOf = (name: LookName): Look => LOOKS[name] ?? LOOKS.pond
export const resolveTheme = (name: LookName): Theme => lookOf(name).theme
/** the peepos are on (otherwise every one of them is drawn as an icon in `lookOf(name).icons`) */
export const mascotsOn = (name: LookName) => lookOf(name).icons === 'peepo'

/**
 * Before 1.8.2 the colours (`theme`) and the icons (`mascots`, `iconStyle`) were two separate settings; this picks the
 * look closest to what someone had, keeping their icons and the feel of their colours.
 */
export function lookFromLegacy(theme?: string, mascots = true, iconStyle: IconStyle = 'colour'): LookName {
  if (mascots) return theme === 'peepo' ? 'swamp' : 'pond'
  if (iconStyle === 'colour') return theme === 'plum' || theme === 'mocha' ? 'candy' : 'pop'
  if (theme === 'slate' || theme === 'mocha') return theme
  return theme === 'plum' ? 'slate' : 'ink'
}

/** Write the theme into the CSS variables Tailwind utilities read. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.swamp)) root.style.setProperty(`--color-swamp-${k}`, v)
  for (const [k, v] of Object.entries(theme.frog)) root.style.setProperty(`--color-frog-${k}`, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.swamp[900])
}
