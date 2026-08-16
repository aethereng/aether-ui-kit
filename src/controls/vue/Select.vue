<script setup lang="ts">
/* A single-choice dropdown over a native <select>.
 *
 * Native on purpose: it is the one control where the platform's own popup beats anything we could
 * build — it renders above everything without a portal, it works on touch, and on mobile it becomes
 * the OS picker. What it did NOT allow was theming its options, which is why `appearance:
 * base-select` matters: it opts the control into the customizable-select rendering, and the popup
 * and its rows become ordinary styleable boxes. Behind @supports, so a browser without it is left
 * with the fully native control rather than a half-built one.
 *
 * GROUPS ARE SUPPORTED, and they are not decoration. A real consumer's load-case picker lists
 * "Load cases" then "ULS combinations", each combination subtitled with its factored formula.
 * Flattened into a single list those rows are indistinguishable, which is a correctness problem in
 * a structural model rather than a cosmetic one. */

import type { SelectGroup, SelectOption } from '../core/types'

withDefaults(
  defineProps<{
    modelValue: string
    /** Flat options, or groups. Groups render as <optgroup>, which the platform labels for us. */
    options?: SelectOption[]
    groups?: SelectGroup[]
    disabled?: boolean
  }>(),
  { options: () => [], groups: () => [], disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <select
    class="aether-select"
    :value="modelValue"
    :disabled="disabled"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option
      v-for="opt in options"
      :key="opt.value"
      :value="opt.value"
      :disabled="opt.disabled"
      :label="opt.subtitle ? `${opt.label} — ${opt.subtitle}` : undefined"
    >
      {{ opt.label }}
    </option>
    <optgroup v-for="g in groups" :key="g.label" :label="g.label">
      <option
        v-for="opt in g.options"
        :key="opt.value"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        {{ opt.subtitle ? `${opt.label} — ${opt.subtitle}` : opt.label }}
      </option>
    </optgroup>
  </select>
</template>

<style scoped>
.aether-select {
  box-sizing: border-box;
  width: 100%;
  font: inherit;
  font-size: 13.5px;
  color: var(--aether-ink);
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: 7px;
  padding: 7px 9px;
  accent-color: var(--aether-cool);
}
.aether-select:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}

/* Behind @supports on purpose: where it is unsupported the native control is left completely alone,
   because base-select strips the native appearance wholesale and a browser that ignored the opt-in
   while applying the option styling below would render a half-built dropdown. */
@supports (appearance: base-select) {
  .aether-select {
    appearance: base-select;
  }
  /* The disclosure arrow the base appearance draws for us. */
  .aether-select::picker-icon {
    color: var(--aether-ink-soft);
    transition: rotate 0.15s ease;
  }
  .aether-select:open::picker-icon {
    rotate: 180deg;
  }
  .aether-select::picker(select) {
    appearance: base-select;
    margin-top: 4px;
    padding: 4px;
    border: 1px solid var(--aether-line-strong);
    border-radius: 9px;
    background: var(--aether-surface);
    box-shadow: var(--aether-shadow);
  }
  .aether-select option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    border-radius: 5px;
    background: transparent;
    color: var(--aether-ink);
    font-size: 13.5px;
  }
  /* The blue, replaced. `:hover` is the pointer highlight and `:focus` the keyboard one — both are
     needed, or arrowing through the list leaves the system colour in place for keyboard users. */
  .aether-select option:hover,
  .aether-select option:focus {
    background: var(--aether-cool-wash);
    color: var(--aether-cool);
  }
  .aether-select option:checked {
    font-weight: 650;
  }
  /* The tick beside the selected row, which base-select adds and the native control never had. */
  .aether-select option::checkmark {
    color: var(--aether-cool);
  }
  .aether-select optgroup {
    padding: 4px 0;
    color: var(--aether-ink-soft);
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
}
</style>
