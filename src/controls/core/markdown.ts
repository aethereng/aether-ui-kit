/* Markdown for an agent reply, framework-free: the blocks and inline spans the panel draws, with
 * the reference chips and the marks kept where they stand.
 *
 * WHAT IT READS. Paragraphs (the text between blank lines), line breaks inside a paragraph, bullet
 * and numbered lists, bold (`**` or `__`), emphasis (`*` or `_`), inline code, and links. A link
 * renders as its label. Its target is dropped, so no reply can become a live link. Headings, block
 * quotes and fenced code are not read, and their markers stay in the text as written.
 *
 * WHAT IT NEVER DOES. It produces text, and the panel draws text by interpolation. No reply reaches
 * the page as markup: a `<` in a reply stays a `<`.
 *
 * OFFSETS. The numeral gate's marks and the references are offsets into the raw text, and this
 * module keeps them so. A mark is drawn over the characters it covers. The markers that formatting
 * hides are not drawn, so a mark over `*3.1*` highlights `3.1`. A reference is atomic: markers
 * inside its path are part of the path, and it is never split and never marked.
 *
 * @internal: read by ChatPanel alone, so it is not a subpath of the exports map. */
import type { ChatMark } from './chat'
import { DEFAULT_REFERENCE_SCOPES, splitReferences, type ReferenceScopes } from './refs'

/** One inline piece. A text piece carries the kind of the mark that covers it, or null. A reference
 *  carries `scope:path`, without its braces, for the panel to resolve. */
export type MdInline =
  | { kind: 'text'; text: string; mark: string | null }
  | { kind: 'ref'; ref: string }
  | { kind: 'br' }
  | { kind: 'strong' | 'em' | 'code'; children: MdInline[] }

/** One block. A list's `start` is the number its first item carries. A bullet list starts at 1 and
 *  the panel ignores its start. */
export type MdBlock =
  | { kind: 'p'; children: MdInline[] }
  | { kind: 'list'; ordered: boolean; start: number; items: MdInline[][] }

interface Ctx {
  readonly text: string
  readonly marks: readonly ChatMark[]
  /** Each reference, keyed by the offset it starts at. */
  readonly refs: ReadonlyMap<number, { ref: string; end: number }>
}

interface Span {
  start: number
  end: number
}

const BLANK = /^[ \t]*$/
/* A list marker, then the spaces after it. Group 1 is the number of an ordered item. */
const LIST_LINE = /^[ \t]{0,3}(?:[-*+]|([0-9]{1,9})[.)])(?:[ \t]+|$)/

/** Lines of `text`, each as the span it occupies with its line break and any carriage return cut. */
function linesOf(text: string): Span[] {
  const lines: Span[] = []
  let start = 0
  for (;;) {
    const nl = text.indexOf('\n', start)
    const stop = nl < 0 ? text.length : nl
    const end = stop > start && text.charCodeAt(stop - 1) === 13 ? stop - 1 : stop
    lines.push({ start, end })
    if (nl < 0) return lines
    start = nl + 1
  }
}

/** The marks that can be drawn: whole spans of `text`, in order, none overlapping. The app's gate
 *  decides what to mark. A malformed span is dropped here rather than thrown, so one bad offset
 *  cannot blank a reply. Of two overlapping spans the first wins. */
export function usableMarks(text: string, marks: readonly ChatMark[] = []): ChatMark[] {
  const sorted = marks
    .filter((k) => Number.isInteger(k.start) && Number.isInteger(k.end) && k.start >= 0 && k.start < k.end && k.end <= text.length)
    .sort((a, b) => a.start - b.start)
  const out: ChatMark[] = []
  let edge = 0
  for (const k of sorted) {
    if (k.start < edge) continue
    out.push(k)
    edge = k.end
  }
  return out
}

/** The blocks of a reply's text. `marks` are the gate's spans, offsets into `text`; a malformed mark is
 *  dropped by `usableMarks`. */
