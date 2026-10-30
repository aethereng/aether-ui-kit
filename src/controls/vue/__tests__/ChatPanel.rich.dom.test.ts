import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive } from 'vue'
import ChatPanel from '../ChatPanel.vue'
import ChatRefChip from '../ChatRefChip.vue'
import { STREAM_FOLLOW_THRESHOLD } from '../../core'
import type { ChatEntry, ChatMessage, RefChipData } from '../../core'

/* A rich log: reference chips, marks, the live region and the follow-the-stream rule.
 * ChatPanel.dom.test.ts holds the plain contract; the first block here is its counterpart, proving
 * that nothing below reaches a plain log.
 *
 * jsdom does no layout, so the scroll tests stub clientHeight and make scrollHeight track the
 * log's own text. That is the part that matters: the panel has to measure BEFORE the render that
 * grows the log, and a constant scrollHeight could not tell a panel that does from one that
 * measures afterwards and never follows anything. */

const RUN: RefChipData = {
  value: '0.0123',
  unit: 'm',
  source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a6b7c' },
  path: 'summary.max_abs_displacement',
  provenance: 'Example provenance line.',
}
const KNOWN: Record<string, RefChipData> = {
  'r1:summary.max_abs_displacement': RUN,
  'p2:rows.count': {
    value: '3',
    unit: null,
    source: { kind: 'proposal', id: 'p2', hash: 'a9e07f1abcdef012' },
    path: 'rows.count',
    provenance: null,
  },
  'c:limits.value': {
    value: '1.37',
    unit: null,
    source: { kind: 'capabilities', id: null, hash: '9c04e2d11223344' },
    path: 'limits.value',
    provenance: null,
  },
  'r1:summary.reduced': { ...RUN, path: 'summary.reduced', reduced: true },
}
const resolveRef = (ref: string): RefChipData | null => KNOWN[ref] ?? null
const REF = '{{r1:summary.max_abs_displacement}}'
const UNKNOWN_REF = '{{r9:no.such.path}}'
/* An entry of the caller's own kind. No test here fills the entry slot, so it draws as nothing and still
 * counts in the log. */
const NOTICE = { kind: 'notice', text: 'a line from the host' } as ChatEntry

const wrappers: VueWrapper[] = []
function mountPanel(messages: ChatEntry[], props: Record<string, unknown> = {}, slots = {}) {
  const w = mount(ChatPanel, {
    props: { messages, modelValue: '', rich: true, resolveRef, ...props },
    slots,
    attachTo: document.body,
  })
  wrappers.push(w as unknown as VueWrapper)
  return w
}
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

/* The app grows a message in place on a reactive array, which is how a stream is usually driven:
 * the panel is handed the array itself and sees no new prop value. */
function mountHost(messages: ChatEntry[]) {
  const Host = defineComponent({
    render: () => h(ChatPanel, { messages, modelValue: '', rich: true, resolveRef }),
  })
  const w = mount(Host, { attachTo: document.body })
  wrappers.push(w as unknown as VueWrapper)
  return w
}

const reply = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  kind: 'text',
  role: 'reply',
  text,
  ...extra,
})

/* The accessible name the way a browser builds it, for the elements this file inspects:
 * aria-label, then aria-labelledby, then the text content with aria-hidden subtrees left out. */
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true') return ''
  return Array.from(node.childNodes, textOf).join('')
}
/* What a sighted reader reads: the text without the visually hidden labels. */
function visibleText(el: Element): string {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('.aether-chat__sr').forEach((n) => n.remove())
  return copy.textContent ?? ''
}
function accessibleName(el: Element): string {
  const label = el.getAttribute('aria-label')
  if (label) return label
  const by = el.getAttribute('aria-labelledby')
  if (by)
    return by
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
  return textOf(el).trim()
}

const log = (w: VueWrapper) => w.find('.aether-chat__log').element as HTMLElement
const statusRegions = (w: VueWrapper) => w.element.querySelectorAll('.aether-chat__log [role="status"]')
/* Counts what is POSTED under a node: the text nodes added to it since the last drain. The
 * observer's callback keeps the records it is handed, and the seeded mutation shows the counter can
 * see before a count of zero is believed. A post that only rewrote the same text counts as zero,
 * which is what it must: that is not an announcement. */
