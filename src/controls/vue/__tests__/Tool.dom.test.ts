import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Tool from '../Tool.vue'

/* The icon slot's failure modes are all silent: an icon-only button with no accessible name, a
 * plain Tool whose box model changed because icon layout was applied unconditionally, or
 * labelHidden emptying a button that has no icon to show instead. */

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  mounted.forEach((w) => w.unmount())
  mounted.length = 0
})

function mountTool(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  const w = mount(Tool, { props: { label: 'Fit view', ...props }, slots })
  mounted.push(w)
  return w
}

describe('Tool — without an icon, nothing changes', () => {
  it('renders the label and does NOT take the icon layout class', () => {
    const w = mountTool()
    expect(w.text()).toBe('Fit view')
    expect(w.classes()).toContain('aether-tool')
    expect(w.classes()).not.toContain('aether-tool--icon')
  })

  it('ignores labelHidden when there is no icon, rather than rendering an empty button', () => {
    const w = mountTool({ labelHidden: true })
    expect(w.text()).toBe('Fit view')
    expect(w.classes()).not.toContain('aether-tool--icon-only')
  })
})

describe('Tool — with an #icon slot', () => {
  const icon = { icon: '<svg data-test="glyph"></svg>' }

  it('renders the caller markup alongside the label', () => {
    const w = mountTool({}, icon)
    expect(w.find('[data-test="glyph"]').exists()).toBe(true)
    expect(w.text()).toBe('Fit view')
    expect(w.classes()).toContain('aether-tool--icon')
  })

  it('hides the icon from assistive tech, since the label already names the action', () => {
    const w = mountTool({}, icon)
    expect(w.find('.aether-tool__icon').attributes('aria-hidden')).toBe('true')
  })

  it('icon-only keeps the label as the ACCESSIBLE NAME rather than dropping it', () => {
    const w = mountTool({ labelHidden: true }, icon)
    expect(w.text()).toBe('') // no visible label
    expect(w.attributes('aria-label')).toBe('Fit view') // still named
    expect(w.classes()).toContain('aether-tool--icon-only')
  })

  it('does not set a redundant aria-label when the visible label is present', () => {
    expect(mountTool({}, icon).attributes('aria-label')).toBeUndefined()
  })
})

describe('Tool — the variant set is still closed', () => {
  it('danger wins over hot, because mislabelling a destructive action is the worse failure', () => {
    const w = mountTool({ hot: true, danger: true })
    expect(w.classes()).toContain('danger')
    expect(w.classes()).not.toContain('hot')
  })

  it('emits click, and does not when disabled', async () => {
    const w = mountTool()
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)

    const d = mountTool({ disabled: true })
    await d.trigger('click')
    expect(d.emitted('click')).toBeUndefined()
  })
})

/* Everything below covers ground the kit had never exercised. `#icon` shipped with exactly one
 * consumer — the gallery example, passing a bare inline <svg> — and both real apps used text-only
 * Tools. So the two things a host actually needs from an icon button, an icon COMPONENT and a
 * layout hook, had never once been tried. */
describe('Tool — an icon component, not just a bare <svg>', () => {
  /* Stands in for any icon library's component (Vuetify's <v-icon>, an inline-SVG set, a font
   * glyph): the point is that it renders a WRAPPER around whatever it draws, which is what the
   * kit's old `> svg` rule failed to see. */
  const IconComponent = {
    name: 'IconComponent',
    template: '<i class="lib-icon"><svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z" /></svg></i>',
  }

  it('renders a caller component inside the icon slot', () => {
    // Slot content compiles in the PARENT's scope, which is the whole reason this is a slot and not
    // an `icon="mdi-..."` prop: the kit resolves nothing and depends on no icon library.
    const w = mount(Tool, {
      props: { label: 'Save' },
      slots: { icon: IconComponent },
    })
    expect(w.find('.lib-icon').exists()).toBe(true)
    w.unmount()
  })

  it('puts the icon in the icon span and never inside the label', () => {
    const w = mount(Tool, { props: { label: 'Save' }, slots: { icon: IconComponent } })
    const icon = w.get('.lib-icon').element
    expect(icon.closest('.aether-tool__icon')).not.toBeNull()
    // The label is a separate span; an icon swallowed into it would be read out as part of the name.
    expect(w.get('.aether-tool__icon').element.contains(icon)).toBe(true)
    w.unmount()
  })

  it('leaves the svg reachable by a DESCENDANT selector, not only as a direct child', () => {
    /* The regression this pins: `.aether-tool__icon > svg` matched the gallery's bare <svg> and
     * nothing else, so a wrapped icon kept the library's own size. jsdom applies no stylesheet, so
     * this asserts the STRUCTURE the corrected selector depends on — the svg is a grandchild. */
    const w = mount(Tool, { props: { label: 'Save' }, slots: { icon: IconComponent } })
    const span = w.get('.aether-tool__icon').element
    expect(span.querySelector(':scope > svg')).toBeNull()
    expect(span.querySelector('svg')).not.toBeNull()
    w.unmount()
  })

  it('marks the icon aria-hidden so the label alone is the accessible name', () => {
    const w = mount(Tool, { props: { label: 'Save' }, slots: { icon: IconComponent } })
    expect(w.get('.aether-tool__icon').attributes('aria-hidden')).toBe('true')
    w.unmount()
  })
})

