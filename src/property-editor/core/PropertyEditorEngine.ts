import type { ChangeEvent, FieldDescriptor, FieldValues, ValidationError } from './types'

type ChangeListener = (e: ChangeEvent) => void

/* Framework-free by construction -- no DOM, no Vue, no custom-element APIs. This is the piece a
 * desk drawer, a Vue wrapper, and a future non-Vue consumer can all sit on top of without agreeing
 * on anything except this contract. Mirrors @quintus/viewer's actual shape (core/ has zero Vue
 * imports; the wrapper is a separate, thin layer) -- not a new convention invented for this. */
export class PropertyEditorEngine {
  private fields: FieldDescriptor[]
  private values: FieldValues
  private listeners = new Set<ChangeListener>()

  constructor(fields: FieldDescriptor[], initialValues: FieldValues = {}) {
    this.fields = fields
    this.values = { ...initialValues }
  }

  getFields(): readonly FieldDescriptor[] {
    return this.fields
  }

  getField(key: string): FieldDescriptor | undefined {
    return this.fields.find((f) => f.key === key)
  }

  getValue(key: string): unknown {
    return this.values[key]
  }

  getValues(): Readonly<FieldValues> {
    return { ...this.values }
  }

  /* The one mutation path. Every value change -- whatever widget it came from -- goes through
     here, so "what changed and to what" is always observable the same way, regardless of field
     type. A caller building an undo stack (the desk drawers already have one -- Quarter Timeline's
     snapshot()/undo()) hooks in here, once, rather than once per field type. */
  setValue(key: string, value: unknown): void {
    const field = this.getField(key)
    if (!field) {
      throw new Error(`PropertyEditorEngine: no field descriptor for key "${key}"`)
    }
    const previous = this.values[key]
    if (previous === value) return // no-op changes don't enter history or fire listeners
    this.values[key] = value
    const event: ChangeEvent = { key, value, previous }
    this.listeners.forEach((fn) => fn(event))
  }

  onChange(fn: ChangeListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /* Deliberately minimal: required-ness and enum-membership only. Anything domain-specific (an
     IFC entity's real constraints, a date range) is the caller's validation layered on top --
     this engine does not know enough about any one domain to validate more than its own contract. */
  validate(): ValidationError[] {
    const errors: ValidationError[] = []
    for (const field of this.fields) {
      const value = this.values[field.key]
      const isEmpty = value === undefined || value === null || value === ''
      if (field.required && isEmpty) {
        errors.push({ key: field.key, message: `${field.label} is required` })
        continue
      }
      if (field.type === 'enum' && !isEmpty && field.options) {
        const valid = field.options.some((o) => o.value === value)
        if (!valid) {
          errors.push({ key: field.key, message: `${field.label}: "${String(value)}" is not a valid option` })
        }
      }
    }
    return errors
  }

  isValid(): boolean {
    return this.validate().length === 0
  }

  toJSON(): FieldValues {
    return this.getValues()
  }
}
