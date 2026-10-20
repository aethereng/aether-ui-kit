/** The placeholder that stands where the key was in a person's text. */
export declare const KEY_REMOVED = "[key removed]";
export type KeyStorage = 'session' | 'device';
export interface KeyLoad {
    key: string;
    storage: KeyStorage;
}
export interface KeyStore {
    /** The key kept from an earlier visit or an earlier page of this one, and where it was kept. */
    load(): KeyLoad | null;
    /** Keep the key where the person chose, and nowhere else. */
    save(key: string, storage: KeyStorage): void;
    /** Remove the key from both stores. */
    forget(): void;
}
/** A store that keeps the key under `storageKey` in session storage or in device storage. */
export declare function keyStore(storageKey: string): KeyStore;
/** The person's text with every occurrence of the exact key replaced. Applied before the text is
 *  shown, sent or recorded. An empty key removes nothing. */
export declare function redactKey(text: string, key: string): string;
/** The rules a key's shape is checked against. The app names its own prefix and its own length range;
 *  the range is a plausible one that the vendor does not state as a rule. */
export interface KeyRules {
    readonly prefix: string;
    readonly minLength: number;
    readonly maxLength: number;
}
/** The first shape rule a key breaks, in the order the rules are read, or null when it breaks none.
 *  `space` is a space or a line break; `character` is a character outside the printable ASCII range
 *  a key is made of; `prefix`, `short` and `long` are the rules above. The app words each one. */
export type KeyShapeRule = 'space' | 'character' | 'prefix' | 'short' | 'long';
/** Which shape rule `key` breaks, read in the browser so that no request is made for a text that
 *  cannot be a key. The key is taken as given: trim it before the call. */
export declare function keyShapeRule(key: string, rules: KeyRules): KeyShapeRule | null;
