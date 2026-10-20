/* The API loop between an assistant panel and the API it calls. Framework-free: no SDK, no Vue, so
 * the loop runs under any test runner against a scripted stream.
 *
 * One request per assistant step, streamed. The loop reads `stop_reason` before acting: `tool_use`
 * runs every tool of the step and sends all their results back in one user message; `end_turn` ends
 * the turn; `max_tokens` ends it marked as cut short; `refusal` ends it as the API's refusal. Any
 * other reason is reported once and acts on nothing. The history only grows: each assistant message
 * goes back whole, thinking blocks included.
 *
 * WHAT IS HERE AND WHAT IS NOT. The app supplies the SDK client as a MessagesApi, the system prompt,
 * the tool definitions and handlers, and the request settings as a LoopConfig. The types below are
 * the parts of the SDK's shapes this loop reads or writes; the app casts its client to them, so the
 * kit imports no SDK. */
import { EFFORT, type Effort, type ModelId, type UsageLike } from './models'

// ---- the shapes the loop reads and writes -------------------------------------------------------

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
  signature: string
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking'
  data: string
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

/** A block of a message. The API may add block types; the app's cast passes them through unread. */
export type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock | RedactedThinkingBlock | ToolResultBlock

export interface MessageParam {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

/** One event of the stream. The loop reads the block starts and the deltas of text and thinking. */
export interface StreamEvent {
  type: string
  index?: number
  content_block?: { type: string; id?: string; name?: string }
  delta?: { type: string; text?: string; thinking?: string }
}

/** A change the API made to a request's history on its way in. */
export interface InputTransformation {
  type: string
  path?: string
  reason?: string
}

/** A response once the stream has ended. */
export interface FinalMessage {
  content: ContentBlock[]
  stop_reason: string | null
  stop_details?: { category?: string | null } | null
  usage: UsageLike
  input_transformations?: InputTransformation[] | null
}

export interface StreamLike extends AsyncIterable<StreamEvent> {
  finalMessage(): Promise<FinalMessage>
  abort(): void
}

/** The settings every request of a session carries, as the app states them. The kit builds the
 *  request's shape from these and the per-request values. */
export interface LoopConfig<Tool = unknown> {
  /** The system prompt. The one cache breakpoint goes at its end, after the tools. */
  system: string
  tools: Tool[]
  /** The beta names the request sends. */
  betas: string[]
  /** How the API returns a thinking block, by the name the API gives it. */
  thinkingDisplay: string
  /** The binding setting for a request whose history holds no thinking from another model. */
  prefixMismatch: 'error' | 'drop_block'
  maxTokens: number
}

/** The request the loop sends: the shape the SDK's streaming call takes. */
export interface RequestParams<Tool = unknown> {
  model: ModelId
  max_tokens: number
  system: { type: 'text'; text: string; cache_control: { type: 'ephemeral' } }[]
  tools: Tool[]
  tool_choice: { type: 'auto' }
  thinking: { type: 'adaptive'; display: string; block_binding: { prefix_mismatch_behavior: 'error' | 'drop_block' } }
  output_config: { effort: Effort }
  betas: string[]
  messages: MessageParam[]
}

/** The client the loop calls. The app's client is the SDK's, cast to this shape. */
export interface MessagesApi<Tool = unknown> {
  /** Starts one streamed request. A throw here fails the request, as a stream that errors does. */
  stream(params: RequestParams<Tool>): StreamLike
}

/** What a tool handler returns: its status, optionally a kind the loop sets, and a text. */
export interface ToolOutput {
  status: string
  kind?: string
  text?: string
}

export type ToolHandler = (input: Record<string, unknown>, callId: string) => Promise<ToolOutput> | ToolOutput

/** What the turn is doing: waiting for the API, writing text, thinking, preparing a call to a tool,
 *  or running one. */
export type Phase =
  | { kind: 'waiting' }
  | { kind: 'writing' }
  | { kind: 'thinking' }
  | { kind: 'calling'; tool: string }
  | { kind: 'running'; tool: string }

/** Which model wrote each assistant message of a history, recorded beside it by the loop. */
export type Producers = WeakMap<MessageParam, ModelId>

/** A thinking block the API dropped from a request: where it was, as `messages.{i}.content.{j}`, and
 *  the binding check that dropped it. */
export interface DroppedBlock {
  path: string
  reason: string
}

/** What the loop reports to the panel as a turn unfolds. */
export interface LoopView {
  /** A text block began streaming; returns the handle its deltas and end refer to. */
  textStart(): number
  textDelta(handle: number, text: string): void
  /** The block settled with its whole text. */
  textEnd(handle: number, text: string, model: ModelId): void
  toolStart(callId: string, name: string): void
  toolEnd(callId: string, name: string, output: ToolOutput): void
  /** The answer hit the length limit. */
  cutShort(): void
  /** The API declined; `category` is `stop_details.category` when the response carries one. */
  apiRefusal(category: string | null): void
  /** The request itself failed: the network, the key, the API. The text is the error's own message,
   *  unredacted: the view removes the key from it before it shows the text. */
  requestFailed(text: string): void
  /** The person pressed Stop. */
  stopped(): void
  /** The API dropped a thinking block from the request, as the response reports it. */
  thinkingDropped(block: DroppedBlock): void
  /** A request is about to go with another model's thinking in its history. */
  otherThinking(model: ModelId): void
  /** One response's token counts, exactly as its `usage` reports them. */
  usage(usage: UsageLike, model: ModelId): void
  /** The model stopped for a reason the panel does not act on. */
  stoppedFor(reason: string): void
  /** The turn moved to another phase. The loop reports `waiting` just before each request is sent. */
  phase(phase: Phase): void
  /** The API sent something: any event of the stream, a ping included. The app sets the panel's
   *  `heardAt` at the send, at each `waiting` phase and at each of these reports; the quiet notice
   *  counts from it. */
  heard(): void
  /** A piece of the text of the thinking block now open, as the API streams it. */
  thinkingDelta(text: string): void
}

// ---- requests ----------------------------------------------------------------------------------

/** Whether the history holds a thinking block written by a model other than `model`: after the
 *  person changes the model, earlier reasoning cannot be carried over. */
export function holdsOtherThinking(messages: MessageParam[], producers: Producers, model: ModelId): boolean {
  return messages.some(
    (m) => m.role === 'assistant' && producers.get(m) !== model && Array.isArray(m.content) && m.content.some((b) => b.type === 'thinking' || b.type === 'redacted_thinking'),
  )
}

/** The thinking blocks a response reports as dropped from its request: the `thinking_dropped`
 *  entries of its `input_transformations`. A `thinking_mismatch_allowed` entry is a block the model
 *  was shown unchanged, so it dropped nothing. */
export function droppedThinking(message: FinalMessage): DroppedBlock[] {
  return (message.input_transformations ?? []).flatMap((t) => (t.type === 'thinking_dropped' && t.path !== undefined && t.reason !== undefined ? [{ path: t.path, reason: t.reason }] : []))
}

/** The request for one step. Where the history holds another model's thinking, the request sets the
 *  binding to drop such blocks, so a change of model never ends the conversation with an error. */
export function requestParams<Tool>(
  config: LoopConfig<Tool>,
  model: ModelId,
  messages: MessageParam[],
  effort: Effort = EFFORT,
  producers?: Producers,
): RequestParams<Tool> {
  const mismatch = producers && holdsOtherThinking(messages, producers, model) ? 'drop_block' : config.prefixMismatch
  return {
    model,
    max_tokens: config.maxTokens,
    // the one cache breakpoint: the end of the system prompt, after the tools it renders behind
    system: [{ type: 'text', text: config.system, cache_control: { type: 'ephemeral' } }],
    tools: config.tools,
    tool_choice: { type: 'auto' },
    thinking: { type: 'adaptive', display: config.thinkingDisplay, block_binding: { prefix_mismatch_behavior: mismatch } },
    output_config: { effort },
    betas: config.betas,
    messages,
  }
}

// ---- the turn ----------------------------------------------------------------------------------

/** The view a turn reports to while its conversation is the open one. A report that arrives after
 *  the person has moved on is dropped, and a text handle asked for then is -1. `isCurrent` is read at
 *  each report, so a report made after an await is checked against the conversation as it is then. */
export function currentView(view: LoopView, isCurrent: () => boolean): LoopView {
  return {
    textStart: () => (isCurrent() ? view.textStart() : -1),
    textDelta: (handle, text) => {
      if (isCurrent()) view.textDelta(handle, text)
    },
    textEnd: (handle, text, model) => {
      if (isCurrent()) view.textEnd(handle, text, model)
    },
    toolStart: (callId, name) => {
      if (isCurrent()) view.toolStart(callId, name)
    },
    toolEnd: (callId, name, output) => {
      if (isCurrent()) view.toolEnd(callId, name, output)
    },
    cutShort: () => {
      if (isCurrent()) view.cutShort()
    },
    apiRefusal: (category) => {
      if (isCurrent()) view.apiRefusal(category)
    },
    requestFailed: (text) => {
      if (isCurrent()) view.requestFailed(text)
    },
    stopped: () => {
      if (isCurrent()) view.stopped()
    },
    thinkingDropped: (block) => {
      if (isCurrent()) view.thinkingDropped(block)
    },
    otherThinking: (model) => {
      if (isCurrent()) view.otherThinking(model)
    },
    usage: (usage, model) => {
      if (isCurrent()) view.usage(usage, model)
    },
    stoppedFor: (reason) => {
      if (isCurrent()) view.stoppedFor(reason)
    },
    phase: (phase) => {
      if (isCurrent()) view.phase(phase)
    },
    heard: () => {
      if (isCurrent()) view.heard()
    },
    thinkingDelta: (text) => {
      if (isCurrent()) view.thinkingDelta(text)
    },
  }
}

export interface Turn<Tool = unknown> {
  api: MessagesApi<Tool>
  model: ModelId
  effort?: Effort
  /** The settings every request of the session carries. */
  request: LoopConfig<Tool>
  /** Which model wrote each assistant message; the turn records the ones it adds. */
  producers?: Producers
  /** The conversation so far; the turn appends to it. */
  history: MessageParam[]
  /** The handlers, by tool name. A call with no handler is answered as having no tool. */
  tools: Record<string, ToolHandler>
  view: LoopView
  signal: AbortSignal
  /** Whether the conversation the turn belongs to is still the open one. Absent, it always is. */
  isCurrent?: () => boolean
}

const ABORTED: ToolOutput = { status: 'failed', kind: 'aborted', text: 'The person pressed Stop before this tool returned.' }
const NOT_RUN: ToolOutput = { status: 'failed', kind: 'not_run', text: 'The answer ended before this tool ran.' }

/** A history is valid only when each tool call is answered in the next user message. The answer
 *  stopped before these calls ran (the length limit, a refusal, a reason the panel does not act on),
 *  so each is answered as not run and the person's next message can follow. */
function answerNotRun(message: FinalMessage, history: MessageParam[]): void {
  const calls = message.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
  if (calls.length === 0) return
  history.push({ role: 'user', content: calls.map((b) => ({ type: 'tool_result' as const, tool_use_id: b.id, is_error: true, content: JSON.stringify(NOT_RUN) })) })
}

async function runTools(blocks: ToolUseBlock[], turn: Turn<unknown>, view: LoopView): Promise<ToolResultBlock[]> {
  // one call after another: a call that takes the next id the session holds must not read the same
  // count as the call before it
  const results: ToolResultBlock[] = []
  for (const b of blocks) {
    // a Stop between two calls leaves the later ones unrun
    if (turn.signal.aborted) {
      view.toolEnd(b.id, b.name, ABORTED)
      results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(ABORTED) })
      continue
    }
    const handler = turn.tools[b.name]
    view.phase({ kind: 'running', tool: b.name })
    let out: ToolOutput
    try {
      out = handler ? await handler(b.input as Record<string, unknown>, b.id) : { status: 'none', text: `There is no tool named ${b.name}.` }
    } catch (e) {
      out = { status: 'failed', kind: 'crash', text: e instanceof Error ? e.message : String(e) }
    }
    if (turn.signal.aborted) out = ABORTED
    view.toolEnd(b.id, b.name, out)
    results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) })
  }
  return results
}

