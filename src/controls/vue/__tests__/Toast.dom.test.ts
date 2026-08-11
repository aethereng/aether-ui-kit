import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Toast from '../Toast.vue'

/* Toast owns exactly two things: a timer, and the two-frame dance that makes the CSS
 * transition actually run. Both are the kind of thing that silently half-works -- a toast
 * that appears but never leaves, or leaves but never faded in, still "renders correctly" in
 * any snapshot. These tests drive the timer directly and assert the class flip, because that
 * class is the only thing the animation depends on. */

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  mounted.forEach((w) => w.unmount())
  mounted.length = 0
  vi.useRealTimers()
})
beforeEach(() => {
  vi.useFakeTimers()
  // the component defers the `on` class to a rAF so the transition has two states to move
  // between; under fake timers rAF must run synchronously or nothing ever becomes visible
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
})

function mountToast(modelValue = '', extra: Record<string, unknown> = {}) {
  const w = mount(Toast, { props: { modelValue, ...extra }, attachTo: document.body })
  mounted.push(w)
  return w
}

describe('Toast visibility is driven entirely by the message', () => {
  it('renders nothing at all for an empty message', () => {
    const w = mountToast('')
    expect(w.find('.aether-toast').exists()).toBe(false)
  })

  it('renders the message when one arrives', async () => {
    const w = mountToast('')
    await w.setProps({ modelValue: 'Path copied' })
    const el = w.find('.aether-toast')
    expect(el.exists()).toBe(true)
    expect(el.text()).toBe('Path copied')
  })

  it('shows immediately when mounted with a message already set', () => {
    const w = mountToast('Queued')
    expect(w.find('.aether-toast').text()).toBe('Queued')
  })
})

describe('Toast fade: the `on` class must flip, or the CSS transition never runs', () => {
  it('adds `on` after the deferred frame, not in the same tick it appears', async () => {
    const w = mountToast('')
    await w.setProps({ modelValue: 'Saved' })
    // rAF is stubbed synchronous, so by now `on` should be set
    expect(w.find('.aether-toast').classes()).toContain('on')
  })

  it('re-triggers the fade for a REPLACEMENT message, not just the first', async () => {
    const w = mountToast('')
    await w.setProps({ modelValue: 'First' })
    expect(w.find('.aether-toast').classes()).toContain('on')
    // a second message while the first is still up must restart the animation, which means
    // `on` has to go false and back to true rather than simply staying true
    await w.setProps({ modelValue: 'Second' })
    expect(w.find('.aether-toast').text()).toBe('Second')
    expect(w.find('.aether-toast').classes()).toContain('on')
  })
})

describe('Toast dismissal', () => {
  it('emits an empty modelValue after the default 1700ms, and not before', async () => {
    const w = mountToast('')
    await w.setProps({ modelValue: 'Copied' })
    vi.advanceTimersByTime(1699)
    expect(w.emitted('update:modelValue')).toBeUndefined()
    vi.advanceTimersByTime(2)
    expect(w.emitted('update:modelValue')![0]).toEqual([''])
  })

  it('honours a custom duration', async () => {
    const w = mountToast('', { duration: 500 })
    await w.setProps({ modelValue: 'Quick' })
    vi.advanceTimersByTime(499)
    expect(w.emitted('update:modelValue')).toBeUndefined()
    vi.advanceTimersByTime(2)
    expect(w.emitted('update:modelValue')![0]).toEqual([''])
  })

  it('restarts the clock on a replacement message rather than letting the first one expire it', async () => {
    const w = mountToast('')
    await w.setProps({ modelValue: 'First' })
    vi.advanceTimersByTime(1200)
    await w.setProps({ modelValue: 'Second' })
    // the first message's remaining 500ms must NOT dismiss the second
    vi.advanceTimersByTime(1200)
    expect(w.emitted('update:modelValue')).toBeUndefined()
    vi.advanceTimersByTime(600)
    expect(w.emitted('update:modelValue')![0]).toEqual([''])
  })

  it('hides when the caller clears the message itself, without waiting for the timer', async () => {
    const w = mountToast('')
    await w.setProps({ modelValue: 'Manual' })
    await w.setProps({ modelValue: '' })
    expect(w.find('.aether-toast').exists()).toBe(false)
  })

  it('does not emit after unmount -- a pending timer would fire into a dead component', async () => {
    const w = mountToast('')
    await w.setProps({ modelValue: 'Bye' })
    w.unmount()
    mounted.length = 0
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('Toast accessibility and layering', () => {
  it('announces politely without stealing focus', async () => {
    const w = mountToast('Done')
    const el = w.find('.aether-toast')
    expect(el.attributes('role')).toBe('status')
    expect(el.attributes('aria-live')).toBe('polite')
    expect(el.attributes('tabindex')).toBeUndefined()
  })

  it('renders a plain non-interactive element -- it floats over live surfaces', async () => {
    const w = mountToast('Done')
    // no buttons, no links: nothing inside can be clicked or tabbed to
    expect(w.find('.aether-toast').element.querySelectorAll('button, a, input').length).toBe(0)
  })
})
