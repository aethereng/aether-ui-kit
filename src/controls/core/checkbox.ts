// The framework-free half of Checkbox: its three states, what a press gives, which key presses it, and
// the lengths its drawing takes from one size. What a state means stays with the caller.

/** `mixed` is a group some of whose members are on. */
export type CheckState = 'off' | 'on' | 'mixed'

/** `mixed` wins over `checked`: a group partly on is partly on, whichever value its caller holds. */
export function checkState(checked: boolean, mixed = false): CheckState {
  if (mixed) return 'mixed'
  return checked ? 'on' : 'off'
}

/** The value of `aria-checked` for a state. */
export function ariaChecked(state: CheckState): 'true' | 'false' | 'mixed' {
  if (state === 'mixed') return 'mixed'
  return state === 'on' ? 'true' : 'false'
}

/** What a press asks for. A group partly on asks for all of it on, so one press settles it whichever
 *  value the caller holds behind `mixed`. */
export function nextChecked(checked: boolean, mixed = false): boolean {
  return mixed ? true : !checked
}

/** Space presses a checkbox and Enter does not, as with the browser's own. */
export function isCheckboxKey(key: string): boolean {
  return key === ' '
}

export interface CheckboxLengths {
  /** The side of the key, whole and even, so a dot or a bar has a whole pixel to sit on each way. */
  side: number
  radius: number
  dot: number
  barWidth: number
  barHeight: number
}

/* Every length is rounded to a whole pixel, for the reason Spinner rounds its stroke: a browser floors a
   sub-pixel length, so an unrounded ratio draws a different weight at each size. The dot and the bar are
   even so that they centre on an even side without landing on a half pixel. */
export function checkboxLengths(size: number): CheckboxLengths {
  const side = Math.max(2, Math.round(size / 2) * 2)
  return {
    side,
    radius: Math.round(side * 0.3),
    dot: Math.round(side * 0.16) * 2,
    barWidth: Math.round(side * 0.25) * 2,
    barHeight: Math.max(2, Math.round(side / 20) * 2),
  }
}
