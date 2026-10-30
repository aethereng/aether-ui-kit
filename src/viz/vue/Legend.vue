<script setup lang="ts">
/* What the colour on a drawing means, for one field: a ramp with its numbers under it, or the
 * sentence saying why there is no ramp.
 *
 * PLAIN DATA. `stops` is the colour list the drawing itself colours from, as `linear-gradient` takes
 * it, and `ticks` are text the caller has already formatted, so a value on the bar reads as it reads
 * everywhere else in the app. The field itself and the working out of its numbers stay with the caller.
 *
 * TWO STATES WITH NO RAMP, where a ramp from 0 to 0 would show a range the field does not have. `zero`:
 * every sample is exactly 0, which is a finding to state. `nonfinite`: the samples are NaN or infinite
 * wherever they are not 0, so no range can be stated. `note` is the sentence for either, because what
 * was sampled and the language it is told in are the caller's. A ramp whose field holds a few such
 * samples beside finite ones stays a ramp, and `noValueKey` explains the colour they are drawn in.
 *
 * A panel around it, its place on the screen and the words for a field still on its way stay the
 * app's. The inner parts carry `aether-legend__*` classes for an app that sets the ramp larger. */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** The field's name. */
    label: string
    /** Its unit, drawn apart from the name. */
    unit?: string
    /** The ramp's colour stops, as CSS: `#00f 0%, #fff 50%, #f00 100%`. */
    stops: string
    /** The numbers under the ramp, spread from its left end to its right end. */
    ticks?: readonly string[]
    /** `ramp`, or why there is none. */
    state?: 'ramp' | 'zero' | 'nonfinite'
    /** The sentence for `zero` and `nonfinite`. Without one the legend names the field and stops. */
    note?: string
    /** The colour the drawing gives a value the ramp cannot place, shown as a swatch. */
    noValueColor?: string
    /** The words beside that swatch under a ramp. */
    noValueKey?: string
  }>(),
  { unit: undefined, ticks: () => [], state: 'ramp', note: undefined, noValueColor: undefined, noValueKey: undefined },
)

const named = computed(() => (props.unit ? `${props.label} ${props.unit}` : props.label))
</script>

<template>
  <p v-if="state === 'zero'" class="aether-legend__note" data-legend="zero">{{ note ?? named }}</p>
  <p v-else-if="state === 'nonfinite'" class="aether-legend__note aether-legend__note--warn" data-legend="nonfinite">
    <span v-if="noValueColor" class="aether-legend__swatch" :style="{ background: noValueColor }" aria-hidden="true" />
    <span>{{ note ?? named }}</span>
  </p>
  <div v-else class="aether-legend" data-legend="ramp">
    <div class="aether-legend__label">
      {{ label }} <span v-if="unit" class="aether-legend__unit">{{ unit }}</span>
    </div>
    <!-- backgroundImage rather than the `background` shorthand, which would put back the
         background-clip an app sets for a translucent border. -->
    <div class="aether-legend__bar" :style="{ backgroundImage: `linear-gradient(to right, ${stops})` }" />
    <div class="aether-legend__ticks">
      <span v-for="(tick, i) in ticks" :key="i">{{ tick }}</span>
    </div>
    <p v-if="noValueKey" class="aether-legend__note aether-legend__key" data-legend="nonfinite-key">
      <span v-if="noValueColor" class="aether-legend__swatch" :style="{ background: noValueColor }" aria-hidden="true" />
      <span>{{ noValueKey }}</span>
    </p>
  </div>
</template>

<style scoped>
.aether-legend__label {
  font-size: var(--aether-text-sm);
  color: var(--aether-faint);
}
.aether-legend__unit {
  opacity: 0.7;
}
/* box-sizing is stated because this sets its own height, and the kit ships no global reset. */
.aether-legend__bar {
  box-sizing: border-box;
  height: 10px;
  margin: var(--aether-space-1) 0;
  border-radius: 3px;
  border: 1px solid var(--aether-panel);
}
.aether-legend__ticks {
  display: flex;
  justify-content: space-between;
  font-size: var(--aether-text-sm);
  font-variant-numeric: tabular-nums;
}
.aether-legend__note {
  display: flex;
  align-items: center;
  gap: var(--aether-space-1);
  margin: 0;
  font-size: var(--aether-text-sm);
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.aether-legend__note--warn {
  color: var(--aether-warm-soft);
}
.aether-legend__key {
  margin-top: var(--aether-space-1);
}
/* the no-value colour may be as light as the panel, so it carries an edge of its own */
.aether-legend__swatch {
  box-sizing: border-box;
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid color-mix(in srgb, var(--aether-ink) 35%, transparent);
}
</style>
