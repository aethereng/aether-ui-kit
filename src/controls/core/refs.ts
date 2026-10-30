/* The reference grammar and the path resolver. Framework-free: no Vue, no DOM, no SDK, so an app's
 * gate, its tools and its tests run the rules the panel renders with.
 *
 * A reference is `{{scope:path}}`. An app mints one beside each value it hands out, whoever writes
 * the reply copies it, and the panel draws it as a chip. This file holds the rules those steps share: which
 * scopes a list admits, where a reference starts and ends, what a bare numeral is, the numeral gate
 * built from the two, and the path vocabulary (parse, format, resolve, the leaves of a document),
 * with the one option that changes how an id in brackets is read.
 *
 * What stays with the app: the values behind a path, the artefacts a scope names, the tuple table
 * for its results, and the decision that a numeral is a violation worth reporting. */

import { MAX_QUOTE_DEPTH, QUOTE_LINE, opensListItem } from './markup'

// ---- scopes ------------------------------------------------------------------------------------

/** The scopes a reference may name. An `indexed` scope is a letter and a positive number written
 *  without a leading zero (`m1`, `p2`); a `bare` scope is a letter alone (`c`, `s`). A reference
 *  names a scope in its list or it is plain text, and a digit in plain text is a bare numeral to the gate. */
export interface ReferenceScopes {
  readonly indexed: readonly string[]
  readonly bare: readonly string[]
}

/** The default scope list: runs, models and proposals by index, and capability and schema documents
 *  bare. */
export const DEFAULT_REFERENCE_SCOPES: ReferenceScopes = { indexed: ['m', 'p', 'r'], bare: ['c', 's'] }

const SCOPE_LETTER = /^[a-z]$/

/* One pattern per scope list, built on first use. A list that names no scope, a name that is not one
 * lower-case letter, or a letter named twice is refused: a pattern built from it would match a
 * reference no caller meant to admit. The check runs before the cache is read, and the cache key
 * encodes the two lists as JSON so that no two lists share a key. */
const patterns = new Map<string, RegExp>()

function referencePattern(scopes: ReferenceScopes): RegExp {
  const letters = [...scopes.indexed, ...scopes.bare]
  if (letters.length === 0) throw new RangeError('a reference scope list names at least one scope')
  for (const letter of letters) {
    if (!SCOPE_LETTER.test(letter)) throw new RangeError(`a reference scope must be one lower-case letter; got ${JSON.stringify(letter)}`)
  }
  if (new Set(letters).size !== letters.length) throw new RangeError('a reference scope is named twice')
  const key = JSON.stringify([scopes.indexed, scopes.bare])
  const known = patterns.get(key)
  if (known) return known
  const alternatives = [...scopes.indexed.map((s) => s + '[1-9][0-9]*'), ...scopes.bare]
  const pattern = new RegExp('\\{\\{(' + alternatives.join('|') + '):([^{}\\s]+)\\}\\}', 'g')
  patterns.set(key, pattern)
  return pattern
}

// ---- references in text ------------------------------------------------------------------------

/** A span of text, or one reference, in the order it appears. A reference segment keeps its braces
 *  in `text`; `ref` is `scope:path` without them. */
export type ChatSegment =
  | { kind: 'text'; text: string; start: number; end: number }
  | {
      kind: 'ref'
      /** The token as written, braces included. */
      text: string
      /** `scope:path`: what `resolveRef` is asked for and what `open-ref` carries. */
      ref: string
      scope: string
      path: string
      start: number
      end: number
    }

/** Split `text` into alternating text and reference segments, in order, with nothing lost: the
 *  segments' `text` concatenates back to the input, and `start`/`end` are UTF-16 offsets into it.
 *  No empty text segment is emitted, so the empty string yields no segments.
 *
 *  Malformed input is plain text, each case whole: an opening pair with no closing pair, a closing
 *  pair with no opening pair, `{{}}`, a scope outside `scopes`, whitespace inside the braces. A
 *  reference whose closing braces have not arrived is therefore plain text until they do, which is
 *  what a streaming message needs.
 *
 *  A NESTED opening pair makes the outer pair plain text; a valid reference inside it is still a
 *  reference. `{{r1:{{r2:x}}}}` is text `{{r1:`, the reference `r2:x`, text `}}`: the leftmost
 *  complete reference wins and the leftover braces are not consumed. */
