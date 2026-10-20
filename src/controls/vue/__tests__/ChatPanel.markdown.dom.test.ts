import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatPanel from '../ChatPanel.vue'
import type { ChatEntry, RefChipData } from '../../core'

/* An agent reply is read as markdown in the assistant panel. These tests read what the panel draws:
 * each construct as its element, a mark and a chip where they stand inside formatting, escaped text,
 * and the words a screen reader is given. The person's own messages and a relay panel stay as written. */

const NL = String.fromCharCode(10)

const RUN: RefChipData = {
  value: '0.0123',
  unit: 'm',
  source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a6b7c' },
  path: 'summary.max_abs_displacement',
  provenance: 'Example provenance line.',
}
const REF = '{{r1:summary.max_abs_displacement}}'
const resolveRef = (ref: string) => (ref === 'r1:summary.max_abs_displacement' ? RUN : null)

const wrappers: VueWrapper[] = []
function mountPanel(messages: ChatEntry[], props: Record<string, unknown> = {}) {
  const w = mount(ChatPanel, {
    props: { messages, modelValue: '', actions: 'assistant', resolveRef, ...props },
  })
  wrappers.push(w as unknown as VueWrapper)
  return w
}
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

const reply = (text: string, extra: Record<string, unknown> = {}): ChatEntry => ({ role: 'agent', text, ...extra }) as ChatEntry
const md = (w: VueWrapper) => w.find('.aether-chat__md')
const status = (w: VueWrapper) => w.find('.aether-chat__sr[role="status"] span').text()

describe('an agent reply is read as markdown', () => {
  it('draws each construct as its element: paragraph, strong, em, code, bullet list and numbered list', () => {
    const w = mountPanel([reply('**bold** *em* `code`' + NL + NL + '- one' + NL + '- two' + NL + NL + '1. first' + NL + '2. second')])
    expect(md(w).findAll('p')).toHaveLength(1)
    expect(md(w).find('strong').text()).toBe('bold')
    expect(md(w).find('em').text()).toBe('em')
    expect(md(w).find('code').text()).toBe('code')
    const [bullets, numbers] = md(w).findAll('ul, ol')
    expect(bullets!.element.tagName).toBe('UL')
    expect(bullets!.findAll('li').map((li) => li.text())).toEqual(['one', 'two'])
    expect(numbers!.element.tagName).toBe('OL')
    expect(numbers!.findAll('li').map((li) => li.text())).toEqual(['first', 'second'])
  })

  it('draws a line break inside a paragraph as a break, and starts a numbered list where the reply does', () => {
    const w = mountPanel([reply('a' + NL + 'b' + NL + NL + '3. c' + NL + '4. d')])
    expect(md(w).findAll('br')).toHaveLength(1)
    expect(md(w).find('ol').attributes('start')).toBe('3')
  })

  it('negative arm: the person\'s own words are not read as markdown', () => {
    const w = mountPanel([{ role: 'you', text: '**mine**' }])
    expect(w.find('strong').exists()).toBe(false)
    expect(w.text()).toContain('**mine**')
  })

  it('negative arm: a relay panel shows the reply verbatim, markers and all', () => {
    const w = mountPanel([reply('**bold**')], { actions: 'relay' })
    expect(md(w).exists()).toBe(false)
    expect(w.find('strong').exists()).toBe(false)
    expect(w.text()).toContain('**bold**')
  })
})

describe('escaping', () => {
  it('keeps a script tag and an event attribute as text, with no element made of them', () => {
    const w = mountPanel([reply('<script>alert(1)</script> <img src=x onerror=alert(1)>')])
    expect(md(w).find('script').exists()).toBe(false)
    expect(md(w).find('img').exists()).toBe(false)
    expect(md(w).text()).toBe('<script>alert(1)</script> <img src=x onerror=alert(1)>')
  })

  it('draws a javascript link as its label, with no anchor and no target', () => {
    const w = mountPanel([reply('[click](javascript:alert(1))')])
    expect(md(w).find('a').exists()).toBe(false)
    expect(md(w).text()).toBe('click')
  })
})

describe('marks and chips inside formatting', () => {
  it('keeps a mark inside bold as a mark, with its label of its kind', () => {
    const w = mountPanel([reply('**the 3.1 value**', { marks: [{ start: 6, end: 9, kind: 'bare_numeral' }] })])
    const mark = md(w).find('strong .aether-chat__mark')
    expect(mark.text()).toBe('bare_numeral: 3.1')
    expect(mark.attributes('title')).toBe('bare_numeral')
  })

  it('keeps a chip inside bold and inside a list item where it stands', () => {
    const w = mountPanel([reply('**see ' + REF + ' now**' + NL + NL + '- a ' + REF)])
    expect(md(w).find('strong .aether-chat-chip').exists()).toBe(true)
    expect(md(w).find('li .aether-chat-chip').exists()).toBe(true)
  })

  it('negative arm: a reply with no marks draws no mark element', () => {
    const w = mountPanel([reply('**the 3.1 value**')])
    expect(md(w).find('.aether-chat__mark').exists()).toBe(false)
  })
})

describe('streaming and the words a screen reader is given', () => {
  it('ends a streaming reply in its caret, inside the markdown, and drops the caret once it settles', async () => {
    const w = mountPanel([reply('**a** partial', { streaming: true })])
    expect(md(w).find('.aether-chat__caret').exists()).toBe(true)
    await w.setProps({ messages: [reply('**a** partial', { streaming: false })] })
    expect(md(w).find('.aether-chat__caret').exists()).toBe(false)
  })

  it('gives the words of a settled reply without its markers', async () => {
    const w = mountPanel([reply('**Table 3.1** holds', { streaming: true })])
    await w.setProps({ messages: [reply('**Table 3.1** holds', { streaming: false })] })
    expect(status(w)).toBe('Table 3.1 holds')
  })
})
