<script setup lang="ts">
/* A boolean toggle, rendered as a pill switch rather than a native checkbox.
 *
 * WHY THIS EXISTS AS A COMPONENT. The kit already drew this switch — but only under
 * `.aether-property-editor__field input[type='checkbox']`, so the appearance existed solely inside
 * a form. A consumer with one standalone toggle had no way to reach it and kept a framework
 * dependency for the shape. That is a packaging failure, not a missing feature: the styling moved
 * here, and PropertyEditor now renders this instead of a raw input.
 *
 * DELIBERATELY BARE: one <input>, no wrapper, no label. Label association is the caller's, exactly
 * as it already is inside PropertyEditor (`<label for>` + id). A self-labelling wrapper would nest
 * a <label> inside the form's own <label>, which is invalid, and would change the DOM that a
 * consumer's overrides are written against. `id`, `aria-label` and friends fall through. */

defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <input
    type="checkbox"
    class="aether-switch"
    :checked="modelValue"
    :disabled="disabled"
    @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
  />
</template>

<style scoped>
.aether-switch {
  /* The kit ships no global reset -- it must not impose one on a host -- so every component that
     sets an explicit width states its own box model. */
  box-sizing: border-box;
  padding: 0;
  border: 0;
  appearance: none;
  -webkit-appearance: none;
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background: var(--aether-line-strong);
  position: relative;
  cursor: pointer;
  flex: none;
  transition: background 0.15s;
  margin: 0;
}
.aether-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--aether-surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}
.aether-switch:checked {
  background: var(--aether-cool);
}
.aether-switch:checked::after {
  transform: translateX(16px);
}
.aether-switch:disabled {
  cursor: default;
  opacity: 0.55;
}

/* The kit's focus ring, which this control never had. ui-kit.css declares one ring "for every
   control the kit ships" and lists Tool, Chip, Seg, the enum buttons and SearchField's clear —
   the switch was missed, so keyboard focus fell through to the user agent's own ring. That is the
   off-palette blue leak the whole block exists to stop. Same 2px cool ring, offset outward: this
   is a standalone control with nothing clipping it. */
.aether-switch:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}

/* NO coarse-pointer floor here, and that is carried over rather than overlooked. ui-kit.css's touch
   block names this control in its "not fixed here, deliberately" list: the track is 22px and the
   knob is 18px at top/left 2px with translateX(16px) when checked — every number tuned to that
   track, so a min-height floor rewrites the track and leaves the knob behind. It has been broken
   that way once already. Reaching 44px needs a padded wrapper around the switch, not a rule on it. */
</style>
