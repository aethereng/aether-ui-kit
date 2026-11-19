import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import DateField from '../DateField.vue'
import SearchField from '../SearchField.vue'
import Transport from '../Transport.vue'
import ChatPanel from '../ChatPanel.vue'
import { declared, stylesOf } from '../../../__tests__/sfcRules'

/* DateField, SearchField, Transport and ChatPanel take a `disabled` prop. Disabled reads as the kit's other
 * disabled controls do (dimmed by the one opacity Switch declares), cannot be focused, and sends nothing.
 *
 * "Cannot be focused" is asserted of EVERY input, button and textarea the component draws, found by what
 * they are and not by a list typed here, so a control added later without the attribute fails. A live one
 * is read the same way, so the assertion cannot be met by a component that disables everything always.
 * disabled.dom.test.ts pins the opacity against Switch's own sheet. */

afterEach(() => {
  document.body.innerHTML = ''
})

const FORM_PARTS = 'input, button, textarea, select'
const partsOf = (w: VueWrapper): HTMLElement[] => Array.from(w.element.querySelectorAll<HTMLElement>(FORM_PARTS))
const reference = parseFloat(declared(stylesOf('controls/vue/Switch.vue'), '.aether-switch:disabled')['opacity']!)

function opacityOf(el: Element): number {
  const raw = getComputedStyle(el).opacity
  return raw === '' ? 1 : parseFloat(raw)
}

