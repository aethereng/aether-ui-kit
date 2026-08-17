<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import Card from '@aether/ui-kit/controls/card'
import Badge from '@aether/ui-kit/controls/badge'

const channels = 12
</script>

<template>
  <div class="g-card-col">
    <Card>
      <div class="g-card-cap">Reactor 3</div>
      <div class="g-card-figs">
        <span><b>42.6</b> °C</span>
        <span><b>1.8</b> bar</span>
        <span><b>2.4</b> L/min</span>
      </div>
    </Card>

    <Card>
      <div class="g-card-cap">Run 214</div>
      <div class="g-card-row">
        <Badge tone="success">142 passed</Badge>
        <Badge tone="warning">6 to review</Badge>
        <Badge tone="danger">1 failed</Badge>
      </div>
    </Card>

    <!-- Static, deliberately: a clickable card differs in INTERACTION, not only in shape, and
         would bring click, disabled, selected and a keyboard contract in behind it. -->
    <Card>
      <div class="g-card-cap">Acquisition</div>
      <div>{{ channels }} channels · 10 Hz · 4 h 12 m elapsed</div>
    </Card>
  </div>
</template>

<style scoped>
.g-card-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 320px;
}
.g-card-cap {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  margin-bottom: 5px;
}
.g-card-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
/* Tabular figures so three readings line up as a row of numbers rather than three phrases. */
.g-card-figs {
  display: flex;
  gap: 14px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--aether-ink-soft);
}
.g-card-figs b {
  color: var(--aether-ink);
  font-weight: 650;
}
</style>
