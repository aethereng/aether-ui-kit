<script setup lang="ts">
/* A tooltip that survives being inside something with `overflow: hidden` — which is the only
 * reason it exists as a component rather than a CSS sibling.
 *
 * `popover` puts the surface in the TOP LAYER, outside every ancestor's overflow, clip, transform
 * and stacking context. Measured inside the kit's own Disclosure, whose __body clips by design: an
 * absolutely-positioned 260px surface showed 0 of 260px, the same surface as a popover showed 260.
 * There is no Teleport here and none is needed.
 *
 * Position comes from CSS anchor positioning, so the browser tracks the anchor through scroll and
 * resize itself — no listeners, no measuring loop. `position-try-fallbacks` does the collision flip.
 * Where anchor positioning is unsupported the popover still reaches the top layer (that half is
 * broadly available), and a small rect-based fallback places it. */
import { onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** The tooltip text. Plain string on purpose: rich content in a tooltip is unreachable by
     *  keyboard and invisible to touch. Anything interactive belongs in a Menu or a Dialog. */
    text: string
    placement?: 'top' | 'bottom' | 'left' | 'right'
    /** Dwell before showing on hover, in ms. Pointer only — focus shows immediately, because a
     *  keyboard user has already committed by landing on the control. */
    delay?: number
    disabled?: boolean
  }>(),
  { placement: 'bottom', delay: 400, disabled: false },
)

const tip = ref<HTMLElement | null>(null)
const anchor = ref<HTMLElement | null>(null)
const id = `aether-tip-${useId()}`
const anchorName = `--${id}`
const shown = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const supportsAnchor =
  typeof CSS !== 'undefined' && CSS.supports?.('position-anchor: --a') === true
/* Optional-called rather than assumed. jsdom implements neither showPopover nor the `popover`
   attribute, so an unguarded call throws on mount and breaks any consumer test that renders a
   tooltip. Where it is missing the `is-open` class carries visibility instead — see the
   `@supports not selector(:popover-open)` block, which only applies there. */
const supportsPopover =
  typeof HTMLElement !== 'undefined' &&
  Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover')

function clear() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function show() {
  clear()
  if (props.disabled || !props.text) return
  const el = tip.value
  if (!el || shown.value) return
  if (supportsPopover) el.showPopover()
  shown.value = true
  if (!supportsAnchor) place()
}

function hide() {
  clear()
  const el = tip.value
  if (!el || !shown.value) return
  if (supportsPopover) el.hidePopover()
  shown.value = false
}

function showAfterDelay() {
  clear()
  timer = setTimeout(show, props.delay)
}

/* Only runs where CSS anchor positioning is missing. Deliberately one-shot rather than tracked on
   scroll: a tooltip is dismissed by the very movement that would invalidate its position, so a
   listener would fire only to reposition something about to disappear. */
function place() {
  const el = tip.value
  const a = anchor.value
  if (!el || !a) return
  const r = a.getBoundingClientRect()
  const t = el.getBoundingClientRect()
  const gap = 6
  let top = r.bottom + gap
  let left = r.left + r.width / 2 - t.width / 2
  if (props.placement === 'top') top = r.top - t.height - gap
  if (props.placement === 'left') {
    top = r.top + r.height / 2 - t.height / 2
    left = r.left - t.width - gap
  }
  if (props.placement === 'right') {
    top = r.top + r.height / 2 - t.height / 2
    left = r.right + gap
  }
  el.style.top = `${Math.max(4, Math.min(top, innerHeight - t.height - 4))}px`
  el.style.left = `${Math.max(4, Math.min(left, innerWidth - t.width - 4))}px`
}

/* aria-describedby goes on the TRIGGER, which is the caller's element inside the slot — so it is
 * set imperatively rather than bound.
 *
 * And it is set only when the tooltip says something the accessible name does not. Half the real
 * call sites are label restatements on icon buttons ("Fit view" on a button already labelled "Fit
 * view"), where a description would make a screen reader read the same words twice. */