export function splitReferences(text: string, scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES): ChatSegment[] {
  const out: ChatSegment[] = []
  let at = 0
  // matchAll walks a copy of the pattern, so the cached one never carries a lastIndex
  for (const m of text.matchAll(referencePattern(scopes))) {
    const start = m.index
    const end = start + m[0].length
    if (start > at) out.push({ kind: 'text', text: text.slice(at, start), start: at, end: start })
    const scope = m[1]!
    const path = m[2]!
    out.push({ kind: 'ref', text: m[0], ref: scope + ':' + path, scope, path, start, end })
    at = end
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at), start: at, end: text.length })
  return out
}

/** The references in a text, as written and in order. */
export function referencesIn(text: string, scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES): string[] {
  return splitReferences(text, scopes).flatMap((seg) => (seg.kind === 'ref' ? [seg.text] : []))
}

// ---- bare numerals -----------------------------------------------------------------------------

export interface BareNumeralSpan {
  start: number
  end: number
}

/* A Unicode decimal digit in any script (category Nd), plus the superscript and subscript digits,
 * which are category No and so are named by code point: 0xB9, 0xB2 to 0xB3, 0x2070, 0x2074 to
 * 0x2079, 0x2080 to 0x2089. A vulgar fraction, a Roman numeral and a circled digit are not digits
 * here. The extra ranges are listed by code point because NFKC maps each of these characters to a
 * plain digit. */
const DECIMAL = /\p{Nd}/u
const SCRIPT_DIGITS: readonly (readonly [number, number])[] = [
  [0xb9, 0xb9],
  [0xb2, 0xb3],
  [0x2070, 0x2070],
  [0x2074, 0x2079],
  [0x2080, 0x2089],
]

function hasDigit(s: string): boolean {
  if (DECIMAL.test(s)) return true
  for (const c of s) {
    const cp = c.codePointAt(0)!
    if (SCRIPT_DIGITS.some(([lo, hi]) => cp >= lo && cp <= hi)) return true
  }
  return false
}

const TOKEN = /\S+/gu
/* The ASCII apostrophe and the typographic single quotes U+2018 and U+2019, by code point. */
const APOSTROPHES = String.fromCharCode(0x27, 0x2018, 0x2019)
const STRIP = '.,;:!?()[]{}"' + APOSTROPHES + '`*_'

/* A `>` that opens the line's quote is the quote's marker, and the parser reads it so: `>J12` is a quote of
 * `J12`. Only the quote prefixes at the start of the line count, up to the depth the parser reads; a `>`
 * after other text, or past that depth, is text of the token. Returns how many leading `>` are markers. */
function quoteMarkers(text: string, at: number, raw: string): number {
  let ls = at
  while (ls > 0 && text.charCodeAt(ls - 1) !== 10) ls--
  let rest = text.slice(ls, at)
  let depth = 0
  for (let quote = QUOTE_LINE.exec(rest); quote !== null && depth < MAX_QUOTE_DEPTH; quote = QUOTE_LINE.exec(rest)) {
    rest = rest.slice(quote[0].length)
    depth++
  }
  if (!/^[ \t]{0,3}$/.test(rest)) return 0
  let n = 0
  while (n < raw.length && raw[n] === '>' && depth + n < MAX_QUOTE_DEPTH) n++
  return n
}

/* The characters a pattern must escape when a phrase is written into one. */
const PATTERN_SYNTAX = /[\\^$.*+?()[\]{}|]/g

/* The token before a phrase's first word holds only markup: the whitespace or the text start comes
 * before the phrase, and every character between them is a strip character. `_Table 3.1` and
 * `**Table 3.1` pass; `foo_Table 3.1` does not, because `foo` is part of the token. */
function leadsWithMarkup(text: string, at: number): boolean {
  let i = at
  while (i > 0 && !/\s/.test(text[i - 1]!)) i--
  return [...text.slice(i, at)].every((ch) => STRIP.includes(ch))
}