/** Run one turn: the person's text, then as many steps as the model takes until it stops. */
export async function runTurn<Tool>(text: string, turn: Turn<Tool>): Promise<void> {
  const { api, history, signal } = turn
  const view = currentView(turn.view, turn.isCurrent ?? (() => true))
  const producers = turn.producers ?? new WeakMap<MessageParam, ModelId>()
  history.push({ role: 'user', content: text })
  for (;;) {
    if (signal.aborted) return view.stopped()
    if (holdsOtherThinking(history, producers, turn.model)) view.otherThinking(turn.model)
    const handles = new Map<number, number>()
    /** The tool cards this step opened, closed as failed when the step ends without running them. */
    const opened = new Map<string, string>()
    const closeOpened = (out: ToolOutput) => opened.forEach((name, id) => view.toolEnd(id, name, out))
    let message: FinalMessage
    let stream: StreamLike | null = null
    const onAbort = () => stream?.abort()
    signal.addEventListener('abort', onAbort)
    try {
      // inside the try, so a client that throws as the request is made fails the request
      view.phase({ kind: 'waiting' })
      stream = api.stream(requestParams(turn.request, turn.model, history, turn.effort, producers))
      for await (const event of stream) {
        view.heard()
        if (event.type === 'content_block_start' && event.content_block) {
          const block = event.content_block
          if (block.type === 'text') {
            handles.set(event.index ?? -1, view.textStart())
            view.phase({ kind: 'writing' })
          } else if (block.type === 'tool_use' && block.id !== undefined && block.name !== undefined) {
            opened.set(block.id, block.name)
            view.toolStart(block.id, block.name)
            view.phase({ kind: 'calling', tool: block.name })
          } else if (block.type === 'thinking' || block.type === 'redacted_thinking') view.phase({ kind: 'thinking' })
        } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const h = handles.get(event.index ?? -1)
          if (h !== undefined && event.delta.text !== undefined) view.textDelta(h, event.delta.text)
        } else if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta.thinking) view.thinkingDelta(event.delta.thinking)
      }
      message = await stream.finalMessage()
    } catch (e) {
      closeOpened(signal.aborted ? ABORTED : NOT_RUN)
      if (signal.aborted) return view.stopped()
      return view.requestFailed(e instanceof Error ? e.message : String(e))
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
    view.usage(message.usage, turn.model)
    for (const block of droppedThinking(message)) view.thinkingDropped(block)
    const reply: MessageParam = { role: 'assistant', content: message.content }
    producers.set(reply, turn.model)
    history.push(reply)
    message.content.forEach((block, i) => {
      if (block.type === 'text') view.textEnd(handles.get(i) ?? view.textStart(), block.text, turn.model)
    })
    if (message.stop_reason !== 'tool_use') answerNotRun(message, history)
    switch (message.stop_reason) {
      case 'tool_use': {
        const calls = message.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
        history.push({ role: 'user', content: await runTools(calls, turn, view) })
        continue
      }
      case 'max_tokens':
        closeOpened(NOT_RUN)
        return view.cutShort()
      case 'refusal':
        closeOpened(NOT_RUN)
        return view.apiRefusal(message.stop_details?.category ?? null)
      case 'end_turn':
        closeOpened(NOT_RUN)
        return
      default:
        // a reason the panel does not act on: the context window reached, a paused turn, a stop sequence
        closeOpened(NOT_RUN)
        return view.stoppedFor(String(message.stop_reason))
    }
  }
}