describe('Tool — the layout hook is a class, not a prop', () => {
  it('merges a caller class onto the button alongside its own', () => {
    /* This is the answer to "a Tool cannot be made to fill a flex row". `.aether-tool` declares no
     * flex at all, and Vue falls attributes through to the single root element, so a host writes
     * `<Tool class="fam-btn" />` with `.fam-btn { flex: 1 1 auto }` and it composes. No `grow` prop
     * is needed, and adding one would be API for something CSS already expresses. */
    const w = mount(Tool, { props: { label: 'Apply' }, attrs: { class: 'fam-btn' } })
    expect(w.classes()).toContain('aether-tool')
    expect(w.classes()).toContain('fam-btn')
    w.unmount()
  })

  it('passes style through too', () => {
    const w = mount(Tool, { props: { label: 'Apply' }, attrs: { style: 'flex: 1 1 auto' } })
    expect(w.attributes('style')).toContain('flex')
    w.unmount()
  })
})

describe('Tool — the filled destructive variant', () => {
  it('fills only when danger is also set', () => {
    /* `fill` is not a general "make it solid" switch. On its own it must do nothing, or it becomes
     * the open style hook the variant set exists to avoid. */
    const solo = mount(Tool, { props: { label: 'Save', fill: true } })
    expect(solo.classes()).not.toContain('aether-tool--fill')
    solo.unmount()

    const both = mount(Tool, { props: { label: 'Delete', danger: true, fill: true } })
    expect(both.classes()).toContain('aether-tool--fill')
    expect(both.classes()).toContain('danger')
    both.unmount()
  })

  it('is outline by default, so a filled destructive button stays a deliberate choice', () => {
    const w = mount(Tool, { props: { label: 'Delete', danger: true } })
    expect(w.classes()).not.toContain('aether-tool--fill')
    w.unmount()
  })

  it('still loses to danger when hot is passed as well', () => {
    // The precedence rule is unchanged by fill: mislabelling a destructive action stays the worse
    // failure, and a filled one would be louder about the wrong thing.
    const w = mount(Tool, { props: { label: 'Discard', hot: true, danger: true, fill: true } })
    expect(w.classes()).toContain('danger')
    expect(w.classes()).not.toContain('hot')
    expect(w.classes()).toContain('aether-tool--fill')
    w.unmount()
  })
})

describe('Tool #trailing', () => {
  /* Added for a menu trigger that needs a caret after its label. The slot is decorative by
   * contract, and these pin that contract rather than the markup: what must not happen is a
   * trailing glyph leaking into the button's accessible name. */
  const T = '<svg data-t viewBox="0 0 16 16"><path d="M4 6 8 10 12 6" /></svg>'

  it('renders after the label, and only when supplied', () => {
    const bare = mount(Tool, { props: { label: 'Sort' } })
    expect(bare.find('.aether-tool__trailing').exists()).toBe(false)
    expect(bare.classes()).not.toContain('aether-tool--trailing')
    bare.unmount()

    const w = mount(Tool, { props: { label: 'Sort' }, slots: { trailing: T } })
    expect(w.find('.aether-tool__trailing').exists()).toBe(true)
    expect(w.classes()).toContain('aether-tool--trailing')
    // order matters: the affordance follows the word it belongs to
    const kids = [...w.element.children].map((e) => e.className)
    expect(kids[kids.length - 1]).toBe('aether-tool__trailing')
    w.unmount()
  })

  it('is aria-hidden, so it cannot enter the accessible name', () => {
    /* THE point of the test. A caret that reaches the name turns "Open" into "Open ▾" for a
     * screen reader, and worse, a slot could quietly become the label. */
    const w = mount(Tool, { props: { label: 'File' }, slots: { trailing: T } })
    expect(w.find('.aether-tool__trailing').attributes('aria-hidden')).toBe('true')
    expect(w.text()).toBe('File')
    w.unmount()
  })

  it('composes with #icon — leading and trailing are independent', () => {
    const w = mount(Tool, {
      props: { label: 'File' },
      slots: { icon: '<svg data-i />', trailing: T },
    })
    expect(w.classes()).toContain('aether-tool--icon')
    expect(w.classes()).toContain('aether-tool--trailing')
    const kids = [...w.element.children].map((e) => e.className)
    expect(kids[0]).toBe('aether-tool__icon')
    expect(kids[kids.length - 1]).toBe('aether-tool__trailing')
    w.unmount()
  })

  it('does not make a trailing-only button icon-only', () => {
    /* `labelHidden` is honoured only alongside #icon. A trailing slot must not satisfy it, or a
     * caret-only button would render with no visible label and no icon either. */
    const w = mount(Tool, { props: { label: 'Sort', labelHidden: true }, slots: { trailing: T } })
    expect(w.classes()).not.toContain('aether-tool--icon-only')
    expect(w.text()).toBe('Sort')
    expect(w.attributes('aria-label')).toBeUndefined()
    w.unmount()
  })
})
