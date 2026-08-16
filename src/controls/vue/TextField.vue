<script setup lang="ts">
/* Free text, single- or multi-line.
 *
 * `multiline` is a PROP rather than a second component, and that is the kit's own rule applied
 * consistently: different INTERACTION means a different component, different SHAPE means a prop.
 * A textarea types exactly like an input — same data, same commit-per-keystroke, same bordered box
 * — and only its shape differs, which is the `enum` variant case. NumberField is a component for
 * the opposite reason: it cannot commit per keystroke without making "1.5" unreachable. */

withDefaults(
  defineProps<{
    modelValue: string
    multiline?: boolean
    /** Visible rows when multiline. Ignored otherwise. */
    rows?: number
    placeholder?: string
    disabled?: boolean
  }>(),
  { multiline: false, rows: 3, placeholder: undefined, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}
</script>

<template>
  <textarea
    v-if="multiline"
    class="aether-textfield aether-textfield--multiline"
    :value="modelValue"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
  />
  <input
    v-else
    type="text"
    class="aether-textfield"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
  />
</template>

<style scoped>
.aether-textfield {
  box-sizing: border-box;
  width: 100%;
  font: inherit;
  font-size: 13.5px;
  color: var(--aether-ink);
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: 7px;
  padding: 7px 9px;
  accent-color: var(--aether-cool);
}
.aether-textfield:focus {
  outline: none;
  border-color: var(--aether-ink-soft);
}
.aether-textfield:disabled {
  color: var(--aether-faint);
  cursor: default;
}
.aether-textfield--multiline {
  /* Vertical only: a textarea that can be dragged wider escapes whatever column it sits in, and
     in a form that column is the layout.
     NO min-height. One was tried and removed: the height a textarea wants is what `rows` says, and
     a floor here fought labelPlacement="inside", whose 17px top padding then pushed the field 7px
     past where it had always been. */
  resize: vertical;
}
</style>
