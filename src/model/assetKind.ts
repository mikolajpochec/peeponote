import type { AssetKind } from './types'

const EXT: Record<string, AssetKind> = {
  // images (photos)
  jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', avif: 'image', bmp: 'image', ico: 'image',
  // textures / spritesheets — pixel-perfect preview
  png: 'texture', webp: 'texture', tga: 'other', dds: 'other', ktx: 'other', ktx2: 'other',
  // audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio', aac: 'audio', opus: 'audio',
  // video
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video',
  // 3d
  glb: 'model3d', gltf: 'model3d', obj: 'model3d', stl: 'model3d', fbx: 'model3d',
  // fonts
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
  // code / shaders / scripts
  glsl: 'code', vert: 'code', frag: 'code', geom: 'code', comp: 'code', hlsl: 'code', fx: 'code', cginc: 'code', wgsl: 'code', shader: 'code', gdshader: 'code', metal: 'code',
  js: 'code', mjs: 'code', cjs: 'code', jsx: 'code', ts: 'code', mts: 'code', lua: 'code', gd: 'code', cs: 'code', cpp: 'code', cc: 'code', hpp: 'code', c: 'code', h: 'code',
  py: 'code', rs: 'code', go: 'code', java: 'code', kt: 'code', swift: 'code', rb: 'code', php: 'code', dart: 'code', hx: 'code', zig: 'code',
  sh: 'code', bash: 'code', zsh: 'code', ps1: 'code', bat: 'code', sql: 'code', css: 'code', scss: 'code', html: 'code', htm: 'code', mk: 'code',
  md: 'code', txt: 'code', ini: 'code', cfg: 'code', conf: 'code', env: 'code', log: 'code',
  // data
  json: 'data', yaml: 'data', yml: 'data', csv: 'data', xml: 'data', toml: 'data', tsv: 'data',
  tmx: 'data', tsx: 'data', tres: 'data', tscn: 'data', ldtk: 'data', aseprite: 'other',
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function detectKind(name: string, mime: string): AssetKind {
  const ext = extOf(name)
  if (EXT[ext]) return EXT[ext]
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('font/')) return 'font'
  if (mime.startsWith('text/')) return 'code'
  if (mime.includes('json') || mime.includes('xml')) return 'data'
  return 'other'
}

export const KIND_LABEL: Record<AssetKind, string> = {
  image: 'Image',
  texture: 'Texture',
  audio: 'Audio',
  video: 'Video',
  model3d: '3D',
  font: 'Font',
  code: 'Code',
  data: 'Data',
  other: 'File',
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