/* The token after a phrase's last word holds only markup, up to whitespace or the text end. A `'s`
 * after the phrase is the token rule's possessive, so `Table 3.1's` passes; `Table 3.1x` does not. */
function trailsWithMarkup(text: string, at: number): boolean {
  let i = at
  while (i < text.length && !/\s/.test(text[i]!)) {
    if (APOSTROPHES.includes(text[i]!) && text[i + 1] === 's') i += 2
    else if (STRIP.includes(text[i]!)) i++
    else return false
  }
  return true
}

/* Where each admitted phrase stands in `text`, in its offsets. A phrase's spaces match any run of
 * whitespace, a line break included. A phrase counts only where its token has no word beside it: the
 * markup on either side is the token's own, so one glued to a letter is not found. */
function phraseSpans(text: string, phrases: readonly string[]): BareNumeralSpan[] {
  const found: BareNumeralSpan[] = []
  for (const id of phrases) {
    const words = id.trim().split(/\s+/).map((w) => w.replace(PATTERN_SYNTAX, '\\$&'))
    const pattern = new RegExp(words.join('\\s+'), 'gu')
    for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
      const end = m.index + m[0].length
      if (leadsWithMarkup(text, m.index) && trailsWithMarkup(text, end)) found.push({ start: m.index, end })
      else pattern.lastIndex = m.index + 1
    }
  }
  return found
}

/** The spans of `text` holding a digit that is not an admitted identifier, in UTF-16 code units,
 *  ascending.
 *
 *  A TOKEN is a maximal run of non-whitespace characters in the text between references (a
 *  reference is a token boundary, and is never read). Leading and trailing punctuation is stripped
 *  before comparing, namely `. , ; : ! ? ( ) [ ] { } "`, the apostrophe `'` and the typographic
 *  single quotes U+2018 and U+2019, and a trailing apostrophe-s (`'s`, in any of the three). The
 *  trailing strip repeats until nothing more comes off, so `J12.`, `(J12)`, `J12's`, `(J12's).`
 *  and `J12's's` all compare as `J12`. The comparison is exact and case-sensitive. A backtick, an
 *  asterisk and an underscore strip like the rest, so `` `J12` ``, `**J12**`, `_J12_` and `(`J12`)` all
 *  compare as `J12`: the markup stays in the text, and a violation's span covers the stripped core, so
 *  `J13` in backticks spans `J13`, not the backticks around it.
 *  An admitted identifier wrapped in that markup or punctuation passes by design, because the comparison
 *  is made on the stripped core.
 *
 *  A token is a VIOLATION when, stripped, it holds a digit and does not equal an admitted
 *  identifier, unless it opens a list item the parser reads (`opensListItem`: an ordered marker after
 *  optional indentation and any quote prefixes). A token is the whole run, so `J12,J13` is one token and a
 *  violation. The span covers the stripped token, without the punctuation around it.
 *
 *  UNRESOLVED REFERENCES ARE LEFT TO THE CALLER. A reference is skipped whatever its scope id,
 *  because this function is handed the admitted identifiers and has no view of the app's index of
 *  minted references; it cannot know that `{{r999:x}}` points at nothing. The caller asks its
 *  own index and reports an unresolved reference itself. A reference still being typed is not yet a
 *  reference, so it is plain text here and its digit is a violation.
 *
 *  AN IDENTIFIER OF SEVERAL WORDS is read as one phrase. `Table 3.1`, `EN 1993-1-1` and `A572 Gr 50` are
 *  admitted as written; the digits of an admitted phrase are not violations where the whole phrase
 *  stands between token edges, a line break between its words included. A digit outside any such phrase
 *  is still a violation: `3.1` alone is flagged while `Table 3.1` stands. A phrase is not read across a
 *  reference. A phrase with a word glued to its markup (`foo_Table 3.1`) does not stand, so its digits are
 *  read as before; markup that is the token's own (`**Table 3.1**`, `Table 3.1's`) stands.
 *
 *  Not a markdown parser: it does not know a fenced block from a sentence. */
