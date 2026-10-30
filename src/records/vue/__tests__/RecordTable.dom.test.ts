// The records of a toy kind as a table: what each cell shows, what a cell left or Enter gives the app's `run`, a change
// to ticked rows and a paste going to every row or to none, and the refusals shown beside the cell.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import RecordTable from '../RecordTable.vue'
import type { CellRefusal, KindDecl, Row, RowValue, TableColumn } from '../../core'
import { FIXINGS, PARTS, SHELVES, STOCKS, UNITS, row } from '../../core/__tests__/toy'
import type { Json } from '../../../verbs'

type Run = (field: string, values: readonly RowValue[]) => CellRefusal | null
const parts = (): Row[] => [
  row('p1', { size: 0.01, stock: 's1', finish: 'raw', at: [1, 2, 3], made: 'Ann', kept: true, sides: ['top'] }),
  row('p2', { size: 0.02, stock: 's2', at: [0, 0, 0] }),
  row('p3', { size: 0.03, stock: 's1', at: [0, 0, 0] }),
]
const optionsOf = (c: TableColumn): readonly string[] => (c.ref === 'stocks' ? ['s1', 's2'] : (c.values ?? []))

/** A table over the rows, whose `run` takes every change unless it is given one that refuses. */
function table(kind: KindDecl, rows: Row[], more: Record<string, unknown> = {}) {
  const runs: { field: string; values: { id: string; value: Json }[] }[] = []
  const { answer = null, ...props } = more as { answer?: CellRefusal | null }
  const run: Run = (field, values) => {
    runs.push({ field, values: values.map((v) => ({ id: v.id, value: v.value })) })
    return answer
  }
  const w = mount(RecordTable, { props: { kind, rows, units: UNITS, run, optionsOf, ...props }, attachTo: document.body })
  return { w, runs }
}
const cell = (w: VueWrapper, at: string) => w.find(`[data-cell="${at}"]`)
const valueOf = (w: VueWrapper, at: string) => (cell(w, at).element as HTMLInputElement).value
/** Types a value into a cell and leaves it. */
async function give(c: DOMWrapper<Element>, value: string): Promise<void> {
  ;(c.element as HTMLInputElement | HTMLSelectElement).value = value
  await c.trigger('change')
}
const issueOf = (w: VueWrapper, at: string) => cell(w, at).element.closest('td')!.querySelector('[data-cell-issue]')?.textContent ?? null
async function tick(w: VueWrapper, ...ids: string[]): Promise<void> {
  for (const id of ids) await w.find(`[data-table-tick="${id}"]`).setValue(true)
}
/** A paste of text into a cell, as the browser hands it to the page; whether the table took it from the browser. */
async function paste(c: DOMWrapper<Element>, text: string): Promise<boolean> {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? text : '') } })
  c.element.dispatchEvent(event)
  await nextTick()
  return event.defaultPrevented
}
const changed = (w: VueWrapper) => (w.emitted('changed') ?? []).map(([column, values, pasted]) => [(column as TableColumn).key, (values as RowValue[]).map((v) => v.id), pasted])

afterEach(() => {
  document.body.innerHTML = ''
})

