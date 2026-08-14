import type { DisclosureProps } from '../core/types';
type __VLS_Slots = {
    /** The collapsible content. */
    default?: () => unknown;
    /** Header controls that must stay reachable while COLLAPSED — a link, a menu, a status badge.
     *  Renders as a SIBLING of the toggle, never inside it, so it is its own tab stop. */
    aside?: () => unknown;
};
declare const __VLS_component: import("vue").DefineComponent<DisclosureProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:open": (args_0: boolean) => any;
}, string, import("vue").PublicProps, Readonly<DisclosureProps> & Readonly<{
    "onUpdate:open"?: ((args_0: boolean) => any) | undefined;
}>, {
    disabled: boolean;
    meta: string;
    open: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