export function findBareNumerals(
  text: string,
  admittedIds: Iterable<string>,
  scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES,
): BareNumeralSpan[] {
  const admitted = new Set(admittedIds)
  const phrases = [...admitted].filter((id) => /\s/.test(id.trim()))
  const spans: BareNumeralSpan[] = []
  for (const seg of splitReferences(text, scopes)) {
    if (seg.kind !== 'text') continue
    const whole = phraseSpans(seg.text, phrases)
    for (const m of seg.text.matchAll(TOKEN)) {
      const q = m[0][0] === '>' ? quoteMarkers(text, seg.start + m.index, m[0]) : 0
      const idx = m.index + q
      const raw = m[0].slice(q)
      const at = seg.start + idx
      if (opensListItem(text, at, raw)) continue
      let lo = 0
      let hi = raw.length
      while (lo < hi && STRIP.includes(raw[lo]!)) lo++
      for (;;) {
        if (hi > lo && STRIP.includes(raw[hi - 1]!)) hi--
        else if (hi - lo >= 2 && APOSTROPHES.includes(raw[hi - 2]!) && raw[hi - 1] === 's') hi -= 2
        else break
      }
      const core = raw.slice(lo, hi)
      // An identifier admitted as written passes too, even where its own edge is a strip character.
      if (!hasDigit(core) || admitted.has(core) || admitted.has(raw) || admitted.has(m[0])) continue
      const coreStart = idx + lo
      const coreEnd = idx + hi
      if (whole.some((w) => coreStart >= w.start && coreEnd <= w.end)) continue
      spans.push({ start: at + lo, end: at + hi })
    }
  }
  return spans
}

// ---- the numeral gate --------------------------------------------------------------------------

/** `bare_numeral`: a token holding a digit that is no admitted identifier. `unresolved_reference`:
 *  a reference the app's index does not hold. */
export type ViolationKind = 'bare_numeral' | 'unresolved_reference'

/** One finding, with its offsets in UTF-16 code units into the text it was found in. */
export interface Violation {
  token: string
  start: number
  end: number
  kind: ViolationKind
}

/** The gate over one finished text. A digit outside a reference is a violation unless its token
 *  equals an identifier in `admitted` or is an ordered-list marker opening a line (the rule of
 *  `findBareNumerals`). A reference is read only to ask `holds` whether the app minted it: one it
 *  did not is a violation of its own kind. The reference is passed as written, braces included,
 *  which is how an index keys its references. */
export function numeralGate(
  text: string,
  admitted: Iterable<string>,
  holds: (ref: string) => boolean,
  scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES,
): Violation[] {
  const found: Violation[] = findBareNumerals(text, admitted, scopes).map(({ start, end }) => ({
    token: text.slice(start, end),
    start,
    end,
    kind: 'bare_numeral',
  }))
  for (const seg of splitReferences(text, scopes)) {
    if (seg.kind === 'ref' && !holds(seg.text)) found.push({ token: seg.text, start: seg.start, end: seg.end, kind: 'unresolved_reference' })
  }
  return found.sort((a, b) => a.start - b.start)
}

// ---- identifiers -------------------------------------------------------------------------------

/** How a path reads an id that is written in brackets.
 *
 *  Off (the default): an id holding `.`, `[`, `]`, `{`, `}`, `~` or whitespace, or beginning `#`, is
 *  not reached by its id. An id written in brackets that holds a `.` is refused.
 *
 *  On: an id in brackets is read verbatim up to the first `]`, so an id holding `.` is reached by
 *  its id. Only an id holding `]`, `{`, `}`, `~`, whitespace or a leading `#` is reached by its
 *  position; `modelLeaves` lists such an id in `skipped`. */
export interface PathRules {
  readonly verbatimBracketIds: boolean
}

export const DEFAULT_PATH_RULES: PathRules = { verbatimBracketIds: false }

const RESERVED_OFF = /[.[\]{}~\s]|^#/u
const RESERVED_ON = /[\]{}~\s]|^#/u
const NAMED_OFF = /[.[\]{}~]/u
const NAMED_ON = /[\]{}~]/u

