import { describe, it, expect } from 'vitest'
import {
  describeRef,
  findBareNumerals,
  isTextMessage,
  splitReferences,
  REDUCED_TEXT,
  UNRESOLVED_TEXT,
} from '../chat'
import type { ChatEntry, RefChipData } from '../chat'

/* The core is where the assistant's two rules live: what counts as a reference, and what counts as
 * a bare numeral. Both are rules a gate leans on, so every one of them is pinned here as its own
 * case. A detector that always fires passes a positive-only suite, so each positive has a negative
 * that must come back empty. */

const NL = String.fromCharCode(10)
/* Built from code points, never typed: a digit from another script, a superscript or a circled
 * figure is exactly the kind of character an editor or a shell quietly rewrites. */
const ch = (cp: number) => String.fromCodePoint(cp)
const LSQUO = ch(0x2018)
const RSQUO = ch(0x2019)

describe('splitReferences', () => {
  /* One text holding two references and one of each malformed case the grammar names. */
  const REF_A = '{{r1:summary.max_abs_displacement}}'
  const REF_B = '{{c:solver.version}}'
  const MALFORMED = {
    unclosed: '{{r1:never_closed',
    strayClose: 'r1:stray}}',
    empty: '{{}}',
    badScope: '{{x1:abc}}',
    whitespace: '{{r1: abc}}',
    nested: '{{r1:a{{b}}',
  }
  const seeded = [
    `Lead ${REF_A} then`,
    `open ${MALFORMED.unclosed} here`,
    `close ${MALFORMED.strayClose} here`,
    `empty ${MALFORMED.empty} here`,
    `scope ${MALFORMED.badScope} here`,
    `space ${MALFORMED.whitespace} here`,
    `nest ${MALFORMED.nested} here`,
    `tail ${REF_B}.`,
  ].join(NL)

  it('finds exactly the two references in the seeded text', () => {
    const refs = splitReferences(seeded).filter((s) => s.kind === 'ref')
    expect(refs.map((s) => s.text)).toEqual([REF_A, REF_B])
  })

  it('reports each reference as scope:path, with its own offsets', () => {
    const [a, b] = splitReferences(seeded).filter((s) => s.kind === 'ref')
    expect(a).toMatchObject({
      ref: 'r1:summary.max_abs_displacement',
      scope: 'r1',
      path: 'summary.max_abs_displacement',
    })
    expect(b).toMatchObject({ ref: 'c:solver.version', scope: 'c', path: 'solver.version' })
    for (const s of [a!, b!]) expect(seeded.slice(s.start, s.end)).toBe(s.text)
  })

  it('loses nothing: the segments concatenate back to the input, and are contiguous', () => {
    const segs = splitReferences(seeded)
    expect(segs.map((s) => s.text).join('')).toBe(seeded)
    let at = 0
    for (const s of segs) {
      expect(s.start).toBe(at)
      at = s.end
    }
    expect(at).toBe(seeded.length)
  })

  it.each(Object.entries(MALFORMED))('leaves the malformed case "%s" as plain text, whole', (_n, bad) => {
    const plain = splitReferences(seeded).filter((s) => s.kind === 'text')
    expect(plain.some((s) => s.text.includes(bad))).toBe(true)
  })

  it('negative arm: the six malformed cases alone yield no reference at all', () => {
    const only = Object.values(MALFORMED).join(NL)
    expect(splitReferences(only).filter((s) => s.kind === 'ref')).toEqual([])
    expect(splitReferences(only).map((s) => s.text).join('')).toBe(only)
  })

  it('takes a scope of m<k>, p<k>, r<k> (k a positive integer), c or s, and nothing else', () => {
    const valid = ['m1', 'm12', 'p2', 'p30', 'r1', 'r104', 'c', 's']
    const invalid = ['m', 'p', 'r', 'm0', 'r01', 'r-1', 'r1.5', 'c1', 's2', 'M1', 'R1', 'x1', 'rr1', '1r', '']
    for (const scope of valid)
      expect(splitReferences(`{{${scope}:a.b}}`).map((s) => s.kind), scope).toEqual(['ref'])
    for (const scope of invalid)
      expect(splitReferences(`{{${scope}:a.b}}`).map((s) => s.kind), `"${scope}"`).toEqual(['text'])
  })

  it('lets a path hold a colon, and refuses one holding a brace or whitespace', () => {
    expect(splitReferences('{{r1:a:b}}')[0]).toMatchObject({ kind: 'ref', path: 'a:b' })
    for (const bad of ['{{r1:}}', '{{r1:a b}}', '{{r1:a}b}}', '{{r1:a{b}}', '{{r1:a' + NL + 'b}}', '{{r1:a' + ch(0xa0) + 'b}}'])
      expect(splitReferences(bad).map((s) => s.kind), JSON.stringify(bad)).toEqual(['text'])
  })

  it('reads a valid reference inside a malformed outer pair as a reference (the outer pair stays plain text)', () => {
    const segs = splitReferences('{{r1:{{r2:x}}}}')
    expect(segs.map((s) => [s.kind, s.text])).toEqual([
      ['text', '{{r1:'],
      ['ref', '{{r2:x}}'],
      ['text', '}}'],
    ])
  })

  it('becomes a reference only once its closing braces have arrived', () => {
    const full = 'see ' + REF_A + ' now'
    const end = full.indexOf(REF_A) + REF_A.length
    for (let n = 0; n < end; n++)
      expect(splitReferences(full.slice(0, n)).filter((s) => s.kind === 'ref'), `prefix ${n}`).toEqual([])
    expect(splitReferences(full.slice(0, end)).filter((s) => s.kind === 'ref')).toHaveLength(1)
  })

  it('returns no segments for the empty string, and one text segment for plain text', () => {
    expect(splitReferences('')).toEqual([])
    expect(splitReferences('plain')).toEqual([{ kind: 'text', text: 'plain', start: 0, end: 5 }])
  })
})