describe('DateField: disabled', () => {
  stylesOf('controls/vue/DateField.vue')
  const mountDate = (disabled: boolean) => mount(DateField, { props: { modelValue: '2026-08-18', disabled }, attachTo: document.body })

  it('disables the date input and the picker button, and a live one disables neither', () => {
    const live = mountDate(false)
    const off = mountDate(true)
    expect(partsOf(live).length, 'precondition: the input and the trigger').toBe(2)
    expect(partsOf(live).filter((p) => p.matches(':disabled'))).toEqual([])
    expect(partsOf(off).filter((p) => !p.matches(':disabled'))).toEqual([])
  })

  it('is dimmed as the other disabled controls are, on the box a reader sees', () => {
    const live = mountDate(false)
    const off = mountDate(true)
    expect(reference, 'precondition: the reference dims').toBeLessThan(1)
    expect(opacityOf(live.element)).toBe(1)
    expect(opacityOf(off.element)).toBe(reference)
  })

  it('cannot be focused, and the picker does not open from its button', async () => {
    const off = mountDate(true)
    for (const part of partsOf(off)) {
      part.focus()
      expect(document.activeElement, part.className).not.toBe(part)
    }
    ;(off.get('.aether-datefield__trigger').element as HTMLElement).click()
    await nextTick()
    expect(off.find('[role="dialog"]').exists()).toBe(false)
  })

  it('opens from its button when live, which is what the disabled one is compared against', async () => {
    const live = mountDate(false)
    await live.get('.aether-datefield__trigger').trigger('click')
    expect(live.find('[role="dialog"]').exists()).toBe(true)
  })

  it('closes a picker that is open when it turns disabled', async () => {
    const w = mountDate(false)
    await w.get('.aether-datefield__trigger').trigger('click')
    expect(w.find('[role="dialog"]').exists(), 'precondition: open').toBe(true)
    await w.setProps({ disabled: true })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('SearchField: disabled', () => {
  stylesOf('controls/vue/SearchField.vue')
  const mountSearch = (disabled: boolean) => mount(SearchField, { props: { modelValue: 'beam', disabled }, attachTo: document.body })

  it('disables the input and the clear button, and a live one disables neither', () => {
    const live = mountSearch(false)
    const off = mountSearch(true)
    expect(partsOf(live).length, 'precondition: the input and the clear button').toBe(2)
    expect(partsOf(live).filter((p) => p.matches(':disabled'))).toEqual([])
    expect(partsOf(off).filter((p) => !p.matches(':disabled'))).toEqual([])
  })

  it('is dimmed as the other disabled controls are, and a live one is not', () => {
    expect(opacityOf(mountSearch(false).element)).toBe(1)
    expect(opacityOf(mountSearch(true).element)).toBe(reference)
  })

  it('cannot be focused or cleared', () => {
    const off = mountSearch(true)
    for (const part of partsOf(off)) {
      part.focus()
      expect(document.activeElement, part.tagName).not.toBe(part)
    }
    ;(off.get('.aether-search__clear').element as HTMLElement).click()
    expect(off.emitted('update:modelValue')).toBeUndefined()
    expect(off.emitted('clear')).toBeUndefined()
  })

  it('clears when live, which is what the disabled one is compared against', () => {
    const live = mountSearch(false)
    ;(live.get('.aether-search__clear').element as HTMLElement).click()
    expect(live.emitted('update:modelValue')![0]).toEqual([''])
    expect(live.emitted('clear')).toHaveLength(1)
  })
})

describe('Transport: disabled', () => {
  stylesOf('controls/vue/Transport.vue')
  const base = { current: 5, duration: 20, playing: false }

  it.each([
    ['cycle', 'play'],
    ['presets', 'play'],
    ['cycle', 'precompute'],
  ] as const)('disables every control with speedMode %s in phase %s, and a live one disables none', (speedMode, phase) => {
    const live = mount(Transport, { props: { ...base, speedMode, phase }, attachTo: document.body })
    const off = mount(Transport, { props: { ...base, speedMode, phase, disabled: true }, attachTo: document.body })
    expect(partsOf(live).length, 'precondition: it draws controls').toBeGreaterThan(0)
    expect(partsOf(live).filter((p) => p.matches(':disabled'))).toEqual([])
    expect(partsOf(off).filter((p) => !p.matches(':disabled'))).toEqual([])
    expect(partsOf(off).length).toBe(partsOf(live).length)
  })

  it('is dimmed once, as the other disabled controls are, and a live one is not', () => {
    const live = mount(Transport, { props: base, attachTo: document.body })
    const off = mount(Transport, { props: { ...base, disabled: true }, attachTo: document.body })
    expect(opacityOf(live.element)).toBe(1)
    expect(opacityOf(off.element)).toBe(reference)
    for (const part of partsOf(off)) expect(opacityOf(part), 'a control inside the dimmed bar is not dimmed again').toBe(1)
  })

  it('cannot be focused, and sends nothing from its buttons', () => {
    const off = mount(Transport, { props: { ...base, disabled: true }, attachTo: document.body })
    for (const part of partsOf(off)) {
      part.focus()
      expect(document.activeElement, part.className).not.toBe(part)
      part.click()
    }
    expect(Object.keys(off.emitted())).toEqual([])
  })

  it('still ends a drag it was in when it turns disabled, so the caller is not left paused', async () => {
    const w = mount(Transport, { props: { ...base, playing: true }, attachTo: document.body })
    await w.get('input[type="range"]').trigger('pointerdown')
    expect(w.emitted('scrub-start'), 'precondition: the drag began').toHaveLength(1)
    await w.setProps({ disabled: true })
    window.dispatchEvent(new Event('pointerup'))
    expect(w.emitted('scrub-end')).toHaveLength(1)
  })
})

describe('ChatPanel: disabled', () => {
  stylesOf('controls/vue/ChatPanel.vue')
  const mountPanel = (disabled: boolean) =>
    mount(ChatPanel, { props: { messages: [{ role: 'you', text: 'hello' }], modelValue: 'draft', disabled }, attachTo: document.body })

  it('disables the compose box and the three buttons, and a live one disables none', () => {
    const live = mountPanel(false)
    const off = mountPanel(true)
    expect(partsOf(live).length, 'precondition: a box and three buttons').toBe(4)
    expect(partsOf(live).filter((p) => p.matches(':disabled'))).toEqual([])
    expect(partsOf(off).filter((p) => !p.matches(':disabled'))).toEqual([])
  })

  it('dims the compose box as the other disabled controls are, and a live one is not dimmed', () => {
    const live = mountPanel(false)
    const off = mountPanel(true)
    expect(opacityOf(live.get('textarea').element)).toBe(1)
    expect(opacityOf(off.get('textarea').element)).toBe(reference)
    expect(opacityOf(off.element), 'the log is left readable and is not dimmed').toBe(1)
  })

  it('cannot be focused, and sends nothing from its buttons', () => {
    const off = mountPanel(true)
    for (const part of partsOf(off)) {
      part.focus()
      expect(document.activeElement, part.tagName).not.toBe(part)
      part.click()
    }
    expect(off.emitted('queue')).toBeUndefined()
    expect(off.emitted('send')).toBeUndefined()
    expect(off.emitted('apply-reply')).toBeUndefined()
  })

  it('sends from its buttons when live, which is what the disabled one is compared against', () => {
    const live = mountPanel(false)
    partsOf(live)
      .filter((p) => p.tagName === 'BUTTON')
      .forEach((b) => b.click())
    expect(live.emitted('queue')).toHaveLength(1)
    expect(live.emitted('send')).toHaveLength(1)
    expect(live.emitted('apply-reply')).toHaveLength(1)
  })
})
