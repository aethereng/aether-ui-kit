/* Markdown for a reply, framework-free: the blocks and inline spans the panel draws, with
 * the reference chips and the marks kept where they stand.
 *
 * WHAT IT READS. Paragraphs (the text between blank lines), line breaks inside a paragraph, bullet
 * and numbered lists, headings of one to four `#` (drawn as one bold line of the reply's own size),
 * block quotes (nested, to MAX_QUOTE_DEPTH in markup.ts; a `>` past that is text), fenced code blocks of
 * backticks or tildes (the language word is not drawn, and nothing inside the block is read as markup),
 * bold (`**` or `__`), emphasis (`*` or `_`), inline code, and links. A link renders as its label. Its
 * target is dropped, so no reply can become a live link.
 *
 * WHAT IT NEVER DOES. It produces text, and the panel draws text by interpolation. No reply reaches
 * the page as markup: a `<` in a reply stays a `<`.
 *
 * OFFSETS. The numeral gate's marks and the references are offsets into the raw text, and this module
 * keeps them so. A mark is drawn over the characters it covers. The markers that formatting hides are
 * not drawn, so a mark over `*3.1*` highlights `3.1`. A reference is atomic: markers inside its path are
 * part of the path, and it is never split and never marked. A mark that covers a reference is not drawn
 * over it; the chip carries its own state. The `>` that opens a quoted line is hidden the way a formatting
 * marker is, so it is drawn as nothing and read as no text. A link's target is not drawn, so a mark over
 * the target is drawn over the link's label. A fence's info string is not drawn, except its marks and
 * references, which are drawn on the block's first line.
 *
 * @internal: read by ChatPanel alone, so it is not a subpath of the exports map. */
import { usableMarks, type ChatMark } from './chat'
import { LIST_LINE, MAX_QUOTE_DEPTH, QUOTE_LINE } from './markup'
import { DEFAULT_REFERENCE_SCOPES, splitReferences, type ReferenceScopes } from './refs'

/** One inline piece. A text piece carries the kind of the mark that covers it, or null. A reference
 *  carries `scope:path`, without its braces, for the panel to resolve. */
export type MdInline =
  | { kind: 'text'; text: string; mark: string | null }
  | { kind: 'ref'; ref: string }
  | { kind: 'br' }
  | { kind: 'strong' | 'em' | 'code'; children: MdInline[] }

/** One block. A list's `start` is the number its first item carries; a bullet list starts at 1 and the
 *  panel ignores it. A heading's text is drawn in bold at the reply's own size. A quote holds blocks of
 *  its own. A code block holds its lines as literal text, marks and references included. */
export type MdBlock =
  | { kind: 'p'; children: MdInline[] }
  | { kind: 'heading'; children: MdInline[] }
  | { kind: 'list'; ordered: boolean; start: number; items: MdInline[][] }
  | { kind: 'quote'; blocks: MdBlock[] }
  | { kind: 'code'; children: MdInline[] }

/** A span of the raw text that is read whole. A reference is drawn as its chip; a hidden span (the
 *  opening `>` of a quoted line) is drawn as nothing. Keyed in `Ctx.atoms` by where it starts. */
interface Atom {
  end: number
  ref?: string
}

interface Ctx {
  readonly text: string
  readonly marks: readonly ChatMark[]
  readonly atoms: Map<number, Atom>
  /** Scan positions that reach no closer, by the closer sought (see `deadEnds`). */
  readonly dead: Map<string, Set<number>>
  /** The link-target walks, by the end of the range they cover (see `matchingParen`). */
  readonly parens: Map<number, ParenWalk>
}

interface Span {
  start: number
  end: number
}

