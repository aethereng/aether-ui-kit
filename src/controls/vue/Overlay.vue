<script setup lang="ts">
/* A full-page card for work the app must wait on: a title with moving dots, what is being worked on,
 * a bar, a line of detail, and a way to stop.
 *
 * `open` is the raw flag, and it goes through useDeferredFlag: quick work never shows the card, and
 * once shown it stays long enough to read. `aside` takes the card away at once, whatever that minimum
 * says, for the moment what it covers becomes the thing to watch.
 *
 * THE BAR IS A MEASURE ONLY WHERE THERE IS ONE. `progress` is a fraction from 0 to 1, for work that can
 * report one. Without it the bar sweeps and claims nothing: a bar held at 0% and then racing says less
 * than a sweep does.
 *
 * ALWAYS MOUNTED, shown by a class. The card's looping animations bubble animation events that confuse
 * <Transition>'s end detection and leave it stuck, and an opacity transition from `visibility: hidden`
 * is dropped by browsers, so this fades opacity alone and is inert while hidden, which keeps the stop
 * button out of the tab order.
 *
 * The `mark` slot takes a picture, as Tool's `icon` does. The tints of the scrim and the shadows are
 * tokens, so a theme sets them where it sets its palette. */
import { computed } from 'vue'
import Tool from './Tool.vue'
import { useDeferredFlag } from './composables'

const props = withDefaults(
  defineProps<{
    /** The work is running. Shown through the deferred flag. */
    open: boolean
    /** Takes the card away at once while true, without waiting out its minimum time. */
    aside?: boolean
    /** The title, and the bar's accessible name. */
    label: string
    /** What is being worked on, under the title. */
    subject?: string
    /** A line of detail under the bar. */
    detail?: string
    /** How far along, from 0 to 1. Without it the bar sweeps. */
    progress?: number | null
    /** Shows the stop button. */
    stoppable?: boolean
    stopLabel?: string
    /** Draws the stop button in the danger tone. */
    stopDanger?: boolean
  }>(),
  { aside: false, subject: undefined, detail: undefined, progress: null, stoppable: false, stopLabel: 'Stop', stopDanger: false },
)

defineEmits<{ stop: [] }>()

const flag = useDeferredFlag(() => props.open)
const visible = computed(() => flag.value && !props.aside)
const fraction = computed(() => (props.progress === null ? null : Math.min(1, Math.max(0, props.progress))))
</script>

<template>
  <div class="aether-overlay" :class="{ 'is-visible': visible }" :inert="!visible || undefined">
    <div class="aether-overlay__scrim" />
    <div class="aether-overlay__card" role="status" aria-live="polite">
      <div v-if="$slots.mark" class="aether-overlay__mark" aria-hidden="true"><slot name="mark" /></div>
      <h2 class="aether-overlay__title">{{ label }}<span class="aether-overlay__dots" aria-hidden="true" /></h2>
      <p v-if="subject !== undefined" class="aether-overlay__subject">{{ subject }}</p>
      <div
        class="aether-overlay__bar"
        role="progressbar"
        :aria-label="label"
        :aria-busy="fraction === null"
        :aria-valuenow="fraction === null ? undefined : Math.round(fraction * 100)"
        :aria-valuemin="fraction === null ? undefined : 0"
        :aria-valuemax="fraction === null ? undefined : 100"
      >
        <span v-if="fraction !== null" class="aether-overlay__fill" :style="{ transform: `scaleX(${fraction})` }" />
        <span v-else class="aether-overlay__comet" />
      </div>
      <p v-if="detail !== undefined" class="aether-overlay__detail">{{ detail }}</p>
      <div v-if="stoppable" class="aether-overlay__stop">
        <Tool :label="stopLabel" :danger="stopDanger" @click="$emit('stop')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Above whatever the app has floated over its own content, and faded rather than unmounted (see
   above); opacity alone still captures clicks, hence pointer-events. */
