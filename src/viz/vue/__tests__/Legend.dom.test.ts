import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Legend from '../Legend.vue'
import { declared, stylesOf } from '../../../__tests__/sfcRules'

/* A legend is the only place a drawing's colours get their numbers, so these pin what a wrong
 * legend would say: a ramp over a field with no range, numbers out of order, and a colour nobody
 * explains. */

const STOPS = 'rgb(0, 0, 255) 0%, rgb(255, 255, 255) 50%, rgb(255, 0, 0) 100%'
const base = { label: 'Stress', stops: STOPS }
const ramp = (w: ReturnType<typeof mount>) => w.find('[data-legend="ramp"]')

describe('Legend: a ramp', () => {
  it('draws the bar from the stops it is given, left to right', () => {
    const w = mount(Legend, { props: base })
    const bar = w.find('.aether-legend__bar').element as HTMLElement
    expect(bar.style.backgroundImage).toBe(`linear-gradient(to right, ${STOPS})`)
  })

  it('leaves background-clip to the app, which the shorthand would reset', () => {
    const w = mount(Legend, { props: base })
    const bar = w.find('.aether-legend__bar').element as HTMLElement
    expect(bar.getAttribute('style')).toContain('background-image')
    expect(bar.style.backgroundClip).toBe('')
  })

  it('prints the ticks as given, in their order, with nothing added', () => {
    const w = mount(Legend, { props: { ...base, ticks: ['-1.20', '0', '1.20'] } })
    expect(w.findAll('.aether-legend__ticks span').map((s) => s.text())).toEqual(['-1.20', '0', '1.20'])
  })

  it('prints no number it was not given', () => {
    const w = mount(Legend, { props: base })
    expect(w.findAll('.aether-legend__ticks span')).toHaveLength(0)
  })

  it('names the field, with the unit apart when there is one', () => {
    const w = mount(Legend, { props: { ...base, unit: 'MPa' } })
    expect(w.find('.aether-legend__label').text()).toBe('Stress MPa')
    expect(w.find('.aether-legend__unit').text()).toBe('MPa')
    expect(mount(Legend, { props: base }).find('.aether-legend__unit').exists()).toBe(false)
  })

  it('explains the colour of a value the ramp cannot place, only when told to', () => {
    const w = mount(Legend, { props: { ...base, noValueColor: 'rgb(255, 255, 0)', noValueKey: 'NaN at some samples' } })
    const key = ramp(w).find('[data-legend="nonfinite-key"]')
    expect(key.text()).toBe('NaN at some samples')
    const swatch = key.find('.aether-legend__swatch')
    expect((swatch.element as HTMLElement).style.background).toBe('rgb(255, 255, 0)')
    expect(swatch.attributes('aria-hidden')).toBe('true')
    expect(mount(Legend, { props: { ...base, noValueColor: 'rgb(255, 255, 0)' } }).find('[data-legend="nonfinite-key"]').exists()).toBe(false)
  })

  it('draws the key with no swatch when it has no colour for one', () => {
    const w = mount(Legend, { props: { ...base, noValueKey: 'NaN at some samples' } })
    expect(w.find('[data-legend="nonfinite-key"]').text()).toBe('NaN at some samples')
    expect(w.find('.aether-legend__swatch').exists()).toBe(false)
  })
})

describe('Legend: no ramp', () => {
  it('says what the app says of a zero field, with no bar and no number', () => {
    const w = mount(Legend, { props: { ...base, unit: 'MPa', state: 'zero', note: 'Flat at 0 across this map.', ticks: ['0', '0'] } })
    expect(w.find('[data-legend="zero"]').text()).toBe('Flat at 0 across this map.')
    expect(w.find('.aether-legend__bar').exists()).toBe(false)
    expect(w.find('.aether-legend__ticks').exists()).toBe(false)
    expect(w.find('[data-legend="zero"]').classes()).not.toContain('aether-legend__note--warn')
  })

  it('says what the app says of a field with no finite range, in the warning colour, with the swatch', () => {
    const w = mount(Legend, { props: { ...base, state: 'nonfinite', note: 'No range here.', noValueColor: 'rgb(255, 255, 0)' } })
    const note = w.find('[data-legend="nonfinite"]')
    expect(note.text()).toBe('No range here.')
    expect(note.classes()).toContain('aether-legend__note--warn')
    const swatch = note.find('.aether-legend__swatch')
    expect((swatch.element as HTMLElement).style.background).toBe('rgb(255, 255, 0)')
    expect(swatch.attributes('aria-hidden')).toBe('true')
    expect(w.find('.aether-legend__bar').exists()).toBe(false)
  })

  it.each(['zero', 'nonfinite'] as const)('adds no words of its own to %s: with none from the app it names the field and stops', (state) => {
    const w = mount(Legend, { props: { ...base, unit: 'MPa', state } })
    expect(w.text()).toBe('Stress MPa')
  })

  it('keeps the note to the states with no ramp', () => {
    const w = mount(Legend, { props: { ...base, note: 'No range here.' } })
    expect(ramp(w).exists(), 'precondition: the ramp is drawn').toBe(true)
    expect(w.text()).not.toContain('No range here.')
  })

  it('leaves the swatch out when it has no colour for one', () => {
    const w = mount(Legend, { props: { ...base, state: 'nonfinite' } })
    expect(w.find('[data-legend="nonfinite"]').exists()).toBe(true)
    expect(w.find('.aether-legend__swatch').exists()).toBe(false)
  })

  it('passes what the app puts on it to whichever element it draws', () => {
    for (const state of ['ramp', 'zero', 'nonfinite'] as const) {
      const w = mount(Legend, { props: { ...base, state }, attrs: { id: 'x' } })
      expect(w.attributes('id'), state).toBe('x')
    }
  })
})

describe('Legend: the rules jsdom does not apply', () => {
  const sheet = stylesOf('viz/vue/Legend.vue')

  it('gives the bar a height, or the ramp draws nothing', () => {
    expect(declared(sheet, '.aether-legend__bar').height).toBe('10px')
  })

  it('edges the bar, so a ramp as light as the panel keeps its ends', () => {
    expect(declared(sheet, '.aether-legend__bar').border).toBe('1px solid var(--aether-panel)')
  })

  it('sets the note with no range in the warning colour', () => {
    expect(declared(sheet, '.aether-legend__note--warn').color).toBe('var(--aether-warm-soft)')
  })
})
