<script setup lang="ts">
// The records of one kind as a table, for changing many at once: a row per record, a column per field (records/core's
// tableColumns), numbers in the app's units. A cell's value is given when the cell is left or Enter is pressed, as a
// field's is, and Escape puts the cell back as the record holds it. The app's `run` takes the values, one per row, and
// answers null where it took them all, or the row and the words of its refusal, which are shown beside the cell; then the
// table emits `changed`, for the words of the app's step.
//
// Rows ticked in the first column are changed together: a cell changed in a ticked row gives its value to every ticked
// row, and several lines pasted into a cell go one to a row, from that row down. A change goes to every row or to none, as
// records/core's cellChange and pasteRows state it. The search (`query`) narrows the rows shown, and a field declared read
// only is shown and takes no change.
//
// What stays the app's: the head (which kind is shown, the counts), the table's place on screen, and what a change calls.
// `ticked` is a model the app may hold, for its counts and for anything it does with the rows ticked.
//
// Of a table of many rows only those in sight and a screenful each side are drawn, the rest being a gap of their height, so that a
// thousand rows open and scroll as ten do. A cell scrolled out of the drawn rows is left first, which gives what is typed in it.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Select from '../../controls/vue/Select.vue'
import Switch from '../../controls/vue/Switch.vue'
import TextField from '../../controls/vue/TextField.vue'
import {
  ARROW,
  PAD,
  STORED,
  TEXT_CEILING,
  cellChange,
  cellText,
  cellValue,
  choiceLabels,
  columnWidths,
  isCut,
  matches,
  measurer,
  ownUnit,
  pasteRows,
  tableColumns,
  takesField,
  type CellRefusal,
  type Fields,
  type KindDecl,
  type Row,
  type RowValue,
  type TableColumn,
  type Units,
} from '../core'

const props = withDefaults(
  defineProps<{
    kind: KindDecl
    /** Every record of the kind, those the search hides among them. */
    rows: readonly Row[]
    /** Takes the values a change gives a field, one per row: null where every one is taken, else the refusal. */
    run: (field: string, values: readonly RowValue[]) => CellRefusal | null
    units?: Units
    /**
     * The values a choice column offers: the ids of the kind a reference names, or the column's own values. Given a row, those
     * its cell offers, where a record's own value limits them; with none, every value of the column, which its width reads.
     */
    optionsOf?: (column: TableColumn, row?: Row) => readonly string[]
    /** Cells take changes. */
    editable?: boolean
    /** The row open in the app, marked and brought into sight. */
    openId?: string | null
    query?: string
    /** What the table says where it shows no row. */
    empty?: string
    /** Free-text columns are edited in their cells; false shows them as text. */
    textEdited?: boolean
  }>(),
  { units: () => STORED, optionsOf: (column: TableColumn) => column.values ?? [], editable: true, openId: null, query: '', empty: undefined, textEdited: true },
)
const emit = defineEmits<{ open: [id: string]; changed: [column: TableColumn, values: RowValue[], pasted: boolean] }>()
/** The rows ticked, by id, shown or hidden by the search. Cleared when the table shows another kind. */
const ticked = defineModel<ReadonlySet<string>>('ticked', { default: () => new Set<string>() })

const columns = computed(() => tableColumns(props.kind))
/** The rows shown: those the search finds. */
const shownRows = computed(() => props.rows.filter((r) => matches(props.kind, r, columns.value, props.query, props.units)))
const shown = computed(() => new Set(shownRows.value.map((r) => r.id)))

