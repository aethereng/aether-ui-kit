import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import Tooltip from '../Tooltip.vue'

/* A tap on a touch screen opens a tooltip whose trigger is not a control, and a second tap closes it. A
 * tap outside, or Escape, closes it too. Fine-pointer hover and keyboard focus are held by
 * Tooltip.focus.dom.test.ts and are not repeated here. A real tap is, in order: pointerenter,
 * pointerdown, pointerup, pointerleave, click; `press` sends exactly that, so a test that leaves out
 * the pointerleave cannot pass for a reason a phone would not share. */

const WORDS = 'Utilisation 0.92 at member 14'

const mountTip = (delay = 400, slot = '<span data-t tabindex="0">Utilisation 0.92</span>') =>
  mount(Tooltip, { props: { text: WORDS, delay }, slots: { default: slot }, attachTo: document.body })

type W = ReturnType<typeof mountTip>
const isOpen = (w: W) => w.get('[role="tooltip"]').classes().includes('is-open')
const anchor = (w: W) => w.get('.aether-tooltip__anchor')

/* The whole of one press by a pointer of `type`, ending in the click a tap or a mouse click makes. */
async function press(w: W, target: Element, type: 'touch' | 'mouse' | 'pen', opts: { cancel?: boolean } = {}) {
  const a = anchor(w)
  await a.trigger('pointerenter', { pointerType: type })
  const t = { pointerType: type }
  target.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), t))
  if (opts.cancel) {
    target.dispatchEvent(Object.assign(new Event('pointercancel', { bubbles: true }), t))
    await a.trigger('pointerleave', t)
    await w.vm.$nextTick()
    return
  }
  target.dispatchEvent(Object.assign(new Event('pointerup', { bubbles: true }), t))
  await a.trigger('pointerleave', t)
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await w.vm.$nextTick()
}
const label = (w: W) => w.get('[data-t]').element

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('a tap opens a tooltip and a second tap closes it', () => {
  it('a tap on a label opens the tip at once, without the hover dwell', async () => {
    const w = mountTip(400)
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('a second tap closes it', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(true)
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a third tap opens it again', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    await press(w, label(w), 'touch')
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('the pointer leaving as the finger lifts does not close the tip it just opened', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    await anchor(w).trigger('pointerleave', { pointerType: 'touch' })
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('a touch pointer resting on the trigger opens nothing, however long (there is no hover on a finger)', async () => {
    const w = mountTip(5)
    await anchor(w).trigger('pointerenter', { pointerType: 'touch' })
    await new Promise((r) => setTimeout(r, 30))
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })
})

describe('a tap outside, or Escape, closes a tooltip a tap opened', () => {
  it('a press anywhere outside closes it', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    document.body.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' }))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a press that stops its own propagation still closes it, because the document hears in the capture phase', async () => {
    const w = mountTip()
    const other = document.createElement('div')
    other.addEventListener('pointerdown', (e) => e.stopPropagation())
    document.body.append(other)
    await press(w, label(w), 'touch')
    other.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' }))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('Escape closes it, wherever focus is', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('negative arm: another key leaves it open', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('negative arm: a press on the trigger itself is not outside', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    label(w).dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' }))
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('every document listener it added is gone after it closes and after it is unmounted while open', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const mine = (calls: unknown[][]) => calls.filter((c) => c[0] === 'pointerdown' || c[0] === 'keydown').length
    const w = mountTip()
    await press(w, label(w), 'touch')
    expect(mine(add.mock.calls)).toBe(2)
    await press(w, label(w), 'touch')
    const removedAfterClose = mine(remove.mock.calls)
    expect(removedAfterClose).toBeGreaterThanOrEqual(2)
    await press(w, label(w), 'touch')
    w.unmount()
    // opened twice, so two pairs were added; each pair has been removed at least once
    expect(mine(add.mock.calls)).toBe(4)
    expect(mine(remove.mock.calls)).toBeGreaterThanOrEqual(4)
  })
})

describe('what a tap does not open', () => {
  it('a press the browser takes over for a scroll opens nothing', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch', { cancel: true })
    label(w).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a click with no touch press before it (a keyboard or assistive activation) opens nothing', async () => {
    const w = mountTip()
    label(w).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a mouse click on the label toggles nothing: a mouse has hover', async () => {
    const w = mountTip()
    await press(w, label(w), 'mouse')
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a pen is a hovering pointer: its press toggles nothing, and its hover still opens after the dwell', async () => {
    const w = mountTip(5)
    await press(w, label(w), 'pen')
    expect(isOpen(w)).toBe(false)
    await anchor(w).trigger('pointerenter', { pointerType: 'pen' })
    await new Promise((r) => setTimeout(r, 30))
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('a disabled tooltip opens nothing on a tap, and leaves no listeners to close', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const w = mount(Tooltip, {
      props: { text: WORDS, disabled: true },
      slots: { default: '<span data-t tabindex="0">label</span>' },
      attachTo: document.body,
    })
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(false)
    expect(add.mock.calls.filter((c) => c[0] === 'pointerdown' || c[0] === 'keydown').length).toBe(0)
    w.unmount()
  })
})

describe('a tap on a trigger that is a control runs the control and opens nothing', () => {
  const mountButton = (onAct: () => void) =>
    mount(Tooltip, {
      props: { text: WORDS },
      slots: { default: () => h('button', { 'data-t': '', onClick: onAct }, [h('svg', { 'data-icon': '' }), 'Fit view']) },
      attachTo: document.body,
    })

  it('the button runs its own action, once, and the tip stays shut', async () => {
    const act = vi.fn()
    const w = mountButton(act)
    await press(w, label(w), 'touch')
    expect(act).toHaveBeenCalledTimes(1)
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a tap on an icon inside the button is a tap on the button', async () => {
    const act = vi.fn()
    const w = mountButton(act)
    await press(w, w.get('[data-icon]').element, 'touch')
    expect(act).toHaveBeenCalledTimes(1)
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a link is a control too', async () => {
    const w = mount(Tooltip, {
      props: { text: WORDS },
      slots: { default: '<a data-t href="#x">see</a>' },
      attachTo: document.body,
    })
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('positive arm beside them: a span with a tabindex is not a control, and the same press opens it', async () => {
    const w = mountTip()
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('a tap on a control closes a tip that show() had opened', async () => {
    const w = mountButton(() => {})
    ;(w.vm as unknown as { show: () => void }).show()
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(true)
    await press(w, label(w), 'touch')
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })
})

describe('show() and hide(), for a control that speaks after its own action', () => {
  it('show opens the tip and hide closes it', async () => {
    const w = mountTip()
    const vm = w.vm as unknown as { show: () => void; hide: () => void }
    vm.show()
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(true)
    vm.hide()
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })
})
