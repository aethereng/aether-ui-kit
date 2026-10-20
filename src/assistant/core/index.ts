/* The references one conversation has minted, and the identifiers its numeral gate admits.
 * Framework-free: an app's tools mint into it, its gate reads it, and its tests run it without a
 * component.
 *
 * A reference the index mints must read back through the grammar it was minted for. Minting
 * refuses a scope the list does not hold, and a path the grammar would not read as one reference
 * (a path holding a brace or whitespace). The check runs here, at the point of minting, so a
 * reference the panel cannot draw never reaches a transcript. */
import { DEFAULT_REFERENCE_SCOPES, splitReferences, type ReferenceScopes } from '../../controls/core/refs'
import type { RefChipData } from '../../controls/core/chat'

/** One minted reference, keyed in the index by the reference as written, braces included. */
export interface RefEntry {
  ref: string
  scope: string
  path: string
  value: unknown
  unit: string | null
  source: RefChipData['source']
  provenance: string | null
  mintedBy: string
  reduced: boolean
}

export class ReferenceIndex {
  readonly index = new Map<string, RefEntry>()
  readonly admitted = new Set<string>()

  constructor(readonly scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES) {}

  /** Mint `{{scope:path}}` for a value and return it as written. Minting the same reference again
   *  replaces its entry; an artefact of a conversation does not change, so the value is the same. */
  mint(
    scope: string,
    path: string,
    value: unknown,
    unit: string | null,
    source: RefChipData['source'],
    mintedBy: string,
    provenance: string | null = null,
    reduced = false,
  ): string {
    const ref = '{{' + scope + ':' + path + '}}'
    const read = splitReferences(ref, this.scopes)
    if (read.length !== 1 || read[0]!.kind !== 'ref' || read[0]!.text !== ref) {
      throw new RangeError(`the reference ${ref} does not read back as one reference under this scope list`)
    }
    this.index.set(ref, { ref, scope, path, value, unit, source, provenance, mintedBy, reduced })
    return ref
  }

  /** Whether the conversation minted `ref`, braces included. */
  holds(ref: string): boolean {
    return this.index.has(ref)
  }

  /** Admit identifiers the numeral gate may read bare. An identifier of several words (`Table 3.1`) is
   *  kept as one phrase, with its whitespace collapsed to single spaces; the gate matches a line break
   *  between its words as well. An empty identifier is not admitted. */
  admit(ids: Iterable<string>): void {
    for (const id of ids) {
      const phrase = id.trim().replace(/\s+/g, ' ')
      if (phrase !== '') this.admitted.add(phrase)
    }
  }

  clear(): void {
    this.index.clear()
    this.admitted.clear()
  }
}
