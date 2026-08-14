import type { ChangeEvent, FieldDescriptor, FieldValues, ValidationError } from './types';
type ChangeListener = (e: ChangeEvent) => void;
/** What to do with a number input's raw text on one keystroke. `commit: false` means an
 *  INTERMEDIATE state that is not yet a complete number: the caller does nothing and lets the
 *  browser keep showing whatever the user is mid-typing, rather than force a value back in and
 *  fight the cursor position.
 *
 *  `badInput` must be `el.validity.badInput`, and it is NOT optional in practice for a
 *  `<input type="number">`. Per the HTML value-sanitization rules such an input returns the EMPTY
 *  STRING from `.value` for anything it cannot parse -- so "12." mid-decimal and a genuinely
 *  cleared field are indistinguishable from `raw` alone, while the user still sees their "12." on
 *  screen. Committing `undefined` for that would blank the bound value underneath someone
 *  mid-keystroke (and flash a required-field error). `badInput` is the only thing that separates
 *  the two: true = unparseable input present, false = actually empty. */
export type NumberInputResult = {
    commit: true;
    value: number | undefined;
} | {
    commit: false;
};
export declare function coerceNumberInput(raw: string, badInput?: boolean): NumberInputResult;
/** The spinner increment for a number field: the caller's `step` if given, else derived from
 *  `precision` (2 -> 0.01), else undefined (the browser's own default of 1). */
export declare function numberStep(field: Pick<FieldDescriptor, 'step' | 'precision'>): number | undefined;
export declare class PropertyEditorEngine {
    private fields;
    private values;
    private listeners;
    constructor(fields: FieldDescriptor[], initialValues?: FieldValues);
    getFields(): readonly FieldDescriptor[];
    getField(key: string): FieldDescriptor | undefined;
    getValue(key: string): unknown;
    getValues(): Readonly<FieldValues>;
    setValue(key: string, value: unknown): void;
    onChange(fn: ChangeListener): () => void;
    validate(): ValidationError[];
    isValid(): boolean;
    toJSON(): FieldValues;
}
export {};
