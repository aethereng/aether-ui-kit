import type { Json, Schema } from '../../verbs';
import type { FieldColumn, KindDecl } from './types';
/** A choice offered: its value and its words. */
export interface Option {
    value: string;
    label: string;
}
/** A field as the form shows it. */
export interface FieldView {
    name: string;
    label: string;
    /**
     * The control: a number; a choice of a fixed set or of another record; a flag; a list of references (`refList`, one
     * choice per entry); or the declaration's control.
     */
    kind: 'number' | 'choice' | 'flag' | 'refList' | 'vector' | 'switches' | 'rows' | 'summary' | 'json' | 'text' | 'app';
    options: Option[];
    required: boolean;
    /** A null given for it clears it. */
    clears: boolean;
    /** It takes null as a value. */
    nullable: boolean;
    /** A list with a fixed count of entries: one choice per entry. */
    fixed?: number;
    /** The value's schema, for text read as a value. */
    shape?: Schema;
    quantity?: string;
    columns?: (FieldColumn & {
        options?: Option[];
    })[];
    /** The blank of a choice: what it reads before anything is chosen. */
    blank: string;
    /** For a choice of another record, the kind it is chosen from. */
    ref?: string;
    /** For a choice of another record, the word for one record of that kind. */
    refWord?: string;
    /** For `switches`: whether the value is an object of flags or a list of the names that are on. */
    holds?: 'flags' | 'names';
    group?: string;
    advanced?: true;
    readonly?: true;
    presets?: readonly {
        label: string;
        value: Json;
    }[];
}
/** What a form reads from the app: the records a choice offers, and the word for one record of a kind. */
export interface FormContext {
    /** The ids of the records of a kind: the options of a choice of one, and whether a variant's `needs` is met. */
    ids(kind: string): readonly string[];
    /** The word for one record of a kind, for the link that opens the record chosen. */
    word?(kind: string): string;
}
/**
 * The fields the form shows for a record of `variant` ('' for none chosen): the tag first where the kind has variants,
 * then the fields the variant takes, in the kind's order. The tag offers each variant whose `needs` the app holds a
 * record of, and the variant shown; a choice of another record offers the ids the app holds.
 */
export declare function formFields(kind: KindDecl, variant: string, context: FormContext): FieldView[];
/** The plain fields by their group, in the order the groups first appear, the fields of no group first; and the advanced. */
export declare function groupFields<F extends Pick<FieldView, 'group' | 'advanced'>>(fields: readonly F[]): {
    groups: {
        name: string;
        fields: F[];
    }[];
    advanced: F[];
};
/**
 * The draft a new variant starts from: the values `held` holds in the fields the new variant shares with the old, and
 * none of the rest; a choice the new variant cannot offer (a record of a kind it does not name) goes blank. `fields` are
 * the new variant's (formFields). No variant chosen starts from nothing.
 */
export declare function keepOnVariant(kind: KindDecl, next: string, fields: readonly {
    name: string;
    kind: string;
    options: readonly Option[];
}[], held: Readonly<Record<string, Json | undefined>>): Record<string, Json>;
/** The field a verb's refusal belongs to, by its place: `id` for the id, else the field its place names (`/set/e`). */
export declare function issueField(issue: {
    field?: string;
}): string | undefined;
