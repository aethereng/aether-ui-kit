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
