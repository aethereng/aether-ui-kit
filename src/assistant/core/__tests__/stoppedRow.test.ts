// A response a Stop cuts short is counted from what the API had reported of it before the stop: the input
// and cache counts of message_start, and the output count of the last message_delta. With no message_delta
// the output count is a lower bound. The loop reads the events in place. No test here reaches an API.
import { describe, expect, it } from 'vitest'
import { runTurn, type LoopConfig, type LoopView, type StoppedCount, type StreamEvent, type ToolHandler, type ToolOutput } from '../loop'
import { message, scriptedApi, type Block } from './loopHarness'

const CONFIG: LoopConfig = {
  system: 'The system prompt, as the app passes it.',
  tools: [],
  betas: ['thinking-binding-test'],
  thinkingDisplay: 'summarized',
  prefixMismatch: 'error',
  maxTokens: 64000,
}

const FIRST = { input: 1200, output: 1, cacheRead: 5000, cacheWrite: 800, cacheWrite1h: 0 }
const started = (): StreamEvent => ({
  type: 'message_start',
  message: { usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 5000, cache_creation_input_tokens: 800, cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 800 } } },
})
const delta = (output: number): StreamEvent => ({ type: 'message_delta', usage: { output_tokens: output } })
const textStart: StreamEvent = { type: 'content_block_start', index: 0, content_block: { type: 'text' } }
const words = (text: string): StreamEvent => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })

/** A view that records what the loop reports. `onHeard` sees each event's count as the loop receives it. */
function recording(onHeard: (count: number) => void = () => {}) {
  const log: string[] = []
  const counted: StoppedCount[] = []
  const finished: number[] = []
  const cards: string[] = []
  let heard = 0
  const view: LoopView & { log: string[]; counted: StoppedCount[]; finished: number[]; cards: string[] } = {
    log,
    counted,
    finished,
    cards,
    textStart: () => 0,
    textDelta: () => {},
    textEnd: () => {},
    toolStart: (id) => log.push(`toolStart ${id}`),
    toolEnd: (id, _name, out: ToolOutput) => cards.push(`${id} ${out.status}${out.status === 'failed' ? ' ' + out.kind : ''}`),
    cutShort: () => log.push('cutShort'),
    apiRefusal: () => log.push('apiRefusal'),
    requestFailed: (t) => log.push(`requestFailed ${t}`),
    stopped: () => log.push('stopped'),
    thinkingDropped: () => {},
    otherThinking: () => {},
    usage: (u) => finished.push(u.input_tokens),
    stoppedUsage: (c) => counted.push(c),
    stoppedFor: (r) => log.push(`stoppedFor ${r}`),
    thinkingDelta: () => {},
    phase: () => {},
    heard: () => {
      heard += 1
      onHeard(heard)
    },
  }
  return view
}

const calls = (...ids: string[]): Block[] => ids.map((id) => ({ type: 'tool_use', id, name: 'read_model', input: {} }))
const solved = async (): Promise<ToolOutput> => ({ status: 'solved' })

