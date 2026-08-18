import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Chip from '../Chip.vue'
import type { ChipOption } from '../../core/types'

/* Chip had no test file. Badge's suite mentions it only to explain why a Badge is not a Chip, so
 * the control that carries every filter rail in both apps was going untested — which is how the
 * missing aria-pressed below survived. */

describe('Chip says which chips are on', () => {
  /* The on-state used to be `class="on"` and nothing else, so a chip group was visibly a set of
   * toggles and audibly a row of plain buttons — a screen reader read every label and never said
   * which were active. Exactly the defect RadioGroup carries a test for.
   *
   * `aria-pressed` rather than aria-checked: a chip is a toggle BUTTON and several can be on at
   * once (modelValue is a Set); aria-checked belongs to radio/checkbox roles this group does not use. */
  const opts: ChipOption[] = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C' },
  ]
  const pressed = (w: ReturnType<typeof mount>) =>
    w.findAll('button').map((b) => b.attributes('aria-pressed'))

  it('marks every chip pressed or not, never absent', () => {
    const w = mount(Chip, { props: { options: opts, modelValue: new Set(['a', 'c']) } })
    expect(pressed(w)).toEqual(['true', 'false', 'true'])
    w.unmount()
  })

  it('works for the single-value form too', () => {
    const w = mount(Chip, { props: { options: opts, modelValue: 'b' } })
    expect(pressed(w)).toEqual(['false', 'true', 'false'])
    w.unmount()
  })

  it('tracks the model rather than the click', () => {
    /* Controlled, like the rest of the kit: the caller owns modelValue, so the announced state must
     * follow the prop and not a click the caller may not have honoured. */
    const w = mount(Chip, { props: { options: opts, modelValue: new Set<string>() } })
    expect(pressed(w)).toEqual(['false', 'false', 'false'])
    w.setProps({ modelValue: new Set(['b']) })
    return w.vm.$nextTick().then(() => {
      expect(pressed(w)).toEqual(['false', 'true', 'false'])
      w.unmount()
    })
  })
})

describe('Chip renders what an option carries', () => {
  /* ChipOption has seven optional fields and none of them was exercised. They are not decoration:
   * `swatch` is what lets a set of chips replace a legend rather than sit beside one, and `muted`
   * is what keeps an empty facet visible and still clickable. */
  it('shows a count when one is given, and nothing when not', () => {
    const w = mount(Chip, {
      props: { options: [{ value: 'a', label: 'A', count: 12 }, { value: 'b', label: 'B' }], modelValue: 'a' },
    })
    const btns = w.findAll('button')
    expect(btns[0]!.find('.n').text()).toBe('12')
    expect(btns[1]!.find('.n').exists()).toBe(false)
    w.unmount()
  })

  it('count 0 still renders — an empty facet is a fact, not a missing one', () => {
    /* `v-if="opt.count !== undefined"` rather than a truthiness check. A filter reading "Risk"
     * with no number beside it says something different from "Risk 0". */
    const w = mount(Chip, { props: { options: [{ value: 'a', label: 'A', count: 0 }], modelValue: 'a' } })
    expect(w.find('.n').text()).toBe('0')
    w.unmount()
  })

  it('draws a swatch OR a dot, and swatch wins', () => {
    const dot = mount(Chip, { props: { options: [{ value: 'a', label: 'A', dotColor: '#c33' }], modelValue: '' } })
    expect(dot.find('.dot').exists()).toBe(true)
    expect(dot.find('.sw').exists()).toBe(false)
    dot.unmount()

    const both = mount(Chip, {
      props: { options: [{ value: 'a', label: 'A', dotColor: '#c33', swatch: 'background:#0f0' }], modelValue: '' },
    })
    expect(both.find('.sw').exists()).toBe(true)
    expect(both.find('.dot').exists()).toBe(false) // documented precedence, not an accident
    both.unmount()
  })

  it('carries `muted` as a class and `title` as a tooltip', () => {
    const w = mount(Chip, {
      props: { options: [{ value: 'a', label: 'A', muted: true, title: 'nothing matches' }], modelValue: '' },
    })
    const b = w.find('button')
    expect(b.classes()).toContain('muted')
    expect(b.attributes('title')).toBe('nothing matches')
    w.unmount()
  })

  it('names the group for screen readers when asked', () => {
    const w = mount(Chip, { props: { options: [{ value: 'a', label: 'A' }], modelValue: '', ariaLabel: 'Kind' } })
    expect(w.attributes('aria-label')).toBe('Kind')
    w.unmount()
  })
})

describe('Chip variants', () => {
  /* `variant` is the interaction-neutral axis: a filter bar of pills and a sidebar rail of rows are
   * the same control in two shapes. It was declared on the component and MISSING from ChipProps,
   * which index.ts tells consumers to type against — so it is pinned here on both. */
  it('defaults to pill and applies the variant to group and chips', () => {
    const p = mount(Chip, { props: { options: [{ value: 'a', label: 'A' }], modelValue: '' } })
    expect(p.classes()).toContain('aether-chips--pill')
    expect(p.find('button').classes()).toContain('aether-chip--pill')
    p.unmount()

    const r = mount(Chip, { props: { options: [{ value: 'a', label: 'A' }], modelValue: '', variant: 'row' } })
    expect(r.classes()).toContain('aether-chips--row')
    expect(r.find('button').classes()).toContain('aether-chip--row')
    r.unmount()
  })
})

describe('Chip reports, and never decides', () => {
  const opts: ChipOption[] = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B', disabled: true },
  ]

  it('emits the value and leaves the Set to the caller', () => {
    /* The whole contract: Chip is controlled. It emits `toggle` and does NOT mutate modelValue, so
     * a caller that ignores the event sees no change — which is what makes a filter rail's state
     * live in one place. */
    const w = mount(Chip, { props: { options: opts, modelValue: new Set<string>() } })
    w.findAll('button')[0]!.trigger('click')
    expect(w.emitted('toggle')![0]).toEqual(['a'])
    expect(w.findAll('button')[0]!.attributes('aria-pressed')).toBe('false') // unchanged: caller decides
    w.unmount()
  })

  it('a disabled chip is inert — no emit, and the attribute is real', () => {
    const w = mount(Chip, { props: { options: opts, modelValue: '' } })
    const b = w.findAll('button')[1]!
    expect(b.attributes('disabled')).toBeDefined()
    b.trigger('click')
    expect(w.emitted('toggle')).toBeUndefined()
    w.unmount()
  })
})
