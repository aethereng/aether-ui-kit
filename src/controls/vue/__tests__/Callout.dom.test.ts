import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Callout from '../Callout.vue'

/* Callout carries meaning rather than behaviour, so these pin the parts a stylesheet cannot: that
 * the severity exists as TEXT and not only as a hue, that it is not a live region when it is part
 * of a document, and that it becomes one when it is not. The colour itself is untested on purpose
 * — it is a token alias, and asserting a hex here would pin the theme rather than the contract. */

describe('Callout', () => {
  it('defaults to info, and to a note rather than a live region', () => {
    /* Five of these render on first paint in a verification report. Defaulting to role="alert"
     * would announce all five assertively as the document loads, which is the failure mode Badge
     * records for not defaulting to role="status". */
    const w = mount(Callout, { slots: { default: 'A plain remark.' } })
    expect(w.classes()).toContain('tone-info')
    expect(w.attributes('role')).toBe('note')
    expect(w.attributes('aria-live')).toBeUndefined()
    w.unmount()
  })

  it('states the severity as text, not only as colour', () => {
    /* The whole reason a Card cannot substitute. Without this, a danger callout and a note are
     * identical in the accessibility tree and in a greyscale print. */
    for (const [tone, word] of [
      ['info', 'Note'],
      ['success', 'Success'],
      ['warning', 'Warning'],
      ['danger', 'Danger'],
    ] as const) {
      const w = mount(Callout, { props: { tone }, slots: { default: 'body' } })
      expect(w.text()).toContain(word)
      expect(w.classes()).toContain(`tone-${tone}`)
      w.unmount()
    }
  })

  it('hides the severity word visually without removing it from the accessibility tree', () => {
    /* display:none and visibility:hidden would both satisfy "not visible" and delete the thing
     * this component exists to add. The clip technique is the one that does not. */
    const w = mount(Callout, { props: { tone: 'danger' }, slots: { default: 'body' } })
    const el = w.find('.aether-callout-severity')
    expect(el.exists()).toBe(true)
    expect(el.attributes('aria-hidden')).toBeUndefined()
    w.unmount()
  })

  it('promotes to a live region only when asked, and matches urgency to tone', () => {
    const stopping = mount(Callout, { props: { tone: 'danger', live: true } })
    expect(stopping.attributes('role')).toBe('alert')
    expect(stopping.attributes('aria-live')).toBe('assertive')
    stopping.unmount()

    const passing = mount(Callout, { props: { tone: 'success', live: true } })
    expect(passing.attributes('role')).toBe('status')
    expect(passing.attributes('aria-live')).toBe('polite')
    passing.unmount()
  })

  it('renders a title only when given one', () => {
    const without = mount(Callout, { slots: { default: 'body' } })
    expect(without.find('.aether-callout-title').exists()).toBe(false)
    without.unmount()

    const with_ = mount(Callout, { props: { title: 'Code mismatch' }, slots: { default: 'body' } })
    expect(with_.find('.aether-callout-title').text()).toBe('Code mismatch')
    with_.unmount()
  })

  it('is not interactive', () => {
    /* Same boundary Badge holds. A persistent block of prose exposed as operable lands in the tab
     * order and does nothing when activated. */
    const w = mount(Callout, { props: { tone: 'danger' }, slots: { default: 'body' } })
    expect(w.find('button').exists()).toBe(false)
    expect(w.attributes('tabindex')).toBeUndefined()
    w.unmount()
  })
})
