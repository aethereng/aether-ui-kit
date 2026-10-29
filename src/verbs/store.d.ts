import type { Actor, Call, ChangeEvent, Issue, Json, LogEntry, Outcome, Preview, Proposal, ProposalItem, ProposeOutcome, Reader, Refusal, Saved, Snapshot } from './contracts';
import type { Registry } from './registry';
/**
 * What a write refuses with: the batch it belongs to changes nothing. A system may throw it to refuse a batch whose end state
 * it checks: the refusal is 'apply', it names the call that wrote the first record the system reacted to, and carries the issues.
 */
export declare class Refuse extends Error {
    readonly issues: Issue[];
    constructor(issues: Issue[]);
}
export interface RunOptions {
    actor: Actor;
    /** Take ids the calls carry (an importer's, or a log's) instead of refusing them. */
    allowOfferedIds?: boolean;
}
export type ReadOutcome = {
    ok: true;
    value: Json;
} | {
    ok: false;
    refusal: Refusal;
};
/**
 * A run of moves that is one edit to the person (a slider drag): each move is shown to readers at once, and the whole
 * becomes one undo step and one log entry when it ends. While one is open the store takes no other edit, undo or redo.
 */
export interface Gesture {
    /**
     * Replaces what the gesture has done so far with these calls, applied to the state the gesture began from: the move
     * before is undone first, so after a move the content is the start plus that move alone. A refused move leaves the
     * state as the move before it left it, and the gesture goes on. A move numbers its ids from the counters the gesture
     * began with, so a created entity keeps its id from move to move and the counters the gesture leaves are those of its
     * last move alone, which is what the log reproduces. What the moves used of the record numbers and of the list of
     * touched addresses goes back to what the start had only when the gesture ends where it began or is cancelled; in
     * between they stay where the last move left them, and a preview made then numbers its records from there.
     */
    move(calls: readonly Call[]): Outcome;
    /**
     * Closes the gesture. Its last move becomes one undo step and one batch of log entries; a gesture that ends where it
     * began leaves none. It is allowed while a lock is held, where a move and a cancel are refused: each move changed
     * the state when it ran, so end changes no content. It records the step and the log entries, or, for a gesture that
     * ends where it began, gives back the counters and sequence numbers the moves used.
     */
    end(): Outcome;
    /** Puts the state back as it was when the gesture began and leaves nothing in the history. Refused while a lock is held. */
    cancel(): Outcome;
    isOpen(): boolean;
}
export type GestureOutcome = {
    ok: true;
    gesture: Gesture;
} | {
    ok: false;
    refusal: Refusal;
};
export interface Store extends Reader {
    hash(): string;
    snapshot(): Snapshot;
    save(): Saved;
    readonly log: readonly LogEntry[];
    readonly undoDepth: number;
    readonly redoDepth: number;
    /** Edits are refused with the reason while any lock is held; reads, previews and proposals go on. */
    lock(reason: string): () => void;
    run(calls: readonly Call[], options: RunOptions): Outcome;
    undo(actor: Actor): Outcome;
    redo(actor: Actor): Outcome;
    /** Opens a gesture; refused while a lock is held or another gesture is open. */
    gesture(options: {
        actor: Actor;
    }): GestureOutcome;
    /**
     * Abandons the open gesture as its cancel does, for a caller that is going away or has failed mid-drag and no longer
     * holds the handle. Nothing open is no error. While a lock is held it is refused, like a cancel, and remembered: the
     * release of the last lock cancels the gesture, so a caller that has gone never leaves the store busy.
     */
    abandonGesture(): Outcome;
    /** Refused with the reason 'gesture' while a gesture is open. */
    propose(items: readonly ProposalItem[]): ProposeOutcome;
    /** The card of a proposal: what it would change, computed on an overlay, the store untouched. `allowOfferedIds` is run's. */
    preview(proposal: Proposal, options?: {
        only?: readonly number[];
        actor?: Actor;
        allowOfferedIds?: boolean;
    }): Preview;
    /** `allowOfferedIds` is run's: a proposal whose creates carry their ids is accepted under them, each checked as offer checks it. */
    accept(proposal: Proposal, options?: {
        only?: readonly number[];
        actor?: Actor;
        acknowledgeBase?: boolean;
        allowOfferedIds?: boolean;
    }): Outcome;
    read(name: string, input: Json): ReadOutcome;
    subscribe(listener: (event: ChangeEvent) => void, filter?: {
        kind?: string;
        component?: string;
    }): () => void;
}
/** A store over a registry, from a base snapshot or empty. `limit` is the number of undo steps kept. */
export declare function createStore(registry: Registry, options?: {
    base?: Snapshot;
    limit?: number;
}): Store;
/**
 * Replays a saved log over its base. Refused when the base is not the one the log was written against, when
 * a logged call is refused, or when the state reached is not the state that was saved.
 */
export declare function replay(registry: Registry, saved: Saved): {
    ok: true;
    store: Store;
} | {
    ok: false;
    refusal: Refusal;
};
