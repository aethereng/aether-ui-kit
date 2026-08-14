import { describe, expect, it, vi } from 'vitest'
import { coerceNumberInput, numberStep, PropertyEditorEngine } from '../PropertyEditorEngine'
import type { FieldDescriptor } from '../types'

/* A static field set of the shape a timeline drawer really uses (title, type, status,
   start, end, anchor, note) -- the simplest real caller. */
const timelineEventFields: FieldDescriptor[] = [
  { key: 'title', type: 'text', label: 'Title', required: true },
  {
    key: 'type',
    type: 'enum',
    label: 'Type',
    variant: 'buttons',
    options: [
      { value: 'launch', label: 'Launch' },
      { value: 'engineering', label: 'Engineering' },
      { value: 'commercial', label: 'Commercial' },
    ],
  },
  {
    key: 'status',
    type: 'enum',
    label: 'Status',
    variant: 'buttons',
    options: [
      { value: 'committed', label: 'Committed' },
      { value: 'planned', label: 'Planned' },
      { value: 'open', label: 'Open' },
    ],
  },
  { key: 'start', type: 'date', label: 'Start', required: true },
  { key: 'end', type: 'date', label: 'End' },
  { key: 'anchor', type: 'boolean', label: 'Anchor' },
  { key: 'note', type: 'textarea', label: 'Note' },
]

describe('PropertyEditorEngine — static field list (editing-drawer shape)', () => {
  it('reads back the initial values it was constructed with', () => {
    const engine = new PropertyEditorEngine(timelineEventFields, {
      title: 'Scope freeze',
      type: 'launch',
      status: 'committed',
      start: '2026-08-21',
    })
    expect(engine.getValue('title')).toBe('Scope freeze')
    expect(engine.getValue('status')).toBe('committed')
    expect(engine.getValue('note')).toBeUndefined()
  })

  it('fires exactly one change event per real change, none for no-ops', () => {
    const engine = new PropertyEditorEngine(timelineEventFields, { title: 'X' })
    const onChange = vi.fn()
    engine.onChange(onChange)

    engine.setValue('title', 'Y')
    engine.setValue('title', 'Y') // same value -- must not fire again

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ key: 'title', value: 'Y', previous: 'X' })
  })

  it('required + missing fails validation; filling it passes', () => {
    const engine = new PropertyEditorEngine(timelineEventFields, {})
    expect(engine.isValid()).toBe(false)
    expect(engine.validate().map((e) => e.key)).toEqual(expect.arrayContaining(['title', 'start']))

    engine.setValue('title', 'Scope freeze')
    engine.setValue('start', '2026-08-21')
    expect(engine.isValid()).toBe(true)
  })

  it('rejects an enum value outside its own option list', () => {
    const engine = new PropertyEditorEngine(timelineEventFields, {
      title: 'X',
      start: '2026-08-21',
    })
    engine.setValue('status', 'not-a-real-status')
    const errors = engine.validate()
    expect(errors.some((e) => e.key === 'status')).toBe(true)
  })

  it('throws on a key with no descriptor, rather than silently accepting stray data', () => {
    const engine = new PropertyEditorEngine(timelineEventFields, {})
    expect(() => engine.setValue('not_a_real_field', 'x')).toThrow(/no field descriptor/)
  })
})

describe('PropertyEditorEngine — schema-derived field list (IFC entity-panel shape)', () => {
  /* The point of this second block: the SAME engine, unmodified, handles a field list built at
     runtime from a schema rather than typed out by hand -- proving the static/schema-derived axis
     is a caller concern, not something this engine needs to know about. */
  function fieldsFromIfcAttributeSchema(
    attrs: Array<{ name: string; kind: string }>,
  ): FieldDescriptor[] {
    return attrs.map((a) => ({
      key: a.name,
      label: a.name,
      type: a.kind === 'ref' ? 'reference' : a.kind === 'placement' ? 'placement' : 'text',
    }))
  }

  it('builds and validates a field set nobody hand-wrote', () => {
    const schema = [
      { name: 'GlobalId', kind: 'text' },
      { name: 'ObjectPlacement', kind: 'placement' },
      { name: 'ContainedInStructure', kind: 'ref' },
    ]
    const engine = new PropertyEditorEngine(fieldsFromIfcAttributeSchema(schema), {
      GlobalId: '2N1SPbb6r4CvTLh$Fdz8xY',
    })
    expect(engine.getField('ObjectPlacement')?.type).toBe('placement')
    expect(engine.getField('ContainedInStructure')?.type).toBe('reference')
    expect(engine.getValue('GlobalId')).toBe('2N1SPbb6r4CvTLh$Fdz8xY')
  })
})

