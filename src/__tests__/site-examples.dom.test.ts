import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GalleryExample from '../gallery/examples/GalleryExample.vue'
import LegendExample from '../gallery/examples/LegendExample.vue'
import OverlayExample from '../gallery/examples/OverlayExample.vue'
import Spinner from '../controls/vue/Spinner.vue'

/* The site's newest examples, mounted through the imports a reader copies. Each is also the source its
 * own Template and Script tabs show. */

describe('the legend on the site', () => {
  it('draws two ramps and the two states with no ramp, in the words the example gives it', () => {
    const w = mount(LegendExample)
    expect(w.findAll('[data-legend="ramp"]')).toHaveLength(2)
    expect(w.find('[data-legend="zero"]').text()).toBe('No snow fell on this map.')
    expect(w.find('[data-legend="nonfinite"]').text()).toContain('has no range')
    expect(w.find('[data-legend="nonfinite-key"]').text()).toBe('No reading at 3 stations')
  })
})

describe('the overlay on the site', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const press = (w: ReturnType<typeof mount>, index: number) => w.findAll('button')[index]!.trigger('click')
  const advance = async (ms: number) => {
    vi.advanceTimersByTime(ms)
    await nextTick()
  }

  it('shows for work past the delay, sweeps with no measure, and goes when stopped', async () => {
    const w = mount(OverlayExample)
    await press(w, 0)
    await advance(200)
    const overlay = w.find('.aether-overlay')
    expect(overlay.classes()).toContain('is-visible')
    expect(w.find('.aether-overlay__comet').exists()).toBe(true)
    await w.find('.aether-overlay__stop button').trigger('click')
    expect(w.find('.g-ex-state').text()).toContain('open = false')
    await advance(500)
    expect(overlay.classes()).not.toContain('is-visible')
    w.unmount()
  })

  it('fills the bar for work that reports a fraction, and ends by itself', async () => {
    const w = mount(OverlayExample)
    await press(w, 1)
    await advance(1500)
    const value = Number(w.find('[role="progressbar"]').attributes('aria-valuenow'))
    expect(value).toBeGreaterThan(40)
    expect(value).toBeLessThan(60)
    await advance(2000)
    expect(w.find('.g-ex-state').text()).toContain('open = false')
    w.unmount()
  })

  it('never shows for work inside the delay', async () => {
    const w = mount(OverlayExample)
    await press(w, 2)
    expect(w.find('.g-ex-state').text(), 'precondition: the work started').toContain('open = true')
    await advance(150)
    expect(w.find('.g-ex-state').text(), 'precondition: the work ended').toContain('open = false')
    await advance(1000)
    expect(w.find('.aether-overlay').classes()).not.toContain('is-visible')
    w.unmount()
  })

  it('holds the spinner from this kit in the mark', () => {
    expect(mount(OverlayExample).find('.aether-overlay__mark').findComponent(Spinner).exists()).toBe(true)
  })

  it('leaves no timer when it goes mid-run', async () => {
    const w = mount(OverlayExample)
    await press(w, 0)
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('the gallery on the site', () => {
  it('reports the card that was pressed', async () => {
    const w = mount(GalleryExample)
    expect(w.find('.g-ex-state').text()).toContain('nothing yet')
    await w.find('[data-card="valley"] button').trigger('click')
    expect(w.find('.g-ex-state').text()).toContain('valley')
  })

  it('draws every family, an icon where there is no picture, a foot and a note', () => {
    const w = mount(GalleryExample)
    expect(w.findAll('section').map((s) => s.attributes('data-family'))).toEqual(['start', 'maps', 'charts'])
    expect(w.find('[data-card="blank"] .aether-gallery__media--icon svg').exists()).toBe(true)
    expect(w.find('[data-card="coast"] img').attributes('src')).toMatch(/^data:image[/]svg/)
    expect(w.find('[data-card="valley"] [data-card-foot] svg').exists()).toBe(true)
    expect(w.find('[data-card="seasons"] [data-card-note]').text()).toContain('Credit.')
  })
})
