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
 * `change` IS NOW DEPRECATED, which is the decision this comment used to defer. RadioGroup — the
 * control Seg is most confused with — ships one emit, so the two siblings otherwise disagree on
 * their event surface with nothing at the call site to say why. `update:modelValue` does
 * everything `change` does: every caller using `change` binds `:model-value` + `@change`, which is
 * `@update:model-value` spelled longer.
 *
 * NOT REMOVED, and that is not timidity. Six live call sites bind it — four in one consumer, two
 * in this gallery — and deleting an emit silently does nothing at a call site rather than failing
 * loudly, so a removal lands as a control that quietly stops responding. The gallery's two are
 * migrated here as the worked example; the consumer's four move on its own schedule, and `change`
 * goes in the release after they have.
 *
 * The FIRING ORDER stays pinned by its test either way: both events still fire, so nothing about
 * the deprecation is a behavioural change today. */
const emit = defineEmits<{
  'update:modelValue': [value: V]
  /** @deprecated Use `update:modelValue`. It carries the same value and fires first. */
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
