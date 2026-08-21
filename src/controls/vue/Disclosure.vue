<script setup lang="ts">
/* A collapsible panel. See DisclosureProps in ../core/types for why this is a button + region
 * rather than a <details>/<summary>, which would have given the keyboard and screen-reader
 * contract for free.
 *
 * Controlled: the caller owns `open`. `v-model:open` is the intended binding.
 *
 * Emits:
 *   update:open — (boolean) the state the caller should move to
 */
import { useId } from 'vue'
import type { DisclosureProps } from '../core/types'

const props = withDefaults(defineProps<DisclosureProps>(), {
  open: false,
  meta: undefined,
  disabled: false,
})

const emit = defineEmits<{
  'update:open': [boolean]
}>()

/* Not assigned to a const, unlike Tool's: nothing here branches on whether a slot was passed —
 * an empty <slot name="aside" /> renders no element and a flex gap applies only between items. */
defineSlots<{
  /** The collapsible content. */
  default?: () => unknown
  /** Header controls that must stay reachable while COLLAPSED — a link, a menu, a status badge.
   *  Renders as a SIBLING of the toggle, never inside it, so it is its own tab stop. */
  aside?: () => unknown
}>()

/* aria-controls needs an IDREF, and the region is not the caller's element to name. useId arrived
 * in Vue 3.5 (this kit's peer floor), so it is stable across SSR without a module-level counter.
 * Caveat worth knowing: useId is unique per APP, not per document — a page that mounts several Vue
 * apps hands each one its own `v-0`, and colliding ids would make one panel's toggle point at
 * another's region. Vue's remedy is `app.config.idPrefix`, which only the host can set. Every
 * current consumer mounts one app per page, so this is a note rather than a defect. */
const regionId = useId()
</script>

<template>
  <div class="aether-disclosure" :class="{ 'aether-disclosure--open': open }">
    <div class="aether-disclosure__head">
      <button
        class="aether-disclosure__toggle"
        type="button"
        :aria-expanded="open"
        :aria-controls="regionId"
        :disabled="disabled"
        @click="emit('update:open', !open)"
      >
        <span class="aether-disclosure__chev" aria-hidden="true"></span>
        <span class="aether-disclosure__labels">
          <span class="aether-disclosure__label">{{ label }}</span>
          <span v-if="props.meta" class="aether-disclosure__meta">{{ props.meta }}</span>
        </span>
      </button>
      <slot name="aside" />
    </div>

    <!-- `hidden="until-found"` rather than a CSS `display: none`, and it is the one thing a
         <details> gave for free that had to be rebuilt deliberately: it keeps the collapsed text
         reachable by the browser's find-in-page, which then fires `beforematch` so we can tell the
         caller to open. A plain `display: none` makes Ctrl+F silently miss everything inside every
         collapsed panel on the page.
         `.attr` is load-bearing: `hidden` is a DOM property as well as an attribute, and assigning
         the string through the property path risks it coercing to a plain boolean and collapsing
         back to a bare `hidden` -- which still hides, but loses findability without erroring.
         Browsers that do not know `until-found` treat the unknown value as plain hidden, so the
         degradation is the old behaviour rather than a broken panel.
         This choice does NOT cost the reveal animation, which was the open question when the first
         consumer adopted it — see the transition block in the styles below for how the two coexist
         and what the trade is. -->
    <div
      :id="regionId"
      class="aether-disclosure__region"
      :hidden.attr="open ? undefined : 'until-found'"
      @beforematch="emit('update:open', true)"
    >
      <!-- The padding and top border live on this inner element, not on the region. `until-found`
           hides the region's CONTENTS (content-visibility) while the region itself keeps its own
           box -- so padding and a border declared on the region would paint as a stray strip under
           the header of every closed panel. -->
      <div class="aether-disclosure__body"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.aether-disclosure {
  border: 1px solid var(--aether-line);
  /* The SURFACE radius, not the control one — see the token's note in ui-kit.css. This was a
     literal 8px here and again in Card, so the two panels a consumer stacks in one column agreed
     only by coincidence. */
  border-radius: var(--aether-radius-surface);
  background: var(--aether-surface);
  overflow: hidden;
}
/* The head is a plain row, NOT the click target: only .aether-disclosure__toggle toggles, so
   `cursor: pointer` belongs there and not here, or it would advertise the aside as a toggle. */
.aether-disclosure__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}
.aether-disclosure__head:hover {
  background: var(--aether-panel);
}
/* The toggle has to read as header text, so it carries no button chrome -- which means undoing
   the font, colour, padding and alignment a UA stylesheet imposes on <button>.
   `min-width: 0` lets it shrink so a long label truncates instead of shoving the aside out. */
