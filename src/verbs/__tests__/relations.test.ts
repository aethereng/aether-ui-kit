// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, dependants, relationTargets, type Call, type Json, type Registry, type Relations, type Store } from '..'
import { create, person, toyRegistry } from './toy'

const BOX = { type: 'string', 'x-ref': 'box' }
const CRATE = { type: 'string', 'x-ref': 'crate' }
const ref = (kind: string, id: string): Json => ({ kind, id })

/**
 * The toy vocabulary with kinds that hold references in every shape a relation can name: a bag holds them in a list
 * of items, a shelf two lists deep, a desk inside an object, a flag in one component that may point at a box or a
 * crate. A box is deleted with the toy's own delete verb; a crate with the one registered here.
 */
function holding(bagRelations: Relations = { 'Items/*/box': 'box' }): { registry: Registry; store: Store } {
  const registry = toyRegistry((r) => {
    r.kind('bag', { prefix: 'g', relations: bagRelations })
    r.kind('shelf', { prefix: 's', relations: { 'Rows/*/Cells/*/box': 'box' } })
    r.kind('desk', { prefix: 'd', relations: { 'Slot/box': 'box' } })
    r.kind('flag', { prefix: 'f', relations: { Target: ['box', 'crate'] } })
    r.verb<{ items: Array<{ box: string; qty: number }> }>({
      name: 'bag.create', target: 'bag', mints: true,
      input: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { box: BOX, qty: { type: 'number' } }, required: ['box', 'qty'], additionalProperties: false } } }, required: ['items'], additionalProperties: false },
      apply: (d, i, c) => d.add('bag', c.id!, { Items: i.items.map((x) => ({ box: ref('box', x.box), qty: x.qty })) }),
      describe: (i) => `Add a bag of ${i.items.length} items`,
    })
    r.verb<{ rows: string[][] }>({
      name: 'shelf.create', target: 'shelf', mints: true,
      input: { type: 'object', properties: { rows: { type: 'array', items: { type: 'array', items: BOX } } }, required: ['rows'], additionalProperties: false },
      apply: (d, i, c) => d.add('shelf', c.id!, { Rows: i.rows.map((cells) => ({ Cells: cells.map((box) => ({ box: ref('box', box) })) })) }),
      describe: (i) => `Add a shelf of ${i.rows.length} rows`,
    })
    r.verb<{ box: string }>({
      name: 'desk.create', target: 'desk', mints: true,
      input: { type: 'object', properties: { box: BOX }, required: ['box'], additionalProperties: false },
      apply: (d, i, c) => d.add('desk', c.id!, { Slot: { box: ref('box', i.box), note: 'n' } }),
      describe: (i) => `Add a desk holding box ${i.box}`,
    })
    r.verb<{ box: string }>({
      name: 'flag.on_box', target: 'flag', mints: true,
      input: { type: 'object', properties: { box: BOX }, required: ['box'], additionalProperties: false },
      apply: (d, i, c) => d.add('flag', c.id!, { Target: ref('box', i.box) }),
      describe: (i) => `Flag box ${i.box}`,
    })
    r.verb<{ crate: string }>({
      name: 'flag.on_crate', target: 'flag', mints: true,
      input: { type: 'object', properties: { crate: CRATE }, required: ['crate'], additionalProperties: false },
      apply: (d, i, c) => d.add('flag', c.id!, { Target: ref('crate', i.crate) }),
      describe: (i) => `Flag crate ${i.crate}`,
    })
    r.verb<{ id: string; cascade?: boolean }>({
      name: 'crate.delete', target: 'crate',
      input: { type: 'object', properties: { id: CRATE, cascade: { type: 'boolean' } }, required: ['id'], additionalProperties: false },
      validate: (d, i) => {
        const held = d.refs('crate', i.id)
        return i.cascade === true || held.length === 0 ? [] : [{ kind: 'crate', id: i.id, message: `crate ${i.id} is still held by ${held.map((x) => `${x.kind} ${x.id} at ${x.at}`).join(', ')}` }]
      },
      apply: (d, i) => {
        for (const x of dependants(d, 'crate', i.id)) d.remove(x.kind, x.id)
        d.remove('crate', i.id)
      },
      describe: (i) => `Delete crate ${i.id}`,
    })
  })
  return { registry, store: createStore(registry) }
}

