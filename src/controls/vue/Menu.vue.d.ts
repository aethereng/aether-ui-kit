import type { MenuItem } from '../core/menu';
type __VLS_Props = {
    items: MenuItem[];
    /** Trigger text. The #trigger slot replaces the whole button when a caller needs an icon. */
    label?: string;
    placement?: 'bottom' | 'top';
    /** Aligns the surface to the trigger's start or end edge. */
    align?: 'start' | 'end';
};
declare var __VLS_1: {
    open: boolean;
    toggle: () => void;
}, __VLS_3: {
    item: MenuItem;
};
type __VLS_Slots = {} & {
    trigger?: (props: typeof __VLS_1) => any;
} & {
    item?: (props: typeof __VLS_3) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    select: (id: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSelect?: ((id: string) => any) | undefined;
}>, {
    placement: "bottom" | "top";
    label: string;
    align: "start" | "end";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
