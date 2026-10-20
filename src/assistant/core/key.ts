/* Where a person's key is kept, which rules it must keep to, and the one place it is removed from
 * what they type. Framework-free: a store takes the name of the storage key it writes under, so each
 * app keeps its own name, and nothing here names a vendor.
 *
 * Session-only by default: session storage, entered again on the next visit. Any script on the same
 * origin can read device storage, so a key is written there only when the person asks for it. Nothing
 * here writes the key to a record, a link or a log. */

/** The placeholder that stands where the key was in a person's text. */
export const KEY_REMOVED = '[key removed]'

export type KeyStorage = 'session' | 'device'

export interface KeyLoad {
  key: string
  storage: KeyStorage
}

export interface KeyStore {
  /** The key kept from an earlier visit or an earlier page of this one, and where it was kept. */
  load(): KeyLoad | null
  /** Keep the key where the person chose, and nowhere else. */
  save(key: string, storage: KeyStorage): void
  /** Remove the key from both stores. */
  forget(): void
}

// A store that throws on access, as a browser with storage disabled does, reads as absent.
function storageOf(pick: () => Storage): Storage | null {
  try {
    return pick()
  } catch {
    return null
  }
}

function stores(): { session: Storage | null; device: Storage | null } {
  return {
    session: storageOf(() => globalThis.sessionStorage),
    device: storageOf(() => globalThis.localStorage),
  }
}

/** A store that keeps the key under `storageKey` in session storage or in device storage. */
export function keyStore(storageKey: string): KeyStore {
  return {
    load() {
      const { session, device } = stores()
      const kept = device?.getItem(storageKey)
      if (kept) return { key: kept, storage: 'device' }
      const visit = session?.getItem(storageKey)
      return visit ? { key: visit, storage: 'session' } : null
    },
    save(key, storage) {
      const { session, device } = stores()
      const [keep, clear] = storage === 'device' ? [device, session] : [session, device]
      clear?.removeItem(storageKey)
      keep?.setItem(storageKey, key)
    },
    forget() {
      const { session, device } = stores()
      session?.removeItem(storageKey)
      device?.removeItem(storageKey)
    },
  }
}

/** The person's text with every occurrence of the exact key replaced. Applied before the text is
 *  shown, sent or recorded. An empty key removes nothing. */
export function redactKey(text: string, key: string): string {
  return key === '' ? text : text.split(key).join(KEY_REMOVED)
}

/** The rules a key's shape is checked against. The app names its own prefix and its own length range;
 *  the range is a plausible one that the vendor does not state as a rule. */
export interface KeyRules {
  readonly prefix: string
  readonly minLength: number
  readonly maxLength: number
}

/** The first shape rule a key breaks, in the order the rules are read, or null when it breaks none.
 *  `space` is a space or a line break; `character` is a character outside the printable ASCII range
 *  a key is made of; `prefix`, `short` and `long` are the rules above. The app words each one. */
export type KeyShapeRule = 'space' | 'character' | 'prefix' | 'short' | 'long'

/** Which shape rule `key` breaks, read in the browser so that no request is made for a text that
 *  cannot be a key. The key is taken as given: trim it before the call. */
export function keyShapeRule(key: string, rules: KeyRules): KeyShapeRule | null {
  if (/\s/.test(key)) return 'space'
  if (/[^\x21-\x7e]/.test(key)) return 'character'
  if (!key.startsWith(rules.prefix)) return 'prefix'
  if (key.length < rules.minLength) return 'short'
  if (key.length > rules.maxLength) return 'long'
  return null
}
