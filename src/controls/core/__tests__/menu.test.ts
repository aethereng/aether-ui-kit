import { describe, it, expect } from 'vitest'
import { firstItem, focusableItems, isTypeaheadKey, lastItem, menuKey } from '../menu'
import type { MenuItem } from '../menu'
import { typeahead } from '../tree'

/* The File menu from a real consumer: five actions, one conditionally disabled, one separator. */
const items: MenuItem[] = [
  { id: 'new', label: 'New model' },
  { id: 'open', label: 'Open…' },
  { id: 'sep1', label: '', separator: true },
  { id: 'save', label: 'Save' },
  { id: 'saveas', label: 'Save as…', disabled: true },
  { id: 'export', label: 'Export IFC' },
]

describe('focusable items', () => {
  it('excludes separators and disabled rows', () => {
    expect(focusableItems(items).map((i) => i.id)).toEqual(['new', 'open', 'save', 'export'])
  })
  it('reports the ends of the focusable list, not of the rendered one', () => {
    expect(firstItem(items)).toBe('new')
    expect(lastItem(items)).toBe('export')
  })
  it('handles a list with nothing reachable in it', () => {
    const dead: MenuItem[] = [{ id: 's', label: '', separator: true }, { id: 'd', label: 'x', disabled: true }]
    expect(firstItem(dead)).toBeNull()
    expect(menuKey(dead, 'ArrowDown', null)).toEqual({ kind: 'none' })
  })
})

describe('menuKey — movement', () => {
  it('skips a disabled item rather than landing on it', () => {
    /* THE case. A cursor that lands on a disabled row and does nothing reads as a broken menu:
     * the user presses Down, something appears to happen, and Enter is ignored. */
    expect(menuKey(items, 'ArrowDown', 'save')).toEqual({ kind: 'move', id: 'export' })
  })

  it('skips a separator too', () => {
    expect(menuKey(items, 'ArrowDown', 'open')).toEqual({ kind: 'move', id: 'save' })
  })

  it('wraps in both directions', () => {
    // Unlike a tree, where the end of the list is the end of a structure.
    expect(menuKey(items, 'ArrowDown', 'export')).toEqual({ kind: 'move', id: 'new' })
    expect(menuKey(items, 'ArrowUp', 'new')).toEqual({ kind: 'move', id: 'export' })
  })

  it('opens onto the near end when there is no cursor yet', () => {
    // Down from the trigger lands on the first item; Up lands on the last.
    expect(menuKey(items, 'ArrowDown', null)).toEqual({ kind: 'move', id: 'new' })
    expect(menuKey(items, 'ArrowUp', null)).toEqual({ kind: 'move', id: 'export' })
  })

  it('Home and End reach the focusable ends', () => {
    expect(menuKey(items, 'Home', 'save')).toEqual({ kind: 'move', id: 'new' })
    // Not 'saveas', which is disabled and last in the rendered order.
    expect(menuKey(items, 'End', 'new')).toEqual({ kind: 'move', id: 'export' })
  })

  it('recovers when the cursor names an item that is gone', () => {
    expect(menuKey(items, 'ArrowDown', 'deleted')).toEqual({ kind: 'move', id: 'new' })
  })
})

describe('menuKey — activation and dismissal', () => {
  it('activates on Enter and Space', () => {
    expect(menuKey(items, 'Enter', 'save')).toEqual({ kind: 'activate', id: 'save' })
    expect(menuKey(items, ' ', 'save')).toEqual({ kind: 'activate', id: 'save' })
  })

  it('refuses to activate a disabled item even with the cursor on it', () => {
    // Belt and braces: movement should never put the cursor here, and if it does, nothing fires.
    expect(menuKey(items, 'Enter', 'saveas')).toEqual({ kind: 'none' })
    expect(menuKey(items, 'Enter', 'sep1')).toEqual({ kind: 'none' })
  })

  it('never returns activate without an id', () => {
    /* A caller destructuring `id` and dispatching on it would fire an action for `undefined`. */
    const r = menuKey(items, 'Enter', null)
    expect(r.kind).toBe('none')
    expect(r.id).toBeUndefined()
  })

  it('closes on both Escape and Tab', () => {
    /* Tab closing is the one people leave out, and it leaves an orphaned surface floating over the
     * page after focus has walked out from under it. */
    expect(menuKey(items, 'Escape', 'save')).toEqual({ kind: 'close' })
    expect(menuKey(items, 'Tab', 'save')).toEqual({ kind: 'close' })
  })

  it('ignores keys it has no opinion about', () => {
    expect(menuKey(items, 'F5', 'save')).toEqual({ kind: 'none' })
    expect(menuKey(items, 'ArrowRight', 'save')).toEqual({ kind: 'none' })
  })
})

describe('typeahead over menu items', () => {
  it('works on MenuItem, which is why tree.ts widened its parameter', () => {
    expect(typeahead(items, 's', 'new')).toBe('save')
  })

  it('cycles through matches on a repeated letter instead of sticking', () => {
    expect(typeahead(items, 's', 'save')).toBe('saveas')
  })

  it('finds nothing for a query no label starts with', () => {
    expect(typeahead(items, 'zz', 'new')).toBeNull()
  })
})

describe('isTypeaheadKey', () => {
  it('takes single printable characters', () => {
    expect(isTypeaheadKey('a')).toBe(true)
    expect(isTypeaheadKey('7')).toBe(true)
  })
  it('rejects named keys and space', () => {
    // Space activates; treating it as typeahead would make it impossible to press an item.
    expect(isTypeaheadKey(' ')).toBe(false)
    expect(isTypeaheadKey('ArrowDown')).toBe(false)
    expect(isTypeaheadKey('Escape')).toBe(false)
  })
})
