import { type TreeNode, type TreeRow } from '../core/tree';
declare const _default: <T>(__VLS_props: NonNullable<Awaited<typeof __VLS_setup>>["props"], __VLS_ctx?: __VLS_PrettifyLocal<Pick<NonNullable<Awaited<typeof __VLS_setup>>, "attrs" | "emit" | "slots">>, __VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>["expose"], __VLS_setup?: Promise<{
    props: __VLS_PrettifyLocal<Pick<Partial<{}> & Omit<{
        readonly onSelect?: ((id: string, node: TreeNode<T>) => any) | undefined;
        readonly "onUpdate:expanded"?: ((args_0: string[]) => any) | undefined;
    } & import("vue").VNodeProps & import("vue").AllowedComponentProps & import("vue").ComponentCustomProps, never>, "onSelect" | "onUpdate:expanded"> & {
        nodes: TreeNode<T>[];
        /** Ids of the open nodes. The caller owns this. */
        expanded?: string[];
        selected?: string | null;
        ariaLabel?: string;
        /** Indent per level, in px. The kit picks a default rather than a token because indentation is
         *  structural rhythm, not palette. */
        indent?: number;
    } & Partial<{}>> & import("vue").PublicProps;
    expose(exposed: import("vue").ShallowUnwrapRef<{}>): void;
    attrs: any;
    slots: {
        /** Replace a row's content. Receives the row, so a caller can render badges, counts, icons.
         *  Anything focusable in here would break the roving tabindex — put controls outside the tree. */
        row?: (props: {
            row: TreeRow<T>;
        }) => unknown;
    };
    emit: ((evt: "select", id: string, node: TreeNode<T>) => void) & ((evt: "update:expanded", args_0: string[]) => void);
}>) => import("vue").VNode & {
    __ctx?: Awaited<typeof __VLS_setup>;
};
export default _default;
type __VLS_PrettifyLocal<T> = {
    [K in keyof T]: T[K];
} & {};
