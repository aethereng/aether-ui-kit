type __VLS_Props = {
    modelValue: string;
    placeholder?: string;
    ariaLabel?: string;
    /** Tooltip + accessible name for the clear button. */
    clearLabel?: string;
    /** Not focusable, nothing to type or clear, and dimmed as the kit's other disabled controls are. */
    disabled?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    focus: () => void | undefined;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: string) => any;
    clear: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: string) => any) | undefined;
    onClear?: (() => any) | undefined;
}>, {
    disabled: boolean;
    placeholder: string;
    ariaLabel: string;
    clearLabel: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
