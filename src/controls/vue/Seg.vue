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

/* ONE EMIT. `change` is gone: it carried the same value as `update:modelValue` and fired straight
 * after it, so a caller binding both got the same thing twice and a caller binding only `change`
 * was writing `@update:model-value` the long way. RadioGroup — the control Seg is most confused
 * with — always shipped one, and two sibling selectors disagreeing on their event surface is a
 * difference with nothing at the call site to explain it.
 *
 * It was deprecated first rather than deleted outright, because removing an emit does NOT fail at
 * a call site, it silently stops responding. The six live bindings were migrated to
 * `@update:model-value` and verified in their running apps before this line changed. */
const emit = defineEmits<{ 'update:modelValue': [value: V] }>()

/* Selecting always yields a real V -- `null` is an INPUT state (nothing matches), never something
 * this control emits. There is no way to click your way back to no-selection. */
function select(opt: SegOption<V>) {
  if (opt.disabled || opt.value === props.modelValue) return
  emit('update:modelValue', opt.value)
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
