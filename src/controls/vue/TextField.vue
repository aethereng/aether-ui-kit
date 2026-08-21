<script setup lang="ts">
/* Free text, single- or multi-line.
 *
 * `multiline` is a PROP rather than a second component, and that is the kit's own rule applied
 * consistently: different INTERACTION means a different component, different SHAPE means a prop.
 * A textarea types exactly like an input — same data, same commit-per-keystroke, same bordered box
 * — and only its shape differs, which is the `enum` variant case. NumberField is a component for
 * the opposite reason: it cannot commit per keystroke without making "1.5" unreachable. */

import { nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    multiline?: boolean
    /** Visible rows when multiline. Ignored otherwise, and ignored once `autogrow` takes over —
     *  kept only as the height the very first paint uses, before JS has measured anything. */
    rows?: number
    placeholder?: string
    disabled?: boolean
    /** Multiline only. Height tracks content instead of a fixed `rows`, growing and shrinking
     *  live — both on typing and when `modelValue` changes from OUTSIDE (a caller reassigning
     *  the field's value, not just the user typing into it). Also switches `resize` off: once
     *  height is no longer something to drag, the browser's own corner-triangle glyph is
     *  leftover affordance for a gesture that no longer does anything. No min-height here for
     *  the same reason the multiline rule above has none — that is the caller's layout to set,
     *  not this component's to assume. */
    autogrow?: boolean
    /** autogrow only. The ceiling it grows to before it stops pushing on whatever layout it
     *  sits in and starts scrolling internally instead — unbounded growth is fine for the field
     *  but not for the panel around it, which is exactly what held-down Enter demonstrates.
     *  8 is a working default, not a considered one; there is no natural "right" ceiling, only
     *  a layout it should stop pushing on. */
    maxRows?: number
  }>(),
  { multiline: false, rows: 3, placeholder: undefined, disabled: false, autogrow: false, maxRows: 8 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)

function grow() {
  const el = textareaEl.value
  if (!el) return
  // Reset before measuring: a textarea already holding an explicit height only ever reports
  // that height back from scrollHeight, never a smaller one, so shrinking on deletion needs
  // the browser to recompute from scratch first.
  el.style.height = 'auto'
  // scrollHeight is content + padding, NEVER border -- but .aether-textfield is border-box, so
  // `height` sets content + padding + border. Setting height straight to scrollHeight is short
  // by exactly the border width, which reads as the last line's descenders getting clipped.
  const cs = getComputedStyle(el)
  const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
  let target = el.scrollHeight + borders
  if (props.maxRows > 0) {
    // Same box-model math as the height itself, run as a ceiling instead of a target: line-height
    // is explicit on .aether-textfield precisely so this (and the height calc above) has a real
    // number to multiply rather than "normal", which parseFloat can't do anything with.
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const maxPx = parseFloat(cs.lineHeight) * props.maxRows + padding + borders
    target = Math.min(target, maxPx)
  }
  el.style.height = `${target}px`
}

if (props.autogrow) {
  // One path covers both triggers: typing emits update:modelValue, the caller's v-model writes
  // it back into the `modelValue` prop, and that is what this watches — so a caller
  // reassigning the value directly re-measures exactly the same way typing does, with no
  // separate DOM 'input' listener needed for either case.
  watch(() => props.modelValue, () => nextTick(grow), { immediate: true })
  // The mount-time measurement above can still be wrong regardless: it runs against whatever
  // font is ACTUALLY painted at that instant, and on a first load that's routinely a fallback,
  // not the real one yet (this component makes no assumption about which font loads it, or
  // when — that's entirely the host's stylesheet). A narrower fallback wraps fewer lines than
  // the real font will, so the very first grow() undersizes the box, and nothing re-measures
  // afterward — until an edit happens to call grow() again, well after the font has settled,
  // which is why retyping "fixes" it. document.fonts.ready is the actual signal to wait for.
  if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(grow)
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}
</script>

