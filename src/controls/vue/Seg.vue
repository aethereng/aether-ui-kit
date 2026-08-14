<script setup lang="ts" generic="V extends string = string">
/* Thin Vue wrapper over the framework-free Seg core. Renders a segmented
 * control (one active option). Mechanical contract here; which option is active
 * and what a selection emits is the caller's domain. */
import type { SegOption, SegProps } from '../core/types'

/* Props come from the EXPORTED SegProps rather than an inline literal, so the public type and
 * what the component actually accepts cannot diverge. They had: `variant` was added here and
 * never reached SegProps, which index.ts tells consumers to type their own state against. */
const props = withDefaults(defineProps<SegProps<V>>(), {
  ariaLabel: undefined,
  variant: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: V]
  change: [value: V]
}>()

function select(opt: SegOption<V>) {
  if (opt.disabled || opt.value === props.modelValue) return
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
}
</script>

<template>
  <div
    class="aether-seg"
    :class="{ 'aether-seg--pill': variant === 'pill' }"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :aria-selected="opt.value === modelValue"
      :disabled="opt.disabled"
      :class="{ on: opt.value === modelValue }"
      @click="select(opt)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
