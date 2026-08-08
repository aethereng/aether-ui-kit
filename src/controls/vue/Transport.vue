<script setup lang="ts">
/* Thin, neutral transport control. Controlled (like Graph2D/Gantt): the caller owns
 * current/duration/playing/speed; Transport renders + emits deltas. Replaces the two
 * duplicated Vuetify transports (DiagnosticTransport.vue, DynamicsPlayer.vue) with one
 * shared, framework-free component. Uses a native range input — no Vuetify dependency.
 *
 * Emits:
 *   toggle   — play/pause (or replay when at end)
 *   seek     — (t:number) scrub to time t
 *   set-speed— (s:number) cycle/choose speed
 *   stop     — dismiss the player
 *   scrub-start / scrub-end — caller pauses on start, resumes on end (one playhead rule)
 */
import { computed } from 'vue'
import { DEFAULT_SPEEDS, cycleSpeed, isAtEnd } from '../core/transport'

const props = withDefaults(
  defineProps<{
    current: number
    duration: number
    playing: boolean
    speed?: number
    speeds?: number[]
    phase?: 'play' | 'precompute'
    precomputePct?: number
    format?: (t: number) => string
  }>(),
  {
    speed: 1,
    speeds: () => DEFAULT_SPEEDS,
    phase: 'play',
    precomputePct: 0,
    format: (t: number) => `${t.toFixed(2)} s`,
  },
)

const emit = defineEmits<{
  toggle: []
  seek: [t: number]
  'set-speed': [s: number]
  stop: []
  'scrub-start': []
  'scrub-end': []
}>()

const atEnd = computed(() => isAtEnd(props.current, props.duration))
const speedLabel = computed(() => `${props.speed}×`)
const pct = computed(() => Math.round(props.precomputePct))

function onToggle() {
  // replay from 0 when parked at the end, else play/pause
  if (atEnd.value) emit('seek', 0)
  emit('toggle')
}
function onSpeed() {
  emit('set-speed', cycleSpeed(props.speeds, props.speed))
}
function onScrubStart() {
  emit('scrub-start')
}
function onScrubEnd() {
  emit('scrub-end')
}
</script>

<template>
  <div class="aether-transport" :class="{ compute: phase === 'precompute' }">
    <template v-if="phase === 'precompute'">
      <span class="at-label">Computing…</span>
      <div class="at-scrub">
        <div class="at-scrub-fill" :style="{ width: pct + '%' }" />
      </div>
      <span class="at-time">{{ pct }}%</span>
      <button class="at-btn at-stop" title="Stop" aria-label="Stop" @click="emit('stop')">✕</button>
    </template>

    <template v-else>
      <button
        class="at-btn at-play"
        :aria-label="atEnd ? 'Replay' : playing ? 'Pause' : 'Play'"
        @click="onToggle"
      >
        {{ atEnd ? '⟲' : playing ? '❚❚' : '▶' }}
      </button>

      <input
        class="at-scrub"
        type="range"
        :min="0"
        :max="Math.max(duration, 1e-6)"
        :step="duration / 600"
        :value="current"
        aria-label="Scrub"
        @pointerdown="onScrubStart"
        @pointerup="onScrubEnd"
        @input="emit('seek', +($event.target as HTMLInputElement).value)"
      />

      <span class="at-time">{{ format(current) }} / {{ format(duration) }}</span>

      <button class="at-btn at-speed" :aria-label="'Playback speed'" @click="onSpeed">
        {{ speedLabel }}
      </button>

      <button class="at-btn at-stop" title="Stop" aria-label="Stop" @click="emit('stop')">✕</button>
    </template>
  </div>
</template>

<style scoped>
.aether-transport {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(560px, calc(100% - 32px));
  padding: 6px 12px 6px 8px;
  border-radius: 999px;
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  color: var(--aether-ink);
  font:
    13px/1.4 ui-monospace,
    monospace;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
}
.aether-transport.compute {
  width: min(420px, calc(100% - 32px));
  padding-left: 16px;
}
.at-btn {
  flex: none;
  min-width: 34px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--aether-line-strong);
  border-radius: 8px;
  background: var(--aether-surface);
  color: var(--aether-ink);
  cursor: pointer;
  font:
    13px/1 ui-monospace,
    monospace;
}
.at-btn:hover {
  border-color: var(--aether-cool);
}
.at-play {
  font-size: 12px;
}
.at-speed {
  min-width: 40px;
}
.at-stop {
  min-width: 28px;
}
.at-scrub {
  flex: 1 1 auto;
  min-width: 120px;
  accent-color: var(--aether-cool);
}
/* progress variant uses a div bar (no native range) */
.aether-transport.compute .at-scrub {
  position: relative;
  height: 4px;
  background: var(--aether-line-strong);
  border-radius: 999px;
  overflow: hidden;
}
.at-scrub-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--aether-cool);
  border-radius: 999px;
}
.at-label,
.at-time {
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
</style>
