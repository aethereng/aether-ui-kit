import type { SegOption } from '../core/types';
declare const _default: <V extends string = string>(__VLS_props: NonNullable<Awaited<typeof __VLS_setup>>["props"], __VLS_ctx?: __VLS_PrettifyLocal<Pick<NonNullable<Awaited<typeof __VLS_setup>>, "attrs" | "emit" | "slots">>, __VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>["expose"], __VLS_setup?: Promise<{
    props: __VLS_PrettifyLocal<Pick<Partial<{}> & Omit<{
        readonly "onUpdate:modelValue"?: ((value: V) => any) | undefined;
        readonly onChange?: ((value: V) => any) | undefined;
    } & import("vue").VNodeProps & import("vue").AllowedComponentProps & import("vue").ComponentCustomProps, never>, "onChange" | "onUpdate:modelValue"> & {
        options: SegOption<V>[];
        modelValue: V;
        ariaLabel?: string;
        /** 'default' — square-cornered, panel-grey active segment.
         *  'pill'    — fully rounded, uppercase mono, accent-wash active segment. A second real
         *              look that already shipped in a consumer's header, not a style hook: the
         *              same precedent Chip's `variant` set. */
        variant?: "default" | "pill";
    } & Partial<{}>> & import("vue").PublicProps;
    expose(exposed: import("vue").ShallowUnwrapRef<{}>): void;
    attrs: any;
    slots: {};
    emit: ((evt: "update:modelValue", value: V) => void) & ((evt: "change", value: V) => void);
}>) => import("vue").VNode & {
    __ctx?: Awaited<typeof __VLS_setup>;
};
export default _default;
type __VLS_PrettifyLocal<T> = {
    [K in keyof T]: T[K];
} & {};
