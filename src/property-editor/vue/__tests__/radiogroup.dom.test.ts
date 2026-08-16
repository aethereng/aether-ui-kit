import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PropertyEditor from '../PropertyEditor.vue'
import type { FieldDescriptor, FieldValues } from '../../core/types'

/* The enum button group is the last field type PropertyEditor still renders itself, and it shipped
 * as a bare <div> of <button>s with an `on` class — a single-choice control that never said so.
 * These pin what it says and how it is operated, because neither is visible on screen: the group
 * LOOKED correct the whole time it was announcing three unrelated buttons. */

const fields: FieldDescriptor[] = [
  {
    key: 'kind',
    type: 'enum',
    label: 'Kind',
    variant: 'buttons',
    options: [
      { value: 'fact', label: 'Fact' },
      { value: 'idea', label: 'Idea' },
      { value: 'risk', label: 'Risk' },
    ],
  },
]
const values: FieldValues = { kind: 'idea' }

function mountEditor(v: FieldValues = values) {
  return mount(PropertyEditor, { props: { fields, modelValue: v }, attachTo: document.body })
}

describe('the enum button group is a radiogroup', () => {
  it('announces itself as one, and names itself', () => {
    const w = mountEditor()
    const g = w.get('[role="radiogroup"]')
    expect(g.attributes('aria-label')).toBe('Kind')
    expect(w.findAll('[role="radio"]')).toHaveLength(3)
    w.unmount()
  })

  it('says WHICH option is chosen, not merely styles it', () => {
    /* `class="on"` is invisible to assistive tech. Without aria-checked a screen reader reads
     * three buttons and never says one of three is selected. */
    const w = mountEditor()
    const checked = w.findAll('[role="radio"]').filter((b) => b.attributes('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0]!.text()).toBe('Idea')
    w.unmount()
  })

  it('is ONE tab stop, not one per option', () => {
    // The defect a keyboard user actually felt: three stops through a single control.
    const w = mountEditor()
    const tabbable = w.findAll('[role="radio"]').filter((b) => b.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.text()).toBe('Idea')
    w.unmount()
  })

  it('stays reachable when nothing is chosen yet', () => {
    /* With no match there is no checked option to carry tabindex 0, and a group nobody can tab
     * into is worse than one that starts at the top. */
    const w = mountEditor({ kind: '' })
    const tabbable = w.findAll('[role="radio"]').filter((b) => b.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.text()).toBe('Fact')
    w.unmount()
  })

  it('arrows move AND select, which is the radio pattern', async () => {
    /* Different from the menu's model, where movement and commit are separate: in a radiogroup the
     * focused option IS the chosen one, so arrowing emits. */
    const w = mountEditor()
    await w.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('change')![0]).toEqual(['kind', 'risk'])
    w.unmount()
  })

  it('wraps in both directions', async () => {
    const w = mountEditor({ kind: 'risk' })
    await w.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('change')![0]).toEqual(['kind', 'fact'])
    w.unmount()

    const w2 = mountEditor({ kind: 'fact' })
    await w2.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w2.emitted('change')![0]).toEqual(['kind', 'risk'])
    w2.unmount()
  })

  it('Home and End reach the ends', async () => {
    const w = mountEditor()
    await w.get('[role="radiogroup"]').trigger('keydown', { key: 'End' })
    expect(w.emitted('change')![0]).toEqual(['kind', 'risk'])
    w.unmount()

    const w2 = mountEditor()
    await w2.get('[role="radiogroup"]').trigger('keydown', { key: 'Home' })
    expect(w2.emitted('change')![0]).toEqual(['kind', 'fact'])
    w2.unmount()
  })

  it('ignores keys it has no opinion about, so the page still scrolls', async () => {
    const w = mountEditor()
    await w.get('[role="radiogroup"]').trigger('keydown', { key: 'PageDown' })
    expect(w.emitted('change')).toBeUndefined()
    w.unmount()
  })

  it('recovers when the stored value matches no option', async () => {
    // ArrowRight from "not found" (-1) must land on the first option rather than index 0 twice.
    const w = mountEditor({ kind: 'gone' })
    await w.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('change')![0]).toEqual(['kind', 'fact'])
    w.unmount()
  })
})
