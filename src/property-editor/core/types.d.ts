export type FieldType = 'text' | 'textarea' | 'boolean' | 'enum' | 'date' | 'reference' | 'placement';
export interface EnumOption {
    value: string;
    label: string;
}
export type EnumVariant = 'buttons' | 'dropdown';
export interface PlacementValue {
    position: [number, number, number];
    rotation: [number, number, number];
}
export interface FieldDescriptor {
    key: string;
    type: FieldType;
    label: string;
    required?: boolean;
    options?: EnumOption[];
    variant?: EnumVariant;
    refType?: string;
    placeholder?: string;
}
export type FieldValues = Record<string, unknown>;
export interface ValidationError {
    key: string;
    message: string;
}
export interface ChangeEvent {
    key: string;
    value: unknown;
    previous: unknown;
}
