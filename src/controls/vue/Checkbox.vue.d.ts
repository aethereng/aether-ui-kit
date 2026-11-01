import type { CheckboxProps } from '../core/types';
type __VLS_Slots = {
    /** The visible label, inside the button, so a press on it presses the key. It is the accessible name. */
    default?: () => unknown;
};
declare const __VLS_component: import("vue").DefineComponent<CheckboxProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: boolean) => any;
}, string, import("vue").PublicProps, Readonly<CheckboxProps> & Readonly<{
    "onUpdate:modelValue"?: ((value: boolean) => any) | undefined;
}>, {
    mixed: boolean;
    disabled: boolean;
    label: string;
    size: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
