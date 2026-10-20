type __VLS_Props = {
    modelValue: string;
    placeholder?: string;
    ariaLabel?: string;
    /** Tooltip + accessible name for the clear button. */
    clearLabel?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    focus: () => void | undefined;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    clear: () => any;
    "update:modelValue": (value: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onClear?: (() => any) | undefined;
    "onUpdate:modelValue"?: ((value: string) => any) | undefined;
}>, {
    placeholder: string;
    ariaLabel: string;
    clearLabel: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
