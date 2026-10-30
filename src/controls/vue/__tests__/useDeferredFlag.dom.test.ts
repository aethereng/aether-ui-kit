import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useDeferredFlag } from '../composables'

/* The Vue form of deferredFlag: what it reads from its source, and that its timers stop with the
 * component. The rules themselves are tested in controls/core. */

afterEach(() => {
  vi.useRealTimers()
})

describe('useDeferredFlag', () => {
  const source = ref(false)
  const Busy = defineComponent({
    props: { showDelayMs: { type: Number, default: undefined }, minVisibleMs: { type: Number, default: undefined } },
    setup(props) {
      const shown = useDeferredFlag(source, props.showDelayMs === undefined ? undefined : { showDelayMs: props.showDelayMs, minVisibleMs: props.minVisibleMs })
      return () => h('p', shown.value ? 'busy' : 'idle')
    },
  })

  it('shows the flag 180 ms after its source goes up, and keeps it 420 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    source.value = false
    const w = mount(Busy)
    source.value = true
    await nextTick()
    vi.advanceTimersByTime(179)
    await nextTick()
    expect(w.text()).toBe('idle')
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(w.text()).toBe('busy')
    source.value = false
    await nextTick()
    vi.advanceTimersByTime(419)
    await nextTick()
    expect(w.text()).toBe('busy')
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(w.text()).toBe('idle')
    w.unmount()
  })

  it('reads a source already up when it is made', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    source.value = true
    const w = mount(Busy)
    vi.advanceTimersByTime(180)
    await nextTick()
    expect(w.text()).toBe('busy')
    w.unmount()
    source.value = false
  })

  it('passes its own delay and minimum to the core', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    source.value = false
    const w = mount(Busy, { props: { showDelayMs: 20, minVisibleMs: 50 } })
    source.value = true
    await nextTick()
    vi.advanceTimersByTime(20)
    await nextTick()
    expect(w.text()).toBe('busy')
    source.value = false
    await nextTick()
    vi.advanceTimersByTime(50)
    await nextTick()
    expect(w.text()).toBe('idle')
    w.unmount()
  })

  it('stops its timers with the component', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    source.value = false
    const w = mount(Busy)
    source.value = true
    await nextTick()
    expect(vi.getTimerCount(), 'precondition: the show is waiting').toBe(1)
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
    source.value = false
  })
})
