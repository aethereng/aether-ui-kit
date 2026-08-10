import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatPanel from '../ChatPanel.vue'
import type { ChatMessage } from '../../core'

/* Both real consumers (a file browser, a card board) shipped the export/import logic as
 * app-specific handlers wired to three emits -- this component's whole job is to fire the
 * RIGHT emit at the right moment and render what it's given. That's what these tests check:
 * the emit contract, the keyboard shortcut, the pending count, and the log's own upkeep
 * (auto-scroll, history cap) -- not any actual chat behaviour, which the kit never owns. */

const msgs = (): ChatMessage[] => [
  { role: 'sys', text: 'note one' },
  { role: 'you', text: 'queued one', queued: true, refs: ['a.md'] },
  { role: 'agent', text: 'reply one', refs: ['a.md', 'b.md'] },
]

function mountPanel(extra: Record<string, unknown> = {}) {
  return mount(ChatPanel, {
    props: { messages: msgs(), modelValue: '', ...extra },
    attachTo: document.body,
  })
}

beforeAll(() => {
  // jsdom never lays out scrollable content -- scrollHeight is always 0 -- so the auto-scroll
  // test below stubs it to a value that would be visibly wrong if left un-applied
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() { return 480 },
  })
})

describe('ChatPanel renders what it is given', () => {
  it('renders one row per message, in order', () => {
    const w = mountPanel()
    const rows = w.findAll('.aether-chat__msg')
    expect(rows.length).toBe(3)
    expect(rows.map((r) => r.find('.aether-chat__txt').text())).toEqual([
      'note one',
      'queued one',
      'reply one',
    ])
  })

  it('labels each role and marks a queued message', () => {
    const w = mountPanel()
    const rows = w.findAll('.aether-chat__msg')
    expect(rows[0]!.find('.aether-chat__who').text()).toBe('note')
    expect(rows[1]!.find('.aether-chat__who').text()).toBe('you · queued')
    expect(rows[1]!.classes()).toContain('queued')
    expect(rows[2]!.find('.aether-chat__who').text()).toBe('agent')
    expect(rows[2]!.classes()).not.toContain('queued')
  })

  it('singularises the ref label for one ref, pluralises for several', () => {
    const w = mountPanel()
    const rows = w.findAll('.aether-chat__msg')
    expect(rows[1]!.find('.aether-chat__ref').text()).toBe('ref: a.md')
    expect(rows[2]!.find('.aether-chat__ref').text()).toBe('refs: a.md · b.md')
  })

  it('omits the ref line entirely when there are none', () => {
    const w = mountPanel()
    expect(w.findAll('.aether-chat__msg')[0]!.find('.aether-chat__ref').exists()).toBe(false)
  })

  it('shows the empty slot only when there are no messages, and hides the list', () => {
    const empty = mount(ChatPanel, {
      props: { messages: [], modelValue: '' },
      slots: { empty: '<i>how this works</i>' },
    })
    expect(empty.find('.aether-chat__msg--sys').html()).toContain('how this works')
    expect(empty.findAll('.aether-chat__msg').length).toBe(1)

    // msgs() itself includes a real 'sys'-role message, so the presence of ANY --sys row
    // proves nothing on its own -- the row count is the real assertion: exactly the 3 seeded
    // messages, no extra placeholder row sitting alongside them
    const full = mountPanel()
    expect(full.findAll('.aether-chat__msg').length).toBe(3)
  })

  it('caps the rendered log at historyLimit, keeping the most recent', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ role: 'sys', text: 'm' + i }) as ChatMessage)
    const w = mount(ChatPanel, { props: { messages: many, modelValue: '', historyLimit: 3 } })
    expect(w.findAll('.aether-chat__txt').map((t) => t.text())).toEqual(['m7', 'm8', 'm9'])
  })
})

describe('ChatPanel pending count', () => {
  it('counts only queued messages from "you"', () => {
    const w = mountPanel()
    expect(w.find('.aether-chat__hint').text()).toBe('1 queued')
  })

  it('reads "nothing queued" when nothing is', () => {
    const w = mount(ChatPanel, { props: { messages: msgs().map((m) => ({ ...m, queued: false })), modelValue: '' } })
    expect(w.find('.aether-chat__hint').text()).toBe('nothing queued')
  })
})

describe('ChatPanel is controlled: compose text is a prop, not internal state', () => {
  it('shows exactly the modelValue it is given', () => {
    const w = mountPanel({ modelValue: 'draft text' })
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('draft text')
  })

  it('emits update:modelValue on input, and obeys the prop rather than remembering the edit', async () => {
    const w = mountPanel({ modelValue: 'a' })
    const ta = w.find('textarea')
    await ta.setValue('ab')
    expect(w.emitted('update:modelValue')![0]).toEqual(['ab'])
    // an uncontrolled / v-model-sugar implementation would keep showing 'ab' forever, since
    // it would be reading its own local state rather than the prop. Setting a DIFFERENT prop
    // value (as the host does when it rejects an edit, e.g. failed validation) must win.
    await w.setProps({ modelValue: 'REJECTED' })
    expect((ta.element as HTMLTextAreaElement).value).toBe('REJECTED')
  })
})

describe('ChatPanel emits: buttons and the queue shortcut', () => {
  it('emits queue / send / apply-reply from their own buttons, and nothing else', async () => {
    const w = mountPanel()
    const buttons = w.findAll('button')
    await buttons[0]!.trigger('click') // Queue
    await buttons[1]!.trigger('click') // Send
    await buttons[2]!.trigger('click') // Apply reply
    expect(w.emitted('queue')?.length).toBe(1)
    expect(w.emitted('send')?.length).toBe(1)
    expect(w.emitted('apply-reply')?.length).toBe(1)
  })

  it('the Queue button carries the hot styling, the other two do not', () => {
    const w = mountPanel()
    const buttons = w.findAll('button')
    expect(buttons[0]!.classes()).toContain('hot')
    expect(buttons[1]!.classes()).not.toContain('hot')
    expect(buttons[2]!.classes()).not.toContain('hot')
  })

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
  ])('Enter+%s in the textarea emits queue', async (_label, mods) => {
    const w = mountPanel()
    await w.find('textarea').trigger('keydown', { key: 'Enter', ...mods })
    expect(w.emitted('queue')?.length).toBe(1)
  })

  it('a bare Enter does not queue -- only the modified combo does', async () => {
    const w = mountPanel()
    await w.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('queue')).toBeUndefined()
  })
})

describe('ChatPanel log upkeep', () => {
  it('scrolls to the bottom when a message is appended', async () => {
    const w = mountPanel()
    const log = w.find('.aether-chat__log').element as HTMLElement
    expect(log.scrollTop).toBe(0)
    await w.setProps({ messages: [...msgs(), { role: 'sys', text: 'new' }] })
    await nextTick() // the watcher's own nextTick() is a second hop past setProps's flush
    expect(log.scrollTop).toBe(480) // the stubbed scrollHeight -- proof the watcher fired
  })

  it('exposes focus() for a host that needs to prefill and jump to the box', () => {
    const w = mountPanel()
    expect(document.activeElement).not.toBe(w.find('textarea').element)
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(w.find('textarea').element)
  })
})
