import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RadioGroup from '../RadioGroup.vue'
import PropertyEditor from '../../../property-editor/vue/PropertyEditor.vue'
import type { RadioOption } from '../../core/types'
import type { FieldDescriptor, FieldValues } from '../../../property-editor/core/types'

/* These pin what the group SAYS and how it is operated, because neither is visible on screen: it
 * shipped as a bare <div> of <button>s with an `on` class and LOOKED correct the whole time it was
 * announcing three unrelated buttons.
 *
 * They target the standalone control now. They were written against PropertyEditor because that
 * was the only way to reach the group at all, and kept pointing there after RadioGroup was
 * extracted — so the suite was exercising the composition and calling it a test of the control.
 * The composition still gets a check at the bottom; it is one case, not the subject. */

const options: RadioOption[] = [
  { value: 'fact', label: 'Fact' },
  { value: 'idea', label: 'Idea' },
  { value: 'risk', label: 'Risk' },
]

const mountGroup = (modelValue = 'idea', opts: RadioOption[] = options) =>
  mount(RadioGroup, { props: { options: opts, modelValue, ariaLabel: 'Kind' }, attachTo: document.body })

const picked = (w: ReturnType<typeof mountGroup>) => w.emitted('update:modelValue')?.[0]

describe('RadioGroup says what it is', () => {
  it('announces itself as a radiogroup, and names itself', () => {
    const w = mountGroup()
    expect(w.attributes('role')).toBe('radiogroup')
    expect(w.attributes('aria-label')).toBe('Kind')
    expect(w.findAll('[role="radio"]')).toHaveLength(3)
    w.unmount()
  })

  it('says WHICH option is chosen, not merely styles it', () => {
    /* `class="on"` is invisible to assistive tech. Without aria-checked a screen reader reads three
     * buttons and never says one of three is selected. */
    const w = mountGroup()
    const checked = w.findAll('[role="radio"]').filter((b) => b.attributes('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0]!.text()).toBe('Idea')
    w.unmount()
  })

  it('is ONE tab stop, not one per option', () => {
    // The defect a keyboard user actually felt: three stops through a single control.
    const w = mountGroup()
    const tabbable = w.findAll('[role="radio"]').filter((b) => b.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.text()).toBe('Idea')
    w.unmount()
  })

  it('stays reachable when nothing is chosen yet', () => {
    /* With no match there is no checked option to carry tabindex 0, and a group nobody can tab into
     * is worse than one that starts at the top. */
    const w = mountGroup('')
    const tabbable = w.findAll('[role="radio"]').filter((b) => b.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.text()).toBe('Fact')
    w.unmount()
  })
})

describe('RadioGroup keyboard — arrows move AND select', () => {
  it('emits on arrow, which is the radio pattern', async () => {
    /* Different from the menu's model, where movement and commit are separate: in a radiogroup the
     * focused option IS the chosen one, so arrowing emits. */
    const w = mountGroup()
    await w.trigger('keydown', { key: 'ArrowRight' })
    expect(picked(w)).toEqual(['risk'])
    w.unmount()
  })

  it('wraps in both directions', async () => {
    const w = mountGroup('risk')
    await w.trigger('keydown', { key: 'ArrowRight' })
    expect(picked(w)).toEqual(['fact'])
    w.unmount()

    const w2 = mountGroup('fact')
    await w2.trigger('keydown', { key: 'ArrowLeft' })
    expect(picked(w2)).toEqual(['risk'])
    w2.unmount()
  })

  it('Home and End reach the ends', async () => {
    const w = mountGroup()
    await w.trigger('keydown', { key: 'End' })
    expect(picked(w)).toEqual(['risk'])
    w.unmount()

    const w2 = mountGroup()
    await w2.trigger('keydown', { key: 'Home' })
    expect(picked(w2)).toEqual(['fact'])
    w2.unmount()
  })

  it('ignores keys it has no opinion about, so the page still scrolls', async () => {
    const w = mountGroup()
    await w.trigger('keydown', { key: 'PageDown' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('recovers when the stored value matches no option', async () => {
    // ArrowRight from "not found" (-1) must land on the first option rather than index 0 twice.
    const w = mountGroup('gone')
    await w.trigger('keydown', { key: 'ArrowRight' })
    expect(picked(w)).toEqual(['fact'])
    w.unmount()
  })
})

describe('RadioGroup and disabled options', () => {
  const withDisabled: RadioOption[] = [
    { value: 'fact', label: 'Fact' },
    { value: 'idea', label: 'Idea', disabled: true },
    { value: 'risk', label: 'Risk' },
  ]

  it('arrows SKIP a disabled option rather than landing on it', async () => {
    /* Focus must never park on something that refuses to be chosen — the user would arrow onto it
     * and nothing would happen. */
    const w = mountGroup('fact', withDisabled)
    await w.trigger('keydown', { key: 'ArrowRight' })
    expect(picked(w)).toEqual(['risk'])
    w.unmount()
  })

  it('End lands on the last ENABLED option', async () => {
    const w = mountGroup('fact', [...withDisabled, { value: 'x', label: 'X', disabled: true }])
    await w.trigger('keydown', { key: 'End' })
    expect(picked(w)).toEqual(['risk'])
    w.unmount()
  })

  it('does not emit when a disabled option is clicked', async () => {
    const w = mountGroup('fact', withDisabled)
    await w.findAll('[role="radio"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('emits nothing at all when every option is disabled', async () => {
    const w = mountGroup('a', [{ value: 'a', label: 'A', disabled: true }])
    await w.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})

describe('RadioGroup is controlled, and emits once', () => {
  it('does not re-emit when the already-chosen option is clicked', async () => {
    const w = mountGroup('idea')
    await w.findAll('[role="radio"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('does not move on its own — the prop decides', async () => {
    const w = mountGroup('fact')
    await w.trigger('keydown', { key: 'ArrowRight' })
    // it asked to change, but nothing wrote back, so it must still show `fact`
    expect(w.findAll('[role="radio"]')[0]!.attributes('aria-checked')).toBe('true')
    await w.setProps({ modelValue: 'risk' })
    expect(w.findAll('[role="radio"]')[2]!.attributes('aria-checked')).toBe('true')
    w.unmount()
  })

  it('emits ONE event', async () => {
    /* Pinned so a second, redundant emit cannot be added back for symmetry with something else.
     * Seg carried one for a while and it was removed; this is the shape the kit settled on. */
    const w = mountGroup()
    await w.trigger('keydown', { key: 'End' })
    expect(w.emitted('update:modelValue')).toHaveLength(1)
    expect(w.emitted('change')).toBeUndefined()
    w.unmount()
  })
})

describe('PropertyEditor composes it', () => {
  /* One case, not the subject: the form dispatches an enum/buttons field to this control and wires
   * the value back through the engine. Everything about how the group behaves is above. */
  const fields: FieldDescriptor[] = [
    { key: 'kind', type: 'enum', label: 'Kind', variant: 'buttons', options },
  ]
  const values: FieldValues = { kind: 'idea' }

  it('renders the control, named by the field label, and commits through the engine', async () => {
    const w = mount(PropertyEditor, { props: { fields, modelValue: values }, attachTo: document.body })
    const group = w.get('.aether-radiogroup')
    expect(group.attributes('role')).toBe('radiogroup')
    expect(group.attributes('aria-label')).toBe('Kind')

    await group.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('change')![0]).toEqual(['kind', 'risk'])
    w.unmount()
  })
})
