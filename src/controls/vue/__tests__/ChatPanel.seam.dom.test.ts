import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import ChatPanel from '../ChatPanel.vue'
import ChatRefChip from '../ChatRefChip.vue'
import { usableMarks, type ChatEntry, type ChatMessage } from '../../core'
import { declared, stylesOf } from '../../../__tests__/sfcRules'

/* What a caller adds around the panel: its own entries, an addition to a text message, a part above the
 * box, its own actions and shortcut, the word over a reply and a line to the live region. Each is held
 * with nothing else in the panel's way, and the first block shows the panel works with none of them. */

const NOTICE = { kind: 'notice', text: 'a line from the host' }
const OTHER = { kind: 'other', text: 'a different line' }
const reply = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ role: 'reply', text, ...extra })

const wrappers: VueWrapper[] = []
function mountPanel(messages: ChatEntry[], props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  const w = mount(ChatPanel, { props: { messages, modelValue: '', ...props }, slots, attachTo: document.body } as never)
  wrappers.push(w as unknown as VueWrapper)
  return w as unknown as VueWrapper
}
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

describe('a chat with nothing added', () => {
  it('runs the whole plain round: type, queue, send, apply a reply', async () => {
    const messages: ChatEntry[] = []
    const w = mountPanel(messages)
    await w.find('textarea').setValue('a request')
    expect(w.emitted('update:modelValue')).toEqual([['a request']])
    await w.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(w.emitted('queue')).toHaveLength(1)
    await w.setProps({ messages: [{ role: 'you', text: 'a request', queued: true }] })
    expect(w.find('.aether-chat__hint').text()).toBe('1 queued')
    const [queue, send, apply] = w.findAll('button')
    await queue!.trigger('click')
    await send!.trigger('click')
    await apply!.trigger('click')
    expect(w.emitted('queue')).toHaveLength(2)
    expect(w.emitted('send')).toHaveLength(1)
    expect(w.emitted('apply-reply')).toHaveLength(1)
    await w.setProps({ messages: [{ role: 'you', text: 'a request' }, reply('the answer')] })
    expect(w.findAll('.aether-chat__txt').map((t) => t.text())).toEqual(['a request', 'the answer'])
    expect(w.find('.aether-chat__hint').text()).toBe('nothing queued')
  })

  it('draws a rich log with no slot filled: markdown, a chip, a mark, a caret and a settled line', async () => {
    const text = 'Max **{{r1:a.b}}** of 12'
    const start = text.indexOf('12')
    const w = mountPanel([reply(text, { streaming: true, marks: [{ start, end: start + 2, kind: 'bare' }] })], {
      rich: true,
      resolveRef: () => ({ value: '3', unit: 'm', source: { kind: 'run', id: 'r1', hash: 'abc' }, path: 'a.b', provenance: null }),
    })
    expect(w.find('strong button.aether-chat-chip').text()).toContain('3 m')
    expect(w.find('mark').text()).toContain('12')
    expect(w.find('.aether-chat__caret').exists()).toBe(true)
    await w.setProps({ messages: [reply(text, { marks: [{ start, end: start + 2, kind: 'bare' }] })] })
    await nextTick()
    await nextTick()
    expect(w.find('.aether-chat__caret').exists()).toBe(false)
    expect(w.find('[role="status"]').text()).toContain('a.b: 3 m')
  })

  it('draws nothing of any addition', () => {
    const w = mountPanel([reply('one'), NOTICE as ChatEntry])
    expect(w.findAll('.aether-chat__log > *')).toHaveLength(1)
    expect(w.find('.aether-chat').element.children).toHaveLength(2)
  })
})

