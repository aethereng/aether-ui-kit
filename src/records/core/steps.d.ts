/** A record, by its kind and id. */
export interface Named {
    kind: string;
    id: string;
}
/**
 * Every record a delete must take with it: the records in its way, and theirs, grown until the delete meets none.
 * `inTheWay` answers which records stand in the way of the delete with a given cascade, as the app's delete plan reads
 * them. Stops after `rounds` rounds, where a plan keeps naming new records.
 */
export declare function deleteClosure(inTheWay: (cascade: readonly Named[]) => readonly Named[], rounds?: number): Named[];
/** The depth of a store's undo and redo stacks. */
export interface Depths {
    readonly undoDepth: number;
    readonly redoDepth: number;
}
/** The words of an editor's steps, against the store's undo and redo stacks. */
export interface StepWords {
    /** A change made through the editor: its words, with the store as it is after the change. */
    changed(store: Depths | null, words: string): void;
    /** Runs an undo; the words of the step it took back, where they name it. */
    undo<T extends {
        ok: boolean;
    }>(store: Depths, run: () => T): {
        outcome: T;
        words: string | undefined;
    };
    /** Runs a redo; the words of the step it made again, where they name it. */
    redo<T extends {
        ok: boolean;
    }>(store: Depths, run: () => T): {
        outcome: T;
        words: string | undefined;
    };
    /** Drops every step's words: another store is shown. */
    reset(): void;
}
/**
 * The words of each change still on the store's undo stack, and of each undone one on its redo stack. They name a step
 * only while they are as many as the store's steps: a step made elsewhere (another actor, a change not told here) leaves
 * the undo of it unnamed, and the words of the steps before it are dropped at the next change.
 */
export declare function stepWords(): StepWords;
/** A form's unapplied draft: the variant it shows, and the fields it holds. */
export interface Draft {
    variant: string;
    fields: Record<string, unknown>;
}
/** A store as the drafts read it: the ids it holds, and a call after each change. */
export interface DraftStore {
    ids(kind: string): readonly string[];
    subscribe(listener: () => void): unknown;
}
/** The drafts a form left unapplied, kept by the store they were drafted on. */
export interface DraftKeeper {
    /** Keeps a draft for a record (a null id for a new one), in place of one kept for it before. */
    keep(store: DraftStore, kind: string, id: string | null, draft: Draft): void;
    /** The draft kept for a record, which is then no longer kept: the form holds it again. */
    take(store: DraftStore, kind: string, id: string | null): Draft | undefined;
    /** The records a draft is kept for, in the order they were first kept. */
    kept(store: DraftStore): {
        kind: string;
        id: string | null;
    }[];
}
/**
 * Keeps the drafts a form leaves unapplied, given back when the form shows that record again. Another store never sees
 * them. A draft goes with its record: when a change of the store takes the record away, its draft is dropped, so a record
 * made later with the same id starts from its own fields. `onChange` is told each time the kept drafts change.
 */
export declare function draftKeeper(onChange?: () => void): DraftKeeper;
