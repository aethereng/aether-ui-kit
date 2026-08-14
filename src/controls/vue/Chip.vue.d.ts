import type { ChipOption } from '../core/types';
declare const _default: <V extends string = string>(__VLS_props: NonNullable<Awaited<typeof __VLS_setup>>["props"], __VLS_ctx?: __VLS_PrettifyLocal<Pick<NonNullable<Awaited<typeof __VLS_setup>>, "attrs" | "emit" | "slots">>, __VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>["expose"], __VLS_setup?: Promise<{
    props: __VLS_PrettifyLocal<Pick<Partial<{}> & Omit<{
        readonly onToggle?: ((value: V) => any) | undefined;
    } & import("vue").VNodeProps & import("vue").AllowedComponentProps & import("vue").ComponentCustomProps, never>, "onToggle"> & {
        options: ChipOption<V>[];
        modelValue: V | Set<V>;
        ariaLabel?: string;
        /** 'pill' is the bordered inline chip of a filter bar; 'row' is the borderless full-width
         *  list row of a sidebar rail, with its count aligned right. Both exist in the surfaces
         *  this came from, and a rail rendered as wrapping pills reads as the wrong control. */
        variant?: "pill" | "row";
    } & Partial<{}>> & import("vue").PublicProps;
    expose(exposed: import("vue").ShallowUnwrapRef<{}>): void;
    attrs: any;
    slots: {};
    emit: (evt: "toggle", value: V) => void;
}>) => import("vue").VNode & {
    __ctx?: Awaited<typeof __VLS_setup>;
};
export default _default;
type __VLS_PrettifyLocal<T> = {
    [K in keyof T]: T[K];
} & {};