function mutationCounter(target: Node) {
  const seen: MutationRecord[] = []
  const observer = new MutationObserver((records) => seen.push(...records))
  observer.observe(target, { childList: true, characterData: true, subtree: true })
  const posted = (records: MutationRecord[]) =>
    records.flatMap((r) => Array.from(r.addedNodes)).filter((n) => (n.textContent ?? '') !== '').length
  const drain = () => {
    seen.push(...observer.takeRecords())
    return posted(seen.splice(0))
  }
  const probe = document.createElement('div')
  const check = new MutationObserver((records) => seen.push(...records))
  check.observe(probe, { childList: true })
  probe.textContent = 'seeded'
  seen.push(...check.takeRecords())
  expect(posted(seen.splice(0)), 'the counter cannot see a post').toBe(1)
  check.disconnect()
  return { drain, stop: () => observer.disconnect() }
}
const settle = async () => {
  await nextTick()
  await nextTick()
}

describe('a plain log ignores everything rich (the counterpart of ChatPanel.dom.test.ts)', () => {
  it('renders a reply verbatim, ignores every rich field, and draws no entry of another kind', () => {
    const w = mountPanel(
      [
        reply('see ' + REF + ' at J12', {
          streaming: true,
          marks: [{ start: 0, end: 3, kind: 'bare_numeral' }],
        }),
        NOTICE,
      ],
      { rich: false },
    )
    expect(w.findAll('.aether-chat__msg')).toHaveLength(1)
    expect(w.find('.aether-chat__txt').element.textContent).toBe('see ' + REF + ' at J12')
    for (const sel of [
      '.aether-chat-chip',
      'mark',
      '.aether-chat__caret',
      '[role="status"]',
      '[aria-busy]',
    ])
      expect(w.find(sel).exists(), sel).toBe(false)
  })

  it('defaults to the plain log: three buttons, a hint, and Ctrl+Enter queues', async () => {
    const w = mount(ChatPanel, { props: { messages: [], modelValue: '' } })
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Queue', 'Send', 'Apply reply'])
    expect(w.find('.aether-chat__hint').exists()).toBe(true)
    await w.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(w.emitted('queue')).toHaveLength(1)
    expect(w.emitted('send')).toBeUndefined()
  })
})

describe('streaming and the end marker', () => {
  it('a streaming message carries aria-busy and an end marker; a settled one carries neither', () => {
    const w = mountPanel([reply('partial', { streaming: true }), reply('done')])
    const [a, b] = w.findAll('.aether-chat__msg')
    expect(a!.attributes('aria-busy')).toBe('true')
    expect(a!.find('.aether-chat__caret').exists()).toBe(true)
    expect(b!.attributes('aria-busy')).toBeUndefined()
    expect(b!.find('.aether-chat__caret').exists()).toBe(false)
  })

  it('renders the text as it grows', async () => {
    const w = mountPanel([reply('Hel', { streaming: true })])
    expect(w.find('.aether-chat__txt').text()).toBe('Hel')
    await w.setProps({ messages: [reply('Hello wor', { streaming: true })] })
    expect(w.find('.aether-chat__txt').text()).toBe('Hello wor')
  })
})

