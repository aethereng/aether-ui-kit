import { describe, expect, it, vi } from 'vitest'
import { PropertyEditorEngine } from '../PropertyEditorEngine'
import type { FieldDescriptor } from '../types'

/* This static field set mirrors aether-quarter-timeline.html's drawer verbatim (title, type,
   status, start, end, anchor, note) -- the desk's own simplest real caller. */
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

describe('PropertyEditorEngine — static field list (desk drawer shape)', () => {
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

describe('PropertyEditorEngine — schema-derived field list (Etere IfcEntityPanel shape)', () => {
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
