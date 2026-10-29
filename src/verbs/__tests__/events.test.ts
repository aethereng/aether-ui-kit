// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { ChangeEvent } from '..'
import { create, person, proposed, toyStore } from './toy'

const rename = (name: string) => ({ verb: 'box.rename', input: { id: 'b1', name } })

describe('change events say what changed', () => {
  it('emits one event per commit with the batch, the cause and the records', () => {
    const { store } = toyStore()
    const seen: ChangeEvent[] = []
    store.subscribe((e) => seen.push(e))
    const r = store.run([rename('X'), create('G')], person)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ cause: 'verb', actor: 'person', batch: r.ok ? r.batch : -1 })
    expect(seen[0]!.records).toEqual(r.ok ? r.records : null)
  })
  it('emits cause undo with the inverse records, and cause redo with the originals', () => {
    const { store } = toyStore()
    store.run([rename('X')], person)
    const seen: ChangeEvent[] = []
    store.subscribe((e) => seen.push(e))
    store.undo('person')
    store.redo('person')
    expect(seen.map((e) => e.cause)).toEqual(['undo', 'redo'])
    expect(seen[0]!.records[0]).toMatchObject({ op: 'set', component: 'Name', before: 'X', after: 'Alpha' })
    expect(seen[1]!.records[0]).toMatchObject({ op: 'set', component: 'Name', before: 'Alpha', after: 'X' })
  })
  it('delivers a subscriber only the records of its kind and component', () => {
    const { store } = toyStore()
    const names: string[][] = []
    const dims: string[][] = []
    store.subscribe((e) => names.push(e.records.map((r) => r.component ?? r.op)), { component: 'Name' })
    store.subscribe((e) => dims.push(e.records.map((r) => `${r.kind}.${r.component}`)), { kind: 'box', component: 'Dims' })
    store.run([rename('X'), { verb: 'box.resize', input: { id: 'b2', h: 99 } }], person)
    expect(names).toEqual([['Name']])
    expect(dims).toEqual([['box.Dims']])
  })
  it('does not call a subscriber when nothing it subscribed to changed', () => {
    const { store } = toyStore()
    const fn = vi.fn<(e: ChangeEvent) => void>()
    store.subscribe(fn, { kind: 'crate' })
    store.run([rename('X')], person)
    expect(fn).not.toHaveBeenCalled()
    store.run([{ verb: 'crate.create', input: { name: 'K' } }], person)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('stops delivering after the subscription is released', () => {
    const { store } = toyStore()
    const fn = vi.fn<(e: ChangeEvent) => void>()
    const off = store.subscribe(fn)
    store.run([rename('X')], person)
    off()
    store.run([rename('Y')], person)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('emits nothing for a refused batch, a batch that changes nothing, or a preview', () => {
    const { store } = toyStore()
    const fn = vi.fn<(e: ChangeEvent) => void>()
    store.subscribe(fn)
    store.run([rename('X'), { verb: 'box.rename', input: { id: 'b9', name: 'x' } }], person)
    store.run([rename('Alpha')], person)
    store.preview(proposed(store, [rename('Z')]))
    expect(fn).not.toHaveBeenCalled()
  })
  it('keeps the commit when a listener throws, and surfaces the fault outside the commit', async () => {
    const { store } = toyStore()
    const raised: unknown[] = []
    const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((job) => {
      try {
        job()
      } catch (e) {
        raised.push(e)
      }
    })
    store.subscribe(() => {
      throw new Error('listener fault')
    })
    const r = store.run([rename('X')], person)
    spy.mockRestore()
    expect(r.ok).toBe(true)
    expect(store.get('box', 'b1')!.Name).toBe('X')
    expect(raised).toHaveLength(1)
  })
})