describe('findBareNumerals', () => {
  const ADMITTED = ['J12', 'M3']
  const spansOf = (text: string, admitted: Iterable<string> = ADMITTED) =>
    findBareNumerals(text, admitted).map((s) => text.slice(s.start, s.end))

  it('seeded positive: one span, at 12.5', () => {
    const text = 'The deflection is 12.5 mm at J12.'
    const spans = findBareNumerals(text, ['J12'])
    expect(spans).toHaveLength(1)
    expect(text.slice(spans[0]!.start, spans[0]!.end)).toBe('12.5')
    expect(spans[0]!.start).toBe(text.indexOf('12.5'))
  })

  it('negative arm: the same sentence with a reference in place of the number yields none', () => {
    expect(
      findBareNumerals('The deflection is {{r1:summary.max_abs_displacement}} at J12.', ['J12']),
    ).toEqual([])
  })

  describe('boundaries, each its own case', () => {
    it('J12. (a trailing full stop) compares as J12', () => expect(spansOf('see J12.')).toEqual([]))
    it('(J12) compares as J12', () => expect(spansOf('see (J12)')).toEqual([]))
    it("J12's compares as J12", () => expect(spansOf("see J12's")).toEqual([]))
    it("strips a full stop and then 's, in either nesting", () => {
      expect(spansOf("see (J12's).")).toEqual([])
      expect(spansOf("see 'J12'")).toEqual([])
    })
    it("the trailing strip repeats: J12's's compares as J12", () => {
      expect(spansOf("see J12's's")).toEqual([])
      expect(spansOf('see J12' + RSQUO + 's' + RSQUO + 's')).toEqual([])
    })
    it('a typographic apostrophe is stripped like the ASCII one', () => {
      expect(spansOf('see J12' + RSQUO + 's')).toEqual([])
      expect(spansOf('see (J12' + RSQUO + 's).')).toEqual([])
      expect(spansOf('see ' + LSQUO + 'J12' + RSQUO)).toEqual([])
      expect(spansOf('see J12' + RSQUO)).toEqual([])
    })
    it('negative arm: a typographic apostrophe admits nothing else', () => {
      expect(spansOf('see J13' + RSQUO + 's')).toEqual(['J13'])
      expect(spansOf('see ' + LSQUO + 'J13' + RSQUO)).toEqual(['J13'])
      expect(spansOf('see J12' + RSQUO + 'x')).toEqual(['J12' + RSQUO + 'x'])
    })
    it('M3 yields none when admitted', () => expect(spansOf('see M3', ['M3'])).toEqual([]))
    it('M3 yields one when not admitted', () => expect(spansOf('see M3', [])).toEqual(['M3']))
    it('a code span holding a digit is a violation', () => expect(spansOf('use `x2` here')).toEqual(['`x2`']))
    it('J12 in backticks is a violation (a backtick is not stripped)', () =>
      expect(spansOf('see `J12` there')).toEqual(['`J12`']))
    it('J12 in bold is a violation (an asterisk is not stripped)', () =>
      expect(spansOf('see **J12** there')).toEqual(['**J12**']))
    it('a superscript digit is a violation', () => {
      const sup = 'x' + ch(0xb2)
      expect(spansOf(`area ${sup}`)).toEqual([sup])
    })
    it('U+0663 (an Arabic-Indic three) is a violation', () => {
      const three = ch(0x0663)
      expect(spansOf(`value ${three}`)).toEqual([three])
    })
    it('a line starting 1. is an ordered-list marker, not a violation', () =>
      expect(spansOf('1. First step')).toEqual([]))
    it('a line starting 1) is an ordered-list marker too', () =>
      expect(spansOf('1) First step')).toEqual([]))
  })

  describe('the list-marker exemption is narrow', () => {
    it('markers on later lines, and after indentation, are exempt', () => {
      expect(spansOf('Steps:' + NL + '1. one' + NL + '  2. two' + NL + '10. ten')).toEqual([])
    })
    it('a number glued to a marker-shaped token is still a violation', () =>
      expect(spansOf('1.5 mm at the start')).toEqual(['1.5']))
    it('the same token mid-line is a violation', () => expect(spansOf('see step 1. then stop')).toEqual(['1']))
    it('the digit after a marker is checked on its own', () =>
      expect(spansOf('1. 5 mm was measured')).toEqual(['5']))
    it('a marker in another script is not exempt', () => {
      const marker = ch(0x0663) + '.'
      expect(findBareNumerals(marker + ' step', [])).toHaveLength(1)
    })
  })

  describe('what is a digit', () => {
    const digits: [string, number][] = [
      ['ASCII 0', 0x30],
      ['ASCII 9', 0x39],
      ['Arabic-Indic 3', 0x0663],
      ['Devanagari 6', 0x096c],
      ['mathematical bold 0 (outside the BMP)', 0x1d7ce],
      ['superscript 1', 0xb9],
      ['superscript 2', 0xb2],
      ['superscript 3', 0xb3],
      ['superscript 0', 0x2070],
      ['superscript 4', 0x2074],
      ['superscript 9', 0x2079],
      ['subscript 0', 0x2080],
      ['subscript 9', 0x2089],
    ]
    const notDigits: [string, number][] = [
      ['vulgar fraction one half', 0xbd],
      ['Roman numeral four', 0x2163],
      ['circled digit one', 0x2460],
      ['superscript i (just before the 4)', 0x2071],
      ['superscript plus (just after the 9)', 0x207a],
      ['subscript plus (just after the 9)', 0x208a],
      ['acute accent (next to the superscripts)', 0xb4],
      ['letter x', 0x78],
    ]
    it.each(digits)('%s is a digit', (_n, cp) => {
      expect(findBareNumerals('q ' + ch(cp), [])).toHaveLength(1)
    })
    it.each(notDigits)('%s is not a digit', (_n, cp) => {
      expect(findBareNumerals('q ' + ch(cp), [])).toEqual([])
    })
  })

  it('reports offsets in UTF-16 code units, not code points', () => {
    const text = ch(0x1f600) + ' 12 ' + ch(0x1d7ce)
    const spans = findBareNumerals(text, [])
    expect(spans).toEqual([
      { start: 3, end: 5 },
      { start: 6, end: 8 },
    ])
    expect(text.slice(6, 8)).toBe(ch(0x1d7ce))
  })

  it('spans exclude the punctuation stripped for comparison', () => {
    expect(spansOf('about (12.5), then 3.')).toEqual(['12.5', '3'])
  })

  it('is case-sensitive: j12 is not the admitted J12', () => expect(spansOf('see j12')).toEqual(['j12']))

  it('treats a token as the whole whitespace-delimited run: J12,J13 is not J12', () =>
    expect(spansOf('see J12,J13')).toEqual(['J12,J13']))

  it('returns spans in ascending order, and accepts any iterable of ids', () => {
    const text = 'a 1 b J12 c 2 d M3 e 3'
    const spans = findBareNumerals(text, new Set(['J12', 'M3']))
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(['1', '2', '3'])
    expect(spans.map((s) => s.start)).toEqual([...spans.map((s) => s.start)].sort((x, y) => x - y))
    expect(findBareNumerals(text, ['J12', 'M3'])).toEqual(spans)
  })

  it('reads text outside references only, and a reference is a token boundary', () => {
    expect(spansOf('{{r1:a.b}}3 and x{{r1:a.b}}')).toEqual(['3'])
  })

  /* DECISION, pinned: this function does not report a reference whose scope id the caller's index
   * does not hold. It is handed the identifiers admitted in text, not an index of scope ids, so it
   * cannot know; the caller reports an unresolved reference itself, after asking its own index. */
  it('leaves an unknown scope id to the caller: r999 is a reference, so it yields no span', () => {
    expect(findBareNumerals('see {{r999:summary.x}} here', [])).toEqual([])
  })

  it('reads a reference still being typed as plain text, so its digit is a violation', () => {
    // the opening braces are in the strip set, so the span starts at the scope
    expect(spansOf('see {{r1:summary')).toEqual(['r1:summary'])
  })
})

