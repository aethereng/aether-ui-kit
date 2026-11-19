type __VLS_Props = {
    /** `YYYY-MM-DD`, or '' for empty: the value format of the native input this wraps. */
    modelValue: string;
    id?: string;
    /** Not focusable, nothing to type, no picker, and dimmed as the kit's other disabled controls are. A picker
     *  open when this turns on closes. */
    disabled?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (args_0: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((args_0: string) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