const call = (verb: string, input: Json): Call => ({ verb, input })

/** b1 Alpha and b2 Beta, the crate c1, and one holder of each shape: g1, s1, d1, f1 on b1, f2 on c1, and the toy's l1 on b1. */
function furnished(): { registry: Registry; store: Store } {
  const made = holding()
  const r = made.store.run([
    create('Alpha', 10, 20),
    create('Beta', 30, 40),
    call('crate.create', { name: 'K' }),
    call('label.create', { on: 'b1', text: 'first' }),
    call('bag.create', { items: [{ box: 'b2', qty: 1 }, { box: 'b1', qty: 2 }] }),
    call('shelf.create', { rows: [['b2'], ['b2', 'b1']] }),
    call('desk.create', { box: 'b1' }),
    call('flag.on_box', { box: 'b1' }),
    call('flag.on_crate', { crate: 'c1' }),
  ], person)
  expect(r.ok).toBe(true)
  return made
}

/**
 * Every value of the store shaped like a reference (a kind and an id and nothing else) whose entity is not there, with
 * where it sits. It reads the values and not the relation table, so a relation that does not name a place is seen by it.
 */
function dangling(store: Store, registry: Registry): string[] {
  const out: string[] = []
  const scan = (v: Json | undefined, where: string): void => {
    if (v === null || v === undefined || typeof v !== 'object') return
    if (Array.isArray(v)) {
      v.forEach((x, i) => scan(x, `${where}/${i}`))
      return
    }
    const keys = Object.keys(v).sort()
    if (keys.length === 2 && keys[0] === 'id' && keys[1] === 'kind' && typeof v.kind === 'string' && typeof v.id === 'string') {
      if (!store.has(v.kind, v.id)) out.push(`${where} -> ${v.kind} ${v.id}`)
      return
    }
    for (const [k, x] of Object.entries(v)) scan(x, `${where}/${k}`)
  }
  for (const kind of registry.kinds.keys()) for (const id of store.ids(kind)) scan(store.get(kind, id) as Json, `${kind} ${id}`)
  return out
}

const places = (store: Store, kind: string, id: string): string[] => store.refs(kind, id).map((r) => `${r.kind} ${r.id} ${r.component} ${r.at}`)

describe('a relation that lists more than one kind', () => {
  it('finds a reference from either kind it lists, the reference naming the kind', () => {
    const { store } = furnished()
    expect(places(store, 'box', 'b1')).toContain('flag f1 Target /Target')
    expect(places(store, 'crate', 'c1')).toEqual(['flag f2 Target /Target'])
    expect(places(store, 'box', 'b2').some((p) => p.startsWith('flag'))).toBe(false)
    expect(places(store, 'crate', 'c1').some((p) => p.startsWith('flag f1'))).toBe(false)
  })
  it('refuses a listed kind the vocabulary does not hold, naming it, when a store is made', () => {
    const registry = toyRegistry((r) => r.kind('flag', { prefix: 'f', relations: { Target: ['box', 'nothing'] } }))
    expect(() => createStore(registry)).toThrow("kind 'flag' relates 'Target' to 'nothing', which is not a kind of this vocabulary")
    const single = toyRegistry((r) => r.kind('flag', { prefix: 'f', relations: { Target: 'nothing' } }))
    expect(() => createStore(single)).toThrow("kind 'flag' relates 'Target' to 'nothing'")
  })
  it('does not read a reference as pointing at a kind the relation does not list, and takes the kind the reference names, not the id', () => {
    const { registry } = holding()
    const store = createStore(registry, {
      base: {
        entities: {
          box: { b1: { Name: 'A', Dims: { w: 1, h: 1 } } },
          label: { l1: { On: ref('box', 'b1') } },
          flag: { f1: { Target: ref('label', 'l1') }, f2: { Target: ref('crate', 'b1') } },
        },
        counters: {},
      },
    })
    expect(places(store, 'label', 'l1')).toEqual([])
    expect(places(store, 'box', 'b1')).toEqual(['label l1 On /On'])
    expect(places(store, 'crate', 'b1')).toEqual(['flag f2 Target /Target'])
  })
})

