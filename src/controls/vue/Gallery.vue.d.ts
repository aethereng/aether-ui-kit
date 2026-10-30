import { type GalleryFamily, type GalleryItem } from '../core/gallery';
type __VLS_Props = {
    /** The sections, in their order. A family with no items is left out. */
    families: readonly GalleryFamily[];
    items: readonly GalleryItem[];
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    open: (id: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onOpen?: ((id: string) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
