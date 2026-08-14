<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref, onBeforeUnmount } from 'vue'
import Transport from '@aether/ui-kit/controls/transport'

/* The CALLER owns the clock. Transport renders a position and emits intent; it never advances
   time itself, which is what lets the same bar drive a 3-D playback, a solver progress bar, or
   a scrubbable diff. */
const current = ref(0)
const duration = ref(6)
const playing = ref(false)
const speed = ref(1)

let raf = 0
let last = 0
function step(ts: number) {
  if (!playing.value) return
  const dt = (ts - last) / 1000
  last = ts
  current.value += dt * speed.value
  if (current.value >= duration.value) {
    current.value = duration.value
    playing.value = false
    return
  }
  raf = requestAnimationFrame(step)
}

function onToggle() {
  if (playing.value) {
    playing.value = false
    return
  }
  if (current.value >= duration.value) current.value = 0 // replay from the top
  playing.value = true
  last = performance.now()
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(step)
}

function onSeek(t: number) {
  current.value = Math.max(0, Math.min(t, duration.value))
}

/* Scrubbing pauses and then restores — the bar reports the gesture boundaries so the caller can
   decide that, rather than the component guessing. */
let wasPlaying = false
function onScrubStart() {
  wasPlaying = playing.value
  playing.value = false
}
function onScrubEnd() {
  if (wasPlaying) onToggle()
}

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="g-ex" style="flex-basis: 100%">
    <span class="g-variant">speed-mode="cycle" (default) — one button steps through the speeds</span>
    <Transport
      :current="current"
      :duration="duration"
      :playing="playing"
      :speed="speed"
      @toggle="onToggle"
      @seek="onSeek"
      @set-speed="speed = $event"
      @scrub-start="onScrubStart"
      @scrub-end="onScrubEnd"
      @stop="current = 0"
    />
  </div>

  <div class="g-ex" style="flex-basis: 100%">
    <!-- Same state as the bar above, so they read as two views of one transport and the ladder
         tracks the cycling button.
         No `:speeds` override, deliberately. It used to pass [0.2, 0.5, 1, 2, 5] while the cycling
         button beside it stepped through DEFAULT_SPEEDS [0.25, 0.5, 1, 2, 4], which made the
         sentence above false: cycling to 0.25 or 4 highlighted nothing in this row, and clicking 0.2
         or 5 set a speed the button could not reach. Both now read the one ladder. -->
    <span class="g-variant">speed-mode="presets" — the whole ladder, laid out</span>
    <Transport
      :current="current"
      :duration="duration"
      :playing="playing"
      :speed="speed"
      speed-mode="presets"
      @toggle="onToggle"
      @seek="onSeek"
      @set-speed="speed = $event"
      @scrub-start="onScrubStart"
      @scrub-end="onScrubEnd"
    />
  </div>

  <div class="g-ex" style="flex-basis: 100%">
    <!-- phase="precompute" swaps the scrub for a progress bar: there is nothing to scrub yet. -->
    <span class="g-variant">phase="precompute" — building, not playing</span>
    <Transport
      :current="0"
      :duration="duration"
      :playing="false"
      phase="precompute"
      :precompute-pct="40"
      compute-label="Precomputing"
      stoppable
      @stop="() => {}"
    />
  </div>

  <code class="g-ex-state">
    current = {{ current.toFixed(2) }}s · playing = {{ playing }} · speed = {{ speed }}×
  </code>
</template>