describe('a relation that names a path', () => {
  it('finds a reference in the items of a list, with the place of the item', () => {
    const { store } = furnished()
    expect(places(store, 'box', 'b1')).toContain('bag g1 Items /Items/1/box')
    expect(places(store, 'box', 'b2')).toContain('bag g1 Items /Items/0/box')
  })
  it('finds a reference inside an object', () => {
    const { store } = furnished()
    expect(places(store, 'box', 'b1')).toContain('desk d1 Slot /Slot/box')
  })
  it('finds a reference two lists deep, and every place that holds it in the order of the walk', () => {
    const { store } = furnished()
    expect(places(store, 'box', 'b2').filter((p) => p.startsWith('shelf'))).toEqual(['shelf s1 Rows /Rows/0/Cells/0/box', 'shelf s1 Rows /Rows/1/Cells/0/box'])
    expect(places(store, 'box', 'b1')).toContain('shelf s1 Rows /Rows/1/Cells/1/box')
  })
  it('finds nothing where the path leads nowhere, and goes on to the entities that do hold the reference', () => {
    const { registry } = holding()
    const box = { Name: 'A', Dims: { w: 1, h: 1 } }
    const store = createStore(registry, {
      base: {
        entities: {
          box: { b1: box },
          bag: { g1: {}, g2: { Items: [] }, g3: { Items: 'text' }, g4: { Items: [1, null, {}, { box: null }, { box: 5 }, { box: 'b1' }, { box: ref('crate', 'b1') }] }, g5: { Items: [{ box: ref('box', 'b1'), qty: 1 }] } },
          shelf: { s1: { Rows: [{}, { Cells: {} }, { Cells: [{ box: 'text' }] }, 7] } },
          desk: { d1: { Slot: 3 }, d2: { Slot: [] }, d3: { Slot: { note: 'n' } } },
        },
        counters: {},
      },
    })
    expect(places(store, 'box', 'b1')).toEqual(['bag g5 Items /Items/0/box'])
  })
  it('refuses a key that is no path, naming the kind and the key, when the kind is registered', () => {
    const at = (relations: Record<string, string | string[]>) => () => toyRegistry((r) => r.kind('bag', { prefix: 'g', relations }))
    expect(at({ 'Items//box': 'box' })).toThrow("kind 'bag' relation 'Items//box' has an empty part")
    expect(at({ '/Items': 'box' })).toThrow("kind 'bag' relation '/Items' has an empty part")
    expect(at({ '': 'box' })).toThrow("kind 'bag' relation '' has an empty part")
    expect(at({ '*/box': 'box' })).toThrow("kind 'bag' relation '*/box' starts with a star")
    expect(at({ Items: [] })).toThrow("kind 'bag' relation 'Items' lists no kind")
    expect(at({ Items: '' })).toThrow("kind 'bag' relation 'Items' lists no kind")
    expect(at({ 'Items/*/box': 'box', Items: ['box', 'crate'] })).not.toThrow()
  })
})

describe('relationTargets', () => {
  const RELATIONS = { 'Items/*/box': 'box', Target: ['box', 'crate'], Boxes: 'box' }
  it('reports every place a relation reaches with its value, its kinds and the pointer, also a value that is no reference', () => {
    const found = relationTargets({ Items: [{ box: ref('box', 'b1') }, { box: 'junk' }], Target: ref('crate', 'c1') }, RELATIONS)
    expect(found).toEqual([
      { relation: 'Items/*/box', component: 'Items', at: '/Items/0/box', kinds: ['box'], value: { kind: 'box', id: 'b1' } },
      { relation: 'Items/*/box', component: 'Items', at: '/Items/1/box', kinds: ['box'], value: 'junk' },
      { relation: 'Target', component: 'Target', at: '/Target', kinds: ['box', 'crate'], value: { kind: 'crate', id: 'c1' } },
    ])
  })
  it('reports one place for each item of a list held where a reference is expected', () => {
    const found = relationTargets({ Boxes: [ref('box', 'b1'), ref('box', 'b2')] }, RELATIONS)
    expect(found.map((t) => t.at)).toEqual(['/Boxes/0', '/Boxes/1'])
  })
  it('reports nothing for a component the entity does not hold, or for no relations at all', () => {
    expect(relationTargets({}, RELATIONS)).toEqual([])
    expect(relationTargets({ Items: [{ box: ref('box', 'b1') }] }, undefined)).toEqual([])
    expect(relationTargets({ Items: [{ box: ref('box', 'b1') }] }, {})).toEqual([])
  })
  it('reads only the properties the entity holds itself, so a name the prototype chain knows reaches nothing', () => {
    expect(relationTargets({}, { constructor: 'box', 'Slot/constructor': 'box' })).toEqual([])
    expect(relationTargets({ Slot: {} }, { 'Slot/constructor': 'box' })).toEqual([])
  })
})

