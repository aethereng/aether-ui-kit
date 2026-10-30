type __VLS_Props = {
    /** The path's `d`, on a 24 by 24 grid. */
    path: string;
    /** Width and height, as a CSS length; a number is pixels. Default 1em. */
    size?: number | string;
    /** Accessible name. Omit when the control or text beside the icon already names it. */
    label?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    label: string;
    size: number | string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
