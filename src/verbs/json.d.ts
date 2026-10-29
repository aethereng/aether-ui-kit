import type { Json } from './contracts';
/** Canonical text of a value: object keys in code-unit order, no whitespace. A key whose value is undefined is absent. */
export declare function canonical(value: Json | undefined): string;
/** Deep equality of two values, where undefined (absent) equals only undefined and `null` equals only `null`. */
export declare function equal(a: Json | undefined, b: Json | undefined): boolean;
/**
 * What is wrong with a list of ids given as the order of a kind, or null: it must be a list of text that names each id
 * the kind holds once and no other. The list is read by position, so a hole in it is a missing entry.
 */
export declare function orderProblem(order: Json | undefined, held: readonly string[]): string | null;
/** The pointer of the first number in the value that is not finite, or null when every number is (the hash has no text for one). */
export declare function nonFinite(value: Json, at?: string): string | null;
/** The name no stored content may hold as a key: assigned to a plain object it sets the object's prototype and stores no key. */
export declare const PROTO_KEY = "__proto__";
/** The value an object holds under the key as its own property; a name that only the prototype chain knows (`constructor`) holds nothing. */
export declare function own(object: {
    readonly [key: string]: Json | undefined;
}, key: string): Json | undefined;
/** The pointer of the first key named __proto__ anywhere in the value, or null when there is none (a key of that name cannot be stored as content). */
export declare function protoKey(value: Json, at?: string): string | null;
/** A deep copy that is frozen all the way down: what the store keeps, so nothing outside can write into it. */
export declare function frozenCopy<T extends Json>(value: T): T;
/** A deep copy a caller may write into. */
export declare function plainCopy<T extends Json>(value: T): T;
/** SHA-256 of the UTF-8 text, as 64 hex digits. Synchronous, so a content hash can be compared where a caller cannot await. */
export declare function sha256(text: string): string;
