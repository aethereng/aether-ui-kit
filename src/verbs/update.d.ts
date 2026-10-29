import type { Actor, Json, Reader, Schema, Verb } from './contracts';
/**
 * The update verb of a kind, generated from one table of its fields: `<kind>.update` takes `{id, set: {field: value}}`.
 * The table is the single source of the verb's input schema (which is also the schema a caller is given), of the
 * checks it makes and of the card line it writes, so a field cannot be offered by one and refused by another.
 */
/** One field of a kind: where it lives, what it may hold, and how the card names it. */
export interface FieldSpec {
    /** The component the field is stored in. */
    component: string;
    /** The key inside an object component; absent when the field is the whole component. */
    key?: string;
    /**
     * The schema of the value, in the subset schema.ts reads. Every object in it is closed: a key it does not list is
     * refused by name, unless `freeForm` is set.
     */
    schema: Schema;
    /** The value is an object whose keys the table does not list, so its schema is used as given and any key is taken. */
    freeForm?: boolean;
    /**
     * The field may be absent, and this value, given in a call, removes it (`null` is the usual word). The removal is
     * recorded with the value it took away, so undo puts the value back, and the last key removed from an object
     * component takes the component with it. In the call schema the word is an alternative of the field, which is how a
     * call passes the schema; the field's own check is not run on it. A word the field's schema accepts is refused when
     * the table is read, because that value could never be stored; a field with no word cannot be removed.
     */
    clear?: Json;
    /** What the card and the call schema name the field; the field's own name when absent. */
    label?: string;
    /** The unit the value is in, shown on the card and in the call schema. */
    unit?: string;
    /** A check beyond the schema: the reason the value is refused, or nothing. It reads the store as the batch has it so far. */
    check?(value: Json, reader: Reader, id: string): string | undefined;
    /**
     * The value as the component holds it, when that is not the value given (a reference is held as a kind and an id,
     * see refStore). It is given the whole value, so a field holding a list of references converts the list. It may throw
     * a StoreRefusal to refuse a value it cannot hold; the verb runs it while validating and refuses the call there.
     */
    store?(value: Json): Json;
}
/** What a store hook throws to refuse a value: `at` is the pointer inside the value (`/2` for its third entry, empty for the value itself). */
export declare class StoreRefusal extends Error {
    readonly at: string;
    constructor(at: string, message: string);
}
export type FieldTable = {
    readonly [field: string]: FieldSpec;
};
export type UpdateInput = {
    id: string;
    set: {
        [field: string]: Json;
    };
};
/** What a rule across fields is given. Values are keyed by the field names of the table. */
export interface UpdateCheck {
    id: string;
    /** The fields the call names, as the call gives them: a removal appears as its clear word. */
    set: {
        readonly [field: string]: Json;
    };
    /** What the entity holds now, as its components hold it; a field it holds nothing for is absent. */
    before: {
        readonly [field: string]: Json;
    };
    /** What it will hold after the call, as its components will hold it: a removed field is absent. */
    after: {
        readonly [field: string]: Json;
    };
    /** The store as the batch has it so far. */
    reader: Reader;
}
export interface UpdateOptions {
    /** Who may call it; absent means anyone. */
    actors?: readonly Actor[];
    /**
     * A rule across fields, run once the call's fields have passed the schema and their own checks. It returns what it
     * refuses, each naming the field of the table it concerns (a refusal about the call as a whole names none). The
     * field may be one the call does not set, since the rule sees the values the entity holds. A name outside the table
     * is refused as the call's refusal, with the rule's message.
     */
    check?(call: UpdateCheck): Array<{
        field?: string;
        message: string;
    }>;
}
/**
 * The store hook of a reference field: an id is held as `{kind, id}`, and a list of ids as a list of those, in the order
 * given. A list names an entity once; one named twice is refused at the entry that repeats it.
 */
export declare function refStore(kind: string): (value: Json) => Json;
/** The verb `<kind>.update`, with its input schema, its checks and its card line all read from the table. */
export declare function updateVerb(kind: string, table: FieldTable, options?: UpdateOptions): Verb<UpdateInput>;
