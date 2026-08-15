import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Badge from '../Badge.vue'

/* Badge is almost all CSS, so these pin the two things that are not: the contract with the caller
 * (a tone class and slotted content, nothing else) and the two boundaries it must not cross —
 * becoming interactive, or learning what a domain state means. */

describe('Badge', () => {
  it('renders a span, not a control', () => {
    /* The reason this is not Chip. A marker exposed as a button is announced as operable and
     * lands in the tab order, so a row of six status counts becomes six things to tab past that
     * do nothing when activated. */
    const w = mount(Badge, { slots: { default: 'ALL PASS' } })
    expect(w.element.tagName).toBe('SPAN')
    expect(w.find('button').exists()).toBe(false)
    expect(w.attributes('tabindex')).toBeUndefined()
    expect(w.attributes('role')).toBeUndefined()
    w.unmount()
  })

  it('defaults to neutral', () => {
    const w = mount(Badge, { slots: { default: '6' } })
    expect(w.classes()).toContain('aether-badge--neutral')
    w.unmount()
  })

  it.each(['success', 'warning', 'danger'] as const)('carries the %s tone as a class', (tone) => {
    const w = mount(Badge, { props: { tone }, slots: { default: 'x' } })
    expect(w.classes()).toContain(`aether-badge--${tone}`)
    // Exactly one tone at a time — a stale class alongside a new one would paint the wrong colour.
    expect(w.classes().filter((c) => c.startsWith('aether-badge--'))).toHaveLength(1)
    w.unmount()
  })

  it('renders the caller’s text verbatim', () => {
    const w = mount(Badge, { props: { tone: 'danger' }, slots: { default: '3 FAIL' } })
    expect(w.text()).toBe('3 FAIL')
    w.unmount()
  })

  it('has no opinion about what produced the tone', () => {
    /* The boundary that matters. There is no `status` prop mapping "singular" or "verified" onto a
     * colour: the host owns domain -> tone, the kit owns tone -> pixels. Same rule as `suffix`,
     * where the kit renders a unit and never knows one. If a domain vocabulary ever appears in
     * this component's props, this is the test that should have stopped it. */
    expect(Object.keys(Badge.props ?? {})).toEqual(['tone'])

    // "verified" is content the caller chose; it changes nothing about the rendering.
    const w = mount(Badge, { props: { tone: 'success' }, slots: { default: 'verified' } })
    expect(w.classes()).toContain('aether-badge--success')
    w.unmount()
  })

  it('renders no wrapper for a row — a row of badges is a caller’s flex container', () => {
    // Same reasoning .aether-button-group gets: no shared state, no active member, nothing to model.
    const w = mount(Badge, { slots: { default: 'a' } })
    expect(w.element.children).toHaveLength(0)
    w.unmount()
  })
})
