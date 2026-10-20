/* The line markup a reply is read by: the quote and the list item the parser draws (markdown.ts). It is held
 * here once, so the numeral gate (refs.ts) reads a list marker by the same rule the parser reads it by. A
 * quote opens with up to three spaces, `>` and one optional space, and nests to MAX_QUOTE_DEPTH levels; a
 * `>` past that is text. A list item opens with up to three spaces, a bullet or an ordered number of one to
 * nine digits and `.` or `)`, then a space or the end of the line.
 *
 * @internal: read by refs and markdown alone, so it is not a subpath of the exports map. */

export const MAX_QUOTE_DEPTH = 8
export const QUOTE_LINE = /^[ \t]{0,3}> ?/
export const LIST_LINE = /^[ \t]{0,3}(?:[-*+]|([0-9]{1,9})[.)])(?:[ \t]+|$)/

/** Whether the token `raw`, at `at` in `text`, opens a list item the parser reads. The text from the start
 *  of its line to `at` must be quote prefixes (no more than the parser strips) and indentation, and the
 *  token must be the marker: an ordered number followed by a space or the end of the line. */
export function opensListItem(text: string, at: number, raw: string): boolean {
  if (!/^[0-9]{1,9}[.)]$/.test(raw)) return false
  let ls = at
  while (ls > 0 && (text[ls - 1] === ' ' || text[ls - 1] === '\t' || text[ls - 1] === '>')) ls--
  if (ls > 0 && text.charCodeAt(ls - 1) !== 10) return false
  let rest = text.slice(ls, at)
  for (let depth = 0; depth < MAX_QUOTE_DEPTH; depth++) {
    const quote = QUOTE_LINE.exec(rest)
    if (quote === null) break
    rest = rest.slice(quote[0].length)
  }
  if (!/^[ \t]{0,3}$/.test(rest)) return false
  const end = at + raw.length
  let after = text.slice(end, end + 1)
  if (after === '\n' || (after === '\r' && (end + 1 === text.length || text[end + 1] === '\n'))) after = ''
  const marker = LIST_LINE.exec(rest + raw + after)
  return marker !== null && marker[1] === raw.slice(0, -1)
}