describe('the dependants of an entity', () => {
  /** A kind whose entities may hold another of their kind, itself among them, with a delete that removes its dependants. */
  function nodes(): Store {
    const registry = toyRegistry((r) => {
      r.kind('node', { prefix: 'n', relations: { Parent: 'node' } })
      r.verb<{ parent?: string }>({
        name: 'node.create', target: 'node', mints: true,
        input: { type: 'object', properties: { parent: { type: 'string', 'x-ref': 'node' } }, additionalProperties: false },
        apply: (d, i, c) => d.add('node', c.id!, i.parent === undefined ? {} : { Parent: ref('node', i.parent) }),
        describe: () => 'Add a node',
      })
      r.verb<{ id: string; parent: string }>({
        name: 'node.adopt', target: 'node',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'node' }, parent: { type: 'string', 'x-ref': 'node' } }, required: ['id', 'parent'], additionalProperties: false },
        apply: (d, i) => d.set('node', i.id, 'Parent', ref('node', i.parent)),
        describe: (i) => `Put node ${i.id} under ${i.parent}`,
      })
      r.verb<{ id: string }>({
        name: 'node.delete', target: 'node',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'node' } }, required: ['id'], additionalProperties: false },
        apply: (d, i) => {
          for (const x of dependants(d, 'node', i.id)) d.remove(x.kind, x.id)
          d.remove('node', i.id)
        },
        describe: (i) => `Delete node ${i.id} and what is under it`,
      })
    })
    const store = createStore(registry)
    expect(store.run([call('node.create', {}), call('node.create', { parent: 'n1' }), call('node.adopt', { id: 'n1', parent: 'n1' })], person).ok).toBe(true)
    return store
  }

  it('gives an entity that holds the reference in several places once', () => {
    const { store } = furnished()
    const held = store.refs('box', 'b2').map((x) => `${x.kind} ${x.id}`)
    expect(held.filter((x) => x === 'shelf s1'), 'the precondition: the shelf holds b2 in two places').toHaveLength(2)
    expect(dependants(store, 'box', 'b2').map((x) => `${x.kind} ${x.id}`)).toEqual(['bag g1', 'shelf s1'])
  })
  it('leaves the entity itself out when it holds a reference to itself', () => {
    const store = nodes()
    expect(store.refs('node', 'n1').map((x) => x.id).sort(), 'the precondition: n1 holds itself, and n2 holds n1').toEqual(['n1', 'n2'])
    expect(dependants(store, 'node', 'n1')).toEqual([{ kind: 'node', id: 'n2' }])
  })
  it('lets a delete that removes each one commit, where an entity holds the target twice and where the target holds itself', () => {
    const { store } = furnished()
    const r = store.run([call('box.delete', { id: 'b2', cascade: true })], person)
    expect(r.ok && r.records.map((x) => `${x.op}:${x.kind}:${x.id}`).sort()).toEqual(['remove:bag:g1', 'remove:box:b2', 'remove:shelf:s1'])
    const tree = nodes()
    const gone = tree.run([call('node.delete', { id: 'n1' })], person)
    expect(gone.ok && gone.records.map((x) => `${x.op}:${x.kind}:${x.id}`).sort()).toEqual(['remove:node:n1', 'remove:node:n2'])
  })
})

