// Fetches curated peepo emotes from 7TV into public/peepo/<name>.webp
// Usage: bun scripts/fetch-peepos.ts
import { mkdir, writeFile } from 'node:fs/promises'

const WANTED = [
  'peepoHappy', 'peepoSad', 'peepoClap', 'peepoGiggles', 'peepoShy', 'peepoLeave',
  'peepoRun', 'peepoThink', 'peepoLove', 'peepoSit', 'peepoCheer', 'peepoHey',
  'PepeHands', 'monkaS', 'FeelsOkayMan', 'peepoGlad', 'peepoSmash', 'peepoPog',
]

const GQL = 'https://7tv.io/v3/gql'
const QUERY = `query($q:String!){emotes(query:$q,limit:20,page:1,filter:{exact_match:true,case_sensitive:false}){items{id name animated host{url files{name format}}}}}`

async function find(name: string) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { q: name } }),
  })
  const json = (await res.json()) as {
    data: { emotes: { items: { id: string; name: string; animated: boolean; host: { url: string; files: { name: string }[] } }[] } }
  }
  const items = json.data.emotes.items
  // exact name match, prefer static (non-animated) for lighter files
  const exact = items.filter((i) => i.name.toLowerCase() === name.toLowerCase())
  return exact.find((i) => !i.animated) ?? exact[0] ?? items[0]
}

await mkdir('public/peepo', { recursive: true })
const manifest: Record<string, { id: string; animated: boolean }> = {}
for (const name of WANTED) {
  const emote = await find(name)
  if (!emote) { console.warn('not found:', name); continue }
  const url = `https:${emote.host.url}/4x.webp`
  const buf = await (await fetch(url)).arrayBuffer()
  await writeFile(`public/peepo/${name}.webp`, new Uint8Array(buf))
  manifest[name] = { id: emote.id, animated: emote.animated }
  console.log(`${name} <- ${emote.name} (${emote.id}) ${emote.animated ? 'animated' : 'static'} ${(buf.byteLength / 1024).toFixed(0)}kB`)
}
await writeFile('public/peepo/manifest.json', JSON.stringify(manifest, null, 2))
