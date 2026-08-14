import type { ChangeEvent, FieldDescriptor, FieldValues, ValidationError } from './types'

type ChangeListener = (e: ChangeEvent) => void

/* Field coercion is core-layer logic, same as everything else here: framework-free, so it is
 * testable without mounting anything, and shared by any future non-Vue wrapper. */

/* The HTML spec's grammar for a valid floating-point number (what <input type="number"> itself
 * accepts): optional '-', an integer part that is either "0" or a non-zero-leading digit run,
 * an optional .digits, an optional exponent. `Number()` is NOT this grammar -- it also accepts
 * "1." (as 1), "01" (as 1), "0x10" (as 16), " 5 ", "Infinity" -- so using it alone to decide
 * "is this a complete number" is wrong in a way that only shows up while typing: committing 1
 * for the raw text "1." makes this component write `.value = '1'` back into the still-focused
 * input, silently deleting the '.' the user just typed. Matching the real grammar instead of
 * Number()'s leniency is what keeps every one of those strings correctly "not yet complete". */
const VALID_FLOAT = /^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/

/** What to do with a number input's raw text on one keystroke. `commit: false` means an
 *  INTERMEDIATE state that is not yet a complete number: the caller does nothing and lets the
 *  browser keep showing whatever the user is mid-typing, rather than force a value back in and
 *  fight the cursor position.
 *
 *  `badInput` must be `el.validity.badInput`, and it is NOT optional in practice for a
 *  `<input type="number">`. Per the HTML value-sanitization rules such an input returns the EMPTY
 *  STRING from `.value` for anything it cannot parse -- so "12." mid-decimal and a genuinely
 *  cleared field are indistinguishable from `raw` alone, while the user still sees their "12." on
 *  screen. Committing `undefined` for that would blank the bound value underneath someone
 *  mid-keystroke (and flash a required-field error). `badInput` is the only thing that separates
 *  the two: true = unparseable input present, false = actually empty. */
export type NumberInputResult = { commit: true; value: number | undefined } | { commit: false }

export function coerceNumberInput(raw: string, badInput = false): NumberInputResult {
  if (badInput) return { commit: false } // text is present but unparseable -- mid-typing
  if (raw.trim() === '') return { commit: true, value: undefined } // genuinely cleared
  return VALID_FLOAT.test(raw) ? { commit: true, value: Number(raw) } : { commit: false }
}

/** The spinner increment for a number field: the caller's `step` if given, else derived from
 *  `precision` (2 -> 0.01), else undefined (the browser's own default of 1). */
export function numberStep(field: Pick<FieldDescriptor, 'step' | 'precision'>): number | undefined {
  if (field.step !== undefined) return field.step
  if (field.precision === undefined) return undefined
  return 1 / 10 ** field.precision
}

/* Framework-free by construction -- no DOM, no Vue, no custom-element APIs. This is the piece a
 * editing drawer, a Vue wrapper, and a future non-Vue consumer can all sit on top of without agreeing
 * on anything except this contract. Follows the same split as the viz core (core/ has zero Vue
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
     type. A caller building an undo stack (as the timeline surfaces do -- the
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

  /* Deliberately minimal: required-ness, enum-membership, and number range only -- all three are
     STRUCTURAL (shape the descriptor already declares), not domain knowledge. Anything
     domain-specific (an IFC entity's real constraints, a date range) is the caller's validation
     layered on top -- this engine does not know enough about any one domain to validate more
     than its own contract. */
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
          errors.push({
            key: field.key,
            message: `${field.label}: "${String(value)}" is not a valid option`,
          })
        }
      }
      if (field.type === 'number' && !isEmpty && typeof value === 'number' && Number.isFinite(value)) {
        if (field.min !== undefined && value < field.min) {
          errors.push({ key: field.key, message: `${field.label} must be at least ${field.min}` })
        } else if (field.max !== undefined && value > field.max) {
          errors.push({ key: field.key, message: `${field.label} must be at most ${field.max}` })
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
