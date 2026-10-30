<script setup lang="ts">
// One field of a record, in the control its view takes (records/core's formFields): a number with its unit; three numbers
// x, y, z; a set of switches over an object of flags or a list of names, with the values offered above them; a list of
// objects as a table; a line of what the value holds, given by the app (`summary`), with its text to edit; a choice, a
// flag, a list of references, a free text; JSON text for the rest. A field whose control is the app's own (`app`) draws
// nothing: the app's form draws its control in its place.
//
// A value is given to the record when the field is left or Enter is pressed (`commit`), and only when it differs from what
// the record holds, so leaving a field unchanged changes nothing. A number is typed in the unit shown and given as the
// record's units store it (Units). What cannot be read as the field's value is answered beside it (`invalid`) and nothing
// is given. A choice of another record offers a link that opens the record chosen (`open`). A field declared read only is
// shown and gives nothing. `flush` gives what is typed and not yet given: a form's Enter, and its button for a draft, call
// it on every field.
import { computed, ref, useId, watch } from 'vue'
import TextField from '../../controls/vue/TextField.vue'
import Select from '../../controls/vue/Select.vue'
import Switch from '../../controls/vue/Switch.vue'
import Disclosure from '../../controls/vue/Disclosure.vue'
import Tool from '../../controls/vue/Tool.vue'
import Callout from '../../controls/vue/Callout.vue'
import type { Json } from '../../verbs'
import { STORED, numberText, shapeLine, type FieldView, type Units } from '../core'

const props = withDefaults(defineProps<{ field: FieldView; value: Json | undefined; units?: Units; issue?: string; summary?: string }>(), {
  units: () => STORED,
  issue: undefined,
  summary: undefined,
})
const emit = defineEmits<{ commit: [value: Json]; invalid: [words: string]; open: [id: string] }>()

const f = computed(() => props.field)
const uid = useId()
const AXES = ['x', 'y', 'z'] as const
const locked = computed(() => f.value.readonly === true)

/** The unit's words for a quantity, where its numbers show in a unit. */
const unitOf = (quantity: string | undefined): string | undefined => (quantity === undefined ? undefined : props.units.label(quantity))
const unit = computed(() => unitOf(f.value.quantity))

/** A stored number as the field shows it, in its unit. */
const shown = (n: unknown, quantity = f.value.quantity): string =>
  typeof n !== 'number' ? (n === undefined || n === null ? '' : String(n)) : numberText(quantity === undefined ? n : props.units.shown(n, quantity))

/** A typed number as the record stores it, or the text when it is not a number, or null when it is blank. */
function read(text: string, quantity = f.value.quantity): number | string | null {
  const t = text.trim().replace(/−/g, '-')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n)) return text
  return quantity === undefined ? n : props.units.stored(n, quantity)
}

const same = (a: Json | undefined, b: Json | undefined): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// The text of each typed control, as the record holds it until the person types; a refused value stays as typed.
const text = ref('')
const parts = ref<string[]>(['', '', ''])
const rows = ref<Record<string, string | string[]>[]>([])

/** The three fields of a stored vector, as they show it. */
const shownParts = (v: Json | undefined): string[] => AXES.map((_, i) => (Array.isArray(v) ? shown(v[i]) : ''))

/** A row of a table, as its cells show it. */
const rowText = (entry: Json | undefined): Record<string, string | string[]> => {
  const e = (entry ?? {}) as Record<string, Json>
  return Object.fromEntries((f.value.columns ?? []).map((c) => [c.key, Array.isArray(e[c.key]) ? (e[c.key] as Json[]).map((x) => shown(x, c.quantity)) : shown(e[c.key], c.quantity)]))
}

/** The stored rows of a table. */
const storedRows = (): Json[] => (Array.isArray(props.value) ? props.value : [])

/**
 * One number of a vector or a table: the stored number where its text is still the text shown for it, else the typed text
 * read back. A number shows at twelve digits, so reading the shown text back would rewrite a stored 0.30000000000000004.
 */
