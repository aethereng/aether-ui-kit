import { type Effort, type ModelId, type UsageLike } from './models';
export interface TextBlock {
    type: 'text';
    text: string;
}
export interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: unknown;
}
export interface ThinkingBlock {
    type: 'thinking';
    thinking: string;
    signature: string;
}
export interface RedactedThinkingBlock {
    type: 'redacted_thinking';
    data: string;
}
export interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
}
/** A block of a message. The API may add block types; the app's cast passes them through unread. */
export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock | RedactedThinkingBlock | ToolResultBlock;
export interface MessageParam {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
}
/** One event of the stream. The loop reads the block starts and the deltas of text and thinking. */
export interface StreamEvent {
    type: string;
    index?: number;
    content_block?: {
        type: string;
        id?: string;
        name?: string;
    };
    delta?: {
        type: string;
        text?: string;
        thinking?: string;
    };
}
/** A change the API made to a request's history on its way in. */
export interface InputTransformation {
    type: string;
    path?: string;
    reason?: string;
}
/** A response once the stream has ended. */
export interface FinalMessage {
    content: ContentBlock[];
    stop_reason: string | null;
    stop_details?: {
        category?: string | null;
    } | null;
    usage: UsageLike;
    input_transformations?: InputTransformation[] | null;
}
export interface StreamLike extends AsyncIterable<StreamEvent> {
    finalMessage(): Promise<FinalMessage>;
    abort(): void;
}
/** The settings every request of a session carries, as the app states them. The kit builds the
 *  request's shape from these and the per-request values. */
export interface LoopConfig<Tool = unknown> {
    /** The system prompt. The one cache breakpoint goes at its end, after the tools. */
    system: string;
    tools: Tool[];
    /** The beta names the request sends. */
    betas: string[];
    /** How the API returns a thinking block, by the name the API gives it. */
    thinkingDisplay: string;
    /** The binding setting for a request whose history holds no thinking from another model. */
    prefixMismatch: 'error' | 'drop_block';
    maxTokens: number;
}
/** The request the loop sends: the shape the SDK's streaming call takes. */
export interface RequestParams<Tool = unknown> {
    model: ModelId;
    max_tokens: number;
    system: {
        type: 'text';
        text: string;
        cache_control: {
            type: 'ephemeral';
        };
    }[];
    tools: Tool[];
    tool_choice: {
        type: 'auto';
    };
    thinking: {
        type: 'adaptive';
        display: string;
        block_binding: {
            prefix_mismatch_behavior: 'error' | 'drop_block';
        };
    };
    output_config: {
        effort: Effort;
    };
    betas: string[];
    messages: MessageParam[];
}
/** The client the loop calls. The app's client is the SDK's, cast to this shape. */
export interface MessagesApi<Tool = unknown> {
    /** Starts one streamed request. A throw here fails the request, as a stream that errors does. */
    stream(params: RequestParams<Tool>): StreamLike;
}
/** What a tool handler returns: its status, optionally a kind the loop sets, and a text. */
export interface ToolOutput {
    status: string;
    kind?: string;
    text?: string;
}
export type ToolHandler = (input: Record<string, unknown>, callId: string) => Promise<ToolOutput> | ToolOutput;
/** What the turn is doing: waiting for the API, writing text, thinking, preparing a call to a tool,
 *  or running one. */
export type Phase = {
    kind: 'waiting';
} | {
    kind: 'writing';
} | {
    kind: 'thinking';
} | {
    kind: 'calling';
    tool: string;
} | {
    kind: 'running';
    tool: string;
};
/** Which model wrote each assistant message of a history, recorded beside it by the loop. */
export type Producers = WeakMap<MessageParam, ModelId>;
/** A thinking block the API dropped from a request: where it was, as `messages.{i}.content.{j}`, and
 *  the binding check that dropped it. */
export interface DroppedBlock {
    path: string;
    reason: string;
}
/** What the loop reports to the panel as a turn unfolds. */
export interface LoopView {
    /** A text block began streaming; returns the handle its deltas and end refer to. */
    textStart(): number;
    textDelta(handle: number, text: string): void;
    /** The block settled with its whole text. */
    textEnd(handle: number, text: string, model: ModelId): void;
    toolStart(callId: string, name: string): void;
    toolEnd(callId: string, name: string, output: ToolOutput): void;
    /** The answer hit the length limit. */
    cutShort(): void;
    /** The API declined; `category` is `stop_details.category` when the response carries one. */
    apiRefusal(category: string | null): void;
    /** The request itself failed: the network, the key, the API. */
    requestFailed(text: string): void;
    /** The person pressed Stop. */
    stopped(): void;
    /** The API dropped a thinking block from the request, as the response reports it. */
    thinkingDropped(block: DroppedBlock): void;
    /** A request is about to go with another model's thinking in its history. */
    otherThinking(model: ModelId): void;
    /** One response's token counts, exactly as its `usage` reports them. */
    usage(usage: UsageLike, model: ModelId): void;
    /** The model stopped for a reason the panel does not act on. */
    stoppedFor(reason: string): void;
    phase(phase: Phase): void;
    /** The API sent something: any event of the stream, a ping included. */
    heard(): void;
    /** A piece of the text of the thinking block now open, as the API streams it. */
    thinkingDelta(text: string): void;
}
/** Whether the history holds a thinking block written by a model other than `model`: after the
 *  person changes the model, earlier reasoning cannot be carried over. */
export declare function holdsOtherThinking(messages: MessageParam[], producers: Producers, model: ModelId): boolean;
/** The thinking blocks a response reports as dropped from its request: the `thinking_dropped`
 *  entries of its `input_transformations`. A `thinking_mismatch_allowed` entry is a block the model
 *  was shown unchanged, so it dropped nothing. */
export declare function droppedThinking(message: FinalMessage): DroppedBlock[];
/** The request for one step. Where the history holds another model's thinking, the request sets the
 *  binding to drop such blocks, so a change of model never ends the conversation with an error. */
export declare function requestParams<Tool>(config: LoopConfig<Tool>, model: ModelId, messages: MessageParam[], effort?: Effort, producers?: Producers): RequestParams<Tool>;
/** The view a turn reports to while its conversation is the open one. A report that arrives after
 *  the person has moved on is dropped, and a text handle asked for then is -1. `isCurrent` is read at
 *  each report, so a report made after an await is checked against the conversation as it is then. */
export declare function currentView(view: LoopView, isCurrent: () => boolean): LoopView;
export interface Turn<Tool = unknown> {
    api: MessagesApi<Tool>;
    model: ModelId;
    effort?: Effort;
    /** The settings every request of the session carries. */
    request: LoopConfig<Tool>;
    /** Which model wrote each assistant message; the turn records the ones it adds. */
    producers?: Producers;
    /** The conversation so far; the turn appends to it. */
    history: MessageParam[];
    /** The handlers, by tool name. A call with no handler is answered as having no tool. */
    tools: Record<string, ToolHandler>;
    view: LoopView;
    signal: AbortSignal;
    /** Whether the conversation the turn belongs to is still the open one. Absent, it always is. */
    isCurrent?: () => boolean;
}
/** Run one turn: the person's text, then as many steps as the model takes until it stops. */
export declare function runTurn<Tool>(text: string, turn: Turn<Tool>): Promise<void>;