.aether-overlay {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-out;
}
.aether-overlay.is-visible {
  opacity: 1;
  pointer-events: auto;
}
.aether-overlay__scrim {
  position: absolute;
  inset: 0;
  background: var(--aether-overlay-scrim);
  backdrop-filter: var(--aether-overlay-scrim-filter);
  -webkit-backdrop-filter: var(--aether-overlay-scrim-filter);
}
/* idle: pause the loops, so a hidden, always-mounted overlay costs nothing */
.aether-overlay:not(.is-visible) .aether-overlay__mark,
.aether-overlay:not(.is-visible) .aether-overlay__comet,
.aether-overlay:not(.is-visible) .aether-overlay__dots::after {
  animation-play-state: paused;
}
.aether-overlay__card {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: calc(100vw - 32px);
  max-width: 360px;
  padding: 30px 28px var(--aether-overlay-card-end);
  text-align: center;
  border-radius: 16px;
  background: var(--aether-surface);
  border: 1px solid color-mix(in srgb, var(--aether-panel) 70%, transparent);
  box-shadow: var(--aether-overlay-shadow);
  transform: scale(0.96);
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.aether-overlay.is-visible .aether-overlay__card {
  transform: scale(1);
}
.aether-overlay__mark {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  animation: aether-overlay-breathe 3.2s ease-in-out infinite;
}
.aether-overlay__title {
  margin: 0;
  font-family: var(--aether-font-display);
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.1;
  color: var(--aether-ink);
}
/* the moving dots: their width is reserved, so they never shift the title */
.aether-overlay__dots {
  display: inline-block;
  width: 1.1em;
  text-align: left;
}
.aether-overlay__dots::after {
  content: '···';
  animation: aether-overlay-ellipsis 1.6s steps(1, end) infinite;
}
.aether-overlay__subject {
  margin: 6px 0 0;
  font-family: var(--aether-font-mono);
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: linear-gradient(90deg, var(--aether-warm), var(--aether-cool-soft));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.aether-overlay__bar {
  position: relative;
  height: 4px;
  margin: 22px auto 0;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--aether-panel) 55%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aether-panel) 35%, transparent);
}
.aether-overlay__comet {
  position: absolute;
  inset: 0 auto 0 0;
  width: 40%;
  border-radius: 999px;
  /* in srgb, stated: a color-mix stop would otherwise move the whole sweep to the browser's default of
     Oklab for a gradient with a colour of that kind, and its middle would read differently */
  background: linear-gradient(
    90deg in srgb,
    color-mix(in srgb, var(--aether-warm) 0%, transparent) 0%,
    var(--aether-warm) 25%,
    var(--aether-cool-soft) 85%,
    color-mix(in srgb, var(--aether-cool-soft) 0%, transparent) 100%
  );
  box-shadow: var(--aether-overlay-comet-glow);
  animation: aether-overlay-sweep 1.5s cubic-bezier(0.45, 0, 0.25, 1) infinite;
}
/* a transform rather than a width, so the growth never lays the card out again on a busy thread */
.aether-overlay__fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--aether-warm), var(--aether-cool-soft));
  box-shadow: 0 0 8px color-mix(in srgb, var(--aether-cool-soft) 45%, transparent);
  transition: transform 220ms linear;
}
.aether-overlay__detail {
  margin: 12px 0 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--aether-faint);
}
.aether-overlay__stop {
  display: flex;
  justify-content: center;
  margin-top: var(--aether-overlay-stop-gap);
}
@keyframes aether-overlay-sweep {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(360%);
  }
}
@keyframes aether-overlay-breathe {
  0%,
  100% {
    filter: var(--aether-overlay-mark-glow-low);
  }
  50% {
    filter: var(--aether-overlay-mark-glow-high);
  }
}
@keyframes aether-overlay-ellipsis {
  0% {
    content: '·\00a0\00a0';
  }
  33% {
    content: '··\00a0';
  }
  66%,
  100% {
    content: '···';
  }
}
/* Reduced motion freezes the loops and keeps a filled bar, so the card still reads as busy. The comet
   is a <span>, blockified only by `position: absolute`: `static` without display and height leaves it
   inline at 0x0, and a reader who asked for less motion would see an empty track. */
@media (prefers-reduced-motion: reduce) {
  .aether-overlay__mark,
  .aether-overlay__dots::after {
    animation: none;
  }
  .aether-overlay__comet {
    position: static;
    display: block;
    width: 100%;
    height: 100%;
    animation: none;
    opacity: 0.85;
  }
  .aether-overlay__dots::after {
    content: '···';
  }
  .aether-overlay__card,
  .aether-overlay.is-visible .aether-overlay__card {
    transform: none;
    transition: none;
  }
}
</style>
