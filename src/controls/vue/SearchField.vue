<script setup lang="ts">
/* Search input with a clear button that appears only once there is something to clear.
 *
 * Extracted after two surfaces shipped it identically — same wrapper, same absolutely
 * positioned circular button, same glyph, same "only when non-empty" rule, down to matching
 * CSS in both source files. That is the bar: two real consumers sharing a render paradigm, a
 * data shape (one string) and an interaction contract, not two things that merely look alike.
 *
 * Controlled, like the rest of the kit: the caller owns the query string. */
import { ref } from 'vue'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    ariaLabel?: string
    /** Tooltip + accessible name for the clear button. */
    clearLabel?: string
  }>(),
  { placeholder: 'Search…', ariaLabel: undefined, clearLabel: 'Clear search' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()

const inputEl = ref<HTMLInputElement | null>(null)

/* A host with a focus-the-search shortcut (ours binds "/") needs a way in without
 * reaching through the DOM for an input it does not own. */
defineExpose({ focus: () => inputEl.value?.focus() })

function onClear() {
  emit('update:modelValue', '')
  emit('clear')
  // return the caret to the field — clearing is almost always followed by retyping
  inputEl.value?.focus()
}
</script>

<template>
  <span class="aether-search" :class="{ has: modelValue.length > 0 }">
    <input
      ref="inputEl"
      type="search"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="ariaLabel ?? placeholder"
      autocomplete="off"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      class="aether-search__clear"
      type="button"
      :aria-label="clearLabel"
      :title="clearLabel"
      @click="onClear"
    >
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2.6 2.6 7.4 7.4M7.4 2.6 2.6 7.4" />
      </svg>
    </button>
  </span>
</template>
