/* Framework-free core for ChatPanel: the message union, the reference grammar and the
 * bare-numeral rule. No Vue import, so a wrapper for another framework, or an app's own gate
 * running outside any component, calls the same functions the panel does.
 *
 * WHAT IS HERE AND WHAT IS NOT. The kit renders and emits; it never resolves a reference, judges
 * a numeral or accepts a proposal. This file holds the two rules the render depends on (where a
 * reference starts and ends, and what a bare numeral is) and the types the app fills in. The
 * values behind a reference, and the decision that a numeral is a violation worth marking, stay
 * with the caller. `findBareNumerals` is offered for an app that wants the same rule the panel's
 * author used; the panel itself never calls it. */

// ---- the message union -------------------------------------------------------------------

/* A span of a text message's `text` the app wants highlighted, in UTF-16 code units (the unit
 * `String.prototype.slice` counts in). `kind` is the app's own label for why; it is rendered as
 * text for assistive technology and never interpreted. */
export interface ChatMark {
  start: number
  end: number
  kind: string
}

// A message in a ChatPanel log. `role` picks the bubble style and the printed label
// ('you' / 'agent' / 'note' for sys); `queued` marks a request not yet sent, which both
// real consumers style as dashed + dimmed. `refs` is always an array: a caller with a
// single reference passes a one-element array rather than the panel juggling two shapes.
//
// This is the `text` kind of the union below, and `kind` may be left out. `streaming` and `marks`
// are read only under `actions="assistant"`.
export interface ChatMessage {
  kind?: 'text'
  role: 'you' | 'agent' | 'sys'
  text: string
  queued?: boolean
  refs?: string[]
  /** The text is still arriving. The message is marked busy and ends in a caret. */
  streaming?: boolean
  /** Spans to highlight; offsets index into `text`. A mark that is out of range, empty, inverted or
   *  overlapping an earlier one is dropped, and of two overlapping marks the first wins. */
  marks?: ChatMark[]
}

export type ChatToolStatus = 'running' | 'done' | 'refused' | 'failed'

export interface ChatToolMessage {
  kind: 'tool'
  callId: string
  name: string
  status: ChatToolStatus
  /** One line. */
  summary: string
  /** Shown behind a Disclosure when present. */
  detail?: string
  /** Whether the detail is revealed. The app owns it and flips it on `toggle-tool`. */
  open?: boolean
}

export interface ChatRefusalMessage {
  kind: 'refusal'
  /** Rendered verbatim, whitespace preserved. */
  text: string
  source: 'engine' | 'api'
}

export interface ChatProposalRow {
  path: string
  before: string
  after: string
}

export interface ChatProposalFlag {
  text: string
  /** A reference string, `scope:path`, rendered as a chip. */
  reference: string
}

export type ChatProposalStatus = 'pending' | 'accepted' | 'discarded' | 'superseded' | 'refused'

export interface ChatProposalMessage {
  kind: 'proposal'
  id: string
  title: string
  rows: ChatProposalRow[]
  flags: ChatProposalFlag[]
  /** Accept and Discard show only while `pending`; the app moves it on. */
  status: ChatProposalStatus
}

export interface ChatCardMessage {
  kind: 'card'
  title: string
  body: string
  source: string
}

// Everything a ChatPanel log can hold. The first member is the text message the relay hosts build.
export type ChatEntry =
  | ChatMessage
  | ChatToolMessage
  | ChatRefusalMessage
  | ChatProposalMessage
  | ChatCardMessage

export function isTextMessage(m: ChatEntry): m is ChatMessage {
  return m.kind === undefined || m.kind === 'text'
}

// ---- references --------------------------------------------------------------------------

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

/* `{{scope:path}}`. The scope is m<k>, p<k> or r<k> with k a positive integer written without a
 * leading zero, or c, or s. The path is a non-empty run holding no brace and no whitespace
 * (`\s`, so a no-break space counts), and may hold a colon. Anything else between double braces
 * does not match, which leaves it as plain text. */
