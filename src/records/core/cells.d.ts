import type { Json } from '../../verbs';
import { type TableColumn } from './columns';
import { type Measure } from './widths';
import type { Fields, KindDecl, Units } from './types';
/** A row of a table: a record and its id. */
export interface Row {
    id: string;
    record: Fields;
}
/** A value a change gives one row. */
export interface RowValue {
    id: string;
    record: Fields;
    value: Json;
}
/** A refused change: the row the refusal names, and its words. */
export interface CellRefusal {
    row: string;
    words: string;
}
/** A number as a field shows it: twelve significant figures, so a conversion's last-bit residue does not show. */
export declare const numberText: (value: number) => string;
/** The value a column's cell holds: the field, or one number of a vector. */
export declare function cellValue(record: Fields, column: Pick<TableColumn, 'field' | 'axis'>): Json | undefined;
/** A value shown as text: a list of plain values joined, the switches that are on; anything else as JSON. */
export declare function textOf(v: Json | undefined): string;
/** What a cell shows: a number in its unit, anything else as text; nothing for a field its row's variant does not take. */
export declare function cellText(kind: KindDecl, record: Fields, column: TableColumn, units: Units): string;
/** A cell's own unit, where its row's variant gives the field another quantity than the column's head says; else ''. */
export declare function ownUnit(kind: KindDecl, record: Fields, column: TableColumn, units: Units): string;
/** A cell's value in words, in the unit it shows in: 'none' where it holds nothing. */
export declare function cellWords(kind: KindDecl, record: Fields, column: TableColumn, units: Units): string;
/**
 * A choice's labels as its cell offers them: the blank first, "(none)" where a blank is a value, else "(choose)"; then each
 * option in the words its field declares for it, or as it is where the field declares none.
 */
export declare function choiceLabels(kind: KindDecl, column: TableColumn, options: readonly string[]): string[];
/**
 * Each number, free text and choice column's width in px (widths.ts): a number's or a text's widest value over the rows
 * shown; a choice's longest label where a row shown holds a value, and its blank label, which each of its cells shows,
 * where none does.
 */
export declare function columnWidths(kind: KindDecl, columns: readonly TableColumn[], rows: readonly Row[], units: Units, optionsOf: (column: TableColumn) => readonly string[], measure: Measure): Map<string, number>;
/** Whether a row is found by a search: its id, or the text of a cell, holds the query, in any case. */
export declare function matches(kind: KindDecl, row: Row, columns: readonly TableColumn[], query: string, units: Units): boolean;
/** What a typed or chosen value gives a row: the value to store, or the words that say why it cannot be read. */
export declare function valueFor(kind: KindDecl, record: Fields, column: TableColumn, typed: string | boolean, units: Units): {
    value: Json;
} | {
    unread: string;
};
/** Why one change cannot go to every one of these rows, naming the rows, or null where it can. */
export declare function bulkRefusal(kind: KindDecl, rows: readonly Row[], column: TableColumn, shown: ReadonlySet<string>, units: Units): CellRefusal | null;
/**
 * A cell left, or Enter pressed in it: the values it gives, to its row or, where the row is ticked with others, to every
 * ticked row. `ticked` is every ticked row, those the search hides among them, so that a change to a hidden one is
 * refused. Null where nothing changes: the cell left as it shows, every row already holding the value, or a field
 * declared read only. A refusal where the change cannot go to every row. A row that already holds the value is left out,
 * so Enter and then leaving the cell give it once.
 */
export declare function cellChange(kind: KindDecl, row: Row, column: TableColumn, typed: string | boolean, ticked: readonly Row[], shown: ReadonlySet<string>, units: Units): {
    refused: CellRefusal;
} | {
    values: RowValue[];
} | null;
/**
 * Several lines pasted into a cell: one to a row, from `at` down the rows shown. Null for one line, an ordinary paste. A
 * paste is refused where the field is declared read only, where a line holds a tab (one column per paste), where the rows
 * from here down are fewer than the lines, where the search hides a row between the first row written and the last, and
 * where a row takes no such field or cannot read its line.
 */
export declare function pasteRows(kind: KindDecl, text: string, at: Row, column: TableColumn, rows: readonly Row[], allRows: readonly Row[], units: Units): {
    refused: CellRefusal;
} | {
    values: RowValue[];
} | null;
