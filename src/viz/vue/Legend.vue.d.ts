type __VLS_Props = {
    /** The field's name. */
    label: string;
    /** Its unit, drawn apart from the name. */
    unit?: string;
    /** The ramp's colour stops, as CSS: `#00f 0%, #fff 50%, #f00 100%`. */
    stops: string;
    /** The numbers under the ramp, spread from its left end to its right end. */
    ticks?: readonly string[];
    /** `ramp`, or why there is none. */
    state?: 'ramp' | 'zero' | 'nonfinite';
    /** The colour the drawing gives a value the ramp cannot place, shown as a swatch. */
    noValueColor?: string;
    /** The words beside that swatch under a ramp. */
    noValueKey?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    unit: string;
    ticks: readonly string[];
    state: "ramp" | "zero" | "nonfinite";
    noValueColor: string;
    noValueKey: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
