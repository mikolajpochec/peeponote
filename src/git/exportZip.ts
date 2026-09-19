import { zip, type Zippable } from 'fflate'
import { readBytes, type PeepoFS } from '../fs'

/** Recursively read every file under the repo root (including .git) into a path → bytes map. */
async function walk(fs: PeepoFS, dir: string, prefix: string, out: Zippable, onFile?: (n: number) => void) {
  let count = 0
  for (const name of await fs.promises.readdir(dir)) {
    if (name === '.DS_Store') continue
    const full = dir === '/' ? `/${name}` : `${dir}/${name}`
    const rel = prefix ? `${prefix}/${name}` : name
    const st = await fs.promises.stat(full)
    if (st.isDirectory()) {
      await walk(fs, full, rel, out, onFile)
    } else {
      // git objects are already zlib-compressed; don't waste time recompressing them
      const level = rel.startsWith('.git/objects/') || /\.(png|jpe?g|webp|gif|mp3|mp4|webm|ogg|glb|woff2?|zip)$/i.test(rel) ? 0 : 6
      out[rel] = [await readBytes(fs, full), { level }]
      onFile?.(++count)
    }
  }
}

export async function exportRepoZip(fs: PeepoFS, name = 'peeponote'): Promise<void> {
  const files: Zippable = {}
  await walk(fs, fs.dir, '', files)
  const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, (err, data) => (err ? reject(err) : resolve(data))))
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^\w.-]+/g, '_') || 'peeponote'}-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
