import { Buffer } from 'buffer'

// isomorphic-git expects a global Buffer
if (!(globalThis as unknown as { Buffer?: unknown }).Buffer) {
  ;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer
}
