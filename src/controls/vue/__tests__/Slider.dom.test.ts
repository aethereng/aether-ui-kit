import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Slider from '../Slider.vue'
import type { SliderTick } from '../../core/types'

/* Slider changed more than anything else in the kit this week — it took over its own track and
 * thumb, gained ticks and an aria-valuetext — and had no test at all. Two of the cases below are
 * regressions that shipped and were caught only by looking at a running browser, which is exactly
 * the kind of thing a test should be holding instead. */

const readoutOf = (w: ReturnType<typeof mount>) => w.get('.aether-slider__readout').element.textContent!

describe('Slider read-out', () => {
  it('prints the FORMATTED value, not the stored one', () => {
    /* The whole reason `format` exists: the stored number is a 0-100 position and the read-out is a
       mapped factor. Printing the position would be the wrong quantity, not merely ugly. */
    const w = mount(Slider, {
      props: { modelValue: 25, format: (p: number) => `×${(p / 25).toFixed(1)}` },
    })
    expect(readoutOf(w)).toContain('×1.0')
    expect(readoutOf(w)).not.toContain('25')
    w.unmount()
  })

  it('separates the suffix with a NON-BREAKING space', () => {
    /* THE REGRESSION. The template had a literal space leading the suffix span, which the compiler's
       default `whitespace: "condense"` strips — so every consumer rendered "521m". A plain-space
       assertion would pass on the broken version too, so this pins the code point. */
    const w = mount(Slider, { props: { modelValue: 521, min: 0, max: 800, suffix: 'm' } })
    const text = readoutOf(w)
    expect(text).toBe('521 m')
    expect(text).not.toBe('521m')
    expect(text.includes(' ')).toBe(true)
    w.unmount()
  })

  it('omits the suffix span entirely when there is no unit', () => {
    const w = mount(Slider, { props: { modelValue: 6 } })
    expect(readoutOf(w)).toBe('6')
    expect(w.find('.aether-slider__readout span').exists()).toBe(false)
    w.unmount()
  })
})

describe('Slider announces what it shows', () => {
  it('sets aria-valuetext from format, so a screen reader says "×1.0" and not "25"', () => {
    const w = mount(Slider, {
      props: { modelValue: 25, format: (p: number) => `×${(p / 25).toFixed(1)}` },
    })
    expect(w.get('input').attributes('aria-valuetext')).toBe('×1.0')
    w.unmount()
  })

  it('includes the unit in the announcement', () => {
    const w = mount(Slider, { props: { modelValue: 521, max: 800, suffix: 'm' } })
    expect(w.get('input').attributes('aria-valuetext')).toBe('521 m')
    w.unmount()
  })

  it('leaves aria-valuetext OFF when there is nothing to correct', () => {
    /* An ordinary slider should keep the platform's own announcement rather than a stringified copy
       of the number the platform already reads. */
    const w = mount(Slider, { props: { modelValue: 40 } })
    expect(w.get('input').attributes('aria-valuetext')).toBeUndefined()
    w.unmount()
  })
})