describe('what the table shows', () => {
  it('shows a row per record and a column per field, numbers in their unit, and the full label of a short head', () => {
    const { w } = table(PARTS, parts())
    expect(w.findAll('[data-table-row]').map((r) => r.attributes('data-table-row'))).toEqual(['p1', 'p2', 'p3'])
    expect([w.find('[data-column="size"]').text(), w.find('[data-column="size"]').attributes('title')]).toEqual(['Size (mm)', 'Size of the part'])
    expect(w.find('[data-column="stock"]').attributes('title'), 'a head that is the label').toBeUndefined()
    expect(['p1:size', 'p1:at.x', 'p1:at.z'].map((at) => valueOf(w, at))).toEqual(['10', '1000', '3000'])
    expect([...(cell(w, 'p1:stock').element as HTMLSelectElement).options].map((o) => [o.value, o.text])).toEqual([
      ['', '(choose)'],
      ['s1', 's1'],
      ['s2', 's2'],
    ])
    expect([(cell(w, 'p1:kept').element as HTMLInputElement).checked, (cell(w, 'p2:kept').element as HTMLInputElement).checked]).toEqual([true, false])
    expect([cell(w, 'p1:sides').element.tagName, cell(w, 'p1:sides').text()], 'a value no cell edits').toEqual(['SPAN', 'top'])
  })

  it('offers a choice in the words its field declares for each value', () => {
    const { w } = table(STOCKS, [row('s1', { grade: 'S355', coat: 'zinc' })], { optionsOf: (c: TableColumn) => c.values ?? [] })
    expect([...(cell(w, 's1:coat').element as HTMLSelectElement).options].map((o) => [o.value, o.text])).toEqual([
      ['', '(none)'],
      ['zinc', 'Galvanised steel'],
      ['paint', 'Painted'],
    ])
  })

  it("shows a cell in its own unit where its row's variant gives the field another quantity than the head's", () => {
    const { w } = table(FIXINGS, [row('b1', { by: 'bolt', part: 'p1', load: 2000 }), row('w1', { by: 'weld', part: 's1', load: 3e6 })])
    expect(w.find('[data-column="load"]').text()).toBe('Load (kN)')
    expect([valueOf(w, 'b1:load'), valueOf(w, 'w1:load')]).toEqual(['2', '3'])
    const own = (at: string) => cell(w, at).element.parentElement!.querySelector('.aether-record-table__unit')?.textContent?.trim()
    expect([own('b1:load'), own('w1:load')]).toEqual([undefined, 'kN/mm'])
    expect(cell(w, 'b1:turns').exists() && !cell(w, 'w1:turns').exists(), 'a field its variant does not take has no cell').toBe(true)
  })

  it('sizes each column to what it holds, and gives a value its column cuts its whole text as its title', () => {
    const { w } = table(PARTS, [row('p1', { size: 0.01 }), row('p2', { size: -1.23456789012e-7 })])
    const width = (at: string) => Number.parseFloat((cell(w, at).element as HTMLElement).style.width)
    expect(valueOf(w, 'p2:size').length * 8 + 22, 'precondition: the long value passes the ceiling').toBeGreaterThan(160)
    expect([width('p1:size'), width('p1:at.x')], 'the ceiling; a column of no value at the floor').toEqual([160, 48])
    expect([cell(w, 'p1:size').attributes('title'), cell(w, 'p2:size').attributes('title')]).toEqual([undefined, valueOf(w, 'p2:size')])
    expect(width('p1:stock'), 'a choice of no value: its blank label, the padding and the arrow').toBe(Math.max(64, '(choose)'.length * 8 + 22 + 24))
  })

  it('says so where it shows no row, in its own words or the words it is given', async () => {
    const { w } = table(PARTS, [])
    expect(w.find('.aether-record-table__none').text()).toBe('No part yet.')
    await w.setProps({ rows: parts(), query: 'zz' })
    expect(w.find('.aether-record-table__none').text()).toBe('No part matches “zz”.')
    await w.setProps({ empty: 'Nothing here' })
    expect(w.find('.aether-record-table__none').text()).toBe('Nothing here')
    await w.setProps({ query: '' })
    expect(w.find('.aether-record-table__none').exists(), 'rows shown').toBe(false)
  })
})

