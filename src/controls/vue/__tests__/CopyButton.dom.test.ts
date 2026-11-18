import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CopyButton from '../CopyButton.vue'

/* A press copies the words and the control says how it went, for 1.5 s: Copied with a check, or Not copied
 * with a cross where the write is refused or the page has no clipboard. Never silent: the outcome is in the
 * accessible name, in a status region, and, after a tap, in the tooltip. */

const WORDS = 'Utilisation 0.92 at member 14'
const LABEL = 'Copy the words'

const mountCopy = (attrs: Record<string, unknown> = {}) =>
  mount(CopyButton, { props: { words: WORDS, label: LABEL }, attrs, attachTo: document.body })
type W = ReturnType<typeof mountCopy>

const button = (w: W) => w.get('button')
const status = (w: W) => w.get('[role="status"]').text()
const tip = (w: W) => w.get('[role="tooltip"]')
const isOpen = (w: W) => tip(w).classes().includes('is-open')
const iconPath = (w: W) => w.get('svg').html()

function setClipboard(writeText: ((s: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true })
}

/* A tap: the press carries pointerType touch, then the click it ends in. */
async function tap(w: W) {
  const el = button(w).element
  el.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' }))
  el.dispatchEvent(Object.assign(new Event('pointerup', { bubbles: true }), { pointerType: 'touch' }))
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  setClipboard(undefined)
})

describe('at rest', () => {
  it('is one icon-only button named by its label, with nothing in the status region', () => {
    setClipboard(async () => {})
    const w = mountCopy()
    expect(button(w).attributes('aria-label')).toBe(LABEL)
    expect(button(w).text()).toBe('')
    expect(tip(w).text()).toBe(LABEL)
    expect(status(w)).toBe('')
    w.unmount()
  })

  it('passes the caller attributes to the button, so a call site can mark it', () => {
    setClipboard(async () => {})
    const w = mountCopy({ 'data-copy-words': '', class: 'mine' })
    expect(button(w).attributes('data-copy-words')).toBeDefined()
    expect(button(w).classes()).toContain('mine')
    w.unmount()
  })
})

describe('a press that the clipboard takes', () => {
  it('writes the words, says Copied in name, tooltip and status, and turns the icon to a check', async () => {
    const write = vi.fn(async () => {})
    setClipboard(write)
    const w = mountCopy()
    const rest = iconPath(w)
    await button(w).trigger('click')
    await flushPromises()
    expect(write).toHaveBeenCalledExactlyOnceWith(WORDS)
    expect(button(w).attributes('aria-label')).toBe('Copied')
    expect(tip(w).text()).toBe('Copied')
    expect(status(w)).toBe('Copied')
    expect(iconPath(w)).not.toBe(rest)
    expect(button(w).classes()).toContain('aether-copy--done')
    w.unmount()
  })

  it('returns to rest after 1.5 s, and not before', async () => {
    setClipboard(async () => {})
    const w = mountCopy()
    const rest = iconPath(w)
    await button(w).trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1499)
    expect(status(w)).toBe('Copied')
    await vi.advanceTimersByTimeAsync(2)
    expect(button(w).attributes('aria-label')).toBe(LABEL)
    expect(status(w)).toBe('')
    expect(iconPath(w)).toBe(rest)
    w.unmount()
  })
})

describe('a press that the clipboard does not take is never silent', () => {
  it('a refused write says Not copied, with a cross, for 1.5 s', async () => {
    setClipboard(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })
    const w = mountCopy()
    const rest = iconPath(w)
    await button(w).trigger('click')
    await flushPromises()
    expect(button(w).attributes('aria-label')).toBe('Not copied')
    expect(tip(w).text()).toBe('Not copied')
    expect(status(w)).toBe('Not copied')
    expect(iconPath(w)).not.toBe(rest)
    expect(button(w).classes()).toContain('aether-copy--refused')
    expect(button(w).classes()).not.toContain('aether-copy--done')
    await vi.advanceTimersByTimeAsync(1501)
    expect(button(w).attributes('aria-label')).toBe(LABEL)
    w.unmount()
  })

  it('a page with no clipboard says Not copied too', async () => {
    setClipboard(undefined)
    const w = mountCopy()
    await button(w).trigger('click')
    await flushPromises()
    expect(status(w)).toBe('Not copied')
    w.unmount()
  })

  it('the check and the cross are different drawings', async () => {
    setClipboard(async () => {})
    const a = mountCopy()
    await button(a).trigger('click')
    await flushPromises()
    const check = iconPath(a)
    a.unmount()
    setClipboard(undefined)
    const b = mountCopy()
    await button(b).trigger('click')
    await flushPromises()
    expect(iconPath(b)).not.toBe(check)
    b.unmount()
  })

  it('a second press within the 1.5 s restarts it, so the timer of the first does not cut the second short', async () => {
    setClipboard(async () => {})
    const w = mountCopy()
    await button(w).trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)
    await button(w).trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)
    expect(status(w)).toBe('Copied')
    await vi.advanceTimersByTimeAsync(600)
    expect(status(w)).toBe('')
    w.unmount()
  })

  it('unmounting during the 1.5 s leaves no timer behind', async () => {
    setClipboard(async () => {})
    const w = mountCopy()
    await button(w).trigger('click')
    await flushPromises()
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('after a tap the tooltip says how it went', () => {
  it('a tap opens the tooltip with Copied, and closes it when the outcome ends', async () => {
    setClipboard(async () => {})
    const w = mountCopy()
    await tap(w)
    expect(isOpen(w)).toBe(true)
    expect(tip(w).text()).toBe('Copied')
    await vi.advanceTimersByTimeAsync(1501)
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a tap opens the tooltip with Not copied where the write is refused', async () => {
    setClipboard(undefined)
    const w = mountCopy()
    await tap(w)
    expect(isOpen(w)).toBe(true)
    expect(tip(w).text()).toBe('Not copied')
    w.unmount()
  })

  it('a mouse press opens it too, because the press closed it as it landed, and leaves it to the pointer to close', async () => {
    setClipboard(async () => {})
    const w = mountCopy()
    const el = button(w).element
    el.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'mouse' }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(isOpen(w)).toBe(true)
    expect(tip(w).text()).toBe('Copied')
    await vi.advanceTimersByTimeAsync(1501)
    expect(isOpen(w)).toBe(true)
    expect(tip(w).text()).toBe(LABEL)
    w.unmount()
  })

  it('negative arm: a keyboard press (a click with no pointerdown) opens no tooltip of its own; focus does', async () => {
    setClipboard(async () => {})
    const w = mountCopy()
    await button(w).trigger('click')
    await flushPromises()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a click after a tap, by the keyboard, is not taken for a tap', async () => {
    setClipboard(async () => {})
    const w = mountCopy()
    await tap(w)
    await vi.advanceTimersByTimeAsync(1501)
    expect(isOpen(w)).toBe(false)
    await button(w).trigger('click')
    await flushPromises()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })
})
