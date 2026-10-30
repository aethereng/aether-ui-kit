// A field of a record, mounted from the toy kinds' declarations through formFields: what each control shows, what it gives
// when it is left or Enter is pressed, and what it gives nothing for.
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import RecordField from '../RecordField.vue'
import { STORED, exampleOf, formFields, shapeLine, type FieldView, type FormContext } from '../../core'
import { PARTS, SHELVES, UNITS } from '../../core/__tests__/toy'
import type { Json } from '../../../verbs'

const context: FormContext = { ids: (kind) => ({ stocks: ['s1', 's2'], parts: ['p1'] })[kind] ?? [], word: (kind) => kind.slice(0, -1) }
const fieldOf = (name: string, kind = PARTS, variant = ''): FieldView => formFields(kind, variant, context).find((f) => f.name === name)!

function field(name: string, value: Json | undefined, more: Record<string, unknown> = {}, kind = PARTS, variant = '') {
  return mount(RecordField, { props: { field: fieldOf(name, kind, variant), value, units: UNITS, ...more }, attachTo: document.body })
}
const given = (w: VueWrapper): Json[] => (w.emitted('commit') ?? []).map((e) => e[0] as Json)
const said = (w: VueWrapper): string[] => (w.emitted('invalid') ?? []).map((e) => e[0] as string)
/** Types into an input as a person does, then leaves it (`change`), presses Enter, or neither. */
async function type(w: VueWrapper, selector: string, text: string, leave: 'change' | 'enter' | 'stay' = 'change'): Promise<void> {
  const input = w.find(selector)
  ;(input.element as HTMLInputElement).value = text
  await input.trigger('input')
  if (leave === 'change') await input.trigger('change')
  else if (leave === 'enter') await input.trigger('keydown', { key: 'Enter' })
}

describe('a number', () => {
  it('shows the stored number in its unit, and gives a typed one as the record stores it', async () => {
    const w = field('size', 0.0125)
    expect((w.find('input[data-field="size"]').element as HTMLInputElement).value).toBe('12.5')
    expect(w.find('.aether-record-field__unit').text()).toBe('mm')
    await type(w, 'input[data-field="size"]', '20')
    expect(given(w)).toEqual([0.02])
  })

  it('gives nothing when left as it shows, a blank as null, and answers text that is not a number', async () => {
    const w = field('size', 0.30000000000000004, { units: STORED })
    await type(w, 'input[data-field="size"]', '0.3')
    expect(given(w), 'left as it shows').toEqual([])
    await type(w, 'input[data-field="size"]', '', 'enter')
    expect(given(w)).toEqual([null])
    await type(w, 'input[data-field="size"]', 'ten')
    expect(said(w)).toEqual(['Write a number, such as 1'])
    expect(given(w)).toEqual([null])
  })
})

describe('a vector', () => {
  it('shows three numbers in the unit, and gives nothing when focus leaves the group with nothing typed', async () => {
    const w = field('at', [0.1, 0.2, 0.30000000000000004], {}, PARTS)
    const parts = w.findAll('input[data-field="at"]').map((i) => (i.element as HTMLInputElement).value)
    expect(parts).toEqual(['100', '200', '300'])
    expect(w.find('[data-unit]').text()).toBe(', mm')
    await w.find('.aether-record-field__vector').trigger('focusout')
    expect(given(w)).toEqual([])
  })

  it('gives the typed number and keeps the stored number of each part left as it shows', async () => {
    const w = field('at', [0.1, 0.2, 0.30000000000000004], { units: STORED })
    await type(w, 'input[data-axis="x"]', '5', 'enter')
    expect(given(w)).toEqual([[5, 0.2, 0.30000000000000004]])
    await type(w, 'input[data-axis="y"]', 'y', 'stay')
    await w.find('.aether-record-field__vector').trigger('focusout')
    expect(said(w)).toEqual(['Give x, y and z, each a number'])
  })
})

