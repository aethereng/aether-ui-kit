type __VLS_Props = {
    label: string;
    hot?: boolean;
    danger?: boolean;
    disabled?: boolean;
    title?: string;
    /** Render only the `#icon` slot, keeping `label` as the accessible name. Without an icon
     *  slot this would produce an empty button, so it is ignored unless one is supplied. */
    labelHidden?: boolean;
    /** FILLED rather than outline. Only meaningful with `danger`, and deliberately not a general
     *  "make it solid" switch: the kit's destructive button is outline by default because a filled
     *  red button repeated across a dense toolbar stops reading as a warning. Raise this for the
     *  destructive action whose consequence is genuinely worse than its neighbours' — deleting model
     *  geometry rather than clearing a filter. If everything on a surface is filled, nothing is. */
    fill?: boolean;
};
type __VLS_Slots = {
    /** Leading icon. The caller's own markup -- an inline SVG, a font glyph, anything. */
    icon?: () => unknown;
    /** Trailing affordance, after the label: a dropdown caret, a disclosure chevron.
     *
     *  DECORATIVE, and rendered aria-hidden like `#icon`. The button's accessible name stays exactly
     *  `label`, so a caret cannot leak into it and a trailing slot cannot quietly become the thing a
     *  screen reader reads. Anything that carries meaning belongs in `label`, or in the aria-* the
     *  caller puts on the button -- a menu trigger's `aria-expanded` is the caller's to own, because
     *  only the caller knows what is open. */
    trailing?: () => unknown;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    click: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onClick?: (() => any) | undefined;
}>, {
    fill: boolean;
    title: string;
    labelHidden: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
