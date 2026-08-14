import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Seg from '../Seg.vue'
import type { SegOption } from '../../core/types'

/* Two things here that no type-check catches and that fail silently in a browser: a no-selection
 * Seg that quietly marks something active anyway, and the emit ORDER, which is a documented
 * behaviour some consumers depend on and which a well-meaning refactor would happily swap. */

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  mounted.forEach((w) => w.unmount())
  mounted.length = 0
})

const opts: SegOption<'a' | 'b' | 'c'>[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C', disabled: true },
]

function mountSeg(modelValue: 'a' | 'b' | 'c' | null) {
  const w = mount(Seg, { props: { options: opts, modelValue } })
  mounted.push(w)
  return w
}

describe('Seg — no-selection state', () => {
  it('marks NOTHING active when modelValue is null', () => {
    const w = mountSeg(null)
    expect(w.findAll('button.on')).toHaveLength(0)
    // aria must agree with the class, or a screen reader reports a selection that is not there
    expect(w.findAll('button[aria-selected="true"]')).toHaveLength(0)
  })

  it('still renders every option, so the choices remain reachable from nothing-selected', () => {
    expect(mountSeg(null).findAll('button')).toHaveLength(3)
  })

  it('selecting from null emits a real value, never null', async () => {
    const w = mountSeg(null)
    await w.findAll('button')[0]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['a']])
  })

  it('marks exactly one active once a value is set', () => {
    const w = mountSeg('b')
    const on = w.findAll('button.on')
    expect(on).toHaveLength(1)
    expect(on[0]!.text()).toBe('B')
  })
})

describe('Seg — emit contract', () => {
  /* Pinned deliberately. Both events fire on every selection and `update:modelValue` is FIRST;
     `change` carries the same value for non-v-model callers. Reordering is a silent behavioural
     change for existing consumers, so this test exists to make that impossible to do by
     accident -- if it fails, the reorder was intentional and needs its own decision. */
  it('emits update:modelValue BEFORE change, both with the same value', async () => {
    const order: string[] = []
    const w = mount(Seg, {
      props: {
        options: opts,
        modelValue: 'a' as const,
        'onUpdate:modelValue': () => order.push('update:modelValue'),
        onChange: () => order.push('change'),
      },
    })
    mounted.push(w)

    await w.findAll('button')[1]!.trigger('click')

    expect(order).toEqual(['update:modelValue', 'change'])
    expect(w.emitted('update:modelValue')).toEqual([['b']])
    expect(w.emitted('change')).toEqual([['b']])
  })

  it('emits nothing when the already-active option is clicked', async () => {
    const w = mountSeg('a')
    await w.findAll('button')[0]!.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('change')).toBeUndefined()
  })

  it('emits nothing for a disabled option', async () => {
    const w = mountSeg('a')
    await w.findAll('button')[2]!.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
