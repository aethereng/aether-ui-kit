import type { Issue, Json, Schema } from './contracts';
/**
 * The keywords of a schema (at any depth) this checker does not read, reads only in another form, or would not
 * reach where they are placed (beside an `anyOf`; an `x-ref` without `type: 'string'`), as `path: keyword = value`.
 */
export declare function unreadKeywords(schema: Json, at?: string): string[];
/** The kinds the `x-ref` keywords of a schema name, at any depth. */
export declare function refKinds(schema: Json): string[];
/**
 * A copy of the value in which each `{handle: name}` object that sits where the schema marks an `x-ref` (in any
 * alternative of an anyOf, in a property at any depth, in the items of a list) is replaced by what `lookup` makes of
 * the name. Everywhere else an object with a handle key is data and is copied as it is, also where an alternative of
 * the same position takes an object: such an object matches that alternative by its own type, and an `x-ref` is a string.
 */
export declare function resolveRefs(schema: Schema, value: Json, lookup: (name: string) => Json): Json;
/**
 * What is wrong with `value` against `schema`, each issue naming the field it concerns as a pointer
 * (`/set/size`). `exists` answers an `x-ref`: whether an entity of that kind has that id.
 */
export declare function checkShape(schema: Schema, value: Json | undefined, exists: (kind: string, id: string) => boolean, at?: string): Issue[];
/**
 * The schema as a caller outside the app is given it: an `x-ref` string also accepts `{handle}`, the name a call of the
 * same proposal gave an entity it creates. The input is copied; the schema stays as it was registered.
 */
export declare function toCallSchema(schema: Schema): Schema;
