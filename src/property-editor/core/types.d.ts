export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'enum' | 'date' | 'reference' | 'placement';
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
    /** type === 'number' only. All four map straight to the native <input type="number">'s own
     *  attributes -- no semantics added. If `step` is omitted, `precision` derives a default
     *  (2 -> 0.01) so the spinner increments by a sane amount for the expected decimal count; it
     *  does NOT round the stored or displayed value, so a caller mid-typing "1.500" never has
     *  trailing digits stripped out from underneath them. */
    step?: number;
    min?: number;
    max?: number;
    precision?: number;
    /** type === 'number' only. Rendered after the input, unconditionally, with no meaning
     *  attached -- '%', 'px' and 'N·m' are the same feature to this component. The kit renders a
     *  unit; it does not know one. Dimensional analysis -- conversion, mm<->in, knowing N·m and
     *  lbf·ft are the same dimension -- is the caller's, on the caller's side of this boundary. */
    suffix?: string;
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
