<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import FilterRail from '@aether/ui-kit/controls/filter-rail'
import type { FilterGroup } from '@aether/ui-kit/controls/core'

/* Grouping and selection are pure data; the rail renders one Chip row per group and wires
   toggle/clear mechanically. Both orientations below share ONE state object, which is why
   toggling either updates both — they are two views of the same filter, not two filters. */
const groups = ref<FilterGroup[]>([
  {
    key: 'type',
    label: 'Type',
    selected: new Set<string>(),
    options: [
      { value: 'fact', label: 'Fact', count: 6, dotColor: 'var(--aether-cool)' },
      { value: 'idea', label: 'Idea', count: 3, dotColor: 'var(--aether-warm)' },
      { value: 'risk', label: 'Risk', count: 2 },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    selected: new Set<string>(),
    options: [
      { value: 'open', label: 'Open', count: 4 },
      { value: 'done', label: 'Done', count: 7 },
    ],
  },
])

/* Shown as "N hidden" when non-zero — the rail reports what the filter is costing you. */
const hidden = ref(0)

function onToggle(groupKey: string, value: string) {
  const g = groups.value.find((x) => x.key === groupKey)
  if (!g) return
  const next = new Set(g.selected)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  g.selected = next
  hidden.value = groups.value.reduce((n, gg) => n + gg.selected.size, 0)
}

function onClear() {
  groups.value.forEach((g) => (g.selected = new Set()))
  hidden.value = 0
}
</script>

<template>
  <div class="g-rails">
    <div class="g-ex">
      <span class="g-variant">orientation="vertical" (default) — a filter sidebar</span>
      <FilterRail :groups="groups" :hidden-count="hidden" @toggle="onToggle" @clear="onClear" />
    </div>

    <div class="g-ex">
      <span class="g-variant">orientation="horizontal" — the same rail, same state, as a header bar</span>
      <FilterRail
        :groups="groups"
        :hidden-count="hidden"
        orientation="horizontal"
        @toggle="onToggle"
        @clear="onClear"
      />
    </div>
  </div>

  <code class="g-ex-state">
    active = {{ groups.flatMap((g) => [...g.selected]).join(', ') || '∅' }} · hidden = {{ hidden }}
  </code>
</template>