/** From this many rows on, only those in sight and a screenful each side are drawn. */
const MANY_ROWS = 100
/** The drawn rows move by this many, so that a small scroll draws nothing. */
const STEP = 8
/** What a screen is taken to hold, in px, until the table is measured. */
const SCREEN = 800
const body = ref<HTMLElement | null>(null)
const seen = ref({ top: 0, height: 0, row: 40 })
const manyRows = computed(() => shownRows.value.length >= MANY_ROWS)
function drawnAt(top: number): { from: number; to: number } {
  const n = shownRows.value.length
  if (!manyRows.value) return { from: 0, to: n }
  const screen = Math.ceil((seen.value.height || SCREEN) / seen.value.row)
  const first = Math.min(Math.floor(top / seen.value.row / STEP) * STEP, Math.max(0, n - screen))
  return { from: Math.max(0, first - screen), to: Math.min(n, first + 2 * screen) }
}
const drawn = computed(() => drawnAt(seen.value.top))
const drawnRows = computed(() => shownRows.value.slice(drawn.value.from, drawn.value.to))
const gap = (rows: number) => ({ height: `${rows * seen.value.row}px` })
function sizeUp(): void {
  const el = body.value
  if (el === null) return
  const rows = [...el.querySelectorAll('[data-table-row]')]
  const row = rows.reduce((sum, r) => sum + r.getBoundingClientRect().height, 0) / (rows.length || 1)
  seen.value = { top: el.scrollTop, height: el.clientHeight, row: row || seen.value.row }
}
function scrolled(): void {
  const el = body.value
  if (el === null || !manyRows.value) return
  const left = drawnAt(el.scrollTop)
  const held = el.querySelector<HTMLElement>('[data-table-row] :focus')
  const at = shownRows.value.findIndex((r) => r.id === held?.closest<HTMLElement>('[data-table-row]')?.dataset.tableRow)
  if (at >= 0 && (at < left.from || at >= left.to)) held?.blur()
  seen.value = { ...seen.value, top: el.scrollTop }
}
let watcher: ResizeObserver | null = null
onMounted(() => {
  sizeUp()
  if (typeof ResizeObserver !== 'undefined' && body.value !== null) {
    watcher = new ResizeObserver(sizeUp)
    watcher.observe(body.value)
  }
})
onBeforeUnmount(() => watcher?.disconnect())

function tick(id: string, on: boolean): void {
  const next = new Set(ticked.value)
  if (on) next.add(id)
  else next.delete(id)
  ticked.value = next
}
const tickedRows = computed(() => props.rows.filter((r) => ticked.value.has(r.id)))
const allTicked = computed(() => shownRows.value.length > 0 && shownRows.value.every((r) => ticked.value.has(r.id)))
function tickAll(on: boolean): void {
  ticked.value = on ? new Set(shownRows.value.map((r) => r.id)) : new Set()
}

/** A refused change, beside the cell it was made in: the row the refusal names, and its words. */
const problem = ref<{ at: string; row: string; words: string } | null>(null)
const cellId = (row: string, column: TableColumn) => `${row}:${column.key}`
watch(
  () => props.kind.name,
  () => {
    ticked.value = new Set()
    problem.value = null
  },
)

const headUnit = (column: TableColumn): string => (column.quantity === undefined ? '' : (props.units.label(column.quantity) ?? ''))
const textOf = (record: Fields, column: TableColumn): string => cellText(props.kind, record, column, props.units)
/** A choice's options as its cell offers them: the blank first, then each value in its declared words. */
function choiceOptions(column: TableColumn, row: Row): { value: string; label: string }[] {
  const values = props.optionsOf(column, row)
  return choiceLabels(props.kind, column, values).map((label, i) => ({ value: i === 0 ? '' : values[i - 1]!, label }))
}
/** The groups a choice field declares, each with the values this cell offers. */
function choiceGroups(column: TableColumn, row: Row): { label: string; options: { value: string; label: string }[] }[] {
  const offered = new Set(props.optionsOf(column, row))
  return (props.kind.fields[column.field]?.groups ?? []).map((g) => ({ label: g.label, options: g.options.filter((o) => offered.has(o.value)) })).filter((g) => g.options.length > 0)
}
/** The options a cell shows outside its groups. */
function looseOptions(column: TableColumn, row: Row): { value: string; label: string }[] {
  const grouped = new Set((props.kind.fields[column.field]?.groups ?? []).flatMap((g) => g.options.map((o) => o.value)))
  return choiceOptions(column, row).filter((o) => !grouped.has(o.value))
}
/** The words a choice's cell shows for its value. */
function shownText(row: Row, column: TableColumn): string {
  const text = textOf(row.record, column)
  return text === '' ? text : (choiceOptions(column, row).find((o) => o.value === text)?.label ?? text)
}
/** The words a text shown only holds: those its field declares for the value, else the value. */
function declaredText(record: Fields, column: TableColumn): string {
  const text = textOf(record, column)
  return props.kind.fields[column.field]?.options?.find((o) => o.value === text)?.label ?? text
}