describe('the entry slot', () => {
  const entry = (p: { entry: { kind: string; text: string } }) => h('p', { class: 'mine' }, p.entry.kind + ': ' + p.entry.text)

  it('draws each entry of the caller\'s kind where it stands, and leaves the text messages to the panel', () => {
    const w = mountPanel([reply('first'), NOTICE as ChatEntry, { role: 'you', text: 'second' }, OTHER as ChatEntry], {}, { entry })
    expect(Array.from(w.find('.aether-chat__log').element.children, (e) => e.textContent)).toEqual([
      'replyfirst',
      'notice: a line from the host',
      'yousecond',
      'other: a different line',
    ])
  })

  it('is not asked to draw a text message, with its kind written or left out', () => {
    const asked: string[] = []
    mountPanel([reply('a'), { kind: 'text', role: 'you', text: 'b' }, NOTICE as ChatEntry], {}, {
      entry: (p: { entry: { kind: string } }) => {
        asked.push(p.entry.kind)
        return h('i')
      },
    })
    expect(asked).toEqual(['notice'])
  })

  it('counts its entries in the history cap', () => {
    const w = mountPanel([NOTICE as ChatEntry, reply('newest')], { historyLimit: 1 }, { entry })
    expect(w.find('.mine').exists()).toBe(false)
    expect(w.find('.aether-chat__txt').text()).toBe('newest')
  })

  it('shows the empty slot only when the log holds no entry of any kind', async () => {
    const w = mountPanel([], {}, { empty: '<i class="empty">nothing yet</i>', entry })
    expect(w.find('.empty').exists()).toBe(true)
    await w.setProps({ messages: [NOTICE] })
    expect(w.find('.empty').exists()).toBe(false)
    expect(w.find('.mine').exists()).toBe(true)
  })
})

describe('the message-extra slot', () => {
  it('renders once inside each text message, with the message as its prop, and never for an entry of another kind', () => {
    const seen: unknown[] = []
    const messages = [reply('one'), { role: 'you', text: 'two' } as ChatMessage, NOTICE as ChatEntry]
    const w = mountPanel(messages, {}, {
      'message-extra': (p: { message: ChatEntry }) => {
        seen.push(p.message)
        return h('i', { class: 'extra' })
      },
    })
    expect(w.findAll('.aether-chat__msg').map((m) => m.findAll('.extra').length)).toEqual([1, 1])
    expect(seen).toEqual(messages.slice(0, 2))
  })

  it('sits after the reference line, inside the bubble', () => {
    const w = mountPanel([reply('one', { refs: ['a.md'] })], {}, { 'message-extra': () => h('i', { class: 'extra' }) })
    const bubble = w.find('.aether-chat__msg').element
    expect(bubble.lastElementChild!.className).toBe('extra')
    expect(bubble.lastElementChild!.previousElementSibling!.className).toBe('aether-chat__ref')
  })
})

describe('the above-compose slot', () => {
  it('sits between the log and the compose box', () => {
    const w = mountPanel([], {}, { 'above-compose': () => h('p', { class: 'above' }, 'working') })
    const parts = Array.from(w.find('.aether-chat').element.children, (e) => e.className)
    expect(parts).toEqual(['aether-chat__log', 'above', 'aether-chat__compose'])
  })

  it('draws nothing there when the slot is empty', () => {
    const parts = Array.from(mountPanel([]).find('.aether-chat').element.children, (e) => e.className)
    expect(parts).toEqual(['aether-chat__log', 'aether-chat__compose'])
  })
})

describe('the actions slot and the shortcut', () => {
  it('replaces the three buttons and the queued count, and leaves the box', () => {
    const w = mountPanel([], {}, { actions: () => h('button', { class: 'mine' }, 'Go') })
    expect(w.findAll('.aether-chat__actions button').map((b) => b.text())).toEqual(['Go'])
    expect(w.find('.aether-chat__hint').exists()).toBe(false)
    expect(w.find('.aether-chat__compose textarea').exists()).toBe(true)
  })

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
  ])('Enter+%s asks for send when the shortcut says so, and queues nothing', async (_n, mods) => {
    const w = mountPanel([], { shortcut: 'send' })
    await w.find('textarea').trigger('keydown', { key: 'Enter', ...mods })
    expect(w.emitted('send')).toHaveLength(1)
    expect(w.emitted('queue')).toBeUndefined()
  })

  it('negative arm: a bare Enter asks for nothing under either shortcut', async () => {
    for (const shortcut of ['queue', 'send']) {
      const w = mountPanel([], { shortcut })
      await w.find('textarea').trigger('keydown', { key: 'Enter' })
      expect(w.emitted('send')).toBeUndefined()
      expect(w.emitted('queue')).toBeUndefined()
    }
  })
})

