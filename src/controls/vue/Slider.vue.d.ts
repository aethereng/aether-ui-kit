import type { SliderTick } from '../core/types';
type __VLS_Props = {
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    /** Rendered after the read-out. The kit renders a unit; it never knows one. */
    suffix?: string;
    /** Turns the stored value into what the read-out shows. Defaults to the value itself. */
    format?: (value: number) => string;
    /** Marks on the track, at values the scale does not make obvious. See SliderTick. */
    ticks?: SliderTick[];
    disabled?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: number) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: number) => any) | undefined;
}>, {
    disabled: boolean;
    step: number;
    min: number;
    max: number;
    suffix: string;
    format: (value: number) => string;
    ticks: SliderTick[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