export function markdownBlocks(
  text: string,
  marks: readonly ChatMark[] = [],
  scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES,
): MdBlock[] {
  const refs = new Map<number, { ref: string; end: number }>()
  for (const seg of splitReferences(text, scopes)) {
    if (seg.kind === 'ref') refs.set(seg.start, { ref: seg.ref, end: seg.end })
  }
  const ctx: Ctx = { text, marks: usableMarks(text, marks), refs }
  const blocks: MdBlock[] = []
  let para: Span | null = null
  let list: { ordered: boolean; start: number; items: MdInline[][] } | null = null
  for (const line of linesOf(text)) {
    const raw = text.slice(line.start, line.end)
    const item = LIST_LINE.exec(raw)
    if (item === null && !BLANK.test(raw)) {
      // A text line continues the paragraph, and ends a list it follows.
      if (list) {
        blocks.push({ kind: 'list', ...list })
        list = null
      }
      para = para ? { start: para.start, end: line.end } : line
      continue
    }
    if (para) {
      blocks.push({ kind: 'p', children: inlineRange(ctx, para.start, para.end, false) })
      para = null
    }
    if (item === null) {
      if (list) {
        blocks.push({ kind: 'list', ...list })
        list = null
      }
      continue
    }
    const ordered = item[1] !== undefined
    if (list && list.ordered !== ordered) {
      blocks.push({ kind: 'list', ...list })
      list = null
    }
    if (!list) list = { ordered, start: ordered ? Number(item[1]) : 1, items: [] }
    list.items.push(inlineRange(ctx, line.start + item[0].length, line.end, false))
  }
  if (para) blocks.push({ kind: 'p', children: inlineRange(ctx, para.start, para.end, false) })
  if (list) blocks.push({ kind: 'list', ...list })
  return blocks
}

/* ---- inline ---- */

/** The inline pieces of `text` between `from` and `to`. In `literal` mode (a code span's content)
 *  only references and line breaks are read; every other character is text. */
function inlineRange(ctx: Ctx, from: number, to: number, literal: boolean): MdInline[] {
  const { text } = ctx
  const out: MdInline[] = []
  let plain = from
  let i = from
  // Pending plain text ends at `upTo`; nothing is emitted for an empty stretch.
  const flush = (upTo: number) => {
    if (upTo > plain) out.push(...textNodes(ctx, plain, upTo))
    plain = upTo
  }
  while (i < to) {
    const ref = ctx.refs.get(i)
    if (ref) {
      flush(i)
      out.push({ kind: 'ref', ref: ref.ref })
      i = ref.end
      plain = i
      continue
    }
    const c = text[i]
    if (c === '\n') {
      flush(i)
      out.push({ kind: 'br' })
      i++
      plain = i
      continue
    }
    if (c === '\r') {
      flush(i)
      i++
      plain = i
      continue
    }
    if (!literal && c === '`') {
      const n = runLength(text, i, to, '`')
      const close = codeClose(ctx, i + n, to, n)
      if (close >= 0) {
        flush(i)
        out.push({ kind: 'code', children: inlineRange(ctx, i + n, close, true) })
        i = close + n
        plain = i
      } else i += n
      continue
    }
    if (!literal && (c === '*' || c === '_')) {
      const n = runLength(text, i, to, c)
      const close = n <= 3 && canOpen(ctx, i, to, n, c) ? emphasisClose(ctx, i + n, to, n, c) : -1
      if (close >= 0) {
        flush(i)
        const inner = inlineRange(ctx, i + n, close, false)
        if (n === 1) out.push({ kind: 'em', children: inner })
        else if (n === 2) out.push({ kind: 'strong', children: inner })
        else out.push({ kind: 'strong', children: [{ kind: 'em', children: inner }] })
        i = close + n
        plain = i
      } else i += n
      continue
    }
    if (!literal && c === '[') {
      const link = linkAt(ctx, i, to)
      if (link) {
        flush(i)
        out.push(...inlineRange(ctx, i + 1, link.labelEnd, false))
        i = link.end
        plain = i
        continue
      }
    }
    i++
  }
  flush(to)
  return out
}

/** The length of the run of `c` that starts at `from`, not reading past `to`. */
function runLength(text: string, from: number, to: number, c: string): number {
  let k = from
  while (k < to && text[k] === c) k++
  return k - from
}

function isSpace(ch: string): boolean {
  return ch === '' || /\s/.test(ch)
}

function isWordChar(ch: string): boolean {
  return ch !== '' && /[\p{L}\p{Nd}]/u.test(ch)
}

