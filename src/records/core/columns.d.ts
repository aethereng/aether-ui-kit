import type { Fields, KindDecl } from './types';
export interface TableColumn {
    /** The field, and for a vector the axis after a dot: `at.x`. */
    key: string;
    field: string;
    /** The field's words, and for a vector the axis. */
    label: string;
    /** The column head's words: the field's short name where it has one, and for a vector the axis. */
    head: string;
    /** Edited in the cell: a number, a choice, a flag, a free text (`string`). Shown only: any other value (`text`). */
    kind: 'number' | 'choice' | 'flag' | 'string' | 'text';
    /** For one number of a vector: its place in it. */
    axis?: 0 | 1 | 2;
    /** The quantity the field's numbers measure, where it has one (a row's variant may give another: quantityOf). */
    quantity?: string;
    /** For a choice of another record: the kind it is chosen from. */
    ref?: string;
    /** For a choice of a fixed set: the values offered. */
    values?: readonly string[];
    /** The variant's tag: shown, changed in the form. */
    tag?: true;
    advanced?: true;
    /** Declared read only: shown, and no change to it is taken. */
    readonly?: true;
}
/** The columns of a kind's table, the plain fields first and then the advanced ones, each in the kind's order. */
export declare function tableColumns(kind: KindDecl): TableColumn[];
/** The variant a record holds, by its tag: its name, or '' where it holds none. */
export declare function variantOf(kind: KindDecl, record: Fields | undefined): string;
/**
 * The fields a record of a variant takes, in the kind's order: every field for a kind with no variants; else the tag, the
 * common fields and the variant's own. A variant the kind does not hold, or none, takes the tag and the common fields.
 */
export declare function fieldsTaken(kind: KindDecl, variant: string): string[];
/** Whether a record takes a field: every field, for a kind with no variants; the fields of its variant otherwise. */
export declare function takesField(kind: KindDecl, record: Fields, field: string): boolean;
/** The quantity a record's field measures: the one its variant gives it, else the column's. */
export declare function quantityOf(kind: KindDecl, record: Fields, column: Pick<TableColumn, 'field' | 'quantity'>): string | undefined;
