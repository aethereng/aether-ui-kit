import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PATH_RULES,
  DEFAULT_REFERENCE_SCOPES,
  formatPath,
  hasReservedCharacter,
  idsIn,
  modelLeaves,
  numeralGate,
  parsePath,
  referencesIn,
  reservedCharactersOf,
  resolvePath,
  slug,
  splitReferences,
  type PathRules,
  type ReferenceScopes,
  type TupleTable,
} from '../refs'

const NONE = (): boolean => false
const NL = String.fromCharCode(10)

// The scope list of the first consumer (the default), and a second list in which `v` and `f` are
// indexed scopes and `g` a bare one, as the Etere panel writes them.
const SECOND_LIST: ReferenceScopes = { indexed: ['m', 'p', 'r', 'v', 'f'], bare: ['c', 'g'] }
const VERBATIM: PathRules = { verbatimBracketIds: true }

describe('numeral gate', () => {
  it('SEEDED: finds the one bare quantity beside an admitted id, at its offsets', () => {
    const text = 'The deflection is 12.5 mm at J12.'
    const found = numeralGate(text, ['J12'], NONE)
    expect(found).toEqual([{ token: '12.5', start: 18, end: 22, kind: 'bare_numeral' }])
    expect(text.slice(found[0]!.start, found[0]!.end), 'the offsets hold the numeral').toBe('12.5')
  })

  it('finds nothing when the quantity is a reference the index holds', () => {
    const ref = '{{r1:summary.max_abs_displacement}}'
    const index = new Set([ref])
    expect(numeralGate(`The deflection is ${ref} at J12.`, ['J12'], (r) => index.has(r))).toEqual([])
  })

  it('compares an id with its punctuation stripped', () => {
    for (const text of ['See J12.', 'See (J12) here', "J12's end"]) expect(numeralGate(text, ['J12'], NONE), text).toEqual([])
  })

  it('admits a quantity name only when the caller listed it', () => {
    expect(numeralGate('The M3 diagram', ['M3'], NONE)).toEqual([])
    expect(numeralGate('The M3 diagram', [], NONE)).toEqual([{ token: 'M3', start: 4, end: 6, kind: 'bare_numeral' }])
  })

  it('reads a code span like any other text', () => {
    expect(numeralGate('Set `n_steps: 4` there', [], NONE)).toHaveLength(1)
    expect(numeralGate('The joint `J12` holds', ['J12'], NONE)).toEqual([{ token: '`J12`', start: 10, end: 15, kind: 'bare_numeral' }])
  })

  it('counts a superscript digit and a decimal digit outside ASCII', () => {
    expect(numeralGate('Its unit is m² here', [], NONE)).toHaveLength(1)
    expect(numeralGate(`There are ${String.fromCharCode(0x0663)} supports`, [], NONE)).toHaveLength(1)
  })

  it('passes an ordered-list marker only where it opens a line', () => {
    expect(numeralGate(`1. Read the model${NL}2) Solve it`, [], NONE)).toEqual([])
    expect(numeralGate('Step 1. Read the model', [], NONE)).toHaveLength(1)
  })

  it('reports a reference the index does not hold as unresolved', () => {
    const ref = '{{r9:summary.max_abs_displacement}}'
    expect(numeralGate(`It is ${ref}.`, [], NONE)).toEqual([{ token: ref, start: 6, end: 6 + ref.length, kind: 'unresolved_reference' }])
  })

  it('lists the references of a text in order, and leaves malformed braces as plain text', () => {
    expect(referencesIn('{{m1:members.count}} and {{s:joints-members-frame.degree}}, then {{x1:a}} and {{r1:a b}}')).toEqual([
      '{{m1:members.count}}',
      '{{s:joints-members-frame.degree}}',
    ])
  })
})

