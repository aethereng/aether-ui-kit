// A scripted stand-in for the client's message stream: each request gets the next scripted response,
// and every request's parameters are kept as sent. No test reaches an API.
import type { ContentBlock, FinalMessage, MessageParam, MessagesApi, RequestParams, StreamEvent } from '../loop'

export interface Scripted {
  events: StreamEvent[]
  message: FinalMessage
}

export function scriptedApi(responses: Scripted[]): { api: MessagesApi; requests: RequestParams[]; aborts: () => number } {
  const requests: RequestParams[] = []
  let next = 0
  let aborts = 0
  const api: MessagesApi = {
    stream(params) {
      requests.push(structuredClone(params))
      const r = responses[next++]
      if (!r) throw new Error('the script has no response left')
      let aborted = false
      return {
        async *[Symbol.asyncIterator]() {
          for (const e of r.events) {
            await Promise.resolve()
            if (aborted) throw new Error('Request was aborted.')
            yield e
          }
        },
        async finalMessage() {
          if (aborted) throw new Error('Request was aborted.')
          return r.message
        },
        abort() {
          aborted = true
          aborts += 1
        },
      }
    },
  }
  return { api, requests, aborts: () => aborts }
}

export type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } | { type: 'thinking'; thinking: string; signature: string }

export function message(content: Block[], stop_reason: string, category: string | null = null): FinalMessage {
  return {
    content: content as ContentBlock[],
    stop_reason,
    stop_details: stop_reason === 'refusal' ? { category } : null,
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: null, cache_creation_input_tokens: null, cache_creation: null },
  }
}

/** The events a response streams: each text block in pieces, each tool call opened. */
export function eventsFor(content: Block[]): StreamEvent[] {
  const out: StreamEvent[] = []
  content.forEach((b, index) => {
    if (b.type === 'text') {
      out.push({ type: 'content_block_start', index, content_block: { type: 'text' } })
      for (const piece of b.text.match(/.{1,7}/gs) ?? []) out.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } })
    } else if (b.type === 'tool_use') {
      out.push({ type: 'content_block_start', index, content_block: { type: 'tool_use', id: b.id, name: b.name } })
    } else out.push({ type: 'content_block_start', index, content_block: { type: 'thinking' } })
    out.push({ type: 'content_block_stop', index })
  })
  return out
}

export function respond(content: Block[], stop_reason: string, category: string | null = null): Scripted {
  return { events: eventsFor(content), message: message(content, stop_reason, category) }
}

/** The tool calls in a history that the user message after them does not answer. A request whose
 *  history has any is refused: each tool_use needs a tool_result in the next message. */
export function unansweredToolCalls(messages: MessageParam[]): string[] {
  const open: string[] = []
  messages.forEach((m, i) => {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) return
    const next = messages[i + 1]
    const answered = new Set(next && next.role === 'user' && Array.isArray(next.content) ? next.content.flatMap((b) => (b.type === 'tool_result' ? [b.tool_use_id] : [])) : [])
    for (const b of m.content) if (b.type === 'tool_use' && !answered.has(b.id)) open.push(b.id)
  })
  return open
}
