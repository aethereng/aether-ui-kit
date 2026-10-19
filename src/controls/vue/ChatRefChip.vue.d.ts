import type { RefChipData } from '../core/chat';
type __VLS_Props = {
    /** The reference as `scope:path`; what `open` carries back. */
    reference: string;
    /** What the app resolved it to, or null when it could not. */
    data: RefChipData | null;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    open: (reference: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onOpen?: ((reference: string) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
