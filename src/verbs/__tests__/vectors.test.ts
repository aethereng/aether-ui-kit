// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createStore, replay, type Actor, type Call, type Json, type Outcome, type Registry, type Snapshot, type Store } from '..'
import { toyRegistry } from './toy'

/**
 * The golden vectors of the machinery (S0): batches and the records they must leave, written by hand from sections 4
 * and 11 of the definition in vectors.json, which also says how a record, a seq and a batch number are counted.
 * This file only plays them against the toy vocabulary; no expected value is computed here.
 */
interface Expected {
  ok?: boolean
  changed?: boolean
  batch?: number
  noBatch?: boolean
  ids?: { [handle: string]: string }
  records?: Json[]
  reason?: string
  at?: number
  message?: string
}
interface After {
  undoDepth?: number
  redoDepth?: number
  log?: number
  ids?: { [kind: string]: string[] }
  logTail?: Json[]
  hash?: { mark?: string; equals?: string; differs?: string }
}
type Step =
  | { do: 'run'; actor: Actor; calls: Call[]; expect: Expected; after?: After }
  | { do: 'undo' | 'redo'; actor?: Actor; expect: Expected; after?: After }
  | { do: 'gesture'; actor: Actor; moves: Array<{ calls: Call[]; expect?: Expected }>; finish: 'end' | 'cancel'; expect: Expected; after?: After }
  | { do: 'mark'; name: string }
  | { do: 'lock'; reason: string }
  | { do: 'release' }
  | { do: 'replay' }
interface Vector {
  name: string
  section: string
  steps: Step[]
}
interface Vectors {
  base: Snapshot
  vectors: Vector[]
}

const file = JSON.parse(readFileSync(new URL('./vectors.json', import.meta.url), 'utf8')) as Vectors

function check(where: string, outcome: Outcome, e: Expected): void {
  if (e.ok !== undefined) expect(outcome.ok, `${where}: ok`).toBe(e.ok)
  if (outcome.ok) {
    if (e.changed !== undefined) expect(outcome.changed, `${where}: changed`).toBe(e.changed)
    if (e.batch !== undefined) expect(outcome.batch, `${where}: batch`).toBe(e.batch)
    if (e.noBatch === true) expect(outcome.batch, `${where}: no batch number`).toBeUndefined()
    if (e.ids !== undefined) expect(outcome.ids, `${where}: ids`).toEqual(e.ids)
    if (e.records !== undefined) expect(outcome.records, `${where}: records`).toStrictEqual(e.records)
  } else {
    if (e.reason !== undefined) expect(outcome.refusal.reason, `${where}: reason`).toBe(e.reason)
    if (e.at !== undefined) expect(outcome.refusal.at, `${where}: place`).toBe(e.at)
    if (e.message !== undefined) expect(outcome.refusal.issues.map((i) => i.message).join('; '), `${where}: message`).toContain(e.message)
  }
}

function checkAfter(where: string, store: Store, after: After, marks: Map<string, string>): void {
  if (after.undoDepth !== undefined) expect(store.undoDepth, `${where}: undo depth`).toBe(after.undoDepth)
  if (after.redoDepth !== undefined) expect(store.redoDepth, `${where}: redo depth`).toBe(after.redoDepth)
  if (after.log !== undefined) expect(store.log.length, `${where}: log length`).toBe(after.log)
  for (const [kind, ids] of Object.entries(after.ids ?? {})) expect(store.ids(kind), `${where}: ${kind} ids in order`).toEqual(ids)
  if (after.logTail !== undefined) {
    const tail = store.log.slice(store.log.length - after.logTail.length).map(({ verb, input, actor }) => ({ verb, input, actor }))
    expect(tail, `${where}: log tail`).toEqual(after.logTail)
  }
  const h = after.hash
  if (h?.equals !== undefined) expect(store.hash(), `${where}: hash equals ${h.equals}`).toBe(marks.get(h.equals))
  if (h?.differs !== undefined) expect(store.hash(), `${where}: hash differs from ${h.differs}`).not.toBe(marks.get(h.differs))
  if (h?.mark !== undefined) marks.set(h.mark, store.hash())
}

