<script setup lang="ts">
/* Thin Vue wrapper over the Tool primitive. A header action button used across
 * all six desk surfaces. `hot` marks the primary action. Click handler is the
 * caller's; this wrapper owns only presentation + emit. */
defineProps<{
  label: string
  hot?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    :class="{ tool: true, hot: !!hot }"
    :disabled="disabled"
    @click="emit('click')"
  >
    {{ label }}
  </button>
</template>
