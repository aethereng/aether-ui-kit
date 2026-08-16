<script setup lang="ts">
/* Thin wrapper, per the packaging decision -- this file owns rendering and Vue reactivity only.
 * All the actual logic (get/set, validation, change events) lives in PropertyEditorEngine, which
 * has never heard of Vue. This component's only job is: instantiate the engine, react to its
 * change events, and render one widget per field type. */
import { computed, nextTick, onScopeDispose, reactive, watch } from 'vue'
import { numberStep, PropertyEditorEngine } from '../core/PropertyEditorEngine'
import type { FieldDescriptor, FieldValues } from '../core/types'
import DateField from './DateField.vue'
/* This component composes the kit's standalone controls rather than hand-rolling raw inputs. It
   used to render `<input>`/`<select>`/`<textarea>` directly with the styling keyed to
   `.aether-property-editor__field`, which meant the controls existed only inside a form — a
   consumer with one standalone toggle could not reach them. The engine below is what this
   component is actually for; the widgets are now shared. */
import Switch from '../../controls/vue/Switch.vue'
import Slider from '../../controls/vue/Slider.vue'
import Select from '../../controls/vue/Select.vue'
import NumberField from '../../controls/vue/NumberField.vue'
import TextField from '../../controls/vue/TextField.vue'

const props = defineProps<{
  fields: FieldDescriptor[]
  modelValue: FieldValues
  /* Where the field labels sit. 'above' (the default) is a property SHEET: labels align down the
     left, values down the right, and a long list scans well. 'inside' puts a small permanent label
     in the control's own box for FORM surfaces -- a dialog that already scrolls, where each field
     should read as one object and two lines per field is a real cost.
     Whole-component on purpose, not per field: a form should be internally consistent. Only the
     five boxed types can carry it; see ui-kit.css for which and why. */
  labelPlacement?: 'above' | 'inside'
}>()

const emit = defineEmits<{
  'update:modelValue': [values: FieldValues]
  change: [key: string, value: unknown]
}>()

let engine = new PropertyEditorEngine(props.fields, props.modelValue)
const errors = reactive<Record<string, string>>({})

/* The engine is a plain class and knows nothing about Vue, which is the point -- but it means
 * reading engine.getValue() from the template registers NO reactive dependency, so a change
 * would never re-render. Native inputs hid this (the browser mutates its own DOM), but the
 * enum button group has no native state and sat frozen on its initial value while the model
 * moved underneath it. `view` is the reactive mirror the template reads; the engine stays the
 * source of truth and this follows it. */
const view = reactive<FieldValues>({ ...props.modelValue })

let unsubscribe = subscribe()
function subscribe() {
  return engine.onChange((e) => {
    view[e.key] = e.value
    emit('update:modelValue', engine.getValues())
    emit('change', e.key, e.value)
    revalidate()
  })
}
onScopeDispose(() => unsubscribe())

function revalidate() {
  for (const key of Object.keys(errors)) delete errors[key]
  for (const err of engine.validate()) errors[err.key] = err.message
}
revalidate()

/* Incoming modelValue changes (e.g. selecting a different entity) re-seed the engine rather than
   mutate it in place -- a new selection is a new editing session, not a diff of the old one.
   This previously evaluated a bare expression and did nothing at all, so a host that swapped
   the bound object kept editing the previous one's values indefinitely. */
watch(
  () => props.modelValue,
  (next) => {
    unsubscribe()
    engine = new PropertyEditorEngine(props.fields, next)
    unsubscribe = subscribe()
    for (const key of Object.keys(view)) delete view[key]
    Object.assign(view, next)
    revalidate()
  },
)

function onFieldInput(key: string, value: unknown) {
  engine.setValue(key, value)
}

/* The number field's commit rule -- leave an in-progress keystroke alone, using `validity.badInput`
   to tell "mid-decimal" from "cleared" -- moved into NumberField with the control itself. It was
   never form logic; it is what typing a number means. */

/* ---- the enum button group's radiogroup behaviour ----
 *
 * Roving tabindex: exactly ONE button in the group is tabbable, so the group is a single stop in
 * the tab order rather than one stop per option. The tabbable one is the checked option — or the
 * first, when nothing is checked yet, because a group you cannot tab into at all is worse than one
 * that starts at the top. */
function radioTabIndex(field: FieldDescriptor, value: string): number {
  const current = view[field.key]
  if (current === value) return 0
  const anyChecked = (field.options ?? []).some((o) => o.value === current)
  return !anyChecked && field.options?.[0]?.value === value ? 0 : -1
}

/* Arrows wrap, and they SELECT as they move — the radio pattern, where the focused option is the
 * chosen one. Home/End reach the ends. Space and Enter are left to the button's own click.
 * `preventDefault` on the arrows stops the page scrolling underneath the group. */
function onRadioKey(e: KeyboardEvent, field: FieldDescriptor) {
  const opts = field.options ?? []
  if (!opts.length) return
  const at = opts.findIndex((o) => o.value === view[field.key])
  let next = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (at + 1 + opts.length) % opts.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
    next = (at <= 0 ? opts.length : at) - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = opts.length - 1
  else return

  e.preventDefault()
  const value = opts[next]!.value
  /* Scoped to THIS group via the event's own element. A document-wide lookup would find the first
     matching button on the page, so a form with two enum groups would move focus into the wrong
     one — and only when both happened to share an option value, which is the kind of bug that
     survives a demo. */
  const group = e.currentTarget as HTMLElement
  onFieldInput(field.key, value)
  /* Focus follows selection, or the roving tabindex points at a button the user is not on.
     Post-flush, because the tabindex that makes it focusable renders from the value just set. */
  nextTick(() => {
    group.querySelector<HTMLElement>(`[data-rv="${CSS.escape(value)}"]`)?.focus()
  })
}

