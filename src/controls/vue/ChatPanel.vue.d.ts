import type { ChatMessage } from '../core';
type __VLS_Props = {
    messages: ChatMessage[];
    modelValue: string;
    placeholder?: string;
    queueLabel?: string;
    sendLabel?: string;
    applyLabel?: string;
    /** How many recent messages to render. The log is append-only and never trimmed by the
     *  caller, so some cap matters for a conversation that runs long; both real consumers
     *  cap it differently (50 vs 60), hence a prop rather than a constant. */
    historyLimit?: number;
};
declare var __VLS_1: {};
type __VLS_Slots = {} & {
    empty?: (props: typeof __VLS_1) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {
    focus: () => void | undefined;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: string) => any;
    queue: () => any;
    send: () => any;
    "apply-reply": () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: string) => any) | undefined;
    onQueue?: (() => any) | undefined;
    onSend?: (() => any) | undefined;
    "onApply-reply"?: (() => any) | undefined;
}>, {
    placeholder: string;
    queueLabel: string;
    sendLabel: string;
    applyLabel: string;
    historyLimit: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
