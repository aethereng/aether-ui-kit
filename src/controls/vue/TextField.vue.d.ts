type __VLS_Props = {
    modelValue: string;
    multiline?: boolean;
    /** Visible rows when multiline. Ignored otherwise, and ignored once `autogrow` takes over —
     *  kept only as the height the very first paint uses, before JS has measured anything. */
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
    /** Multiline only. Height tracks content instead of a fixed `rows`, growing and shrinking
     *  live — both on typing and when `modelValue` changes from OUTSIDE (a caller reassigning
     *  the field's value, not just the user typing into it). Also switches `resize` off: once
     *  height is no longer something to drag, the browser's own corner-triangle glyph is
     *  leftover affordance for a gesture that no longer does anything. No min-height here for
     *  the same reason the multiline rule above has none — that is the caller's layout to set,
     *  not this component's to assume. */
    autogrow?: boolean;
    /** autogrow only. The ceiling it grows to before it stops pushing on whatever layout it
     *  sits in and starts scrolling internally instead — unbounded growth is fine for the field
     *  but not for the panel around it, which is exactly what held-down Enter demonstrates.
     *  8 is a working default, not a considered one; there is no natural "right" ceiling, only
     *  a layout it should stop pushing on. */
    maxRows?: number;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: string) => any) | undefined;
}>, {
    disabled: boolean;
    placeholder: string;
    autogrow: boolean;
    multiline: boolean;
    rows: number;
    maxRows: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
