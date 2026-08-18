<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Tool from '@aether/ui-kit/controls/tool'
/* Material Design Icons as PATH STRINGS, not a font and not a component library. `@mdi/js` is
   tree-shaken, so only the icons named here are bundled, and each one drops straight into the
   #icon slot as an inline <svg>. That is how you keep a familiar icon set without the kit gaining
   an icon dependency -- the kit never learns what mdi is. */
import { mdiContentSave, mdiDelete } from '@mdi/js'

const clicks = ref(0)

/* A closed variant set rather than an open style hook. If both `hot` and `danger` are passed,
   danger wins — mislabelling a destructive action as primary is the worse failure, so the
   component decides rather than leaving it to declaration order.

   There is deliberately NO active/pressed state: Tool is a stateless command, which is the line
   between it and Seg. A row where several things can be on at once is Chip's contract. */
</script>

<template>
  <div class="g-ex g-ex--tile">
    <span class="g-variant">hot — the primary action on a surface</span>
    <Tool label="New card" hot @click="clicks++" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">default — neutral</span>
    <Tool label="Plain" @click="clicks++" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">danger — destructive</span>
    <Tool label="Delete" danger @click="clicks++" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">disabled — emits nothing</span>
    <Tool label="Disabled" disabled @click="clicks++" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">both hot and danger — danger wins</span>
    <Tool label="Discard all" hot danger title="danger takes precedence" @click="clicks++" />
  </div>

  <div class="g-ex g-ex--tile">
    <!-- #icon is a SLOT, not an `icon` prop: a prop would imply an icon vocabulary, and zero
         runtime dependencies is load-bearing for this kit. Bring your own SVG. -->
    <span class="g-variant">#icon slot, with a label — a hand-written SVG</span>
    <Tool label="Fit view" @click="clicks++">
      <template #icon>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M2 6V2h4M14 10v4h-4M14 6V2h-4M2 10v4h4" />
        </svg>
      </template>
    </Tool>
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">#trailing — an affordance after the label, not a second icon</span>
    <Tool label="Sort" @click="clicks++">
      <template #trailing>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 6.5 8 10.5 12 6.5" />
        </svg>
      </template>
    </Tool>
  </div>

  <!-- Two tiles wide: the two buttons below are a .g-ex-row and must stay side by side, which a
       single-column tile is too narrow to allow. -->
  <div class="g-ex g-ex--tile-wide">
    <!-- The same slot, fed from @mdi/js. mdi paths are drawn on a 24x24 grid, so the viewBox is
         "0 0 24 24" and `fill="currentColor"` makes the glyph inherit the button's colour -- both
         the hot and danger variants included, without the icon knowing which it is in. -->
    <span class="g-variant">#icon slot, fed from @mdi/js — path strings, tree-shaken, no font</span>
    <div class="g-ex-row">
      <Tool label="Save" hot @click="clicks++">
        <template #icon>
          <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiContentSave" /></svg>
        </template>
      </Tool>
      <Tool label="Delete" danger @click="clicks++">
        <template #icon>
          <svg viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDelete" /></svg>
        </template>
      </Tool>
    </div>
  </div>

  <div class="g-ex g-ex--tile">
    <!-- labelHidden keeps `label` as the ACCESSIBLE NAME via aria-label, so an icon-only button
         is never unlabelled to a screen reader. -->
    <span class="g-variant">labelHidden — icon only, still named for screen readers</span>
    <Tool label="Zoom to selection" label-hidden title="Zoom to selection" @click="clicks++">
      <template #icon>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
      </template>
    </Tool>
  </div>

  <code class="g-ex-state">clicks = {{ clicks }}</code>
</template>
