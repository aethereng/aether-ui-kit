/* How a popover closes the way a menu closes: on Escape, which hands focus back to the control
 * that opened it, or on a press anywhere outside it.
 *
 * `root` holds both the control and the popover, so the press that opened it is not read as a
 * press outside. The press is read in the capture phase, before any handler under it can stop it.
 *
 * The control is found through a getter rather than held: a button wrapped in the kit's Tooltip
 * must be the Tooltip's first child, since that is what the Tooltip anchors to, so there may be no
 * element of the caller's around it to hold.
 *
 * Framework-free: `bindDismiss` puts the listeners on a window and gives back the call that takes
 * them off. `useDismiss` (controls/composables) is the Vue form, bound while a component is
 * mounted. */

export interface DismissTarget {
  /** Whether the popover is open now. */
  isOpen(): boolean
  /** Closes it. */
  close(): void
  /** The element holding both the popover and the control that opens it. */
  root(): Element | null
  /** The control that opens it; it takes focus back when Escape closes the popover. */
  trigger(): HTMLElement | null
}

export interface DismissOptions {
  /**
   * The popover takes Escape before anything under it: the key is read in the capture phase and
   * marked as used (`preventDefault`), so a handler that reads `defaultPrevented` can skip the same
   * press. False reads it after the page's own handlers and leaves it unmarked.
   * Default true.
   */
  first?: boolean
  /**
   * Escape pressed while an input method composes text stays with the composition, where it
   * cancels what is being composed. False closes the popover on it as well. Default true.
   */
  keepComposition?: boolean
}

export function bindDismiss(win: Window, target: DismissTarget, options: DismissOptions = {}): () => void {
  const { first = true, keepComposition = true } = options
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !target.isOpen()) return
    if (keepComposition && e.isComposing) return
    if (first) e.preventDefault()
    target.close()
    target.trigger()?.focus()
  }
  const onDown = (e: PointerEvent): void => {
    if (!target.isOpen()) return
    const root = target.root()
    if (root && e.target instanceof Node && root.contains(e.target)) return
    target.close()
  }
  win.addEventListener('keydown', onKey, first)
  win.addEventListener('pointerdown', onDown, true)
  return () => {
    win.removeEventListener('keydown', onKey, first)
    win.removeEventListener('pointerdown', onDown, true)
  }
}
