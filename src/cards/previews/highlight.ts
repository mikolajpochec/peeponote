import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import dart from 'highlight.js/lib/languages/dart'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import glsl from 'highlight.js/lib/languages/glsl'
import go from 'highlight.js/lib/languages/go'
import haxe from 'highlight.js/lib/languages/haxe'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import lua from 'highlight.js/lib/languages/lua'
import makefile from 'highlight.js/lib/languages/makefile'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scss from 'highlight.js/lib/languages/scss'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const LANGS = {
  bash, c, cpp, csharp, css, dart, dockerfile, glsl, go, haxe, ini, java, javascript, json, kotlin, lua,
  makefile, markdown, php, python, ruby, rust, scss, sql, swift, typescript, xml, yaml,
} as const

for (const [name, def] of Object.entries(LANGS)) hljs.registerLanguage(name, def)

/** hljs grammar for a file extension (or special filename). Shader dialects without a grammar borrow the closest one. */
const BY_EXT: Record<string, keyof typeof LANGS> = {
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hlsl: 'cpp', fx: 'cpp', cginc: 'cpp', shader: 'cpp', metal: 'cpp',
  cs: 'csharp',
  css: 'css', scss: 'scss', sass: 'scss', less: 'scss',
  dart: 'dart',
  dockerfile: 'dockerfile',
  glsl: 'glsl', vert: 'glsl', frag: 'glsl', geom: 'glsl', comp: 'glsl', tesc: 'glsl', tese: 'glsl', vs: 'glsl', fs: 'glsl', gdshader: 'glsl',
  go: 'go',
  hx: 'haxe',
  ini: 'ini', cfg: 'ini', conf: 'ini', toml: 'ini', properties: 'ini', env: 'ini', tres: 'ini', tscn: 'ini', godot: 'ini', import: 'ini',
  java: 'java',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  json: 'json', jsonc: 'json', json5: 'json', ldtk: 'json', tiled: 'json', babylon: 'json', gltf: 'json',
  kt: 'kotlin', kts: 'kotlin',
  lua: 'lua',
  mk: 'makefile', makefile: 'makefile',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  php: 'php',
  py: 'python', pyw: 'python', gd: 'python', // GDScript is close enough to Python for highlighting
  rb: 'ruby',
  rs: 'rust', wgsl: 'rust', // WGSL shares Rust-like syntax
  sql: 'sql',
  swift: 'swift',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript',
  xml: 'xml', html: 'xml', htm: 'xml', svg: 'xml', xaml: 'xml', plist: 'xml', tmx: 'xml', tsx_tiled: 'xml', csproj: 'xml', uxml: 'xml',
  yml: 'yaml', yaml: 'yaml',
}

/** Friendly label for the header badge */
const LABEL: Record<string, string> = {
  hlsl: 'HLSL', fx: 'HLSL', cginc: 'HLSL', shader: 'ShaderLab', metal: 'Metal', gdshader: 'Godot shader', wgsl: 'WGSL', gd: 'GDScript',
  tres: 'Godot resource', tscn: 'Godot scene', tmx: 'Tiled map', ldtk: 'LDtk', toml: 'TOML', cs: 'C#', cpp: 'C++', hpp: 'C++', cc: 'C++',
  ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX', py: 'Python', rs: 'Rust', kt: 'Kotlin', rb: 'Ruby', sh: 'Shell', yml: 'YAML', yaml: 'YAML',
  md: 'Markdown', json: 'JSON', xml: 'XML', html: 'HTML', svg: 'SVG', css: 'CSS', scss: 'SCSS', sql: 'SQL', lua: 'Lua', go: 'Go', java: 'Java', swift: 'Swift',
  c: 'C', h: 'C header', glsl: 'GLSL', vert: 'GLSL vertex', frag: 'GLSL fragment', geom: 'GLSL geometry', comp: 'GLSL compute', ini: 'INI', cfg: 'Config', env: 'Env', txt: 'Text', dart: 'Dart', hx: 'Haxe', php: 'PHP', mk: 'Makefile',
}

export function languageFor(name: string): { lang: keyof typeof LANGS | null; label: string } {
  const lower = name.toLowerCase()
  const base = lower.slice(lower.lastIndexOf('/') + 1)
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return { lang: 'dockerfile', label: 'Dockerfile' }
  if (base === 'makefile' || base === 'gnumakefile') return { lang: 'makefile', label: 'Makefile' }
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : ''
  const lang = BY_EXT[ext] ?? null
  return { lang, label: LABEL[ext] ?? (ext ? ext.toUpperCase() : 'Text') }
}

export function highlight(code: string, lang: keyof typeof LANGS | null): string {
  if (lang) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      /* fall through */
    }
  }
  const auto = hljs.highlightAuto(code, ['json', 'yaml', 'javascript', 'python', 'glsl', 'xml', 'ini'])
  return auto.relevance > 4 ? auto.value : escapeHtml(code)
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}
