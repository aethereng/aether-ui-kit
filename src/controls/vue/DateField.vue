<script setup lang="ts">
/* The date field, with its own picker.
 *
 * IT USED TO BE PRIVATE to PropertyEditor — not in the exports map, not documented — which made it
 * the last control in the kit reachable only by describing a form: a FieldDescriptor[], a
 * FieldValues object and a (key, value) handler, to render one date input. That is the packaging
 * failure v0.13.0 named and fixed for five controls and RadioGroup fixed for a sixth; this is the
 * last of them. PropertyEditor composes it now, exactly as it composes the rest.
 *
 * It exists as its own control, rather than a styled `input[type="date"]`, because Chrome's date
 * picker popup cannot be styled at all: it is browser UI painted outside the page, not page
 * content. Verified rather than assumed — `input.shadowRoot` is null, the only
 * pseudo-elements Chrome exposes for a date input are the inline parts (`::-webkit-datetime-edit*`,
 * the three sub-fields, the picker indicator, the spin and clear buttons), the popup is in none of
 * them, and there is no opt-in: `base-select` is the only `appearance: base-*` value in Chromium
 * 148, so customizable controls shipped for <select> and not for date inputs.
 *
 * So the native popup is suppressed by hiding its indicator, and the panel below is ours. The
 * <input type="date"> is KEPT for typing: it gives locale-ordered segments, real validation, and —
 * the part worth protecting — on a touch device tapping the field still opens the OS date wheel,
 * which is better than anything drawn here. Hence no popup on coarse pointers: the platform's is
 * better there, and only the desktop popup was the ugly one.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  monthGrid,
  parseISO,
  sameDay,
  toISO,
  today,
  type YMD,
} from '../core/calendar'

const props = defineProps<{
  /** `YYYY-MM-DD`, or '' for empty — the value format of the native input this wraps. */
  modelValue: string
  id?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const captionId = useId()

const selected = computed(() => parseISO(props.modelValue))
/* The keyboard cursor, which is NOT the selection: arrowing around a calendar has to move a focus
 * ring without committing a value, or every arrow key would fire an update and a user exploring
 * next month would rewrite the field on the way. */
const cursor = ref<YMD>(selected.value ?? today())
const view = ref({ y: cursor.value.y, m: cursor.value.m })

const cells = computed(() => monthGrid(view.value.y, view.value.m))
const caption = computed(() => `${MONTH_LABELS[view.value.m - 1]} ${view.value.y}`)
const todayVal = today()

// Reopening on a field whose value changed elsewhere should start where the value is, not where the
// cursor was left last time.
watch(
  () => props.modelValue,
  () => {
    const s = selected.value
    if (s) {
      cursor.value = s
      view.value = { y: s.y, m: s.m }
    }
  },
)

function onNativeInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function openPicker() {
  const start = selected.value ?? today()
  cursor.value = start
  view.value = { y: start.y, m: start.m }
  open.value = true
  document.addEventListener('pointerdown', onDocPointer, true)
  nextTick(focusCursor)
}
function closePicker(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onDocPointer, true)
  if (returnFocus) trigger.value?.focus()
}
function onDocPointer(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) closePicker(false)
}
// Unmounting while open (the host hides the form mid-edit) must not leak the document listener.
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer, true))

function focusCursor() {
  gridEl.value?.querySelector<HTMLElement>('[data-cursor="true"]')?.focus()
}

function moveCursor(next: YMD) {
  cursor.value = next
  view.value = { y: next.y, m: next.m }
  nextTick(focusCursor)
}

function pick(d: YMD) {
  emit('update:modelValue', toISO(d))
  closePicker()
}

function onGridKey(e: KeyboardEvent) {
  const c = cursor.value
  const step = (n: number) => {
    e.preventDefault()
    moveCursor(addDays(c, n))
  }
  switch (e.key) {
    case 'ArrowLeft':
      return step(-1)
    case 'ArrowRight':
      return step(1)
    case 'ArrowUp':
      return step(-7)
    case 'ArrowDown':
      return step(7)
    case 'Home':
      // start of the displayed week, not of the month
      return step(-((new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay() + 6) % 7))
    case 'End':
      return step(6 - ((new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay() + 6) % 7))
    case 'PageUp':
    case 'PageDown': {
      e.preventDefault()
      const { y, m } = addMonths(c.y, c.m, e.key === 'PageUp' ? -1 : 1)
      // clamp: 31 Jan + one month is the last day of February, not the 3rd of March
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
      return moveCursor({ y, m, d: Math.min(c.d, last) })
    }
    case 'Escape':
      e.preventDefault()
      return closePicker()
  }
}

function stepMonth(delta: number) {
  const { y, m } = addMonths(view.value.y, view.value.m, delta)
  view.value = { y, m }
}
</script>

