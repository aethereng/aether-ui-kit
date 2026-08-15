export interface TreeNode<T = unknown> {
    id: string;
    label: string;
    /** Absent or empty means a leaf. An EMPTY array still counts as a leaf — a node that can hold
     *  children but has none is not expandable, and claiming otherwise gives the user a control that
     *  reveals nothing. */
    children?: TreeNode<T>[];
    /** Whatever the caller needs to render or dispatch on. The kit never reads it. */
    data?: T;
}
/** One rendered row: a node plus everything ARIA needs to describe its position. */
export interface TreeRow<T = unknown> {
    id: string;
    label: string;
    /** 1-based, for `aria-level`. */
    level: number;
    hasChildren: boolean;
    expanded: boolean;
    /** 1-based index among its siblings, for `aria-posinset`. */
    posInSet: number;
    /** Sibling count, for `aria-setsize`. */
    setSize: number;
    /** The id of the row's parent, or null at the root. Left/Up navigation needs it. */
    parentId: string | null;
    node: TreeNode<T>;
}
export declare function isExpandable<T>(node: TreeNode<T>): boolean;
/** Depth-first walk, descending only into expanded nodes: the rows a user can actually see and
 *  therefore the only rows the keyboard may land on. */
export declare function visibleRows<T>(nodes: TreeNode<T>[], expanded: Set<string>): TreeRow<T>[];
/** What a key press means. The caller applies it — this decides nothing about state itself, which is
 *  what lets the same logic drive a controlled and an uncontrolled tree. */
export type TreeKeyResult = {
    kind: 'move';
    id: string;
} | {
    kind: 'expand';
    id: string;
} | {
    kind: 'collapse';
    id: string;
} | {
    kind: 'activate';
    id: string;
} | {
    kind: 'none';
};
export declare function treeKey(key: string, rows: TreeRow[], cursorId: string): TreeKeyResult;
export declare function typeahead(rows: TreeRow[], query: string, cursorId: string): string | null;
/** Every ancestor id of a node, so revealing a deep node can open the whole path to it. Walks the
 *  source tree rather than the visible rows, because the ancestors are by definition not visible. */
export declare function ancestorIds<T>(nodes: TreeNode<T>[], targetId: string): string[];
