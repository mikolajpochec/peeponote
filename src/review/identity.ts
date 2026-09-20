/**
 * Who wrote what — without a server.
 *
 * The repo is just files, so anyone could drop a comment "as Basia". Each person picks a password once; from
 * name + email + password (plus a random salt kept in their account file) we derive an Ed25519 keypair. The
 * public half is committed in `review/people/<key>.json`; the private half lives only in memory, re-derived
 * from the password stored in this browser. Every review object carries a signature over its content, and
 * readers check it against the author's public key → "verified" or "unverified". The password itself never
 * leaves the device, and the derivation is one-way.
 */
import * as ed from '@noble/ed25519'

export interface Person {
  name: string
  email: string
}

export interface Account extends Person {
  /** base64 random salt for the key derivation */
  salt: string
  /** base64 Ed25519 public key */
  key: string
  createdAt: string
  /** true when a profile picture sits next to the account file */
  picture?: boolean
}

export interface Keys {
  secret: Uint8Array
  public: Uint8Array
  /** base64 of `public` — what the account file stores */
  key: string
}

const enc = new TextEncoder()
export const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** file-name-safe id for a person: mikolaj_pochec_at_proton.me */
export const userKey = (email: string) =>
  email
    .trim()
    .toLowerCase()
    .replace('@', '_at_')
    .replace(/[^a-z0-9._-]+/g, '_')

export const samePerson = (a: Person | null | undefined, b: Person | null | undefined) => !!a && !!b && a.email.trim().toLowerCase() === b.email.trim().toLowerCase()

export function newSalt(): string {
  const s = new Uint8Array(16)
  crypto.getRandomValues(s)
  return b64(s)
}

/** name + email + password + salt → keypair (PBKDF2-SHA256, 200k rounds, then Ed25519 from the 32-byte seed) */
export async function deriveKeys(name: string, email: string, password: string, salt: string): Promise<Keys> {
  const material = await crypto.subtle.importKey('raw', enc.encode(`${name.trim()}\n${email.trim().toLowerCase()}\n${password}`), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: 200_000 }, material, 256)
  const secret = new Uint8Array(bits)
  const pub = await ed.getPublicKeyAsync(secret)
  return { secret, public: pub, key: b64(pub) }
}

/** the bytes a signature covers: stable JSON of the given fields, so key order can't change the outcome */
export function canonical(fields: Record<string, unknown>): Uint8Array {
  const sorted = Object.keys(fields)
    .sort()
    .filter((k) => fields[k] !== undefined)
    .map((k) => [k, fields[k]])
  return enc.encode(JSON.stringify(sorted))
}

export async function sign(keys: Keys, fields: Record<string, unknown>): Promise<string> {
  return b64(await ed.signAsync(canonical(fields), keys.secret))
}

export async function verify(publicKey: string, sig: string | undefined, fields: Record<string, unknown>): Promise<boolean> {
  if (!sig) return false
  try {
    return await ed.verifyAsync(unb64(sig), canonical(fields), unb64(publicKey))
  } catch {
    return false
  }
}

/** initials + a stable colour for people without a picture */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
export function personColor(email: string): string {
  let h = 0
  for (const ch of email.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `hsl(${h % 360} 45% 45%)`
}
