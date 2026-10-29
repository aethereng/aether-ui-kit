import type { Json } from './contracts'

/** Canonical text of a value: object keys in code-unit order, no whitespace. A key whose value is undefined is absent. */
export function canonical(value: Json | undefined): string {
  if (value === undefined) throw new TypeError('canonical: undefined has no text')
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical: a number that is not finite has no text')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonical(v)).join(',')}]`
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
}

/** Deep equality of two values, where undefined (absent) equals only undefined and `null` equals only `null`. */
export function equal(a: Json | undefined, b: Json | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  if (a === null || b === null) return a === b
  if (typeof a !== 'object' || typeof b !== 'object') return a === b
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]))
  const ka = Object.keys(a).filter((k) => (a as { [k: string]: Json })[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as { [k: string]: Json })[k] !== undefined)
  if (ka.length !== kb.length) return false
  return ka.every((k) => equal((a as { [k: string]: Json })[k], (b as { [k: string]: Json })[k]))
}

/**
 * What is wrong with a list of ids given as the order of a kind, or null: it must be a list of text that names each id
 * the kind holds once and no other. The list is read by position, so a hole in it is a missing entry.
 */
export function orderProblem(order: Json | undefined, held: readonly string[]): string | null {
  if (!Array.isArray(order)) return 'must be a list of ids'
  const ids: unknown[] = []
  for (let i = 0; i < order.length; i++) ids.push(order[i])
  if (ids.some((id) => typeof id !== 'string')) return 'must be a list of ids'
  const listed = ids as string[]
  const seen = new Set<string>()
  for (const id of listed) {
    if (seen.has(id)) return `names '${id}' twice`
    seen.add(id)
  }
  const kept = new Set(held)
  const stranger = listed.find((id) => !kept.has(id))
  if (stranger !== undefined) return `names '${stranger}', which the kind does not hold`
  const missing = held.find((id) => !seen.has(id))
  return missing === undefined ? null : `leaves out '${missing}'`
}

/** The pointer of the first number in the value that is not finite, or null when every number is (the hash has no text for one). */
export function nonFinite(value: Json, at = ''): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : at
  if (value === null || typeof value !== 'object') return null
  for (const [k, v] of Object.entries(value)) {
    const found = v === undefined ? null : nonFinite(v, `${at}/${k}`)
    if (found !== null) return found
  }
  return null
}

/** The name no stored content may hold as a key: assigned to a plain object it sets the object's prototype and stores no key. */
export const PROTO_KEY = '__proto__'

/** The value an object holds under the key as its own property; a name that only the prototype chain knows (`constructor`) holds nothing. */
export function own(object: { readonly [key: string]: Json | undefined }, key: string): Json | undefined {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined
}

/** The pointer of the first key named __proto__ anywhere in the value, or null when there is none (a key of that name cannot be stored as content). */
export function protoKey(value: Json, at = ''): string | null {
  if (value === null || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = protoKey(value[i]!, `${at}/${i}`)
      if (found !== null) return found
    }
    return null
  }
  for (const [k, v] of Object.entries(value)) {
    if (k === PROTO_KEY) return `${at}/${k}`
    const found = v === undefined ? null : protoKey(v, `${at}/${k}`)
    if (found !== null) return found
  }
  return null
}

/** The entries of an object, copied; each is defined as an own data property, so a key named __proto__ stays a key. */
function copyEntries(value: { [k: string]: Json | undefined }, copy: (v: Json) => Json): { [k: string]: Json } {
  const entries: Array<[string, Json]> = []
  for (const k of Object.keys(value)) {
    const v = value[k]
    if (v !== undefined) entries.push([k, copy(v)])
  }
  return Object.fromEntries(entries)
}

/** A deep copy that is frozen all the way down: what the store keeps, so nothing outside can write into it. */
export function frozenCopy<T extends Json>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return Object.freeze(value.map((v) => frozenCopy(v))) as T
  return Object.freeze(copyEntries(value, frozenCopy)) as T
}

/** A deep copy a caller may write into. */
export function plainCopy<T extends Json>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => plainCopy(v)) as T
  return copyEntries(value, plainCopy) as T
}

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n))

const K = new Uint32Array(64)
const H0 = new Uint32Array(8)
{
  // The round constants are the first 32 fractional bits of the cube roots of the first 64 primes, and
  // the start state those of the square roots of the first 8; both are computed here.
  const primes: number[] = []
  for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p !== 0)) primes.push(n)
  const frac = (x: number): number => Math.floor((x - Math.floor(x)) * 2 ** 32)
  primes.forEach((p, i) => {
    K[i] = frac(Math.cbrt(p))
    if (i < 8) H0[i] = frac(Math.sqrt(p))
  })
}

/** SHA-256 of the UTF-8 text, as 64 hex digits. Synchronous, so a content hash can be compared where a caller cannot await. */
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const total = (((bytes.length + 8) >> 6) + 1) << 6
  const buf = new Uint8Array(total)
  buf.set(bytes)
  buf[bytes.length] = 0x80
  const view = new DataView(buf.buffer)
  const bits = bytes.length * 8
  view.setUint32(total - 8, Math.floor(bits / 2 ** 32))
  view.setUint32(total - 4, bits >>> 0)
  const h = H0.slice()
  const w = new Uint32Array(64)
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]!
      const y = w[i - 2]!
      w[i] = w[i - 16]! + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + w[i - 7]! + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10))
    }
    let a = h[0]!
    let b = h[1]!
    let c = h[2]!
    let d = h[3]!
    let e = h[4]!
    let f = h[5]!
    let g = h[6]!
    let hh = h[7]!
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = h[0]! + a
    h[1] = h[1]! + b
    h[2] = h[2]! + c
    h[3] = h[3]! + d
    h[4] = h[4]! + e
    h[5] = h[5]! + f
    h[6] = h[6]! + g
    h[7] = h[7]! + hh
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('')
}
