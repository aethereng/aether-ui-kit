import { describe, expect, it } from 'vitest'
import { CHIP_TEXT_LIMIT, describeRef, REDUCED_TEXT, type RefChipData, type RefChipText } from '../chat'

const chip = (over: Partial<RefChipData>): RefChipData => ({
  value: '1',
  unit: null,
  source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a' },
  path: 'summary.x',
  provenance: null,
  ...over,
})

function resolved(t: RefChipText) {
  if (!t.resolved) throw new Error('expected a resolved chip')
  return t
}

describe('the chip additions', () => {
  it('tags a verification by its id and the first seven characters of its building result hash', () => {
    const t = resolved(
      describeRef(
        '{{v1:members[e103].status}}',
        chip({ value: 'OK', source: { kind: 'verification', id: 'v1', hash: 'a1b2c3d4e5f6' }, path: 'members[e103].status' }),
      ),
    )
    expect(t.tag).toBe('v1 · a1b2c3d')
  })

  it('tags a finding by its id and the build, and a registry record by the build alone', () => {
    expect(resolved(describeRef('{{f1:import.omitted[#2].reason}}', chip({ source: { kind: 'findings', id: 'f1', hash: '9c04e2d1ff' } }))).tag).toBe(
      'f1 · build 9c04e2d',
    )
    expect(resolved(describeRef('{{g:checks[x].status}}', chip({ source: { kind: 'registry', id: null, hash: '9c04e2d1ff' } }))).tag).toBe(
      'build 9c04e2d',
    )
  })

  it('shows a capabilities tag as the viewer build with no id', () => {
    expect(resolved(describeRef('{{c:the-checks.en-1993.record.status.n1}}', chip({ source: { kind: 'capabilities', id: null, hash: '9c04e2d1ff' } }))).tag).toBe(
      'build 9c04e2d',
    )
  })

  it('shows a string value in the chip with no unit, and its accessible name holds the string', () => {
    const t = resolved(describeRef('{{v1:members[e103].status}}', chip({ value: 'OK', source: { kind: 'verification', id: 'v1', hash: 'a1b2c3d4e5' } })))
    expect(t.quantity).toBe('OK')
    expect(t.name).toBe('summary.x: OK, v1, a1b2c3d')
  })

  it('keeps the unit on a numeric value and does not add one to a string', () => {
    expect(resolved(describeRef('{{r1:summary.x}}', chip({ value: '0.0123', unit: 'm' }))).quantity).toBe('0.0123 m')
    expect(resolved(describeRef('{{v1:summary.x}}', chip({ value: 'PASS', unit: null }))).quantity).toBe('PASS')
  })

  it('shortens a long string, with the full text in the hover and the accessible name', () => {
    const long = 'x'.repeat(CHIP_TEXT_LIMIT + 20)
    const t = resolved(describeRef('{{f1:import.omitted[#0].reason}}', chip({ value: long, source: { kind: 'findings', id: 'f1', hash: 'abc' } })))
    expect(Array.from(t.quantity)).toHaveLength(CHIP_TEXT_LIMIT)
    expect(t.quantity.endsWith('…')).toBe(true)
    expect(t.name).toContain(long)
    expect(t.hover).toContain(long)
  })

  it('does not shorten a string of exactly the limit, and leaves its hover unchanged', () => {
    const exact = 'y'.repeat(CHIP_TEXT_LIMIT)
    const t = resolved(describeRef('{{v1:summary.x}}', chip({ value: exact, source: { kind: 'verification', id: 'v1', hash: 'abc' } })))
    expect(t.quantity).toBe(exact)
    expect(t.hover).not.toContain(exact)
  })

  it('draws a mark after the value and names it, and draws none when there is none', () => {
    const marked = resolved(describeRef('{{r1:summary.x}}', chip({ value: '0.42', unit: 'MPa', mark: '(lower bound)' })))
    expect(marked.quantity).toBe('0.42 MPa (lower bound)')
    expect(marked.name).toContain('(lower bound)')
    const plain = resolved(describeRef('{{r1:summary.x}}', chip({ value: '0.42', unit: 'MPa' })))
    expect(plain.quantity).toBe('0.42 MPa')
    expect(plain.name).not.toContain('(')
  })

  it('shows a reduced value with the reduced tag and no mark unless the app gives one', () => {
    const t = resolved(describeRef('{{r1:summary.x}}', chip({ value: '3', unit: 'mm', reduced: true })))
    expect(t.tag).toContain(REDUCED_TEXT)
    expect(t.quantity).toBe('3 mm')
  })

  it('shows a reduced value with the mark the app gives it, in its name and its quantity', () => {
    const t = resolved(describeRef('{{r1:summary.x}}', chip({ value: '3', unit: 'mm', reduced: true, mark: 'cut by the reviewer' })))
    expect(t.quantity).toBe('3 mm cut by the reviewer')
    expect(t.name).toContain('cut by the reviewer')
    expect(t.tag).toContain(REDUCED_TEXT)
  })

  it('describes an unresolved reference with the word and the reference', () => {
    const t = describeRef('{{v9:summary.x}}', null)
    expect(t.resolved).toBe(false)
    expect(t.name).toBe('unresolved: {{v9:summary.x}}')
  })
})