describe('a Stop in the middle of a reply', () => {
  it('counts the response in its own row from message_start, the output count a lower bound', async () => {
    const controller = new AbortController()
    const view = recording((n) => (n === 3 ? controller.abort() : undefined))
    const { api } = scriptedApi([{ events: [started(), textStart, words('The model is a')], message: message([], 'end_turn') }])
    await runTurn('Describe the model.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: {}, view, signal: controller.signal })
    expect(view.counted).toEqual([{ tokens: FIRST, lowerBound: true }])
    expect(view.finished).toEqual([])
    expect(view.log[view.log.length - 1]).toBe('stopped')
  })

  it('takes the output count of the last message_delta, and then calls it no lower bound', async () => {
    const controller = new AbortController()
    const view = recording((n) => (n === 2 ? controller.abort() : undefined))
    const { api } = scriptedApi([{ events: [started(), delta(340)], message: message([], 'end_turn') }])
    await runTurn('Describe the model.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: {}, view, signal: controller.signal })
    expect(view.counted).toEqual([{ tokens: { ...FIRST, output: 340 }, lowerBound: false }])
  })

  it('negative arm: counts nothing when the API had reported nothing of the response', async () => {
    const controller = new AbortController()
    const view = recording((n) => (n === 1 ? controller.abort() : undefined))
    const { api } = scriptedApi([{ events: [{ type: 'ping' }], message: message([], 'end_turn') }])
    await runTurn('Describe the model.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: {}, view, signal: controller.signal })
    expect(view.counted).toEqual([])
    expect(view.log).toEqual(['stopped'])
  })
})

describe('a Stop after an earlier response of the turn', () => {
  it('keeps the finished response as a finished one, and gives the stopped one its own count', async () => {
    const controller = new AbortController()
    const view = recording((n) => (n === 2 ? controller.abort() : undefined))
    const tools: Record<string, ToolHandler> = { read_model: async () => ({ status: 'none', text: 'no model is loaded' }) }
    const { api } = scriptedApi([
      { events: [], message: message(calls('c1'), 'tool_use') },
      { events: [started(), textStart], message: message([], 'end_turn') },
    ])
    await runTurn('What is loaded?', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools, view, signal: controller.signal })
    expect(view.finished).toEqual([1])
    expect(view.counted).toEqual([{ tokens: FIRST, lowerBound: true }])
  })

  it('counts a response that finished once, when the Stop comes while a tool runs', async () => {
    const controller = new AbortController()
    const view = recording()
    const tools: Record<string, ToolHandler> = {
      read_model: async () => {
        controller.abort()
        return { status: 'none', text: 'no model is loaded' }
      },
    }
    const { api } = scriptedApi([{ events: [started()], message: message(calls('c1'), 'tool_use') }])
    await runTurn('What is loaded?', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools, view, signal: controller.signal })
    expect(view.finished).toEqual([1])
    expect(view.counted).toEqual([])
    expect(view.log).toEqual(['stopped'])
  })
})

describe('a new conversation begun while a reply streams', () => {
  it('leaves a conversation no longer open without a count or a stop for the old reply', async () => {
    const controller = new AbortController()
    let open = true
    const view = recording((n) => {
      if (n === 2) {
        open = false
        controller.abort()
      }
    })
    const { api } = scriptedApi([{ events: [started(), textStart, words('Old reply')], message: message([], 'end_turn') }])
    await runTurn('Describe the model.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: {}, view, signal: controller.signal, isCurrent: () => open })
    expect(view.counted).toEqual([])
    expect(view.log).toEqual([])
  })
})

describe('the card of a tool a Stop left unrun', () => {
  it('closes as failed with the kind aborted, for the tool the Stop interrupted and for the one it kept from running', async () => {
    const controller = new AbortController()
    const view = recording()
    const tools: Record<string, ToolHandler> = {
      read_model: async () => {
        controller.abort()
        return solved()
      },
    }
    const { api } = scriptedApi([{ events: [], message: message(calls('c1', 'c2'), 'tool_use') }])
    await runTurn('Load two.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools, view, signal: controller.signal })
    expect(view.cards).toEqual(['c1 failed aborted', 'c2 failed aborted'])
    expect(view.counted).toEqual([])
  })

  it('leaves both cards done when no Stop comes', async () => {
    const controller = new AbortController()
    const view = recording()
    const tools: Record<string, ToolHandler> = { read_model: solved }
    const { api } = scriptedApi([{ events: [], message: message(calls('c1', 'c2'), 'tool_use') }, { events: [], message: message([], 'end_turn') }])
    await runTurn('Load two.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools, view, signal: controller.signal })
    expect(view.cards).toEqual(['c1 solved', 'c2 solved'])
    expect(view.log).toEqual([])
  })
})
