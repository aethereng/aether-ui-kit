import { describe, it, expect } from 'vitest'
import {
  ancestorIds,
  isExpandable,
  treeKey,
  typeahead,
  visibleRows,
  type TreeNode,
} from '../tree'

/* The arrow keys are the whole point of this file. Both consuming apps shipped trees where Tab
 * reached nothing and arrows did nothing; the hand-rolled fix got as far as "operable". These pin
 * the two asymmetric behaviours that make a tree a tree rather than a list with indentation. */

const tree = (): TreeNode[] => [
  {
    id: 'shared',
    label: 'shared',
    children: [
      { id: 'company', label: 'company.md' },
      { id: 'glossary', label: 'glossary.md' },
    ],
  },
  {
    id: 'technical',
    label: 'technical',
    children: [
      {
        id: 'product',
        label: 'product',
        children: [{ id: 'roadmap', label: 'roadmap.md' }],
      },
    ],
  },
  { id: 'readme', label: 'README.md' },
]

const rowsWith = (...open: string[]) => visibleRows(tree(), new Set(open))
const ids = (open: string[]) => rowsWith(...open).map((r) => r.id)

describe('visibleRows', () => {
  it('shows only roots when nothing is expanded', () => {
    expect(ids([])).toEqual(['shared', 'technical', 'readme'])
  })

  it('descends only into expanded nodes', () => {
    expect(ids(['shared'])).toEqual(['shared', 'company', 'glossary', 'technical', 'readme'])
  })

  it('descends through several levels', () => {
    expect(ids(['technical', 'product'])).toEqual([
      'shared',
      'technical',
      'product',
      'roadmap',
      'readme',
    ])
  })

  it('ignores an expanded id for a node that has no children', () => {
    // A leaf marked expanded must not claim to be open, or ARIA advertises a control that reveals
    // nothing and the Right arrow lands on the wrong row.
    const rows = rowsWith('readme')
    expect(rows.find((r) => r.id === 'readme')!.expanded).toBe(false)
    expect(ids(['readme'])).toEqual(['shared', 'technical', 'readme'])
  })

  it('treats an empty children array as a leaf', () => {
    const rows = visibleRows([{ id: 'a', label: 'a', children: [] }], new Set(['a']))
    expect(rows[0]!.hasChildren).toBe(false)
    expect(isExpandable({ id: 'a', label: 'a', children: [] })).toBe(false)
  })

  it('carries the ARIA position data for each row', () => {
    const rows = rowsWith('shared')
    expect(rows[0]).toMatchObject({ id: 'shared', level: 1, posInSet: 1, setSize: 3, parentId: null })
    expect(rows[1]).toMatchObject({ id: 'company', level: 2, posInSet: 1, setSize: 2, parentId: 'shared' })
    expect(rows[2]).toMatchObject({ id: 'glossary', level: 2, posInSet: 2, setSize: 2, parentId: 'shared' })
  })
})

describe('treeKey — the two asymmetric arrows', () => {
  it('Right EXPANDS a collapsed parent, and only then descends', () => {
    // Implementing just one half of this is the common bug: Right either always expands (and never
    // walks in) or always moves (and never opens).
    expect(treeKey('ArrowRight', rowsWith(), 'shared')).toEqual({ kind: 'expand', id: 'shared' })
    expect(treeKey('ArrowRight', rowsWith('shared'), 'shared')).toEqual({
      kind: 'move',
      id: 'company',
    })
  })

  it('Right does nothing on a leaf', () => {
    expect(treeKey('ArrowRight', rowsWith(), 'readme')).toEqual({ kind: 'none' })
  })

  it('Left COLLAPSES an expanded node, and only then ascends', () => {
    expect(treeKey('ArrowLeft', rowsWith('shared'), 'shared')).toEqual({
      kind: 'collapse',
      id: 'shared',
    })
    expect(treeKey('ArrowLeft', rowsWith('shared'), 'company')).toEqual({
      kind: 'move',
      id: 'shared',
    })
  })

  it('Left does nothing at the root of a collapsed node', () => {
    expect(treeKey('ArrowLeft', rowsWith(), 'shared')).toEqual({ kind: 'none' })
  })

  it('Left from a deep leaf climbs one level, not to the top', () => {
    const rows = rowsWith('technical', 'product')
    expect(treeKey('ArrowLeft', rows, 'roadmap')).toEqual({ kind: 'move', id: 'product' })
  })
})