<template>
  <div ref="root" class="aether-datefield">
    <input
      :id="id"
      type="date"
      class="aether-datefield__input"
      :value="modelValue"
      @input="onNativeInput"
    />

    <!-- Our trigger, replacing the native indicator that the CSS below hides. Rendered only on a
         fine pointer: on touch the platform's own picker is the better control and the native input
         opens it on tap, so a second one here would fight it. -->
    <button
      ref="trigger"
      type="button"
      class="aether-datefield__trigger"
      aria-haspopup="dialog"
      :aria-expanded="open"
      aria-label="Choose date"
      @click="open ? closePicker() : openPicker()"
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
        <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" fill="none" stroke="currentColor" />
        <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" />
      </svg>
    </button>

    <div v-if="open" class="aether-datefield__pop" role="dialog" :aria-labelledby="captionId">
      <div class="aether-datefield__head">
        <button type="button" class="aether-datefield__nav" aria-label="Previous month" @click="stepMonth(-1)">
          ‹
        </button>
        <!-- aria-live so paging the month is announced; the grid below does not change identity -->
        <span :id="captionId" class="aether-datefield__caption" aria-live="polite">{{ caption }}</span>
        <button type="button" class="aether-datefield__nav" aria-label="Next month" @click="stepMonth(1)">
          ›
        </button>
      </div>

      <div class="aether-datefield__wk" aria-hidden="true">
        <span v-for="w in WEEKDAY_LABELS" :key="w">{{ w }}</span>
      </div>

      <!-- Roving tabindex: exactly one day is tabbable, so Tab leaves the grid rather than walking
           42 cells, and the arrow keys move within it. -->
      <div ref="gridEl" class="aether-datefield__grid" role="grid" @keydown="onGridKey">
        <button
          v-for="c in cells"
          :key="toISO(c)"
          type="button"
          role="gridcell"
          class="aether-datefield__day"
          :class="{
            out: !c.inMonth,
            sel: sameDay(c, selected),
            today: sameDay(c, todayVal),
          }"
          :data-cursor="sameDay(c, cursor)"
          :tabindex="sameDay(c, cursor) ? 0 : -1"
          :aria-selected="sameDay(c, selected)"
          @click="pick(c)"
        >
          {{ c.d }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A WRAPPER that looks like the input, with a borderless input inside it — the same construction as
   .aether-property-editor__number, and for the same reason: the trigger belongs INSIDE the box.
   A bordered input with a button next to it reads as two controls, and the icon looks like it
   belongs to the form rather than to this field. The inner input is stripped in ui-kit.css, where
   the rule can carry enough specificity to beat the shared `input[type='date']` box. */
.aether-datefield {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: 7px;
  padding: 5px 7px 5px 9px;
}
/* Focus feedback moves to the wrapper, because the wrapper is the thing with a visible edge now. */
.aether-datefield:focus-within {
  border-color: var(--aether-ink-soft);
}
/* The inner input, styled HERE since 0.13.0 rather than by the form's stylesheet. The wrapper is
   the thing with the border, so the input gives up its own box entirely — and it has to state its
   font and colour itself, because the shared `.aether-property-editor__field input` rule that used
   to supply them has gone with the other controls. Without this the date reads at the host's
   default size and colour inside a kit-sized box. */
.aether-datefield__input {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  font: inherit;
  font-size: 13.5px;
  color: var(--aether-ink);
  border: 0;
  background: transparent;
  padding: 0;
  border-radius: 0;
  accent-color: var(--aether-cool);
}
.aether-datefield__input:focus {
  outline: none;
}
/* The native indicator is hidden rather than merely restyled, because clicking it opens the popup
   that cannot be themed. With it gone there is no route to the browser's picker on a fine pointer,
   which is the point: one picker, ours. `appearance: none` alone does not remove it. */
.aether-datefield__input::-webkit-calendar-picker-indicator {
  display: none;
}
.aether-datefield__trigger {
  flex: none;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--aether-ink-soft);
  cursor: pointer;
}
.aether-datefield__trigger:hover {
  color: var(--aether-ink);
  border-color: var(--aether-line-strong);
}
.aether-datefield__trigger:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}

.aether-datefield__pop {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  right: 0;
  padding: 10px;
  border: 1px solid var(--aether-line-strong);
  border-radius: 10px;
  background: var(--aether-surface);
  box-shadow: var(--aether-shadow);
  /* the grid is 7 × 30px plus padding; fixed so paging months cannot resize the panel */
  width: 236px;
}
.aether-datefield__head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.aether-datefield__caption {
  flex: 1 1 auto;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--aether-ink);
}
.aether-datefield__nav {
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--aether-ink-soft);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.aether-datefield__nav:hover {
  color: var(--aether-ink);
  border-color: var(--aether-line-strong);
}
.aether-datefield__nav:focus-visible,
.aether-datefield__day:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: -1px;
}
.aether-datefield__wk,
.aether-datefield__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.aether-datefield__wk {
  margin-bottom: 2px;
  color: var(--aether-faint);
  font-size: 10.5px;
  text-align: center;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.aether-datefield__day {
  height: 30px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--aether-ink);
  font: inherit;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.aether-datefield__day:hover {
  background: var(--aether-panel);
}
/* Borrowed days stay visible but recede — hiding them would leave holes that break the grid's
   shape, and greying them is how you tell 31 July from 1 August at a glance. */
.aether-datefield__day.out {
  color: var(--aether-faint);
}
.aether-datefield__day.today {
  border-color: var(--aether-line-strong);
  font-weight: 650;
}
.aether-datefield__day.sel {
  background: var(--aether-cool);
  border-color: var(--aether-cool);
  color: var(--aether-warm-ink);
  font-weight: 650;
}

@media (pointer: coarse) {
  /* No popup on touch: tapping the input opens the OS date wheel, which beats anything drawn here,
     and two pickers on one field is worse than either. */
  .aether-datefield__trigger,
  .aether-datefield__pop {
    display: none;
  }
}
</style>
