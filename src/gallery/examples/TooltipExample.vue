<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Tooltip from '@aether/ui-kit/controls/tooltip'
import Disclosure from '@aether/ui-kit/controls/disclosure'
import Tool from '@aether/ui-kit/controls/tool'

const open = ref(true)
</script>

<template>
  <div class="g-tt">
    <!-- Two shapes, and they want different treatment. A label restatement on an icon button gets
         NO aria-describedby, because the accessible name already says it and a screen reader would
         read the same words twice; an explanatory sentence does. The component decides by comparing
         the two, so a caller does not have to think about it. -->
    <!-- Inline SVG, the same idiom ToolExample uses: a 16x16 viewBox, `fill="none"`, and
         `stroke="currentColor"` so each mark takes the button's own colour. These were Unicode
         arrow glyphs (⤢ ⤡ ↧) until it turned out none of them came from the kit's typeface at all —
         measured identical widths in Inter, monospace and serif, which means every family was
         falling back to the same system font, and a machine without the codepoint would have shown
         tofu. On a kit whose whole point is shipping no icon font, that was the wrong thing to
         demonstrate. Two of the three were also near-identical at this size: ⤢ and ⤡ differ only in
         which diagonal they run along. -->
    <div class="g-tt-row">
      <Tooltip text="Fit view" placement="bottom">
        <Tool label="Fit view" label-hidden>
          <template #icon>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M2 6V2h4M14 10v4h-4M14 6V2h-4M2 10v4h4" />
            </svg>
          </template>
        </Tool>
      </Tooltip>
      <Tooltip text="Zoom to selection" placement="bottom">
        <Tool label="Zoom to selection" label-hidden>
          <template #icon>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="6.8" cy="6.8" r="4.3" />
              <path d="M10 10 13.8 13.8" />
            </svg>
          </template>
        </Tool>
      </Tooltip>
      <Tooltip text="Export PNG" placement="bottom">
        <Tool label="Export PNG" label-hidden>
          <template #icon>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M8 2.2v6.6M5.3 6.2 8 8.9l2.7-2.7M3 11.3v2.1h10v-2.1" />
            </svg>
          </template>
        </Tool>
      </Tooltip>
    </div>

    <!-- THE case this component exists for. Disclosure's body is `overflow: hidden` by design — it
         is what lets the 0fr row clip during the reveal — so anything positioned inside it that
         tries to escape is cut off. Measured here before the fix: 0 of 260px visible.

         `popover` puts the surface in the top layer, which is outside every ancestor's overflow,
         clip and transform. Open the panel and hover the button: the tooltip crosses the panel
         edge. No Teleport is involved. -->
    <Disclosure v-model:open="open" label="Coupling 14" meta="derived">
      <div class="g-tt-inner">
        <Tooltip
          placement="left"
          text="Suppress this coupling — it is derived again on the next solve but deliberately not made, and the suppression is undoable."
        >
          <button type="button" class="g-tt-btn">Suppress</button>
        </Tooltip>
        <span class="g-tt-hint">hover the button — the tooltip leaves the panel</span>
      </div>
    </Disclosure>
  </div>
</template>

<style scoped>
.g-tt {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.g-tt-row {
  display: flex;
  gap: 8px;
}
.g-tt-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.g-tt-btn {
  font: inherit;
  font-size: var(--aether-control-font-size);
  color: var(--aether-ink);
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: 7px;
  padding: 5px 10px;
  cursor: pointer;
}
.g-tt-hint {
  font-size: 11.5px;
  color: var(--aether-faint);
}
</style>