function partValue(text: string, stored: Json | undefined, quantity = f.value.quantity): number | string | null {
  return typeof stored === 'number' && text === shown(stored, quantity) ? stored : read(text, quantity)
}

const textOf = (v: Json | undefined): string => (typeof v === 'string' ? v : '')

function fill(): void {
  const v = props.value
  const kind = f.value.kind
  if (kind === 'number') text.value = shown(v)
  else if (kind === 'json' || kind === 'summary') text.value = v === undefined || v === null ? '' : JSON.stringify(v)
  else if (kind === 'text') text.value = textOf(v)
  else if (kind === 'vector') parts.value = shownParts(v)
  else if (kind === 'rows') rows.value = storedRows().map(rowText)
}
watch(() => [props.value, props.field.quantity, props.units], fill, { immediate: true })

function give(value: Json): void {
  if (same(value, props.value)) return
  emit('commit', value)
}

function commitNumber(): void {
  if (text.value === shown(props.value)) return
  const v = read(text.value)
  if (typeof v === 'string') return emit('invalid', (f.value.shape && shapeLine(f.value.shape, v)) || 'Write a number, such as 1')
  give(v)
}

function commitText(): void {
  const t = text.value.trim()
  if (t === textOf(props.value)) return
  give(t === '' ? null : t)
}

function commitVector(): void {
  if (parts.value.join('|') === shownParts(props.value).join('|')) return
  if (parts.value.every((p) => p.trim() === '')) return give(null)
  const stored = Array.isArray(props.value) ? props.value : []
  const values = parts.value.map((p, i) => partValue(p, stored[i]))
  if (values.some((v) => typeof v !== 'number')) return emit('invalid', 'Give x, y and z, each a number')
  give(values as number[])
}

/** Focus leaving the group of three numbers gives the vector; moving between them gives nothing. */
function leaveVector(e: FocusEvent): void {
  const group = e.currentTarget as HTMLElement
  if (e.relatedTarget instanceof Node && group.contains(e.relatedTarget)) return
  commitVector()
}

function commitJson(): void {
  const t = text.value.trim()
  const before = props.value === undefined || props.value === null ? '' : JSON.stringify(props.value)
  if (t === before) return
  if (t === '') return give(null)
  if (t === 'null' && (f.value.nullable || f.value.clears)) return give(null)
  const line = f.value.shape === undefined ? undefined : shapeLine(f.value.shape, t)
  if (line !== undefined) return emit('invalid', line)
  try {
    give(JSON.parse(t) as Json)
  } catch {
    emit('invalid', 'Write it as JSON')
  }
}

/** The switches that are on: the flags an object holds as true, or the names a list holds. */
const flags = computed<Record<string, boolean>>(() => {
  const v = props.value
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, boolean>) : {}
})
const named = computed<string[]>(() => (Array.isArray(props.value) ? props.value.map(String) : []))
const isOn = (option: string): boolean => (f.value.holds === 'flags' ? flags.value[option] === true : named.value.includes(option))
/** A switch turned: the value holds the switches then on, in the order offered; none on is null. */
function setSwitch(option: string, on: boolean): void {
  const kept = f.value.options.map((o) => o.value).filter((o) => (o === option ? on : isOn(o)))
  if (kept.length === 0) return give(null)
  give(f.value.holds === 'flags' ? Object.fromEntries(kept.map((o) => [o, true])) : kept)
}

// The entries of a list of references as chosen, kept here until the list is whole: a pair's second is chosen after its first.
const entries = ref<string[]>([])
watch(named, (n) => (entries.value = [...n]), { immediate: true })
const slots = computed(() => f.value.fixed ?? entries.value.filter((e) => e !== '').length + 1)
function setRef(i: number, id: string): void {
  const next = [...entries.value]
  while (next.length < i) next.push('')
  next[i] = id
  entries.value = next
  const kept = next.filter((e) => e !== '')
  if (f.value.fixed !== undefined && kept.length < f.value.fixed) return
  give(kept)
}

