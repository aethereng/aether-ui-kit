/* Framework-free core for the Tree control: the shape of the data, which rows are visible, and the
 * entire keyboard model. No Vue.
 *
 * The keyboard model lives here rather than in the component on purpose. It is the part everyone
 * gets wrong — both consuming apps shipped a tree where Tab reached nothing and arrows did nothing,
 * and "operable" was as far as a hand-rolled fix got. Arrow behaviour in a tree is genuinely
 * non-obvious (Right means two different things depending on expansion state; Left means two more),
 * so it is written once, as pure functions over plain data, and tested without a DOM.
 */

export interface TreeNode<T = unknown> {
  id: string
  label: string
  /** Absent or empty means a leaf. An EMPTY array still counts as a leaf — a node that can hold
   *  children but has none is not expandable, and claiming otherwise gives the user a control that
   *  reveals nothing. */
  children?: TreeNode<T>[]
  /** Whatever the caller needs to render or dispatch on. The kit never reads it. */
  data?: T
}

/** One rendered row: a node plus everything ARIA needs to describe its position. */
export interface TreeRow<T = unknown> {
  id: string
  label: string
  /** 1-based, for `aria-level`. */
  level: number
  hasChildren: boolean
  expanded: boolean
  /** 1-based index among its siblings, for `aria-posinset`. */
  posInSet: number
  /** Sibling count, for `aria-setsize`. */
  setSize: number
  /** The id of the row's parent, or null at the root. Left/Up navigation needs it. */
  parentId: string | null
  node: TreeNode<T>
}

export function isExpandable<T>(node: TreeNode<T>): boolean {
  return !!node.children && node.children.length > 0
}

/** Depth-first walk, descending only into expanded nodes: the rows a user can actually see and
 *  therefore the only rows the keyboard may land on. */
export function visibleRows<T>(nodes: TreeNode<T>[], expanded: Set<string>): TreeRow<T>[] {
  const out: TreeRow<T>[] = []
  const walk = (siblings: TreeNode<T>[], level: number, parentId: string | null) => {
    siblings.forEach((node, i) => {
      const open = expanded.has(node.id) && isExpandable(node)
      out.push({
        id: node.id,
        label: node.label,
        level,
        hasChildren: isExpandable(node),
        expanded: open,
        posInSet: i + 1,
        setSize: siblings.length,
        parentId,
        node,
      })
      if (open) walk(node.children!, level + 1, node.id)
    })
  }
  walk(nodes, 1, null)
  return out
}

/** What a key press means. The caller applies it — this decides nothing about state itself, which is
 *  what lets the same logic drive a controlled and an uncontrolled tree. */
export type TreeKeyResult =
  | { kind: 'move'; id: string }
  | { kind: 'expand'; id: string }
  | { kind: 'collapse'; id: string }
  | { kind: 'activate'; id: string }
  | { kind: 'none' }

const NONE: TreeKeyResult = { kind: 'none' }

/* The full ARIA tree keyboard contract. The two asymmetric ones are why this is not inline:
 *   Right on a COLLAPSED parent expands it; on an EXPANDED parent it moves to the first child.
 *   Left on an EXPANDED node collapses it; on a collapsed node or a leaf it moves to the PARENT.
 * Both are "do the near thing first, then the far thing", and both are routinely implemented as
 * only one of their two halves. */
export function treeKey(key: string, rows: TreeRow[], cursorId: string): TreeKeyResult {
  const i = rows.findIndex((r) => r.id === cursorId)
  if (i === -1) return rows.length ? { kind: 'move', id: rows[0]!.id } : NONE
  const row = rows[i]!

  switch (key) {
    case 'ArrowDown':
      return i + 1 < rows.length ? { kind: 'move', id: rows[i + 1]!.id } : NONE
    case 'ArrowUp':
      return i > 0 ? { kind: 'move', id: rows[i - 1]!.id } : NONE

    case 'ArrowRight':
      if (row.hasChildren && !row.expanded) return { kind: 'expand', id: row.id }
      // Expanded: step to the first child, which is always the next visible row.
      if (row.expanded && i + 1 < rows.length) return { kind: 'move', id: rows[i + 1]!.id }
      return NONE

    case 'ArrowLeft':
      if (row.expanded) return { kind: 'collapse', id: row.id }
      if (row.parentId) return { kind: 'move', id: row.parentId }
      return NONE

    case 'Home':
      return rows.length ? { kind: 'move', id: rows[0]!.id } : NONE
    case 'End':
      return rows.length ? { kind: 'move', id: rows[rows.length - 1]!.id } : NONE

    case 'Enter':
    case ' ':
      return { kind: 'activate', id: row.id }

    default:
      return NONE
  }
}

/* Typeahead: jump to the next row whose label starts with what has been typed, wrapping past the
 * end. Searching from the row AFTER the cursor is what makes repeatedly pressing the same letter
 * cycle through matches instead of sticking on the first one. */
export function typeahead(
  /* Widened from TreeRow[] to what the function actually reads. A TreeRow still satisfies it, so no
     existing caller changes — but Menu needs the same behaviour over items that are not tree rows,
     and cycling-on-repeat-keypress is the exact detail worth having in one place rather than two. */
  rows: readonly { id: string; label: string }[],
  query: string,
  cursorId: string,
): string | null {
  if (!query) return null
  const q = query.toLowerCase()
  const start = rows.findIndex((r) => r.id === cursorId)
  const n = rows.length
  for (let step = 1; step <= n; step++) {
    const row = rows[(start + step + n) % n]
    if (row && row.label.toLowerCase().startsWith(q)) return row.id
  }
  return null
}

/** Every ancestor id of a node, so revealing a deep node can open the whole path to it. Walks the
 *  source tree rather than the visible rows, because the ancestors are by definition not visible. */
export function ancestorIds<T>(nodes: TreeNode<T>[], targetId: string): string[] {
  const path: string[] = []
  const walk = (siblings: TreeNode<T>[], trail: string[]): boolean => {
    for (const node of siblings) {
      if (node.id === targetId) {
        path.push(...trail)
        return true
      }
      if (node.children && walk(node.children, [...trail, node.id])) return true
    }
    return false
  }
  walk(nodes, [])
  return path
}
