import { describe, it, expect } from 'vitest'
import { markdownBlocks, type MdBlock, type MdInline } from '../markdown'

const NL = String.fromCharCode(10)

/* A compact reading of the inline pieces, as the markdown test reads them: `**x**` strong, `*x*` emphasis,
 * `` `x` `` code, `[x|kind]` a text piece under a mark, `{{scope:path}}` a reference, a newline for a break. */
function show(nodes: readonly MdInline[]): string {
  return nodes
    .map((n) => {
      if (n.kind === 'text') return n.mark === null ? n.text : `[${n.text}|${n.mark}]`
      if (n.kind === 'ref') return `{{${n.ref}}}`
      if (n.kind === 'br') return NL
      const inner = show(n.children)
      if (n.kind === 'strong') return `**${inner}**`
      if (n.kind === 'em') return `*${inner}*`
      return '`' + inner + '`'
    })
    .join('')
}

/** One reading per block: a paragraph as its text, a heading with `#`, a list as its kind and items, a quote
 *  as `>` and its blocks in brackets, a code block between fences with its text in brackets. */
function blockText(b: MdBlock): string {
  if (b.kind === 'p') return show(b.children)
  if (b.kind === 'heading') return '# ' + show(b.children)
  if (b.kind === 'list') return `${b.ordered ? 'ol' : 'ul'}:${b.items.map(show).join('|')}`
  if (b.kind === 'quote') return '> [' + b.blocks.map(blockText).join(' ; ') + ']'
  return '```[' + show(b.children) + ']'
}

function read(text: string, marks?: { start: number; end: number; kind: string }[]): string[] {
  return markdownBlocks(text, marks).map(blockText)
}

describe('headings', () => {
  it('draws a line of one to four hashes as a heading, its closing hashes not drawn', () => {
    expect(read('## Title')).toEqual(['# Title'])
    expect(read('#### four')).toEqual(['# four'])
    expect(read('## Title ##')).toEqual(['# Title'])
  })

  it('a heading interrupts a paragraph, and the lines around it are paragraphs', () => {
    expect(read('lead' + NL + '## Head' + NL + 'after')).toEqual(['lead', '# Head', 'after'])
  })

  it('keeps a mark and a chip in a heading where they stand', () => {
    const text = '## the {{r1:x}} 3.1'
    const start = text.indexOf('3.1')
    expect(read(text, [{ start, end: start + 3, kind: 'bare_numeral' }])).toEqual([
      '# the {{r1:x}} [3.1|bare_numeral]',
    ])
  })

  it('negative arm: five hashes, a hash with no space, and a hash inside a word are text', () => {
    expect(read('##### five')).toEqual(['##### five'])
    expect(read('#tag')).toEqual(['#tag'])
    expect(read('C# rocks')).toEqual(['C# rocks'])
  })
})

describe('block quotes', () => {
  it('draws the lines of a quote as one quote, with the breaks between them', () => {
    expect(read('> one' + NL + '> two')).toEqual(['> [one' + NL + 'two]'])
  })

  it('ends a quote at a blank line, and reads what follows as a paragraph', () => {
    expect(read('> a' + NL + NL + 'after')).toEqual(['> [a]', 'after'])
  })

  it('reads a quote inside a quote', () => {
    expect(read('> > deep')).toEqual(['> [> [deep]]'])
  })

  it('keeps emphasis that crosses two quoted lines, with the quote markers not read as text', () => {
    expect(read('> **a' + NL + '> b**')).toEqual(['> [**a' + NL + 'b**]'])
  })

  it('keeps a mark in a quote where it stands', () => {
    const text = '> the 3.1 value'
    const start = text.indexOf('3.1')
    expect(read(text, [{ start, end: start + 3, kind: 'bare_numeral' }])).toEqual([
      '> [the [3.1|bare_numeral] value]',
    ])
  })

  it('negative arm: a greater-than sign inside a line is text', () => {
    expect(read('a > b')).toEqual(['a > b'])
  })
})

describe('fenced code blocks', () => {
  it('draws the lines between the fences, and drops the language word', () => {
    expect(read('```ts' + NL + 'const a = 1' + NL + '```')).toEqual(['```[const a = 1]'])
  })

  it('keeps the spaces and the line breaks of the block', () => {
    expect(read('```' + NL + '  indented' + NL + NL + '  x' + NL + '```')).toEqual([
      '```[  indented' + NL + NL + '  x]',
    ])
  })

  it('reads nothing inside the block as markup', () => {
    expect(read('```' + NL + '**not bold** *x*' + NL + '```')).toEqual(['```[**not bold** *x*]'])
    // the reading above cannot tell strong text from literal asterisks, so the node is checked too
    const [code] = markdownBlocks('```' + NL + '**not bold** *x*' + NL + '```')
    expect(code).toEqual({ kind: 'code', children: [{ kind: 'text', text: '**not bold** *x*', mark: null }] })
  })

  it('keeps a numeral in the block marked, where it stands', () => {
    const text = '```' + NL + 'x = 3.1' + NL + '```'
    const start = text.indexOf('3.1')
    expect(read(text, [{ start, end: start + 3, kind: 'bare_numeral' }])).toEqual(['```[x = [3.1|bare_numeral]]'])
  })

  it('keeps a reference in the block as a chip', () => {
    expect(read('```' + NL + '{{r1:x}}' + NL + '```')).toEqual(['```[{{r1:x}}]'])
  })

  it('runs an unclosed block to the end of the reply, while it streams', () => {
    expect(read('```' + NL + 'line one' + NL + 'line two')).toEqual(['```[line one' + NL + 'line two]'])
  })

  it('closes the block when its closing fence arrives, and reads what follows as a paragraph', () => {
    expect(read('```' + NL + 'line one' + NL + 'line two' + NL + '```' + NL + 'after')).toEqual([
      '```[line one' + NL + 'line two]',
      'after',
    ])
  })

  it('reads a block inside a quote', () => {
    expect(read('> ```' + NL + '> code' + NL + '> ```')).toEqual(['> [```[code]]'])
  })

  it('a closing fence must use the same character and at least as many', () => {
    expect(read('````' + NL + 'x' + NL + '```' + NL + '````')).toEqual(['```[x' + NL + '```]'])
    expect(read('~~~' + NL + 'x' + NL + '```' + NL + '~~~')).toEqual(['```[x' + NL + '```]'])
  })

  it('negative arm: a list marker inside a block is text, and two backticks open nothing', () => {
    expect(read('```' + NL + '- not a list' + NL + '```')).toEqual(['```[- not a list]'])
    expect(read('``')).toEqual(['``'])
  })
})
