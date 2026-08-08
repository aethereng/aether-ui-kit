<script setup lang="ts" generic="V extends string = string">
/* Thin Vue wrapper over the framework-free Chip core. A toggle chip with an
 * optional count and color dot. Supports single-active or a Set of active
 * values (multi-select filters). Active state + emit are mechanical; the
 * caller supplies labels, counts and dot colors (domain semantics). */
import type { ChipOption } from '../core/types'
import { isChipActive } from '../core'

defineProps<{
  options: ChipOption<V>[]
  modelValue: V | Set<V>
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'toggle': [value: V]
}>()

function click(opt: ChipOption<V>) {
  if (opt.disabled) return
  emit('toggle', opt.value)
}
</script>

<template>
  <div class="aether-chips" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :disabled="opt.disabled"
      :class="{ 'aether-chip': true, on: isChipActive(opt.value, modelValue) }"
      @click="click(opt)"
    >
      <span v-if="opt.dotColor" class="dot" :style="{ background: opt.dotColor }"></span>
      <span>{{ opt.label }}</span>
      <span v-if="opt.count !== undefined" class="n">{{ opt.count }}</span>
    </button>
  </div>
</template>
