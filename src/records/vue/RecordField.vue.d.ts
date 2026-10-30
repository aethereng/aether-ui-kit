import type { Json } from '../../verbs';
import { type FieldView, type Units } from '../core';
type __VLS_Props = {
    field: FieldView;
    value: Json | undefined;
    units?: Units;
    issue?: string;
    summary?: string;
};
/** Gives what is typed and not yet given. */
declare function flush(): void;
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    flush: typeof flush;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    open: (id: string) => any;
    invalid: (words: string) => any;
    commit: (value: Json) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onOpen?: ((id: string) => any) | undefined;
    onInvalid?: ((words: string) => any) | undefined;
    onCommit?: ((value: Json) => any) | undefined;
}>, {
    summary: string;
    units: Units;
    issue: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
