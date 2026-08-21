<script setup lang="ts">
/* Free text, single- or multi-line.
 *
 * `multiline` is a PROP rather than a second component, and that is the kit's own rule applied
 * consistently: different INTERACTION means a different component, different SHAPE means a prop.
 * A textarea types exactly like an input — same data, same commit-per-keystroke, same bordered box
 * — and only its shape differs, which is the `enum` variant case. NumberField is a component for
 * the opposite reason: it cannot commit per keystroke without making "1.5" unreachable. */

import { nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    multiline?: boolean
    /** Visible rows when multiline. Ignored otherwise, and ignored once `autogrow` takes over —
     *  kept only as the height the very first paint uses, before JS has measured anything. */
    rows?: number
    placeholder?: string
    disabled?: boolean
    /** Multiline only. Height tracks content instead of a fixed `rows`, growing and shrinking
     *  live — both on typing and when `modelValue` changes from OUTSIDE (a caller reassigning
     *  the field's value, not just the user typing into it). Also switches `resize` off: once
     *  height is no longer something to drag, the browser's own corner-triangle glyph is
     *  leftover affordance for a gesture that no longer does anything. No min-height here for
     *  the same reason the multiline rule above has none — that is the caller's layout to set,
     *  not this component's to assume. */
    autogrow?: boolean
  }>(),
  { multiline: false, rows: 3, placeholder: undefined, disabled: false, autogrow: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)

function grow() {
  const el = textareaEl.value
  if (!el) return
  // Reset before measuring: a textarea already holding an explicit height only ever reports
  // that height back from scrollHeight, never a smaller one, so shrinking on deletion needs
  // the browser to recompute from scratch first.
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

if (props.autogrow) {
  // One path covers both triggers: typing emits update:modelValue, the caller's v-model writes
  // it back into the `modelValue` prop, and that is what this watches — so a caller
  // reassigning the value directly re-measures exactly the same way typing does, with no
  // separate DOM 'input' listener needed for either case.
  watch(() => props.modelValue, () => nextTick(grow), { immediate: true })
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}
</script>

<template>
  <textarea
    v-if="multiline"
    ref="textareaEl"
    class="aether-textfield aether-textfield--multiline"
    :class="{ 'aether-textfield--autogrow': autogrow }"
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
.aether-textfield--autogrow {
  resize: none;
  overflow-y: hidden;
}
</style>
