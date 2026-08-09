<script setup lang="ts" generic="V extends string = string">
/* Thin wrapper over the shared Chip primitive: a labelled rail of toggle-chip
 * groups with a clear-all and an optional hidden-count. Grouping + selection are
 * pure data (FilterGroup[]); this component renders one Chip row per group and
 * wires toggle/clear mechanically. Domain semantics (what a group means, what a
 * dot color encodes) stay with the caller — same discipline as Chip itself. */
import Chip from './Chip.vue'
import type { FilterGroup } from '../core/types'

withDefaults(
  defineProps<{
    groups: FilterGroup<V>[]
    hiddenCount?: number
    clearLabel?: string
    /** 'vertical' stacks groups down a sidebar (label above its chips); 'horizontal' lays
     *  them along a bar (label inline before its chips). The mechanics are identical —
     *  this is the layout axis these surfaces genuinely differ on, not two components. */
    orientation?: 'vertical' | 'horizontal'
  }>(),
  { orientation: 'vertical', hiddenCount: 0, clearLabel: 'clear' },
)

const emit = defineEmits<{
  toggle: [groupKey: string, value: V]
  clear: []
}>()

function anyActive(groups: FilterGroup<V>[]): boolean {
  return groups.some((g) => g.selected.size > 0)
}
</script>

<template>
  <aside
    class="aether-rail"
    :class="'aether-rail--' + orientation"
    :aria-label="'Filters'"
  >
    <section v-for="g in groups" :key="g.key" class="aether-rail__group">
      <h4 class="aether-rail__label">{{ g.label }}</h4>
      <Chip
        :options="g.options"
        :model-value="g.selected"
        :variant="orientation === 'vertical' ? 'row' : 'pill'"
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
        {{ clearLabel }}
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
}
/* sidebar: groups stack, label sits above its chips */
.aether-rail--vertical {
  flex-direction: column;
  gap: 18px;
}
/* bar: groups run inline, label sits before its chips, and the whole thing wraps
   rather than overflowing a header */
.aether-rail--horizontal {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.aether-rail--horizontal .aether-rail__group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.aether-rail--horizontal .aether-rail__label {
  margin: 0;
}
.aether-rail--horizontal .aether-rail__foot {
  margin-left: auto;
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
