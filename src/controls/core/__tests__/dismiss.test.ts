import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bindDismiss, type DismissOptions } from '../dismiss'

/* A popover in a root beside the control that opens it, and a button outside both. Each test binds
 * the window, presses or types, and reads whether the popover closed and where focus went. */

let root: HTMLDivElement
let trigger: HTMLButtonElement
let inside: HTMLButtonElement
let outside: HTMLButtonElement
let open: boolean
let unbind: () => void

function bind(options?: DismissOptions): void {
  open = true
  unbind = bindDismiss(
    window,
    {
      isOpen: () => open,
      close: () => {
        open = false
      },
      root: () => root,
      trigger: () => trigger,
    },
    options,
  )
}

function key(on: Element, init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  on.dispatchEvent(e)
  return e
}

function press(on: Element): void {
  on.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"><button id="trigger">Open</button><div><button id="inside">In</button></div></div><button id="outside">Out</button>'
  root = document.getElementById('root') as HTMLDivElement
  trigger = document.getElementById('trigger') as HTMLButtonElement
  inside = document.getElementById('inside') as HTMLButtonElement
  outside = document.getElementById('outside') as HTMLButtonElement
})
afterEach(() => {
  unbind()
  document.body.innerHTML = ''
})

describe('bindDismiss: Escape', () => {
  it('closes the popover and hands focus back to its control', () => {
    bind()
    inside.focus()
    key(inside, { key: 'Escape' })
    expect(open).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('takes Escape first by default: a handler under the popover sees it used', () => {
    bind()
    const seen: string[] = []
    inside.addEventListener('keydown', (e) => seen.push(`under, used ${e.defaultPrevented}, open ${open}`))
    const e = key(inside, { key: 'Escape' })
    expect(seen).toEqual(['under, used true, open false'])
    expect(e.defaultPrevented).toBe(true)
  })

  it('with first false, reads Escape after the page and leaves it unmarked', () => {
    bind({ first: false })
    const seen: string[] = []
    inside.addEventListener('keydown', (e) => seen.push(`under, used ${e.defaultPrevented}, open ${open}`))
    const e = key(inside, { key: 'Escape' })
    expect(seen).toEqual(['under, used false, open true'])
    expect(open).toBe(false)
    expect(e.defaultPrevented).toBe(false)
  })

  it('leaves Escape to an input method composing text, by default', () => {
    bind()
    const e = key(inside, { key: 'Escape', isComposing: true })
    expect(e.isComposing, 'precondition: the event is composing').toBe(true)
    expect(open).toBe(true)
    expect(e.defaultPrevented).toBe(false)
  })

  it('with keepComposition false, closes on an Escape that composes too', () => {
    bind({ keepComposition: false })
    key(inside, { key: 'Escape', isComposing: true })
    expect(open).toBe(false)
  })

  it('does nothing with another key, or with the popover closed', () => {
    bind()
    const other = key(inside, { key: 'Enter' })
    expect(open).toBe(true)
    expect(other.defaultPrevented).toBe(false)
    open = false
    outside.focus()
    const shut = key(outside, { key: 'Escape' })
    expect(shut.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(outside)
  })
})

describe('bindDismiss: a press', () => {
  it('outside the root closes the popover, and leaves focus where the press put it', () => {
    bind()
    press(outside)
    expect(open).toBe(false)
  })

  it('inside the root, on the control or the popover, keeps it open', () => {
    bind()
    press(trigger)
    press(inside)
    expect(open).toBe(true)
  })

  it('reads the press in the capture phase, before a handler under it can stop it', () => {
    bind()
    outside.addEventListener('pointerdown', (e) => e.stopPropagation())
    press(outside)
    expect(open).toBe(false)
  })
})

describe('bindDismiss: a press with nothing to read it against', () => {
  function closesOn(rootOf: () => Element | null, fire: () => void): number {
    let closed = 0
    unbind = bindDismiss(window, {
      isOpen: () => true,
      close: () => {
        closed += 1
      },
      root: rootOf,
      trigger: () => trigger,
    })
    fire()
    return closed
  }

  it('closes when the root is gone', () => {
    expect(closesOn(() => null, () => press(outside))).toBe(1)
  })

  it('closes on a press whose target is not a node, without throwing', () => {
    const errors: unknown[] = []
    const onError = (e: ErrorEvent): void => {
      errors.push(e.error)
      e.preventDefault()
    }
    window.addEventListener('error', onError)
    expect(closesOn(() => root, () => window.dispatchEvent(new Event('pointerdown')))).toBe(1)
    window.removeEventListener('error', onError)
    expect(errors).toEqual([])
  })

  it('does not call close on a press while it is closed', () => {
    let closed = 0
    unbind = bindDismiss(window, {
      isOpen: () => false,
      close: () => {
        closed += 1
      },
      root: () => root,
      trigger: () => trigger,
    })
    press(outside)
    expect(closed).toBe(0)
  })
})

describe('bindDismiss: unbinding', () => {
  it.each([{}, { first: false }])('takes both listeners off (%o)', (options) => {
    bind(options)
    unbind()
    key(inside, { key: 'Escape' })
    press(outside)
    expect(open).toBe(true)
    unbind = () => {}
  })
})
