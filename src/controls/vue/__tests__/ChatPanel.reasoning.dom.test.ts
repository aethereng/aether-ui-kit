import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatPanel from '../ChatPanel.vue'
import { STREAM_FOLLOW_THRESHOLD, type ChatEntry } from '../../core'

/* The reasoning in the assistant panel: the line beside the clock, the whole reasoning behind "Show
 * reasoning" (a box that follows new text only while the reader is at its bottom), and the reasoning
 * kept folded under a settled reply. */

type Activity = { since: number; phase: string; reasoning?: string; note?: string }

const wrappers: VueWrapper[] = []
function mountPanel(activity: Activity | null, messages: ChatEntry[] = []) {
  const w = mount(ChatPanel, { props: { messages, modelValue: '', actions: 'assistant', activity } })
  wrappers.push(w as unknown as VueWrapper)
  return w
}
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

const turn = (extra: Partial<Activity> = {}): Activity => ({ since: Date.now(), phase: 'Thinking', ...extra })
const line = (w: VueWrapper) => w.find('.aether-chat__activity-note')
const box = (w: VueWrapper) => w.find('.aether-chat__activity-reasoning pre')

describe('the thinking line beside the clock', () => {
  it('shows the first sentence of the paragraph the reasoning is on, after the clock', () => {
    const w = mountPanel(turn({ reasoning: 'Weighing the two readings. Then the third.' }))
    expect(line(w).text()).toBe('Weighing the two readings.')
    const time = w.find('.aether-chat__activity-time').element
    expect(time.compareDocumentPosition(line(w).element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the line while the same paragraph grows, and changes only when a new paragraph starts', async () => {
    const w = mountPanel(turn({ reasoning: 'First one. Second part.' }))
    expect(line(w).text()).toBe('First one.')
    await w.setProps({ activity: turn({ reasoning: 'First one. Second part, still going on' }) })
    expect(line(w).text()).toBe('First one.')
    await w.setProps({ activity: turn({ reasoning: 'First one. Second part, still going on.\n\nNew paragraph starts here.' }) })
    expect(line(w).text()).toBe('New paragraph starts here.')
  })

  it('negative arm: an unfinished first sentence shows what is there so far, and grows', async () => {
    const w = mountPanel(turn({ reasoning: 'Weigh' }))
    expect(line(w).text()).toBe('Weigh')
    await w.setProps({ activity: turn({ reasoning: 'Weighing the two' }) })
    expect(line(w).text()).toBe('Weighing the two')
  })

  it('keeps the last line when a blank break has opened a paragraph with no text yet', () => {
    const w = mountPanel(turn({ reasoning: 'One. Two.\n\n' }))
    expect(line(w).text()).toBe('One.')
  })

  it('shows the note as the line when the app gives no reasoning', () => {
    const w = mountPanel(turn({ note: 'Weighing the two readings' }))
    expect(line(w).text()).toBe('Weighing the two readings')
  })

  it('negative arm: blank reasoning and no note give no line', () => {
    const w = mountPanel(turn({ reasoning: '   \n\n  ' }))
    expect(line(w).exists()).toBe(false)
  })
})

describe('Show reasoning', () => {
  it('holds the whole reasoning so far, behind a control that is closed at first', () => {
    const w = mountPanel(turn({ reasoning: 'One. Two. Three.' }))
    const details = w.find('.aether-chat__activity-reasoning').element as HTMLDetailsElement
    expect(w.find('.aether-chat__activity-reasoning > summary').text()).toBe('Show reasoning')
    expect(details.open).toBe(false)
    expect(box(w).text()).toBe('One. Two. Three.')
  })

  it('negative arm: no reasoning, no control', () => {
    const w = mountPanel(turn({ note: 'a line' }))
    expect(w.find('.aether-chat__activity-reasoning').exists()).toBe(false)
  })

  const VIEW = 100
  function layout(w: VueWrapper) {
    const el = box(w).element as HTMLElement
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => VIEW })
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => VIEW + 10 * (el.textContent ?? '').length,
    })
    return el
  }
  const GROWN = ' and a good many more words arrive'

  it('follows new text while the reader is at the bottom of the box', async () => {
    const w = mountPanel(turn({ reasoning: 'Start' }))
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    await w.setProps({ activity: turn({ reasoning: 'Start' + GROWN }) })
    await nextTick()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('negative arm: scrolled up, the same growth leaves the box where the reader put it', async () => {
    const w = mountPanel(turn({ reasoning: 'Start' }))
    const el = layout(w)
    el.scrollTop = 0
    expect(el.scrollHeight - el.scrollTop - el.clientHeight).toBeGreaterThan(STREAM_FOLLOW_THRESHOLD)
    await w.setProps({ activity: turn({ reasoning: 'Start' + GROWN }) })
    await nextTick()
    expect(el.scrollTop).toBe(0)
  })

  it('shows the newest text when the reader opens the box', async () => {
    const w = mountPanel(turn({ reasoning: 'Start' + GROWN }))
    const el = layout(w)
    el.scrollTop = 0
    const details = w.find('.aether-chat__activity-reasoning').element as HTMLDetailsElement
    details.open = true
    w.find('.aether-chat__activity-reasoning').trigger('toggle')
    await nextTick()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })
})

describe('the reasoning kept under a settled reply', () => {
  it('stays folded under its reply, closed, with the whole text behind its summary', () => {
    const w = mountPanel(null, [{ role: 'agent', text: 'Answer.', reasoning: 'Weighed it. Then chose.' }])
    const folded = w.find('.aether-chat__reasoning')
    expect(folded.find('summary').text()).toBe('Reasoning')
    expect((folded.element as HTMLDetailsElement).open).toBe(false)
    expect(folded.find('pre').text()).toBe('Weighed it. Then chose.')
  })

  it('negative arm: a reply with no reasoning has no folded block, and neither does the person', () => {
    const w = mountPanel(null, [
      { role: 'agent', text: 'Answer.' },
      { role: 'you', text: 'A question.', reasoning: 'not shown' },
    ])
    expect(w.find('.aether-chat__reasoning').exists()).toBe(false)
  })
})
