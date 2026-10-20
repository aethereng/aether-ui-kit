import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatPanel from '../ChatPanel.vue'

/* The activity indicator above the compose box: the phase text and the clock, the quiet notice, the
 * one status message per phase change, and its removal when the turn ends. The clock runs on
 * Date.now(), which the fake timers move. */

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

type Activity = { since: number; phase: string; heardAt?: number; awaitsApi?: boolean; note?: string }

function mountPanel(activity: Activity | null, extra: Record<string, unknown> = {}) {
  wrapper = mount(ChatPanel, {
    props: { messages: [], modelValue: '', actions: 'assistant', activity, ...extra },
  })
  return wrapper
}

/** Moves the fake clock and lets the panel render what the ticks changed. */
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

const status = (w: VueWrapper) => w.find('.aether-chat__sr[role="status"] span').text()

describe('the activity indicator', () => {
  it('shows the phase text, and the time since the turn began, counted once a second', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const w = mountPanel({ since: 10_000, phase: 'Waiting for the API' })
    expect(w.find('.aether-chat__activity-phase').text()).toBe('Waiting for the API')
    expect(w.find('.aether-chat__activity-time').text()).toBe('0 s')
    await advance(7_000)
    expect(w.find('.aether-chat__activity-time').text()).toBe('7 s')
  })

  it('shows minutes and seconds once a minute has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const w = mountPanel({ since: 10_000, phase: 'Writing the answer' })
    await advance(65_000)
    expect(w.find('.aether-chat__activity-time').text()).toBe('1 min 05 s')
  })

  it('posts one status message when the phase changes, and none on the ticks between', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    // the turn starts after the panel is up, as it does in the app: the first phase is the start's message
    const w = mountPanel(null)
    await w.setProps({ activity: { since: 10_000, phase: 'Waiting for the API' } })
    expect(status(w)).toBe('Waiting for the API')
    const posted = w.find('.aether-chat__sr span').element
    await advance(3_000)
    // a tick changes only the clock: the status span is the same element, so nothing was posted
    expect(w.find('.aether-chat__sr span').element).toBe(posted)
    await w.setProps({ activity: { since: 10_000, phase: 'Running read_model' } })
    expect(status(w)).toBe('Running read_model')
  })

  it('posts "Done" when the turn ends, and takes the indicator and its clock away', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const timersBefore = vi.getTimerCount()
    const w = mountPanel({ since: 10_000, phase: 'Writing the answer' })
    await w.setProps({ activity: null })
    expect(w.find('.aether-chat__activity').exists()).toBe(false)
    expect(status(w)).toBe('Done')
    expect(vi.getTimerCount()).toBe(timersBefore)
  })

  it('counts a quiet spell from the moment the API last sent anything, and only while the API is awaited', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const quietText = (s: number) => `no word for ${s} s`
    const w = mountPanel({ since: 10_000, phase: 'Waiting for the API', heardAt: 10_000, awaitsApi: true }, { quietText })
    await advance(19_000)
    expect(w.find('.aether-chat__activity-quiet').exists()).toBe(false)
    await advance(1_000)
    expect(w.find('.aether-chat__activity-quiet').text()).toBe('no word for 20 s')
  })

  it('shows no quiet notice while a tool runs in the page, however long it takes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const quietText = (s: number) => `no word for ${s} s`
    const w = mountPanel({ since: 10_000, phase: 'Running read_model', heardAt: 10_000, awaitsApi: false }, { quietText })
    await advance(60_000)
    expect(w.find('.aether-chat__activity-quiet').exists()).toBe(false)
  })

  it('shows no quiet notice when the panel gives no words for one', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const w = mountPanel({ since: 10_000, phase: 'Waiting for the API', heardAt: 10_000, awaitsApi: true })
    await advance(60_000)
    expect(w.find('.aether-chat__activity-quiet').exists()).toBe(false)
  })

  it('shows the thinking note under the row when the app gives one', () => {
    vi.useFakeTimers()
    const w = mountPanel({ since: Date.now(), phase: 'Thinking', note: 'Weighing the two readings' })
    const note = w.find('.aether-chat__activity-note')
    expect(note.text()).toBe('Weighing the two readings')
    expect(w.find('.aether-chat__activity').element.contains(note.element)).toBe(true)
  })

  it('shows no thinking note when the app gives none, or an empty one', async () => {
    vi.useFakeTimers()
    const w = mountPanel({ since: Date.now(), phase: 'Thinking' })
    expect(w.find('.aether-chat__activity-note').exists()).toBe(false)
    await w.setProps({ activity: { since: Date.now(), phase: 'Thinking', note: '' } })
    expect(w.find('.aether-chat__activity-note').exists()).toBe(false)
  })

  it('hides the spinner from assistive technology, since the status message speaks', () => {
    vi.useFakeTimers()
    const w = mountPanel({ since: Date.now(), phase: 'Waiting for the API' })
    expect(w.find('.aether-chat__activity-spinner').attributes('aria-hidden')).toBe('true')
  })

  it('shows nothing for a relay panel, which has no indicator', () => {
    vi.useFakeTimers()
    const w = mountPanel({ since: Date.now(), phase: 'Waiting for the API' }, { actions: 'relay' })
    expect(w.find('.aether-chat__activity').exists()).toBe(false)
  })
})
