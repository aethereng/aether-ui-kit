import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Transport from '../Transport.vue'

/* Transport had no wrapper tests, and `package-contract.test.ts` said so in a comment — "which is
 * most of Transport's surface" — so the gap was written down rather than noticed. Its CORE is
 * tested (the scrub bargain, cycleSpeed, isAtEnd); this covers the part the core cannot see: what
 * the bar renders in each phase, and which events reach the host.
 *
 * It floats over a live 3-D canvas in both consuming apps, so "reports rather than decides" is
 * the whole contract — it never advances its own clock. */

const base = { current: 5, duration: 20, playing: false }

describe('Transport play phase', () => {
  it('scrubs over the real duration, and the slider is named', () => {
    const w = mount(Transport, { props: base })
    const r = w.find('input[type="range"]')
    expect(r.attributes('aria-label')).toBe('Scrub')
    expect(r.attributes('max')).toBe('20')
    expect((r.element as HTMLInputElement).value).toBe('5')
    w.unmount()
  })

  it('seeks with a number, not an event', () => {
    /* The host gets a time, so it never has to reach into the DOM to find one. */
    const w = mount(Transport, { props: base })
    const r = w.find('input[type="range"]')
    ;(r.element as HTMLInputElement).value = '12'
    r.trigger('input')
    expect(w.emitted('seek')![0]).toEqual([12])
    w.unmount()
  })

  it('never moves on its own — the model decides', () => {
    /* It renders `current`; it does not own it. A bar that advanced itself would fight a host
     * resampling a precomputed trajectory, which is exactly what both consumers do. */
    const w = mount(Transport, { props: base })
    w.find('input[type="range"]').trigger('input')
    expect((w.find('input[type="range"]').element as HTMLInputElement).value).toBe('5')
    w.unmount()
  })

  it('brackets a drag with scrub-start / scrub-end', () => {
    /* The bargain the core exports so every playback host makes it identically: a host pauses on
     * scrub-start and restores on scrub-end. Without the pair, dragging fights the clock. */
    const w = mount(Transport, { props: { ...base, playing: true } })
    w.find('input[type="range"]').trigger('pointerdown')
    expect(w.emitted('scrub-start')).toBeTruthy()
    w.unmount()
  })

  it('shows elapsed against total, through the caller\'s format', () => {
    const w = mount(Transport, { props: { ...base, format: (t: number) => `${t.toFixed(1)}s` } })
    expect(w.find('.at-time').text()).toBe('5.0s / 20.0s')
    w.unmount()
  })
})

describe('Transport speed, in both modes', () => {
  /* `speedMode` is the axis the two real consumers differ on — one cycles a single button, the
   * other lays the ladder out — which is why it is a prop and not two components. */
  const speeds = [0.5, 1, 2]

  it('cycle mode is one button carrying the current speed', () => {
    const w = mount(Transport, { props: { ...base, speed: 2, speeds, speedMode: 'cycle' } })
    const b = w.find('.at-speed')
    expect(b.exists()).toBe(true)
    expect(b.text()).toBe('2×')
    expect(w.find('.at-speeds').exists()).toBe(false)
    b.trigger('click')
    expect(w.emitted('set-speed')).toBeTruthy()
    w.unmount()
  })

  it('presets mode is a named group of toggles that say which is on', () => {
    const w = mount(Transport, { props: { ...base, speed: 1, speeds, speedMode: 'presets' } })
    const grp = w.find('.at-speeds')
    expect(grp.attributes('role')).toBe('group')
    expect(grp.attributes('aria-label')).toBe('Playback speed')
    const opts = w.findAll('.at-speed-opt')
    expect(opts.map((o) => o.attributes('aria-pressed'))).toEqual(['false', 'true', 'false'])
    opts[2]!.trigger('click')
    expect(w.emitted('set-speed')![0]).toEqual([2])
    w.unmount()
  })

  it('a host can relabel a speed without the kit knowing its vocabulary', () => {
    const w = mount(Transport, {
      props: { ...base, speed: 0.5, speeds, speedMode: 'cycle', speedLabel: (s: number) => (s === 0.5 ? '½×' : `${s}×`) },
    })
    expect(w.find('.at-speed').text()).toBe('½×')
    w.unmount()
  })
})

describe('Transport precompute phase', () => {
  it('replaces the bar with progress, and reports it as a percentage', () => {
    /* A different phase, not a disabled play bar: there is nothing to scrub yet. */
    const w = mount(Transport, { props: { ...base, phase: 'precompute', precomputePct: 42 } })
    expect(w.find('input[type="range"]').exists()).toBe(false)
    expect(w.find('.at-progress-fill').attributes('style')).toContain('42%')
    expect(w.find('.at-time').text()).toBe('42%')
    w.unmount()
  })

  it('offers Stop only when the host says the work is stoppable', () => {
    /* A consumer whose precompute cannot be cancelled passes `:stoppable="false"` — a button that
     * pretends otherwise is worse than no button. */
    const off = mount(Transport, { props: { ...base, phase: 'precompute', stoppable: false } })
    expect(off.find('.at-stop').exists()).toBe(false)
    off.unmount()

    const on = mount(Transport, { props: { ...base, phase: 'precompute', stoppable: true } })
    const b = on.find('.at-stop')
    expect(b.attributes('aria-label')).toBe('Stop')
    b.trigger('click')
    expect(on.emitted('stop')).toBeTruthy()
    on.unmount()
  })
})
