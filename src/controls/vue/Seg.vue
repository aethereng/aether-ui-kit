<script setup lang="ts" generic="V extends string = string">
/* Thin Vue wrapper over the framework-free Seg core. Renders a segmented
 * control (one active option). Mechanical contract here; which option is active
 * and what a selection emits is the caller's domain. */
import type { SegOption } from '../core/types'

const props = withDefaults(
  defineProps<{
    options: SegOption<V>[]
    modelValue: V
    ariaLabel?: string
    /** 'default' — square-cornered, panel-grey active segment.
     *  'pill'    — fully rounded, uppercase mono, accent-wash active segment. A second real
     *              look that already shipped in a consumer's header, not a style hook: the
     *              same precedent Chip's `variant` set. */
    variant?: 'default' | 'pill'
  }>(),
  { ariaLabel: undefined, variant: 'default' },
)

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
