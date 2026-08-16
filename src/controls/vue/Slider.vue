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
 * can only print what is stored, which is the wrong quantity for that whole class of control.
 *
 * `ticks` is why this component draws its own track and thumb — see the style block. A mark has to
 * sit exactly under the value it names, that position depends on the thumb's width, and the UA
 * only lets you know the width by setting it. The whole of the styling below follows from that one
 * requirement; it is not a restyle that happened to arrive at the same time.
 *
 * THE SUFFIX SPACE IS `&nbsp;`, NOT A LITERAL SPACE. It was a literal one and never rendered: a
 * plain space leading the span's text is whitespace at the start of an element, which the
 * compiler's default `whitespace: 'condense'` strips, so every consumer read "521m". Measured in a
 * host app, not reasoned about — the emitted HTML was `521<span>m</span>`. The entity survives
 * condensing, and being non-breaking is what the pair wants anyway: a value and its unit are one
 * token, and this read-out is a 4.5ch column narrow enough to wrap them apart. */

import { computed } from 'vue'
import type { SliderTick } from '../core/types'

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
    /** Marks on the track, at values the scale does not make obvious. See SliderTick. */
    ticks?: SliderTick[]
    disabled?: boolean
  }>(),
  {
    min: 0,
    max: 100,
    step: undefined,
    suffix: undefined,
    format: undefined,
    ticks: () => [],
    disabled: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}

/* Where a value sits along the thumb's TRAVEL, 0..1 — the one number both the filled track and
   every tick are positioned from, so a mark and the thumb it marks cannot drift apart.
   Clamped: a tick outside [min,max] is a caller's mistake, and pinning it to the end it overshot
   keeps it on the control instead of flying off into the layout. */
function fraction(value: number): number {
  const span = props.max - props.min
  if (span === 0) return 0
  return Math.max(0, Math.min(1, (value - props.min) / span))
}

const readout = computed(() =>
  props.format ? props.format(props.modelValue) : String(props.modelValue),
)

/* What a screen reader says instead of the raw number. A range announces its VALUE, which for the
   whole class of control `format` exists for is the wrong quantity — "25" where the field reads
   "×1.0". Setting it from the same function the read-out uses is what keeps the spoken and the
   printed value one thing. Left undefined when there is nothing to correct, so an ordinary slider
   keeps the platform's own announcement rather than a stringified copy of it. */
const valueText = computed(() => {
  if (!props.format && !props.suffix) return undefined
  return props.suffix ? `${readout.value} ${props.suffix}` : readout.value
})
</script>

