import type { FieldDescriptor, FieldValues } from '../core/types';
type __VLS_Props = {
    fields: FieldDescriptor[];
    modelValue: FieldValues;
    labelPlacement?: 'above' | 'inside';
};
declare var __VLS_8: {
    field: FieldDescriptor;
    value: unknown;
    set: (v: unknown) => void;
}, __VLS_10: {
    field: FieldDescriptor;
    value: unknown;
    set: (v: unknown) => void;
};
type __VLS_Slots = {} & {
    reference?: (props: typeof __VLS_8) => any;
} & {
    placement?: (props: typeof __VLS_10) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {
    isValid: () => boolean;
    getValues: () => Readonly<FieldValues>;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (values: FieldValues) => any;
    change: (key: string, value: unknown) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((values: FieldValues) => any) | undefined;
    onChange?: ((key: string, value: unknown) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
