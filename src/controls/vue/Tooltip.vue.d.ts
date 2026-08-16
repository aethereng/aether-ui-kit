type __VLS_Props = {
    /** The tooltip text. Plain string on purpose: rich content in a tooltip is unreachable by
     *  keyboard and invisible to touch. Anything interactive belongs in a Menu or a Dialog. */
    text: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    /** Dwell before showing on hover, in ms. Pointer only — focus shows immediately, because a
     *  keyboard user has already committed by landing on the control. */
    delay?: number;
    disabled?: boolean;
};
declare var __VLS_1: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    disabled: boolean;
    placement: "top" | "bottom" | "left" | "right";
    delay: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
