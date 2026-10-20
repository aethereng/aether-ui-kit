import { describe, it, expect } from 'vitest'
import { markdownBlocks, type MdInline } from '../markdown'

const NL = String.fromCharCode(10)

/* A compact reading of the inline tree, so a test states the structure it expects: `**x**` strong,
 * `*x*` emphasis, `` `x` `` code, `[x|kind]` a text piece under a mark, `{{scope:path}}` a reference,
 * and a newline for a break. Formatting that the parser hid is not in the reading. */
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

/** One reading per block: a paragraph as its inline text, a list as its kind and its items. */
function read(text: string, marks?: { start: number; end: number; kind: string }[]): string[] {
  return markdownBlocks(text, marks).map((b) =>
    b.kind === 'p' ? show(b.children) : `${b.ordered ? 'ol' : 'ul'}:${b.items.map(show).join('|')}`,
  )
}

describe('paragraphs, breaks and lists', () => {
  it('splits paragraphs at a blank line and keeps a single line break inside one', () => {
    expect(read('one' + NL + NL + 'two' + NL + 'three')).toEqual(['one', 'two' + NL + 'three'])
  })

  it('reads bullets and numbers as lists, and a number that starts above one as the list start', () => {
    expect(read('- a' + NL + '* b')).toEqual(['ul:a|b'])
    const [list] = markdownBlocks('3. c' + NL + '4. d')
    expect(list).toMatchObject({ kind: 'list', ordered: true, start: 3 })
    expect(read('3. c' + NL + '4. d')).toEqual(['ol:c|d'])
  })

  it('ends a list at a blank line and a paragraph at a list', () => {
    expect(read('- a' + NL + NL + 'after')).toEqual(['ul:a', 'after'])
    expect(read('lead' + NL + '- a')).toEqual(['lead', 'ul:a'])
  })

  it('negative arm: a line that only looks like a list marker is text', () => {
    expect(read('2024.5 was a year')).toEqual(['2024.5 was a year'])
    expect(read('-a dash')).toEqual(['-a dash'])
  })
})

describe('inline formatting', () => {
  it('reads bold, emphasis, inline code and all three together', () => {
    expect(read('**a** *b* `c` ***d***')).toEqual(['**a** *b* `c` ***d***'])
  })

  it('reads the underscore forms as the same formatting', () => {
    expect(read('__a__ _b_')).toEqual(['**a** *b*'])
  })

  it('keeps a run that never closes, or has a space after its opener, as text', () => {
    expect(read('**open')).toEqual(['**open'])
    expect(read('2 * 3 * 4')).toEqual(['2 * 3 * 4'])
  })

  it('does not read an underscore inside a word as emphasis', () => {
    expect(read('snake_case_name')).toEqual(['snake_case_name'])
  })

  it('leaves the markers inside a code span as text', () => {
    expect(read('`**x**`')).toEqual(['`**x**`'])
  })

  it('carries a line break inside bold as a break inside the bold', () => {
    expect(read('**a' + NL + 'b**')).toEqual(['**a' + NL + 'b**'])
  })
})

describe('links and markup stay inert', () => {
  it('renders a link as its label and drops its target', () => {
    const [para] = markdownBlocks('[see the docs](https://example.com/x)')
    expect(para).toEqual({ kind: 'p', children: [{ kind: 'text', text: 'see the docs', mark: null }] })
  })

  it('renders a javascript link as its label, with no target', () => {
    expect(read('[click](javascript:alert(1))')).toEqual(['click'])
  })

  it('keeps a script tag and an event attribute as text', () => {
    const text = '<script>alert(1)</script> <img src=x onerror=alert(1)>'
    expect(read(text)).toEqual([text])
  })

  it('does not make a link of a target that holds a reference, so the chip stays', () => {
    expect(read('[x]({{r1:a}})')).toEqual(['[x]({{r1:a}})'])
  })

  it('keeps a bare bracket as text', () => {
    expect(read('[note] fine')).toEqual(['[note] fine'])
  })
})

describe('references and marks inside formatting', () => {
  it('keeps a chip inside bold where it stands', () => {
    expect(read('**see {{r1:a.b}} now**')).toEqual(['**see {{r1:a.b}} now**'])
  })

  it('reads markers inside a reference path as part of the path', () => {
    expect(read('{{m1:a*b*c}}')).toEqual(['{{m1:a*b*c}}'])
  })

  it('keeps a mark inside bold as a mark over its characters', () => {
    const marks = [{ start: 6, end: 9, kind: 'bare_numeral' }]
    expect(read('**the 3.1 value**', marks)).toEqual(['**the [3.1|bare_numeral] value**'])
  })

  it('draws a mark over the characters it covers when hidden markers sit beside them', () => {
    const marks = [{ start: 0, end: 5, kind: 'bare_numeral' }]
    expect(read('*3.1*', marks)).toEqual(['*[3.1|bare_numeral]*'])
  })

  it('keeps a mark and a chip inside a list item where they stand', () => {
    const text = '- *the {{r1:x}} is 3.1*'
    const start = text.indexOf('3.1')
    const [list] = markdownBlocks(text, [{ start, end: start + 3, kind: 'bare_numeral' }])
    expect(list).toMatchObject({ kind: 'list' })
    expect(read(text, [{ start, end: start + 3, kind: 'bare_numeral' }])).toEqual([
      'ul:*the {{r1:x}} is [3.1|bare_numeral]*',
    ])
  })

  it('negative arm: a mark out of range, empty or inverted is not drawn', () => {
    expect(read('abc', [{ start: 0, end: 99, kind: 'bare_numeral' }])).toEqual(['abc'])
    expect(read('abc', [{ start: 2, end: 2, kind: 'bare_numeral' }])).toEqual(['abc'])
    expect(read('abc', [{ start: 2, end: 1, kind: 'bare_numeral' }])).toEqual(['abc'])
  })
})

describe('a reply with no markdown', () => {
  it('is one paragraph of text, unchanged', () => {
    expect(read('The value is 0.0123 m.')).toEqual(['The value is 0.0123 m.'])
  })

  it('negative arm: the same words with no marks carry no mark piece', () => {
    const [para] = markdownBlocks('The value is 0.0123 m.')
    expect(JSON.stringify(para)).not.toContain('"mark":"')
  })
})
