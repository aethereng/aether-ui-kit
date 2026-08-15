<script setup lang="ts">
/* Thin wrapper, per the packaging decision -- this file owns rendering and Vue reactivity only.
 * All the actual logic (get/set, validation, change events) lives in PropertyEditorEngine, which
 * has never heard of Vue. This component's only job is: instantiate the engine, react to its
 * change events, and render one widget per field type. */
import { computed, onScopeDispose, reactive, watch } from 'vue'
import { coerceNumberInput, numberStep, PropertyEditorEngine } from '../core/PropertyEditorEngine'
import type { FieldDescriptor, FieldValues } from '../core/types'
import DateField from './DateField.vue'

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

/* Commits only on a COMPLETE number, or on a genuinely emptied field. An in-progress keystroke is
   left alone rather than written back -- see coerceNumberInput for why `validity.badInput` is the
   only way to tell "mid-decimal" from "cleared" on a number input. */
function onNumberInput(key: string, el: HTMLInputElement) {
  const result = coerceNumberInput(el.value, el.validity.badInput)
  if (result.commit) onFieldInput(key, result.value)
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

      <input
        v-if="field.type === 'text'"
        :id="`pe-${field.key}`"
        type="text"
        :placeholder="field.placeholder"
        :value="view[field.key] as string"
        @input="onFieldInput(field.key, ($event.target as HTMLInputElement).value)"
      />

      <!-- Wrapped even with no suffix, so the row is always the same width -- see
           .aether-property-editor__number in ui-kit.css for why the input gives up its usual
           100% width only inside this wrapper. -->
      <div v-else-if="field.type === 'number'" class="aether-property-editor__number">
        <input
          :id="`pe-${field.key}`"
          type="number"
          :step="numberStep(field)"
          :min="field.min"
          :max="field.max"
          :value="view[field.key] as number"
          @input="onNumberInput(field.key, $event.target as HTMLInputElement)"
        />
        <span v-if="field.suffix" class="aether-property-editor__suffix">{{ field.suffix }}</span>
      </div>

      <!-- A range does NOT write a corrected value back on mount, and that is the contract worth
           stating: a native range snaps its THUMB to the nearest step, and a component that read
           `.value` back on render would silently rewrite 0.37 to 0.35 in the caller's data for a
           field the user never touched. Controlled binding plus emit-on-input only means the stored
           value survives until the user actually drags. The readout shows the STORED number, not
           the thumb position, so the two never disagree silently. -->
      <div v-else-if="field.type === 'range'" class="aether-property-editor__range">
        <input
          :id="`pe-${field.key}`"
          type="range"
          :step="numberStep(field)"
          :min="field.min"
          :max="field.max"
          :value="view[field.key] as number"
          @input="onNumberInput(field.key, $event.target as HTMLInputElement)"
        />
        <output class="aether-property-editor__readout" :for="`pe-${field.key}`">
          {{ view[field.key] }}<span v-if="field.suffix"> {{ field.suffix }}</span>
        </output>
      </div>

      <textarea
        v-else-if="field.type === 'textarea'"
        :id="`pe-${field.key}`"
        :placeholder="field.placeholder"
        :value="view[field.key] as string"
        @input="onFieldInput(field.key, ($event.target as HTMLTextAreaElement).value)"
      />

      <!-- Not a bare <input type="date">: the browser's own picker popup cannot be styled, so this
           wrapper suppresses it and supplies one built from the kit's tokens. See DateField.vue. -->
      <DateField
        v-else-if="field.type === 'date'"
        :id="`pe-${field.key}`"
        :model-value="view[field.key] as string"
        @update:model-value="onFieldInput(field.key, $event)"
      />

      <input
        v-else-if="field.type === 'boolean'"
        :id="`pe-${field.key}`"
        type="checkbox"
        :checked="view[field.key] as boolean"
        @change="onFieldInput(field.key, ($event.target as HTMLInputElement).checked)"
      />

      <!-- enum: two variants of the SAME underlying value, per Decision 4's field-type table --
           a button group vs a dropdown, same descriptor, caller picks the display. -->
      <div
        v-else-if="field.type === 'enum' && field.variant === 'buttons'"
        class="aether-property-editor__buttons"
      >
        <button
          v-for="opt in field.options"
          :key="opt.value"
          type="button"
          :class="{ on: view[field.key] === opt.value }"
          @click="onFieldInput(field.key, opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <select
        v-else-if="field.type === 'enum'"
        :id="`pe-${field.key}`"
        :value="view[field.key] as string"
        @change="onFieldInput(field.key, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

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
