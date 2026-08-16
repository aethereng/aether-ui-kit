type __VLS_Props = {
    modelValue: number | undefined;
    min?: number;
    max?: number;
    step?: number;
    /** Decimal places, used to derive `step` when `step` is not given: 2 -> 0.01. */
    precision?: number;
    /** Rendered inside the box after the number. The kit renders a unit; it never knows one. */
    suffix?: string;
    placeholder?: string;
    disabled?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: number | undefined) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: number | undefined) => any) | undefined;
}>, {
    disabled: boolean;
    step: number;
    precision: number;
    placeholder: string;
    min: number;
    max: number;
    suffix: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
