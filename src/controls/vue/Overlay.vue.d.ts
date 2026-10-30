type __VLS_Props = {
    /** The work is running. Shown through the deferred flag. */
    open: boolean;
    /** Takes the card away at once while true, without waiting out its minimum time. */
    aside?: boolean;
    /** The title, and the bar's accessible name. */
    label: string;
    /** What is being worked on, under the title. */
    subject?: string;
    /** A line of detail under the bar. */
    detail?: string;
    /** How far along, from 0 to 1. Without it the bar sweeps. */
    progress?: number | null;
    /** Shows the stop button. */
    stoppable?: boolean;
    stopLabel?: string;
    /** Draws the stop button in the danger tone. */
    stopDanger?: boolean;
};
declare var __VLS_1: {};
type __VLS_Slots = {} & {
    mark?: (props: typeof __VLS_1) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    stop: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onStop?: (() => any) | undefined;
}>, {
    progress: number | null;
    aside: boolean;
    detail: string;
    subject: string;
    stoppable: boolean;
    stopLabel: string;
    stopDanger: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
