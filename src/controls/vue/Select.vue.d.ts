import type { SelectGroup, SelectOption } from '../core/types';
type __VLS_Props = {
    modelValue: string;
    /** Flat options, or groups. Groups render as <optgroup>, which the platform labels for us. */
    options?: SelectOption[];
    groups?: SelectGroup[];
    disabled?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: string) => any) | undefined;
}>, {
    disabled: boolean;
    options: SelectOption[];
    groups: SelectGroup[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