<template>
  <textarea
    v-if="multiline"
    ref="textareaEl"
    class="aether-textfield aether-textfield--multiline"
    :class="{ 'aether-textfield--autogrow': autogrow }"
    :value="modelValue"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
  />
  <input
    v-else
    type="text"
    class="aether-textfield"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
  />
</template>

<style scoped>
.aether-textfield {
  box-sizing: border-box;
  width: 100%;
  font: inherit;
  font-size: 13.5px;
  /* `font: inherit` resets line-height along with everything else, and nothing below sets it
     back — so it falls through to the font's own "normal", whatever that resolves to. Most
     fonts distribute that leading unevenly above vs. below the glyphs, which is invisible on a
     single line (padding absorbs it symmetrically either way) but reads as mismatched top/
     bottom padding once autogrow's height comes from the same box-model math this pins. */
  line-height: 1.5;
  color: var(--aether-ink);
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: 7px;
  padding: 7px 9px;
  accent-color: var(--aether-cool);
}
.aether-textfield:focus {
  outline: none;
  border-color: var(--aether-ink-soft);
}
.aether-textfield:disabled {
  color: var(--aether-faint);
  cursor: default;
}
.aether-textfield--multiline {
  /* Vertical only: a textarea that can be dragged wider escapes whatever column it sits in, and
     in a form that column is the layout.
     NO min-height. One was tried and removed: the height a textarea wants is what `rows` says, and
     a floor here fought labelPlacement="inside", whose 17px top padding then pushed the field 7px
     past where it had always been. */
  resize: vertical;
  /* Only reachable without `autogrow` (that variant sets overflow-y: hidden — content never
     scrolls, it grows instead), so this only ever paints on a fixed-`rows` field whose content
     outgrew it. Firefox's two-value subset first; Chromium's fuller ::-webkit-scrollbar* below
     it wins where supported. 8px stays a component-internal scrollbar rather than reading as a
     page-level one — deliberately thinner than a whole surface would want. */
  scrollbar-width: thin;
  scrollbar-color: var(--aether-cool-wash) transparent;
}
.aether-textfield--multiline::-webkit-scrollbar {
  width: 8px;
}
.aether-textfield--multiline::-webkit-scrollbar-track {
  background: transparent;
}
.aether-textfield--multiline::-webkit-scrollbar-thumb {
  background: var(--aether-cool-wash);
  border-radius: 999px;
}
.aether-textfield--multiline::-webkit-scrollbar-thumb:hover {
  background: var(--aether-cool-soft);
}
/* The UA's own corner-triangle glyph, replaced with a plain tinted patch in the kit's own
   accent rather than the browser's grey diagonal lines. Chromium/WebKit only (Firefox exposes
   no equivalent, and "best-effort" there already accepts gaps like this one) — but of that
   pair, only Chromium is a *supported* browser, so this reaches the target, not the floor.
   Unconditional rather than gated on :hover/:focus on purpose: the datetime-edit rule above
   is the proof this kit already has that a UA sub-element rarely receives the state selector
   you would reach for first (:focus there never fires; the sub-field just isn't what focus
   lands on) — an unconditional background was the one thing proven, in-browser, to paint. */
.aether-textfield--multiline::-webkit-resizer {
  /* The resizer's box is a plain square; a flat background-color fills the whole thing rather
     than reading as a corner grip. A diagonal split (135deg = top-left to bottom-right) leaves
     the near half transparent and tints only the half actually in the corner, which is what
     reads as a triangle instead of a block. */
  background: linear-gradient(135deg, transparent 50%, var(--aether-cool-wash) 50%);
}
.aether-textfield--autogrow {
  resize: none;
  /* auto, not hidden: below maxRows there is nothing TO scroll (height already fits scrollHeight
     exactly), so this paints nothing until content actually hits the ceiling -- at which point
     it needs to scroll the overflow rather than clip it silently. Also textfield--multiline's
     own class, so it already carries that variant's ::-webkit-scrollbar theming — no separate
     rule needed for the capped case specifically. */
  overflow-y: auto;
}
</style>
