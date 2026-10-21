import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
