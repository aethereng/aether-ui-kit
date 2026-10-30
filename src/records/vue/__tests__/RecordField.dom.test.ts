// A field of a record, mounted from the toy kinds' declarations through formFields: what each control shows, what it gives
// when it is left or Enter is pressed, and what it gives nothing for.
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import RecordField from '../RecordField.vue'
import { STORED, exampleOf, formFields, shapeLine, type FieldView, type FormContext, type KindDecl } from '../../core'
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

  // One field of each control, with a value that draws every part of it: a table's rows, a choice's link, a switch's presets.
  const everyKind: [string, Json | undefined, typeof PARTS, string][] = [
    ['size', 1, PARTS, ''],
    ['stock', 's1', PARTS, ''],
    ['finish', 'raw', PARTS, ''],
    ['kept', true, PARTS, ''],
    ['at', [1, 2, 3], PARTS, ''],
    ['made', 'Ann', PARTS, ''],
    ['sides', ['top'], PARTS, ''],
    ['locks', { a: true }, PARTS, ''],
    ['layers', [{ depth: 1, stock: 's1', push: [0, 0, 0] }], PARTS, ''],
    ['extra', { k: 1 }, PARTS, ''],
    ['posts', ['s1', 's2'], SHELVES, 'wall'],
    ['parts', ['p1'], SHELVES, 'wall'],
    ['outline', [[0, 0, 0]], SHELVES, 'wall'],
  ]
  /** Every control a person could change a field with: the link that opens a record changes nothing, so it is not one. */
  const controlsOf = (w: VueWrapper) => w.findAll('input, select, textarea, button').filter((c) => c.attributes('data-open-ref') === undefined)

  it.each(everyKind)('shows %s declared read only with every control it draws disabled', (name, value, kind, variant) => {
    const view = fieldOf(name, kind, variant)
    const locked = controlsOf(field(name, value, { field: { ...view, readonly: true } }, kind, variant))
    expect(locked.length, 'the field draws its controls').toBeGreaterThan(0)
    expect(locked.filter((c) => !(c.element as HTMLInputElement).disabled).map((c) => c.html().slice(0, 80))).toEqual([])
    const open = controlsOf(field(name, value, {}, kind, variant))
    expect(open.length, 'the positive arm draws as many').toBe(locked.length)
    expect(
      open.every((c) => !(c.element as HTMLInputElement).disabled),
      'the positive arm: not read only, every control can be changed',
    ).toBe(true)
  })
})

describe('when a field is left', () => {
  /** Focus leaving an element for another, as a browser fires it when a person moves on. */
  const leave = async (from: Element, to: Element): Promise<void> => {
    from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to }))
    await nextTick()
  }

  it('gives three numbers when focus leaves the group, and nothing while it moves between them', async () => {
    const w = field('at', [1, 2, 3], { units: STORED })
    await type(w, 'input[data-axis="x"]', '5', 'stay')
    await leave(w.find('input[data-axis="x"]').element, w.find('input[data-axis="y"]').element)
    expect(given(w), 'x to y').toEqual([])
    await leave(w.find('input[data-axis="y"]').element, document.body)
    expect(given(w)).toEqual([[5, 2, 3]])
  })

  it('gives a row of a table when focus leaves the row, and nothing while it moves between its cells', async () => {
    const layers = [{ depth: 0.001, stock: 's1', push: [0, 0, 0] }]
    const w = field('layers', layers)
    await type(w, 'tr[data-row="0"] input', '5', 'stay')
    const [depth, x] = w.findAll('tr[data-row="0"] input')
    await leave(depth!.element, x!.element)
    expect(given(w), 'depth to push x').toEqual([])
    await leave(x!.element, document.body)
    expect(given(w)).toEqual([[{ ...layers[0], depth: 0.005 }]])
  })

  it('gives a choice in a table as soon as it is chosen', async () => {
    const layers = [
      { depth: 0.001, stock: 's1', push: [0, 0, 0] },
      { depth: 0.002, stock: 's1', push: [0, 0, 0] },
    ]
    const w = field('layers', layers)
    await w.find('tr[data-row="1"] select').setValue('s2')
    expect(given(w)).toEqual([[layers[0], { ...layers[1], stock: 's2' }]])
  })

  it.each([
    ['a free text', 'made', 'Ann', 'input[data-field="made"]', 'Bea', 'Bea'],
    ['JSON', 'extra', { k: 1 }, 'input[data-field="extra"]', '{"k":2}', { k: 2 }],
    ['a cell of a table', 'layers', [{ depth: 0.001, stock: 's1', push: [0, 0, 0] }], 'tr[data-row="0"] input', '5', [{ depth: 0.005, stock: 's1', push: [0, 0, 0] }]],
    ['a number of a vector in a table', 'layers', [{ depth: 0.001, stock: 's1', push: [0, 0, 0] }], 'tr[data-row="0"] input[placeholder="x"]', '5', [{ depth: 0.001, stock: 's1', push: [5000, 0, 0] }]],
  ] as const)('gives %s when Enter is pressed in it', async (_, name, value, selector, typed, out) => {
    const w = field(name, value as Json)
    await type(w, selector, typed, 'enter')
    expect(given(w)).toEqual([out])
  })
})

