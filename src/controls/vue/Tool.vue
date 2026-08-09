<script setup lang="ts">
/* Thin Vue wrapper over the Tool primitive. A header action button used across
 * all six desk surfaces. Click handler is the caller's; this wrapper owns only
 * presentation + emit.
 *
 * Three variants, deliberately a closed set rather than an open style hook:
 *   default — a neutral action
 *   hot     — the primary action on a surface
 *   danger  — a destructive action (delete, discard)
 * `hot` and `danger` are mutually exclusive in practice; if both are passed,
 * danger wins, because mislabelling a destructive action as primary is the
 * worse failure. */
defineProps<{
  label: string
  hot?: boolean
  danger?: boolean
  disabled?: boolean
  title?: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    :class="{ 'aether-tool': true, hot: !!hot && !danger, danger: !!danger }"
    :disabled="disabled"
    :title="title"
    @click="emit('click')"
  >
    {{ label }}
  </button>
</template>
