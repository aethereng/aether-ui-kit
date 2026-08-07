<script setup lang="ts">
/* Thin wrapper, per the packaging decision -- this file owns rendering and Vue reactivity only.
 * All the actual logic (get/set, validation, change events) lives in PropertyEditorEngine, which
 * has never heard of Vue. This component's only job is: instantiate the engine, react to its
 * change events, and render one widget per field type. */
import { computed, onScopeDispose, reactive, watch } from 'vue'
import { PropertyEditorEngine } from '../core/PropertyEditorEngine'
import type { FieldDescriptor, FieldValues } from '../core/types'

const props = defineProps<{
  fields: FieldDescriptor[]
  modelValue: FieldValues
}>()

const emit = defineEmits<{
  'update:modelValue': [values: FieldValues]
  change: [key: string, value: unknown]
}>()

const engine = new PropertyEditorEngine(props.fields, props.modelValue)
const errors = reactive<Record<string, string>>({})

const unsubscribe = engine.onChange((e) => {
  emit('update:modelValue', engine.getValues())
  emit('change', e.key, e.value)
  revalidate()
})
onScopeDispose(unsubscribe)

function revalidate() {
  for (const key of Object.keys(errors)) delete errors[key]
  for (const err of engine.validate()) errors[err.key] = err.message
}
revalidate()

/* Incoming modelValue changes (e.g. selecting a different entity) re-seed the engine rather than
   mutate it in place -- a new selection is a new editing session, not a diff of the old one. */
watch(
  () => props.modelValue,
  (next) => {
    for (const field of props.fields) {
      if (engine.getValue(field.key) !== next[field.key]) {
        engine['values'] // eslint-disable-line @typescript-eslint/no-unused-expressions
      }
    }
  },
)

function onFieldInput(key: string, value: unknown) {
  engine.setValue(key, value)
}

const hasErrors = computed(() => Object.keys(errors).length > 0)
defineExpose({ isValid: () => !hasErrors.value, getValues: () => engine.getValues() })
</script>

<template>
  <div class="aether-property-editor">
    <div v-for="field in fields" :key="field.key" class="aether-property-editor__field">
      <label :for="`pe-${field.key}`">{{ field.label }}</label>

      <input
        v-if="field.type === 'text'"
        :id="`pe-${field.key}`"
        type="text"
        :placeholder="field.placeholder"
        :value="engine.getValue(field.key) as string"
        @input="onFieldInput(field.key, ($event.target as HTMLInputElement).value)"
      />

      <textarea
        v-else-if="field.type === 'textarea'"
        :id="`pe-${field.key}`"
        :placeholder="field.placeholder"
        :value="engine.getValue(field.key) as string"
        @input="onFieldInput(field.key, ($event.target as HTMLTextAreaElement).value)"
      />

      <input
        v-else-if="field.type === 'date'"
        :id="`pe-${field.key}`"
        type="date"
        :value="engine.getValue(field.key) as string"
        @input="onFieldInput(field.key, ($event.target as HTMLInputElement).value)"
      />

      <input
        v-else-if="field.type === 'boolean'"
        :id="`pe-${field.key}`"
        type="checkbox"
        :checked="engine.getValue(field.key) as boolean"
        @change="onFieldInput(field.key, ($event.target as HTMLInputElement).checked)"
      />

      <!-- enum: two variants of the SAME underlying value, per Decision 4's field-type table --
           the desk's button-group vs Etere's dropdown, same descriptor, caller picks the display. -->
      <div v-else-if="field.type === 'enum' && field.variant === 'buttons'" class="aether-property-editor__buttons">
        <button
          v-for="opt in field.options"
          :key="opt.value"
          type="button"
          :class="{ on: engine.getValue(field.key) === opt.value }"
          @click="onFieldInput(field.key, opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <select
        v-else-if="field.type === 'enum'"
        :id="`pe-${field.key}`"
        :value="engine.getValue(field.key) as string"
        @change="onFieldInput(field.key, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <!-- reference / placement: the widget a real consumer supplies via a slot, since only the
           caller knows how to pick a referenced entity or edit a 3D placement -- this component
           renders the raw value and gets out of the way rather than guessing at that UI. -->
      <slot v-else-if="field.type === 'reference'" name="reference" :field="field" :value="engine.getValue(field.key)" :set="(v: unknown) => onFieldInput(field.key, v)">
        <input readonly :value="String(engine.getValue(field.key) ?? '')" />
      </slot>
      <slot v-else-if="field.type === 'placement'" name="placement" :field="field" :value="engine.getValue(field.key)" :set="(v: unknown) => onFieldInput(field.key, v)">
        <input readonly :value="JSON.stringify(engine.getValue(field.key) ?? null)" />
      </slot>

      <span v-if="errors[field.key]" class="aether-property-editor__error">{{ errors[field.key] }}</span>
    </div>
  </div>
</template>