describe('a cell changed', () => {
  it('gives a number left to its row as the record stores it, once, and tells the change', async () => {
    const { w, runs } = table(PARTS, parts())
    await give(cell(w, 'p1:size'), '20')
    expect(runs).toEqual([{ field: 'size', values: [{ id: 'p1', value: 0.02 }] }])
    expect(changed(w)).toEqual([['size', ['p1'], false]])
    await give(cell(w, 'p2:size'), '20')
    await give(cell(w, 'p3:size'), '30')
    expect(runs.length, 'a cell left as it shows gives nothing').toBe(1)
  })

  it('gives a cell its value when Enter is pressed in it', async () => {
    const { w, runs } = table(PARTS, parts())
    ;(cell(w, 'p2:at.y').element as HTMLInputElement).value = '5'
    await cell(w, 'p2:at.y').trigger('keydown', { key: 'Enter' })
    expect(runs).toEqual([{ field: 'at', values: [{ id: 'p2', value: [0, 0.005, 0] }] }])
  })

  it('gives a choice and a flag as soon as they are chosen, and a free text trimmed', async () => {
    const { w, runs } = table(PARTS, parts())
    await cell(w, 'p2:stock').setValue('s1')
    await cell(w, 'p1:kept').setValue(false)
    await give(cell(w, 'p2:made'), ' Bea ')
    expect(runs).toEqual([
      { field: 'stock', values: [{ id: 'p2', value: 's1' }] },
      { field: 'kept', values: [{ id: 'p1', value: false }] },
      { field: 'made', values: [{ id: 'p2', value: 'Bea' }] },
    ])
  })

  it('takes no change where the table is not editable, nor in a field declared read only', async () => {
    const { w, runs } = table(SHELVES, [row('h1', { hung: 'wall', width: 1, held: 500 })], { editable: false })
    expect([cell(w, 'h1:width'), cell(w, 'h1:held')].map((c) => (c.element as HTMLInputElement).disabled)).toEqual([true, true])
    expect([await paste(cell(w, 'h1:width'), '1\n2'), runs], 'a paste where the table is not editable').toEqual([false, []])
    await w.setProps({ editable: true })
    expect([cell(w, 'h1:width'), cell(w, 'h1:held')].map((c) => (c.element as HTMLInputElement).disabled), 'editable: the read-only field alone').toEqual([false, true])
    expect(await paste(cell(w, 'h1:held'), '1\n2')).toBe(true)
    expect([issueOf(w, 'h1:held'), runs], 'a paste into it').toEqual(['Weight held is read only', []])
  })

  it('puts a cell back as the record holds it when Escape is pressed, its refusal with it', async () => {
    const { w, runs } = table(PARTS, parts())
    ;(cell(w, 'p2:size').element as HTMLInputElement).value = '99'
    await cell(w, 'p2:size').trigger('keydown', { key: 'Escape' })
    await cell(w, 'p2:size').trigger('change')
    expect([valueOf(w, 'p2:size'), runs], 'typed and not left').toEqual(['20', []])
    await give(cell(w, 'p1:size'), 'ten')
    expect(issueOf(w, 'p1:size')).toBe('Number only')
    expect(cell(w, 'p1:size').attributes('aria-invalid')).toBe('true')
    await cell(w, 'p1:size').trigger('keydown', { key: 'Escape' })
    expect([valueOf(w, 'p1:size'), issueOf(w, 'p1:size'), cell(w, 'p1:size').attributes('aria-invalid')]).toEqual(['10', null, undefined])
  })

  it("takes a cell's change after a refusal of it, and the refusal goes", async () => {
    const { w, runs } = table(PARTS, parts())
    await give(cell(w, 'p1:size'), 'ten')
    expect([issueOf(w, 'p1:size'), runs], 'precondition: refused').toEqual(['Number only', []])
    await give(cell(w, 'p1:size'), '20')
    expect([issueOf(w, 'p1:size'), runs.length]).toEqual([null, 1])
  })

  it("shows the app's refusal beside the cell, naming the row where the change was to several", async () => {
    const { w } = table(PARTS, parts(), { answer: { row: 'p2', words: 'Too large' } })
    await give(cell(w, 'p1:size'), '99')
    expect(issueOf(w, 'p1:size')).toBe('Too large')
    expect(w.findAll('[data-cell-issue]').length, 'beside that cell only').toBe(1)
    await tick(w, 'p1', 'p2')
    await give(cell(w, 'p1:size'), '98')
    expect(issueOf(w, 'p1:size')).toBe('Refused for p2: Too large')
    expect(w.emitted('changed'), 'nothing told').toBeUndefined()
  })
})

