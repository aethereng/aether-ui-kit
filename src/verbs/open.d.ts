import type { Actor, Json, Verb } from './contracts';
import type { Registry } from './registry';
/**
 * The verb that opens another state in place of the one in the store: `<kind>.open`, for the kind that stands for the
 * whole state. It removes every entity and adds those of the saved state, so its records hold the state it replaced
 * (each removed entity with what it held and the place it held in its kind) and undo puts that state back, in order.
 * It takes the saved state's counters and its step remembers the replaced ones, so undo gives them back.
 *
 * A state is the same state when its content, its counters and the order of its ids in each kind are the same. The
 * content hash reads none of the order, but `ids` and `entity.list` give it, so an open whose snapshot differs from the
 * open state only in the order of the ids is one step that takes the snapshot's order, and undo gives the old order back.
 * The counters, which ids are minted from, count as content too, a kind the snapshot does not list counting as 0: an open
 * that holds the entities of the open state and other counters is one step that replaces the counters, and undo gives
 * them back.
 *
 * The ids of a kind come in the order the snapshot's object lists them, unless the snapshot gives an `order` for the kind: an
 * object lists the keys that read as a list position first, so a store that holds the ids `wall`, `2` and `1` writes that
 * order beside its entities (see Snapshot). An order that names an id the kind does not hold, leaves one out or names one twice is refused.
 */
export type OpenInput = {
    snapshot: Json;
};
/** The verb `<kind>.open`. `kind` is a registered kind that stands for the whole state; the verb is open to the first actor the registry names unless `actors` says otherwise. */
export declare function openVerb(registry: Registry, kind: string, options?: {
    actors?: readonly Actor[];
}): Verb<OpenInput>;
