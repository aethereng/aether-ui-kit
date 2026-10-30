<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import Legend from '@aether/ui-kit/viz/legend'

/* The colour list the drawing itself colours from, so the bar and the drawing cannot disagree. */
const TERRAIN = '#2f6f6b 0%, #e5dfd2 50%, #a9591b 100%'
const NO_VALUE = '#a33b52'
</script>

<template>
  <div class="g-lg">
    <div>
      <span class="g-variant">a ramp, with the numbers the app has formatted</span>
      <Legend label="Elevation" unit="m" :stops="TERRAIN" :ticks="['0', '450', '900']" />
    </div>

    <div>
      <span class="g-variant">a ramp over a field with a few values it cannot place</span>
      <Legend
        label="Rainfall"
        unit="mm"
        :stops="TERRAIN"
        :ticks="['0', '120']"
        :no-value-color="NO_VALUE"
        no-value-key="No reading at 3 stations"
      />
    </div>

    <!-- No ramp from 0 to 0. The sentence is the app's, in its own words and its own language. -->
    <div>
      <span class="g-variant">state="zero", with the app's note</span>
      <Legend label="Snowfall" unit="mm" state="zero" :stops="TERRAIN" note="No snow fell on this map." />
    </div>

    <div>
      <span class="g-variant">state="nonfinite", with the app's note</span>
      <Legend
        label="Humidity"
        unit="%"
        state="nonfinite"
        :stops="TERRAIN"
        :no-value-color="NO_VALUE"
        note="No humidity reading on this map is a number, so it has no range."
      />
    </div>
  </div>
</template>

<style scoped>
.g-lg {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 22px;
  width: 100%;
}
</style>