function wireTrigger() {
  const a = anchor.value
  const trigger = a?.firstElementChild as HTMLElement | null
  if (!trigger) return

  /* anchor-name goes on the TRIGGER, not on the wrapper. The wrapper is `display: contents` so it
     adds nothing to layout — and an element with `display: contents` generates no box, which means
     it cannot be an anchor at all. Named there, the popover silently fell back to the viewport
     corner. Anchoring to the trigger is also what you actually want: the tooltip should track the
     button, not a span that happens to contain it. */
  if (supportsAnchor) trigger.style.setProperty('anchor-name', anchorName)

  const name = (trigger.getAttribute('aria-label') || trigger.textContent || '').trim()
  const restatesName = name.toLowerCase() === props.text.trim().toLowerCase()
  if (restatesName || !props.text) trigger.removeAttribute('aria-describedby')
  else trigger.setAttribute('aria-describedby', id)
}
watch(() => [props.text, anchor.value], wireTrigger, { flush: 'post' })

function onKey(e: KeyboardEvent) {
  // Escape dismisses a tooltip without closing whatever is behind it.
  if (e.key === 'Escape' && shown.value) hide()
}

onBeforeUnmount(() => {
  clear()
  // A popover left open while its element is removed leaves a stranded surface in the top layer.
  if (shown.value && supportsPopover) tip.value?.hidePopover()
})
</script>

<template>
  <!-- A wrapper, not a control. The interactive element is the caller's, inside the slot; these
       listeners only observe it — pointer and focus to open, Escape to dismiss without closing
       whatever is behind. Moving them onto the trigger would mean reaching into slotted content
       and rewriting a caller's own element. -->
  <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
  <span
    ref="anchor"
    class="aether-tooltip__anchor"
    @pointerenter="showAfterDelay"
    @pointerleave="hide"
    @focusin="show"
    @focusout="hide"
    @keydown="onKey"
  >
    <slot />
    <div
      :id="id"
      ref="tip"
      popover="manual"
      role="tooltip"
      class="aether-tooltip"
      :class="[`aether-tooltip--${placement}`, { 'is-open': shown }]"
      :style="supportsAnchor ? { positionAnchor: anchorName } : { position: 'fixed' }"
    >
      {{ text }}
    </div>
  </span>
</template>

<style scoped>
.aether-tooltip__anchor {
  display: contents;
}
.aether-tooltip {
  /* The UA default for a popover is centred in the viewport with a border and padding; all of it
     has to be cleared before anything below applies. */
  margin: 0;
  border: 1px solid var(--aether-line-strong);
  border-radius: 6px;
  padding: 5px 8px;
  max-width: 260px;
  width: max-content;
  background: var(--aether-panel);
  color: var(--aether-ink);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.45;
  box-shadow: var(--aether-shadow);
  /* A tooltip must never eat a pointer event: it can appear under the cursor, and a surface that
     swallows the click makes the button beneath it feel broken. */
  pointer-events: none;
}
/* Only where `popover` is not understood. There, the attribute is inert and the element would
   otherwise render permanently visible, so visibility becomes ours to own. Guarded this way round
   because an unconditional `display: none` would BEAT the UA's `[popover]:popover-open` rule on
   specificity and stop the popover from ever appearing where it does work. */
@supports not selector(:popover-open) {
  .aether-tooltip {
    display: none;
  }
  .aether-tooltip.is-open {
    display: block;
    position: fixed;
  }
}
@supports (position-anchor: --a) {
  .aether-tooltip {
    position: fixed;
    margin: 6px;
    position-try-fallbacks: flip-block, flip-inline;
  }
  .aether-tooltip--top {
    position-area: top;
  }
  .aether-tooltip--bottom {
    position-area: bottom;
  }
  .aether-tooltip--left {
    position-area: left;
  }
  .aether-tooltip--right {
    position-area: right;
  }
}
</style>
