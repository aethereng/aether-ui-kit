// A toy vocabulary for the record parts' tests: parts with every kind of field and no variants, fixings whose fields
// follow their variant, stocks a part names, and shelves, whose tag is declared last. The units show a length in mm, a
// force in kN and a force per length in kN/mm.
import type { Schema } from '../../../verbs'
import type { KindDecl, Units } from '..'
import type { Row } from '../cells'

const num: Schema = { type: 'number' }
const vec3: Schema = { type: 'array', items: num, minItems: 3, maxItems: 3 }
const orNull = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] })

export const PARTS: KindDecl = {
  name: 'parts',
  word: 'part',
  fields: {
    size: { schema: num, label: 'Size of the part', short: 'Size', quantity: 'length', group: 'Shape' },
    stock: { schema: { type: 'string', 'x-ref': 'stocks' }, label: 'Stock' },
    count: { schema: { type: 'integer' }, optional: true, label: 'Count', advanced: true },
    finish: { schema: { enum: ['raw', 'painted'] }, optional: true, label: 'Finish' },
    at: { schema: orNull(vec3), optional: true, label: 'Place', quantity: 'length', control: 'vector', group: 'Shape' },
    made: { schema: { type: 'string' }, optional: true, label: 'Made by' },
    kept: { schema: { type: 'boolean' }, optional: true, label: 'Kept' },
    sides: { schema: { type: 'array', items: { enum: ['left', 'right', 'top'] } }, optional: true, label: 'Sides' },
    locks: {
      schema: orNull({ type: 'object', properties: { a: { type: 'boolean' }, b: { type: 'boolean' } }, additionalProperties: false }),
      optional: true,
      label: 'Locks',
      control: 'switches',
      options: [
        { value: 'a', label: 'Lock A' },
        { value: 'b', label: 'Lock B' },
      ],
      presets: [{ label: 'Both locked', value: { a: true, b: true } }],
    },
    pair: { schema: { type: 'array', items: { type: 'string', 'x-ref': 'stocks' }, minItems: 2, maxItems: 2 }, optional: true, label: 'Pair', control: 'app' },
    layers: {
      schema: { type: 'array', items: { type: 'object', properties: { depth: num, stock: { type: 'string', 'x-ref': 'stocks' }, push: vec3 } } },
      optional: true,
      label: 'Layers',
      control: 'rows',
      columns: [
        { key: 'depth', label: 'Depth', quantity: 'length' },
        { key: 'stock', label: 'Stock' },
        { key: 'push', label: 'Push', quantity: 'force' },
      ],
    },
    extra: { schema: { type: 'object' }, optional: true, label: 'Extra', control: 'json', advanced: true },
  },
}

export const FIXINGS: KindDecl = {
  name: 'fixings',
  word: 'fixing',
  tag: 'by',
  common: ['note'],
  fields: {
    by: { schema: { enum: ['bolt', 'weld', 'glue'] }, label: 'Kind' },
    note: { schema: { type: 'string' }, optional: true, label: 'Note' },
    part: { schema: { type: 'string' }, optional: true, label: 'Part' },
    load: { schema: num, optional: true, label: 'Load', quantity: 'force' },
    turns: { schema: num, optional: true, label: 'Turns' },
  },
  variants: {
    bolt: { label: 'A bolt', fields: ['part', 'load', 'turns'], required: ['part'], refs: { part: 'parts' }, needs: 'parts' },
    weld: { label: 'A weld', fields: ['part', 'load'], required: ['part', 'load'], refs: { part: 'stocks' }, quantities: { load: 'lineLoad' }, needs: 'stocks' },
    glue: { label: 'Glue', fields: [], required: [] },
  },
}

/** Stocks: a grade written as free text, a coat chosen in the words declared for it, and a mill and a flag shown only. */
export const STOCKS: KindDecl = {
  name: 'stocks',
  word: 'stock',
  fields: {
    grade: { schema: { type: 'string' }, label: 'Grade' },
    coat: {
      schema: { enum: ['zinc', 'paint'] },
      optional: true,
      label: 'Coat',
      options: [
        { value: 'zinc', label: 'Galvanised steel' },
        { value: 'paint', label: 'Painted in two coats of oxide' },
      ],
    },
    mill: { schema: { enum: ['north', 'south'] }, optional: true, label: 'Mill', readonly: true },
    rolled: { schema: { type: 'boolean' }, optional: true, label: 'Rolled', readonly: true },
  },
}

/** Shelves: the tag declared last and optional, a weight shown and never changed, and lists of the records a shelf names. */
export const SHELVES: KindDecl = {
  name: 'shelves',
  word: 'shelf',
  tag: 'hung',
  common: ['held', 'parts', 'posts', 'outline'],
  fields: {
    width: { schema: num, optional: true, label: 'Width', quantity: 'length' },
    held: { schema: num, optional: true, label: 'Weight held', quantity: 'force', readonly: true },
    parts: { schema: { type: 'array', items: { type: 'string', 'x-ref': 'parts' } }, optional: true, label: 'Parts' },
    posts: { schema: { type: 'array', items: { type: 'string', 'x-ref': 'stocks' }, minItems: 2, maxItems: 2 }, optional: true, label: 'Posts' },
    outline: { schema: orNull({ type: 'array', items: vec3 }), optional: true, label: 'Outline', quantity: 'length', control: 'summary' },
    hung: { schema: { enum: ['wall', 'floor'] }, optional: true, label: 'Hung on' },
  },
  variants: {
    wall: { label: 'On a wall', fields: ['width'], required: [] },
    floor: { label: 'On the floor', fields: [], required: [] },
  },
}

const factor: Record<string, number> = { length: 1000, force: 1e-3, lineLoad: 1e-6 }
const label: Record<string, string> = { length: 'mm', force: 'kN', lineLoad: 'kN/mm' }
/** A length in mm, a force in kN and a force per length in kN/mm, stored in m, N and N/m; any other quantity as stored. */
export const UNITS: Units = {
  label: (q) => label[q],
  shown: (v, q) => v * (factor[q] ?? 1),
  stored: (v, q) => v / (factor[q] ?? 1),
  storedLabel: (q) => ({ length: 'm', force: 'N', lineLoad: 'N/m' })[q],
}

export const row = (id: string, record: Row['record']): Row => ({ id, record })
