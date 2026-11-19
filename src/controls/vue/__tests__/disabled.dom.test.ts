import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Select from '../Select.vue'
import NumberField from '../NumberField.vue'
import TextField from '../TextField.vue'
import { declared, stylesOf } from '../../../__tests__/sfcRules'

/* A control that cannot be used has to read so at a glance. Select's :disabled rule once set only the
 * cursor and NumberField had none, so both looked live; the suite never saw it because jsdom applies
 * none of a component's own CSS, and a class on the element says nothing about what is drawn. These
 * tests load each component's stylesheet and read the COMPUTED opacity.
 *
 * The dimming is pinned against the controls that already dim, read from their own sheets, and not
 * against a number typed here, so a change of the kit's disabled opacity moves all of them or fails. */

const OPTIONS = [
  { value: 'h2o', label: 'Water' },
  { value: 'dcm', label: 'Dichloromethane', disabled: true },
]

/* [file, selector] of each control that dims by opacity and takes a disabled prop. */
const DIMMERS: Array<[string, string]> = [
  ['controls/vue/Switch.vue', '.aether-switch:disabled'],
  ['controls/vue/Checkbox.vue', '.aether-checkbox:disabled'],
  ['controls/vue/Disclosure.vue', '.aether-disclosure__toggle:disabled'],
  ['controls/vue/RadioGroup.vue', '.aether-radiogroup button:disabled'],
  ['controls/vue/DateField.vue', '.aether-datefield--disabled'],
  ['controls/vue/SearchField.vue', '.aether-search--disabled'],
  ['controls/vue/Transport.vue', '.aether-transport--disabled'],
  ['controls/vue/ChatPanel.vue', '.aether-chat__compose textarea:disabled'],
]

function opacityOf(el: Element): number {
  const raw = getComputedStyle(el).opacity
  return raw === '' ? 1 : parseFloat(raw)
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the opacity the kit gives a disabled control', () => {
  it.each(DIMMERS)('is one value across %s and the others', (file, selector) => {
    const reference = declared(stylesOf('controls/vue/Switch.vue'), '.aether-switch:disabled')['opacity']
    expect(declared(stylesOf(file), selector)['opacity']).toBe(reference)
  })
})

describe('Select: disabled', () => {
  const sheet = stylesOf('controls/vue/Select.vue')
  const dimmed = parseFloat(declared(stylesOf('controls/vue/Switch.vue'), '.aether-switch:disabled')['opacity']!)

  it('is dimmed as the other disabled controls are, and a live one is not', () => {
    const live = mount(Select, { props: { modelValue: 'h2o', options: OPTIONS }, attachTo: document.body })
    const off = mount(Select, { props: { modelValue: 'h2o', options: OPTIONS, disabled: true }, attachTo: document.body })
    expect(off.element.matches(':disabled'), 'precondition: the browser calls it disabled').toBe(true)
    expect(live.element.matches(':disabled'), 'precondition: the live one is not').toBe(false)
    expect(dimmed, 'precondition: the reference dims').toBeLessThan(1)
    expect(opacityOf(live.element)).toBe(1)
    expect(opacityOf(off.element)).toBe(dimmed)
    expect(getComputedStyle(off.element).cursor).toBe('default')
  })

  it('keeps the ink and the box it has when live, so the dimming is the only change', () => {
    const live = mount(Select, { props: { modelValue: 'h2o', options: OPTIONS }, attachTo: document.body })
    const off = mount(Select, { props: { modelValue: 'h2o', options: OPTIONS, disabled: true }, attachTo: document.body })
    for (const prop of ['color', 'backgroundColor', 'borderTopColor'] as const) {
      expect(getComputedStyle(off.element)[prop], prop).toBe(getComputedStyle(live.element)[prop])
    }
  })

  describe('inside @supports (appearance: base-select), where its rows are drawn by the kit', () => {
    const block = Array.from(sheet.cssRules).find(
      (r): r is CSSGroupingRule => 'conditionText' in r && String((r as CSSConditionRule).conditionText).includes('base-select'),
    )
    const rows = (): CSSStyleRule[] => Array.from(block!.cssRules).filter((r): r is CSSStyleRule => 'selectorText' in r)
    const listing = (selector: string): CSSStyleRule[] =>
      rows().filter((r) => r.selectorText.split(',').some((s) => s.trim() === selector))

    it('is there to be read', () => {
      expect(block, 'the @supports block is found in the sheet').toBeDefined()
      expect(rows().length).toBeGreaterThan(5)
    })

    it('gives a disabled row the ink Menu gives a row it cannot run', () => {
      const menu = declared(stylesOf('controls/vue/Menu.vue'), '.aether-menu__item:disabled')['color']
      const own = listing('.aether-select option:disabled').map((r) => r.style.getPropertyValue('color'))
      expect(menu, 'precondition: Menu dims its disabled row by ink').toBe('var(--aether-faint)')
      expect(own).toEqual([menu])
    })

    it('lights a row under the pointer or the keyboard only when it can be chosen', () => {
      // The bare selectors are what lit a disabled row; neither may come back.
      expect(listing('.aether-select option:hover')).toEqual([])
      expect(listing('.aether-select option:focus')).toEqual([])
      for (const state of ['hover', 'focus']) {
        const lit = listing(`.aether-select option:${state}:not(:disabled)`)
        expect(lit, state).toHaveLength(1)
        expect(lit[0]!.style.getPropertyValue('background')).toBe('var(--aether-cool-wash)')
      }
    })
  })
})