describe('reference chips', () => {
  const chips = (w: VueWrapper) => w.findAll('button.aether-chat-chip')

  it('a resolvable reference renders value, unit and the tag with its id and shortened hash', () => {
    const w = mountPanel([reply('Max ' + REF + ' here')])
    const [chip] = chips(w)
    expect(chip!.element.textContent).toBe('0.0123 m · r1 · 3b1f2c9')
    expect(chip!.find('.aether-chat-chip__tag').text()).toBe('r1 · 3b1f2c9')
    expect(chip!.classes()).not.toContain('aether-chat-chip--unresolved')
    // the words around it are still plain text, in order
    expect(w.find('.aether-chat__txt').element.textContent).toBe('Max 0.0123 m · r1 · 3b1f2c9 here')
  })

  it('reads a proposal value and a capability number the way the contract words them', () => {
    const w = mountPanel([reply('{{p2:rows.count}} and {{c:limits.value}}')])
    expect(chips(w).map((c) => c.element.textContent)).toEqual([
      '3 · p2 · a9e07f1',
      '1.37 · build 9c04e2d',
    ])
  })

  it('puts the path, the provenance and the full hash on hover, not in the visible text', () => {
    const w = mountPanel([reply(REF)])
    const chip = chips(w)[0]!
    const title = chip.attributes('title')!
    expect(title).toContain('summary.max_abs_displacement')
    expect(title).toContain('Example provenance line.')
    expect(title).toContain('3b1f2c9d4e5a6b7c')
    expect(chip.text()).not.toContain('Example provenance line.')
    expect(chip.text()).not.toContain('3b1f2c9d4e5a6b7c')
  })

  it('an unresolvable reference renders the warning chip: the word, the reference and an icon', () => {
    const w = mountPanel([reply('x ' + UNKNOWN_REF)])
    const chip = chips(w)[0]!
    expect(chip.classes()).toContain('aether-chat-chip--unresolved')
    expect(chip.text()).toContain('unresolved')
    expect(chip.text()).toContain('r9:no.such.path')
    expect(chip.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('negative arm: a value chip has neither the word nor the icon', () => {
    const w = mountPanel([reply(REF)])
    const chip = chips(w)[0]!
    expect(chip.text()).not.toContain('unresolved')
    expect(chip.find('svg').exists()).toBe(false)
  })

  it('a click emits open-ref with the reference string, resolved or not', async () => {
    const w = mountPanel([reply(REF + ' ' + UNKNOWN_REF)])
    const [ok, bad] = chips(w)
    await ok!.trigger('click')
    await bad!.trigger('click')
    expect(w.emitted('open-ref')).toEqual([['r1:summary.max_abs_displacement'], ['r9:no.such.path']])
  })

  it('a reduced reference carries the reduced word in its tag and on hover', () => {
    const w = mountPanel([reply('{{r1:summary.reduced}} ' + REF)])
    const [reduced, plain] = chips(w)
    expect(reduced!.find('.aether-chat-chip__tag').text()).toContain('reduced')
    expect(reduced!.attributes('title')).toContain('reduced')
    expect(plain!.find('.aether-chat-chip__tag').text()).not.toContain('reduced')
    expect(plain!.attributes('title')).not.toContain('reduced')
  })

  it('a reference with no closing braces yet stays plain text, and becomes a chip once they arrive', async () => {
    const half = 'see {{r1:summary.max_abs_displacement'
    const w = mountPanel([reply(half, { streaming: true })])
    expect(chips(w)).toHaveLength(0)
    expect(w.find('.aether-chat__txt').element.textContent).toBe(half)
    await w.setProps({ messages: [reply(half + '}', { streaming: true })] })
    expect(chips(w)).toHaveLength(0)
    await w.setProps({ messages: [reply(half + '}} now', { streaming: true })] })
    expect(chips(w)).toHaveLength(1)
    expect(chips(w)[0]!.element.textContent).toBe('0.0123 m · r1 · 3b1f2c9')
  })

  it('reads references only in replies', () => {
    const w = mountPanel([
      { kind: 'text', role: 'you', text: 'ask ' + REF },
      { kind: 'text', role: 'sys', text: 'note ' + REF },
    ])
    expect(chips(w)).toHaveLength(0)
    expect(w.findAll('.aether-chat__txt').map((t) => t.element.textContent)).toEqual([
      'ask ' + REF,
      'note ' + REF,
    ])
  })

  it('without resolveRef every reference is the warning chip', () => {
    const w = mountPanel([reply(REF)], { resolveRef: undefined })
    expect(chips(w)[0]!.classes()).toContain('aether-chat-chip--unresolved')
  })

  it('ChatRefChip with no id and no hash shows the quantity alone, with no dangling separator', () => {
    const data: RefChipData = { ...KNOWN['c:limits.value']!, source: { kind: 'capabilities', id: null, hash: '' } }
    const chip = mount(ChatRefChip, { props: { reference: 'c:limits.value', data } })
    expect(chip.find('button').element.textContent).toBe('1.37')
    expect(chip.find('.aether-chat-chip__tag').exists()).toBe(false)
    expect(chip.find('button').attributes('aria-label')).toBe('limits.value: 1.37')
    expect(chip.find('button').attributes('title')).not.toMatch(/build\s*$/)
    // the same chip with a hash keeps its tag and the separator before it
    const tagged = mount(ChatRefChip, { props: { reference: 'c:limits.value', data: KNOWN['c:limits.value']! } })
    expect(tagged.find('button').element.textContent).toBe('1.37 · build 9c04e2d')
  })

  it('ChatRefChip on its own: emits open with the reference it was given', async () => {
    const chip = mount(ChatRefChip, { props: { reference: 'r1:summary.max_abs_displacement', data: RUN } })
    await chip.find('button').trigger('click')
    expect(chip.emitted('open')).toEqual([['r1:summary.max_abs_displacement']])
  })
})

describe('bare-numeral marks', () => {
  it('highlights the spans the app gave, in UTF-16 code units, with a text label of the kind', () => {
    const text = String.fromCodePoint(0x1f600) + ' value 12.5 mm at J12'
    const start = text.indexOf('12.5')
    const w = mountPanel([reply(text, { marks: [{ start, end: start + 4, kind: 'bare_numeral' }] })])
    const marks = w.findAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]!.element.textContent).toContain('12.5')
    expect(accessibleName(marks[0]!.element)).toContain('bare_numeral')
    // the emoji is two code units, so an offset counted in code points would have landed two early
    expect(start).toBe(String.fromCodePoint(0x1f600).length + ' value '.length)
    expect(marks[0]!.find('.aether-chat__sr').text()).toContain('bare_numeral')
    expect(visibleText(w.find('.aether-chat__txt').element)).toBe(text)
  })

  it('marks text beside a chip without disturbing the chip', () => {
    const text = 'a 12 ' + REF + ' b 34'
    const w = mountPanel([
      reply(text, {
        marks: [
          { start: 2, end: 4, kind: 'k1' },
          { start: text.indexOf('34'), end: text.length, kind: 'k2' },
        ],
      }),
    ])
    expect(w.findAll('mark').map((m) => m.element.textContent)).toEqual([
      expect.stringContaining('12'),
      expect.stringContaining('34'),
    ])
    expect(w.findAll('button.aether-chat-chip')).toHaveLength(1)
  })

  it('ignores marks that are out of range, empty, inverted or overlapping, and never throws', () => {
    const text = 'abcdef'
    const w = mountPanel([
      reply(text, {
        marks: [
          { start: -1, end: 2, kind: 'neg' },
          { start: 4, end: 99, kind: 'long' },
          { start: 3, end: 3, kind: 'empty' },
          { start: 5, end: 2, kind: 'inverted' },
          { start: 1, end: 3, kind: 'kept' },
          { start: 2, end: 4, kind: 'overlaps' },
        ],
      }),
    ])
    const marks = w.findAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]!.find('.aether-chat__sr').text()).toContain('kept')
    expect(visibleText(w.find('.aether-chat__txt').element)).toBe(text)
  })

  it('negative arm: a message with no marks has no mark element', () => {
    expect(mountPanel([reply('plain 12')]).find('mark').exists()).toBe(false)
  })
})

