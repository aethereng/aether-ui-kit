import type { Json, Schema } from '../../verbs';
/** A value of the shape a schema takes, for a person to see how to write one: numbers are 1, a list has its least count of items. */
export declare function exampleOf(schema: Schema): Json;
/** The line for text that cannot be the number, list or object a schema takes, with an example; undefined where it can. */
export declare function shapeLine(schema: Schema, text: string): string | undefined;
