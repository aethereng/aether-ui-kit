/* Framework-free core for the Menu control: the keyboard model, as pure functions over plain data.
 * No Vue, no DOM.
 *
 * Same reasoning as tree.ts. A menu's keyboard contract is small but exact — arrows wrap, disabled
 * items are skipped rather than landed on and ignored, Home/End are not optional, Escape closes and
 * returns focus to the trigger, and Tab closes rather than moving inside. Written once and tested
 * without a browser, because every one of those is a thing a hand-rolled menu forgets. */

export interface MenuItem {
  id: string
  label: string
  disabled?: boolean
  /** Renders as a divider; never focusable, never activatable, skipped by every movement. */
  separator?: boolean
  /** Whatever the caller dispatches on. The kit never reads it. */
  data?: unknown
}

/** What the component should do. `id` is set for 'move'; for 'activate' it is the item activated. */
export interface MenuKeyResult {
  kind: 'move' | 'activate' | 'close' | 'none'
  id?: string
}

/** Items a cursor may actually land on. A separator or a disabled row is rendered, not reachable. */
export function focusableItems(items: readonly MenuItem[]): MenuItem[] {
  return items.filter((i) => !i.separator && !i.disabled)
}

/* Movement wraps in both directions. Wrapping is the behaviour a menu is expected to have — unlike
   a tree, where running off the end means you have reached the end of a structure. */
function step(items: readonly MenuItem[], cursorId: string | null, delta: 1 | -1): string | null {
  const list = focusableItems(items)
  if (!list.length) return null
  const at = list.findIndex((i) => i.id === cursorId)
  // No cursor yet: Down opens on the first item, Up on the last.
  if (at === -1) return (delta === 1 ? list[0] : list[list.length - 1])!.id
  return list[(at + delta + list.length) % list.length]!.id
}

export function firstItem(items: readonly MenuItem[]): string | null {
  return focusableItems(items)[0]?.id ?? null
}

export function lastItem(items: readonly MenuItem[]): string | null {
  const list = focusableItems(items)
  return list[list.length - 1]?.id ?? null
}

/* The whole model, in one function. `key` is a KeyboardEvent.key value.
 *
 * Tab returns 'close' rather than 'none': a menu that stays open while focus walks out from under
 * it leaves an orphaned surface floating over the page, which is the failure people notice and
 * cannot explain. Letting the browser then move focus normally is the component's job, not this
 * one's — which is why 'close' says nothing about preventing the default. */
export function menuKey(
  items: readonly MenuItem[],
  key: string,
  cursorId: string | null,
): MenuKeyResult {
  switch (key) {
    case 'ArrowDown': {
      const id = step(items, cursorId, 1)
      return id ? { kind: 'move', id } : { kind: 'none' }
    }
    case 'ArrowUp': {
      const id = step(items, cursorId, -1)
      return id ? { kind: 'move', id } : { kind: 'none' }
    }
    case 'Home': {
      const id = firstItem(items)
      return id ? { kind: 'move', id } : { kind: 'none' }
    }
    case 'End': {
      const id = lastItem(items)
      return id ? { kind: 'move', id } : { kind: 'none' }
    }
    case 'Enter':
    case ' ': {
      /* Activating nothing is 'none', not 'activate' with no id — a caller destructuring `id` and
         dispatching on it would otherwise fire an action for undefined. */
      if (!cursorId) return { kind: 'none' }
      const item = items.find((i) => i.id === cursorId)
      if (!item || item.disabled || item.separator) return { kind: 'none' }
      return { kind: 'activate', id: cursorId }
    }
    case 'Escape':
    case 'Tab':
      return { kind: 'close' }
    default:
      return { kind: 'none' }
  }
}

/** A printable character that should feed typeahead — one grapheme, no modifier combination. */
export function isTypeaheadKey(key: string): boolean {
  return key.length === 1 && key !== ' '
}
