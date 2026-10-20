import { beforeEach, describe, expect, it } from 'vitest'
import { KEY_REMOVED, keyShapeRule, keyStore, redactKey, type KeyRules } from '../key'

// An in-memory Storage, set on the global object for each test, so the tests do not depend on the
// environment the file runs in.
function memoryStorage(): Storage {
  const held = new Map<string, string>()
  return {
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => void held.set(k, v),
    removeItem: (k: string) => void held.delete(k),
    clear: () => held.clear(),
    key: (i: number) => [...held.keys()][i] ?? null,
    get length() {
      return held.size
    },
  } as Storage
}

const NAME = 'acme.assistant.key'
const KEY = 'acme-0123456789abcdef0123456789abcdef'
const RULES: KeyRules = { prefix: 'acme-', minLength: 20, maxLength: 60 }

describe('the key store', () => {
  beforeEach(() => {
    globalThis.sessionStorage = memoryStorage()
    globalThis.localStorage = memoryStorage()
  })

  it('keeps a key for the session only by default, and writes nothing to device storage', () => {
    keyStore(NAME).save(KEY, 'session')
    expect(keyStore(NAME).load()).toEqual({ key: KEY, storage: 'session' })
    expect(globalThis.localStorage.getItem(NAME)).toBeNull()
  })

  it('writes a key to device storage only when asked, and clears the session copy', () => {
    keyStore(NAME).save(KEY, 'session')
    keyStore(NAME).save(KEY, 'device')
    expect(keyStore(NAME).load()).toEqual({ key: KEY, storage: 'device' })
    expect(globalThis.sessionStorage.getItem(NAME)).toBeNull()
  })

  it('reads a device copy before a session copy when both are present', () => {
    globalThis.sessionStorage.setItem(NAME, 'session-copy')
    globalThis.localStorage.setItem(NAME, 'device-copy')
    expect(keyStore(NAME).load()).toEqual({ key: 'device-copy', storage: 'device' })
  })

  it('removes the key from both stores when forgotten', () => {
    keyStore(NAME).save(KEY, 'device')
    keyStore(NAME).forget()
    expect(keyStore(NAME).load()).toBeNull()
    expect(globalThis.localStorage.getItem(NAME)).toBeNull()
  })

  it('takes the storage key name as a parameter, so two names keep two keys', () => {
    keyStore('first.key').save(KEY, 'device')
    expect(keyStore('second.key').load()).toBeNull()
    expect(keyStore('first.key').load()).toEqual({ key: KEY, storage: 'device' })
  })

  it('reads as absent, and does not throw, when a storage throws on access', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled')
      },
    })
    try {
      expect(() => keyStore(NAME).save(KEY, 'session')).not.toThrow()
      expect(keyStore(NAME).load()).toBeNull()
    } finally {
      // the accessor above has no setter, so the saved descriptor is put back rather than assigned over
      if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
    // the storage is whole again: a save and a load reach it
    keyStore(NAME).save(KEY, 'session')
    expect(keyStore(NAME).load()).toEqual({ key: KEY, storage: 'session' })
  })
})

describe('redacting the key from text', () => {
  it('replaces every occurrence of the exact key', () => {
    expect(redactKey(`first ${KEY} and again ${KEY}`, KEY)).toBe(`first ${KEY_REMOVED} and again ${KEY_REMOVED}`)
  })

  it('leaves a different string of the same shape as it is', () => {
    const other = 'acme-ffffffffffffffffffffffffffffffff'
    expect(redactKey(`text with ${other}`, KEY)).toBe(`text with ${other}`)
  })

  it('removes nothing when the key is empty', () => {
    expect(redactKey('no key here', '')).toBe('no key here')
  })
})

describe('the shape of a key', () => {
  it('passes a key of the right prefix and length, with no rule broken', () => {
    expect(keyShapeRule(KEY, RULES)).toBeNull()
  })

  it('names the first rule broken: a space, a character outside printable ASCII, the prefix, the short and the long', () => {
    expect(keyShapeRule('acme-abc def0123456789abcdef', RULES)).toBe('space')
    expect(keyShapeRule('acme-abcédef0123456789abcdef', RULES)).toBe('character')
    expect(keyShapeRule('other-0123456789abcdef0123456789', RULES)).toBe('prefix')
    expect(keyShapeRule('acme-short', RULES)).toBe('short')
    expect(keyShapeRule(`acme-${'a'.repeat(60)}`, RULES)).toBe('long')
  })

  it('reads the prefix from the rules the caller gives', () => {
    expect(keyShapeRule(KEY, { prefix: 'other-', minLength: 20, maxLength: 60 })).toBe('prefix')
  })
})