<template>
  <div class="aether-slider" :style="{ '--at': fraction(modelValue) }">
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-valuetext="valueText"
      @input="onInput"
    />
    <output class="aether-slider__readout">
      {{ readout }}<span v-if="suffix">&nbsp;{{ suffix }}</span>
    </output>
    <!-- aria-hidden because this is the same information twice: the marks are a visual scale for
         the value the input already announces, and `aria-valuetext` above is what makes that
         announcement say "×1.0" rather than "25". Read out, the labels would be loose text with
         nothing to attach them to. -->
    <div v-if="ticks.length > 0" class="aether-slider__ticks" aria-hidden="true">
      <span
        v-for="t in ticks"
        :key="t.value"
        class="aether-slider__tick"
        :style="{ '--at': fraction(t.value) }"
      >
        <span v-if="t.label" class="aether-slider__tick-label">{{ t.label }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* The track takes the room and the read-out is a fixed, tabular column, so the track does not
   resize as digits change under it.
   NO border and no padding, which IS a change: the old shared rule was
   `.aether-property-editor__field input:not([type='checkbox'])`, and it caught `type="range"` by
   accident — a slider carried a 1px border and 6px/10px of padding, making the row 13.7px taller
   than the control needs. That was never a decision about sliders, it was a selector that only
   excluded the switch. A track does not want a box, so it does not get one.

   ── THE KIT DRAWS THE TRACK AND THE THUMB, as of the tick support below ────────────────────
   This replaced `accent-color`, and NOT as a preference. A tick has to sit exactly under the
   value it marks, and the thumb centre travels from thumb/2 to width−thumb/2 — so the geometry is
   unknowable unless the kit sets the thumb size itself. Styling `::-webkit-slider-thumb` is
   silently IGNORED unless the input is also `appearance: none` (measured: a thumb rule alone left
   the computed height at the UA's 16px; with the input reset it took the declared 22px). Removing
   the native appearance takes the native track with it, which is why both are drawn here.

   `accent-color` is gone with them. It is the declaration that tinted what the UA drew, and the
   UA now draws none of it — leaving it would be a rule with nothing to colour.

   GRID, not flex, because ticks add a SECOND ROW under the track while the read-out stays beside
   it. Both live in column 1, so they are the same width by construction and the tick math and the
   track fill resolve their percentages against the same box. With no ticks the grid is one row
   and lays out exactly as the flex row it replaced. */
.aether-slider {
  /* Local geometry, deliberately NOT --aether-* tokens: these are two numbers three rules have to
     agree on, not a theming surface. A host that could retune the thumb would silently move every
     tick, and the kit's token list is audited by consumers — it should not grow for an internal
     constant. */
  --thumb: 16px;
  --rail: 4px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: 10px;
}
/* The thumb centre for whatever --at the element itself carries: the input inherits the model
   value's fraction from the root, each tick sets its own inline. One formula, two readings.
   DECLARED ON BOTH, not once on the parent and inherited — that was the first version and it put
   every tick under the thumb. A custom property referencing another is substituted where it is
   DECLARED, so `--pos` on the root baked in the root's --at and the ticks inherited a finished
   number rather than the formula. `100%` is not resolved at that point, though, so it still means
   "this element's own box" at each use site — the track and the tick strip, which are one column
   wide by construction and therefore agree. */
.aether-slider input[type='range'],
.aether-slider__tick {
  --pos: calc(var(--thumb) / 2 + var(--at) * (100% - var(--thumb)));
}
.aether-slider input[type='range'] {
  grid-area: 1 / 1;
  min-width: 0;
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  padding: 0;
  background: transparent;
  /* The box the thumb needs; the rail is thinner and centres inside it. */
  height: var(--thumb);
  cursor: pointer;
}
.aether-slider input[type='range']:disabled {
  cursor: default;
  opacity: 0.55;
}

/* The rail, filled to the thumb and plain beyond it. Chrome has no ::-moz-range-progress
   equivalent, so the split is a hard-stop gradient at --pos rather than a second element —
   which also keeps Firefox on the identical code path instead of a second answer. */
.aether-slider input[type='range']::-webkit-slider-runnable-track {
  height: var(--rail);
  border-radius: calc(var(--rail) / 2);
  background: linear-gradient(
    to right,
    var(--aether-selected) 0 var(--pos),
    var(--aether-line-strong) var(--pos) 100%
  );
}
.aether-slider input[type='range']::-moz-range-track {
  height: var(--rail);
  border-radius: calc(var(--rail) / 2);
  background: linear-gradient(
    to right,
    var(--aether-selected) 0 var(--pos),
    var(--aether-line-strong) var(--pos) 100%
  );
}

/* The knob. Same shape language as Switch's — a circle with the same lift — so the two controls
   read as one family rather than one kit control and one browser's. */
.aether-slider input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: var(--thumb);
  height: var(--thumb);
  border-radius: 50%;
  background: var(--aether-selected);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  /* WebKit places the thumb against the top of the track and does not centre it; Firefox does. */
  margin-top: calc((var(--rail) - var(--thumb)) / 2);
}
.aether-slider input[type='range']::-moz-range-thumb {
  width: var(--thumb);
  height: var(--thumb);
  /* Firefox draws a thumb border of its own, which reads as a ring the design does not have. */
  border: 0;
  border-radius: 50%;
  background: var(--aether-selected);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.aether-slider__readout {
  grid-area: 1 / 2;
  min-width: 4.5ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--aether-ink-soft);
}

/* Row two, the same width as the track above it. */
.aether-slider__ticks {
  grid-area: 2 / 1;
  position: relative;
  height: 14px;
}
.aether-slider__tick {
  position: absolute;
  top: 0;
  left: var(--pos);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* The mark itself: a short stroke, drawn rather than a character, so it lines up with the rail
   whatever the label says. */
.aether-slider__tick::before {
  content: '';
  width: 1px;
  height: 4px;
  background: var(--aether-line-strong);
}
.aether-slider__tick-label {
  font-size: 11px;
  line-height: 1;
  margin-top: 2px;
  color: var(--aether-ink-soft);
  font-variant-numeric: tabular-nums;
  /* A label sits under a point, so it must be free to overhang its own 0-width anchor. */
  white-space: nowrap;
}

.aether-slider input[type='range']:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}
</style>