const hasErrors = computed(() => Object.keys(errors).length > 0)
defineExpose({ isValid: () => !hasErrors.value, getValues: () => engine.getValues() })
</script>

<template>
  <div
    class="aether-property-editor"
    :class="{ 'aether-property-editor--inside': labelPlacement === 'inside' }"
  >
    <div v-for="field in fields" :key="field.key" class="aether-property-editor__field">
      <!-- The swatch is aria-hidden and carries no text: it repeats the encoding of the thing the
           field controls, so a screen reader that also announced it would read the label twice in
           two vocabularies. The label alone remains the accessible name. -->
      <label :for="`pe-${field.key}`">
        <span
          v-if="field.swatch"
          class="aether-property-editor__swatch"
          :style="field.swatch"
          aria-hidden="true"
        ></span>{{ field.label }}
      </label>

      <TextField
        v-if="field.type === 'text'"
        :id="`pe-${field.key}`"
        :placeholder="field.placeholder"
        :model-value="view[field.key] as string"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <!-- Wrapped even with no suffix, so the row is always the same width -- see
           .aether-property-editor__number in ui-kit.css for why the input gives up its usual
           100% width only inside this wrapper. -->
      <NumberField
        v-else-if="field.type === 'number'"
        :id="`pe-${field.key}`"
        :model-value="view[field.key] as number"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :precision="field.precision"
        :suffix="field.suffix"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <!-- A range does NOT write a corrected value back on mount, and that is the contract worth
           stating: a native range snaps its THUMB to the nearest step, and a component that read
           `.value` back on render would silently rewrite 0.37 to 0.35 in the caller's data for a
           field the user never touched. Controlled binding plus emit-on-input only means the stored
           value survives until the user actually drags. The readout shows the STORED number, not
           the thumb position, so the two never disagree silently. -->
      <Slider
        v-else-if="field.type === 'range'"
        :id="`pe-${field.key}`"
        :model-value="view[field.key] as number"
        :min="field.min ?? 0"
        :max="field.max ?? 100"
        :step="numberStep(field)"
        :suffix="field.suffix"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <TextField
        v-else-if="field.type === 'textarea'"
        :id="`pe-${field.key}`"
        multiline
        :placeholder="field.placeholder"
        :model-value="view[field.key] as string"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <!-- Not a bare <input type="date">: the browser's own picker popup cannot be styled, so this
           wrapper suppresses it and supplies one built from the kit's tokens. See DateField.vue. -->
      <DateField
        v-else-if="field.type === 'date'"
        :id="`pe-${field.key}`"
        :model-value="view[field.key] as string"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <!-- The switch is a standalone component now rather than a raw input styled by this form's
           class. Same element underneath -- `input[type=checkbox]`, one extra class -- so a host
           override written against `.aether-property-editor__field input[type='checkbox']` still
           matches. That is pinned by a test. -->
      <Switch
        v-else-if="field.type === 'boolean'"
        :id="`pe-${field.key}`"
        :model-value="view[field.key] as boolean"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <!-- enum: two variants of the SAME underlying value, per Decision 4's field-type table --
           a button group vs a dropdown, same descriptor, caller picks the display.

           A RADIOGROUP, not a row of buttons. It rendered as a bare <div> of <button>s with an
           `on` class, which is a single-choice control that never says so: a screen reader
           announced three unrelated buttons, never that one of three was chosen nor which, and a
           keyboard user got three tab stops instead of one control to arrow inside.

           Deliberately NOT Seg, which looks identical. Seg is role="tablist" with role="tab"
           children — it announces tabs, and a form field is not a tab strip. Same pixels, different
           thing to say.

           Arrows MOVE AND SELECT here, which is the radio pattern and differs from the menu's:
           in a radiogroup the focused option is the chosen one, so there is no separate commit. -->
      <div
        v-else-if="field.type === 'enum' && field.variant === 'buttons'"
        class="aether-property-editor__buttons"
        role="radiogroup"
        :aria-label="field.label"
        @keydown="onRadioKey($event, field)"
      >
        <button
          v-for="opt in field.options"
          :key="opt.value"
          type="button"
          role="radio"
          :aria-checked="view[field.key] === opt.value"
          :data-rv="opt.value"
          :tabindex="radioTabIndex(field, opt.value)"
          :class="{ on: view[field.key] === opt.value }"
          @click="onFieldInput(field.key, opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <Select
        v-else-if="field.type === 'enum'"
        :id="`pe-${field.key}`"
        :options="field.options ?? []"
        :model-value="view[field.key] as string"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <!-- reference / placement: the widget a real consumer supplies via a slot, since only the
           caller knows how to pick a referenced entity or edit a 3D placement -- this component
           renders the raw value and gets out of the way rather than guessing at that UI. -->
      <slot
        v-else-if="field.type === 'reference'"
        name="reference"
        :field="field"
        :value="view[field.key]"
        :set="(v: unknown) => onFieldInput(field.key, v)"
      >
        <input readonly :value="String(view[field.key] ?? '')" />
      </slot>
      <slot
        v-else-if="field.type === 'placement'"
        name="placement"
        :field="field"
        :value="view[field.key]"
        :set="(v: unknown) => onFieldInput(field.key, v)"
      >
        <input readonly :value="JSON.stringify(view[field.key] ?? null)" />
      </slot>

      <span v-if="errors[field.key]" class="aether-property-editor__error">{{
        errors[field.key]
      }}</span>
    </div>
  </div>
</template>
