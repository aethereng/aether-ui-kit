<script setup lang="ts">
/* Thin, neutral transport control. Controlled (like Graph2D/Gantt): the caller owns
 * current/duration/playing/speed; Transport renders + emits deltas. Replaces the two
 * duplicated Vuetify transports (DiagnosticTransport.vue, DynamicsPlayer.vue) with one
 * shared, framework-free component. Uses a native range input — no Vuetify dependency.
 *
 * It does NOT position or size itself. Both real consumers float it over a 3-D canvas at
 * their own width and offset, so the host owns the wrapper; the transport fills it.
 *
 * Emits:
 *   toggle   — play/pause (or replay when at end)
 *   seek     — (t:number) scrub to time t
 *   set-speed— (s:number) cycle/choose speed
 *   stop     — dismiss the player
 *   scrub-start / scrub-end — caller pauses on start, resumes on end (one playhead rule)
 */
import { computed, onBeforeUnmount } from 'vue'
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
    /** 'cycle' is one button that steps through `speeds`; 'presets' lays them all out as a
     *  row of toggles. Both real consumers exist — the editor diagnostic cycles, the viewer
     *  shows the ladder — so this is the interaction axis they differ on, not two components. */
    speedMode?: 'cycle' | 'presets'
    /** Label a speed. Defaults to `1×`; a host wanting `½×` supplies its own. */
    speedLabel?: (s: number) => string
    /** Render the dismiss button. The editor diagnostic has no stop affordance of its own —
     *  it is left via the surrounding UI — so the button has to be omittable. */
    stoppable?: boolean
    /** Text shown beside the progress bar during `phase: 'precompute'`. */
    computeLabel?: string
  }>(),
  {
    speed: 1,
    speeds: () => DEFAULT_SPEEDS,
    phase: 'play',
    precomputePct: 0,
    format: (t: number) => `${t.toFixed(2)} s`,
    speedMode: 'cycle',
    speedLabel: (s: number) => `${s}×`,
    stoppable: true,
    computeLabel: 'Computing…',
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
const pct = computed(() => Math.round(props.precomputePct))
// A zero-length timeline would make step 0, which browsers reject — fall back to a
// continuous range until a real duration arrives.
const step = computed(() => (props.duration > 0 ? props.duration / 600 : 'any'))

function onToggle() {
  // replay from 0 when parked at the end, else play/pause
  if (atEnd.value) emit('seek', 0)
  emit('toggle')
}
function onSpeed() {
  emit('set-speed', cycleSpeed(props.speeds, props.speed))
}

/* The scrub handshake has to survive the pointer leaving the slider. A release outside the
 * input never fires pointerup on it, so binding scrub-end to the element alone strands the
 * caller in the paused state it entered on scrub-start — the transport looks alive but the
 * clock never restarts. Listen on the window for the release instead. */
let scrubbing = false
function endScrub() {
  if (!scrubbing) return
  scrubbing = false
  window.removeEventListener('pointerup', endScrub)
  window.removeEventListener('pointercancel', endScrub)
  emit('scrub-end')
}
function onScrubStart() {
  if (scrubbing) return
  scrubbing = true
  window.addEventListener('pointerup', endScrub)
  window.addEventListener('pointercancel', endScrub)
  emit('scrub-start')
}
onBeforeUnmount(() => {
  // unmounting mid-drag (the host hides the player) must not leak the listeners
  window.removeEventListener('pointerup', endScrub)
  window.removeEventListener('pointercancel', endScrub)
})
</script>

<template>
  <div class="aether-transport" :class="{ compute: phase === 'precompute' }">
    <template v-if="phase === 'precompute'">
      <span class="at-label">{{ computeLabel }}</span>
      <div class="at-progress">
        <div class="at-progress-fill" :style="{ width: pct + '%' }" />
      </div>
      <span class="at-time">{{ pct }}%</span>
      <button
        v-if="stoppable"
        class="at-btn at-stop"
        title="Stop"
        aria-label="Stop"
        @click="emit('stop')"
      >
        ✕
      </button>
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
        :step="step"
        :value="current"
        aria-label="Scrub"
        @pointerdown="onScrubStart"
        @input="emit('seek', +($event.target as HTMLInputElement).value)"
      />

      <span class="at-time">{{ format(current) }} / {{ format(duration) }}</span>

      <template v-if="speedMode === 'presets'">
        <div class="at-speeds" role="group" aria-label="Playback speed">
          <button
            v-for="s in speeds"
            :key="s"
            class="at-btn at-speed-opt"
            :class="{ on: s === speed }"
            :aria-pressed="s === speed"
            @click="emit('set-speed', s)"
          >
            {{ speedLabel(s) }}
          </button>
        </div>
      </template>
      <button v-else class="at-btn at-speed" aria-label="Playback speed" @click="onSpeed">
        {{ speedLabel(speed) }}
      </button>

      <button
        v-if="stoppable"
        class="at-btn at-stop"
        title="Stop"
        aria-label="Stop"
        @click="emit('stop')"
      >
        ✕
      </button>
    </template>
  </div>
</template>

<style scoped>
/* Every surface value here is a token, because both real consumers float this over a 3-D
 * canvas: they need a transparent, blurred bar, which an opaque hardcoded background makes
 * impossible. The kit's own palette supplies the defaults. */
.aether-transport {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px 6px 8px;
  border-radius: var(--aether-transport-radius);
  background: var(--aether-transport-bg);
  backdrop-filter: var(--aether-transport-backdrop);
  -webkit-backdrop-filter: var(--aether-transport-backdrop);
  border: 1px solid var(--aether-line-strong);
  color: var(--aether-ink);
  font: 13px/1.4 var(--aether-font-mono);
  box-shadow: var(--aether-transport-shadow);
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
  font: 13px/1 var(--aether-font-mono);
}
.at-btn:hover {
  border-color: var(--aether-cool);
}
/* Focus ring, here rather than in ui-kit.css for the same reason the touch targets are: these
   elements are only reachable from this component's own scoped CSS at a specificity a global rule
   cannot beat. Without it, the shared stylesheet's ring covered every control EXCEPT the one a
   Transport-only consumer actually tabs through, and keyboard focus fell back to the browser's
   blue -- the exact leak the ring exists to stop. */
.at-btn:focus-visible,
.at-scrub:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
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
.at-speeds {
  flex: none;
  display: flex;
  gap: 2px;
}
.at-speed-opt {
  min-width: 30px;
  padding: 0 5px;
  font-size: 11px;
}
.at-speed-opt.on {
  background: var(--aether-cool-wash);
  color: var(--aether-cool);
  border-color: currentColor;
  font-weight: 600;
}
.at-scrub {
  flex: 1 1 auto;
  min-width: 120px;
  accent-color: var(--aether-cool);
}
/* the precompute bar is a plain div — there is nothing to scrub yet */
.at-progress {
  flex: 1 1 auto;
  min-width: 120px;
  position: relative;
  height: 4px;
  background: var(--aether-line-strong);
  border-radius: 999px;
  overflow: hidden;
}
.at-progress-fill {
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
/* ---- touch targets ---- */
/* Every control in this bar is ~30px, under the 44px touch minimum, and this is the kit
   component most likely to be used on a tablet: a transport bar floating over a live canvas.
   It could not be fixed from ui-kit.css -- not because a global sheet cannot reach a scoped
   component (it can, by class), but because it would lose to these rules on specificity, since
   scoping adds an attribute selector to them. So the fix belongs here.

   Last block in the file on purpose: `height: 28px` above is overridden by `min-height` here
   (min-height clamps the used height, so it wins regardless of order), but `min-width` is a
   straight same-specificity contest against .at-speed's 40px and .at-stop's 28px, and only
   source order decides it. */
@media (pointer: coarse) {
  /* Load-bearing, not cosmetic. The bar's declared minimums already exceed a 390px viewport
     before any of this, so growing every child without letting the row wrap would make the
     overflow worse rather than better. Wrapping is what makes the rest of this safe. */
  .aether-transport {
    flex-wrap: wrap;
    row-gap: 8px;
  }

  .at-btn {
    min-height: 44px;
    min-width: 44px;
  }

  /* 2px was the tightest spacing between two adjacent targets anywhere in the kit -- adjacent
     44px buttons 2px apart still mis-tap. */
  .at-speeds {
    gap: 6px;
  }
  .at-speed-opt {
    min-width: 44px;
    padding: 0 8px;
    font-size: 12px;
  }

  /* A native range input. Its thumb is UA-sized and small, but the whole track responds to a
     pointer, so a taller box is a genuinely bigger target. Deliberately NOT restyled with
     appearance:none -- that discards the platform track AND thumb and would mean rebuilding
     both, which is a visual redesign rather than a touch fix. Left to wrap onto its own row
     naturally rather than being forced there with flex-basis:100%, so a tablet in landscape
     keeps a single-row bar. */
  .at-scrub {
    min-height: 44px;
  }
}
</style>