describe('the word over a reply', () => {
  it('is the caller\'s, and only a reply takes it', () => {
    const w = mountPanel([reply('a'), { role: 'you', text: 'b' }, { role: 'sys', text: 'c' }], { replyLabel: 'host' })
    expect(w.findAll('.aether-chat__who').map((x) => x.text())).toEqual(['host', 'you', 'note'])
  })

  it('reads reply when the caller gives none', () => {
    expect(mountPanel([reply('a')]).find('.aether-chat__who').text()).toBe('reply')
  })
})

describe('announce', () => {
  const panel = (w: VueWrapper) => w.getCurrentComponent().exposed as { announce: (text: string) => void }

  it('posts a line to the one live region, as a new child each time', async () => {
    const w = mountPanel([], { rich: true })
    const region = w.find('[role="status"]').element
    panel(w).announce('Working')
    await nextTick()
    const first = region.firstElementChild
    expect(region.textContent).toBe('Working')
    panel(w).announce('Working')
    await nextTick()
    expect(region.textContent).toBe('Working')
    expect(region.firstElementChild).not.toBe(first)
    expect(w.findAll('[role="status"]')).toHaveLength(1)
  })

  it('negative arm: a plain log has no region, and a call changes nothing it draws', async () => {
    const w = mountPanel([reply('a')])
    const before = w.html()
    panel(w).announce('Working')
    await nextTick()
    expect(w.find('[role="status"]').exists()).toBe(false)
    expect(w.html()).toBe(before)
  })
})

describe('the rich log holds the live region', () => {
  it('carries the class only when rich, and the class is the region\'s containing block', () => {
    expect(mountPanel([], { rich: true }).find('.aether-chat__log').classes()).toContain('aether-chat__log--rich')
    expect(mountPanel([]).find('.aether-chat__log').classes()).not.toContain('aether-chat__log--rich')
    expect(declared(stylesOf('controls/vue/ChatPanel.vue'), '.aether-chat__log--rich')['position']).toBe('relative')
  })
})

describe('the parts a caller\'s entry draws with', () => {
  it('the chip works outside the panel, with no scope list and no log', async () => {
    const chip = mount(ChatRefChip, { props: { reference: 'r1:a', data: null } })
    expect(chip.classes()).toContain('aether-chat-chip--unresolved')
    await chip.trigger('click')
    expect(chip.emitted('open')).toEqual([['r1:a']])
  })

  it('usableMarks keeps whole spans in order and drops what cannot be drawn', () => {
    const marks = [
      { start: 4, end: 6, kind: 'second' },
      { start: 0, end: 2, kind: 'first' },
      { start: 1, end: 3, kind: 'overlaps' },
      { start: 5, end: 99, kind: 'long' },
    ]
    expect(usableMarks('abcdefg', marks).map((k) => k.kind)).toEqual(['first', 'second'])
    expect(usableMarks('abc')).toEqual([])
  })

  it('a mark and the hidden text beside it take their rules from the shared sheet, which a caller\'s entry can reach', () => {
    const el = document.createElement('style')
    el.textContent = readFileSync(resolve(__dirname, '../../../styles/ui-kit.css'), 'utf8')
    document.head.append(el)
    expect(declared(el.sheet!, '.aether-chat__mark')['text-decoration']).toContain('wavy')
    expect(declared(el.sheet!, '.aether-chat__sr')['position']).toBe('absolute')
    expect(declared(el.sheet!, '.aether-chat__sr')['clip-path']).toBe('inset(50%)')
    expect(declared(el.sheet!, '.aether-chat__msg--reply')['align-self']).toBe('flex-start')
    el.remove()
    const panel = readFileSync(resolve(__dirname, '../ChatPanel.vue'), 'utf8')
    expect(panel.includes('.aether-chat__mark {')).toBe(false)
    expect(panel.includes('.aether-chat__sr {')).toBe(false)
  })
})
