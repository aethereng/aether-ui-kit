// The width of each column of a record table, in CSS pixels, from what its cells hold:
// - a number: its widest value over the rows shown, plus the field's padding, between NUMBER.floor and NUMBER.ceiling;
// - a choice: its longest option where a row shown holds a value, and its blank label, "(none)" or "(choose)", where none
//   does, plus the padding and the arrow, between CHOICE.floor and CHOICE.ceiling. The kit's select draws its label and its
//   arrow past its own edge where it is narrower than they are, so a choice column is never narrower than its blank label;
// - a text: as wide as it is, up to TEXT_CEILING, cut with an ellipsis past it;
// - a number column whose cells hold nothing: NUMBER.floor.
// A value wider than its column is cut, and its cell carries the whole value as its title.

/** The kit's text field and select: 9 px of padding and 1 px of border on each side, and 2 px for the caret. */
export const PAD = 22
/** The room a select's arrow takes. */
export const ARROW = 24
export const NUMBER = { floor: 48, ceiling: 160 }
export const CHOICE = { floor: 64, ceiling: 200 }
export const TEXT_CEILING = 200
/** The width of a character where nothing lays out (jsdom), at or above a digit's in the controls' font. */
const CHAR = 8

/** The width a text takes in px, in the font of the kit's controls. */
export type Measure = (text: string) => number

let probe: HTMLElement | null = null
const chars = new Map<string, number>()
/**
 * Measures in the font the kit's controls draw in: 13.5 px of the page's family with tabular figures, as a table's fields
 * set them, one character at a time in a hidden span, each character once. CHAR a character where nothing lays out (a
 * width of 0), and every character where there is no document. Characters are measured again once the page's fonts have
 * loaded.
 */
export function measurer(): Measure {
  if (typeof document === 'undefined') return (text) => text.length * CHAR
  if (probe === null) {
    probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font-size:13.5px;font-variant-numeric:tabular-nums'
    probe.style.fontFamily = getComputedStyle(document.body).fontFamily
    document.body.appendChild(probe)
    void document.fonts?.ready.then(() => chars.clear())
  }
  const span = probe
  const width = (c: string): number => {
    let w = chars.get(c)
    if (w === undefined) {
      span.textContent = c
      w = span.getBoundingClientRect().width || CHAR
      chars.set(c, w)
    }
    return w
  }
  return (text) => [...text].reduce((sum, c) => sum + width(c), 0)
}

const clamp = (x: number, bounds: { floor: number; ceiling: number }): number => Math.min(bounds.ceiling, Math.max(bounds.floor, Math.ceil(x)))
const widest = (texts: readonly string[], measure: Measure): number => texts.reduce((w, t) => Math.max(w, measure(t)), 0)

/** A number column's width: its widest value; NUMBER.floor where no value is written. */
export function numberWidth(values: readonly string[], measure: Measure): number {
  const written = values.filter((v) => v !== '')
  return written.length === 0 ? NUMBER.floor : clamp(widest(written, measure) + PAD, NUMBER)
}

/** A choice column's width: its longest option. */
export function choiceWidth(options: readonly string[], measure: Measure): number {
  return clamp(widest(options, measure) + PAD + ARROW, CHOICE)
}

/** Whether `text` is cut in a control `width` px wide, `chrome` px of which are not text. */
export const isCut = (text: string, width: number, chrome: number, measure: Measure): boolean => text !== '' && measure(text) + chrome > width
