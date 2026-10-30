import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Icon from '../Icon.vue'

/* Icon draws the caller's path and nothing else: the grid, the colour it takes from its text, its
 * size, and whether a screen reader meets it. */

const PATH = 'M12 2L2 22h20Z'

describe('Icon', () => {
  it('draws the path on a 24 by 24 grid, in the colour of its text', () => {
    const w = mount(Icon, { props: { path: PATH } })
    expect(w.element.tagName.toLowerCase()).toBe('svg')
    expect(w.attributes('viewBox')).toBe('0 0 24 24')
    expect(w.attributes('fill')).toBe('currentColor')
    expect(w.findAll('path')).toHaveLength(1)
    expect(w.get('path').attributes('d')).toBe(PATH)
    expect(w.classes()).toContain('aether-icon')
    w.unmount()
  })

  it('is decoration without a label: hidden from a screen reader and out of the tab order', () => {
    const w = mount(Icon, { props: { path: PATH } })
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.attributes('focusable')).toBe('false')
    expect(w.attributes('role')).toBeUndefined()
    expect(w.attributes('aria-label')).toBeUndefined()
    w.unmount()
  })

  it('is an image of its label when given one', () => {
    const w = mount(Icon, { props: { path: PATH, label: 'Documentation' } })
    expect(w.attributes('role')).toBe('img')
    expect(w.attributes('aria-label')).toBe('Documentation')
    expect(w.attributes('aria-hidden')).toBeUndefined()
    w.unmount()
  })

  it('leaves its size to the stylesheet (1em) unless given one', () => {
    const w = mount(Icon, { props: { path: PATH } })
    expect(w.attributes('style')).toBeUndefined()
    w.unmount()
  })

  it.each([
    [20, '20px'],
    ['1.5rem', '1.5rem'],
  ] as const)('takes a size of %o as %s, both ways', (size, length) => {
    const w = mount(Icon, { props: { path: PATH, size } })
    const style = (w.element as SVGElement).style
    expect(style.width).toBe(length)
    expect(style.height).toBe(length)
    w.unmount()
  })
})
