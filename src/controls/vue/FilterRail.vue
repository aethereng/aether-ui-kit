<script setup lang="ts" generic="V extends string = string">
/* Thin wrapper over the shared Chip primitive: a labelled rail of toggle-chip
 * groups with a clear-all and an optional hidden-count. Grouping + selection are
 * pure data (FilterGroup[]); this component renders one Chip row per group and
 * wires toggle/clear mechanically. Domain semantics (what a group means, what a
 * dot color encodes) stay with the caller — same discipline as Chip itself. */
import Chip from './Chip.vue'
import type { FilterGroup } from '../core/types'

defineProps<{
  groups: FilterGroup<V>[]
  hiddenCount?: number
  clearLabel?: string
}>()

const emit = defineEmits<{
  toggle: [groupKey: string, value: V]
  clear: []
}>()

function anyActive(groups: FilterGroup<V>[]): boolean {
  return groups.some((g) => g.selected.size > 0)
}
</script>

<template>
  <aside class="aether-rail" :aria-label="'Filters'">
    <section v-for="g in groups" :key="g.key" class="aether-rail__group">
      <h4 class="aether-rail__label">{{ g.label }}</h4>
      <Chip
        :options="g.options"
        :model-value="g.selected"
        :aria-label="g.label"
        @toggle="(v: V) => emit('toggle', g.key, v)"
      />
    </section>
    <div v-if="anyActive(groups) || hiddenCount" class="aether-rail__foot">
      <button
        v-if="anyActive(groups)"
        class="aether-rail__clear"
        type="button"
        @click="emit('clear')"
      >
        {{ clearLabel ?? 'clear' }}
      </button>
      <span v-if="hiddenCount" class="aether-rail__say">
        <b>{{ hiddenCount }}</b> hidden
      </span>
    </div>
  </aside>
</template>

<style scoped>
.aether-rail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.aether-rail__label {
  font:
    700 9.5px/1 ui-monospace,
    monospace;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--aether-faint);
  margin: 0 0 9px;
}
.aether-rail__foot {
  display: flex;
  align-items: center;
  gap: 10px;
}
.aether-rail__clear {
  border: 0;
  background: transparent;
  color: var(--aether-cool);
  font:
    600 11px/1 ui-monospace,
    monospace;
  cursor: pointer;
  padding: 2px 0;
}
.aether-rail__clear:hover {
  text-decoration: underline;
}
.aether-rail__say {
  font:
    500 11px/1 ui-monospace,
    monospace;
  color: var(--aether-faint);
}
</style>
