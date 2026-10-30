/* A busy flag for the eye: it shows late and, once shown, stays a minimum time.
 *
 * Most work an app shows a busy state for finishes in well under a second, and a spinner that
 * flashes for a frame reads as a glitch. Two guards answer that:
 *
 *   - showDelayMs:  the flag stays down until the source has been up this long, so work that
 *                   ends quickly never shows at all.
 *   - minVisibleMs: once up, the flag stays up at least this long, so it never shows and vanishes
 *                   in the same breath.
 *
 * The source going up again while the flag shows keeps it up rather than starting the cycle over.
 *
 * Framework-free: `onChange` hears every change of the flag, and `useDeferredFlag`
 * (controls/composables) is the Vue form, a ref fed from a watched source. */

export interface DeferredFlagOptions {
  /** How long the source must be up before the flag shows, in ms. */
  showDelayMs?: number
  /** How long the flag stays up once shown, at least, in ms. */
  minVisibleMs?: number
}

export interface DeferredFlag {
  /** Tells the flag what the source reads now. */
  set(on: boolean): void
  /** Whether the flag shows. */
  readonly visible: boolean
  /** Cancels a change still waiting; the flag keeps what it shows. */
  stop(): void
}

export function deferredFlag(
  onChange: (visible: boolean) => void,
  { showDelayMs = 180, minVisibleMs = 420 }: DeferredFlagOptions = {},
): DeferredFlag {
  let visible = false
  let shownAt = 0
  let showTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const stop = (): void => {
    clearTimeout(showTimer)
    showTimer = undefined
    clearTimeout(hideTimer)
    hideTimer = undefined
  }

  const set = (on: boolean): void => {
    stop()
    if (on) {
      if (visible) return // already up: it stays
      showTimer = setTimeout(() => {
        visible = true
        shownAt = performance.now()
        onChange(true)
      }, showDelayMs)
    } else {
      if (!visible) return // it never showed: there is nothing to take down
      const remaining = Math.max(0, minVisibleMs - (performance.now() - shownAt))
      hideTimer = setTimeout(() => {
        visible = false
        onChange(false)
      }, remaining)
    }
  }

  return {
    set,
    get visible() {
      return visible
    },
    stop,
  }
}
