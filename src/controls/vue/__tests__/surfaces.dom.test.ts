import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Card from '../Card.vue'
import Spinner from '../Spinner.vue'
import FilterRail from '../FilterRail.vue'
import type { FilterGroup } from '../../core/types'

describe('Card', () => {
  it('is one element holding its slot, and nothing else', () => {
    /* The line that keeps it a surface: no header, no click, no state. A clickable card is a
     * different component, because it differs in INTERACTION and would drag a keyboard contract
     * in behind it. */
    const w = mount(Card, { slots: { default: '<p>Geometry</p>' } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.classes()).toContain('aether-card')
    expect(w.html()).toContain('<p>Geometry</p>')
    w.unmount()
  })

  it('takes the SURFACE radius, not the control one', () => {
    /* Asserted against source because the invariant is a CSS declaration, and jsdom applies no
     * scoped styles. `--aether-radius` is for chips and fields; a host retuning those must not
     * reshape its panels. This was a literal 8px here and again in Disclosure. */
    const src = readFileSync(resolve(__dirname, '../Card.vue'), 'utf8')
    expect(src).toContain('border-radius: var(--aether-radius-surface)')
    expect(src).not.toMatch(/border-radius:\s*8px/)
  })

  it('agrees with Disclosure, which consumers stack it beside', () => {
    /* The reason Card's numbers are Disclosure's: the two are the same surface family in one
     * column, and mismatched insets show up as content edges that do not line up. */
    const card = readFileSync(resolve(__dirname, '../Card.vue'), 'utf8')
    const disc = readFileSync(resolve(__dirname, '../Disclosure.vue'), 'utf8')
    for (const decl of ['border-radius: var(--aether-radius-surface)', 'border: 1px solid var(--aether-line)']) {
      expect(card, `Card lost: ${decl}`).toContain(decl)
      expect(disc, `Disclosure lost: ${decl}`).toContain(decl)
    }
    // Card's padding is Disclosure's BODY padding — the content inset, not the header's
    expect(card).toContain('padding: 12px 14px')
    expect(disc).toContain('padding: 12px 14px')
  })
})

describe('Spinner', () => {
  it('is decorative by default, because the text beside it usually speaks', () => {
    /* Unlabelled it must be aria-hidden: one real call site sits next to "verifying…", and naming
     * the spinner too would have a screen reader read the same state twice. */
    const w = mount(Spinner)
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.attributes('role')).toBeUndefined()
    expect(w.attributes('aria-label')).toBeUndefined()
    w.unmount()
  })

  it('becomes a live status when it is the only thing there', () => {
    /* The other real call site sits alone in a panel header; unnamed, the panel reads as idle. */
    const w = mount(Spinner, { props: { label: 'Deriving connections' } })
    expect(w.attributes('role')).toBe('status')
    expect(w.attributes('aria-label')).toBe('Deriving connections')
    expect(w.attributes('aria-hidden')).toBeUndefined()
    w.unmount()
  })

  it('rounds the stroke to a whole pixel', () => {
    /* THE REGRESSION. size/8 gives 1.75px at size 14, a browser floors a sub-pixel border, and
     * that spinner drew a 1px ring beside the other's 2px. Both real sizes must land on 2. */
    const at = (size: number) =>
      (mount(Spinner, { props: { size } }).element as HTMLElement).style.getPropertyValue('--stroke')
    expect(at(14)).toBe('2px')
    expect(at(16)).toBe('2px')
    expect(at(32)).toBe('4px')
  })

  it('never goes below a 1px stroke, however small', () => {
    const w = mount(Spinner, { props: { size: 4 } })
    expect((w.element as HTMLElement).style.getPropertyValue('--stroke')).toBe('1px')
    w.unmount()
  })

  it('slows under reduced motion rather than stopping', () => {
    /* A frozen spinner reads as a hung process — the one message it exists to disprove. Source
     * again: jsdom evaluates no media queries. */
    const src = readFileSync(resolve(__dirname, '../Spinner.vue'), 'utf8')
    const block = src.slice(src.indexOf('prefers-reduced-motion'))
    expect(block).toContain('animation-duration')
    expect(block).not.toMatch(/animation:\s*none/)
  })
})

describe('FilterRail', () => {
  const groups: FilterGroup[] = [
    {
      key: 'kind',
      label: 'Kind',
      options: [
        { value: 'fact', label: 'Fact', count: 3 },
        { value: 'risk', label: 'Risk', count: 0 },
      ],
      selected: new Set(['fact']),
    },
    { key: 'lane', label: 'Lane', options: [{ value: 'ops', label: 'Ops' }], selected: new Set() },
  ]

  it('renders one labelled row per group', () => {
    /* Grouping is data: the rail wires toggle/clear mechanically and knows nothing about what a
     * group means. */
    const w = mount(FilterRail, { props: { groups } })
    expect(w.text()).toContain('Kind')
    expect(w.text()).toContain('Lane')
    w.unmount()
  })

  it('reports WHICH group a toggle came from, or a host cannot route it', async () => {
    const w = mount(FilterRail, { props: { groups } })
    await w.findAll('.aether-chip')[1]!.trigger('click')
    const ev = w.emitted('toggle')![0]
    expect(ev).toEqual(['kind', 'risk'])
    w.unmount()
  })

  it('keeps a zero-count option clickable, so the axis stays visible', () => {
    /* `muted` de-emphasises without disabling — a filter that hid its empty options would hide the
     * fact that the axis exists. */
    const w = mount(FilterRail, { props: { groups } })
    const zero = w.findAll('.aether-chip')[1]!
    expect(zero.attributes('disabled')).toBeUndefined()
    w.unmount()
  })
})
