import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferredFlag } from '../deferred'

/* The flag's two guards, at their edges: it shows only once the source has been up the delay, and
 * stays up the minimum time once shown. The clock is faked whole, `performance.now()` included,
 * since the minimum is measured on it. */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})
afterEach(() => {
  vi.useRealTimers()
})

function watched(options?: Parameters<typeof deferredFlag>[1]) {
  const heard: boolean[] = []
  const flag = deferredFlag((on) => heard.push(on), options)
  return { flag, heard }
}

describe('deferredFlag', () => {
  it('shows once the source has been up 180 ms, and not a millisecond before', () => {
    const { flag, heard } = watched()
    flag.set(true)
    vi.advanceTimersByTime(179)
    expect(flag.visible).toBe(false)
    expect(heard).toEqual([])
    vi.advanceTimersByTime(1)
    expect(flag.visible).toBe(true)
    expect(heard).toEqual([true])
  })

  it('never shows for work that ends inside the delay', () => {
    const { flag, heard } = watched()
    flag.set(true)
    vi.advanceTimersByTime(150)
    flag.set(false)
    vi.advanceTimersByTime(2000)
    expect(flag.visible).toBe(false)
    expect(heard).toEqual([])
  })

  it('stays up 420 ms once shown, however soon the source goes down', () => {
    const { flag, heard } = watched()
    flag.set(true)
    vi.advanceTimersByTime(180)
    vi.advanceTimersByTime(100)
    flag.set(false)
    vi.advanceTimersByTime(319)
    expect(flag.visible).toBe(true)
    vi.advanceTimersByTime(1)
    expect(flag.visible).toBe(false)
    expect(heard).toEqual([true, false])
  })

  it('goes down at once when it has already shown the minimum', () => {
    const { flag, heard } = watched()
    flag.set(true)
    vi.advanceTimersByTime(180 + 1000)
    flag.set(false)
    vi.advanceTimersByTime(0)
    expect(flag.visible).toBe(false)
    expect(heard).toEqual([true, false])
  })

  it('stays up when the source comes back while it is going down', () => {
    const { flag, heard } = watched()
    flag.set(true)
    vi.advanceTimersByTime(180)
    flag.set(false)
    vi.advanceTimersByTime(100)
    flag.set(true)
    vi.advanceTimersByTime(5000)
    expect(flag.visible).toBe(true)
    expect(heard).toEqual([true])
  })

  it('takes its own delay and minimum', () => {
    const { flag, heard } = watched({ showDelayMs: 50, minVisibleMs: 1000 })
    flag.set(true)
    vi.advanceTimersByTime(50)
    expect(flag.visible).toBe(true)
    flag.set(false)
    vi.advanceTimersByTime(999)
    expect(flag.visible).toBe(true)
    vi.advanceTimersByTime(1)
    expect(heard).toEqual([true, false])
  })

  it('stop cancels a change still waiting, and the flag keeps what it shows', () => {
    const { flag, heard } = watched()
    flag.set(true)
    flag.stop()
    vi.advanceTimersByTime(2000)
    expect(flag.visible).toBe(false)

    flag.set(true)
    vi.advanceTimersByTime(180)
    flag.set(false)
    flag.stop()
    vi.advanceTimersByTime(2000)
    expect(flag.visible).toBe(true)
    expect(heard).toEqual([true])
    expect(vi.getTimerCount()).toBe(0)
  })
})