/** Whether an id is reached only by its position under `rules`. */
export function hasReservedCharacter(id: string, rules: PathRules = DEFAULT_PATH_RULES): boolean {
  return (rules.verbatimBracketIds ? RESERVED_ON : RESERVED_OFF).test(id)
}

/** The reserved characters an id holds, each named once in the order they first appear; a leading
 *  `#` is named as such and whitespace as `whitespace`. */
export function reservedCharactersOf(id: string, rules: PathRules = DEFAULT_PATH_RULES): string[] {
  const named = rules.verbatimBracketIds ? NAMED_ON : NAMED_OFF
  const found: string[] = id.startsWith('#') ? ['a leading #'] : []
  for (const ch of id) {
    const name = /\s/u.test(ch) ? 'whitespace' : named.test(ch) ? ch : null
    if (name !== null && !found.includes(name)) found.push(name)
  }
  return found
}

/** Every string value of an `id` field anywhere in a document's JSON: the identifiers a caller may
 *  write bare. */
export function idsIn(json: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(json)) for (const v of json) idsIn(v, into)
  else if (json !== null && typeof json === 'object') {
    for (const [k, v] of Object.entries(json)) {
      if (k === 'id' && typeof v === 'string') into.add(v)
      else idsIn(v, into)
    }
  }
  return into
}

// ---- the slug rule -----------------------------------------------------------------------------

/** Lower case; letters and digits kept; every other run of characters one hyphen; no hyphen at
 *  either end. A path built from a heading uses it. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{Nd}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

// ---- paths -------------------------------------------------------------------------------------

/** One step of a dotted path: a key, an array element by its `id`, or an element by position. */
export type PathStep = { key: string } | { id: string } | { index: number }

/** A value the app computes over a run: an extreme over a member's samples, the sample position it
 *  sits at, or the parameter there. Written after a `~`. The app computes it; this file only reads
 *  the name. */
export interface Reduction {
  extreme: 'max' | 'min'
  part: 'value' | 'at' | 'xi'
}

export interface ParsedPath {
  steps: PathStep[]
  reduction: Reduction | null
}

const NAME = /^[^.[\]{}~\s#]+/u
const BRACKET_OFF = /^\[([^[\]{}~\s.]+)\]/u
const BRACKET_ON = /^\[([^\]{}~\s]+)\]/u
const REDUCTION = /^~(max|min)(?:\.(at|xi))?$/u

/** Parse a path; null when it is not one. `members[beam].forces.M3~max` is the key `members`, the
 *  element `beam`, the keys `forces` and `M3`, and the reduction `max`. A `[#i]` is a position
 *  under either rule; a bracket that holds `#` but no zero-based index is refused. */
