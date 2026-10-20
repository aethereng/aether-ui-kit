import { type ReferenceScopes } from '../core/refs';
import type { ChatEntry, RefChipData } from '../core/chat';
type __VLS_Props = {
    messages: ChatEntry[];
    modelValue: string;
    placeholder?: string;
    queueLabel?: string;
    sendLabel?: string;
    applyLabel?: string;
    /** How many recent messages to render. The log is append-only and never trimmed by the
     *  caller, so some cap matters for a conversation that runs long; both real consumers
     *  cap it differently (50 vs 60), hence a prop rather than a constant. */
    historyLimit?: number;
    /** 'relay': Queue, Send and Apply reply, with the queued count. 'assistant': Send, and Stop
     *  while `busy`; it also turns on everything the props below describe. */
    actions?: 'relay' | 'assistant';
    /** A request is in flight: Send is disabled and Stop is shown. Assistant only. */
    busy?: boolean;
    /** A line shown under every agent text message, and absent when empty. Assistant only. */
    fixedLine?: string;
    /** A line shown on every proposal card. Assistant only. */
    proposalLine?: string;
    /** The app's answer for a reference (`scope:path`): what to show in the chip, or null when it
     *  cannot resolve it. Absent means every reference is the warning chip. Assistant only. */
    resolveRef?: (ref: string) => RefChipData | null;
    /** The reference scopes drawn as chips: what a `{{scope:path}}` may name. Assistant only. A
     *  scope outside this list is plain text. */
    refScopes?: ReferenceScopes;
    /** The turn in progress, for the indicator above the compose box: the app's phase words and the
     *  moments it recorded on the page's clock (`Date.now()`). `awaitsApi` says the API is the party
     *  being waited for, which is when a quiet spell counts. `heardAt` is the last moment the API sent
     *  anything, or the request went out: the app sets it at send, at each `waiting` phase the loop
     *  reports, and at each `heard()` report, and the quiet notice counts from it. `note` is thinking
     *  text the app has already withheld for display; the panel shows it under the row, three lines at
     *  most, and adds no numeral rule of its own. Null when no turn runs. Assistant only. */
    activity?: {
        since: number;
        phase: string;
        heardAt?: number;
        awaitsApi?: boolean;
        note?: string;
    } | null;
    /** The words of the quiet notice, given the whole seconds since the API last sent anything. Absent,
     *  there is no notice. Assistant only. */
    quietText?: (seconds: number) => string;
};
type __VLS_Slots = {
    /** The caller's copy for an empty log. */
    empty?: () => unknown;
    /** Extra content inside each message, of any kind. Assistant only. */
    'message-extra'?: (props: {
        message: ChatEntry;
    }) => unknown;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {
    focus: () => void | undefined;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    accept: (proposalId: string) => any;
    "load-again": (proposalId: string) => any;
    stop: () => any;
    "update:modelValue": (value: string) => any;
    queue: () => any;
    send: () => any;
    discard: (proposalId: string) => any;
    "open-ref": (ref: string) => any;
    "toggle-tool": (callId: string) => any;
    "apply-reply": () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onAccept?: ((proposalId: string) => any) | undefined;
    "onLoad-again"?: ((proposalId: string) => any) | undefined;
    onStop?: (() => any) | undefined;
    "onUpdate:modelValue"?: ((value: string) => any) | undefined;
    onQueue?: (() => any) | undefined;
    onSend?: (() => any) | undefined;
    onDiscard?: ((proposalId: string) => any) | undefined;
    "onOpen-ref"?: ((ref: string) => any) | undefined;
    "onToggle-tool"?: ((callId: string) => any) | undefined;
    "onApply-reply"?: (() => any) | undefined;
}>, {
    placeholder: string;
    queueLabel: string;
    sendLabel: string;
    applyLabel: string;
    historyLimit: number;
    actions: "relay" | "assistant";
    busy: boolean;
    fixedLine: string;
    proposalLine: string;
    resolveRef: (ref: string) => RefChipData | null;
    refScopes: ReferenceScopes;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
