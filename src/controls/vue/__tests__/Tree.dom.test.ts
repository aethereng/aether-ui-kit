import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Tree from '../Tree.vue'
import type { TreeNode } from '../../core/tree'

/* The core tests cover what a key MEANS. These cover what the component does with that: the ARIA
 * the row must carry, the roving tabindex, and the line between moving and selecting — which is the
 * distinction a hand-rolled tree loses first. */

const nodes = (): TreeNode[] => [
  {
    id: 'shared',
    label: 'shared',
    children: [
      { id: 'company', label: 'company.md' },
      { id: 'glossary', label: 'glossary.md' },
    ],
  },
  { id: 'readme', label: 'README.md' },
]

function mountTree(props: Record<string, unknown> = {}) {
  return mount(Tree, {
    props: { nodes: nodes(), expanded: ['shared'], ...props },
    attachTo: document.body,
  })
}

const rowIds = (w: ReturnType<typeof mountTree>) =>
  w.findAll('[role="treeitem"]').map((r) => r.attributes('data-id'))

describe('Tree — structure and ARIA', () => {
  it('is a role=tree of role=treeitem rows', () => {
    const w = mountTree()
    expect(w.get('[role="tree"]').exists()).toBe(true)
    expect(rowIds(w)).toEqual(['shared', 'company', 'glossary', 'readme'])
    w.unmount()
  })

  it('carries level, setsize and posinset on every row', () => {
    // A flattened tree is only a tree to a screen reader if these are present; without them it is
    // an unstructured list and the nesting is invisible.
    const w = mountTree()
    const rows = w.findAll('[role="treeitem"]')
    expect(rows[0]!.attributes()).toMatchObject({
      'aria-level': '1',
      'aria-setsize': '2',
      'aria-posinset': '1',
    })
    expect(rows[1]!.attributes()).toMatchObject({
      'aria-level': '2',
      'aria-setsize': '2',
      'aria-posinset': '1',
    })
    w.unmount()
  })

  it('sets aria-expanded on parents only, never on leaves', () => {
    /* A leaf with aria-expanded="false" advertises a control that reveals nothing — the user hits
     * Right and gets silence. */
    const w = mountTree()
    const rows = w.findAll('[role="treeitem"]')
    expect(rows[0]!.attributes('aria-expanded')).toBe('true')
    expect(rows[1]!.attributes('aria-expanded')).toBeUndefined()
    expect(rows[3]!.attributes('aria-expanded')).toBeUndefined()
    w.unmount()
  })

  it('indents by level', () => {
    const w = mountTree()
    const rows = w.findAll('[role="treeitem"]')
    const pad = (i: number) => rows[i]!.attributes('style') ?? ''
    expect(pad(0)).toContain('6px')
    expect(pad(1)).toContain('20px') // 6 + 1 * 14
    w.unmount()
  })
})

describe('Tree — roving tabindex', () => {
  it('makes exactly one row tabbable', () => {
    /* The failure this pins: `tabindex="0"` on every row turns a 200-node tree into 200 tab stops,
     * and `tabindex="-1"` on all of them makes the tree unreachable entirely. */
    const w = mountTree()
    const tabbable = w.findAll('[role="treeitem"]').filter((r) => r.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    w.unmount()
  })

  it('parks the tabbable row on the selection when there is one', () => {
    const w = mountTree({ selected: 'glossary' })
    const tabbable = w.findAll('[role="treeitem"]').find((r) => r.attributes('tabindex') === '0')
    expect(tabbable!.attributes('data-id')).toBe('glossary')
    w.unmount()
  })

  it('falls back to the first row when the selection is hidden inside a collapsed branch', () => {
    // Otherwise nothing is tabbable and Tab skips the whole tree.
    const w = mountTree({ expanded: [], selected: 'company' })
    const tabbable = w.findAll('[role="treeitem"]').filter((r) => r.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.attributes('data-id')).toBe('shared')
    w.unmount()
  })
})

describe('Tree — keys move the cursor without selecting', () => {
  it('ArrowDown moves the tabbable row and emits no selection', async () => {
    const w = mountTree()
    await w.get('[role="tree"]').trigger('keydown', { key: 'ArrowDown' })
    const tabbable = w.findAll('[role="treeitem"]').find((r) => r.attributes('tabindex') === '0')
    expect(tabbable!.attributes('data-id')).toBe('company')
    // Arrowing through a file tree must not open a file per keypress.
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })

  it('ArrowRight expands a collapsed parent by emitting update:expanded', async () => {
    const w = mountTree({ expanded: [] })
    await w.get('[role="tree"]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:expanded')![0]).toEqual([['shared']])
    w.unmount()
  })

  it('ArrowLeft collapses an expanded parent', async () => {
    const w = mountTree({ expanded: ['shared'] })
    await w.get('[role="tree"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:expanded')![0]).toEqual([[]])
    w.unmount()
  })

  it('Enter selects, and reports the node so the caller need not look it up', async () => {
    const w = mountTree()
    await w.get('[role="tree"]').trigger('keydown', { key: 'Enter' })
    const [id, node] = w.emitted('select')![0] as [string, TreeNode]
    expect(id).toBe('shared')
    expect(node.label).toBe('shared')
    w.unmount()
  })

  it('typeahead jumps to a matching row', async () => {
    const w = mountTree()
    await w.get('[role="tree"]').trigger('keydown', { key: 'r' })
    const tabbable = w.findAll('[role="treeitem"]').find((r) => r.attributes('tabindex') === '0')
    expect(tabbable!.attributes('data-id')).toBe('readme')
    w.unmount()
  })

  it('leaves unhandled keys to the host', async () => {
    // A tree that swallows Escape or Ctrl+F breaks the surface around it.
    const w = mountTree()
    const ev = { key: 'Escape' }
    await w.get('[role="tree"]').trigger('keydown', ev)
    expect(w.emitted('select')).toBeUndefined()
    expect(w.emitted('update:expanded')).toBeUndefined()
    w.unmount()
  })
})

describe('Tree — mouse', () => {
  it('clicking a row selects it', async () => {
    const w = mountTree()
    await w.findAll('[role="treeitem"]')[3]!.trigger('click')
    expect(w.emitted('select')![0]![0]).toBe('readme')
    w.unmount()
  })

  it('clicking the twisty toggles without selecting', async () => {
    /* Two different intents on one row: the twisty is "show me what is inside", the label is "open
     * this". Collapsing a folder must not also load it. */
    const w = mountTree()
    await w.get('.aether-tree__twisty').trigger('click')
    expect(w.emitted('update:expanded')![0]).toEqual([[]])
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })

  it('a leaf twisty does nothing', async () => {
    const w = mountTree()
    const twisties = w.findAll('.aether-tree__twisty')
    await twisties[1]!.trigger('click') // company.md
    expect(w.emitted('update:expanded')).toBeUndefined()
    w.unmount()
  })
})
