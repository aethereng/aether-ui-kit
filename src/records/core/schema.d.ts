import type { Schema } from '../../verbs';
/** A kind as its schemas read it: each field's schema, and whether it may be absent. */
export interface FieldTable {
    fields: Readonly<Record<string, {
        schema: Schema;
        optional?: true;
    }>>;
}
/** Whether a schema takes null as a value: null itself, or one alternative of an anyOf is null. */
export declare function takesNull(schema: Schema): boolean;
/** The alternative of a schema that is not null: the value an optional field holds when it holds one. */
export declare function valueSchema(schema: Schema): Schema;
/** Whether a null given for the field clears it: the field is optional and its schema does not take null as a value. */
export declare function clearsField(kind: FieldTable, field: string): boolean;
/** Whether a blank is a value of the field: a null clears it, or is stored. */
export declare function blankTaken(kind: FieldTable, field: string): boolean;
/** The object an update's `set` takes: each field, and no other key. A clearable field also takes null, which clears it. */
export declare function fieldsSchema(kind: FieldTable): Schema;
/** The object a create's `record` takes: the fields of `fieldsSchema`, and each required field must be given. */
export declare function createSchema(kind: FieldTable): Schema;
/** The record without the fields a null clears: the form a verb stores, which holds no cleared field. */
export declare function withoutCleared<T extends {
    readonly [field: string]: unknown;
}>(kind: FieldTable, record: T): T;
