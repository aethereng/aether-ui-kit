import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import Tooltip from '../Tooltip.vue'

/* A tip opens on keyboard focus only. jsdom answers :focus-visible as true for any focused element,
 * so keyboard focus is an element's focus() here. The focus that must open nothing (a pointer, or a
 * script returning focus after a Dialog closes) is simulated by answering false for that selector. */

const mountTip = () =>
  mount(Tooltip, {
    props: { text: 'Start a new conversation', delay: 0 },
    slots: { default: '<button>New conversation</button>' },
    attachTo: document.body,
  })

const trigger = (w: ReturnType<typeof mountTip>) => w.get('button').element as HTMLButtonElement
const isOpen = (w: ReturnType<typeof mountTip>) => w.get('[role="tooltip"]').classes().includes('is-open')

/* Not keyboard-visible: :focus-visible is false for this element; every other selector is unchanged. */
const notKeyboardVisible = (el: Element) => {
  vi.spyOn(el, 'matches').mockImplementation((sel: string) => sel !== ':focus-visible' && Element.prototype.matches.call(el, sel))
}

describe('a tip opens on keyboard focus only', () => {
  it('keyboard focus on the trigger opens the tip', async () => {
    const w = mountTip()
    trigger(w).focus()
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('negative arm: focus that is not keyboard-visible opens nothing, as after a press or a Dialog returns focus', async () => {
    const w = mountTip()
    notKeyboardVisible(trigger(w))
    trigger(w).focus()
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('a press on the trigger closes a tip that keyboard focus opened', async () => {
    const w = mountTip()
    trigger(w).focus()
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(true)
    await w.get('span').trigger('pointerdown')
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('Escape still dismisses a tip that keyboard focus opened', async () => {
    const w = mountTip()
    trigger(w).focus()
    await w.vm.$nextTick()
    await w.get('span').trigger('keydown', { key: 'Escape' })
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('leaving the trigger by focus still closes the tip', async () => {
    const w = mountTip()
    trigger(w).focus()
    await w.vm.$nextTick()
    trigger(w).blur()
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })
})

/* A trigger the test can remove, disable or sit beside from outside, as a parent's v-if, :disabled or
 * a sibling would. The slot is a function, so its reactive reads are tracked by the tooltip's render. */
const mountControlled = () => {
  const present = ref(true)
  const off = ref(false)
  const extra = ref(false)
  const w = mount(Tooltip, {
    props: { text: 'Start a new conversation', delay: 0 },
    slots: {
      default: () => [
        present.value ? h('button', { disabled: off.value }, 'New conversation') : null,
        extra.value ? h('i', 'extra') : null,
      ],
    },
    attachTo: document.body,
  })
  return { w, present, off, extra }
}

/* jsdom's :focus-visible follows the keystrokes of earlier tests (an Escape in one test changes what a
 * script focus answers in the next), so a test that needs keyboard focus says so instead of inheriting it. */
const keyboardFocus = (el: HTMLElement) => {
  vi.spyOn(el, 'matches').mockImplementation((sel: string) => sel === ':focus-visible' || Element.prototype.matches.call(el, sel))
  el.focus()
}

describe('a keyboard-opened tip closes when its trigger goes away while focused', () => {
  it('closes when the trigger is removed while it holds focus', async () => {
    const { w, present } = mountControlled()
    keyboardFocus(trigger(w))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(true)
    present.value = false
    await flushPromises()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('closes when the trigger is disabled while it holds focus', async () => {
    const { w, off } = mountControlled()
    keyboardFocus(trigger(w))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(true)
    off.value = true
    await flushPromises()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })

  it('positive arm: keeps the tip while focus stays on the trigger and a sibling changes', async () => {
    const { w, extra } = mountControlled()
    keyboardFocus(trigger(w))
    await w.vm.$nextTick()
    expect(isOpen(w)).toBe(true)
    extra.value = true
    await flushPromises()
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })

  it('negative arm: a pointer-opened tip is not closed by a change to its trigger while focus is elsewhere', async () => {
    const { w, extra } = mountControlled()
    await w.get('span').trigger('pointerenter')
    await new Promise((r) => setTimeout(r, 5))
    expect(isOpen(w)).toBe(true)
    extra.value = true
    await flushPromises()
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })
})