export function parsePath(path: string, rules: PathRules = DEFAULT_PATH_RULES): ParsedPath | null {
  const bracket = rules.verbatimBracketIds ? BRACKET_ON : BRACKET_OFF
  const steps: PathStep[] = []
  let rest = path
  for (;;) {
    const name = NAME.exec(rest)
    if (!name) return null
    steps.push({ key: name[0] })
    rest = rest.slice(name[0].length)
    for (let b = bracket.exec(rest); b; b = bracket.exec(rest)) {
      const inner = b[1]!
      if (inner.startsWith('#')) {
        if (!/^#(0|[1-9][0-9]*)$/.test(inner)) return null
        steps.push({ index: Number(inner.slice(1)) })
      } else steps.push({ id: inner })
      rest = rest.slice(b[0].length)
    }
    if (rest === '') return { steps, reduction: null }
    if (rest.startsWith('~')) {
      const r = REDUCTION.exec(rest)
      return r ? { steps, reduction: { extreme: r[1] as Reduction['extreme'], part: (r[2] as Reduction['part'] | undefined) ?? 'value' } } : null
    }
    if (!rest.startsWith('.')) return null
    rest = rest.slice(1)
  }
}

/** The text of a path, the inverse of `parsePath`. */
export function formatPath(steps: readonly PathStep[], reduction: Reduction | null = null): string {
  let out = ''
  for (const s of steps) {
    if ('key' in s) out += (out === '' ? '' : '.') + s.key
    else if ('id' in s) out += `[${s.id}]`
    else out += `[#${s.index}]`
  }
  if (reduction) out += `~${reduction.extreme}${reduction.part === 'value' ? '' : '.' + reduction.part}`
  return out
}

/** The component names of the fixed-length tuples a document holds, by the field that holds each,
 *  and the fields whose tuple is held once per element of an array. A tuple whose field names no
 *  components is reached by position and is not in the table. The app supplies it from the comments
 *  beside its own fields. */
export interface TupleTable {
  readonly components: Readonly<Record<string, readonly string[]>>
  readonly perElement: readonly string[]
}

function elementOf(arr: unknown[], step: PathStep): unknown {
  if ('index' in step) return arr[step.index]
  if ('id' in step) return arr.find((e) => e !== null && typeof e === 'object' && (e as { id?: unknown }).id === step.id)
  return undefined
}

/**
 * The value a parsed path reaches in a document's JSON, or undefined. `count` on an array is its
 * length. A key naming a tuple component (`translation.u_x`, `forces[#12].M3`) reaches that
 * component when `tuples` names it. A reduction is not resolved here: the app computes it.
 */
export function resolvePath(json: unknown, steps: readonly PathStep[], tuples: TupleTable | null = null): unknown {
  const perElementFields = new Set(tuples?.perElement ?? [])
  let at: unknown = json
  let names: readonly string[] | null = null // the component names of `at`, when it is a tuple
  let perElement: readonly string[] | null = null // the names of each element's tuple
  for (const step of steps) {
    if (Array.isArray(at)) {
      if ('key' in step) {
        const i = step.key === 'count' ? -1 : (names?.indexOf(step.key) ?? -1)
        if (step.key === 'count') at = at.length
        else if (i >= 0) at = at[i]
        else return undefined
        names = perElement = null
        continue
      }
      at = elementOf(at, step)
      names = perElement
      perElement = null
      continue
    }
    if (at === null || typeof at !== 'object' || !('key' in step)) return undefined
    if (!Object.prototype.hasOwnProperty.call(at, step.key)) return undefined
    at = (at as Record<string, unknown>)[step.key]
    const known = tuples && Object.prototype.hasOwnProperty.call(tuples.components, step.key) ? tuples.components[step.key]! : null
    names = known && !perElementFields.has(step.key) ? known : null
    perElement = known && perElementFields.has(step.key) ? known : null
  }
  return at
}

/** One numeric leaf under a subtree, with the path that reaches it. */
export interface Leaf {
  path: string
  value: number
}

export interface LeafOptions {
  /** Stops the walk once it has found more leaves than this; the caller reads that as too many. */
  limit?: number
  rules?: PathRules
  tuples?: TupleTable | null
}

/**
 * Every numeric leaf of a document's JSON under `steps`, with its path: an element with an `id` is
 * addressed by it, any other by position. An element whose id is reached only by position under
 * `rules` gets no path into it; its id is listed in `skipped` instead.
 */
export function modelLeaves(
  json: unknown,
  steps: readonly PathStep[],
  options: LeafOptions = {},
): { leaves: Leaf[]; skipped: string[]; over: boolean } {
  const limit = options.limit ?? Infinity
  const rules = options.rules ?? DEFAULT_PATH_RULES
  const leaves: Leaf[] = []
  const skipped: string[] = []
  let over = false
  const walk = (v: unknown, at: PathStep[]): void => {
    if (over) return
    if (typeof v === 'number') {
      if (leaves.length >= limit) over = true
      else leaves.push({ path: formatPath(at), value: v })
      return
    }
    if (Array.isArray(v)) {
      v.forEach((e, i) => {
        const id = e !== null && typeof e === 'object' ? (e as { id?: unknown }).id : undefined
        if (typeof id === 'string') {
          if (hasReservedCharacter(id, rules)) skipped.push(id)
          else walk(e, [...at, { id }])
        } else walk(e, [...at, { index: i }])
      })
      return
    }
    if (v !== null && typeof v === 'object') for (const [k, c] of Object.entries(v)) walk(c, [...at, { key: k }])
  }
  walk(resolvePath(json, steps, options.tuples ?? null), [...steps])
  return { leaves, skipped, over }
}