function setChoice(v: string): void {
  give(v === '' ? null : v)
}

function setFlag(on: boolean): void {
  give(on ? true : f.value.clears ? null : false)
}

/**
 * The table's rows as the record takes them; a cell that is not a number is refused beside the table. `sources` holds the
 * stored entry each row was filled from: a row whose cells all show it gives it unchanged, and a cell left as shown keeps
 * its stored number.
 */
function rowsValue(list = rows.value, sources: (Json | undefined)[] = storedRows()): Json | string {
  const out: Json[] = []
  for (const [i, row] of list.entries()) {
    const source = sources[i]
    const held = source !== null && typeof source === 'object' && !Array.isArray(source) ? (source as Record<string, Json>) : undefined
    if (held !== undefined && JSON.stringify(rowText(held)) === JSON.stringify(row)) {
      out.push(JSON.parse(JSON.stringify(held)) as Json)
      continue
    }
    const entry: Record<string, Json> = held === undefined ? {} : (JSON.parse(JSON.stringify(held)) as Record<string, Json>)
    for (const c of f.value.columns ?? []) {
      const cell = row[c.key]
      const was = held?.[c.key]
      if (c.options !== undefined) {
        if (typeof cell === 'string' && cell !== '') entry[c.key] = cell
        else delete entry[c.key]
        continue
      }
      if (Array.isArray(cell)) {
        const v = cell.map((p, k) => partValue(p, Array.isArray(was) ? was[k] : undefined, c.quantity))
        if (v.some((x) => typeof x !== 'number')) return `${c.label}: give x, y and z, each a number`
        entry[c.key] = v as number[]
        continue
      }
      const v = partValue(cell ?? '', was, c.quantity)
      if (typeof v === 'string') return `${c.label}: write a number, such as 1`
      if (v !== null) entry[c.key] = v
      else delete entry[c.key]
    }
    out.push(entry)
  }
  return out
}
function commitRows(list = rows.value, sources: (Json | undefined)[] = storedRows()): void {
  const v = rowsValue(list, sources)
  if (typeof v === 'string') return emit('invalid', v)
  give(v)
}
function addRow(): void {
  const stored = storedRows()
  const last = rows.value[rows.value.length - 1]
  const blank = Object.fromEntries((f.value.columns ?? []).map((c) => [c.key, c.vector ? ['0', '0', '0'] : c.options !== undefined ? (c.options[0]?.value ?? '') : '0']))
  // A copy of the last row copies its stored numbers. The row is reactive, which structuredClone refuses, so it is copied as JSON.
  const copy = last === undefined ? blank : (JSON.parse(JSON.stringify(last)) as Record<string, string | string[]>)
  commitRows([...rows.value, copy], [...stored, last === undefined ? undefined : stored[rows.value.length - 1]])
}
function removeRow(i: number): void {
  commitRows(
    rows.value.filter((_, j) => j !== i),
    storedRows().filter((_, j) => j !== i),
  )
}
const cellText = (i: number, key: string): string => String(rows.value[i]?.[key] ?? '')
const cellPart = (i: number, key: string, p: number): string => {
  const cell = rows.value[i]?.[key]
  return Array.isArray(cell) ? (cell[p] ?? '') : ''
}
function setCell(i: number, key: string, value: string, p?: number): void {
  const row = rows.value[i]
  if (row === undefined) return
  if (p === undefined) row[key] = value
  else {
    const cell = Array.isArray(row[key]) ? [...(row[key] as string[])] : ['', '', '']
    cell[p] = value
    row[key] = cell
  }
}
function leaveRow(e: FocusEvent): void {
  const row = e.currentTarget as HTMLElement
  if (e.relatedTarget instanceof Node && row.contains(e.relatedTarget)) return
  commitRows()
}