describe('a choice', () => {
  it('offers its blank and its options, gives a blank as null, and links to the record chosen among its options', async () => {
    const w = field('stock', 's2')
    const options = [...(w.find('select').element as HTMLSelectElement).options].map((o) => o.text)
    expect(options).toEqual(['(choose)', 's1', 's2'])
    const link = w.find('[data-open-ref]')
    expect([link.attributes('data-open-ref'), link.text()]).toEqual(['s2', 'Open stock s2'])
    await link.trigger('click')
    expect(w.emitted('open')).toEqual([['s2']])
    await w.find('select').setValue('')
    expect(given(w)).toEqual([null])
    expect(field('stock', 'gone').find('[data-open-ref]').exists(), 'a value naming no option').toBe(false)
    expect(field('finish', 'raw').find('[data-open-ref]').exists(), 'a choice of no kind of record').toBe(false)
  })
})

describe('switches', () => {
  it('gives an object of the flags on, null when none is, and a preset as it is declared', async () => {
    const w = field('locks', { a: true })
    const b = w.find('input[data-option="b"]')
    await b.setValue(true)
    expect(given(w)).toEqual([{ a: true, b: true }])
    await w.find('input[data-option="a"]').setValue(false)
    expect(given(w).at(-1)).toEqual(null)
    await w.find('[data-preset="Both locked"]').trigger('click')
    expect(given(w).at(-1)).toEqual({ a: true, b: true })
  })

  it('gives a list of the names on, in the order offered', async () => {
    const w = field('sides', ['top'])
    await w.find('input[data-option="left"]').setValue(true)
    expect(given(w)).toEqual([['left', 'top']])
  })
})

describe('a list of references', () => {
  it('gives a list of a fixed count only once it is whole', async () => {
    const w = field('posts', undefined, {}, SHELVES, 'wall')
    const selects = w.findAll('select')
    expect(selects.length).toBe(2)
    await selects[0]!.setValue('s1')
    expect(given(w), 'one of two').toEqual([])
    await selects[1]!.setValue('s2')
    expect(given(w)).toEqual([['s1', 's2']])
  })

  it('offers one more choice than the entries a list of no fixed count holds', () => {
    expect(field('parts', ['p1'], {}, SHELVES, 'wall').findAll('select').length).toBe(2)
  })
})

describe('a table of entries', () => {
  const layers = [
    { depth: 0.0123456789012345, stock: 's1', push: [1000, 0, 0] },
    { depth: 0.002, stock: 's2', push: [0, 0, 0] },
  ]

  it('shows each column in its unit, a vector as three numbers, and gives nothing when a row is left with nothing typed', async () => {
    const w = field('layers', layers)
    expect(w.findAll('th').map((h) => h.text())).toEqual(['#', 'Depth (mm)', 'Stock', 'Push (kN)', 'Remove'])
    expect(w.findAll('tr[data-row="0"] input').map((i) => (i.element as HTMLInputElement).value)).toEqual(['12.3456789012', '1', '0', '0'])
    await w.find('tr[data-row="0"]').trigger('focusout')
    expect(given(w)).toEqual([])
  })

  it('gives the typed cell and keeps the stored numbers of every cell left as it shows', async () => {
    const w = field('layers', layers)
    await type(w, 'tr[data-row="1"] input', '5', 'stay')
    await w.find('tr[data-row="1"]').trigger('focusout')
    expect(given(w)).toEqual([[layers[0], { ...layers[1], depth: 0.005 }]])
  })

  it('copies the last row into a row added, and keeps the rows that stay when one is removed', async () => {
    const w = field('layers', layers)
    await w.find('.aether-record-field__add').trigger('click')
    expect(given(w)).toEqual([[...layers, layers[1]]])
    await w.find('tr[data-row="0"] .aether-record-field__remove').trigger('click')
    expect(given(w).at(-1)).toEqual([layers[1]])
  })

  it('starts a first row from zeros, a vector as three, and a choice at its first option', async () => {
    const w = field('layers', undefined)
    await w.find('.aether-record-field__add').trigger('click')
    expect(given(w)).toEqual([[{ depth: 0, stock: 's1', push: [0, 0, 0] }]])
  })
})

