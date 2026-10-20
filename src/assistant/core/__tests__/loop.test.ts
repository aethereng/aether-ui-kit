// The API loop against a scripted stream: what every request carries, each stop reason, Stop, the
// calls a stop leaves unrun, the usage each response reports, and the thinking the API drops or
// returns. No test here reaches an API.
import { describe, expect, it, vi } from 'vitest'
import { currentView, droppedThinking, holdsOtherThinking, requestParams, runTurn, type FinalMessage, type LoopConfig, type LoopView, type MessageParam, type Phase, type Producers, type StreamEvent, type ToolHandler, type ToolOutput } from '../loop'
import { EFFORT, MODELS, type ModelId } from '../models'
import { respond, scriptedApi, unansweredToolCalls } from './loopHarness'

const CONFIG: LoopConfig = {
  system: 'The system prompt, as the app passes it.',
  tools: [],
  betas: ['thinking-binding-test'],
  thinkingDisplay: 'summarized',
  prefixMismatch: 'error',
  maxTokens: 64000,
}

const NO_TOOLS: Record<string, ToolHandler> = {}

function recorder(): LoopView & { log: string[]; texts: Map<number, string>; usages: string[]; phases: Phase[]; thoughts: string[]; heards: () => number } {
  const log: string[] = []
  const phases: Phase[] = []
  const thoughts: string[] = []
  let heard = 0
  const usages: string[] = []
  const texts = new Map<number, string>()
  let n = 0
  return {
    log,
    texts,
    usages,
    phases,
    thoughts,
    heards: () => heard,
    textStart: () => {
      texts.set(n, '')
      log.push(`textStart ${n}`)
      return n++
    },
    textDelta: (h, t) => texts.set(h, (texts.get(h) ?? '') + t),
    textEnd: (h, t) => log.push(`textEnd ${h} ${t === texts.get(h) ? 'whole' : 'differs'}`),
    toolStart: (id, name) => log.push(`toolStart ${id} ${name}`),
    toolEnd: (id, _n, out) => log.push(`toolEnd ${id} ${out.status}`),
    cutShort: () => log.push('cutShort'),
    apiRefusal: (c) => log.push(`apiRefusal ${c}`),
    requestFailed: (t) => log.push(`requestFailed ${t}`),
    stopped: () => log.push('stopped'),
    thinkingDropped: (b) => log.push(`thinkingDropped ${b.path} ${b.reason}`),
    otherThinking: (m) => log.push(`otherThinking ${m}`),
    usage: (u, m) => usages.push(`usage ${m} ${u.input_tokens}`),
    stoppedFor: (r) => log.push(`stoppedFor ${r}`),
    thinkingDelta: (t) => thoughts.push(t),
    phase: (p) => phases.push(p),
    heard: () => void (heard += 1),
  }
}

/** The phases as the tests name them: a kind, and the tool for a call or a run. */
const names = (phases: Phase[]) => phases.map((p) => ('tool' in p ? `${p.kind} ${p.tool}` : p.kind))

describe('what every request carries', () => {
  const params = requestParams(CONFIG, 'claude-opus-5-5', [{ role: 'user', content: 'hello' }])

  it('sends the system prompt the app passes, with the one cache breakpoint at its end', () => {
    expect(params.system).toEqual([{ type: 'text', text: CONFIG.system, cache_control: { type: 'ephemeral' } }])
    expect(JSON.stringify(params).split('"cache_control"').length - 1, `cache breakpoints in the request`).toBe(1)
  })

  it('names the model, adaptive thinking with its binding setting, effort and automatic tool choice', () => {
    expect(params.model).toBe('claude-opus-5-5')
    expect(requestParams(CONFIG, 'claude-sonnet-5-5', []).model).toBe('claude-sonnet-5-5')
    expect(params.thinking).toEqual({ type: 'adaptive', display: 'summarized', block_binding: { prefix_mismatch_behavior: 'error' } })
    expect(params.output_config).toEqual({ effort: EFFORT })
    expect(EFFORT).toBe('medium')
    expect(params.tool_choice).toEqual({ type: 'auto' })
    expect(params.betas).toEqual(CONFIG.betas)
    expect(params).not.toHaveProperty('fallbacks')
  })
})

