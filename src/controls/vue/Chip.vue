<script setup lang="ts" generic="V extends string = string">
/* Thin Vue wrapper over the framework-free Chip core. A toggle chip with an
 * optional count and color dot. Supports single-active or a Set of active
 * values (multi-select filters). Active state + emit are mechanical; the
 * caller supplies labels, counts and dot colors (domain semantics). */
import type { ChipOption } from '../core/types'
import { isChipActive } from '../core'

withDefaults(
  defineProps<{
    options: ChipOption<V>[]
    modelValue: V | Set<V>
    ariaLabel?: string
    /** 'pill' is the bordered inline chip of a filter bar; 'row' is the borderless full-width
     *  list row of a sidebar rail, with its count aligned right. Both exist in the surfaces
     *  this came from, and a rail rendered as wrapping pills reads as the wrong control. */
    variant?: 'pill' | 'row'
  }>(),
  { variant: 'pill', ariaLabel: undefined },
)

const emit = defineEmits<{
  toggle: [value: V]
}>()

function click(opt: ChipOption<V>) {
  if (opt.disabled) return
  emit('toggle', opt.value)
}
</script>

<template>
  <div :class="['aether-chips', 'aether-chips--' + variant]" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :disabled="opt.disabled"
      :class="[
        'aether-chip',
        'aether-chip--' + variant,
        { on: isChipActive(opt.value, modelValue), muted: !!opt.muted },
      ]"
      :style="opt.color ? { color: opt.color } : undefined"
      @click="click(opt)"
    >
      <span v-if="opt.swatch" class="sw" :style="opt.swatch"></span>
      <span v-else-if="opt.dotColor" class="dot" :style="{ background: opt.dotColor }"></span>
      <span>{{ opt.label }}</span>
      <span v-if="opt.count !== undefined" class="n">{{ opt.count }}</span>
    </button>
  </div>
</template>
