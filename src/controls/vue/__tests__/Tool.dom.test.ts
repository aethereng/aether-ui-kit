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
