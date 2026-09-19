export type ThemeName = 'peepo' | 'dark'

export interface Theme {
  /** surfaces, darkest → lightest */
  swamp: { 900: string; 800: string; 700: string; 600: string; 500: string }
  /** text tones (50 = primary) and green accents */
  frog: { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string }
  /** default board background */
  canvas: string
}

const GREEN = { 300: '#8ac47e', 400: '#5d9b4c', 500: '#4a8a3a', 600: '#3d7030', 700: '#2f5726' }

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
}

export const resolveTheme = (name: ThemeName): Theme => THEMES[name] ?? THEMES.dark

/** Write the theme into the CSS variables Tailwind utilities read. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.swamp)) root.style.setProperty(`--color-swamp-${k}`, v)
  for (const [k, v] of Object.entries(theme.frog)) root.style.setProperty(`--color-frog-${k}`, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.swamp[900])
}