describe('K1: the reference grammar with a scope list', () => {
  it('resolves v1 as a reference under the second list and as plain text under the default list', () => {
    const text = 'Member {{v1:members[e103].status}} holds.'
    expect(referencesIn(text, SECOND_LIST)).toEqual(['{{v1:members[e103].status}}'])
    expect(referencesIn(text, DEFAULT_REFERENCE_SCOPES)).toEqual([])
  })

  it('reads a bare scope only when its list names it', () => {
    expect(referencesIn('{{g:checks[x].status}} {{s:a}}', SECOND_LIST)).toEqual(['{{g:checks[x].status}}'])
    expect(referencesIn('{{g:checks[x].status}}', DEFAULT_REFERENCE_SCOPES)).toEqual([])
  })

  it('leaves a digit after an unlisted scope to the gate under the default list, and reports the reference under the second', () => {
    const text = 'It is {{v1:summary.checked}}.'
    expect(numeralGate(text, [], NONE, DEFAULT_REFERENCE_SCOPES).map((v) => v.kind)).toEqual(['bare_numeral'])
    expect(numeralGate(text, [], NONE, SECOND_LIST).map((v) => v.kind)).toEqual(['unresolved_reference'])
  })

  it('splits by the list it is given and keeps the text whole', () => {
    const text = 'a {{v1:x}} b {{s:y}}'
    const joined = splitReferences(text, SECOND_LIST)
      .map((s) => s.text)
      .join('')
    expect(joined).toBe(text)
    expect(splitReferences(text, SECOND_LIST).filter((s) => s.kind === 'ref')).toHaveLength(1)
  })

  it('refuses a scope list that names no scope, names one twice, or names a scope that is not one letter', () => {
    expect(() => splitReferences('x', { indexed: [], bare: [] })).toThrow(RangeError)
    expect(() => splitReferences('x', { indexed: ['m'], bare: ['m'] })).toThrow(RangeError)
    expect(() => splitReferences('x', { indexed: ['M'], bare: [] })).toThrow(RangeError)
    expect(() => splitReferences('x', { indexed: ['mm'], bare: [] })).toThrow(RangeError)
  })

  it('reads a bracketed id verbatim to the first ] with the option on, and refuses its dot with the option off', () => {
    expect(parsePath('loads[a12.force].value', VERBATIM)?.steps).toEqual([{ key: 'loads' }, { id: 'a12.force' }, { key: 'value' }])
    expect(parsePath('loads[a12.force].value')).toBeNull()
  })

  it('lists an id holding ] as positional with the option on, and reaches an id holding a dot by its id', () => {
    const model = { loads: [{ id: 'a]b', value: 1 }, { id: 'a12.force', value: 2 }] }
    const on = modelLeaves(model, [], { rules: VERBATIM })
    expect(on.skipped).toEqual(['a]b'])
    expect(on.leaves.map((l) => l.path)).toEqual(['loads[a12.force].value'])
    const off = modelLeaves(model, [], { rules: DEFAULT_PATH_RULES })
    expect(off.skipped).toEqual(['a]b', 'a12.force'])
    expect(off.leaves).toEqual([])
  })
})

describe('test 16: the path grammar over the verbatim-bracket rule', () => {
  it('resolves loads[a12.force] with the option on', () => {
    const model = { loads: [{ id: 'a12.force', value: 7 }] }
    expect(resolvePath(model, parsePath('loads[a12.force].value', VERBATIM)!.steps)).toBe(7)
  })

  it('resolves customMaterials[#0].id by position', () => {
    const model = { customMaterials: [{ id: 'stated S450 (rho 7800 kg/m3)' }] }
    expect(resolvePath(model, parsePath('customMaterials[#0].id')!.steps)).toBe('stated S450 (rho 7800 kg/m3)')
    expect(resolvePath(model, parsePath('customMaterials[#1].id')!.steps)).toBeUndefined()
  })

  it('lists an id with ] under positional', () => {
    expect(modelLeaves({ loads: [{ id: 'x]y', value: 1 }] }, [], { rules: VERBATIM }).skipped).toEqual(['x]y'])
  })

  it('with the option off, a dot is refused and a reserved id is positional', () => {
    expect(parsePath('loads[a12.force]')).toBeNull()
    expect(hasReservedCharacter('a12.force')).toBe(true)
    expect(hasReservedCharacter('a12.force', VERBATIM)).toBe(false)
  })
})

