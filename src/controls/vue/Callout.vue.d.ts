type Tone = 'info' | 'success' | 'warning' | 'danger';
type __VLS_Props = {
    /** info is the default and the quiet one; danger and warning are meant to stop you. */
    tone?: Tone;
    /** Optional heading. The body reads as prose without one. */
    title?: string;
    /**
     * Promote to a live region, for a callout that appears in response to an action rather than
     * being present when the document is first read.
     */
    live?: boolean;
};
declare var __VLS_1: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    tone: Tone;
    title: string;
    live: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