const REFERENCE = /\{\{(m[1-9][0-9]*|p[1-9][0-9]*|r[1-9][0-9]*|c|s):([^{}\s]+)\}\}/g

/** Split `text` into alternating text and reference segments, in order, with nothing lost: the
 *  segments' `text` concatenates back to the input, and `start`/`end` are UTF-16 offsets into it.
 *  No empty text segment is emitted, so the empty string yields no segments.
 *
 *  Malformed input is plain text, each case whole: an opening pair with no closing pair, a closing
 *  pair with no opening pair, `{{}}`, a scope outside the grammar, whitespace inside the braces.
 *  A reference whose closing braces have not arrived is therefore plain text until they do, which is
 *  what a streaming message needs.
 *
 *  A NESTED opening pair makes the outer pair plain text; a valid reference inside it is still a
 *  reference. `{{r1:{{r2:x}}}}` is text `{{r1:`, the reference `r2:x`, text `}}`: the leftmost
 *  complete reference wins and the leftover braces are not consumed. */
export function splitReferences(text: string): ChatSegment[] {
  const out: ChatSegment[] = []
  let at = 0
  // matchAll walks a copy of the pattern, so the module-level one never carries a lastIndex
  for (const m of text.matchAll(REFERENCE)) {
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

// ---- bare numerals -----------------------------------------------------------------------

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
const STRIP = '.,;:!?()[]{}"' + APOSTROPHES
const LIST_MARKER = /^[0-9]+[.)]$/

const isLineBreak = (code: number) => code === 10 || code === 13

// True when only whitespace sits between `at` and the start of its line.
function startsLine(text: string, at: number): boolean {
  for (let k = at - 1; k >= 0; k--) {
    if (isLineBreak(text.charCodeAt(k))) return true
    if (!/\s/.test(text[k]!)) return false
  }
  return true
}

/** The spans of `text` holding a digit that is not an admitted identifier, in UTF-16 code units,
 *  ascending.
 *
 *  A TOKEN is a maximal run of non-whitespace characters in the text between references (a
 *  reference is a token boundary, and is never read). Leading and trailing punctuation is stripped
 *  before comparing, namely `. , ; : ! ? ( ) [ ] { } "`, the apostrophe `'` and the typographic
 *  single quotes U+2018 and U+2019, and a trailing apostrophe-s (`'s`, in any of the three). The
 *  trailing strip repeats until nothing more comes off, so `J12.`, `(J12)`, `J12's`, `(J12's).`
 *  and `J12's's` all compare as `J12`. The comparison is exact and case-sensitive. A backtick and
 *  an asterisk are not in the strip set, so a code span or bold text around an identifier makes it
 *  a violation, and a code span is read like any other text.
 *
 *  A token is a VIOLATION when, stripped, it holds a digit and does not equal an admitted
 *  identifier, unless it is an ordered-list marker (ASCII digits then `.` or `)`) that starts its
 *  line after optional indentation. A token is the whole run, so `J12,J13` is one token and a
 *  violation. The span covers the stripped token, without the punctuation around it.
 *
 *  UNRESOLVED REFERENCES ARE LEFT TO THE CALLER. A reference is skipped whatever its scope id,
 *  because this function is handed the identifiers admitted in text and not the app's index of run,
 *  model and proposal ids; it cannot know that `{{r999:x}}` points at nothing. The caller asks its
 *  own index and reports an unresolved reference itself. A reference still being typed is not yet a
 *  reference, so it is plain text here and its digit is a violation.
 *
 *  Not a markdown parser: it does not know a fenced block from a sentence. */
export function findBareNumerals(text: string, admittedIds: Iterable<string>): BareNumeralSpan[] {
  const admitted = new Set(admittedIds)
  const spans: BareNumeralSpan[] = []
  for (const seg of splitReferences(text)) {
    if (seg.kind !== 'text') continue
    for (const m of seg.text.matchAll(TOKEN)) {
      const raw = m[0]
      const at = seg.start + m.index
      if (LIST_MARKER.test(raw) && startsLine(text, at)) continue
      let lo = 0
      let hi = raw.length
      while (lo < hi && STRIP.includes(raw[lo]!)) lo++
      for (;;) {
        if (hi > lo && STRIP.includes(raw[hi - 1]!)) hi--
        else if (hi - lo >= 2 && APOSTROPHES.includes(raw[hi - 2]!) && raw[hi - 1] === 's') hi -= 2
        else break
      }
      const core = raw.slice(lo, hi)
      if (!hasDigit(core) || admitted.has(core)) continue
      spans.push({ start: at + lo, end: at + hi })
    }
  }
  return spans
}

// ---- reference chips ---------------------------------------------------------------------

export type RefSourceKind = 'run' | 'model' | 'proposal' | 'capabilities' | 'schema'

/** What the app's `resolveRef` returns for a reference it can answer. The kit shows these fields
 *  and decides nothing about them. */
export interface RefChipData {
  /** The value as text. */
  value: string
  unit: string | null
  source: {
    kind: RefSourceKind
    /** `r1`, `m1`, `p2`; null for capabilities and schema. */
    id: string | null
    /** The engine build for a run, the input or proposal hash for a model or proposal, the
     *  viewer build for capabilities and schema. Shown shortened; full on hover. */
    hash: string
  }
  path: string
  /** The provenance line as text. */
  provenance: string | null
  /** True when the viewer reduced the value. */
  reduced?: boolean
}

/** Characters of a hash shown in the chip's tag. */
export const REF_HASH_LENGTH = 7
/** The word on a chip whose reference the app could not resolve. */
export const UNRESOLVED_TEXT = 'unresolved'
export const REDUCED_TEXT = 'reduced by the viewer'

/** How far from the bottom, in px, a log still counts as AT the bottom for the rule that follows a
 *  stream. The rule has two triggers, the stream's growth and an entry appended during it, and
 *  both use this distance: a reader within it keeps following, a reader beyond it is left where
 *  they are. About one line of the log's message text, rounded up; the scroll test pins both sides
 *  of it. */
export const STREAM_FOLLOW_THRESHOLD = 20

const HASH_LABEL: Record<RefSourceKind, string> = {
  run: 'engine build',
  model: 'input hash',
  proposal: 'proposal hash',
  capabilities: 'viewer build',
  schema: 'viewer build',
}

export type RefChipText =
  | {
      resolved: true
      /** Value and unit as shown: `0.0123 m`. */
      quantity: string
      /** The source tag as shown: `r1 · 3b1f2c9`, or `build 9c04e2d` for a viewer build. */
      tag: string
      /** The chip's accessible name: path, value, unit and tag. */
      name: string
      /** The hover text: path, provenance, the full hash. */
      hover: string
    }
  | {
      resolved: false
      /** The chip's accessible name: the word and the reference. */
      name: string
    }

const NL = String.fromCharCode(10)

/** The words a chip shows, names and hovers over, for a reference and the data the app returned
 *  for it (`null` when it could not). One place builds them, so what the chip draws and what the
 *  panel announces when a reply settles cannot drift apart. */
export function describeRef(ref: string, data: RefChipData | null): RefChipText {
  if (!data) return { resolved: false, name: UNRESOLVED_TEXT + ': ' + ref }
  const { source } = data
  const hash = source.hash.slice(0, REF_HASH_LENGTH)
  const build = source.kind === 'capabilities' || source.kind === 'schema'
  const parts = [source.id ?? '', hash ? (build ? 'build ' + hash : hash) : ''].filter(Boolean)
  const reduced = data.reduced ? [REDUCED_TEXT] : []
  const quantity = data.unit ? data.value + ' ' + data.unit : data.value
  const tags = [...parts, ...reduced]
  return {
    resolved: true,
    quantity,
    tag: tags.join(' · '),
    name: [[data.path, quantity].filter(Boolean).join(': '), ...tags].filter(Boolean).join(', '),
    hover: [
      data.path,
      data.provenance ?? '',
      source.hash ? HASH_LABEL[source.kind] + ' ' + source.hash : '',
      ...reduced,
    ]
      .filter(Boolean)
      .join(NL),
  }
}