describe('a summary, a free text and JSON', () => {
  it("shows the app's line and edits the value as text in the stored unit", async () => {
    const w = field('outline', [[0, 0, 0]], { summary: 'One corner' }, SHELVES, 'wall')
    expect(w.find('[data-summary="outline"]').text()).toBe('One corner')
    expect(w.find('.aether-disclosure, [aria-expanded]').text()).toContain('Edit as text, in m')
    expect(field('outline', [[0, 0, 0], [1, 0, 0]], {}, SHELVES, 'wall').find('[data-summary]').text(), 'no line given').toBe('2 entries')
  })

  it('gives a free text trimmed, and a blank as null', async () => {
    const w = field('made', 'Ann')
    await type(w, 'input[data-field="made"]', ' Bea ')
    expect(given(w)).toEqual(['Bea'])
    await type(w, 'input[data-field="made"]', '')
    expect(given(w).at(-1)).toBeNull()
  })

  it('gives JSON text as its value, and answers text that is not the shape its schema takes', async () => {
    const w = field('extra', { k: 1 })
    await type(w, 'input[data-field="extra"]', '{"k":2}')
    expect(given(w)).toEqual([{ k: 2 }])
    await type(w, 'input[data-field="extra"]', '[1]')
    expect(said(w)).toEqual(['Write an object between braces, with a name and a value for each entry'])
  })
})

describe('what a field gives nothing for', () => {
  it("draws nothing for the app's own control", () => {
    expect(field('pair', ['s1', 's2']).find('.aether-record-field').exists()).toBe(false)
    expect(field('size', 1).find('.aether-record-field').exists(), 'the positive arm').toBe(true)
  })

  it('shows a field declared read only and gives nothing from it', async () => {
    const w = field('held', 500, {}, SHELVES, 'wall')
    const input = w.find('input[data-field="held"]')
    expect([(input.element as HTMLInputElement).value, (input.element as HTMLInputElement).disabled]).toEqual(['0.5', true])
    await type(w, 'input[data-field="held"]', '9')
    expect(given(w)).toEqual([])
    const open = field('width', 0.5, {}, SHELVES, 'wall').find('input[data-field="width"]')
    expect((open.element as HTMLInputElement).disabled, 'the positive arm: a field not read only').toBe(false)
  })
})

describe('a form around the fields', () => {
  it('gives what is typed and not yet given when the form flushes it', async () => {
    const w = field('size', 0.001)
    await type(w, 'input[data-field="size"]', '3', 'stay')
    expect(given(w)).toEqual([])
    ;(w.vm as unknown as { flush(): void }).flush()
    await nextTick()
    expect(given(w)).toEqual([0.003])
  })

  it('shows a refusal beside the field', () => {
    expect(field('size', 1, { issue: 'Size must be positive' }).find('.aether-record-field__refusal').text()).toContain('Size must be positive')
  })
})

describe('the words for text that cannot be a value', () => {
  it('gives an example of the shape a schema takes, and a line asking for it', () => {
    expect(exampleOf({ type: 'array', items: { type: 'number' }, minItems: 3 })).toEqual([1, 1, 1])
    expect(exampleOf({ type: 'object', properties: { a: { type: 'string', 'x-ref': 'stocks' }, b: { type: 'boolean' } }, required: ['a'] })).toEqual({ a: 'id' })
    expect(exampleOf({ anyOf: [{ type: 'null' }, { enum: ['x', 'y'] }] })).toBe('x')
    expect(shapeLine({ type: 'number' }, 'ten')).toBe('Write a number, such as 1')
    expect(shapeLine({ type: 'array', items: { type: 'number' }, minItems: 2 }, '{}')).toBe('Write a list, such as [1,1]')
    expect(shapeLine({ type: 'object', properties: { n: { type: 'number' } } }, '[]')).toBe('Write an object, such as {"n":1}')
    expect(shapeLine({ type: 'array' }, '[2]')).toBeUndefined()
    expect(shapeLine({ type: 'string' }, 'x')).toBeUndefined()
  })
})