/** Replays what the store saved and checks it reaches the same hash and the same ids. */
function checkReplay(where: string, registry: Registry, store: Store): void {
  const r = replay(registry, store.save())
  expect(r.ok, `${where}: replay`).toBe(true)
  if (!r.ok) throw new Error(`${where}: replay refused`)
  expect(r.store.hash(), `${where}: replayed hash`).toBe(store.hash())
  for (const kind of registry.kinds.keys()) expect(r.store.ids(kind), `${where}: replayed ${kind} ids`).toEqual(store.ids(kind))
}

/** Plays one vector's steps from the file's base; throws (an expect failure) at the first step that disagrees. */
function play(vector: Vector, base: Snapshot): number {
  const registry = toyRegistry()
  const store = createStore(registry, { base })
  const marks = new Map<string, string>()
  const locks: Array<() => void> = []
  vector.steps.forEach((step, n) => {
    const where = `${vector.name}, step ${n + 1} (${step.do})`
    switch (step.do) {
      case 'mark':
        marks.set(step.name, store.hash())
        return
      case 'lock':
        locks.push(store.lock(step.reason))
        return
      case 'release': {
        const held = locks.pop()
        if (held === undefined) throw new Error(`${where}: no lock is held`)
        held()
        return
      }
      case 'replay':
        checkReplay(where, registry, store)
        return
      case 'gesture': {
        const opened = store.gesture({ actor: step.actor })
        if (!opened.ok) throw new Error(`${where}: the gesture was refused`)
        step.moves.forEach((move, i) => check(`${where}, move ${i + 1}`, opened.gesture.move(move.calls), move.expect ?? { ok: true }))
        check(where, step.finish === 'end' ? opened.gesture.end() : opened.gesture.cancel(), step.expect)
        if (step.after !== undefined) checkAfter(where, store, step.after, marks)
        return
      }
      case 'run':
      case 'undo':
      case 'redo': {
        const actor = step.do === 'run' ? step.actor : (step.actor ?? 'person')
        const outcome = step.do === 'run' ? store.run(step.calls, { actor }) : step.do === 'undo' ? store.undo(actor) : store.redo(actor)
        check(where, outcome, step.expect)
        if (step.after !== undefined) checkAfter(where, store, step.after, marks)
        return
      }
    }
  })
  return vector.steps.length
}

describe('the golden vectors of the machinery', () => {
  it('holds a good number of vectors, each with a unique name and the section of the definition it comes from', () => {
    expect(file.vectors.length).toBeGreaterThanOrEqual(10)
    expect(new Set(file.vectors.map((v) => v.name)).size).toBe(file.vectors.length)
    for (const v of file.vectors) expect({ name: v.name, section: v.section }).toEqual({ name: v.name, section: expect.stringMatching(/^(4|11)[.][0-9]+$/) })
  })
  it('holds the batch whose writes cancel, which leaves the redo tail and takes no batch number', () => {
    const v = file.vectors.find((x) => x.name.startsWith('a batch whose writes cancel'))
    expect(v).toBeDefined()
    const runs = (v?.steps ?? []).filter((s): s is Extract<Step, { do: 'run' }> => s.do === 'run' && s.expect.changed === false)
    expect(runs).toHaveLength(1)
    expect(runs[0]!.calls.length).toBeGreaterThan(1)
    expect(runs[0]!.expect.noBatch).toBe(true)
    expect(runs[0]!.after?.redoDepth).toBe(1)
  })
  it.each(file.vectors.map((v) => [v.name, v] as const))('%s', (_name, vector) => {
    expect(play(vector, file.base)).toBe(vector.steps.length)
  })
  it('sees a vector whose expectation is wrong (seeded), and passes the same vector when it is right', () => {
    const rename: Call = { verb: 'box.rename', input: { id: 'b1', name: 'X' } }
    const right: Vector = { name: 'seed', section: '11.2', steps: [{ do: 'run', actor: 'person', calls: [rename], expect: { ok: true, changed: true, batch: 1 }, after: { undoDepth: 1 } }] }
    const wrong: Vector = { name: 'seed', section: '11.2', steps: [{ do: 'run', actor: 'person', calls: [rename], expect: { ok: true, changed: false }, after: { undoDepth: 1 } }] }
    expect(() => play(right, file.base)).not.toThrow()
    expect(() => play(wrong, file.base)).toThrow('changed')
    const dropped: Vector = { name: 'seed', section: '11.2', steps: [{ do: 'run', actor: 'person', calls: [rename], expect: { ok: true, records: [] } }] }
    expect(() => play(dropped, file.base)).toThrow('records')
  })
})
