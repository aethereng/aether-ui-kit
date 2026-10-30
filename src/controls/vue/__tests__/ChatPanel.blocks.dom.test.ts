import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatPanel from '../ChatPanel.vue'
import type { ChatEntry, RefChipData } from '../../core'

/* Headings, block quotes and fenced code in a reply, as a rich log draws them. Each is
 * drawn as its element and as text: no heading element of any size, no markup from a code block, and
 * a mark or a chip kept inside each block. */

const NL = String.fromCharCode(10)

const RUN: RefChipData = {
  value: '0.0123',
  unit: 'm',
  source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a6b7c' },
  path: 'summary.max_abs_displacement',
  provenance: 'Example provenance line.',
}
const resolveRef = (ref: string) => (ref === 'r1:summary.max_abs_displacement' ? RUN : null)

const wrappers: VueWrapper[] = []
function mountPanel(messages: ChatEntry[], props: Record<string, unknown> = {}) {
  const w = mount(ChatPanel, {
    props: { messages, modelValue: '', rich: true, resolveRef, ...props },
  })
  wrappers.push(w as unknown as VueWrapper)
  return w
}
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

const reply = (text: string, extra: Record<string, unknown> = {}): ChatEntry => ({ role: 'reply', text, ...extra }) as ChatEntry
const md = (w: VueWrapper) => w.find('.aether-chat__md')
const status = (w: VueWrapper) => w.find('.aether-chat__sr[role="status"] span').text()

describe('a heading is one bold line of the reply', () => {
  it('draws a heading as a paragraph with bold text, and no heading element of any size', () => {
    const w = mountPanel([reply('## Result')])
    expect(md(w).find('p.aether-chat__md-heading strong').text()).toBe('Result')
    expect(md(w).find('h1, h2, h3, h4, h5, h6').exists()).toBe(false)
  })

  it('negative arm: five hashes are text, not a heading', () => {
    const w = mountPanel([reply('##### five')])
    expect(md(w).find('.aether-chat__md-heading').exists()).toBe(false)
    expect(md(w).text()).toBe('##### five')
  })

  it('negative arm: the person\'s own hashes are not read', () => {
    const w = mountPanel([{ role: 'you', text: '## mine' }])
    expect(w.find('.aether-chat__md-heading').exists()).toBe(false)
    expect(w.text()).toContain('## mine')
  })
})

describe('a block quote is an indented block', () => {
  it('draws the quoted lines in a blockquote, without their markers', () => {
    const w = mountPanel([reply('> quoted' + NL + '> line')])
    expect(md(w).find('blockquote').text()).toBe('quotedline')
    expect(md(w).find('blockquote br').exists()).toBe(true)
    expect(md(w).find('blockquote').text()).not.toContain('>')
  })

  it('keeps a mark inside a quote where it stands', () => {
    const w = mountPanel([reply('> the 3.1 value', { marks: [{ start: 6, end: 9, kind: 'bare_numeral' }] })])
    expect(md(w).find('blockquote .aether-chat__mark').text()).toBe('bare_numeral: 3.1')
  })

  it('negative arm: a greater-than sign inside a line is text, with no blockquote', () => {
    const w = mountPanel([reply('a > b')])
    expect(md(w).find('blockquote').exists()).toBe(false)
    expect(md(w).text()).toBe('a > b')
  })
})

describe('a fenced code block is a monospace block', () => {
  it('draws the lines in a preformatted block, with the language word not drawn', () => {
    const w = mountPanel([reply('```ts' + NL + 'const a = 1' + NL + '  b' + NL + '```')])
    const pre = md(w).find('pre.aether-chat__md-code')
    expect(pre.find('code').exists()).toBe(true)
    expect(pre.findAll('br')).toHaveLength(1)
    expect(pre.text()).toContain('  b')
    expect(pre.text().startsWith('const a = 1')).toBe(true)
  })

  it('reads nothing inside the block as markup', () => {
    const w = mountPanel([reply('```' + NL + '<script>x</script> **y**' + NL + '```')])
    expect(md(w).find('script').exists()).toBe(false)
    expect(md(w).find('strong').exists()).toBe(false)
    expect(md(w).find('pre').text()).toContain('<script>x</script> **y**')
  })

  it('keeps a numeral marked and a reference a chip inside the block', () => {
    const text = '```' + NL + 'x = 3.1 {{r1:summary.max_abs_displacement}}' + NL + '```'
    const w = mountPanel([reply(text, { marks: [{ start: text.indexOf('3.1'), end: text.indexOf('3.1') + 3, kind: 'bare_numeral' }] })])
    expect(md(w).find('pre .aether-chat__mark').text()).toBe('bare_numeral: 3.1')
    expect(md(w).find('pre .aether-chat-chip').exists()).toBe(true)
  })

  it('a block that has not closed yet holds the text so far, and closes when its fence arrives', async () => {
    const w = mountPanel([reply('```' + NL + 'line one', { streaming: true })])
    expect(md(w).find('pre').text()).toBe('line one')
    await w.setProps({ messages: [reply('```' + NL + 'line one' + NL + 'line two', { streaming: true })] })
    expect(md(w).find('pre').text()).toContain('line two')
    await w.setProps({
      messages: [reply('```' + NL + 'line one' + NL + 'line two' + NL + '```' + NL + 'after', { streaming: false })],
    })
    expect(md(w).findAll('pre')).toHaveLength(1)
    expect(md(w).find('p').text()).toBe('after')
  })

  it('negative arm: a plain log shows the fence and its hashes as written', () => {
    const w = mountPanel([reply('## Result')], { rich: false })
    expect(md(w).exists()).toBe(false)
    expect(w.text()).toContain('## Result')
  })
})

describe('the words a screen reader is given for these blocks', () => {
  it('gives the heading text without its hashes, and the quote and block text without their markers', async () => {
    const w = mountPanel([reply('## Result', { streaming: true })])
    await w.setProps({ messages: [reply('## Result' + NL + '> quoted' + NL + '```' + NL + 'x = 1' + NL + '```', { streaming: false })] })
    expect(status(w)).toBe('Result' + NL + NL + 'quoted' + NL + NL + 'x = 1')
  })
})

describe('a plain reply keeps the spacing of its lines', () => {
  it('the reply markdown is drawn pre-wrap, so a run of blanks stays a run', () => {
    const source = readFileSync(resolve(__dirname, '../ChatPanel.vue'), 'utf8')
    expect(source).toMatch(/\.aether-chat__md \{\s*white-space: pre-wrap;/)
  })

  it('negative arm: the rule is not left at normal, which collapses the blanks', () => {
    const source = readFileSync(resolve(__dirname, '../ChatPanel.vue'), 'utf8')
    expect(source).not.toMatch(/\.aether-chat__md \{\s*white-space: normal;/)
  })
})

describe('a line of many quote markers does not blank the panel', () => {
  it('draws a reply of 5,000 `>` without throwing, and the text after them', () => {
    const w = mountPanel([reply('>'.repeat(5000) + ' after')])
    expect(md(w).text()).toContain('after')
    expect(md(w).findAll('blockquote')).toHaveLength(8)
  })

  it('draws three levels of quote as three nested quotes', () => {
    const w = mountPanel([reply('> > > x')])
    expect(md(w).findAll('blockquote')).toHaveLength(3)
  })

  it('negative arm: a ninth `>` is text, and the eight quotes above it still draw', () => {
    const w = mountPanel([reply('>'.repeat(9) + ' x')])
    expect(md(w).findAll('blockquote')).toHaveLength(8)
    expect(md(w).text()).toContain('> x')
  })
})
