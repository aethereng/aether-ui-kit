import type { Actor, Json, KindSpec, ReadVerb, Reader, Schema, System, Verb } from './contracts'
import { PROTO_KEY, equal, own } from './json'
import { parsePath, resolvePath, isValidName } from './path'
import { relationProblem } from './relations'
import { refKinds, toCallSchema, unreadKeywords } from './schema'

const RESERVED_VERBS = new Set(['undo', 'redo'])

export interface Registry {
  readonly kinds: ReadonlyMap<string, KindSpec>
  readonly verbs: ReadonlyMap<string, Verb>
  readonly systems: readonly System[]
  readonly reads: ReadonlyMap<string, ReadVerb>
  kind(name: string, spec: KindSpec): void
  verb<I extends Json>(verb: Verb<I>): void
  system(system: System): void
  read(read: ReadVerb): void
  /** The id space a kind's ids live in: its group, or the kind itself. */
  space(kind: string): string
  /** The schema of a proposal, its items a union over the verbs the actor may call. */
  proposalSchema(actor: Actor): Schema
  /** The schema of a read: a union over the read verbs. */
  readSchema(): Schema
}

const variant = (name: string, input: Schema, extra: { [k: string]: Json }): Schema => ({
  type: 'object',
  properties: { verb: { type: 'string', enum: [name] }, input: toCallSchema(input), ...extra },
  required: ['verb', 'input'],
  additionalProperties: false,
})

/** The store as the one JSON value `model.read` reads a path in: given the committed content and the names of the registered kinds. */
export type Projection = (reader: Reader, kinds: readonly string[]) => Json

/**
 * An empty registry holding the read verbs every vocabulary shares; an app registers its kinds, verbs and systems into
 * it. A projection given in the options replaces the default one (each kind to its entities by id, each entity to its
 * components) in `model.read`, so a vocabulary can serve a read shape of its own.
 */
export function createRegistry(options: { project?: Projection } = {}): Registry {
  const project = options.project ?? projection
  const kinds = new Map<string, KindSpec>()
  const verbs = new Map<string, Verb>()
  const systems: System[] = []
  const reads = new Map<string, ReadVerb>()

  const registry: Registry = {
    kinds,
    verbs,
    systems,
    reads,
    kind(name, spec) {
      if (kinds.has(name)) throw new Error(`kind '${name}' is registered twice`)
      if (!isValidName(name) || !isValidName(spec.prefix) || (spec.group !== undefined && !isValidName(spec.group))) throw new Error(`kind '${name}', its prefix and its group must hold no reserved character, no whitespace, no leading '#', and must not be named ${PROTO_KEY}`)
      for (const [relation, declared] of Object.entries(spec.relations ?? {})) {
        const problem = relationProblem(relation, declared)
        if (problem !== null) throw new Error(`kind '${name}' relation '${relation}' ${problem}`)
      }
      for (const [other, s] of kinds) {
        if (s.prefix === spec.prefix && registry.space(other) === (spec.group ?? name)) {
          throw new Error(`kinds '${other}' and '${name}' share the prefix '${spec.prefix}' in one id space`)
        }
      }
      kinds.set(name, spec)
    },
    verb(verb) {
      const v = verb as unknown as Verb
      if (verbs.has(v.name) || RESERVED_VERBS.has(v.name)) throw new Error(`verb '${v.name}' is registered twice or reserved`)
      if (!kinds.has(v.target)) throw new Error(`verb '${v.name}' targets the kind '${v.target}', which is not registered`)
      if (!v.name.startsWith(`${v.target}.`) || v.name.length === v.target.length + 1) throw new Error(`verb '${v.name}' is not named '${v.target}.<action>'`)
      const unknownMinted = v.mintsOther?.find((k) => !kinds.has(k))
      if (unknownMinted !== undefined) throw new Error(`verb '${v.name}' mints the kind '${unknownMinted}', which is not registered`)
      const unread = unreadKeywords(v.input)
      if (unread.length > 0) throw new Error(`verb '${v.name}' uses schema keywords or forms the checker does not read: ${unread.join(', ')}`)
      const unknownRef = refKinds(v.input).find((k) => !kinds.has(k))
      if (unknownRef !== undefined) throw new Error(`verb '${v.name}' has an x-ref to the kind '${unknownRef}', which is not registered`)
      verbs.set(v.name, v)
    },
    system(system) {
      if (systems.some((s) => s.name === system.name)) throw new Error(`system '${system.name}' is registered twice`)
      systems.push(system)
    },
    read(read) {
      if (reads.has(read.name)) throw new Error(`read verb '${read.name}' is registered twice`)
      reads.set(read.name, read)
    },
    space: (kind) => kinds.get(kind)?.group ?? kind,
    proposalSchema(actor) {
      const allowed = [...verbs.values()].filter((v) => v.actors === undefined || v.actors.includes(actor))
      return {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: { anyOf: allowed.map((v) => variant(v.name, v.input, { as: { type: 'string' }, basis: {} })) },
          },
        },
        required: ['items'],
        additionalProperties: false,
      }
    },
    readSchema() {
      return { anyOf: [...reads.values()].map((r) => variant(r.name, r.input, {})) }
    },
  }

  const kindProp: Schema = { type: 'string' }
  registry.read({
    name: 'entity.get',
    input: { type: 'object', properties: { kind: kindProp, id: { type: 'string' } }, required: ['kind', 'id'], additionalProperties: false },
    run: (reader, input) => {
      const { kind, id } = input as { kind: string; id: string }
      return (reader.get(kind, id) as Json | undefined) ?? null
    },
  })
  registry.read({
    name: 'entity.list',
    input: {
      type: 'object',
      properties: { kind: kindProp, filter: { type: 'object' } },
      required: ['kind'],
      additionalProperties: false,
    },
    run: (reader, input) => {
      const { kind, filter } = input as { kind: string; filter?: { [component: string]: Json } }
      const out: Json[] = []
      for (const id of reader.ids(kind)) {
        const components = reader.get(kind, id)
        if (components === undefined) continue
        if (filter !== undefined && !Object.entries(filter).every(([c, want]) => equal(own(components, c), want))) continue
        out.push({ id, components: components as Json })
      }
      return out
    },
  })
  registry.read({
    name: 'entity.refs',
    input: { type: 'object', properties: { kind: kindProp, id: { type: 'string' } }, required: ['kind', 'id'], additionalProperties: false },
    run: (reader, input) => {
      const { kind, id } = input as { kind: string; id: string }
      return reader.refs(kind, id).map((r) => ({ kind: r.kind, id: r.id, component: r.component, at: r.at }))
    },
  })
  registry.read({
    name: 'model.read',
    input: { type: 'object', properties: { path: { type: 'string' } }, additionalProperties: false },
    run: (reader, input, kindNames): Json => {
      const { path } = input as { path?: string }
      const steps = parsePath(path ?? '')
      if (steps === null) return { found: false, why: 'The path does not read as a dotted path of fields with ids and positions in brackets.' }
      const value = resolvePath(project(reader, kindNames), steps)
      return value === undefined ? { found: false } : { found: true, value }
    },
  })

  return registry
}

/** The store as one JSON value: each kind to its entities by id, each entity to its components. */
export function projection(reader: Reader, kindNames: readonly string[]): Json {
  const root: { [kind: string]: Json } = {}
  for (const kind of kindNames) {
    const entities: { [id: string]: Json } = {}
    for (const id of reader.ids(kind)) {
      const c = reader.get(kind, id)
      if (c !== undefined) entities[id] = c as Json
    }
    root[kind] = entities
  }
  return root
}
