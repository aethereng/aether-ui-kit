import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive } from 'vue'
import ChatPanel from '../ChatPanel.vue'
import ChatRefChip from '../ChatRefChip.vue'
import { STREAM_FOLLOW_THRESHOLD } from '../../core'
import type { ChatEntry, ChatMessage, RefChipData } from '../../core'

/* The assistant half of ChatPanel: message kinds, reference chips, the proposal card, the live
 * region and the follow-the-stream rule. ChatPanel.dom.test.ts holds the relay contract; the first
 * block here is its counterpart, proving that nothing below reaches a relay consumer.
 *
 * jsdom does no layout, so the scroll tests stub clientHeight and make scrollHeight track the
 * log's own text. That is the part that matters: the panel has to measure BEFORE the render that
 * grows the log, and a constant scrollHeight could not tell a panel that does from one that
 * measures afterwards and never follows anything. */

const NL = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const TAB = String.fromCharCode(9)

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

const wrappers: VueWrapper[] = []
function mountPanel(messages: ChatEntry[], props: Record<string, unknown> = {}, slots = {}) {
  const w = mount(ChatPanel, {
    props: { messages, modelValue: '', actions: 'assistant', resolveRef, ...props },
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
    render: () => h(ChatPanel, { messages, modelValue: '', actions: 'assistant', resolveRef }),
  })
  const w = mount(Host, { attachTo: document.body })
  wrappers.push(w as unknown as VueWrapper)
  return w
}

const agent = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  kind: 'text',
  role: 'agent',
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
const buttonByText = (w: VueWrapper, text: string) => w.findAll('button').find((b) => b.text() === text)
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

describe('relay ignores every assistant prop and field (the counterpart of ChatPanel.dom.test.ts)', () => {
  it('renders an agent text message verbatim and ignores every assistant-only prop and field', () => {
    const w = mountPanel(
      [
        agent('see ' + REF + ' at J12', {
          streaming: true,
          marks: [{ start: 0, end: 3, kind: 'bare_numeral' }],
        }),
        { kind: 'tool', callId: 'c1', name: 'n', status: 'done', summary: 's' },
        { kind: 'refusal', text: 'no', source: 'api' },
        { kind: 'card', title: 't', body: 'b', source: 's' },
      ],
      { actions: 'relay', fixedLine: 'Example fixed line.', proposalLine: 'Example proposal line.' },
    )
    expect(w.findAll('.aether-chat__msg')).toHaveLength(1)
    expect(w.find('.aether-chat__txt').element.textContent).toBe('see ' + REF + ' at J12')
    for (const sel of [
      '.aether-chat-chip',
      'mark',
      '.aether-chat__caret',
      '.aether-chat__fixed',
      '[role="status"]',
      '[aria-busy]',
      '.aether-chat__tool',
      '.aether-chat__refusal',
      '.aether-card',
    ])
      expect(w.find(sel).exists(), sel).toBe(false)
  })

  it('defaults to relay: three buttons, a hint, and Ctrl+Enter queues', async () => {
    const w = mount(ChatPanel, { props: { messages: [], modelValue: '' } })
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Queue', 'Send', 'Apply reply'])
    expect(w.find('.aether-chat__hint').exists()).toBe(true)
    await w.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(w.emitted('queue')).toHaveLength(1)
    expect(w.emitted('send')).toBeUndefined()
  })
})

describe('action row', () => {
  it('assistant shows Send alone, and no queue, apply or hint', () => {
    const w = mountPanel([])
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Send'])
    expect(w.find('.aether-chat__hint').exists()).toBe(false)
  })

  it('Send emits send, and Ctrl/Cmd+Enter sends instead of queueing', async () => {
    const w = mountPanel([])
    await buttonByText(w, 'Send')!.trigger('click')
    await w.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await w.find('textarea').trigger('keydown', { key: 'Enter', metaKey: true })
    expect(w.emitted('send')).toHaveLength(3)
    expect(w.emitted('queue')).toBeUndefined()
  })

  it('busy disables Send, shows Stop, and Stop emits stop', async () => {
    const w = mountPanel([], { busy: true })
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Send', 'Stop'])
    expect(buttonByText(w, 'Send')!.attributes('disabled')).toBeDefined()
    await buttonByText(w, 'Stop')!.trigger('click')
    expect(w.emitted('stop')).toHaveLength(1)
    // the shortcut obeys the same state
    await w.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(w.emitted('send')).toBeUndefined()
  })

  it('negative arm: not busy means no Stop, and Send is enabled', () => {
    const w = mountPanel([], { busy: false })
    expect(buttonByText(w, 'Stop')).toBeUndefined()
    expect(buttonByText(w, 'Send')!.attributes('disabled')).toBeUndefined()
  })
})