describe('Slider ticks', () => {
  const ticks: SliderTick[] = [{ value: 25, label: '×1' }]

  it('gives each tick its own --at, independent of the slider’s', () => {
    /* Half of the tick-position contract: every mark carries the fraction of ITS OWN value, which
       is the input the CSS calc consumes. The other half — that the calc actually reads it — is
       pinned in the source assertion below, because it cannot be observed here; see there. */
    const w = mount(Slider, { props: { modelValue: 50, ticks } })
    const root = w.element as HTMLElement
    const tick = w.get('.aether-slider__tick').element as HTMLElement
    expect(root.style.getPropertyValue('--at')).toBe('0.5')
    expect(tick.style.getPropertyValue('--at')).toBe('0.25')
    w.unmount()
  })

  it('declares --pos on the tick itself, not once on the parent', () => {
    /* THE REGRESSION, and it is asserted against the SOURCE because nothing else can see it.
       `--pos` was first declared once on `.aether-slider`, and a custom property referencing
       another is substituted where it is DECLARED — so the parent baked in its own --at and every
       tick inherited a finished number, painting every mark under the thumb. The mounted DOM is
       identical either way (each tick's inline --at is correct in both), and jsdom neither applies
       an SFC's scoped styles nor resolves calc() against layout, so a rendered assertion passes on
       the broken version. Verified: reintroducing the bug leaves all the DOM cases green.

       Same technique package-contract.test.ts uses to pin the switch's box model — the invariant is
       a CSS declaration, so the test reads CSS. */
    const src = readFileSync(resolve(__dirname, '../Slider.vue'), 'utf8')
    const decl = src.match(/^([^\n]*(?:,\n[^\n]*)*)\{\s*\n\s*--pos:/m)
    expect(decl, '--pos is not declared anywhere in Slider.vue').not.toBeNull()
    expect(decl![1], '--pos must be declared on the tick, or ticks inherit the thumb’s position')
      .toContain('.aether-slider__tick')
  })

  it('renders no tick strip at all when there are none', () => {
    // Existing consumers must keep the single-row layout they had before ticks existed.
    const w = mount(Slider, { props: { modelValue: 50 } })
    expect(w.find('.aether-slider__ticks').exists()).toBe(false)
    w.unmount()
  })

  it('renders a label only when the tick carries one', () => {
    const w = mount(Slider, {
      props: { modelValue: 0, ticks: [{ value: 10, label: 'x' }, { value: 90 }] },
    })
    const all = w.findAll('.aether-slider__tick')
    expect(all).toHaveLength(2)
    expect(all[0]!.find('.aether-slider__tick-label').exists()).toBe(true)
    expect(all[1]!.find('.aether-slider__tick-label').exists()).toBe(false)
    w.unmount()
  })

  it('clamps a tick outside the range onto the end it overshot', () => {
    /* A caller's mistake should pin to the track rather than fly off into the layout. */
    const w = mount(Slider, {
      props: { modelValue: 50, min: 0, max: 100, ticks: [{ value: -40 }, { value: 300 }] },
    })
    const els = w.findAll('.aether-slider__tick').map((t) => (t.element as HTMLElement).style.getPropertyValue('--at'))
    expect(els).toEqual(['0', '1'])
    w.unmount()
  })

  it('hides the ticks from the accessibility tree', () => {
    /* Same information twice: the value is announced through aria-valuetext, and read out, the
       labels would be loose text with nothing to attach them to. */
    const w = mount(Slider, { props: { modelValue: 25, ticks } })
    expect(w.get('.aether-slider__ticks').attributes('aria-hidden')).toBe('true')
    w.unmount()
  })

  it('survives min === max without dividing by zero', () => {
    const w = mount(Slider, { props: { modelValue: 5, min: 5, max: 5, ticks: [{ value: 5 }] } })
    expect((w.get('.aether-slider__tick').element as HTMLElement).style.getPropertyValue('--at')).toBe('0')
    w.unmount()
  })
})

describe('Slider is controlled', () => {
  it('emits a number on input', async () => {
    const w = mount(Slider, { props: { modelValue: 10 } })
    const input = w.get('input')
    ;(input.element as HTMLInputElement).value = '70'
    await input.trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual([70])
    w.unmount()
  })

  it('never writes a step-corrected value back on its own', async () => {
    /* A native range snaps its THUMB to the nearest step. A component that read `.value` back would
       silently rewrite a stored 0.37 to 0.35 for a field nobody touched — so the read-out must keep
       showing the STORED number even when the thumb cannot sit exactly on it. */
    const w = mount(Slider, { props: { modelValue: 0.37, min: 0, max: 1, step: 0.05 } })
    expect(readoutOf(w)).toBe('0.37')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('follows the prop rather than moving on its own', async () => {
    const w = mount(Slider, { props: { modelValue: 10 } })
    await w.setProps({ modelValue: 80 })
    expect((w.get('input').element as HTMLInputElement).value).toBe('80')
    expect(readoutOf(w)).toBe('80')
    w.unmount()
  })

  it('passes min, max, step and disabled to the input', () => {
    const w = mount(Slider, {
      props: { modelValue: 3, min: 1, max: 9, step: 2, disabled: true },
    })
    const el = w.get('input').element as HTMLInputElement
    expect([el.min, el.max, el.step, el.disabled]).toEqual(['1', '9', '2', true])
    w.unmount()
  })
})
