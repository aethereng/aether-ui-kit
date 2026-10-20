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

// The grammar lives in ./refs. These names are re-exported so a consumer imports the panel's
// reference rules from the module that also holds the message union.
export { findBareNumerals, referencesIn, splitReferences } from './refs'
export type { BareNumeralSpan, ChatSegment, ReferenceScopes } from './refs'

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