describe('after every verb, at the boundary', () => {
  it('sees a dangling reference where a relation does not name its place (seeded), so the check below can fail', () => {
    const { registry, store } = holding({ Items: 'box' })
    expect(store.run([create('Alpha'), call('bag.create', { items: [{ box: 'b1', qty: 1 }] })], person).ok).toBe(true)
    expect(store.run([call('box.delete', { id: 'b1' })], person)).toMatchObject({ ok: true, changed: true })
    expect(dangling(store, registry)).toEqual(['bag g1/Items/0/box -> box b1'])
  })
  it('leaves no reference dangling after any verb, a refused one, an undo or a redo, in a list, an object, two lists deep and a pair of kinds', () => {
    const { registry, store } = furnished()
    expect(dangling(store, registry)).toEqual([])
    const steps: Call[] = [
      call('box.delete', { id: 'b1' }),
      call('box.delete', { id: 'b1', cascade: true }),
      call('crate.delete', { id: 'c1' }),
      call('crate.delete', { id: 'c1', cascade: true }),
      call('bag.create', { items: [{ box: 'b2', qty: 3 }] }),
      call('box.delete', { id: 'b2', cascade: true }),
    ]
    for (const step of steps) {
      store.run([step], person)
      expect({ step: JSON.stringify(step), dangling: dangling(store, registry) }).toEqual({ step: JSON.stringify(step), dangling: [] })
    }
    while (store.undoDepth > 1) {
      expect(store.undo('person').ok).toBe(true)
      expect(dangling(store, registry)).toEqual([])
    }
    while (store.redoDepth > 0) {
      expect(store.redo('person').ok).toBe(true)
      expect(dangling(store, registry)).toEqual([])
    }
  })
  it('refuses a delete naming each dependant with the place that holds the reference, and nothing that holds another box', () => {
    const { store } = furnished()
    const before = { hash: store.hash(), undo: store.undoDepth, log: store.log.length }
    const r = store.run([call('box.delete', { id: 'b1' })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'validation', at: 0 } })
    const message = r.ok === false ? r.refusal.issues[0]!.message : ''
    for (const place of ['label l1 at /On', 'bag g1 at /Items/1/box', 'shelf s1 at /Rows/1/Cells/1/box', 'desk d1 at /Slot/box', 'flag f1 at /Target']) expect(message).toContain(place)
    expect(message).not.toContain('flag f2')
    expect(message).not.toContain('/Items/0/box')
    expect({ hash: store.hash(), undo: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('refuses the delete of the crate the same way, naming the flag that points at it', () => {
    const { store } = furnished()
    const r = store.run([call('crate.delete', { id: 'c1' })], person)
    expect(r.ok === false && r.refusal.issues[0]!.message).toBe('crate c1 is still held by flag f2 at /Target')
  })
  it('removes with cascade exactly the entities that hold the reference, once each, and undo brings them back in their places', () => {
    const { store } = furnished()
    const ids = (kind: string): string[] => store.ids(kind)
    const start = store.hash()
    const r = store.run([call('box.delete', { id: 'b1', cascade: true })], person)
    expect(r.ok && r.records.map((x) => `${x.op}:${x.kind}:${x.id}`).sort()).toEqual(['remove:bag:g1', 'remove:box:b1', 'remove:desk:d1', 'remove:flag:f1', 'remove:label:l1', 'remove:shelf:s1'])
    expect([ids('box'), ids('crate'), ids('bag'), ids('shelf'), ids('desk'), ids('flag'), ids('label')]).toEqual([['b2'], ['c1'], [], [], [], ['f2'], []])
    expect(store.undo('person').ok).toBe(true)
    expect(store.hash()).toBe(start)
    expect(places(store, 'box', 'b2').filter((p) => p.startsWith('shelf'))).toEqual(['shelf s1 Rows /Rows/0/Cells/0/box', 'shelf s1 Rows /Rows/1/Cells/0/box'])
  })
  it('sees a reference an earlier call of the same batch wrote', () => {
    const { store } = holding()
    store.run([create('Alpha')], person)
    const r = store.run([call('bag.create', { items: [{ box: 'b1', qty: 1 }] }), call('box.delete', { id: 'b1' })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'validation', at: 1 } })
    expect(r.ok === false && r.refusal.issues[0]!.message).toContain('bag g1 at /Items/0/box')
    expect(store.has('box', 'b1')).toBe(true)
    expect(store.has('bag', 'g1')).toBe(false)
  })
})
