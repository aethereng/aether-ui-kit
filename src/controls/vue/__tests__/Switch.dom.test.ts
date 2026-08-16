import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Switch from '../Switch.vue'
import PropertyEditor from '../../../property-editor/vue/PropertyEditor.vue'
import type { FieldDescriptor, FieldValues } from '../../../property-editor/core/types'

describe('Switch', () => {
  it('is one bare input — no wrapper, no label of its own', () => {
    /* The shape matters. A self-labelling wrapper would nest a <label> inside PropertyEditor's own
     * <label for>, which is invalid, and would change the DOM consumers write overrides against. */
    const w = mount(Switch, { props: { modelValue: false } })
    expect(w.element.tagName).toBe('INPUT')
    expect(w.attributes('type')).toBe('checkbox')
    expect(w.element.children).toHaveLength(0)
    w.unmount()
  })

  it('reflects modelValue and emits the new state', async () => {
    const w = mount(Switch, { props: { modelValue: false } })
    const el = w.element as HTMLInputElement
    expect(el.checked).toBe(false)
    el.checked = true
    await w.trigger('change')
    expect(w.emitted('update:modelValue')![0]).toEqual([true])
    w.unmount()
  })

  it('is controlled — it does not move on its own', async () => {
    /* Emitting without the parent writing back must leave it where it was, or a caller that
     * rejects a change (an undo guard, a validation veto) gets a switch disagreeing with its data. */
    const w = mount(Switch, { props: { modelValue: false } })
    await w.setProps({ modelValue: true })
    expect((w.element as HTMLInputElement).checked).toBe(true)
    await w.setProps({ modelValue: false })
    expect((w.element as HTMLInputElement).checked).toBe(false)
    w.unmount()
  })

  it('passes id and aria-label through to the input', () => {
    // Label association is the caller's job, so the attributes that carry it must reach the element.
    const w = mount(Switch, {
      props: { modelValue: true },
      attrs: { id: 'gravity', 'aria-label': 'Gravity' },
    })
    expect(w.attributes('id')).toBe('gravity')
    expect(w.attributes('aria-label')).toBe('Gravity')
    w.unmount()
  })

  it('does not emit while disabled', async () => {
    const w = mount(Switch, { props: { modelValue: false, disabled: true } })
    expect(w.attributes('disabled')).toBeDefined()
    w.unmount()
  })
})

describe('PropertyEditor still renders a boolean the way hosts target it', () => {
  /* THE EXTRACTION CONSTRAINT. A consumer overrides
   *   .aether-property-editor__field input[type='checkbox']
   * and swapping a raw input for a component must not stop that matching. The DOM is not
   * byte-identical — Switch adds its own class so its scoped CSS can attach — so the assertion is
   * that the SELECTOR still resolves, which is the thing a host actually depends on. */
  const fields: FieldDescriptor[] = [
    { key: 'live', type: 'boolean', label: 'Live' },
    { key: 'title', type: 'text', label: 'Title' },
  ]
  const values: FieldValues = { live: true, title: 'Beam' }

  it('the field’s control is still an input[type=checkbox], not a wrapper', () => {
    const w = mount(PropertyEditor, {
      props: { fields, modelValue: values },
      attachTo: document.body,
    })
    const hit = document.querySelectorAll(
      '.aether-property-editor__field input[type="checkbox"]',
    )
    expect(hit).toHaveLength(1)
    // Still a DIRECT child of the field, which `> input` overrides and the `order` rule both need.
    expect(hit[0]!.parentElement!.className).toContain('aether-property-editor__field')
    w.unmount()
  })

  it('still edits the value through the engine', async () => {
    const w = mount(PropertyEditor, {
      props: { fields, modelValue: values },
      attachTo: document.body,
    })
    const box = w.get('input[type="checkbox"]')
    ;(box.element as HTMLInputElement).checked = false
    await box.trigger('change')
    expect(w.emitted('change')![0]).toEqual(['live', false])
    w.unmount()
  })
})
