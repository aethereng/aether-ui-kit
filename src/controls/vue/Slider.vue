<script setup lang="ts">
/* A number the user drags rather than types, with a read-out beside it.
 *
 * NOT a variant of NumberField, and that distinction is the kit's own: a slider is a different
 * INTERACTION for a value whose scale matters more than its digits — an opacity, a cutting plane.
 * Same data, different control.
 *
 * IT NEVER WRITES A CORRECTED VALUE BACK. A native range snaps its THUMB to the nearest step, so a
 * component that read `.value` back on render would silently rewrite a stored 0.37 to 0.35 for a
 * field nobody touched. Controlled binding plus emit-on-input only means the stored value survives
 * until the user actually drags, and the read-out shows the STORED number rather than the thumb
 * position, so the two never disagree silently.
 *
 * `format` exists because a stored value and a displayed one are not always the same thing. A real
 * consumer drives a deform scale from a 0-100 slider position through a non-linear map and shows
 * "×2.4" — three precision tiers, none of them the slider's own number. Without this the read-out
 * can only print what is stored, which is the wrong quantity for that whole class of control. */

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    /** Rendered after the read-out. The kit renders a unit; it never knows one. */
    suffix?: string
    /** Turns the stored value into what the read-out shows. Defaults to the value itself. */
    format?: (value: number) => string
    disabled?: boolean
  }>(),
  { min: 0, max: 100, step: undefined, suffix: undefined, format: undefined, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="aether-slider">
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      @input="onInput"
    />
    <output class="aether-slider__readout">
      {{ props.format ? props.format(modelValue) : modelValue
      }}<span v-if="suffix"> {{ suffix }}</span>
    </output>
  </div>
</template>

<style scoped>
/* The track takes the room and the read-out is a fixed, tabular column, so the track does not
   resize as digits change under it.
   NO border and no padding, which IS a change: the old shared rule was
   `.aether-property-editor__field input:not([type='checkbox'])`, and it caught `type="range"` by
   accident — a slider carried a 1px border and 6px/10px of padding, making the row 13.7px taller
   than the control needs. That was never a decision about sliders, it was a selector that only
   excluded the switch. A track does not want a box, so it does not get one. */
.aether-slider {
  display: flex;
  align-items: center;
  gap: 10px;
}
.aether-slider input[type='range'] {
  flex: 1 1 auto;
  min-width: 0;
  /* The one declaration that tints what the UA draws inside the control from the kit's palette
     instead of its own blue. */
  accent-color: var(--aether-selected);
}
.aether-slider__readout {
  flex: none;
  min-width: 4.5ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--aether-ink-soft);
}
.aether-slider input[type='range']:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}
</style>
