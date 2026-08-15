<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import Badge from '@aether/ui-kit/controls/badge'

/* The kit maps tone -> pixels and stops there. Mapping a domain state onto a tone is the caller's
   job, and it looks like this — a lookup that lives in the host, where the vocabulary means
   something. A `status` prop on Badge that understood these words would put a stiffness matrix's
   vocabulary inside a design system. */
type Solve = 'converged' | 'singular' | 'stalled' | 'queued'
const toneOf: Record<Solve, 'success' | 'warning' | 'danger' | 'neutral'> = {
  converged: 'success',
  stalled: 'warning',
  singular: 'danger',
  queued: 'neutral',
}
const solves: Solve[] = ['converged', 'stalled', 'singular', 'queued']

/* A row of badges has no shared state and no active member, so there is nothing to model and no
   group component — the row is a flex container the caller owns. Same reasoning as
   `.aether-button-group`. */
const counts = [
  { label: 'Nodes 4 812', tone: 'neutral' as const },
  { label: 'Elements 9 240', tone: 'neutral' as const },
  { label: 'Materials 12', tone: 'neutral' as const },
  { label: 'Unassigned 3', tone: 'warning' as const },
]
</script>

<template>
  <div class="g-badge-rows">
    <div class="g-badge-row">
      <Badge>neutral</Badge>
      <Badge tone="success">success</Badge>
      <Badge tone="warning">warning</Badge>
      <Badge tone="danger">danger</Badge>
    </div>

    <!-- Six-in-a-row is why neutral is the quiet one: filled pills all the way across read as a
         wall of alarms, and the exception stops standing out. -->
    <div class="g-badge-row">
      <Badge v-for="c in counts" :key="c.label" :tone="c.tone">{{ c.label }}</Badge>
    </div>

    <!-- Domain -> tone, resolved by the caller. -->
    <div class="g-badge-row">
      <Badge v-for="s in solves" :key="s" :tone="toneOf[s]">{{ s }}</Badge>
    </div>
  </div>
</template>

<style scoped>
.g-badge-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.g-badge-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
</style>