describe('streaming and the end marker', () => {
  it('a streaming message carries aria-busy and an end marker; a settled one carries neither', () => {
    const w = mountPanel([agent('partial', { streaming: true }), agent('done')])
    const [a, b] = w.findAll('.aether-chat__msg')
    expect(a!.attributes('aria-busy')).toBe('true')
    expect(a!.find('.aether-chat__caret').exists()).toBe(true)
    expect(b!.attributes('aria-busy')).toBeUndefined()
    expect(b!.find('.aether-chat__caret').exists()).toBe(false)
  })

  it('renders the text as it grows', async () => {
    const w = mountPanel([agent('Hel', { streaming: true })])
    expect(w.find('.aether-chat__txt').text()).toBe('Hel')
    await w.setProps({ messages: [agent('Hello wor', { streaming: true })] })
    expect(w.find('.aether-chat__txt').text()).toBe('Hello wor')
  })
})

describe('reference chips', () => {
  const chips = (w: VueWrapper) => w.findAll('button.aether-chat-chip')

  it('a resolvable reference renders value, unit and the tag with its id and shortened hash', () => {
    const w = mountPanel([agent('Max ' + REF + ' here')])
    const [chip] = chips(w)
    expect(chip!.element.textContent).toBe('0.0123 m · r1 · 3b1f2c9')
    expect(chip!.find('.aether-chat-chip__tag').text()).toBe('r1 · 3b1f2c9')
    expect(chip!.classes()).not.toContain('aether-chat-chip--unresolved')
    // the words around it are still plain text, in order
    expect(w.find('.aether-chat__txt').element.textContent).toBe('Max 0.0123 m · r1 · 3b1f2c9 here')
  })

  it('reads a proposal value and a capability number the way the contract words them', () => {
    const w = mountPanel([agent('{{p2:rows.count}} and {{c:limits.value}}')])
    expect(chips(w).map((c) => c.element.textContent)).toEqual([
      '3 · p2 · a9e07f1',
      '1.37 · build 9c04e2d',
    ])
  })

  it('puts the path, the provenance and the full hash on hover, not in the visible text', () => {
    const w = mountPanel([agent(REF)])
    const chip = chips(w)[0]!
    const title = chip.attributes('title')!
    expect(title).toContain('summary.max_abs_displacement')
    expect(title).toContain('Example provenance line.')
    expect(title).toContain('3b1f2c9d4e5a6b7c')
    expect(chip.text()).not.toContain('Example provenance line.')
    expect(chip.text()).not.toContain('3b1f2c9d4e5a6b7c')
  })

  it('an unresolvable reference renders the warning chip: the word, the reference and an icon', () => {
    const w = mountPanel([agent('x ' + UNKNOWN_REF)])
    const chip = chips(w)[0]!
    expect(chip.classes()).toContain('aether-chat-chip--unresolved')
    expect(chip.text()).toContain('unresolved')
    expect(chip.text()).toContain('r9:no.such.path')
    expect(chip.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('negative arm: a value chip has neither the word nor the icon', () => {
    const w = mountPanel([agent(REF)])
    const chip = chips(w)[0]!
    expect(chip.text()).not.toContain('unresolved')
    expect(chip.find('svg').exists()).toBe(false)
  })

  it('a click emits open-ref with the reference string, resolved or not', async () => {
    const w = mountPanel([agent(REF + ' ' + UNKNOWN_REF)])
    const [ok, bad] = chips(w)
    await ok!.trigger('click')
    await bad!.trigger('click')
    expect(w.emitted('open-ref')).toEqual([['r1:summary.max_abs_displacement'], ['r9:no.such.path']])
  })

  it('a reduced reference carries "reduced by the viewer" in its tag and on hover', () => {
    const w = mountPanel([agent('{{r1:summary.reduced}} ' + REF)])
    const [reduced, plain] = chips(w)
    expect(reduced!.find('.aether-chat-chip__tag').text()).toContain('reduced by the viewer')
    expect(reduced!.attributes('title')).toContain('reduced by the viewer')
    expect(plain!.element.textContent).not.toContain('reduced by the viewer')
    expect(plain!.attributes('title')).not.toContain('reduced by the viewer')
  })

  it('a reference with no closing braces yet stays plain text, and becomes a chip once they arrive', async () => {
    const half = 'see {{r1:summary.max_abs_displacement'
    const w = mountPanel([agent(half, { streaming: true })])
    expect(chips(w)).toHaveLength(0)
    expect(w.find('.aether-chat__txt').element.textContent).toBe(half)
    await w.setProps({ messages: [agent(half + '}', { streaming: true })] })
    expect(chips(w)).toHaveLength(0)
    await w.setProps({ messages: [agent(half + '}} now', { streaming: true })] })
    expect(chips(w)).toHaveLength(1)
    expect(chips(w)[0]!.element.textContent).toBe('0.0123 m · r1 · 3b1f2c9')
  })

  it('reads references only in agent messages', () => {
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
    const w = mountPanel([agent(REF)], { resolveRef: undefined })
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
    const w = mountPanel([agent(text, { marks: [{ start, end: start + 4, kind: 'bare_numeral' }] })])
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
      agent(text, {
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
      agent(text, {
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
    expect(mountPanel([agent('plain 12')]).find('mark').exists()).toBe(false)
  })
})

describe('the fixed line', () => {
  it('renders under every agent text message when set, streaming or not, and under no other', () => {
    const w = mountPanel(
      [
        agent('one', { streaming: true }),
        agent('two'),
        { kind: 'text', role: 'you', text: 'three' },
        { kind: 'text', role: 'sys', text: 'four' },
        { kind: 'card', title: 't', body: 'b', source: 's' },
      ],
      { fixedLine: 'Example fixed line.' },
    )
    const rows = w.findAll('.aether-chat__log > :not([role="status"])')
    expect(rows.map((r) => r.find('.aether-chat__fixed').exists())).toEqual([true, true, false, false, false])
    expect(w.find('.aether-chat__fixed').text()).toBe('Example fixed line.')
  })

  it('is absent when empty or unset', () => {
    for (const props of [{}, { fixedLine: '' }])
      expect(mountPanel([agent('one')], props).find('.aether-chat__fixed').exists()).toBe(false)
  })
})

describe('the tool-call card', () => {
  const tool = (extra: Record<string, unknown> = {}): ChatEntry => ({
    kind: 'tool',
    callId: 'call-1',
    name: 'example_tool',
    status: 'running',
    summary: 'Example summary.',
    ...extra,
  }) as ChatEntry

  it.each(['running', 'done', 'refused', 'failed'])('shows the name, the summary and "%s" as text', (status) => {
    const w = mountPanel([tool({ status })])
    expect(w.find('.aether-chat__tool-name').text()).toBe('example_tool')
    expect(w.find('.aether-chat__tool-summary').text()).toBe('Example summary.')
    const mark = w.find('.aether-chat__state')
    expect(mark.text()).toContain(status)
    expect(accessibleName(mark.element)).toContain(status)
  })

  it('has no Disclosure without a detail', () => {
    expect(mountPanel([tool()]).find('.aether-disclosure').exists()).toBe(false)
  })

  it('puts a long detail in a box that scrolls and can be reached by keyboard, and gives a long summary a hover', () => {
    const w = mountPanel([tool({ detail: 'x', summary: 'A summary that is cut to one line on screen.' })])
    const detail = w.find('.aether-chat__detail')
    expect(detail.attributes('tabindex')).toBe('0')
    expect(detail.attributes('role')).toBe('group')
    expect(accessibleName(detail.element)).toContain('example_tool')
    expect(w.find('.aether-chat__tool-summary').attributes('title')).toBe(
      'A summary that is cut to one line on screen.',
    )
  })

  it('holds the detail verbatim behind a Disclosure the app controls', async () => {
    const detail = 'line one' + NL + '  indented' + NL
    const w = mountPanel([tool({ detail, open: false })])
    const toggle = w.find('.aether-disclosure__toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.find('.aether-chat__detail').element.textContent).toBe(detail)
    // a click asks; it does not open anything the app has not passed
    await toggle.trigger('click')
    expect(w.emitted('toggle-tool')).toEqual([['call-1']])
    expect(w.find('.aether-disclosure__toggle').attributes('aria-expanded')).toBe('false')
    await w.setProps({ messages: [tool({ detail, open: true })] })
    expect(w.find('.aether-disclosure__toggle').attributes('aria-expanded')).toBe('true')
  })
})

describe('the refusal block', () => {
  const refusal = (text: string, source: 'engine' | 'api' = 'engine'): ChatEntry => ({
    kind: 'refusal',
    text,
    source,
  })
  const blockText = (w: VueWrapper) => w.find('.aether-chat__refusal-text').element.textContent
  const TEXT = '  Cannot do that.' + NL + NL + TAB + 'Indented  ' + CR + NL + 'tail ' + NL

  it("renders the text byte for byte, whitespace included", () => {
    expect(blockText(mountPanel([refusal(TEXT)]))).toBe(TEXT)
  })

  it.each([
    ['a trailing space', TEXT + ' '],
    ['a leading newline', NL + TEXT],
    ['a tab for a space', TEXT.replace(' ', TAB)],
    ['CR LF for LF', TEXT.replace(NL + NL, CR + NL + NL)],
    ['a no-break space for a space', TEXT.replace(' ', String.fromCharCode(0xa0))],
  ])('negative arm: %s is not equal to the original, and renders as itself', (_n, variant) => {
    expect(variant).not.toBe(TEXT)
    const rendered = blockText(mountPanel([refusal(variant)]))
    expect(rendered).toBe(variant)
    expect(rendered).not.toBe(TEXT)
  })

  it('treats the text as text: a tag in it is not markup', () => {
    const w = mountPanel([refusal('<b>no</b> & done')])
    expect(blockText(w)).toBe('<b>no</b> & done')
    expect(w.find('.aether-chat__refusal-text b').exists()).toBe(false)
  })

  it('labels the source in text, outside the block, and is not styled as a reply', () => {
    const engine = mountPanel([refusal('x', 'engine')])
    const api = mountPanel([refusal('x', 'api')])
    expect(engine.find('.aether-chat__who').text()).toContain('engine')
    expect(api.find('.aether-chat__who').text()).toContain('API')
    expect(blockText(engine)).toBe('x')
    expect(engine.find('.aether-chat__refusal').classes()).not.toContain('aether-chat__txt')
    expect(engine.find('.aether-chat__txt').exists()).toBe(false)
  })
})

describe('the card', () => {
  it("is the kit's Card with a title, a body and a source line", () => {
    const w = mountPanel([{ kind: 'card', title: 'Example title', body: 'Example body.', source: 'example source' }])
    const card = w.find('.aether-card')
    expect(card.exists()).toBe(true)
    expect(card.find('.aether-chat__card-title').text()).toBe('Example title')
    expect(card.find('.aether-chat__card-body').text()).toBe('Example body.')
    expect(card.find('.aether-chat__source').text()).toContain('example source')
  })
})

describe('the proposal card', () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ path: 'row.' + i, before: 'b' + i, after: 'a' + i }))
  const proposal = (extra: Record<string, unknown> = {}): ChatEntry => ({
    kind: 'proposal',
    id: 'prop-7',
    title: 'Example proposal',
    rows: rows(3),
    flags: [{ text: 'Example flag.', reference: 'r1:summary.max_abs_displacement' }],
    status: 'pending',
    ...extra,
  }) as ChatEntry
  const controls = (w: VueWrapper) =>
    w.findAll('button').filter((b) => ['Accept', 'Discard'].includes(b.text()))

  it('shows the rows as a diff with every after marked proposed', () => {
    const w = mountPanel([proposal()])
    const trs = w.findAll('.aether-chat__diff tbody tr')
    expect(trs).toHaveLength(3)
    expect(trs.map((r) => r.find('th').text())).toEqual(['row.0', 'row.1', 'row.2'])
    expect(trs.map((r) => r.find('del').text())).toEqual(['b0', 'b1', 'b2'])
    for (const [i, r] of trs.entries()) {
      expect(textOf(r.find('ins').element)).toContain('proposed')
      expect(textOf(r.find('ins').element)).toContain('a' + i)
      expect(r.find('del').text()).not.toContain('proposed')
    }
  })

  it('renders every row, however many, in a region that scrolls and can be reached by keyboard', () => {
    const w = mountPanel([proposal({ rows: rows(250) })])
    expect(w.findAll('.aether-chat__diff tbody tr')).toHaveLength(250)
    expect(w.findAll('.aether-chat__proposed')).toHaveLength(250)
    const region = w.find('.aether-chat__rows')
    expect(region.attributes('role')).toBe('group')
    expect(region.attributes('tabindex')).toBe('0')
    expect(accessibleName(region.element)).toContain('Example proposal')
  })

  it('adds no landmark per call or per proposal, and every scroll box is still a named tab stop', () => {
    const entries: ChatEntry[] = []
    for (let i = 0; i < 6; i++) {
      entries.push({ kind: 'tool', callId: 'c' + i, name: 'tool_' + i, status: 'done', summary: 's', detail: 'detail ' + i })
      entries.push({ ...proposal() as ChatEntry, id: 'p' + i, title: 'Proposal ' + i } as ChatEntry)
    }
    const w = mountPanel(entries)
    expect(w.element.querySelectorAll('[role="region"]')).toHaveLength(0)
    const boxes = w.element.querySelectorAll('.aether-chat__detail, .aether-chat__rows')
    expect(boxes).toHaveLength(12)
    for (const box of boxes) {
      expect(box.getAttribute('tabindex')).toBe('0')
      expect(accessibleName(box)).not.toBe('')
    }
  })

  it('renders each flag as a Callout whose reference is a chip', async () => {
    const w = mountPanel([proposal({ flags: [
      { text: 'First flag.', reference: 'r1:summary.max_abs_displacement' },
      { text: 'Second flag.', reference: 'r9:no.such.path' },
    ] })])
    const callouts = w.findAll('.aether-callout')
    expect(callouts).toHaveLength(2)
    expect(callouts[0]!.text()).toContain('First flag.')
    expect(callouts[0]!.find('button.aether-chat-chip').element.textContent).toBe('0.0123 m · r1 · 3b1f2c9')
    expect(callouts[1]!.find('button.aether-chat-chip').classes()).toContain('aether-chat-chip--unresolved')
    await callouts[1]!.find('button').trigger('click')
    expect(w.emitted('open-ref')).toEqual([['r9:no.such.path']])
  })

  it('shows the proposal line, set or not', () => {
    expect(mountPanel([proposal()], { proposalLine: 'Example proposal line.' }).find('.aether-chat__proposal-line').text())
      .toBe('Example proposal line.')
    expect(mountPanel([proposal()]).find('.aether-chat__proposal-line').exists()).toBe(false)
  })

  it('while pending, Accept and Discard emit with the id and render nothing new', async () => {
    const w = mountPanel([proposal()])
    expect(controls(w).map((b) => b.text())).toEqual(['Accept', 'Discard'])
    expect(w.find('.aether-chat__state').text()).toContain('pending')
    const before = w.html()
    await buttonByText(w, 'Accept')!.trigger('click')
    await buttonByText(w, 'Discard')!.trigger('click')
    expect(w.emitted('accept')).toEqual([['prop-7']])
    expect(w.emitted('discard')).toEqual([['prop-7']])
    expect(w.html()).toBe(before)
  })

  it('once the app passes accepted there is no Accept or Discard, and nothing where they were emits', async () => {
    const w = mountPanel([proposal()])
    const stale = controls(w)
    expect(stale).toHaveLength(2) // the precondition: they were there
    await buttonByText(w, 'Accept')!.trigger('click')
    expect(w.emitted('accept')).toHaveLength(1)

    await w.setProps({ messages: [proposal({ status: 'accepted' })] })
    expect(controls(w)).toHaveLength(0)
    expect(stale.every((b) => !b.element.isConnected)).toBe(true)
    expect(w.find('.aether-chat__state').text()).toContain('accepted')
    // every control the card still has, clicked: the only buttons left are the chips
    for (const b of w.findAll('.aether-chat__proposal button')) await b.trigger('click')
    expect(w.emitted('accept')).toHaveLength(1)
    expect(w.emitted('discard')).toBeUndefined()
  })

  it.each(['discarded', 'superseded', 'refused'])('renders %s read-only, with the state in text', (status) => {
    const w = mountPanel([proposal({ status })])
    expect(controls(w)).toHaveLength(0)
    expect(w.find('.aether-chat__state').text()).toContain(status)
    expect(accessibleName(w.find('.aether-chat__state').element)).toContain(status)
    // the rows are still all there, as a record
    expect(w.findAll('.aether-chat__diff tbody tr')).toHaveLength(3)
  })
})

describe('message-extra slot', () => {
  const entries: ChatEntry[] = [
    agent('one'),
    { kind: 'tool', callId: 'c', name: 'n', status: 'done', summary: 's' },
    { kind: 'refusal', text: 'no', source: 'api' },
    { kind: 'proposal', id: 'p', title: 't', rows: [], flags: [], status: 'pending' },
    { kind: 'card', title: 't', body: 'b', source: 's' },
  ]

  it('renders once inside each message of every kind, with the message as its prop', () => {
    const seen: ChatEntry[] = []
    const w = mountPanel(entries, {}, {
      'message-extra': (p: { message: ChatEntry }) => {
        seen.push(p.message)
        return h('i', { class: 'extra' }, p.message.kind ?? 'text')
      },
    })
    const rows = w.findAll('.aether-chat__log > :not([role="status"])')
    expect(rows).toHaveLength(5)
    for (const r of rows) expect(r.findAll('.extra')).toHaveLength(1)
    expect(w.findAll('.extra').map((e) => e.text())).toEqual(['text', 'tool', 'refusal', 'proposal', 'card'])
    expect(seen.slice(0, 5)).toEqual(entries)
  })
})

describe('history cap over mixed kinds', () => {
  it('keeps the most recent historyLimit entries, whatever their kind', () => {
    const w = mountPanel(
      [
        agent('first and oldest'),
        { kind: 'card', title: 'older card', body: 'b', source: 's' },
        { kind: 'refusal', text: 'recent refusal', source: 'api' },
        agent('newest'),
      ],
      { historyLimit: 2 },
    )
    expect(w.text()).toContain('recent refusal')
    expect(w.text()).toContain('newest')
    expect(w.text()).not.toContain('older card')
    expect(w.text()).not.toContain('first and oldest')
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

  it('under assistant, a growing stream with the log at the bottom keeps it there', async () => {
    const w = mountPanel([agent('Streaming', { streaming: true })])
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    expect(distance(el)).toBe(0)
    const before = el.scrollHeight
    await w.setProps({ messages: [agent('Streaming' + GROWN, { streaming: true })] })
    await settle()
    expect(el.scrollHeight).toBeGreaterThan(before + STREAM_FOLLOW_THRESHOLD) // growth really moved the edge
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('the same growth, scrolled up, leaves scrollTop where it was', async () => {
    const w = mountPanel([agent('Streaming', { streaming: true })])
    const el = layout(w)
    el.scrollTop = 37
    expect(distance(el)).toBeGreaterThan(STREAM_FOLLOW_THRESHOLD) // the precondition: not near the bottom
    await w.setProps({ messages: [agent('Streaming' + GROWN, { streaming: true })] })
    await settle()
    expect(el.scrollTop).toBe(37)
  })

  it('follows from exactly the threshold, and does not follow one pixel past it', async () => {
    for (const [offset, follows] of [
      [0, true],
      [STREAM_FOLLOW_THRESHOLD, true],
      [STREAM_FOLLOW_THRESHOLD + 1, false],
    ] as const) {
      const w = mountPanel([agent('Streaming', { streaming: true })])
      const el = layout(w)
      el.scrollTop = el.scrollHeight - VIEW - offset
      expect(distance(el)).toBe(offset)
      const parked = el.scrollTop
      await w.setProps({ messages: [agent('Streaming' + GROWN, { streaming: true })] })
      await settle()
      expect(el.scrollTop, `offset ${offset}`).toBe(follows ? el.scrollHeight : parked)
    }
  })

  it('follows the last token even when it arrives in the same update that settles the message', async () => {
    const w = mountPanel([agent('Streaming', { streaming: true })])
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    await w.setProps({ messages: [agent('Streaming' + GROWN)] })
    await settle()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('only a streaming message is followed: growth of a settled one leaves the log alone', async () => {
    const w = mountPanel([agent('Settled')])
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    const parked = el.scrollTop
    await w.setProps({ messages: [agent('Settled' + GROWN)] })
    await settle()
    expect(el.scrollTop).toBe(parked)
  })

  it('a new message still scrolls to the bottom from anywhere, under assistant', async () => {
    const w = mountPanel([agent('one')])
    const el = layout(w)
    el.scrollTop = 0
    await w.setProps({ messages: [agent('one'), agent('two')] })
    await settle()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  describe('an entry appended while a stream runs', () => {
    /* A tool card or a proposal arriving mid-turn changes messages.length. It goes through the same
     * at-bottom test as the stream; the reader's own message always scrolls. */
    const tool: ChatEntry = {
      kind: 'tool',
      callId: 'c1',
      name: 'example_tool',
      status: 'running',
      summary: 'a call that has just started',
    }
    const proposal: ChatEntry = {
      kind: 'proposal',
      id: 'p1',
      title: 'Example proposal',
      rows: [{ path: 'a.b', before: '1', after: '2' }],
      flags: [],
      status: 'pending',
    }
    const streaming = () => agent('Streaming', { streaming: true })
    const appended: [string, ChatEntry][] = [
      ['a tool card', tool],
      ['a proposal', proposal],
      ['a refusal', { kind: 'refusal', text: 'No.', source: 'api' }],
      ['a card', { kind: 'card', title: 't', body: 'b', source: 's' }],
      ['an agent text message', agent('a second reply')],
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
        await w.setProps({ messages: [streaming(), tool] })
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
      await w.setProps({ messages: [agent('Streaming'), tool] })
      await settle()
      expect(el.scrollTop).toBe(37)
    })

    it('scrolls from anywhere once nothing is streaming', async () => {
      const w = mountPanel([agent('Settled')])
      const el = layout(w)
      el.scrollTop = 0
      await w.setProps({ messages: [agent('Settled'), tool] })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })

    it('holds for a message pushed onto a reactive array', async () => {
      const messages = reactive<ChatEntry[]>([streaming()])
      const w = mountHost(messages)
      const el = layout(w)
      el.scrollTop = 37
      messages.push(tool)
      await settle()
      expect(el.scrollTop).toBe(37)
      messages.push({ kind: 'text', role: 'you', text: 'the next question' })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })

    it('under relay every new message scrolls, whatever is streaming', async () => {
      const w = mountPanel([streaming()], { actions: 'relay' })
      const el = layout(w)
      el.scrollTop = 37
      await w.setProps({ messages: [streaming(), tool] })
      await settle()
      expect(el.scrollTop).toBe(el.scrollHeight)
    })
  })

  it('under relay a new message scrolls to the bottom from scrollTop 0', async () => {
    const w = mountPanel([agent('one')], { actions: 'relay' })
    const el = layout(w)
    el.scrollTop = 0
    await w.setProps({ messages: [agent('one'), agent('two')] })
    await settle()
    expect(el.scrollTop).toBe(el.scrollHeight)
  })

  it('under relay the stream rule does not apply: growth at the bottom is not followed', async () => {
    const w = mountPanel([agent('Streaming', { streaming: true })], { actions: 'relay' })
    const el = layout(w)
    el.scrollTop = el.scrollHeight - VIEW
    const parked = el.scrollTop
    await w.setProps({ messages: [agent('Streaming' + GROWN, { streaming: true })] })
    await settle()
    expect(el.scrollTop).toBe(parked)
  })

  it('follows a message the app grows in place, the way a reactive array is driven', async () => {
    const messages = reactive<ChatEntry[]>([agent('Streaming', { streaming: true })])
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
    const w = mountPanel([agent('Max ' + REF + ' at', { streaming: true })])
    expect(statusRegions(w)).toHaveLength(1)
    const region = statusRegions(w)[0]!
    const mutations = mutationCounter(region)

    // while it streams, however many updates arrive
    for (const text of ['Max ' + REF + ' at J12', 'Max ' + REF + ' at J12 and ' + UNKNOWN_REF.slice(0, 6)]) {
      await w.setProps({ messages: [agent(text, { streaming: true })] })
      await settle()
      expect(region.textContent).toBe('')
    }
    expect(mutations.drain()).toBe(0)

    // it settles
    await w.setProps({ messages: [agent(SETTLED)] })
    await settle()
    expect(statusRegions(w)).toHaveLength(1)
    expect(statusRegions(w)[0]).toBe(region)
    expect(region.textContent).toBe(expectedAnnouncement(w))
    expect(region.textContent).toContain('unresolved: r9:no.such.path')
    expect(region.textContent).toContain('0.0123 m, r1, 3b1f2c9')
    expect(mutations.drain()).toBe(1)

    // and is posted to once: a re-render, or another message, adds nothing
    await w.setProps({ messages: [agent(SETTLED)] })
    await w.setProps({ messages: [agent(SETTLED), agent('later')] })
    await settle()
    expect(mutations.drain()).toBe(0)
    expect(region.textContent).toBe(expectedAnnouncement(w))
    mutations.stop()
  })

  it('announces a reply again even when it settles with exactly the words of the one before', async () => {
    const w = mountPanel([agent('Done.', { streaming: true })])
    const region = statusRegions(w)[0]!
    const mutations = mutationCounter(region)
    await w.setProps({ messages: [agent('Done.')] })
    await settle()
    expect(region.textContent).toBe('Done.')
    expect(mutations.drain()).toBe(1)
    await w.setProps({ messages: [agent('Done.'), agent('Done.', { streaming: true })] })
    await settle()
    expect(mutations.drain()).toBe(0) // streaming again: nothing is posted yet
    await w.setProps({ messages: [agent('Done.'), agent('Done.')] })
    await settle()
    expect(region.textContent).toBe('Done.')
    expect(mutations.drain()).toBe(1) // the same text, posted again
    mutations.stop()
  })

  it('posts when the app settles a message it grew in place', async () => {
    const messages = reactive<ChatEntry[]>([agent('Max ', { streaming: true })])
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
    const w = mountPanel([agent('Max ' + REF)])
    await w.setProps({ messages: [agent('Max ' + REF), agent('another')] })
    await settle()
    expect(statusRegions(w)[0]!.textContent).toBe('')
  })

  it('under relay there is no status region at all', () => {
    expect(statusRegions(mountPanel([agent('x')], { actions: 'relay' }))).toHaveLength(0)
  })

  it('every chip has an accessible name holding its text; the warning chip names itself unresolved', () => {
    const w = mountPanel([agent(REF + ' {{p2:rows.count}} {{c:limits.value}} ' + UNKNOWN_REF)])
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

  it('every status mark has an accessible name holding its text', () => {
    const w = mountPanel([
      { kind: 'tool', callId: 'c', name: 'n', status: 'refused', summary: 's' },
      { kind: 'proposal', id: 'p', title: 't', rows: [], flags: [], status: 'superseded' },
    ])
    const [tool, proposal] = w.findAll('.aether-chat__state')
    expect(accessibleName(tool!.element)).toContain('refused')
    expect(accessibleName(proposal!.element)).toContain('superseded')
  })

  it('negative arm: a settled message carries no aria-busy, and nothing but a streaming one does', () => {
    const w = mountPanel([agent('done'), agent('going', { streaming: true }), agent('also done', { streaming: false })])
    expect(w.findAll('[aria-busy]')).toHaveLength(1)
    expect(w.findAll('.aether-chat__msg').map((r) => r.attributes('aria-busy'))).toEqual([
      undefined,
      'true',
      undefined,
    ])
  })
})