.aether-disclosure__toggle {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.aether-disclosure__toggle:disabled {
  cursor: default;
  opacity: 0.55;
}
/* Own focus ring rather than the shared one in ui-kit.css: scoping adds an attribute selector to
   these rules, so a global ring would lose the specificity contest against them. */
.aether-disclosure__toggle:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 3px;
  border-radius: 4px;
}
/* A CSS border triangle, not a `▸` glyph. The glyph was the first attempt and it rendered as a
   speck: at 11px in --aether-faint it was smaller and weaker than the marker on the gallery's own
   panels, so the component looked less finished than the thing it was meant to replace. A border
   triangle is font-independent (a glyph's size and weight vary with whatever font the host sets),
   crisp at any DPI, and takes a token via currentColor. --aether-ink-soft rather than --aether-faint
   because this is the affordance that says the panel opens, not incidental metadata. */
.aether-disclosure__chev {
  flex: none;
  width: 0;
  height: 0;
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  color: var(--aether-ink-soft);
  transition: transform 0.15s ease;
}
.aether-disclosure--open .aether-disclosure__chev {
  transform: rotate(90deg);
}
.aether-disclosure__labels {
  min-width: 0;
}
.aether-disclosure__label {
  display: block;
  font-weight: 600;
  font-size: 14px;
}
.aether-disclosure__meta {
  display: block;
  color: var(--aether-faint);
  font-size: 12px;
}
/* ---- the reveal ---- */
/* This used to be a CSS Grid `0fr -> 1fr` row, which is the usual clever way to animate to an
   unmeasured `auto` height. Replaced after live testing (not spec-reading) turned up two
   independent ways it silently failed to open at all -- aria-expanded correct, the --open
   class correct, the `hidden` attribute correctly removed, and the row still measured as a few
   px, in a fixed reveal-does-not-happen way that survived a full close/reopen cycle:

     1. `transition-behavior: allow-discrete` on content-visibility (the previous version of
        this comment blamed only this, and it IS real: content-visibility stayed reported as
        "hidden" long after the attribute driving it was gone) -- but fixing that alone was not
        enough on its own.
     2. The grid row's OWN sizing: even with content-visibility genuinely visible and the body's
        real height measurable (262px in the case that exposed this), the region's
        grid-template-rows still computed near-zero. `.aether-disclosure__body` carries
        `overflow: hidden` for the clip this technique needs, and a grid item with overflow set
        gets an automatic minimum size of 0 -- which is supposed to bound only how far the item
        may SHRINK, not its preferred size, but is what this row's `1fr` measured against
        regardless of an explicit `min-height` override on the body.

   Two failure modes in one already-narrow technique is a pattern, not a coincidence -- the
   grid-row auto-height trick depends on several still-settling engine behaviours agreeing with
   each other at once (content-visibility timing, grid track sizing against an overflow:hidden
   item, `until-found`'s own UA-level styling), and "worked when checked once" was never proof
   the combination is reliable.
   `max-height` costs a ceiling that has to be a real number rather than true `auto` -- 2000px,
   comfortably past any content this component holds today -- and animates slightly faster than
   ideal for a short panel, since the transition covers the fixed distance to that ceiling
   rather than the content's actual height. Both are the standard, known trade of this
   technique, and worth it for something that reliably opens: no grid, no discrete-property
   transition, nothing for `until-found`'s own styling to race.
   Behind `prefers-reduced-motion` because the setting is live for real users here, and because
   the Vuetify transition this replaces was gated the same way. With motion reduced the panel
   snaps, which is exactly the previous behaviour rather than a degradation. */
.aether-disclosure__region {
  max-height: 0;
  overflow: hidden;
}
.aether-disclosure--open .aether-disclosure__region {
  max-height: 2000px;
}
@media (prefers-reduced-motion: no-preference) {
  .aether-disclosure__region {
    transition: max-height 0.22s ease;
  }
}
.aether-disclosure__body {
  overflow: hidden;
  border-top: 1px solid var(--aether-line);
  padding: 12px 14px;
}

/* ---- touch targets ---- */
/* Last block in the file on purpose: `min-height` clamps the used height regardless of order, but
   these rules are a same-specificity contest with the ones above, so source order decides. */
@media (pointer: coarse) {
  /* The full 44px, not --aether-touch-dense: the dense floor is for controls that repeat inside a
     rail (chips, segments), and a full-width panel header is not one of those. Adjacent stacked
     panels mis-tap vertically, which is exactly what the larger figure is for. Mostly a floor
     rather than a change -- a two-line header already measures more than this. */
  .aether-disclosure__toggle {
    min-height: var(--aether-touch);
  }
}
</style>