const measure = measurer()
/** Counts the page's fonts loading, which the characters are measured again for. */
const fontsLoaded = ref(0)
if (typeof document !== 'undefined') void document.fonts?.ready.then(() => fontsLoaded.value++)
/** Each number, free text and choice column's width in px, over the rows shown. */
const widths = computed(() => {
  void fontsLoaded.value
  return columnWidths(props.kind, columns.value, shownRows.value, props.units, props.optionsOf, measure)
})
const widthOf = (column: TableColumn) => ({ width: `${widths.value.get(column.key)}px` })
/** The whole value, as the cell's title, where its column is too narrow for it. */
const titleOf = (text: string, column: TableColumn): string | undefined =>
  isCut(text, widths.value.get(column.key) ?? 0, column.kind === 'choice' ? PAD + ARROW : PAD, measure) ? text : undefined

/** Gives the values to the app's `run`: the refusal beside the cell, or the change told. */
function take(at: string, column: TableColumn, values: RowValue[], pasted: boolean): void {
  const refused = props.run(column.field, values)
  if (refused !== null) {
    problem.value = { at, row: refused.row, words: values.length > 1 ? `Refused for ${refused.row}: ${refused.words}` : refused.words }
    return
  }
  problem.value = null
  emit('changed', column, values, pasted)
}

/** A cell left, or Enter pressed in it: its value goes to its row, or to every ticked row (cellChange). */
function commit(row: Row, column: TableColumn, typed: string | boolean): void {
  if (!props.editable) return
  const at = cellId(row.id, column)
  const out = cellChange(props.kind, row, column, typed, tickedRows.value, shown.value, props.units)
  if (out === null) return
  if ('refused' in out) {
    problem.value = { at, ...out.refused }
    return
  }
  take(at, column, out.values, false)
}

/** Several lines pasted into a cell: one to a row, from this row down (pasteRows). One line is an ordinary paste. */
function paste(event: ClipboardEvent, row: Row, column: TableColumn): void {
  if (!props.editable) return
  const out = pasteRows(props.kind, event.clipboardData?.getData('text/plain') ?? '', row, column, shownRows.value, props.rows, props.units)
  if (out === null) return
  event.preventDefault()
  const at = cellId(row.id, column)
  if ('refused' in out) {
    problem.value = { at, ...out.refused }
    return
  }
  take(at, column, out.values, true)
}

/** Escape puts the cell back as the record holds it. */
function revert(event: KeyboardEvent, row: Row, column: TableColumn): void {
  ;(event.target as HTMLInputElement).value = textOf(row.record, column)
  if (problem.value?.at === cellId(row.id, column)) problem.value = null
}

const emptyWords = computed(() => props.empty ?? (props.query.trim() === '' ? `No ${props.kind.word} yet.` : `No ${props.kind.word} matches “${props.query}”.`))

// The row opened (in the app, or by a click on its id) is drawn, and brought into sight.
watch(
  () => props.openId,
  async (id) => {
    if (id === null) return
    const at = shownRows.value.findIndex((r) => r.id === id)
    if (body.value !== null && at >= 0 && (at < drawn.value.from || at >= drawn.value.to)) {
      body.value.scrollTop = Math.max(0, at * seen.value.row - seen.value.height / 2)
      seen.value = { ...seen.value, top: body.value.scrollTop }
    }
    await nextTick()
    ;[...(body.value?.querySelectorAll<HTMLElement>('[data-table-row]') ?? [])].find((el) => el.dataset.tableRow === id)?.scrollIntoView?.({ block: 'nearest' })
  },
  { immediate: true },
)
</script>

