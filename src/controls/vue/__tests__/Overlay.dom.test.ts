import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Overlay from '../Overlay.vue'

/* The flag's rules are deferredFlag's, tested there. These pin what the overlay adds: which flag it
 * shows, what it takes away at once, what the bar claims, and that a hidden card holds no tab stop. */

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const base = { open: false, label: 'Reading' }
const SHOW_DELAY = 180
const MIN_VISIBLE = 420

describe('Overlay: when it shows', () => {
  it('stays hidden and inert until the work has run past the delay', async () => {
    const w = mount(Overlay, { props: { ...base, open: true } })
    expect(w.classes()).not.toContain('is-visible')
    expect(w.attributes('inert')).toBeDefined()
    vi.advanceTimersByTime(SHOW_DELAY)
    await nextTick()
    expect(w.classes()).toContain('is-visible')
    expect(w.attributes('inert')).toBeUndefined()
  })

  it('never shows for work that ends inside the delay', async () => {
    const w = mount(Overlay, { props: { ...base, open: true } })
    vi.advanceTimersByTime(SHOW_DELAY - 1)
    await w.setProps({ open: false })
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(w.classes()).not.toContain('is-visible')
  })

  it('holds for its minimum once shown, after the work ends', async () => {
    const w = mount(Overlay, { props: { ...base, open: true } })
    vi.advanceTimersByTime(SHOW_DELAY)
    await w.setProps({ open: false })
    vi.advanceTimersByTime(MIN_VISIBLE - 1)
    await nextTick()
    expect(w.classes()).toContain('is-visible')
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(w.classes()).not.toContain('is-visible')
  })

  it('goes at once when set aside, inside its minimum, and comes back while the flag holds', async () => {
    const w = mount(Overlay, { props: { ...base, open: true } })
    vi.advanceTimersByTime(SHOW_DELAY)
    await nextTick()
    expect(w.classes(), 'precondition: it is showing').toContain('is-visible')
    await w.setProps({ aside: true })
    expect(w.classes()).not.toContain('is-visible')
    expect(w.attributes('inert')).toBeDefined()
    await w.setProps({ aside: false })
    expect(w.classes()).toContain('is-visible')
  })
})

describe('Overlay: what it says', () => {
  it('titles the card and names the bar from one label', () => {
    const w = mount(Overlay, { props: base })
    expect(w.find('.aether-overlay__title').text()).toBe('Reading')
    expect(w.find('[role="progressbar"]').attributes('aria-label')).toBe('Reading')
  })

  it('draws the subject and the detail when given, the empty text included', () => {
    const w = mount(Overlay, { props: { ...base, subject: 'tower', detail: 'parsing' } })
    expect(w.find('.aether-overlay__subject').text()).toBe('tower')
    expect(w.find('.aether-overlay__detail').text()).toBe('parsing')
    const empty = mount(Overlay, { props: { ...base, subject: '', detail: '' } })
    expect(empty.find('.aether-overlay__subject').exists()).toBe(true)
    expect(empty.find('.aether-overlay__detail').exists()).toBe(true)
    const none = mount(Overlay, { props: base })
    expect(none.find('.aether-overlay__subject').exists()).toBe(false)
    expect(none.find('.aether-overlay__detail').exists()).toBe(false)
  })

  it('announces itself politely', () => {
    const card = mount(Overlay, { props: base }).find('.aether-overlay__card')
    expect(card.attributes('role')).toBe('status')
    expect(card.attributes('aria-live')).toBe('polite')
  })

  it('draws the mark only when it is given one, hidden from a screen reader', () => {
    expect(mount(Overlay, { props: base }).find('.aether-overlay__mark').exists()).toBe(false)
    const mark = mount(Overlay, { props: base, slots: { mark: '<svg class="m" />' } }).find('.aether-overlay__mark')
    expect(mark.find('.m').exists()).toBe(true)
    expect(mark.attributes('aria-hidden')).toBe('true')
  })
})

describe('Overlay: the bar', () => {
  it('sweeps and claims no value without a progress', () => {
    const bar = mount(Overlay, { props: base }).find('[role="progressbar"]')
    expect(bar.find('.aether-overlay__comet').exists()).toBe(true)
    expect(bar.find('.aether-overlay__fill').exists()).toBe(false)
    expect(bar.attributes('aria-busy')).toBe('true')
    for (const a of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']) expect(bar.attributes(a), a).toBeUndefined()
  })

  it('fills to the fraction and states it', () => {
    const bar = mount(Overlay, { props: { ...base, progress: 0.256 } }).find('[role="progressbar"]')
    expect(bar.find('.aether-overlay__comet').exists()).toBe(false)
    expect((bar.find('.aether-overlay__fill').element as HTMLElement).style.transform).toBe('scaleX(0.256)')
    expect(bar.attributes('aria-busy')).toBe('false')
    expect(bar.attributes('aria-valuenow')).toBe('26')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
  })

  it('treats a progress of 0 as a measure, and holds a fraction past either end', () => {
    const bar = (progress: number) => mount(Overlay, { props: { ...base, progress } }).find('[role="progressbar"]')
    expect(bar(0).attributes('aria-valuenow')).toBe('0')
    expect(bar(0).find('.aether-overlay__fill').exists()).toBe(true)
    expect(bar(1.5).attributes('aria-valuenow')).toBe('100')
    expect(bar(-1).attributes('aria-valuenow')).toBe('0')
  })
})

describe('Overlay: the sweep’s colours', () => {
  /* jsdom applies no gradient, so this reads the rule: without `in srgb`, the color-mix stops move the
   * whole sweep to Oklab, which only a picture of the page shows. */
  it('states the space it blends in', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../Overlay.vue'), 'utf8')
    const comet = source.slice(source.indexOf('.aether-overlay__comet {'))
    expect(comet.slice(0, comet.indexOf('}'))).toContain('90deg in srgb,')
  })
})

describe('Overlay: stopping', () => {
  it('has no button unless it is stoppable', () => {
    expect(mount(Overlay, { props: base }).find('button').exists()).toBe(false)
  })

  it('tells the app when the button is pressed, in the words and tone it was given', async () => {
    const w = mount(Overlay, { props: { ...base, stoppable: true, stopLabel: 'Abort', stopDanger: true } })
    const button = w.find('.aether-overlay__stop button')
    expect(button.text()).toBe('Abort')
    expect(button.classes().join(' ')).toContain('danger')
    await button.trigger('click')
    expect(w.emitted('stop')).toHaveLength(1)
  })

  it('reads Stop in the plain tone by default', () => {
    const button = mount(Overlay, { props: { ...base, stoppable: true } }).find('.aether-overlay__stop button')
    expect(button.text()).toBe('Stop')
    expect(button.classes().join(' ')).not.toContain('danger')
  })
})

describe('Overlay: after it is gone', () => {
  it('leaves no timer running', () => {
    const w = mount(Overlay, { props: { ...base, open: true } })
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
