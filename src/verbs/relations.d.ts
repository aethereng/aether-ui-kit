import type { Components, Json, Reader, Relations } from './contracts';
/**
 * The entities that hold a reference to an entity, each once however many places it holds one in, and never the entity
 * itself: the ones a delete that removes its dependants removes. `refs` gives one result for each place, which a refusal
 * needs to say where; a delete that removed each result would remove an entity twice, and remove the target if it points at itself.
 */
export declare function dependants(reader: Reader, kind: string, id: string): Array<{
    kind: string;
    id: string;
}>;
/** One place a relation reaches in an entity, with what is held there. */
export interface RelationTarget {
    /** The key of the relation that reached it, as the kind declares it. */
    relation: string;
    /** The component the relation starts in: the first part of its key. */
    component: string;
    /** The concrete pointer to the place, a list position standing where the relation has a star (`/Pack/2/box`). */
    at: string;
    /** The kinds the relation lists: a reference held here may point at any of them. */
    kinds: readonly string[];
    /** The value held at the place. A value that is no reference is reported as it is, for a check that wants to name it. */
    value: Json;
}
/** The kinds a relation lists, as a list. */
export declare const targetKinds: (declared: string | readonly string[]) => readonly string[];
/** Why a relation is none, or null when it is one: a part of its key that is empty, a star where the component belongs, or no kind to point at. */
export declare function relationProblem(key: string, declared: string | readonly string[]): string | null;
/**
 * Every place the relations reach in one entity's components, in the order of the relations and then of the walk:
 * `refs` reads the references the store holds through it, and a check on a state being loaded reads the same places,
 * so the two cannot disagree about where a reference may sit. A list at the end of a path gives one place for each item.
 * A step that finds nothing (a component the entity lacks, a key an object lacks, a star over something that is no
 * list) ends that walk with no place and no error. Only properties the value holds itself are read, so a name the
 * prototype chain also knows reaches nothing.
 */
export declare function relationTargets(components: Components, relations: Relations | undefined): RelationTarget[];
