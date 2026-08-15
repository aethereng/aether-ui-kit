import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PropertyEditor from '../PropertyEditor.vue'
import type { FieldDescriptor, FieldValues } from '../../core/types'

/* Covers the two affordances added for a consumer that mapped its whole form surface against this
 * component: a swatch beside a label, and a range field. The range's no-rounding behaviour is the
 * one worth pinning — it is the exact way the library this replaces gets it wrong. */

function mountEditor(fields: FieldDescriptor[], values: FieldValues) {
  return mount(PropertyEditor, {
    props: { fields, modelValue: values },
    attachTo: document.body,
  })
}

describe('PropertyEditor — label swatch', () => {
  const fields: FieldDescriptor[] = [
    { key: 'supports', type: 'boolean', label: 'Supports', swatch: 'background:#c33' },
    { key: 'plain', type: 'boolean', label: 'Plain' },
  ]

  it('renders the caller’s declaration list verbatim, and only where given', () => {
    const w = mountEditor(fields, { supports: true, plain: false })
    const sw = w.findAll('.aether-property-editor__swatch')
    expect(sw).toHaveLength(1)
    // The kit renders the declaration; it never parses or interprets it.
    expect(sw[0]!.attributes('style')).toContain('rgb(204, 51, 51)')
    w.unmount()
  })

  it('keeps the swatch out of the accessible name', () => {
    /* The swatch repeats the encoding of the thing the field controls. Announced, it would make a
     * screen reader read the same fact twice in two vocabularies. */
    const w = mountEditor(fields, { supports: true, plain: false })
    const sw = w.get('.aether-property-editor__swatch')
    expect(sw.attributes('aria-hidden')).toBe('true')
    expect(sw.text()).toBe('')
    expect(w.get('label').text()).toBe('Supports')
    w.unmount()
  })
})

describe('PropertyEditor — range', () => {
  const fields: FieldDescriptor[] = [
    { key: 'opacity', type: 'range', label: 'Opacity', min: 0, max: 1, step: 0.05, suffix: '×' },
  ]

  it('renders a native range carrying min, max and step', () => {
    const w = mountEditor(fields, { opacity: 0.5 })
    const input = w.get('input[type="range"]')
    expect(input.attributes()).toMatchObject({ min: '0', max: '1', step: '0.05' })
    w.unmount()
  })

  it('does NOT write a corrected value back for a value off the step grid', () => {
    /* THE test. 0.37 is not on a 0.05 grid, so the native thumb sits at the nearest valid stop —
     * and a component that read `.value` back on render would silently rewrite the caller's data
     * to 0.35 for a field the user never touched. That is the documented failure of the slider
     * this replaces. Mounting alone must emit nothing. */
    const w = mountEditor(fields, { opacity: 0.37 })
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('change')).toBeUndefined()
    w.unmount()
  })

  it('shows the STORED value in the read-out, not the thumb position', () => {
    // Otherwise the number on screen and the number in the model disagree with nothing to say so.
    const w = mountEditor(fields, { opacity: 0.37 })
    expect(w.get('output').text()).toContain('0.37')
    w.unmount()
  })

  it('emits once the user actually drags', async () => {
    const w = mountEditor(fields, { opacity: 0.5 })
    const input = w.get('input[type="range"]')
    ;(input.element as HTMLInputElement).value = '0.65'
    await input.trigger('input')
    expect(w.emitted('change')![0]).toEqual(['opacity', 0.65])
    w.unmount()
  })

  it('renders the suffix beside the read-out', () => {
    const w = mountEditor(fields, { opacity: 0.5 })
    expect(w.get('output').text()).toContain('×')
    w.unmount()
  })

  it('is a different control from number, not a restyled one', () => {
    // Same data, different interaction: a caller picking `range` must not get a spinner.
    const w = mountEditor(fields, { opacity: 0.5 })
    expect(w.find('input[type="number"]').exists()).toBe(false)
    expect(w.find('input[type="range"]').exists()).toBe(true)
    w.unmount()
  })
})
