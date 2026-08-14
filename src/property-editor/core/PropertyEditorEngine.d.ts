import type { ChangeEvent, FieldDescriptor, FieldValues, ValidationError } from './types';
type ChangeListener = (e: ChangeEvent) => void;
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
