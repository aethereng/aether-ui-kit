import { createRegistry, createStore, dependants, type Call, type Proposal, type ProposalItem, type Registry, type Schema, type Store } from '..'

/**
 * A toy vocabulary of kinds that are none of the app's: `box` and `crate` share one id space, a `label` sits on a box.
 * The machinery's tests run against it, so a pass says the machinery works for a vocabulary it was not written for.
 */
export const BOX_INPUT: Schema = { type: 'object', properties: { name: { type: 'string' }, w: { type: 'number', minimum: 1, maximum: 100 }, h: { type: 'number', minimum: 1, maximum: 100 } }, required: ['name', 'w', 'h'], additionalProperties: false }

export function toyRegistry(extra: (r: Registry) => void = () => {}, options: Parameters<typeof createRegistry>[0] = {}): Registry {
  const r = createRegistry(options)
  r.kind('box', { prefix: 'b', group: 'stock' })
  r.kind('crate', { prefix: 'c', group: 'stock' })
  r.kind('label', { prefix: 'l', relations: { On: 'box' } })

  r.verb<{ name: string; w: number; h: number }>({
    name: 'box.create', target: 'box', mints: true, input: BOX_INPUT,
    apply: (d, i, c) => d.add('box', c.id!, { Name: i.name, Dims: { w: i.w, h: i.h } }),
    describe: (i) => `Add a box '${i.name}', ${i.w} by ${i.h}`,
  })
  r.verb<{ id: string; name: string }>({
    name: 'box.rename', target: 'box',
    input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, name: { type: 'string' } }, required: ['id', 'name'], additionalProperties: false },
    apply: (d, i) => d.set('box', i.id, 'Name', i.name),
    describe: (i) => `Rename box ${i.id} to '${i.name}'`,
  })
  r.verb<{ id: string; w?: number; h?: number }>({
    name: 'box.resize', target: 'box',
    input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, w: { type: 'number', minimum: 1, maximum: 100 }, h: { type: 'number', minimum: 1, maximum: 100 } }, required: ['id'], additionalProperties: false },
    validate: (_d, i) => (i.w === undefined && i.h === undefined ? [{ kind: 'box', id: i.id, field: '/w', message: 'name a width or a height' }] : []),
    apply: (d, i) => {
      if (i.w !== undefined) d.setField('box', i.id, 'Dims', 'w', i.w)
      if (i.h !== undefined) d.setField('box', i.id, 'Dims', 'h', i.h)
    },
    describe: (i) => `Resize box ${i.id}`,
  })
  r.verb<{ id: string; cascade?: boolean }>({
    name: 'box.delete', target: 'box',
    input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, cascade: { type: 'boolean' } }, required: ['id'], additionalProperties: false },
    validate: (d, i) => {
      if (i.cascade === true) return []
      const on = d.refs('box', i.id)
      return on.length === 0 ? [] : [{ kind: 'box', id: i.id, message: `box ${i.id} still carries ${on.map((x) => `${x.kind} ${x.id} at ${x.at}`).join(', ')}; name cascade to remove them` }]
    },
    apply: (d, i) => {
      for (const x of dependants(d, 'box', i.id)) d.remove(x.kind, x.id)
      d.remove('box', i.id)
    },
    describe: (i) => `Delete box ${i.id}`,
  })
  r.verb<{ name: string }>({
    name: 'crate.create', target: 'crate', mints: true,
    input: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
    apply: (d, i, c) => d.add('crate', c.id!, { Name: i.name }),
    describe: (i) => `Add a crate '${i.name}'`,
  })
  r.verb<{ on: string; text: string }>({
    name: 'label.create', target: 'label', mints: true,
    input: { type: 'object', properties: { on: { type: 'string', 'x-ref': 'box' }, text: { type: 'string' } }, required: ['on', 'text'], additionalProperties: false },
    apply: (d, i, c) => d.add('label', c.id!, { On: { kind: 'box', id: i.on }, Text: i.text }),
    describe: (i) => `Label box ${i.on} '${i.text}'`,
  })
  r.verb<{ id: string }>({
    name: 'label.delete', target: 'label', actors: ['person'],
    input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'label' } }, required: ['id'], additionalProperties: false },
    apply: (d, i) => d.remove('label', i.id),
    describe: (i) => `Delete label ${i.id}`,
  })
  // a label whose box was resized is marked stale, inside the batch that resized it
  r.system({
    name: 'stale',
    on: { kind: 'box', component: 'Dims' },
    run: (d, records) => {
      for (const rec of records) {
        for (const x of d.refs('box', rec.id)) d.set(x.kind, x.id, 'Stale', true)
      }
    },
  })
  extra(r)
  return r
}

export const create = (name: string, w = 10, h = 20, as?: string): Call => ({ verb: 'box.create', input: { name, w, h }, ...(as === undefined ? {} : { as }) })
export const person = { actor: 'person' as const }
export const script = { actor: 'script' as const }

/** The proposal a store makes of these items; a store that refuses to make one fails the test. */
export function proposed(store: Store, items: readonly ProposalItem[]): Proposal {
  const r = store.propose(items)
  if (!r.ok) throw new Error(`the proposal was refused: ${r.refusal.issues.map((i) => i.message).join('; ')}`)
  return r.proposal
}

/** A store over the toy registry holding b1 'Alpha' and b2 'Beta', each with a label ('l1' on b1). */
export function toyStore(limit?: number): { registry: Registry; store: Store } {
  const registry = toyRegistry()
  const store = createStore(registry, limit === undefined ? {} : { limit })
  const r = store.run([create('Alpha', 10, 20), create('Beta', 30, 40), { verb: 'label.create', input: { on: 'b1', text: 'first' } }], person)
  if (!r.ok) throw new Error(`toy setup refused: ${r.refusal.issues.map((i) => i.message).join('; ')}`)
  return { registry, store }
}