/** What a summary shows: the app's line, or the count of entries a list holds, or none. */
const summaryLine = computed(() => {
  if (props.summary !== undefined) return props.summary
  const v = props.value
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'entry' : 'entries'}`
  return v === null || v === undefined ? 'None' : JSON.stringify(v)
})
const summaryOpen = ref(false)
/** The words of a summary's text: its numbers are as the record stores them, in the stored unit where the app names one. */
const editWords = computed(() => {
  const stored = f.value.quantity === undefined ? undefined : props.units.storedLabel?.(f.value.quantity)
  return stored ? `Edit as text, in ${stored}` : 'Edit as text'
})

/** Gives what is typed and not yet given. */
function flush(): void {
  const k = f.value.kind
  if (k === 'number') commitNumber()
  else if (k === 'text') commitText()
  else if (k === 'vector') commitVector()
  else if (k === 'json' || k === 'summary') commitJson()
  else if (k === 'rows') commitRows()
}
defineExpose({ flush })

/** The kinds drawn as a group under one label, rather than one control a label names. */
const grouped = computed(() => ['vector', 'switches', 'rows', 'refList'].includes(f.value.kind))
const id = computed(() => `${uid}-${f.value.name}`)
</script>

<template>
  <div v-if="field.kind !== 'app'" class="aether-record-field" :class="`aether-record-field--${field.kind}`" :data-field-row="field.name">
    <template v-if="field.kind === 'flag'">
      <label class="aether-record-field__flag">
        <Switch :model-value="value === true" :disabled="locked" :name="field.name" :data-field="field.name" @update:model-value="setFlag" />
        <span class="aether-record-field__label">{{ field.label }}</span>
      </label>
    </template>
    <template v-else>
      <label v-if="!grouped" class="aether-record-field__label" :for="id">
        {{ field.label }}<em v-if="!field.required" class="aether-record-field__opt">optional</em>
      </label>
      <span v-else :id="`${id}-label`" class="aether-record-field__label">
        {{ field.label }}<span v-if="field.kind === 'vector' && unit" class="aether-record-field__label-unit" data-unit>, {{ unit }}</span
        ><em v-if="!field.required" class="aether-record-field__opt">optional</em>
      </span>

      <div v-if="field.kind === 'number'" class="aether-record-field__box">
        <TextField
          :id="id"
          v-model="text"
          :disabled="locked"
          :name="field.name"
          :data-field="field.name"
          inputmode="decimal"
          autocomplete="off"
          @change="commitNumber"
          @keydown.enter="commitNumber"
        />
        <span v-if="unit" class="aether-record-field__unit">{{ unit }}</span>
      </div>

      <template v-else-if="field.kind === 'choice'">
        <Select
          :id="id"
          :model-value="typeof value === 'string' ? value : ''"
          :options="[{ value: '', label: field.blank }, ...field.options]"
          :disabled="locked"
          :name="field.name"
          :data-field="field.name"
          @update:model-value="setChoice"
        />
        <button
          v-if="field.ref !== undefined && typeof value === 'string' && field.options.some((o) => o.value === value)"
          type="button"
          class="aether-record-field__open"
          :data-open-ref="value"
          @click="emit('open', value)"
        >
          Open {{ field.refWord ?? field.label.toLowerCase() }} {{ value }}
        </button>
      </template>

      <div v-else-if="field.kind === 'vector'" class="aether-record-field__vector" role="group" :aria-labelledby="`${id}-label`" @focusout="leaveVector">
        <span v-for="(axis, i) in AXES" :key="axis" class="aether-record-field__box aether-record-field__axis">
          <span class="aether-record-field__axis-name" aria-hidden="true">{{ axis }}</span>
          <TextField
            :model-value="parts[i] ?? ''"
            :disabled="locked"
            :name="`${field.name}.${axis}`"
            :data-field="field.name"
            :data-axis="axis"
            :aria-label="`${field.label} ${axis}`"
            inputmode="decimal"
            autocomplete="off"
            @update:model-value="parts[i] = $event"
            @keydown.enter="commitVector"
          />
        </span>
      </div>

      <div v-else-if="field.kind === 'switches'" class="aether-record-field__switches" role="group" :aria-labelledby="`${id}-label`">
        <div v-if="field.presets?.length" class="aether-record-field__presets">
          <Tool v-for="p in field.presets" :key="p.label" :label="p.label" :disabled="locked" :data-preset="p.label" @click="give(p.value)" />
        </div>
        <label v-for="o in field.options" :key="o.value" class="aether-record-field__switch">
          <Switch
            :model-value="isOn(o.value)"
            :disabled="locked"
            :name="field.name"
            :data-field="field.name"
            :data-option="o.value"
            :aria-label="`${field.label} ${o.label}`"
            @update:model-value="setSwitch(o.value, $event)"
          />
          <span>{{ o.label }}</span>
        </label>
      </div>

      <div v-else-if="field.kind === 'refList'" class="aether-record-field__refs" role="group" :aria-labelledby="`${id}-label`">
        <Select
          v-for="i in slots"
          :key="i"
          :model-value="entries[i - 1] ?? ''"
          :options="[{ value: '', label: field.blank }, ...field.options]"
          :disabled="locked"
          :name="field.name"
          :data-field="field.name"
          :aria-label="`${field.label} ${i}`"
          @update:model-value="setRef(i - 1, $event)"
        />
      </div>

      <div v-else-if="field.kind === 'rows'" class="aether-record-field__rows" role="group" :aria-labelledby="`${id}-label`" :data-field="field.name">
        <table class="aether-record-field__table">
          <thead>
            <tr>
              <th>#</th>
              <th v-for="c in field.columns" :key="c.key" scope="col">
                {{ c.label }}<span v-if="unitOf(c.quantity)" class="aether-record-field__head-unit"> ({{ unitOf(c.quantity) }})</span>
              </th>
              <th><span class="aether-record-field__hidden">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(_, i) in rows" :key="i" :data-row="i" @focusout="leaveRow">
              <td class="aether-record-field__n">{{ i + 1 }}</td>
              <td v-for="c in field.columns" :key="c.key">
                <Select
                  v-if="c.options"
                  :model-value="cellText(i, c.key)"
                  :options="c.options"
                  :disabled="locked"
                  :aria-label="`${c.label}, row ${i + 1}`"
                  @update:model-value="(setCell(i, c.key, $event), commitRows())"
                />
                <span v-else-if="c.vector" class="aether-record-field__cellvec">
                  <TextField
                    v-for="(axis, p) in AXES"
                    :key="axis"
                    :model-value="cellPart(i, c.key, p)"
                    :disabled="locked"
                    :aria-label="`${c.label} ${axis}, row ${i + 1}`"
                    :placeholder="axis"
                    inputmode="decimal"
                    autocomplete="off"
                    @update:model-value="setCell(i, c.key, $event, p)"
                    @keydown.enter="commitRows()"
                  />
                </span>
                <TextField
                  v-else
                  :model-value="cellText(i, c.key)"
                  :disabled="locked"
                  :aria-label="`${c.label}, row ${i + 1}`"
                  inputmode="decimal"
                  autocomplete="off"
                  @update:model-value="setCell(i, c.key, $event)"
                  @keydown.enter="commitRows()"
                />
              </td>
              <td>
                <Tool :label="`Remove row ${i + 1}`" :disabled="locked" class="aether-record-field__remove" @click="removeRow(i)" />
              </td>
            </tr>
          </tbody>
        </table>
        <Tool :label="`Add a row to ${field.label.toLowerCase()}`" :disabled="locked" class="aether-record-field__add" @click="addRow" />
      </div>

      <div v-else-if="field.kind === 'summary'" class="aether-record-field__summary">
        <span class="aether-record-field__summary-line" :data-summary="field.name">{{ summaryLine }}</span>
        <Disclosure v-model:open="summaryOpen" :label="editWords" :disabled="locked" class="aether-record-field__summary-edit">
          <TextField v-model="text" multiline :rows="3" :disabled="locked" :name="field.name" :data-field="field.name" autocomplete="off" @change="commitJson" />
        </Disclosure>
      </div>

      <TextField
        v-else-if="field.kind === 'text'"
        :id="id"
        v-model="text"
        :disabled="locked"
        :name="field.name"
        :data-field="field.name"
        autocomplete="off"
        @change="commitText"
        @keydown.enter="commitText"
      />

      <TextField
        v-else
        :id="id"
        v-model="text"
        :disabled="locked"
        :name="field.name"
        :data-field="field.name"
        autocomplete="off"
        @change="commitJson"
        @keydown.enter="commitJson"
      />
    </template>
    <Callout v-if="issue" tone="danger" class="aether-record-field__refusal">{{ issue }}</Callout>
  </div>
</template>

<style scoped>
.aether-record-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.aether-record-field--rows,
.aether-record-field--summary,
.aether-record-field--json {
  grid-column: 1 / -1;
}
.aether-record-field__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--aether-ink-soft);
}
.aether-record-field__label-unit {
  font-weight: 400;
  color: var(--aether-faint);
}
.aether-record-field__opt {
  margin-left: 6px;
  font-style: normal;
  font-weight: 400;
  color: var(--aether-faint);
}
.aether-record-field__flag {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 13.5px;
}
.aether-record-field__box {
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--aether-line-strong);
  background: var(--aether-surface);
}
.aether-record-field__box:focus-within {
  border-color: var(--aether-ink);
}
.aether-record-field__box :deep(.aether-textfield) {
  border: 0;
  outline: none;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 42px;
  background: transparent;
  font-variant-numeric: tabular-nums;
}
.aether-record-field__unit {
  flex: none;
  padding: 0 10px 0 4px;
  font-size: 12.5px;
  color: var(--aether-faint);
  white-space: nowrap;
}
.aether-record-field__vector {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.aether-record-field__axis-name {
  flex: none;
  padding-left: 8px;
  font-size: 12px;
  color: var(--aether-faint);
}
.aether-record-field__switches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.aether-record-field__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-basis: 100%;
}
.aether-record-field__switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  font-size: 13.5px;
}
/* The link to the record chosen: a native button drawn as a link, since the kit has no link control. */
.aether-record-field__open {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--aether-cool);
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}
.aether-record-field__refs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
  gap: 6px;
}
.aether-record-field__rows {
  display: grid;
  gap: 8px;
  overflow-x: auto;
}
.aether-record-field__table {
  border-collapse: collapse;
  font-size: 13px;
}
.aether-record-field__table th {
  padding: 4px 6px;
  text-align: left;
  font-weight: 500;
  color: var(--aether-ink-soft);
  white-space: nowrap;
}
.aether-record-field__table td {
  padding: 2px 4px;
  vertical-align: middle;
}
.aether-record-field__table :deep(.aether-textfield) {
  min-width: 64px;
  font-variant-numeric: tabular-nums;
}
.aether-record-field__cellvec {
  display: grid;
  grid-template-columns: repeat(3, minmax(56px, 1fr));
  gap: 4px;
}
.aether-record-field__n {
  color: var(--aether-faint);
  font-variant-numeric: tabular-nums;
}
.aether-record-field__head-unit {
  font-weight: 400;
  color: var(--aether-faint);
}
.aether-record-field__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.aether-record-field__add {
  justify-self: start;
}
.aether-record-field__summary {
  display: grid;
  gap: 6px;
}
.aether-record-field__summary-line {
  font-variant-numeric: tabular-nums;
}
.aether-record-field__refusal {
  margin: 0;
  font-size: 13px;
}
.aether-record-field :deep(.aether-tool),
.aether-record-field :deep(.aether-select) {
  min-height: 44px;
}
</style>
