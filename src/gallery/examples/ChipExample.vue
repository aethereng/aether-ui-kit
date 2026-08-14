<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Chip from '@aether/ui-kit/controls/chip'
import type { ChipOption } from '@aether/ui-kit/controls/core'

/* Multi-select: the caller owns the Set, the chip only reports a toggle. */
const active = ref<Set<string>>(new Set(['fact', 'risk']))

const chipOptions: ChipOption[] = [
  { value: 'fact', label: 'Facts', count: 6, dotColor: 'var(--aether-cool-soft)' },
  { value: 'idea', label: 'Ideas', count: 3 },
  { value: 'risk', label: 'Risks', count: 2, dotColor: 'var(--aether-warm)' },
  /* `muted` dims an option without disabling it — a filter whose count is zero but which should
     still be visible and clickable. Contrast with `disabled` below. */
  { value: 'link', label: 'Links', count: 0, muted: true },
  { value: 'lane', label: 'Colour-accented', count: 4, color: 'var(--aether-warm)' },
  /* `swatch` takes a raw CSS declaration list rather than a colour, so a chip can carry the same
     encoding as the thing it filters — which is what lets a set of chips replace a legend
     instead of sitting beside one. */
  { value: 'planned', label: 'Planned', count: 5, swatch: 'border:1.5px dashed var(--aether-warm)' },
  { value: 'shipped', label: 'Shipped', count: 9, swatch: 'background:var(--aether-cool);opacity:.45' },
  /* disabled: unavailable, not merely empty. Click is a no-op. */
  { value: 'archived', label: 'Archived', count: 0, disabled: true },
]

function toggle(v: string) {
  const next = new Set(active.value)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  active.value = next
}

/* modelValue also takes a single value instead of a Set, for a one-active-chip filter. */
const single = ref('all')
const singleOptions: ChipOption[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine', count: 4 },
  { value: 'stale', label: 'Stale', count: 2 },
]

/* variant="row" is the sidebar form: borderless, full width, count in its own right-hand column.
   FilterRail renders its vertical orientation out of these. */
const rows = ref<Set<string>>(new Set(['open']))
const rowOptions: ChipOption[] = [
  { value: 'open', label: 'Open', count: 4, dotColor: 'var(--aether-cool)' },
  { value: 'done', label: 'Done', count: 7 },
  { value: 'blocked', label: 'Blocked', count: 1, dotColor: 'var(--aether-warm)' },
]
function toggleRow(v: string) {
  const next = new Set(rows.value)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  rows.value = next
}
</script>

<template>
  <div class="g-ex">
    <span class="g-variant">default (pill) — multi-select via a Set</span>
    <Chip :options="chipOptions" :model-value="active" aria-label="Filter by kind" @toggle="toggle" />
  </div>

  <div class="g-ex">
    <span class="g-variant">a single value instead of a Set — one active chip</span>
    <Chip :options="singleOptions" :model-value="single" aria-label="Scope" @toggle="single = $event" />
  </div>

  <div class="g-ex" style="min-width: 210px">
    <span class="g-variant">variant="row" — the sidebar form</span>
    <Chip variant="row" :options="rowOptions" :model-value="rows" aria-label="Status" @toggle="toggleRow" />
  </div>

  <code class="g-ex-state">
    active = [{{ [...active].join(', ') || '∅' }}] · single = "{{ single }}" · rows = [{{
      [...rows].join(', ') || '∅'
    }}]
  </code>
</template>
