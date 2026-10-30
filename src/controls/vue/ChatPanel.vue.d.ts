import { type ReferenceScopes } from '../core/refs';
import type { ChatEntry, ChatMessage, RefChipData } from '../core/chat';
declare const _default: <E extends ChatEntry = ChatMessage>(__VLS_props: NonNullable<Awaited<typeof __VLS_setup>>["props"], __VLS_ctx?: __VLS_PrettifyLocal<Pick<NonNullable<Awaited<typeof __VLS_setup>>, "attrs" | "emit" | "slots">>, __VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>["expose"], __VLS_setup?: Promise<{
    props: __VLS_PrettifyLocal<Pick<Partial<{}> & Omit<{
        readonly "onUpdate:modelValue"?: ((value: string) => any) | undefined;
        readonly onQueue?: (() => any) | undefined;
        readonly onSend?: (() => any) | undefined;
        readonly "onOpen-ref"?: ((ref: string) => any) | undefined;
        readonly "onApply-reply"?: (() => any) | undefined;
    } & import("vue").VNodeProps & import("vue").AllowedComponentProps & import("vue").ComponentCustomProps, never>, "onUpdate:modelValue" | "onQueue" | "onSend" | "onOpen-ref" | "onApply-reply"> & {
        /** The log: text messages, and entries of the caller's own kinds for the `entry` slot. */
        messages: E[];
        modelValue: string;
        placeholder?: string;
        queueLabel?: string;
        sendLabel?: string;
        applyLabel?: string;
        /** The word printed over a reply. */
        replyLabel?: string;
        /** How many recent messages to render. The log is append-only and never trimmed by the
         *  caller, so some cap matters for a conversation that runs long; both real consumers
         *  cap it differently (50 vs 60), hence a prop rather than a constant. */
        historyLimit?: number;
        /** What Ctrl/Cmd+Enter asks for. */
        shortcut?: "queue" | "send";
        /** Read a reply as markdown with reference chips, draw marks, and follow and announce a message
         *  that is still arriving. Off, every message is plain text and the two props below are not read. */
        rich?: boolean;
        /** The app's answer for a reference (`scope:path`): what to show in the chip, or null when it
         *  cannot resolve it. Absent means every reference is the warning chip. */
        resolveRef?: (ref: string) => RefChipData | null;
        /** The reference scopes drawn as chips: what a `{{scope:path}}` may name. A scope outside this list
         *  is plain text. */
        refScopes?: ReferenceScopes;
    } & Partial<{}>> & import("vue").PublicProps;
    expose(exposed: import("vue").ShallowUnwrapRef<{
        focus: () => void | undefined;
        announce: (text: string) => void;
    }>): void;
    attrs: any;
    slots: {
        /** The caller's copy for an empty log. */
        empty?: () => unknown;
        /** One entry of the caller's own kind, drawn where it stands in the log. */
        entry?: (props: {
            entry: Exclude<E, ChatMessage>;
        }) => unknown;
        /** Extra content inside each text message. */
        'message-extra'?: (props: {
            message: Extract<E, ChatMessage>;
        }) => unknown;
        /** Between the log and the compose box. */
        'above-compose'?: () => unknown;
        /** In place of the three buttons and the queued count. */
        actions?: () => unknown;
    };
    emit: ((evt: "update:modelValue", value: string) => void) & ((evt: "queue") => void) & ((evt: "send") => void) & ((evt: "open-ref", ref: string) => void) & ((evt: "apply-reply") => void);
}>) => import("vue").VNode & {
    __ctx?: Awaited<typeof __VLS_setup>;
};
export default _default;
type __VLS_PrettifyLocal<T> = {
    [K in keyof T]: T[K];
} & {};
