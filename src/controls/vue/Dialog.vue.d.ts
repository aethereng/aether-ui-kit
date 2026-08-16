type __VLS_Props = {
    open: boolean;
    /** Accessible name for the dialog. Rendered as the heading unless the #title slot replaces it. */
    title?: string;
    /** Matches the widest call site seen in the wild; a caller with different content overrides it. */
    maxWidth?: string;
    /** Escape and backdrop clicks close it. Set false for a dialog with unsaved work in it, and
     *  give the user an explicit way out — a dialog with no exit is worse than a dismissible one. */
    dismissible?: boolean;
};
declare var __VLS_1: {}, __VLS_3: {}, __VLS_5: {};
type __VLS_Slots = {} & {
    title?: (props: typeof __VLS_1) => any;
} & {
    default?: (props: typeof __VLS_3) => any;
} & {
    footer?: (props: typeof __VLS_5) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:open": (value: boolean) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:open"?: ((value: boolean) => any) | undefined;
}>, {
    title: string;
    maxWidth: string;
    dismissible: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
