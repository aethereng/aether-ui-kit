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

/* BOTH events fire on every selection, `update:modelValue` FIRST, from one call. `change` carries
 * the same value and exists for callers who are NOT using v-model -- so binding v-model AND
 * @change together is redundant by design, and a @change handler that also writes the model will
 * run after v-model has already written it.
 *
 * The order is pinned by a test. It is deliberately NOT being changed: both events fire either
 * way, so reordering fixes nothing and is a silent behavioural change for every existing consumer
 * -- including any guard that currently works because of this order. If the redundancy proves to
 * be a real source of bugs, the honest fix is deprecating `change`, which is a breaking change
 * that deserves its own decision rather than being smuggled in as a reorder. */
const emit = defineEmits<{
  'update:modelValue': [value: V]
  change: [value: V]
}>()

/* Selecting always yields a real V -- `null` is an INPUT state (nothing matches), never something
 * this control emits. There is no way to click your way back to no-selection. */
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
