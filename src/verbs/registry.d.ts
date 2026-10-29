import type { Actor, Json, KindSpec, ReadVerb, Reader, Schema, System, Verb } from './contracts';
export interface Registry {
    readonly kinds: ReadonlyMap<string, KindSpec>;
    readonly verbs: ReadonlyMap<string, Verb>;
    readonly systems: readonly System[];
    readonly reads: ReadonlyMap<string, ReadVerb>;
    /** The actors that may make a call, in the order they were given; undo and redo are open to the first only. */
    readonly actors: readonly Actor[];
    kind(name: string, spec: KindSpec): void;
    verb<I extends Json>(verb: Verb<I>): void;
    system(system: System): void;
    read(read: ReadVerb): void;
    /** The id space a kind's ids live in: its group, or the kind itself. */
    space(kind: string): string;
    /** The schema of a proposal, its items a union over the verbs the actor may call. Throws for an actor the registry does not hold. */
    proposalSchema(actor: Actor): Schema;
    /** The schema of a read: a union over the read verbs. */
    readSchema(): Schema;
}
/** The store as the one JSON value `model.read` reads a path in: given the committed content and the names of the registered kinds. */
export type Projection = (reader: Reader, kinds: readonly string[]) => Json;
/**
 * An empty registry holding the read verbs every vocabulary shares; an app registers its kinds, verbs and systems into
 * it. A projection given in the options replaces the default one (each kind to its entities by id, each entity to its
 * components) in `model.read`, so a vocabulary can serve a read shape of its own. The actors name who may make a call,
 * `['person']` when none are given; a verb opens itself to some of them only, and undo and redo are open to the first.
 */
export declare function createRegistry(options?: {
    project?: Projection;
    actors?: readonly Actor[];
}): Registry;
/** The store as one JSON value: each kind to its entities by id, each entity to its components. */
export declare function projection(reader: Reader, kindNames: readonly string[]): Json;