describe('rows ticked', () => {
  it('gives a change in a ticked row to every ticked row as one run, and one in a row not ticked to that row alone', async () => {
    const { w, runs } = table(PARTS, parts())
    await tick(w, 'p1', 'p3')
    expect([...((w.emitted('update:ticked')!.at(-1)![0] as Set<string>).values())]).toEqual(['p1', 'p3'])
    await give(cell(w, 'p3:size'), '5')
    await give(cell(w, 'p2:size'), '7')
    expect(runs).toEqual([
      { field: 'size', values: [{ id: 'p1', value: 0.005 }, { id: 'p3', value: 0.005 }] },
      { field: 'size', values: [{ id: 'p2', value: 0.007 }] },
    ])
    expect(w.findAll('.aether-record-table__row--ticked').map((r) => r.attributes('data-table-row'))).toEqual(['p1', 'p3'])
    await w.find('[data-table-tick="p3"]').setValue(false)
    expect([...(w.emitted('update:ticked')!.at(-1)![0] as Set<string>)], 'a row unticked').toEqual(['p1'])
  })

  it('ticks every row shown, and none', async () => {
    const { w } = table(PARTS, parts(), { query: 'p1' })
    await w.find('[data-table-tick-all]').setValue(true)
    expect([...(w.emitted('update:ticked')!.at(-1)![0] as Set<string>)]).toEqual(['p1'])
    await w.find('[data-table-tick-all]').setValue(false)
    expect([...(w.emitted('update:ticked')!.at(-1)![0] as Set<string>)]).toEqual([])
  })

  it('holds the rows the app ticks', async () => {
    const { w, runs } = table(PARTS, parts(), { ticked: new Set(['p1', 'p2']) })
    await give(cell(w, 'p2:size'), '4')
    expect(runs[0]!.values.map((v) => v.id)).toEqual(['p1', 'p2'])
  })

  it('refuses a change to ticked rows where the search hides one, naming it, and runs nothing', async () => {
    const { w, runs } = table(PARTS, parts(), { query: 'p2' })
    await w.setProps({ ticked: new Set(['p1', 'p2', 'p3']) })
    await give(cell(w, 'p2:size'), '4')
    expect([issueOf(w, 'p2:size'), runs]).toEqual(['Ticked and hidden by the search: p1, p3', []])
  })

  it('refuses a change to ticked rows where one takes no such field, or where their cells measure different quantities', async () => {
    const rows = [row('b1', { by: 'bolt', part: 'p1', load: 2000 }), row('w1', { by: 'weld', part: 's1', load: 3e6 }), row('g1', { by: 'glue' })]
    const { w, runs } = table(FIXINGS, rows, { ticked: new Set(['b1', 'g1']) })
    await give(cell(w, 'b1:load'), '4')
    expect(issueOf(w, 'b1:load')).toBe('No load in g1')
    await w.setProps({ ticked: new Set(['b1', 'w1']) })
    await give(cell(w, 'b1:load'), '4')
    expect([issueOf(w, 'b1:load'), runs]).toEqual(['Units differ: b1 kN, w1 kN/mm', []])
  })

  it('clears the rows ticked and the refusal shown when the table shows another kind', async () => {
    const { w } = table(PARTS, parts(), { ticked: new Set(['p1']) })
    await give(cell(w, 'p1:size'), 'ten')
    expect(w.findAll('[data-cell-issue]').length, 'precondition: a refusal shown').toBe(1)
    await w.setProps({ kind: STOCKS, rows: [row('s1', { grade: 'S355' })] })
    expect([...(w.emitted('update:ticked')!.at(-1)![0] as Set<string>)]).toEqual([])
    await w.setProps({ kind: PARTS, rows: parts(), ticked: new Set() })
    expect(w.findAll('[data-cell-issue]').length).toBe(0)
  })
})

describe('lines pasted into a cell', () => {
  it('gives one line to a row from that row down, as one run, and leaves one line to the browser', async () => {
    const { w, runs } = table(PARTS, parts())
    expect(await paste(cell(w, 'p2:at.z'), '1\n2\n')).toBe(true)
    expect(runs).toEqual([
      {
        field: 'at',
        values: [
          { id: 'p2', value: [0, 0, 0.001] },
          { id: 'p3', value: [0, 0, 0.002] },
        ],
      },
    ])
    expect(changed(w)).toEqual([['at.z', ['p2', 'p3'], true]])
    expect(await paste(cell(w, 'p1:size'), '5'), 'one line').toBe(false)
    expect(runs.length).toBe(1)
  })

  it('refuses more lines than rows from there down, and a paste across a row the search hides', async () => {
    const rows = [row('a1', { size: 1 }), row('b2', { size: 2 }), row('a3', { size: 3 })]
    const { w, runs } = table(PARTS, rows)
    await paste(cell(w, 'b2:size'), '1\n2\n3')
    expect(issueOf(w, 'b2:size')).toBe('3 lines pasted, and 2 rows from here down')
    await w.setProps({ query: 'a' })
    await paste(cell(w, 'a1:size'), '1\n2')
    expect([issueOf(w, 'a1:size'), runs]).toEqual(['Hidden by the search: b2', []])
  })
})

describe('the row open', () => {
  it('emits the id of a row whose id is clicked, marks the row open and brings it into sight', async () => {
    const into = vi.fn()
    Element.prototype.scrollIntoView = into
    const { w } = table(PARTS, parts())
    await w.find('[data-table-open="p2"]').trigger('click')
    expect(w.emitted('open')).toEqual([['p2']])
    await w.setProps({ openId: 'p3' })
    await nextTick()
    expect([w.find('[data-table-row="p3"]').attributes('aria-current'), w.find('[data-table-row="p2"]').attributes('aria-current')]).toEqual(['true', undefined])
    expect(w.find('[data-table-row="p3"]').classes()).toContain('aether-record-table__row--open')
    expect(into.mock.contexts.map((el) => (el as HTMLElement).dataset.tableRow)).toEqual(['p3'])
  })
})