describe('coerceNumberInput', () => {
  it('commits a complete integer or decimal, including a trailing zero', () => {
    expect(coerceNumberInput('5')).toEqual({ commit: true, value: 5 })
    expect(coerceNumberInput('-12.5')).toEqual({ commit: true, value: -12.5 })
    // "1.50" IS a complete number per the grammar (trailing zero is a real digit) -- only
    // the FIRST keystroke that produced "1." along the way was incomplete, not this one.
    expect(coerceNumberInput('1.50')).toEqual({ commit: true, value: 1.5 })
  })

  it('commits undefined for an emptied field -- cleared, not intermediate', () => {
    expect(coerceNumberInput('')).toEqual({ commit: true, value: undefined })
    expect(coerceNumberInput('   ')).toEqual({ commit: true, value: undefined })
  })

  /* The case that makes badInput necessary rather than nice-to-have. A <input type="number">
     returns '' from .value for ANY text it cannot parse, so "12." mid-decimal and a cleared field
     look identical from `raw` -- while the user still sees "12." on screen. Committing undefined
     there would blank the bound value under their cursor. */
  it('does NOT commit an empty raw value when badInput says text is present but unparseable', () => {
    expect(coerceNumberInput('', true)).toEqual({ commit: false })
  })

  it('still commits undefined for an empty raw value when badInput is false -- truly cleared', () => {
    expect(coerceNumberInput('', false)).toEqual({ commit: true, value: undefined })
  })

  it('does NOT commit an in-progress keystroke, so the caller leaves the input alone', () => {
    // real states a native <input type="number"> reports mid-typing "-5.2e3"
    expect(coerceNumberInput('-')).toEqual({ commit: false })
    expect(coerceNumberInput('1.')).toEqual({ commit: false })
    expect(coerceNumberInput('1e')).toEqual({ commit: false })
  })

  it('does NOT commit a string Number() would silently accept but the number grammar would not', () => {
    // Number()'s leniency is exactly what made "1." above look "finite" and wrongly commit --
    // these are the same class of mistake, caught by matching the real grammar instead.
    expect(coerceNumberInput('01')).toEqual({ commit: false }) // leading zero
    expect(coerceNumberInput('0x10')).toEqual({ commit: false }) // hex
    expect(coerceNumberInput('Infinity')).toEqual({ commit: false })
    expect(coerceNumberInput('5 ')).toEqual({ commit: false }) // trailing space inside the field
  })
})

describe('numberStep', () => {
  it('an explicit step always wins', () => {
    expect(numberStep({ step: 5, precision: 2 })).toBe(5)
  })

  it('derives a step from precision when step is absent', () => {
    expect(numberStep({ precision: 2 })).toBe(0.01)
    expect(numberStep({ precision: 0 })).toBe(1)
  })

  it('is undefined when neither is given, so the browser default (1) applies', () => {
    expect(numberStep({})).toBeUndefined()
  })
})

describe('PropertyEditorEngine — number fields', () => {
  const doseFields: FieldDescriptor[] = [
    { key: 'load', type: 'number', label: 'Design load', min: 0, max: 500, suffix: 'kN' },
  ]

  it('range-checks a number field the same way enum membership is checked', () => {
    const engine = new PropertyEditorEngine(doseFields, { load: 800 })
    expect(engine.validate().some((e) => e.key === 'load')).toBe(true)
    engine.setValue('load', 120)
    expect(engine.isValid()).toBe(true)
  })

  it('an empty number field is not itself a range violation', () => {
    const engine = new PropertyEditorEngine(doseFields, {})
    expect(engine.validate().some((e) => e.key === 'load')).toBe(false)
  })

  it('a non-finite stored value is not range-checked -- it is not this engine\'s job to repair it', () => {
    const engine = new PropertyEditorEngine(doseFields, { load: NaN })
    expect(engine.validate().some((e) => e.key === 'load')).toBe(false)
  })
})