/* The one line the threshold is measured in: the log's message text, read from the stylesheet that
 * sets it. A hand-typed 19.2 would freeze the font size it was copied from. */
function lineHeightPx(css: string): number | null {
  const rule = /[.]aether-chat__msg [{]([^}]*)[}]/.exec(css)
  if (!rule) return null
  const size = /font-size:\s*([0-9.]+)px/.exec(rule[1]!)
  const line = /line-height:\s*([0-9.]+)\s*;/.exec(rule[1]!)
  return size && line ? parseFloat(size[1]!) * parseFloat(line[1]!) : null
}

describe('the follow threshold', () => {
  it('can read a line height out of a rule (a seeded known case)', () => {
    const seeded = '.aether-chat__msg { padding: 1px; font-size: 10px; line-height: 1.5; }'
    expect(lineHeightPx(seeded)).toBe(15)
    expect(lineHeightPx('.other { font-size: 10px; line-height: 1.5; }')).toBeNull()
  })

  it('is one line of the log text, rounded up to a whole pixel', () => {
    const css = readFileSync(resolve(__dirname, '../../../styles/ui-kit.css'), 'utf8')
    const line = lineHeightPx(css)
    expect(line, 'the .aether-chat__msg rule needs a font-size and a line-height').not.toBeNull()
    expect(STREAM_FOLLOW_THRESHOLD).toBe(Math.ceil(line!))
  })
})