<template>
  <div ref="body" class="aether-record-table" @scroll.passive="scrolled">
    <table class="aether-record-table__table" :aria-rowcount="manyRows ? shownRows.length + 1 : undefined">
      <thead>
        <tr>
          <th class="aether-record-table__tick" scope="col">
            <Switch :model-value="allTicked" aria-label="Tick every row" data-table-tick-all @update:model-value="tickAll" />
          </th>
          <th scope="col" class="aether-record-table__idhead">Id</th>
          <th v-for="c in columns" :key="c.key" scope="col" :title="c.head === c.label ? undefined : c.label" :data-column="c.key">
            {{ c.head }}<span v-if="headUnit(c)" class="aether-record-table__unit"> ({{ headUnit(c) }})</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="drawn.from > 0" class="aether-record-table__gap" aria-hidden="true" :style="gap(drawn.from)" data-table-gap>
          <td :colspan="columns.length + 2" />
        </tr>
        <tr
          v-for="(r, i) in drawnRows"
          :key="r.id"
          :aria-rowindex="manyRows ? drawn.from + i + 2 : undefined"
          :class="{ 'aether-record-table__row--open': openId === r.id, 'aether-record-table__row--ticked': ticked.has(r.id) }"
          :aria-current="openId === r.id || undefined"
          :data-table-row="r.id"
        >
          <td class="aether-record-table__tick">
            <Switch :model-value="ticked.has(r.id)" :aria-label="`Tick ${r.id}`" :data-table-tick="r.id" @update:model-value="tick(r.id, $event)" />
          </td>
          <th scope="row" class="aether-record-table__id">
            <button type="button" class="aether-record-table__open" :data-table-open="r.id" @click="emit('open', r.id)">{{ r.id }}</button>
          </th>
          <td v-for="c in columns" :key="c.key" :class="{ 'aether-record-table__cell--refused': problem?.at === cellId(r.id, c) }">
            <template v-if="takesField(kind, r.record, c.field)">
              <TextField
                v-if="c.kind === 'number' || (c.kind === 'string' && textEdited)"
                class="aether-record-table__input"
                :inputmode="c.kind === 'number' ? 'decimal' : undefined"
                autocomplete="off"
                :model-value="textOf(r.record, c)"
                :disabled="!editable || c.readonly === true"
                :style="widthOf(c)"
                :title="titleOf(textOf(r.record, c), c)"
                :aria-label="`${c.label} of ${r.id}`"
                :aria-invalid="problem?.at === cellId(r.id, c) || undefined"
                :data-cell="cellId(r.id, c)"
                @change="commit(r, c, ($event.target as HTMLInputElement).value)"
                @keydown.enter="commit(r, c, ($event.target as HTMLInputElement).value)"
                @keydown.escape="revert($event, r, c)"
                @paste="paste($event, r, c)"
              />
              <Select
                v-else-if="c.kind === 'choice'"
                class="aether-record-table__input"
                :model-value="textOf(r.record, c)"
                :options="looseOptions(c, r)"
                :groups="choiceGroups(c, r)"
                :disabled="!editable || c.readonly === true"
                :style="widthOf(c)"
                :title="titleOf(shownText(r, c), c)"
                :aria-label="`${c.label} of ${r.id}`"
                :aria-invalid="problem?.at === cellId(r.id, c) || undefined"
                :data-cell="cellId(r.id, c)"
                @update:model-value="commit(r, c, $event)"
              />
              <Switch
                v-else-if="c.kind === 'flag'"
                :model-value="cellValue(r.record, c) === true"
                :disabled="!editable || c.readonly === true"
                :aria-label="`${c.label} of ${r.id}`"
                :data-cell="cellId(r.id, c)"
                @update:model-value="commit(r, c, $event)"
              />
              <span v-else class="aether-record-table__text" :style="{ maxWidth: `${TEXT_CEILING}px` }" :title="declaredText(r.record, c)" :data-cell="cellId(r.id, c)">{{
                declaredText(r.record, c)
              }}</span>
              <span v-if="ownUnit(kind, r.record, c, units)" class="aether-record-table__unit"> {{ ownUnit(kind, r.record, c, units) }}</span>
            </template>
            <p v-if="problem?.at === cellId(r.id, c)" class="aether-record-table__issue" role="alert" data-cell-issue>{{ problem.words }}</p>
          </td>
        </tr>
        <tr v-if="drawn.to < shownRows.length" class="aether-record-table__gap" aria-hidden="true" :style="gap(shownRows.length - drawn.to)" data-table-gap>
          <td :colspan="columns.length + 2" />
        </tr>
      </tbody>
    </table>
    <p v-if="shownRows.length === 0" class="aether-record-table__none">{{ emptyWords }}</p>
  </div>
