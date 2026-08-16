export interface MenuItem {
    id: string;
    label: string;
    disabled?: boolean;
    /** Renders as a divider; never focusable, never activatable, skipped by every movement. */
    separator?: boolean;
    /** Whatever the caller dispatches on. The kit never reads it. */
    data?: unknown;
}
/** What the component should do. `id` is set for 'move'; for 'activate' it is the item activated. */
export interface MenuKeyResult {
    kind: 'move' | 'activate' | 'close' | 'none';
    id?: string;
}
/** Items a cursor may actually land on. A separator or a disabled row is rendered, not reachable. */
export declare function focusableItems(items: readonly MenuItem[]): MenuItem[];
export declare function firstItem(items: readonly MenuItem[]): string | null;
export declare function lastItem(items: readonly MenuItem[]): string | null;
export declare function menuKey(items: readonly MenuItem[], key: string, cursorId: string | null): MenuKeyResult;
/** A printable character that should feed typeahead — one grapheme, no modifier combination. */
export declare function isTypeaheadKey(key: string): boolean;