describe('a turn', () => {
  it('streams a text as it grows and settles it whole', async () => {
    const { api } = scriptedApi([respond([{ type: 'text', text: 'First question, in one line.' }], 'end_turn')])
    const view = recorder()
    const history: MessageParam[] = []
    await runTurn('A first request.', { api, model: 'claude-opus-5-5', request: CONFIG, history, tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.log).toEqual(['textStart 0', 'textEnd 0 whole'])
    expect(view.texts.get(0)).toBe('First question, in one line.')
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant'])
  })

  it('runs every tool of a step and sends all the results back in one user message, thinking kept', async () => {
    const thinking = { type: 'thinking' as const, thinking: '', signature: 'sig' }
    const { api, requests } = scriptedApi([
      respond([thinking, { type: 'tool_use', id: 'c1', name: 'read_model', input: { path: null } }, { type: 'tool_use', id: 'c2', name: 'replay', input: { run: 'r1' } }], 'tool_use'),
      respond([{ type: 'text', text: 'Nothing is loaded yet.' }], 'end_turn'),
    ])
    const view = recorder()
    const seen: string[] = []
    const tools: Record<string, ToolHandler> = {
      read_model: async (input, id): Promise<ToolOutput> => (seen.push(`${id} ${JSON.stringify(input)}`), { status: 'none', text: 'no model is loaded' }),
    }
    await runTurn('What is loaded?', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools, view, signal: new AbortController().signal })
    expect(seen).toEqual(['c1 {"path":null}'])
    expect(requests).toHaveLength(2)
    const sent = requests[1]!.messages
    expect(sent[1]).toMatchObject({ role: 'assistant', content: [thinking, { id: 'c1' }, { id: 'c2' }] })
    const results = sent[2]!
    expect(sent).toHaveLength(3)
    expect(results.role).toBe('user')
    expect(results.content).toEqual([
      { type: 'tool_result', tool_use_id: 'c1', content: JSON.stringify({ status: 'none', text: 'no model is loaded' }) },
      { type: 'tool_result', tool_use_id: 'c2', content: JSON.stringify({ status: 'none', text: 'There is no tool named replay.' }) },
    ])
    expect(view.log).toEqual(['toolStart c1 read_model', 'toolStart c2 replay', 'toolEnd c1 none', 'toolEnd c2 none', 'textStart 0', 'textEnd 0 whole'])
  })

  it('marks an answer cut short at the length limit and runs nothing', async () => {
    const { api } = scriptedApi([respond([{ type: 'text', text: 'The first part is' }], 'max_tokens')])
    const view = recorder()
    await runTurn('Go on.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.log).toEqual(['textStart 0', 'textEnd 0 whole', 'cutShort'])
  })

  it("shows the API declining as the API's refusal with its category, runs no tool and closes its card", async () => {
    const { api } = scriptedApi([respond([{ type: 'tool_use', id: 'c1', name: 'solve', input: {} }], 'refusal', 'cyber')])
    const view = recorder()
    const solve = vi.fn<ToolHandler>(async () => ({ status: 'solved' }))
    await runTurn('Solve it.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: { solve }, view, signal: new AbortController().signal })
    expect(view.log).toEqual(['toolStart c1 solve', 'toolEnd c1 failed', 'apiRefusal cyber'])
    expect(solve).not.toHaveBeenCalled()
  })

  it('ends on Stop: the stream is aborted and the turn ends with the stopped notice', async () => {
    const { api, aborts } = scriptedApi([respond([{ type: 'text', text: 'A long answer that is still arriving when the person stops it.' }], 'end_turn')])
    const view = recorder()
    const controller = new AbortController()
    const run = runTurn('Explain.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view: { ...view, textDelta: (h, t) => (view.textDelta(h, t), controller.abort()) }, signal: controller.signal })
    await run
    expect(aborts()).toBe(1)
    expect(view.log[view.log.length - 1]).toBe('stopped')
  })

  it('closes a tool card the stream opened when Stop ends the stream, with the aborted kind', async () => {
    const { api } = scriptedApi([respond([{ type: 'tool_use', id: 'c1', name: 'solve', input: {} }, { type: 'text', text: 'and then a long text that is still arriving' }], 'tool_use')])
    const view = recorder()
    const ends: ToolOutput[] = []
    const controller = new AbortController()
    const solve = vi.fn<ToolHandler>(async () => ({ status: 'solved' }))
    await runTurn('Solve it.', {
      api,
      model: 'claude-opus-5-5',
      request: CONFIG,
      history: [],
      tools: { solve },
      view: { ...view, textDelta: (h, t) => (view.textDelta(h, t), controller.abort()), toolEnd: (id, n, out) => (view.toolEnd(id, n, out), ends.push(out)) },
      signal: controller.signal,
    })
    expect(view.log.filter((l) => l.startsWith('tool') || l === 'stopped')).toEqual(['toolStart c1 solve', 'toolEnd c1 failed', 'stopped'])
    expect(ends).toEqual([expect.objectContaining({ kind: 'aborted' })])
    expect(solve).not.toHaveBeenCalled()
  })

  it('answers a stop during a tool with the aborted kind for every call, so the next request is whole', async () => {
    const controller = new AbortController()
    const { api, requests } = scriptedApi([respond([{ type: 'tool_use', id: 'c1', name: 'solve', input: {} }], 'tool_use')])
    const history: MessageParam[] = []
    const solve = async (): Promise<ToolOutput> => (controller.abort(), { status: 'solved' })
    await runTurn('Solve it.', { api, model: 'claude-opus-5-5', request: CONFIG, history, tools: { solve }, view: recorder(), signal: controller.signal })
    expect(requests).toHaveLength(1)
    expect(history[history.length - 1]).toMatchObject({ role: 'user', content: [{ tool_use_id: 'c1', content: expect.stringContaining('"kind":"aborted"') }] })
  })
})

describe('a client that throws as the request is made', () => {
  it('fails the request, with the error shown, and leaves the turn', async () => {
    const view = recorder()
    const api = { stream: (): never => { throw new Error('the client could not be built') } }
    await runTurn('Hi.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.log).toEqual(['requestFailed the client could not be built'])
  })
})

describe('Stop between the calls of a step, and a stop reason the panel does not act on', () => {
  it('runs no call after a Stop, and closes its card as aborted', async () => {
    const controller = new AbortController()
    const { api } = scriptedApi([respond([{ type: 'tool_use', id: 'c1', name: 'solve', input: {} }, { type: 'tool_use', id: 'c2', name: 'propose_model', input: { model: '{}' } }], 'tool_use')])
    const view = recorder()
    const solve = async (): Promise<ToolOutput> => (controller.abort(), { status: 'solved' })
    const second = vi.fn<ToolHandler>(async () => ({ status: 'pending' }))
    await runTurn('Solve, then propose.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: { solve, propose_model: second }, view, signal: controller.signal })
    expect(second).not.toHaveBeenCalled()
    expect(view.log).toContain('toolEnd c2 failed')
  })

  it('runs both calls of the same step, and sends both results in one message, when no Stop comes', async () => {
    const { api, requests } = scriptedApi([
      respond([{ type: 'tool_use', id: 'c1', name: 'solve', input: {} }, { type: 'tool_use', id: 'c2', name: 'propose_model', input: { model: '{}' } }], 'tool_use'),
      respond([{ type: 'text', text: 'Done.' }], 'end_turn'),
    ])
    const solve = vi.fn<ToolHandler>(async () => ({ status: 'solved' }))
    const second = vi.fn<ToolHandler>(async () => ({ status: 'pending' }))
    await runTurn('Solve, then propose.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: { solve, propose_model: second }, view: recorder(), signal: new AbortController().signal })
    expect([solve.mock.calls.length, second.mock.calls.length]).toEqual([1, 1])
    expect(requests[1]!.messages[2]).toMatchObject({ role: 'user', content: [{ tool_use_id: 'c1' }, { tool_use_id: 'c2' }] })
  })

  it('shows one notice for a stop reason other than the four it acts on', async () => {
    const { api } = scriptedApi([respond([{ type: 'text', text: 'Partly.' }], 'model_context_window_exceeded')])
    const view = recorder()
    await runTurn('Go on.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.log.filter((l) => l.startsWith('stoppedFor'))).toEqual(['stoppedFor model_context_window_exceeded'])
    // the negative arm: end_turn shows none
    const quiet = recorder()
    await runTurn('Go on.', { api: scriptedApi([respond([{ type: 'text', text: 'Done.' }], 'end_turn')]).api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view: quiet, signal: new AbortController().signal })
    expect(quiet.log.filter((l) => l.startsWith('stoppedFor'))).toEqual([])
  })
})

describe('a change of model or effort in the middle of a conversation', () => {
  const thinking = { type: 'thinking' as const, thinking: '', signature: 'sig' }

  it("requests that another model's thinking be dropped, shows a notice before the request, and carries the conversation on", async () => {
    const { api, requests } = scriptedApi([respond([thinking, { type: 'text', text: 'One.' }], 'end_turn'), respond([{ type: 'text', text: 'Two.' }], 'end_turn'), respond([{ type: 'text', text: 'Three.' }], 'end_turn')])
    const history: MessageParam[] = []
    const producers: Producers = new WeakMap()
    const view = recorder()
    const turn = (model: ModelId, effort: 'medium' | 'max') => runTurn('Go on.', { api, model, effort, request: CONFIG, producers, history, tools: NO_TOOLS, view, signal: new AbortController().signal })
    await turn('claude-opus-5-5', 'medium')
    await turn('claude-haiku-5-5', 'max')
    await turn('claude-haiku-5-5', 'max')
    expect(requests.map((r) => [r.model, r.output_config.effort, r.thinking])).toEqual([
      ['claude-opus-5-5', 'medium', { type: 'adaptive', display: 'summarized', block_binding: { prefix_mismatch_behavior: 'error' } }],
      ['claude-haiku-5-5', 'max', { type: 'adaptive', display: 'summarized', block_binding: { prefix_mismatch_behavior: 'drop_block' } }],
      ['claude-haiku-5-5', 'max', { type: 'adaptive', display: 'summarized', block_binding: { prefix_mismatch_behavior: 'drop_block' } }],
    ])
    // the history goes back whole, the earlier model's thinking block included: the API drops it
    expect(requests[1]!.messages[1]).toMatchObject({ role: 'assistant', content: [thinking, { type: 'text', text: 'One.' }] })
    expect(view.log.filter((l) => l.startsWith('otherThinking'))).toEqual(['otherThinking claude-haiku-5-5', 'otherThinking claude-haiku-5-5'])
    expect(view.log.filter((l) => l.startsWith('requestFailed'))).toEqual([])
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant'])
  })

  it('reads a history with no thinking, or thinking from the same model, as nothing to drop', () => {
    const producers: Producers = new WeakMap()
    const mine: MessageParam = { role: 'assistant', content: [thinking] }
    const plain: MessageParam = { role: 'assistant', content: [{ type: 'text', text: 'x' }] }
    producers.set(mine, 'claude-opus-5-5')
    producers.set(plain, 'claude-sonnet-5-5')
    expect(holdsOtherThinking([mine, plain], producers, 'claude-opus-5-5')).toBe(false)
    expect(holdsOtherThinking([mine, plain], producers, 'claude-fable-5-1')).toBe(true)
    expect(requestParams(CONFIG, 'claude-opus-5-5', [mine], 'low', producers).thinking).toMatchObject({ block_binding: { prefix_mismatch_behavior: 'error' } })
  })

  it("reports each response's usage with the model that answered", async () => {
    const { api } = scriptedApi([respond([{ type: 'text', text: 'One.' }], 'end_turn')])
    const view = recorder()
    await runTurn('Hi.', { api, model: 'claude-fable-5-1', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.usages).toEqual(['usage claude-fable-5-1 1'])
  })
})

describe('dropped thinking blocks', () => {
  /** A response whose request had these input transformations reported. */
  const reporting = (transformations: FinalMessage['input_transformations']) => {
    const r = respond([{ type: 'text', text: 'Done.' }], 'end_turn')
    return { ...r, message: { ...r.message, input_transformations: transformations } }
  }

  it('reports one dropped block, with its path, for an entry with the reason model_binding_mismatch', async () => {
    const dropped = { type: 'thinking_dropped', path: 'messages.1.content.0', reason: 'model_binding_mismatch' }
    const { api } = scriptedApi([reporting([dropped])])
    const view = recorder()
    await runTurn('Again, on the other model.', { api, model: 'claude-sonnet-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.log.filter((l) => l.startsWith('thinkingDropped'))).toEqual(['thinkingDropped messages.1.content.0 model_binding_mismatch'])
  })

  it('reports none for an empty list, nor for a block the model was shown unchanged', async () => {
    const shown = { type: 'thinking_mismatch_allowed', path: 'messages.1.content.0', reason: 'prefix_binding_mismatch' }
    expect(droppedThinking(reporting([]).message)).toEqual([])
    expect(droppedThinking(reporting([shown]).message)).toEqual([])
    const { api } = scriptedApi([reporting([])])
    const view = recorder()
    await runTurn('Again.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.log.filter((l) => l.startsWith('thinkingDropped'))).toEqual([])
  })
})

describe('the state a turn reports', () => {
  const run = (script: ReturnType<typeof respond>[], tools: Record<string, ToolHandler> = NO_TOOLS) => {
    const view = recorder()
    const { api } = scriptedApi(script)
    return runTurn('Go.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools, view, signal: new AbortController().signal }).then(() => view)
  }

  it('waits for the API before the first event, then writes', async () => {
    const view = await run([respond([{ type: 'text', text: 'Hello there.' }], 'end_turn')])
    expect(names(view.phases)).toEqual(['waiting', 'writing'])
  })

  it('thinks while a thinking block is open, then writes', async () => {
    const view = await run([respond([{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'Hello.' }], 'end_turn')])
    expect(names(view.phases)).toEqual(['waiting', 'thinking', 'writing'])
  })

  it('prepares a call to a tool by its name, runs it, then waits for the API again', async () => {
    const read_model: ToolHandler = async () => ({ status: 'none', text: 'no model is loaded' })
    const view = await run([respond([{ type: 'tool_use', id: 'c1', name: 'read_model', input: { path: null } }], 'tool_use'), respond([{ type: 'text', text: 'Nothing is loaded.' }], 'end_turn')], { read_model })
    expect(names(view.phases)).toEqual(['waiting', 'calling read_model', 'running read_model', 'waiting', 'writing'])
  })

  it('names each tool of a step as it runs it', async () => {
    const view = await run([respond([{ type: 'tool_use', id: 'c1', name: 'read_model', input: { path: null } }, { type: 'tool_use', id: 'c2', name: 'solve', input: {} }], 'tool_use'), respond([{ type: 'text', text: 'Done.' }], 'end_turn')])
    expect(names(view.phases).filter((p) => p.startsWith('running'))).toEqual(['running read_model', 'running solve'])
  })

  it('reports every event of the stream as heard, one for each', async () => {
    const script = respond([{ type: 'text', text: 'A reply in several pieces.' }], 'end_turn')
    const view = await run([script])
    expect(script.events.length).toBeGreaterThan(3)
    expect(view.heards()).toBe(script.events.length)
  })

  it('reports nothing for a turn that is stopped before its first request', async () => {
    const view = recorder()
    const controller = new AbortController()
    controller.abort()
    await runTurn('Go.', { api: scriptedApi([]).api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: controller.signal })
    expect(view.phases).toEqual([])
    expect(view.heards()).toBe(0)
  })
})

describe('thinking returned while the model thinks', () => {
  /** What goes on the wire for thinking, per model, from the request the loop builds. */
  const thinkingFor = (model: ModelId) => requestParams(CONFIG, model, [{ role: 'user', content: 'hello' }]).thinking

  it('requests the configured display on all four models, with adaptive thinking and the binding setting', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'])
    const wanted = { type: 'adaptive', display: 'summarized', block_binding: { prefix_mismatch_behavior: 'error' } }
    expect(MODELS.map((m) => thinkingFor(m.id))).toEqual([wanted, wanted, wanted, wanted])
  })

  it('sends Fable 5.1 only what its thinking setting admits: adaptive, no budget, no disabled, no forced tool choice', () => {
    const fable = requestParams(CONFIG, 'claude-fable-5-1', [{ role: 'user', content: 'hello' }])
    expect(fable.thinking).toMatchObject({ type: 'adaptive' })
    expect(JSON.stringify(fable)).not.toMatch(/budget_tokens|"disabled"|"enabled"|between_tools/)
    expect(fable.tool_choice).toEqual({ type: 'auto' })
    expect(fable).not.toHaveProperty('temperature')
    expect(fable).not.toHaveProperty('top_p')
    expect(fable).not.toHaveProperty('top_k')
    expect(fable).not.toHaveProperty('fallbacks')
    // the positive arm: the same request body for Fable and Opus differs in the model only
    expect({ ...fable, model: 'x' }).toEqual({ ...requestParams(CONFIG, 'claude-opus-5-5', [{ role: 'user', content: 'hello' }]), model: 'x' })
  })

  it('passes each piece of a thinking block to the view as it arrives, and none that is empty', async () => {
    const events: StreamEvent[] = [
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Checking the span ' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'against the supports.' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta' } },
      { type: 'content_block_stop', index: 0 },
    ]
    const { api } = scriptedApi([{ events, message: respond([{ type: 'thinking', thinking: 'Checking the span against the supports.', signature: 'sig' }, { type: 'text', text: 'Done.' }], 'end_turn').message }])
    const view = recorder()
    await runTurn('Go.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.thoughts).toEqual(['Checking the span ', 'against the supports.'])
    expect(names(view.phases)).toEqual(['waiting', 'thinking'])
  })

  it('passes nothing for a response with no thinking text', async () => {
    const view = recorder()
    await runTurn('Go.', { api: scriptedApi([respond([{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'Hello.' }], 'end_turn')]).api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal })
    expect(view.thoughts).toEqual([])
  })

  it('sends the thinking block back with its summary text unchanged, as the API returned it', async () => {
    const block = { type: 'thinking' as const, thinking: 'Checking the span against the supports.', signature: 'sig' }
    const { api, requests } = scriptedApi([respond([block, { type: 'tool_use', id: 'c1', name: 'read_model', input: { path: null } }], 'tool_use'), respond([{ type: 'text', text: 'Done.' }], 'end_turn')])
    await runTurn('Go.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: { read_model: async () => ({ status: 'none' }) }, view: recorder(), signal: new AbortController().signal })
    expect(requests[1]!.messages[1]).toMatchObject({ role: 'assistant', content: [block, { id: 'c1' }] })
  })
})

describe('a stop after tool calls that were not run', () => {
  const calls = [
    { type: 'tool_use' as const, id: 'c1', name: 'read_model', input: { path: null } },
    { type: 'tool_use' as const, id: 'c2', name: 'solve', input: {} },
  ]

  it.each([
    ['the length limit', 'max_tokens'],
    ['a refusal', 'refusal'],
    ['a reason the panel does not act on', 'model_context_window_exceeded'],
  ])('marks every call as not run after %s, so the next message makes a valid request', async (_name, stop) => {
    const { api, requests } = scriptedApi([respond([{ type: 'text', text: 'I will read the model and' }, ...calls], stop), respond([{ type: 'text', text: 'Here.' }], 'end_turn')])
    const history: MessageParam[] = []
    const run = vi.fn<ToolHandler>(async () => ({ status: 'none' }))
    const tools = { read_model: run, solve: run }
    await runTurn('Read the model.', { api, model: 'claude-opus-5-5', request: CONFIG, history, tools, view: recorder(), signal: new AbortController().signal })
    // the history ends with the answers, and no tool ran
    expect(history[history.length - 1]).toMatchObject({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'c1', is_error: true, content: expect.stringContaining('"kind":"not_run"') },
        { type: 'tool_result', tool_use_id: 'c2', is_error: true, content: expect.stringContaining('"kind":"not_run"') },
      ],
    })
    expect(run).not.toHaveBeenCalled()
    await runTurn('Go on.', { api, model: 'claude-opus-5-5', request: CONFIG, history, tools, view: recorder(), signal: new AbortController().signal })
    expect(requests).toHaveLength(2)
    expect(unansweredToolCalls(requests[1]!.messages)).toEqual([])
  })

  it('adds nothing after a stop that left no call, or after the calls were run', async () => {
    const { api } = scriptedApi([respond([{ type: 'text', text: 'The first part is' }], 'max_tokens')])
    const cut: MessageParam[] = []
    await runTurn('Go.', { api, model: 'claude-opus-5-5', request: CONFIG, history: cut, tools: NO_TOOLS, view: recorder(), signal: new AbortController().signal })
    expect(cut.map((m) => m.role)).toEqual(['user', 'assistant'])
    const ran = scriptedApi([respond([calls[0]!], 'tool_use'), respond([{ type: 'text', text: 'Done.' }], 'end_turn')])
    const history: MessageParam[] = []
    await runTurn('Go.', { api: ran.api, model: 'claude-opus-5-5', request: CONFIG, history, tools: { read_model: async () => ({ status: 'none' }) }, view: recorder(), signal: new AbortController().signal })
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(unansweredToolCalls(history)).toEqual([])
  })

  it('measures what it claims: a history with a call left open is reported, and an answered one is not', () => {
    const open: MessageParam[] = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: [calls[0]!] }, { role: 'user', content: 'Go on.' }]
    expect(unansweredToolCalls(open)).toEqual(['c1'])
    const answered: MessageParam[] = [open[0]!, open[1]!, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'x' }, { type: 'text', text: 'Go on.' }] }]
    expect(unansweredToolCalls(answered)).toEqual([])
  })
})

describe('the conversation a report belongs to', () => {
  it('gives a text handle of -1 once the conversation is no longer open, and a real handle while it is', () => {
    let open = true
    const view = currentView(recorder(), () => open)
    expect(view.textStart()).toBe(0)
    open = false
    expect(view.textStart()).toBe(-1)
  })

  it('drops every report of a turn whose conversation has moved on, and keeps none of them', async () => {
    const { api } = scriptedApi([respond([{ type: 'text', text: 'A reply for an old conversation.' }], 'end_turn')])
    const view = recorder()
    await runTurn('Go.', { api, model: 'claude-opus-5-5', request: CONFIG, history: [], tools: NO_TOOLS, view, signal: new AbortController().signal, isCurrent: () => false })
    expect(view.log).toEqual([])
    expect(view.phases).toEqual([])
  })
})