const BLANK = /^[ \t]*$/
/* A heading: one to four `#`, then a space or the end of the line. */
const HEADING_LINE = /^[ \t]{0,3}(#{1,4})(?:[ \t]+|$)/
/* The closing `#`s of a heading, which are not drawn. The blanks before them are kept by the regex and
 * trimmed by the caller, so the match is linear. */
const HEADING_CLOSE = /(?:^|[ \t])#+[ \t]*$/
/* A fence opener: three or more backticks or tildes, then the info string. */
const FENCE_OPEN = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/
/* A fence closer: the same character, at least as many, and nothing else. */
const FENCE_CLOSE = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/

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

/** The blocks of a reply's text. `marks` are the gate's spans, offsets into `text`; a malformed mark is
 *  dropped by `usableMarks`. */
export function markdownBlocks(
  text: string,
  marks: readonly ChatMark[] = [],
  scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES,
): MdBlock[] {
  const atoms = new Map<number, Atom>()
  for (const seg of splitReferences(text, scopes)) {
    if (seg.kind === 'ref') atoms.set(seg.start, { end: seg.end, ref: seg.ref })
  }
  return blocksOf({ text, marks: usableMarks(text, marks), atoms, dead: new Map(), parens: new Map() }, linesOf(text), 0)
}

/* ---- blocks ---- */

/** The blocks of a run of lines. A line is a span of the text whose start is past any container
 *  prefix (a quote's `>`), so a quote's content is read by the same rules as the whole reply. `depth`
 *  counts the quotes the lines sit inside; past MAX_QUOTE_DEPTH a `>` is text. */
function blocksOf(ctx: Ctx, lines: readonly Span[], depth: number): MdBlock[] {
  const { text } = ctx
  const blocks: MdBlock[] = []
  let para: Span | null = null
  let list: { ordered: boolean; start: number; items: MdInline[][] } | null = null
  let k = 0
  while (k < lines.length) {
    const line = lines[k]!
    const raw = text.slice(line.start, line.end)

    const open = FENCE_OPEN.exec(raw)
    if (open && !(open[1]![0] === '`' && open[2]!.includes('`'))) {
      if (para) blocks.push({ kind: 'p', children: inlineRange(ctx, para.start, para.end, false) })
      if (list) blocks.push({ kind: 'list', ...list })
      para = null
      list = null
      // The block runs to its closing fence, or to the end of the lines while the reply streams.
      let j = k + 1
      while (j < lines.length && !closesFence(text.slice(lines[j]!.start, lines[j]!.end), open[1]!)) j++
      const body = lines.slice(k + 1, j)
      // A mark or a reference in the info string is drawn on the first line; the language word is not.
      const info = inlineRange(ctx, line.end - open[2]!.length, line.end, true).filter((p) => p.kind === 'ref' || (p.kind === 'text' && p.mark !== null))
      const bodyChildren = body.length ? inlineRange(ctx, body[0]!.start, body[body.length - 1]!.end, true) : []
      const children = info.length && bodyChildren.length ? [...info, { kind: 'br' as const }, ...bodyChildren] : [...info, ...bodyChildren]
      blocks.push({ kind: 'code', children })
      k = j + 1
      continue
    }

    const quote = depth < MAX_QUOTE_DEPTH ? QUOTE_LINE.exec(raw) : null
    if (quote) {
      if (para) blocks.push({ kind: 'p', children: inlineRange(ctx, para.start, para.end, false) })
      if (list) blocks.push({ kind: 'list', ...list })
      para = null
      list = null
      const inner: Span[] = []
      let j = k
      for (; j < lines.length; j++) {
        const row = lines[j]!
        const m = QUOTE_LINE.exec(text.slice(row.start, row.end))
        if (!m) break
        const contentStart = row.start + m[0].length
        ctx.atoms.set(row.start, { end: contentStart })
        inner.push({ start: contentStart, end: row.end })
      }
      blocks.push({ kind: 'quote', blocks: blocksOf(ctx, inner, depth + 1) })
      k = j
      continue
    }

    const heading = HEADING_LINE.exec(raw)
    if (heading) {
      if (para) blocks.push({ kind: 'p', children: inlineRange(ctx, para.start, para.end, false) })
      if (list) blocks.push({ kind: 'list', ...list })
      para = null
      list = null
      const start = line.start + heading[0].length
      const close = HEADING_CLOSE.exec(text.slice(start, line.end))
      let end = close ? start + close.index : line.end
      if (close) while (end > start && (text[end - 1] === ' ' || text[end - 1] === '\t')) end--
      blocks.push({ kind: 'heading', children: inlineRange(ctx, start, end, false) })
      k++
      continue
    }

    const item = LIST_LINE.exec(raw)
    if (item === null && !BLANK.test(raw)) {
      // A text line continues the paragraph, and ends a list it follows.
      if (list) {
        blocks.push({ kind: 'list', ...list })
        list = null
      }
      para = para ? { start: para.start, end: line.end } : line
      k++
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
      k++
      continue
    }
    const ordered = item[1] !== undefined
    if (list && list.ordered !== ordered) {
      blocks.push({ kind: 'list', ...list })
      list = null
    }
    if (!list) list = { ordered, start: ordered ? Number(item[1]) : 1, items: [] }
    list.items.push(inlineRange(ctx, line.start + item[0].length, line.end, false))
    k++
  }
  if (para) blocks.push({ kind: 'p', children: inlineRange(ctx, para.start, para.end, false) })
  if (list) blocks.push({ kind: 'list', ...list })
  return blocks
}

/** Whether a line closes a fence opened by `open` (its backticks or tildes): the same character, at
 *  least as many. */
function closesFence(raw: string, open: string): boolean {
  const m = FENCE_CLOSE.exec(raw)
  return m !== null && m[1]![0] === open[0] && m[1]!.length >= open.length
}

/* ---- inline ---- */

/** The inline pieces of `text` between `from` and `to`. In `literal` mode (a code span's or a code
 *  block's content) only references, hidden spans and line breaks are read; every other character is
 *  text. */
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
    const atom = ctx.atoms.get(i)
    if (atom) {
      flush(i)
      if (atom.ref !== undefined) out.push({ kind: 'ref', ref: atom.ref })
      i = atom.end
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
        // The target is not drawn, so a mark that covers it is drawn over the label.
        const label = inlineRange(ctx, i + 1, link.labelEnd, false)
        const over = markOver(ctx, link.labelEnd, link.end)
        out.push(...(over === null ? label : markLabel(label, over)))
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

/** The positions a scan for one closer has found to reach no closer. A scan that finds none records each
 *  position it visited, and a later scan that reaches a recorded one stops there with no closer, so a
 *  paragraph is scanned once per closer, not once per opener. The answer from a position is the same for
 *  every scan that reaches it: the only check that depends on where a scan began (a closer must follow
 *  its opener) can only fail at that first character, and a closer there would already have been found
 *  by the scan that first visited it. That holds because every scan starts after a maximal opener run
 *  (runLength), so its first character is never the run's own character. */
function deadEnds(ctx: Ctx, key: string): Set<number> {
  let set = ctx.dead.get(key)
  if (set === undefined) {
    set = new Set()
    ctx.dead.set(key, set)
  }
  return set
}

/** The offset of a run of exactly `n` emphasis characters that closes an opener, or -1. A closer
 *  follows a non-space character, holds at least one character of content, and for an underscore
 *  is not followed by a word character. Code spans and atoms are passed over whole. */
function emphasisClose(ctx: Ctx, from: number, to: number, n: number, c: string): number {
  const { text } = ctx
  const dead = deadEnds(ctx, `${c}${n}@${to}`)
  const visited: number[] = []
  let found = -1
  let k = from
  while (k < to && !dead.has(k)) {
    visited.push(k)
    const atom = ctx.atoms.get(k)
    if (atom) {
      k = atom.end
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
      if (m === n && k > from && !isSpace(text[k - 1] ?? '') && !(c === '_' && isWordChar(text[k + m] ?? ''))) {
        found = k
        break
      }
      k += m
      continue
    }
    k++
  }
  if (found < 0) for (const p of visited) dead.add(p)
  return found
}

/** The offset of a backtick run of exactly `n` that closes a code span, or -1. */
function codeClose(ctx: Ctx, from: number, to: number, n: number): number {
  const { text } = ctx
  const dead = deadEnds(ctx, `\`${n}@${to}`)
  const visited: number[] = []
  let found = -1
  let k = from
  while (k < to && !dead.has(k)) {
    visited.push(k)
    const atom = ctx.atoms.get(k)
    if (atom) {
      k = atom.end
      continue
    }
    if (text[k] === '`') {
      const m = runLength(text, k, to, '`')
      if (m === n && k > from) {
        found = k
        break
      }
      k += m
      continue
    }
    k++
  }
  if (found < 0) for (const p of visited) dead.add(p)
  return found
}

/** A link at `at`: `[label](target)` with a label and a target, both inside `to`. A target holding a
 *  reference is not a link, so the reference stays a chip. */
function linkAt(ctx: Ctx, at: number, to: number): { labelEnd: number; end: number } | null {
  const { text } = ctx
  const close = findOutside(ctx, at + 1, to, ']')
  if (close < 0 || close === at + 1) return null
  if (text[close + 1] !== '(') return null
  const paren = matchingParen(ctx, close + 2, to)
  if (paren < 0) return null
  for (const [start, atom] of ctx.atoms) {
    if (atom.ref !== undefined && start > close && start < paren) return null
  }
  return { labelEnd: close, end: paren + 1 }
}

/** The walk a scan for a link's `)` takes through a range: the units it visits, the depth before each, and
 *  the lowest depth from each entry on. The last depth is the depth at the range's end. */
interface ParenWalk {
  readonly pos: readonly number[]
  readonly bal: readonly number[]
  readonly low: readonly number[]
  readonly at: ReadonlyMap<number, number>
}

function parenWalk(ctx: Ctx, from: number, to: number): ParenWalk {
  const { text } = ctx
  const pos: number[] = []
  const bal: number[] = []
  let depth = 0
  let k = from
  while (k < to) {
    pos.push(k)
    bal.push(depth)
    const atom = ctx.atoms.get(k)
    if (atom) {
      k = atom.end
      continue
    }
    if (text[k] === '(') depth++
    else if (text[k] === ')') depth--
    k++
  }
  bal.push(depth)
  const low: number[] = new Array(bal.length)
  let least = Infinity
  for (let i = bal.length - 1; i >= 0; i--) {
    least = Math.min(least, bal[i]!)
    low[i] = least
  }
  return { pos, bal, low, at: new Map(pos.map((p, i) => [p, i])) }
}

/** The `)` that closes a link target, counting the parentheses inside it, or -1. Scans from different
 *  starts within one range share a walk: a start on the walk has no closer exactly when no depth after it
 *  drops below its own, so a paragraph of unclosed targets is walked once, not once per `[`. */
function matchingParen(ctx: Ctx, from: number, to: number): number {
  let walk = ctx.parens.get(to)
  if (walk === undefined) {
    walk = parenWalk(ctx, from, to)
    ctx.parens.set(to, walk)
  }
  const i = walk.at.get(from)
  if (i === undefined) return scanParen(ctx, from, to)
  if (walk.low[i]! >= walk.bal[i]!) return -1
  let j = i + 1
  while (walk.bal[j]! >= walk.bal[i]!) j++
  return walk.pos[j - 1]!
}

/** The same scan as a walk, from a start the walk does not hold. */
function scanParen(ctx: Ctx, from: number, to: number): number {
  const { text } = ctx
  let depth = 0
  let k = from
  while (k < to) {
    const atom = ctx.atoms.get(k)
    if (atom) {
      k = atom.end
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

/** The first `ch` between `from` and `to` that is not inside an atom, or -1. */
function findOutside(ctx: Ctx, from: number, to: number, ch: string): number {
  const { text } = ctx
  const dead = deadEnds(ctx, `${ch}@${to}`)
  const visited: number[] = []
  let found = -1
  let k = from
  while (k < to && !dead.has(k)) {
    visited.push(k)
    const atom = ctx.atoms.get(k)
    if (atom) {
      k = atom.end
      continue
    }
    if (text[k] === ch) {
      found = k
      break
    }
    k++
  }
  if (found < 0) for (const p of visited) dead.add(p)
  return found
}

/** The index of the first mark that ends after `at`. Marks are sorted and do not overlap, so their ends are. */
function firstMarkEndingAfter(ctx: Ctx, at: number): number {
  let lo = 0
  let hi = ctx.marks.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (ctx.marks[mid]!.end <= at) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** The kind of the first mark that covers a character between `from` and `to`, or null. */
function markOver(ctx: Ctx, from: number, to: number): string | null {
  const k = ctx.marks[firstMarkEndingAfter(ctx, from)]
  return k !== undefined && k.start < to ? k.kind : null
}

/** The pieces with the kind of a mark on every text piece that has none: a link's label, drawn marked
 *  where the link's target was marked. */
function markLabel(pieces: MdInline[], kind: string): MdInline[] {
  return pieces.map((p) => {
    if (p.kind === 'text') return p.mark === null ? { ...p, mark: kind } : p
    if (p.kind === 'strong' || p.kind === 'em' || p.kind === 'code') return { ...p, children: markLabel(p.children, kind) }
    return p
  })
}

/** Text pieces between `from` and `to`, each split where a mark starts or ends. A mark's kind rides
 *  on the piece it covers; the pieces keep the order of the text. */
function textNodes(ctx: Ctx, from: number, to: number): MdInline[] {
  const out: MdInline[] = []
  let at = from
  for (let j = firstMarkEndingAfter(ctx, from); j < ctx.marks.length; j++) {
    const k = ctx.marks[j]!
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