describe('the name each control is read by', () => {
  /** The words a control or group is named by: the elements it is labelled by, its own label, or the label for it or around it. */
  function nameOf(w: VueWrapper, el: Element): string {
    const byId = (id: string) => [...w.element.querySelectorAll('[id]')].find((e) => e.id === id)
    const by = el.getAttribute('aria-labelledby')
    if (by !== null) return by.split(' ').map((id) => byId(id)?.textContent?.trim() ?? '').join(' ')
    const own = el.getAttribute('aria-label')
    if (own !== null) return own
    const label = [...w.element.querySelectorAll('label')].find((l) => el.id !== '' && l.htmlFor === el.id) ?? el.closest('label')
    return label?.textContent?.trim() ?? ''
  }
  const names = (w: VueWrapper, selector: string): string[] => w.findAll(selector).map((c) => nameOf(w, c.element))
  /** Each name begins with its words: a label's mark of an optional field follows them. */
  const begin = (got: string[], words: readonly string[]): void => {
    expect(got.length, got.join(' | ')).toBe(words.length)
    words.forEach((w, i) => expect(got[i], `control ${i + 1}`).toMatch(new RegExp(`^${w}`)))
  }

  it.each([
    ['size', 1, PARTS, '', 'input', ['Size of the part']],
    ['made', 'Ann', PARTS, '', 'input', ['Made by']],
    ['extra', {}, PARTS, '', 'input', ['Extra']],
    ['stock', 's1', PARTS, '', 'select', ['Stock']],
    ['kept', true, PARTS, '', 'input', ['Kept']],
    ['outline', [], SHELVES, 'wall', 'textarea', ['Outline']],
    ['at', [1, 2, 3], PARTS, '', 'input', ['Place x', 'Place y', 'Place z']],
    ['locks', null, PARTS, '', 'input', ['Locks Lock A', 'Locks Lock B']],
    ['posts', null, SHELVES, 'wall', 'select', ['Posts 1', 'Posts 2']],
    ['layers', [{ depth: 1, stock: 's1', push: [0, 0, 0] }], PARTS, '', 'select, input', ['Depth, row 1', 'Stock, row 1', 'Push x, row 1', 'Push y, row 1', 'Push z, row 1']],
  ] as const)('names each control of %s by its field', (name, value, kind, variant, selector, out) => {
    begin(names(field(name, value as Json, {}, kind, variant), selector), out)
  })

  it.each([
    ['at', PARTS, '', 'Place, mm'],
    ['locks', PARTS, '', 'Locks'],
    ['posts', SHELVES, 'wall', 'Posts'],
    ['layers', PARTS, '', 'Layers'],
  ] as const)('names the group of %s by its label', (name, kind, variant, out) => {
    begin(names(field(name, undefined, {}, kind, variant), '[role="group"]'), [out])
  })

  it.each([
    ['a label of one control', 'made', 'Ann', 'label', 'Made by optional'],
    ['a label of a group', 'sides', ['left'], '.aether-record-field__label', 'Sides optional'],
  ] as const)('reads the mark of an optional field apart from %s', (_, name, value, selector, words) => {
    expect((field(name, value as Json).find(selector).element.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(words)
  })

  it('marks an optional field, and only one', () => {
    expect(field('made', 'Ann').find('.aether-record-field__opt').text()).toBe('optional')
    expect(field('size', 1).find('.aether-record-field__opt').exists(), 'a field the record requires').toBe(false)
  })
})

describe('what a field shows and gives as the app and the person change it', () => {
  it('shows its numbers again in the units the app switches to', async () => {
    const w = field('size', 0.0125)
    expect((w.find('input[data-field="size"]').element as HTMLInputElement).value).toBe('12.5')
    await w.setProps({ units: STORED })
    expect((w.find('input[data-field="size"]').element as HTMLInputElement).value).toBe('0.0125')
  })

  it("gives a summary's text when it is left", async () => {
    const w = field('outline', [[0, 0, 0]], {}, SHELVES, 'wall')
    await type(w, 'textarea[data-field="outline"]', '[[1,0,0]]')
    expect(given(w)).toEqual([[[1, 0, 0]]])
  })

  it('gives null when all three numbers are cleared', async () => {
    const w = field('at', [1, 2, 3], { units: STORED })
    for (const axis of ['x', 'y', 'z']) await type(w, `input[data-axis="${axis}"]`, '', 'stay')
    await w.find('.aether-record-field__vector').trigger('focusout')
    expect(given(w)).toEqual([null])
  })

  it('shows None for a summary with no value and no line, its refusal in the danger tone, and the heads of its table', () => {
    expect(field('outline', null, {}, SHELVES, 'wall').find('[data-summary]').text()).toBe('None')
    expect(field('size', 1, { issue: 'Too small' }).find('.aether-record-field__refusal').classes()).toContain('tone-danger')
    const heads = field('layers', []).findAll('th[scope="col"]').map((h) => h.text())
    expect(heads).toEqual(['Depth (mm)', 'Stock', 'Push (kN)'])
  })
})

describe('the smaller rules of a value', () => {
  it('reads a typed minus sign as a minus', async () => {
    const w = field('size', 1)
    await type(w, 'input[data-field="size"]', '−5')
    expect(given(w)).toEqual([-0.005])
  })

  it('gives a flag turned off as null where null clears it, else false', async () => {
    const w = field('kept', true)
    await w.find('input[data-field="kept"]').setValue(false)
    expect(given(w)).toEqual([null])
    const kept = field('kept', true, { field: { ...fieldOf('kept'), clears: false } })
    await kept.find('input[data-field="kept"]').setValue(false)
    expect(given(kept), 'a flag null does not clear').toEqual([false])
  })

  it('gives JSON null as null where null clears the field or is its value, and answers it elsewhere', async () => {
    const w = field('extra', { k: 1 })
    await type(w, 'input[data-field="extra"]', 'null')
    expect(given(w)).toEqual([null])
    const held = field('extra', { k: 1 }, { field: { ...fieldOf('extra'), clears: false, nullable: false } })
    await type(held, 'input[data-field="extra"]', 'null')
    expect([given(held), said(held)]).toEqual([[], ['Write an object between braces, with a name and a value for each entry']])
  })

  it('counts one entry of a summary in the singular', () => {
    expect(field('outline', [[0, 0, 0]], {}, SHELVES, 'wall').find('[data-summary]').text()).toBe('1 entry')
  })

  it('gives a row of a table left as it shows exactly as the record holds it, a null in a number column included', async () => {
    const layers = [
      { depth: null, stock: 's1', push: [0, 0, 0] },
      { depth: 0.002, stock: 's2', push: [0, 0, 0] },
    ] as unknown as Json[]
    const w = field('layers', layers)
    await type(w, 'tr[data-row="1"] input', '5', 'stay')
    await w.find('tr[data-row="1"]').trigger('focusout')
    expect(given(w)).toEqual([[layers[0], { ...(layers[1] as object), depth: 0.005 }]])
  })
})

describe('a form around the fields', () => {
  const flush = async (w: VueWrapper): Promise<void> => {
    ;(w.vm as unknown as { flush(): void }).flush()
    await nextTick()
  }

  it('gives what is typed and not yet given when the form flushes it', async () => {
    const w = field('size', 0.001)
    await type(w, 'input[data-field="size"]', '3', 'stay')
    expect(given(w)).toEqual([])
    await flush(w)
    expect(given(w)).toEqual([0.003])
  })

  const layers = [
    { depth: 0.001, stock: 's1', push: [0, 0, 0] },
    { depth: 0.002, stock: 's2', push: [0, 0, 0] },
  ]
  it.each([
    ['a free text', 'made', 'Ann', PARTS, '', 'input[data-field="made"]', 'Bea', 'Bea'],
    ['three numbers', 'at', [1, 2, 3], PARTS, '', 'input[data-axis="x"]', '5', [0.005, 2, 3]],
    ['a table', 'layers', layers, PARTS, '', 'tr[data-row="1"] input', '5', [layers[0], { ...layers[1], depth: 0.005 }]],
    ['JSON', 'extra', { k: 1 }, PARTS, '', 'input[data-field="extra"]', '{"k":2}', { k: 2 }],
    ['the text of a summary', 'outline', [[0, 0, 0]], SHELVES, 'wall', 'textarea[data-field="outline"]', '[[1,0,0]]', [[1, 0, 0]]],
  ] as const)('gives %s typed and not yet given when the form flushes it', async (_, name, value, kind, variant, selector, typed, out) => {
    const w = field(name, value as Json, {}, kind, variant)
    await type(w, selector, typed, 'stay')
    expect(given(w)).toEqual([])
    await flush(w)
    expect(given(w)).toEqual([out])
  })

  it('shows a refusal beside the field', () => {
    expect(field('size', 1, { issue: 'Size must be positive' }).find('.aether-record-field__refusal').text()).toContain('Size must be positive')
  })

  it('announces a refusal, and marks the control it describes', () => {
    const w = field('size', 1, { issue: 'Size must be positive' })
    const refusal = w.find('.aether-record-field__refusal')
    expect(refusal.attributes('role'), 'read out as it appears').toBe('alert')
    const input = w.find('input[data-field="size"]')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(refusal.attributes('id'))
  })

  it('marks no control while no refusal is shown', () => {
    const input = field('size', 1).find('input[data-field="size"]')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    expect(input.attributes('aria-describedby')).toBeUndefined()
  })

  it.each([
    ['a choice', 'finish', 'raw', PARTS, '', 'select[data-field="finish"]'],
    ['a free text', 'made', 'Ann', PARTS, '', 'input[data-field="made"]'],
    ['an axis of three numbers', 'at', [1, 2, 3], PARTS, '', 'input[data-axis="x"]'],
    ['JSON', 'extra', { k: 1 }, PARTS, '', 'input[data-field="extra"]'],
    ['the text of a summary', 'outline', [[0, 0, 0]], SHELVES, 'wall', 'textarea[data-field="outline"]'],
  ] as const)('marks %s under a refusal', (_, name, value, kind, variant, selector) => {
    expect(field(name, value as Json, { issue: 'No' }, kind, variant).find(selector).attributes('aria-invalid')).toBe('true')
  })

  it.each([
    ['three numbers', 'at', [1, 2, 3], PARTS, ''],
    ['switches', 'sides', ['left'], PARTS, ''],
    ['a list of references', 'posts', ['s1', 's2'], SHELVES, 'wall'],
    ['a table', 'layers', [], PARTS, ''],
  ] as const)('has the refusal describe the group of %s', (_, name, value, kind, variant) => {
    const w = field(name, value as Json, { issue: 'No' }, kind, variant)
    expect(w.find('[role="group"]').attributes('aria-describedby')).toBe(w.find('.aether-record-field__refusal').attributes('id'))
  })
})

describe('Escape in a field', () => {
  const press = async (w: VueWrapper, selector: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    w.find(selector).element.dispatchEvent(event)
    await nextTick()
    return event
  }
  const text = (w: VueWrapper, selector: string): string => (w.find(selector).element as HTMLInputElement).value
  const layers = [{ depth: 0.001, stock: 's1', push: [0, 0, 0] }]

  it.each([
    ['a number', 'size', 0.0125, PARTS, '', 'input[data-field="size"]', '20', '12.5'],
    ['a free text', 'made', 'Ann', PARTS, '', 'input[data-field="made"]', 'Bea', 'Ann'],
    ['an axis of three numbers', 'at', [0.001, 0.002, 0.003], PARTS, '', 'input[data-axis="x"]', '5', '1'],
    ['JSON', 'extra', { k: 1 }, PARTS, '', 'input[data-field="extra"]', '{"k":2}', '{"k":1}'],
    ['a table', 'layers', layers, PARTS, '', 'tr[data-row="0"] input', '5', '1'],
    ['the text of a summary', 'outline', [[0, 0, 0]], SHELVES, 'wall', 'textarea[data-field="outline"]', '[[1,0,0]]', '[[0,0,0]]'],
  ] as const)('puts back %s typed, gives nothing, and uses the key', async (_, name, value, kind, variant, selector, typed, back) => {
    const w = field(name, value as Json, {}, kind, variant)
    await type(w, selector, typed, 'stay')
    const event = await press(w, selector)
    expect(text(w, selector)).toBe(back)
    expect(given(w)).toEqual([])
    expect(event.defaultPrevented, 'the key is used').toBe(true)
    expect(w.emitted('restored')).toHaveLength(1)
  })

  it('tells the form it put a refused value back, so the words beside it can go', async () => {
    const w = field('size', 1, { issue: 'Write a number, such as 1' })
    await type(w, 'input[data-field="size"]', 'x')
    await press(w, 'input[data-field="size"]')
    expect(w.emitted('restored')).toHaveLength(1)
  })

  it('leaves the key to the form around it where nothing is typed', async () => {
    const w = field('size', 0.0125)
    const event = await press(w, 'input[data-field="size"]')
    expect(event.defaultPrevented).toBe(false)
    expect(w.emitted('restored')).toBeUndefined()
  })

  it('leaves the key where the control holds no text', async () => {
    const w = field('finish', 'raw')
    const event = await press(w, 'select[data-field="finish"]')
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('a choice in groups', () => {
  const grouped: KindDecl = {
    name: 'coats',
    word: 'coat',
    fields: {
      coat: {
        schema: { type: 'string', enum: [] },
        optional: true,
        label: 'Coat',
        options: [{ value: 'none', label: 'None' }],
        groups: [
          { label: 'Oils', options: [{ value: 'tung', label: 'Tung' }] },
          { label: 'Waxes', options: [{ value: 'bees', label: 'Bees' }, { value: 'carnauba', label: 'Carnauba' }] },
        ],
      },
    },
  }

  it('shows its options, then each group under its words', () => {
    const w = field('coat', 'bees', {}, grouped)
    const select = w.find('select[data-field="coat"]').element as HTMLSelectElement
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Oils', 'Waxes'])
    expect([...select.options].map((o) => o.value)).toEqual(['', 'none', 'tung', 'bees', 'carnauba'])
    expect(select.value).toBe('bees')
  })

  it('gives a value chosen in a group', async () => {
    const w = field('coat', 'bees', {}, grouped)
    await w.find('select[data-field="coat"]').setValue('tung')
    expect(given(w)).toEqual(['tung'])
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
