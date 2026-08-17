import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TextField from '../TextField.vue'
import NumberField from '../NumberField.vue'
import Select from '../Select.vue'
import SearchField from '../SearchField.vue'
import type { SelectGroup, SelectOption } from '../../core/types'

/* The v0.13.0 extractions gained standalone components and no standalone tests: the suite reached
 * them only through PropertyEditor, by native selectors, so nothing pinned their own contracts.
 * What is tested here is what each one PROMISES that a plain input does not. */

describe('TextField', () => {
  it('commits every keystroke — that is the whole difference from NumberField', async () => {
    const w = mount(TextField, { props: { modelValue: '' } })
    const el = w.get('input')
    ;(el.element as HTMLInputElement).value = 'Bea'
    await el.trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual(['Bea'])
    w.unmount()
  })

  it('is a textarea when multiline, and an input otherwise — a prop, not a component', () => {
    const single = mount(TextField, { props: { modelValue: 'x' } })
    expect(single.element.tagName).toBe('INPUT')
    single.unmount()

    const multi = mount(TextField, { props: { modelValue: 'x', multiline: true, rows: 4 } })
    expect(multi.element.tagName).toBe('TEXTAREA')
    expect(multi.attributes('rows')).toBe('4')
    multi.unmount()
  })

  it('ignores rows when it is not multiline', () => {
    const w = mount(TextField, { props: { modelValue: 'x', rows: 9 } })
    expect(w.attributes('rows')).toBeUndefined()
    w.unmount()
  })

  it('is a single root element, so id and aria-label reach the control', () => {
    const w = mount(TextField, {
      props: { modelValue: '' },
      attrs: { id: 'note', 'aria-label': 'Note' },
    })
    expect(w.attributes('id')).toBe('note')
    expect(w.attributes('aria-label')).toBe('Note')
    w.unmount()
  })
})

describe('NumberField', () => {
  it('does NOT commit a half-typed number', async () => {
    /* The reason it is its own component. "1." is unparseable, and a field that committed it would
     * write 1 and make 1.5 unreachable. jsdom does not set badInput itself, so it is forced here —
     * the branch under test is what the component does WITH that signal. */
    const w = mount(NumberField, { props: { modelValue: 1 } })
    const el = w.get('input').element as HTMLInputElement
    Object.defineProperty(el, 'validity', { value: { badInput: true }, configurable: true })
    el.value = ''
    await w.get('input').trigger('input')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('commits a genuinely emptied field as undefined', async () => {
    /* The other side of the same signal: an empty value with badInput false is a real clear, and a
     * caller needs to be able to tell "no value" from "mid-typing". */
    const w = mount(NumberField, { props: { modelValue: 5 } })
    const el = w.get('input').element as HTMLInputElement
    Object.defineProperty(el, 'validity', { value: { badInput: false }, configurable: true })
    el.value = ''
    await w.get('input').trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual([undefined])
    w.unmount()
  })

  it('commits a complete number', async () => {
    const w = mount(NumberField, { props: { modelValue: 1 } })
    const el = w.get('input').element as HTMLInputElement
    Object.defineProperty(el, 'validity', { value: { badInput: false }, configurable: true })
    el.value = '1.5'
    await w.get('input').trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual([1.5])
    w.unmount()
  })

  it('puts the unit INSIDE the box, as a sibling of the input', () => {
    /* A bordered input with a span next to it reads as two controls. The border is on the wrapper
     * precisely so the suffix sits inside it. */
    const w = mount(NumberField, { props: { modelValue: 5, suffix: 'mm' } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.get('.aether-numberfield__suffix').text()).toBe('mm')
    w.unmount()
  })

  it('derives step from precision when step is absent', () => {
    const w = mount(NumberField, { props: { modelValue: 1, precision: 2 } })
    expect((w.get('input').element as HTMLInputElement).step).toBe('0.01')
    w.unmount()
  })
})

describe('Select', () => {
  const options: SelectOption[] = [
    { value: 'none', label: 'None' },
    { value: 'disp', label: 'Displacement' },
  ]
  const groups: SelectGroup[] = [
    {
      label: 'Shell resultants',
      options: [{ value: 'n11', label: 'N11' }],
    },
    {
      label: 'ULS combinations',
      options: [{ value: 'c1', label: 'ULS-1', subtitle: '1.35·G + 1.5·Q' }],
    },
  ]

  it('renders groups as real optgroups, not rows that look like headings', () => {
    /* Grouping is structure: flattened, a load case and a combination become indistinguishable,
     * which in a structural model is a correctness problem rather than a cosmetic one. */
    const w = mount(Select, { props: { modelValue: 'none', options, groups } })
    const gs = w.findAll('optgroup')
    expect(gs.map((g) => g.attributes('label'))).toEqual(['Shell resultants', 'ULS combinations'])
    // flat options stay outside the groups
    expect(w.element.querySelectorAll(':scope > option')).toHaveLength(2)
    w.unmount()
  })

  it('carries a subtitle into the row rather than dropping it', () => {
    const w = mount(Select, { props: { modelValue: 'none', groups } })
    expect(w.findAll('optgroup')[1]!.find('option').text()).toContain('1.35·G + 1.5·Q')
    w.unmount()
  })

  it('reflects modelValue and emits the chosen value', async () => {
    const w = mount(Select, { props: { modelValue: 'none', options } })
    const el = w.element as HTMLSelectElement
    expect(el.value).toBe('none')
    el.value = 'disp'
    await w.trigger('change')
    expect(w.emitted('update:modelValue')![0]).toEqual(['disp'])
    w.unmount()
  })

  it('is the select itself, so id and aria-label reach it', () => {
    const w = mount(Select, {
      props: { modelValue: 'none', options },
      attrs: { id: 'field', 'aria-label': 'Colour field' },
    })
    expect(w.element.tagName).toBe('SELECT')
    expect(w.attributes('id')).toBe('field')
    expect(w.attributes('aria-label')).toBe('Colour field')
    w.unmount()
  })
})

describe('SearchField', () => {
  it('names itself from the placeholder when given no explicit label', () => {
    const w = mount(SearchField, { props: { modelValue: '', placeholder: 'filter by id' } })
    expect(w.get('input').attributes('aria-label')).toBe('filter by id')
    w.unmount()
  })

  it('clears the value and says so, then hands focus back', async () => {
    /* Clearing is almost always followed by retyping, so focus returning to the field is part of
     * the contract rather than a nicety. */
    const w = mount(SearchField, { props: { modelValue: 'beam' }, attachTo: document.body })
    await w.get('.aether-search__clear').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([''])
    expect(w.emitted('clear')).toHaveLength(1)
    expect(document.activeElement).toBe(w.get('input').element)
    w.unmount()
  })

  it('marks itself empty vs non-empty, which is what shows the clear button', async () => {
    const w = mount(SearchField, { props: { modelValue: '' } })
    expect(w.classes()).not.toContain('has')
    await w.setProps({ modelValue: 'x' })
    expect(w.classes()).toContain('has')
    w.unmount()
  })

  it('exposes focus(), so a host shortcut need not reach into the DOM', () => {
    const w = mount(SearchField, { props: { modelValue: '' }, attachTo: document.body })
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(w.get('input').element)
    w.unmount()
  })
})
