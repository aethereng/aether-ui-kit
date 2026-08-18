<script setup lang="ts" generic="V extends string = string">
/* Thin Vue wrapper over the framework-free Chip core. A toggle chip with an
 * optional count and color dot. Supports single-active or a Set of active
 * values (multi-select filters). Active state + emit are mechanical; the
 * caller supplies labels, counts and dot colors (domain semantics). */
import type { ChipOption, ChipProps } from '../core/types'
import { isChipActive } from '../core'

/* Props come from the EXPORTED ChipProps rather than an inline literal, so the public type and what
   this accepts cannot diverge. They had: `variant` was declared here and never reached ChipProps,
   which index.ts points consumers at — the same defect, on the same prop, that Seg was fixed for. */
withDefaults(defineProps<ChipProps<V>>(), { variant: 'pill', ariaLabel: undefined })

/* `aria-pressed` on each chip, and it is not decoration: the on-state was carried by `class="on"`
 * alone, so a chip group was visibly a set of toggles and audibly a row of plain buttons -- a
 * screen reader read the labels and never said which were on. The same defect RadioGroup was fixed
 * for, where the note reads "class=\"on\" is invisible to assistive tech".
 *
 * `pressed` rather than `checked` or `selected` because a chip is a TOGGLE BUTTON: several can be
 * on at once (`modelValue` is a Set), and each is independently on or off. aria-checked belongs to
 * radio/checkbox roles, and this group deliberately has neither -- it is buttons. */
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
      :title="opt.title"
      :aria-pressed="isChipActive(opt.value, modelValue)"
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