describe('treeKey — linear movement', () => {
  it('Down and Up walk VISIBLE rows, crossing levels', () => {
    const rows = rowsWith('shared')
    // 'glossary' is a child; the next visible row is a root again.
    expect(treeKey('ArrowDown', rows, 'glossary')).toEqual({ kind: 'move', id: 'technical' })
    expect(treeKey('ArrowUp', rows, 'technical')).toEqual({ kind: 'move', id: 'glossary' })
  })

  it('stops at both ends rather than wrapping', () => {
    const rows = rowsWith()
    expect(treeKey('ArrowUp', rows, 'shared')).toEqual({ kind: 'none' })
    expect(treeKey('ArrowDown', rows, 'readme')).toEqual({ kind: 'none' })
  })

  it('Home and End reach the visible extremes', () => {
    const rows = rowsWith('shared')
    expect(treeKey('Home', rows, 'technical')).toEqual({ kind: 'move', id: 'shared' })
    expect(treeKey('End', rows, 'shared')).toEqual({ kind: 'move', id: 'readme' })
  })

  it('Enter and Space activate', () => {
    expect(treeKey('Enter', rowsWith(), 'readme')).toEqual({ kind: 'activate', id: 'readme' })
    expect(treeKey(' ', rowsWith(), 'readme')).toEqual({ kind: 'activate', id: 'readme' })
  })

  it('ignores keys it does not own, so the host keeps its own shortcuts', () => {
    expect(treeKey('a', rowsWith(), 'shared')).toEqual({ kind: 'none' })
    expect(treeKey('Escape', rowsWith(), 'shared')).toEqual({ kind: 'none' })
  })

  it('recovers when the cursor points at a row that is no longer visible', () => {
    // Collapsing an ancestor strands the cursor. Returning `none` would leave the tree dead to the
    // keyboard until the user clicked something.
    expect(treeKey('ArrowDown', rowsWith(), 'roadmap')).toEqual({ kind: 'move', id: 'shared' })
  })
})

describe('typeahead', () => {
  it('jumps to the next match after the cursor', () => {
    expect(typeahead(rowsWith('shared'), 'g', 'shared')).toBe('glossary')
  })

  it('is case-insensitive and matches a prefix', () => {
    expect(typeahead(rowsWith(), 'READ', 'shared')).toBe('readme')
  })

  it('wraps past the end', () => {
    expect(typeahead(rowsWith(), 's', 'readme')).toBe('shared')
  })

  it('cycles rather than sticking when the same letter repeats', () => {
    // Searching from the row AFTER the cursor is what makes this work; searching from the cursor
    // itself returns the cursor forever.
    const rows = visibleRows(
      [
        { id: 'a1', label: 'alpha' },
        { id: 'a2', label: 'anchor' },
        { id: 'b1', label: 'beta' },
      ],
      new Set(),
    )
    expect(typeahead(rows, 'a', 'a1')).toBe('a2')
    expect(typeahead(rows, 'a', 'a2')).toBe('a1')
  })

  it('returns null for no match and for an empty query', () => {
    expect(typeahead(rowsWith(), 'zzz', 'shared')).toBeNull()
    expect(typeahead(rowsWith(), '', 'shared')).toBeNull()
  })
})

describe('ancestorIds', () => {
  it('lists the path so a deep node can be revealed', () => {
    expect(ancestorIds(tree(), 'roadmap')).toEqual(['technical', 'product'])
  })

  it('is empty for a root and for an unknown id', () => {
    expect(ancestorIds(tree(), 'shared')).toEqual([])
    expect(ancestorIds(tree(), 'nope')).toEqual([])
  })
})
