import { type CellRefusal, type KindDecl, type Row, type RowValue, type TableColumn, type Units } from '../core';
type __VLS_Props = {
    kind: KindDecl;
    /** Every record of the kind, those the search hides among them. */
    rows: readonly Row[];
    /** Takes the values a change gives a field, one per row: null where every one is taken, else the refusal. */
    run: (field: string, values: readonly RowValue[]) => CellRefusal | null;
    units?: Units;
    /** The values a choice column offers: the ids of the kind a reference names, or the column's own values. */
    optionsOf?: (column: TableColumn) => readonly string[];
    /** Cells take changes. */
    editable?: boolean;
    /** The row open in the app, marked and brought into sight. */
    openId?: string | null;
    query?: string;
    /** What the table says where it shows no row. */
    empty?: string;
    /** Free-text columns are edited in their cells; false shows them as text. */
    textEdited?: boolean;
};
type __VLS_PublicProps = __VLS_Props & {
    /** The rows ticked, by id, shown or hidden by the search. Cleared when the table shows another kind. */
    'ticked'?: ReadonlySet<string>;
};
declare const _default: import("vue").DefineComponent<__VLS_PublicProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    open: (id: string) => any;
    changed: (column: TableColumn, values: RowValue[], pasted: boolean) => any;
    "update:ticked": (value: ReadonlySet<string>) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_PublicProps> & Readonly<{
    onOpen?: ((id: string) => any) | undefined;
    onChanged?: ((column: TableColumn, values: RowValue[], pasted: boolean) => any) | undefined;
    "onUpdate:ticked"?: ((value: ReadonlySet<string>) => any) | undefined;
}>, {
    empty: string;
    units: Units;
    optionsOf: (column: TableColumn) => readonly string[];
    editable: boolean;
    openId: string | null;
    query: string;
    textEdited: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