/** A run of `n` emphasis characters opens only when a non-space character follows it. An underscore
 *  run also needs a non-word character before it, so `snake_case` is text. */
function canOpen(ctx: Ctx, at: number, to: number, n: number, c: string): boolean {
  const { text } = ctx
  const after = at + n
  if (after >= to || isSpace(text[after] ?? '')) return false
  if (c === '_' && isWordChar(text[at - 1] ?? '')) return false
  return true
}

/** The offset of a run of exactly `n` emphasis characters that closes an opener, or -1. A closer
 *  follows a non-space character, holds at least one character of content, and for an underscore
 *  is not followed by a word character. Code spans and references are passed over whole. */
function emphasisClose(ctx: Ctx, from: number, to: number, n: number, c: string): number {
  const { text } = ctx
  let k = from
  while (k < to) {
    const ref = ctx.refs.get(k)
    if (ref) {
      k = ref.end
      continue
    }
    const ch = text[k]
    if (ch === '`') {
      const m = runLength(text, k, to, '`')
      const close = codeClose(ctx, k + m, to, m)
      k = close >= 0 ? close + m : k + m
      continue
    }
    if (ch === c) {
      const m = runLength(text, k, to, c)
      if (m === n && k > from && !isSpace(text[k - 1] ?? '') && !(c === '_' && isWordChar(text[k + m] ?? ''))) return k
      k += m
      continue
    }
    k++
  }
  return -1
}

/** The offset of a backtick run of exactly `n` that closes a code span, or -1. */
function codeClose(ctx: Ctx, from: number, to: number, n: number): number {
  const { text } = ctx
  let k = from
  while (k < to) {
    const ref = ctx.refs.get(k)
    if (ref) {
      k = ref.end
      continue
    }
    if (text[k] === '`') {
      const m = runLength(text, k, to, '`')
      if (m === n && k > from) return k
      k += m
      continue
    }
    k++
  }
  return -1
}

/** A link at `at`: `[label](target)` with a label and a target, both inside `to`. A target holding a
 *  reference is not a link, so the reference stays a chip. */
function linkAt(ctx: Ctx, at: number, to: number): { labelEnd: number; end: number } | null {
  const { text } = ctx
  const close = findOutsideRefs(ctx, at + 1, to, ']')
  if (close < 0 || close === at + 1) return null
  if (text[close + 1] !== '(') return null
  const paren = matchingParen(ctx, close + 2, to)
  if (paren < 0) return null
  for (const start of ctx.refs.keys()) {
    if (start > close && start < paren) return null
  }
  return { labelEnd: close, end: paren + 1 }
}

/** The `)` that closes a link target, counting the parentheses inside it, or -1. */
function matchingParen(ctx: Ctx, from: number, to: number): number {
  const { text } = ctx
  let depth = 0
  let k = from
  while (k < to) {
    const ref = ctx.refs.get(k)
    if (ref) {
      k = ref.end
      continue
    }
    if (text[k] === '(') depth++
    else if (text[k] === ')') {
      if (depth === 0) return k
      depth--
    }
    k++
  }
  return -1
}

function findOutsideRefs(ctx: Ctx, from: number, to: number, ch: string): number {
  const { text } = ctx
  let k = from
  while (k < to) {
    const ref = ctx.refs.get(k)
    if (ref) {
      k = ref.end
      continue
    }
    if (text[k] === ch) return k
    k++
  }
  return -1
}

/** Text pieces between `from` and `to`, each split where a mark starts or ends. A mark's kind rides
 *  on the piece it covers; the pieces keep the order of the text. */
function textNodes(ctx: Ctx, from: number, to: number): MdInline[] {
  const out: MdInline[] = []
  let at = from
  for (const k of ctx.marks) {
    if (k.end <= at) continue
    if (k.start >= to) break
    const start = Math.max(k.start, at)
    if (start > at) out.push(textLeaf(ctx, at, start, null))
    const end = Math.min(k.end, to)
    out.push(textLeaf(ctx, start, end, k.kind))
    at = end
  }
  if (at < to) out.push(textLeaf(ctx, at, to, null))
  return out
}

function textLeaf(ctx: Ctx, from: number, to: number, mark: string | null): MdInline {
  return { kind: 'text', text: ctx.text.slice(from, to), mark }
}
