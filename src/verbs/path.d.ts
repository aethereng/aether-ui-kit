import type { Json } from './contracts';
/** One step of a path: a field name, or the text inside brackets (an id, or a position when the value is a list). */
export type Step = {
    field: string;
} | {
    bracket: string;
};
/**
 * A dotted path of fields with ids and positions in brackets: `box[b1].Size.width`, `box[b1].Tags[0]`, `box[C15x33.9].Size`.
 * An id holds no reserved character but the dot (see isValidId), so every id is addressable. Null when the text
 * does not read as a path; an empty text is the root, which has no steps.
 */
export declare function parsePath(text: string): Step[] | null;
/** The value at the path, or undefined where the value holds nothing there. */
export declare function resolvePath(root: Json, steps: readonly Step[]): Json | undefined;
/**
 * Whether text may be the id of a new entity: it is not empty, holds no reserved character but the dot and no whitespace,
 * does not start with `#`, and is not the key `__proto__`, which stored content cannot hold (see PROTO_KEY), so an id never
 * sets the prototype of an object that is keyed by it. A file's ids may hold a dot, as C15x33.9 does.
 */
export declare function isValidId(id: string): boolean;
/** Whether text may be the name of a kind, a prefix or a group: an id that holds no dot, since a kind is named as a field of a path. */
export declare function isValidName(name: string): boolean;
/** The refusal of an id isValidId refuses: what it may not be, in one place for every entry that checks. */
export declare const notAnId: (id: string) => string;
