<script setup lang="ts">
/* Thin wrapper, per the packaging decision -- this file owns rendering and Vue reactivity only.
 * All the actual logic (get/set, validation, change events) lives in PropertyEditorEngine, which
 * has never heard of Vue. This component's only job is: instantiate the engine, react to its
 * change events, and render one widget per field type. */
import { computed, onScopeDispose, reactive, watch } from 'vue'
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
