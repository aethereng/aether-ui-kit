import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Disclosure from '../Disclosure.vue'

/* This component exists because a <details>/<summary> could not hold an interactive control in its
 * header, and the pattern had been hand-rolled four different ways across the consuming apps -- one
 * of which silently lost keyboard access entirely. So these tests are not about collapsing
 * behaviour, which is one boolean the caller owns. They pin what hand-rolling kept getting wrong:
 * a real focusable button, aria-expanded/aria-controls that actually resolve, the aside rendered
 * OUTSIDE the button, and find-in-page still reaching collapsed text. */

function mountD(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(Disclosure, {
    props: { label: 'Connections', ...props },
    slots: { default: '<p class="inner">body text</p>', ...slots },
    attachTo: document.body,
  })
}

describe('Disclosure — the toggle is a real button', () => {
  it('is a <button type="button">, not a click-handled div', () => {
    // A div with @click takes no focus, so Tab skips it — the real defect this replaced.
    const w = mountD()
    const t = w.get('.aether-disclosure__toggle')
    expect(t.element.tagName).toBe('BUTTON')
    // Without type="button" a button inside a form submits it on Enter instead of toggling.
    expect(t.attributes('type')).toBe('button')
    w.unmount()
  })

  it('carries the label as its accessible name, without an aria-label overriding it', () => {
    const w = mountD()
    const t = w.get('.aether-disclosure__toggle')
    expect(t.text()).toContain('Connections')
    // An aria-label that diverged from the visible text would be a WCAG 2.5.3 failure; the name
    // must come from the rendered content.
    expect(t.attributes('aria-label')).toBeUndefined()
    w.unmount()
  })

  it('reflects state in aria-expanded and emits the negation on click', async () => {
    const w = mountD({ open: false })
    const t = w.get('.aether-disclosure__toggle')
    expect(t.attributes('aria-expanded')).toBe('false')

    await t.trigger('click')
    expect(w.emitted('update:open')).toEqual([[true]])

    // Controlled: it must NOT have toggled itself off the back of its own click.
    expect(t.attributes('aria-expanded')).toBe('false')

    await w.setProps({ open: true })
    expect(t.attributes('aria-expanded')).toBe('true')
    await t.trigger('click')
    expect(w.emitted('update:open')).toEqual([[true], [false]])
    w.unmount()
  })

  it('points aria-controls at a region that actually exists', () => {
    const w = mountD()
    const id = w.get('.aether-disclosure__toggle').attributes('aria-controls')
    expect(id).toBeTruthy()
    // A dangling IDREF is the common way this pattern is wrong-but-silent.
    expect(w.get('.aether-disclosure__region').attributes('id')).toBe(id)
    w.unmount()
  })

  it('gives sibling panels in one app distinct region ids', () => {
    /* Eight packets on one page: a fixed id, or a counter that resets, would make every toggle
     * claim to control the first panel. Both are mounted inside ONE app on purpose -- useId is
     * documented as unique per app, not globally, so mounting two apps and comparing would assert
     * something Vue never promised (it hands both `v-0`). A page that really does mount several
     * apps disambiguates them with `app.config.idPrefix`; that is the host's call, not ours. */
    const w = mount(
      {
        components: { Disclosure },
        template: `<div><Disclosure label="One" /><Disclosure label="Two" /></div>`,
      },
      { attachTo: document.body },
    )
    const ids = w.findAll('.aether-disclosure__region').map((r) => r.attributes('id'))
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBeTruthy()
    expect(new Set(ids).size).toBe(2)
    // and each toggle points at its OWN region, not merely at some existing one
    const controls = w.findAll('.aether-disclosure__toggle').map((t) => t.attributes('aria-controls'))
    expect(controls).toEqual(ids)
    w.unmount()
  })
})

describe('Disclosure — the aside is not inside the button', () => {
  it('renders #aside as a sibling of the toggle', () => {
    /* THE load-bearing test. This component's whole reason to exist over <details> is that a header
     * control can stay reachable when collapsed. Nested inside the button it would be flattened in
     * the accessibility tree -- the exact defect found in Review Desk, where a link sat inside the
     * click target and needed an inline stopPropagation to work at all. */
    const w = mountD({}, { aside: '<a class="aside-link" href="/x">Read packet</a>' })
    const link = w.get('.aside-link')
    expect(link.element.closest('button')).toBeNull()
    expect(link.element.parentElement).toBe(w.get('.aether-disclosure__head').element)
    w.unmount()
  })

  it('keeps the aside outside the collapsible region too', () => {
    // In the head, not the region: an aside inside the region would vanish when collapsed, which
    // is the <details> limitation this design exists to escape.
    const w = mountD({ open: false }, { aside: '<a class="aside-link" href="/x">Read</a>' })
    expect(w.get('.aside-link').element.closest('.aether-disclosure__region')).toBeNull()
    w.unmount()
  })
})

describe('Disclosure — collapsed content stays findable', () => {
  it('hides the region with until-found rather than a bare hidden', () => {
    /* `hidden="until-found"` is what keeps Ctrl+F working into a closed panel. A plain `hidden`
     * (or a CSS display:none) hides it from find-in-page too, silently. Asserting the literal
     * attribute VALUE is the point -- Vue's boolean-attribute path would render `hidden=""` here,
     * which still hides and still passes any truthiness check. */
    const w = mountD({ open: false })
    expect(w.get('.aether-disclosure__region').attributes('hidden')).toBe('until-found')
    w.unmount()
  })

  it('drops the attribute entirely when open', async () => {
    const w = mountD({ open: true })
    expect(w.get('.aether-disclosure__region').attributes('hidden')).toBeUndefined()
    await w.setProps({ open: false })
    expect(w.get('.aether-disclosure__region').attributes('hidden')).toBe('until-found')
    w.unmount()
  })

  it('asks the caller to open when find-in-page reveals the region', async () => {
    // The browser fires beforematch before revealing. If we do not tell the caller, `open` stays
    // false and the next render slams the panel shut on the match the user just jumped to.
    const w = mountD({ open: false })
    await w.get('.aether-disclosure__region').trigger('beforematch')
    expect(w.emitted('update:open')).toEqual([[true]])
    w.unmount()
  })

  it('does not put padding or a border on the region itself', () => {
    /* until-found hides the region's CONTENTS but keeps the region's own box, so padding or a
     * border declared there paints as a stray strip under every closed header. They belong on the
     * inner body element, which the hiding does cover. */
    const w = mountD({ open: false })
    const region = w.get('.aether-disclosure__region')
    expect(region.element.children.length).toBe(1)
    expect(region.get('.aether-disclosure__body').get('.inner').exists()).toBe(true)
    w.unmount()
  })
})

describe('Disclosure — props', () => {
  it('renders meta only when given', () => {
    const bare = mountD()
    expect(bare.find('.aether-disclosure__meta').exists()).toBe(false)
    bare.unmount()

    const withMeta = mountD({ meta: 'foo.md · impl: bar' })
    expect(withMeta.get('.aether-disclosure__meta').text()).toBe('foo.md · impl: bar')
    withMeta.unmount()
  })

  it('disables the toggle without emitting', async () => {
    const w = mountD({ disabled: true })
    const t = w.get('.aether-disclosure__toggle')
    expect(t.attributes('disabled')).toBeDefined()
    await t.trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
    w.unmount()
  })

  it('marks the chevron aria-hidden so it is not read as content', () => {
    const w = mountD()
    expect(w.get('.aether-disclosure__chev').attributes('aria-hidden')).toBe('true')
    w.unmount()
  })
})