describe('TextField: disabled', () => {
  stylesOf('controls/vue/TextField.vue')
  const dimmed = parseFloat(declared(stylesOf('controls/vue/Switch.vue'), '.aether-switch:disabled')['opacity']!)

  it.each([false, true])('is dimmed as the other disabled controls are, multiline %s, and a live one is not', (multiline) => {
    const live = mount(TextField, { props: { modelValue: 'Batch A-14', multiline }, attachTo: document.body })
    const off = mount(TextField, { props: { modelValue: 'Batch A-14', multiline, disabled: true }, attachTo: document.body })
    expect(off.element.matches(':disabled'), 'precondition: the browser calls it disabled').toBe(true)
    expect(live.element.matches(':disabled'), 'precondition: the live one is not').toBe(false)
    expect(opacityOf(live.element)).toBe(1)
    expect(opacityOf(off.element)).toBe(dimmed)
  })

  it('keeps the ink of a live one: the value is dimmed with the box and not greyed to the ink of a placeholder', () => {
    const live = mount(TextField, { props: { modelValue: 'Batch A-14' }, attachTo: document.body })
    const off = mount(TextField, { props: { modelValue: 'Batch A-14', disabled: true }, attachTo: document.body })
    expect(getComputedStyle(off.element).color).toBe(getComputedStyle(live.element).color)
  })
})

describe('NumberField: disabled', () => {
  stylesOf('controls/vue/NumberField.vue')
  const dimmed = parseFloat(declared(stylesOf('controls/vue/Switch.vue'), '.aether-switch:disabled')['opacity']!)

  it('is dimmed as the other disabled controls are, and a live one is not', () => {
    const live = mount(NumberField, { props: { modelValue: 5 }, attachTo: document.body })
    const off = mount(NumberField, { props: { modelValue: 5, disabled: true }, attachTo: document.body })
    expect(off.get('input').element.matches(':disabled'), 'precondition: the input is disabled').toBe(true)
    expect(live.get('input').element.matches(':disabled'), 'precondition: the live one is not').toBe(false)
    expect(opacityOf(live.element)).toBe(1)
    expect(opacityOf(off.element)).toBe(dimmed)
  })

  it('dims the box a reader sees, which is the wrapper and not the input inside it', () => {
    const off = mount(NumberField, { props: { modelValue: 5, disabled: true, suffix: 'L/min' }, attachTo: document.body })
    expect(opacityOf(off.get('input').element), 'the input alone does not dim, or the dimming would apply twice').toBe(1)
    expect(opacityOf(off.element)).toBeLessThan(1)
    expect(off.element.contains(off.get('.aether-numberfield__suffix').element), 'the unit is inside the dimmed box').toBe(true)
  })
})
