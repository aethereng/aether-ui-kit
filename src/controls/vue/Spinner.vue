<script setup lang="ts">
/* An indeterminate busy indicator: something is happening, and nobody knows for how long.
 *
 * INDETERMINATE ONLY. A determinate progress ring is a different control — it carries a value, a
 * max and an `aria-valuenow`, and it answers "how far" rather than "is it working". Neither
 * consumer has one, and building the axis in advance would mean a `value?: number` that every
 * caller passes undefined to.
 *
 * `label` IS THE ACCESSIBILITY CONTRACT, and it is optional because the two real call sites
 * genuinely differ:
 *
 *   One sits beside its own status text — "verifying…", already visible, already read. A spinner
 *   there is decoration, and naming it too would make a screen reader say the same thing twice in
 *   two vocabularies.
 *   The other sits alone in a panel header, with nothing but a count beside it. Unnamed it is
 *   invisible to a screen reader: the panel simply appears to be doing nothing.
 *
 * So: no label means `aria-hidden`, and the caller's own text speaks. A label means role="status",
 * and this speaks. The default is the quiet one on purpose — same reasoning as Badge's missing
 * role="status": a component that announces itself unasked adds furniture to every screen reader
 * that meets it, and the caller is the one who knows whether the update is worth speaking.
 *
 * The stroke is DERIVED from the size rather than a prop, and ROUNDED TO A WHOLE PIXEL. Both call
 * sites use 2px, at 14px and 16px, which size/8 reproduces — but only after rounding: unrounded it
 * gives 1.75px at size 14, and a browser floors a sub-pixel border, so that spinner drew a 1px
 * ring beside the other's 2px. Measured in the gallery, not predicted. Rounding lands both on the
 * 2px the consumers already chose and stops the weight jumping around with the diameter.
 * A prop can arrive when a caller wants a weight that its size does not imply. */

const props = withDefaults(
  defineProps<{
    /** Outer diameter in px. */
    size?: number
    /** Accessible name. Omit when visible text beside it already says what is happening. */
    label?: string
  }>(),
  { size: 16, label: undefined },
)

const stroke = () => Math.max(1, Math.round(props.size / 8))
</script>

<template>
  <span
    class="aether-spinner"
    :style="{ '--size': size + 'px', '--stroke': stroke() + 'px' }"
    :role="label ? 'status' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>

<style scoped>
/* A rotating arc: a full ring in the line colour with one quadrant painted in the accent, which is
   the cheapest honest spinner — no SVG, no keyframed dash offsets, and it scales from one length.
   box-sizing because the border is part of the declared diameter; the kit ships no reset. */
.aether-spinner {
  box-sizing: border-box;
  display: inline-block;
  flex: none;
  width: var(--size);
  height: var(--size);
  border: var(--stroke) solid var(--aether-line-strong);
  border-top-color: var(--aether-cool);
  border-radius: 50%;
  animation: aether-spin 0.7s linear infinite;
}

/* SLOWED, NOT STOPPED. A frozen spinner does not read as "reduced motion", it reads as a hung
   process — the one message this component exists to disprove. The guidance is to remove motion
   that is decorative; this motion IS the information. So it keeps turning, four times slower,
   which drops it well under the flicker and vestibular thresholds the preference is about. */
@media (prefers-reduced-motion: reduce) {
  .aether-spinner {
    animation-duration: 2.8s;
  }
}

@keyframes aether-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