describe('paths', () => {
  const model = {
    units: 'si',
    joints: [
      { id: 'J1', xyz: [0, 0, 0] },
      { id: 'J2', xyz: [6, 0, 0] },
    ],
    members: [{ id: 'beam', degree: 3, joints: ['J1', 'J2'] }],
    sections: [{ id: 'odd.id', iy: 1 }],
  }

  it('parses and formats ids, positions and reductions', () => {
    for (const p of ['members[beam].degree', 'joints[J2].xyz[#0]', 'members.count', 'members[beam].forces.M3~max', 'members[beam].forces.M3~min.xi']) {
      const parsed = parsePath(p)
      expect(parsed, p).not.toBeNull()
      expect(formatPath(parsed!.steps, parsed!.reduction)).toBe(p)
    }
    for (const bad of ['', 'a..b', 'a[#01]', 'a~mean', 'a[b', '#3', 'a.b~max.y']) expect(parsePath(bad), bad).toBeNull()
  })

  it('round-trips a bracketed dotted id under the verbatim rule', () => {
    const parsed = parsePath('loads[a12.force].value', VERBATIM)!
    expect(formatPath(parsed.steps, parsed.reduction)).toBe('loads[a12.force].value')
  })

  it('resolves a model path by id, by position and by count', () => {
    const at = (p: string) => resolvePath(model, parsePath(p)!.steps)
    expect(at('members[beam].degree')).toBe(3)
    expect(at('joints[J2].xyz[#0]')).toBe(6)
    expect(at('members.count')).toBe(1)
    expect(at('members[girder].degree')).toBeUndefined()
    expect(at('members[beam].constructor')).toBeUndefined()
  })

  it('resolves a tuple component by the name the table gives it, and returns undefined without a table', () => {
    const tuples: TupleTable = {
      components: {
        translation: ['u_x', 'u_y', 'u_z'],
        reaction: ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'],
        forces: ['N', 'V2', 'V3', 'T', 'M2', 'M3'],
      },
      perElement: ['forces'],
    }
    const run = {
      joints: [{ id: 'J1', translation: [1, 2, 3], reaction: [0, 0, 5, 0, 0, 7] }],
      members: [{ id: 'beam', forces: [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]] }],
    }
    const at = (p: string, t: TupleTable | null = tuples) => resolvePath(run, parsePath(p)!.steps, t)
    expect(at('joints[J1].translation.u_z')).toBe(3)
    expect(at('joints[J1].reaction.Mz')).toBe(7)
    expect(at('members[beam].forces[#1].M3')).toBe(12)
    expect(at('members[beam].forces.M3')).toBeUndefined()
    expect(at('joints[J1].translation.Mz')).toBeUndefined()
    expect(at('joints[J1].translation.u_z', null)).toBeUndefined()
  })

  it('walks numeric leaves, skipping an element whose id has a reserved character', () => {
    const { leaves, skipped } = modelLeaves(model, [])
    expect(leaves.map((l) => l.path)).toEqual([
      'joints[J1].xyz[#0]',
      'joints[J1].xyz[#1]',
      'joints[J1].xyz[#2]',
      'joints[J2].xyz[#0]',
      'joints[J2].xyz[#1]',
      'joints[J2].xyz[#2]',
      'members[beam].degree',
    ])
    expect(skipped).toEqual(['odd.id'])
    expect(modelLeaves(model, [], { limit: 3 }).over).toBe(true)
  })

  it('names the reserved characters, and admits every id of a document', () => {
    for (const id of ['a.b', 'a[b', 'a]b', 'a{b', 'a}b', 'a~b', 'a b', '#a']) expect(hasReservedCharacter(id), id).toBe(true)
    for (const id of ['beam-a', 'J12', 'a#b']) expect(hasReservedCharacter(id), id).toBe(false)
    expect(reservedCharactersOf('a.b[c]')).toEqual(['.', '[', ']'])
    expect(reservedCharactersOf('a.b[c]', VERBATIM)).toEqual([']'])
    expect(reservedCharactersOf('#x y', VERBATIM)).toEqual(['a leading #', 'whitespace'])
    expect([...idsIn(model)].sort()).toEqual(['J1', 'J2', 'beam', 'odd.id'])
  })

  it('slugs by the rule: lower case, letters and digits, one hyphen per run', () => {
    expect(slug('Joints & members (frame)')).toBe('joints-members-frame')
    expect(slug('  When the free stiffness is singular!  ')).toBe('when-the-free-stiffness-is-singular')
    expect(slug('release_start / release_end')).toBe('release-start-release-end')
  })
})