</template>

<style scoped>
/* The fixed head and first columns are painted in --aether-record-table-ground (ui-kit.css), the colour the table sits on. */
.aether-record-table {
  --aether-record-table-tick: 56px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border-top: 1px solid var(--aether-line);
}
.aether-record-table__table {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.8125rem;
  white-space: nowrap;
}
.aether-record-table__table th,
.aether-record-table__table td {
  padding: 3px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--aether-ink) 8%, transparent);
  text-align: left;
  vertical-align: top;
}
.aether-record-table__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--aether-record-table-ground);
  font-weight: 600;
  border-bottom: 1px solid color-mix(in srgb, var(--aether-ink) 20%, transparent);
  /* a column is as wide as its cells (records/core's column widths); its head wraps at its words within that */
  white-space: normal;
  vertical-align: bottom;
}
.aether-record-table__table thead .aether-record-table__tick,
.aether-record-table__table thead .aether-record-table__idhead {
  white-space: nowrap;
}
.aether-record-table__tick,
.aether-record-table__id,
.aether-record-table__idhead {
  position: sticky;
  z-index: 1;
  background: var(--aether-record-table-ground);
}
.aether-record-table__tick {
  box-sizing: border-box;
  left: 0;
  width: var(--aether-record-table-tick);
  min-width: var(--aether-record-table-tick);
  max-width: var(--aether-record-table-tick);
}
.aether-record-table__id,
.aether-record-table__idhead {
  left: var(--aether-record-table-tick);
}
.aether-record-table__table thead .aether-record-table__tick,
.aether-record-table__table thead .aether-record-table__idhead {
  z-index: 2;
}
/* A row's id, which opens the record: a native button drawn as a link, since the kit has no link control. */
.aether-record-table__open {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
.aether-record-table__row--ticked td,
.aether-record-table__row--ticked th {
  background-image: linear-gradient(color-mix(in srgb, var(--aether-cool) 6%, transparent), color-mix(in srgb, var(--aether-cool) 6%, transparent));
}
.aether-record-table__row--open td,
.aether-record-table__row--open th {
  background-image: linear-gradient(color-mix(in srgb, var(--aether-cool) 14%, transparent), color-mix(in srgb, var(--aether-cool) 14%, transparent));
}
.aether-record-table__table .aether-record-table__gap td {
  padding: 0;
  border: 0;
}
.aether-record-table__input {
  font-variant-numeric: tabular-nums;
}
.aether-record-table__cell--refused .aether-record-table__input {
  border-color: var(--aether-tone-danger);
}
.aether-record-table__issue {
  margin: 2px 0 0;
  max-width: 22em;
  white-space: normal;
  color: var(--aether-tone-danger);
  font-size: 0.75rem;
}
.aether-record-table__text {
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}
.aether-record-table__unit {
  color: var(--aether-cool);
  font-weight: 400;
}
.aether-record-table__none {
  margin: 12px 14px;
  font-size: 0.875rem;
}
</style>
