export type ThemeName = 'peepo' | 'dark' | 'slate' | 'plum' | 'mocha'

export interface Theme {
  /** surfaces, darkest → lightest */
  swamp: { 900: string; 800: string; 700: string; 600: string; 500: string }
  /** text tones (50 = primary), the accent (300–700) and its deep tints (800–950) */
  frog: { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string; 950: string }
  /** default board background */
  canvas: string
}

const GREEN = { 300: '#8ac47e', 400: '#5d9b4c', 500: '#4a8a3a', 600: '#3d7030', 700: '#2f5726', 800: '#24401e', 900: '#1c2a1e', 950: '#121a13' }

/**
 * A theme is five surfaces plus one accent ramp. `peepo` is the swamp the app grew up in; the rest are plain
 * dark palettes for people who would rather not look at a frog all day (Settings → Look also turns the
 * mascots themselves into icons).
 */
export const THEMES: Record<ThemeName, Theme> = {
  peepo: {
    swamp: { 900: '#101610', 800: '#171f18', 700: '#1f2a21', 600: '#2a3a2c', 500: '#3a4f3d' },
    frog: { 50: '#eef7ec', 100: '#d6ebd1', 200: '#b3d9aa', ...GREEN },
    canvas: '#171f18',
  },
  dark: {
    swamp: { 900: '#0f1113', 800: '#15181c', 700: '#1d2126', 600: '#282d34', 500: '#373d46' },
    frog: { 50: '#f1f3f5', 100: '#d5d9de', 200: '#a9b0b8', ...GREEN },
    canvas: '#15181c',
  },
  slate: {
    swamp: { 900: '#0c1016', 800: '#121822', 700: '#1a2231', 600: '#252f41', 500: '#344054' },
    frog: {
      50: '#eff3f9', 100: '#d2dbe8', 200: '#9fadc0',
      300: '#8fbaff', 400: '#5a8fdd', 500: '#4479c6', 600: '#3761a1', 700: '#2a4a7c', 800: '#1f3659', 900: '#17283f', 950: '#101a2a',
    },
    canvas: '#121822',
  },
  plum: {
    swamp: { 900: '#120e17', 800: '#1a1322', 700: '#241b2f', 600: '#32253f', 500: '#443353' },
    frog: {
      50: '#f4eff8', 100: '#dfd4e9', 200: '#b4a5c2',
      300: '#c7a6ff', 400: '#9b6ee2', 500: '#8455cb', 600: '#6b43a6', 700: '#533381', 800: '#3e265e', 900: '#2c1b43', 950: '#1c112c',
    },
    canvas: '#1a1322',
  },
  mocha: {
    swamp: { 900: '#14100c', 800: '#1c1713', 700: '#26201a', 600: '#342c24', 500: '#473b31' },
    frog: {
      50: '#f7f2ea', 100: '#e5d9c9', 200: '#c0af99',
      300: '#f0c17a', 400: '#cf9440', 500: '#b87c2e', 600: '#956225', 700: '#714a1d', 800: '#563817', 900: '#3d2811', 950: '#28190a',
    },
    canvas: '#1c1713',
  },
}

/** the themes in the order Settings offers them, with the label people read */
export const THEME_LIST: { name: ThemeName; title: string }[] = [
  { name: 'dark', title: 'Dark' },
  { name: 'peepo', title: 'Peepo' },
  { name: 'slate', title: 'Slate' },
  { name: 'plum', title: 'Plum' },
  { name: 'mocha', title: 'Mocha' },
]

export const resolveTheme = (name: ThemeName): Theme => THEMES[name] ?? THEMES.dark

/** Write the theme into the CSS variables Tailwind utilities read. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.swamp)) root.style.setProperty(`--color-swamp-${k}`, v)
  for (const [k, v] of Object.entries(theme.frog)) root.style.setProperty(`--color-frog-${k}`, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.swamp[900])
}