describe('the scroll rule', () => {
  /* clientHeight is fixed; scrollHeight is that plus ten pixels per character the log renders. */
  const VIEW = 400
  function layout(w: VueWrapper) {
    const el = log(w)
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => VIEW })
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => VIEW + 10 * (el.textContent ?? '').length,
    })
    return el
  }
  const distance = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight
  const GROWN = ' and a good many more words arrive'

  it('in a rich log, a growing stream with the log at the bottom keeps it there', async () => {
    const w = mountPanel([reply('Streaming', { streaming: true })])
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    expect(distance(el)).toBe(0)
    const before = el.scrollHeight
    await w.setProps({ messages: [reply('Streaming' + GROWN, { streaming: true })] })
    await settle()
    expect(el.scrollHeight).toBeGreaterThan(before + STREAM_FOLLOW_THRESHOLD) // growth really moved the edge
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('the same growth, scrolled up, leaves scrollTop where it was', async () => {
    const w = mountPanel([reply('Streaming', { streaming: true })])
    const el = layout(w)
    el.scrollTop = 37
    expect(distance(el)).toBeGreaterThan(STREAM_FOLLOW_THRESHOLD) // the precondition: not near the bottom
    await w.setProps({ messages: [reply('Streaming' + GROWN, { streaming: true })] })
    await settle()
    expect(el.scrollTop).toBe(37)
  })

  it('follows from exactly the threshold, and does not follow one pixel past it', async () => {
    for (const [offset, follows] of [
      [0, true],
      [STREAM_FOLLOW_THRESHOLD, true],
      [STREAM_FOLLOW_THRESHOLD + 1, false],
    ] as const) {
      const w = mountPanel([reply('Streaming', { streaming: true })])
      const el = layout(w)
      el.scrollTop = el.scrollHeight - VIEW - offset
      expect(distance(el)).toBe(offset)
      const parked = el.scrollTop
      await w.setProps({ messages: [reply('Streaming' + GROWN, { streaming: true })] })
      await settle()
      expect(el.scrollTop, `offset ${offset}`).toBe(follows ? el.scrollHeight : parked)
    }
  })

  it('follows the last token even when it arrives in the same update that settles the message', async () => {
    const w = mountPanel([reply('Streaming', { streaming: true })])
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    await w.setProps({ messages: [reply('Streaming' + GROWN)] })
    await settle()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('only a streaming message is followed: growth of a settled one leaves the log alone', async () => {
    const w = mountPanel([reply('Settled')])
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    const parked = el.scrollTop
    await w.setProps({ messages: [reply('Settled' + GROWN)] })
    await settle()
    expect(el.scrollTop).toBe(parked)
  })

  it('a new message still scrolls to the bottom from anywhere, in a rich log', async () => {
    const w = mountPanel([reply('one')])
    const el = layout(w)
    el.scrollTop = 0
    await w.setProps({ messages: [reply('one'), reply('two')] })
    await settle()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  describe('an entry appended while a stream runs', () => {
    /* An entry arriving mid-stream changes messages.length. It goes through the same at-bottom test as
     * the stream; the reader's own message always scrolls. */
    const streaming = () => reply('Streaming', { streaming: true })
    const appended: [string, ChatEntry][] = [
      ["an entry of the caller's own kind", NOTICE],
      ['a second reply', reply('a second reply')],
      ['a system note', { kind: 'text', role: 'sys', text: 'a note' }],
    ]

    it.each(appended)('%s leaves a reader who scrolled up where they were', async (_n, entry) => {
      const w = mountPanel([streaming()])
      const el = layout(w)
      el.scrollTop = 37
      expect(distance(el)).toBeGreaterThan(STREAM_FOLLOW_THRESHOLD)
      await w.setProps({ messages: [streaming(), entry] })
      await settle()
      expect(el.scrollTop).toBe(37)
    })

    it.each(appended)('%s is followed by a reader at the bottom', async (_n, entry) => {
      const w = mountPanel([streaming()])
      const el = layout(w)
      el.scrollTop = el.scrollHeight - VIEW
      expect(distance(el)).toBe(0)
      await w.setProps({ messages: [streaming(), entry] })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })

    it('uses the same edge as the stream: followed at the threshold, not one pixel past it', async () => {
      for (const [offset, follows] of [
        [STREAM_FOLLOW_THRESHOLD, true],
        [STREAM_FOLLOW_THRESHOLD + 1, false],
      ] as const) {
        const w = mountPanel([streaming()])
        const el = layout(w)
        el.scrollTop = el.scrollHeight - VIEW - offset
        expect(distance(el)).toBe(offset)
        const parked = el.scrollTop
        await w.setProps({ messages: [streaming(), NOTICE] })
        await settle()
        expect(el.scrollTop, `offset ${offset}`).toBe(follows ? el.scrollHeight : parked)
      }
    })

    it('a message from the reader scrolls to the bottom from anywhere', async () => {
      const w = mountPanel([streaming()])
      const el = layout(w)
      el.scrollTop = 37
      expect(distance(el)).toBeGreaterThan(STREAM_FOLLOW_THRESHOLD)
      await w.setProps({ messages: [streaming(), { kind: 'text', role: 'you', text: 'the next question' }] })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })

    it('arrives in the update that settles the stream: still followed only from the bottom', async () => {
      const w = mountPanel([streaming()])
      const el = layout(w)
      el.scrollTop = 37
      await w.setProps({ messages: [reply('Streaming'), NOTICE] })
      await settle()
      expect(el.scrollTop).toBe(37)
    })

    it('scrolls from anywhere once nothing is streaming', async () => {
      const w = mountPanel([reply('Settled')])
      const el = layout(w)
      el.scrollTop = 0
      await w.setProps({ messages: [reply('Settled'), NOTICE] })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })

    it('a streaming entry appended to a settled log leaves a reader who scrolled up where they were', async () => {
      const w = mountPanel([reply('Settled')])
      const el = layout(w)
      el.scrollTop = 37
      expect(distance(el)).toBeGreaterThan(STREAM_FOLLOW_THRESHOLD)
      await w.setProps({ messages: [reply('Settled'), reply('', { streaming: true })] })
      await settle()
      expect(el.scrollTop).toBe(37)
    })

    it('a streaming entry appended to a settled log is followed by a reader at the bottom', async () => {
      const w = mountPanel([reply('Settled')])
      const el = layout(w)
      el.scrollTop = el.scrollHeight - VIEW
      expect(distance(el)).toBe(0)
      await w.setProps({ messages: [reply('Settled'), reply('', { streaming: true })] })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })

    it('holds for a message pushed onto a reactive array', async () => {
      const messages = reactive<ChatEntry[]>([streaming()])
      const w = mountHost(messages)
      const el = layout(w)
      el.scrollTop = 37
      messages.push(NOTICE)
      await settle()
      expect(el.scrollTop).toBe(37)
      messages.push({ kind: 'text', role: 'you', text: 'the next question' })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })

    it('in a plain log every new message scrolls, whatever is streaming', async () => {
      const w = mountPanel([streaming()], { rich: false })
      const el = layout(w)
      el.scrollTop = 37
      await w.setProps({ messages: [streaming(), NOTICE] })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })
  })

  it('in a plain log a new message scrolls to the bottom from scrollTop 0', async () => {
    const w = mountPanel([reply('one')], { rich: false })
    const el = layout(w)
    el.scrollTop = 0
    await w.setProps({ messages: [reply('one'), reply('two')] })
    await settle()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('in a plain log the stream rule does not apply: growth at the bottom is not followed', async () => {
    const w = mountPanel([reply('Streaming', { streaming: true })], { rich: false })
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    const parked = el.scrollTop
    await w.setProps({ messages: [reply('Streaming' + GROWN, { streaming: true })] })
    await settle()
    expect(el.scrollTop).toBe(parked)
  })

  it('follows a message the app grows in place, the way a reactive array is driven', async () => {
    const messages = reactive<ChatEntry[]>([reply('Streaming', { streaming: true })])
    const w = mountHost(messages)
    const el = w.find('.aether-chat__log').element as HTMLElement
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => VIEW })
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => VIEW + 10 * (el.textContent ?? '').length,
    })
    el.scrollTop = el.scrollHeight - VIEW
    ;(messages[0] as ChatMessage).text += GROWN
    await settle()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })
})

describe('accessibility', () => {
  const SETTLED = 'Max ' + REF + ' at J12 and ' + UNKNOWN_REF + '.'
  const expectedAnnouncement = (w: VueWrapper) => {
    const names = w.findAll('button.aether-chat-chip').map((c) => accessibleName(c.element))
    return 'Max ' + names[0] + ' at J12 and ' + names[1] + '.'
  }

  it('posts one status message when a streaming reply settles, none while it streams', async () => {
    const w = mountPanel([reply('Max ' + REF + ' at', { streaming: true })])
    expect(statusRegions(w)).toHaveLength(1)
    const region = statusRegions(w)[0]!
    const mutations = mutationCounter(region)

    // while it streams, however many updates arrive
    for (const text of ['Max ' + REF + ' at J12', 'Max ' + REF + ' at J12 and ' + UNKNOWN_REF.slice(0, 6)]) {
      await w.setProps({ messages: [reply(text, { streaming: true })] })
      await settle()
      expect(region.textContent).toBe('')
    }
    expect(mutations.drain()).toBe(0)

    // it settles
    await w.setProps({ messages: [reply(SETTLED)] })
    await settle()
    expect(statusRegions(w)).toHaveLength(1)
    expect(statusRegions(w)[0]).toBe(region)
    expect(region.textContent).toBe(expectedAnnouncement(w))
    expect(region.textContent).toContain('unresolved: r9:no.such.path')
    expect(region.textContent).toContain('0.0123 m, r1, 3b1f2c9')
    expect(mutations.drain()).toBe(1)

    // and is posted to once: a re-render, or another message, adds nothing
    await w.setProps({ messages: [reply(SETTLED)] })
    await w.setProps({ messages: [reply(SETTLED), reply('later')] })
    await settle()
    expect(mutations.drain()).toBe(0)
    expect(region.textContent).toBe(expectedAnnouncement(w))
    mutations.stop()
  })

  it('announces a reply again even when it settles with exactly the words of the one before', async () => {
    const w = mountPanel([reply('Done.', { streaming: true })])
    const region = statusRegions(w)[0]!
    const mutations = mutationCounter(region)
    await w.setProps({ messages: [reply('Done.')] })
    await settle()
    expect(region.textContent).toBe('Done.')
    expect(mutations.drain()).toBe(1)
    await w.setProps({ messages: [reply('Done.'), reply('Done.', { streaming: true })] })
    await settle()
    expect(mutations.drain()).toBe(0) // streaming again: nothing is posted yet
    await w.setProps({ messages: [reply('Done.'), reply('Done.')] })
    await settle()
    expect(region.textContent).toBe('Done.')
    expect(mutations.drain()).toBe(1) // the same text, posted again
    mutations.stop()
  })

  it('posts when the app settles a message it grew in place', async () => {
    const messages = reactive<ChatEntry[]>([reply('Max ', { streaming: true })])
    const w = mountHost(messages)
    const region = w.element.querySelector('.aether-chat__log [role="status"]')!
    ;(messages[0] as ChatMessage).text += REF
    await settle()
    expect(region.textContent).toBe('')
    ;(messages[0] as ChatMessage).streaming = false
    await settle()
    expect(region.textContent).toContain('summary.max_abs_displacement: 0.0123 m, r1, 3b1f2c9')
  })

  it('negative arm: a message that never streamed posts nothing', async () => {
    const w = mountPanel([reply('Max ' + REF)])
    await w.setProps({ messages: [reply('Max ' + REF), reply('another')] })
    await settle()
    expect(statusRegions(w)[0]!.textContent).toBe('')
  })

  it('a plain log has no status region at all', () => {
    expect(statusRegions(mountPanel([reply('x')], { rich: false }))).toHaveLength(0)
  })

  it('every chip has an accessible name holding its text; the warning chip names itself unresolved', () => {
    const w = mountPanel([reply(REF + ' {{p2:rows.count}} {{c:limits.value}} ' + UNKNOWN_REF)])
    const chips = w.findAll('button.aether-chat-chip')
    expect(chips).toHaveLength(4)
    for (const c of chips) {
      const name = accessibleName(c.element)
      expect(name.length).toBeGreaterThan(0)
      if (c.classes().includes('aether-chat-chip--unresolved')) {
        expect(name).toContain('unresolved')
        expect(name).toContain('r9:no.such.path')
      } else {
        // the value chips: the path, the quantity and the tag, and never the word
        const quantity = c.element.textContent!.split(' · ')[0]!
        expect(name).toContain(quantity)
        expect(name).not.toContain('unresolved')
      }
    }
    expect(accessibleName(chips[0]!.element)).toBe('summary.max_abs_displacement: 0.0123 m, r1, 3b1f2c9')
  })

  it('negative arm: a settled message carries no aria-busy, and nothing but a streaming one does', () => {
    const w = mountPanel([reply('done'), reply('going', { streaming: true }), reply('also done', { streaming: false })])
    expect(w.findAll('[aria-busy]')).toHaveLength(1)
    expect(w.findAll('.aether-chat__msg').map((r) => r.attributes('aria-busy'))).toEqual([
      undefined,
      'true',
      undefined,
    ])
  })
})
