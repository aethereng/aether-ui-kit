/* @internal: read by ChatPanel alone, so it is not a subpath. The clock of an assistant's activity
 * indicator: the elapsed time in words, and the check for a long quiet spell. Framework-free. The app
 * owns the words of each phase and the moments it records; these functions compute the elapsed text
 * and the quiet check from the times given. Times are milliseconds on the page's clock, the one
 * `Date.now()` reads. */

/** After this many seconds without anything from the API, while the API is the one being waited for,
 *  the indicator shows how long it has been. */
export const QUIET_AFTER_SECONDS = 20

/** Seconds, then minutes and seconds: `7 s`, `1 min 05 s`. A negative span reads as zero. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes === 0) return `${seconds} s`
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`
}

/** The whole seconds since the API last sent anything, once that is long enough to show; null before. */
export function quietSeconds(heardAt: number, now: number): number | null {
  const seconds = Math.floor((now - heardAt) / 1000)
  return seconds >= QUIET_AFTER_SECONDS ? seconds : null
}

/** The line the activity shows for the reasoning so far: the first sentence of the last paragraph that
 *  has text. A paragraph is the text between blank lines, and a sentence ends at `.`, `!` or `?` followed
 *  by a space or the end of the text. While that sentence is unfinished the line is what is there so far.
 *  Once its end mark is written the line holds, so it changes only when a new paragraph starts. A blank
 *  break that opens an empty paragraph changes nothing until that paragraph has text. */
export function reasoningLine(reasoning: string): string {
  const paragraphs = reasoning
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p !== '')
  const last = paragraphs[paragraphs.length - 1]
  if (last === undefined) return ''
  const end = /[.!?](?=\s|$)/.exec(last)
  return end ? last.slice(0, end.index + 1) : last
}