describe('isTextMessage', () => {
  it('is true for kind omitted and for kind text, false for every other kind', () => {
    const entries: [ChatEntry, boolean][] = [
      [{ role: 'you', text: 'a' }, true],
      [{ kind: 'text', role: 'agent', text: 'a' }, true],
      [{ kind: 'tool', callId: 'c', name: 'n', status: 'done', summary: 's' }, false],
      [{ kind: 'refusal', text: 't', source: 'api' }, false],
      [{ kind: 'proposal', id: 'p', title: 't', rows: [], flags: [], status: 'pending' }, false],
      [{ kind: 'card', title: 't', body: 'b', source: 's' }, false],
    ]
    for (const [e, want] of entries) expect(isTextMessage(e)).toBe(want)
  })
})

describe('describeRef', () => {
  const run: RefChipData = {
    value: '0.0123',
    unit: 'm',
    source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a6b7c' },
    path: 'summary.max_abs_displacement',
    provenance: 'Example provenance line.',
  }
  const resolved = (d: RefChipData, ref = 'r1:summary.max_abs_displacement') => {
    const t = describeRef(ref, d)
    if (!t.resolved) throw new Error('expected a resolved description')
    return t
  }

  it('reads a run value as value, unit, id and a seven-character hash', () => {
    const t = resolved(run)
    expect(t.quantity).toBe('0.0123 m')
    expect(t.tag).toBe('r1 · 3b1f2c9')
    expect(t.quantity + ' · ' + t.tag).toBe('0.0123 m · r1 · 3b1f2c9')
  })

  it('reads a proposal value the same way, and a unitless one without a stray space', () => {
    const t = resolved({
      value: '3',
      unit: null,
      source: { kind: 'proposal', id: 'p2', hash: 'a9e07f1abcdef' },
      path: 'rows.count',
      provenance: null,
    })
    expect(t.quantity + ' · ' + t.tag).toBe('3 · p2 · a9e07f1')
  })

  it.each([
    ['capabilities', '1.37 · build 9c04e2d'],
    ['schema', '1.37 · build 9c04e2d'],
  ] as const)('reads a %s value as a build with no id', (kind, shown) => {
    const t = resolved({
      value: '1.37',
      unit: null,
      source: { kind, id: null, hash: '9c04e2d11223344' },
      path: 'limits.value',
      provenance: null,
    })
    expect(t.quantity + ' · ' + t.tag).toBe(shown)
  })

  it('shortens to seven characters and keeps a shorter hash whole', () => {
    expect(resolved({ ...run, source: { ...run.source, hash: 'abc' } }).tag).toBe('r1 · abc')
  })

  it('puts the path, the provenance and the FULL hash on hover', () => {
    const t = resolved(run)
    expect(t.hover).toContain('summary.max_abs_displacement')
    expect(t.hover).toContain('Example provenance line.')
    expect(t.hover).toContain('3b1f2c9d4e5a6b7c')
  })

  it('names what the hash is by the source kind', () => {
    const hover = (kind: RefChipData['source']['kind']) =>
      resolved({ ...run, source: { kind, id: null, hash: 'ffffffff' } }).hover
    expect(hover('run')).toContain('engine build')
    expect(hover('model')).toContain('input hash')
    expect(hover('proposal')).toContain('proposal hash')
    expect(hover('capabilities')).toContain('build ffffffff')
    expect(hover('schema')).toContain('build ffffffff')
  })

  it('takes the noun for a capabilities or schema build from the app, and says "build" alone without one', () => {
    const hashLine = (kind: 'capabilities' | 'schema', buildNoun?: string | null) =>
      resolved({ ...run, buildNoun, source: { kind, id: null, hash: 'ffffffff' } }).hover.split(NL)
    expect(hashLine('capabilities', 'Acme')).toContain('Acme build ffffffff')
    expect(hashLine('schema', 'Acme')).toContain('Acme build ffffffff')
    expect(hashLine('capabilities', null)).toContain('build ffffffff')
    expect(hashLine('capabilities')).not.toContain('Acme build ffffffff')
  })

  it('leaves the noun out of every other kind, which keep their own hover words', () => {
    const hover = (kind: RefChipData['source']['kind']) =>
      resolved({ ...run, buildNoun: 'Acme', source: { kind, id: null, hash: 'ffffffff' } }).hover
    expect(hover('run')).toContain('engine build ffffffff')
    expect(hover('findings')).toContain('build ffffffff')
    expect(hover('findings')).not.toContain('Acme')
  })

  it('leaves the provenance line out of the hover when there is none', () => {
    const t = resolved({ ...run, provenance: null })
    expect(t.hover.split(NL)).toEqual([run.path, 'engine build 3b1f2c9d4e5a6b7c'])
  })

  it('leaves out what is empty: no id and no hash is a bare quantity, with no separator and no hash line', () => {
    const t = resolved({ ...run, source: { kind: 'capabilities', id: null, hash: '' } })
    expect(t.tag).toBe('')
    expect(t.name).toBe('summary.max_abs_displacement: 0.0123 m')
    expect(t.hover.split(NL)).toEqual([run.path, 'Example provenance line.'])
  })

  it('an id with no hash tags the id alone, and reduced follows whatever is left', () => {
    const idOnly = resolved({ ...run, source: { ...run.source, hash: '' } })
    expect(idOnly.tag).toBe('r1')
    expect(idOnly.name).toBe('summary.max_abs_displacement: 0.0123 m, r1')
    expect(idOnly.hover).not.toContain('engine build')
    const reduced = resolved({ ...run, source: { kind: 'schema', id: null, hash: '' }, reduced: true })
    expect(reduced.tag).toBe(REDUCED_TEXT)
    expect(reduced.name).toBe('summary.max_abs_displacement: 0.0123 m, ' + REDUCED_TEXT)
  })

  it('an empty path and value start the name at the first tag, with no leading separator', () => {
    const bare = { ...run, path: '', value: '', unit: null }
    expect(resolved(bare).name).toBe('r1, 3b1f2c9')
    expect(resolved({ ...bare, source: { ...run.source, hash: '' } }).name).toBe('r1')
    expect(resolved({ ...bare, source: { ...run.source, hash: '' }, reduced: true }).name).toBe('r1, ' + REDUCED_TEXT)
  })

  it('adds the reduced word to the tag, the name and the hover, only when reduced', () => {
    const reduced = resolved({ ...run, reduced: true })
    expect(REDUCED_TEXT).toBe('reduced')
    for (const text of [reduced.tag, reduced.name, reduced.hover]) expect(text).toContain(REDUCED_TEXT)
    const plain = resolved(run)
    for (const text of [plain.tag, plain.name, plain.hover]) expect(text).not.toContain(REDUCED_TEXT)
    expect(resolved({ ...run, reduced: false }).tag).toBe(plain.tag)
  })

  it('builds the accessible name from the path, value, unit and tag', () => {
    const t = resolved(run)
    expect(t.name).toBe('summary.max_abs_displacement: 0.0123 m, r1, 3b1f2c9')
  })

  it('describes an unresolved reference by its text and the reference string, never as a value', () => {
    const t = describeRef('r9:no.such.path', null)
    expect(t.resolved).toBe(false)
    expect(UNRESOLVED_TEXT).toBe('unresolved')
    expect(t.name).toBe('unresolved: r9:no.such.path')
  })

  it('negative arm: a resolved description never carries the word unresolved', () => {
    const t = resolved(run)
    for (const text of [t.name, t.tag, t.quantity, t.hover]) expect(text).not.toContain(UNRESOLVED_TEXT)
  })
})
