<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import Card from '@aether/ui-kit/controls/card'
import Badge from '@aether/ui-kit/controls/badge'

/* A consumer stacks these in one column beside a Disclosure, which is why Card's padding and
   radius are Disclosure's rather than its own invention. */
const layers = 3
</script>

<template>
  <div class="g-card-col">
    <Card>
      <div class="g-card-cap">Geometry</div>
      <div>{{ layers }} layers · 10 solid boxes</div>
    </Card>

    <Card>
      <div class="g-card-cap">Verification</div>
      <div class="g-card-row">
        <Badge tone="success">142 verified</Badge>
        <Badge tone="warning">6 to review</Badge>
      </div>
    </Card>

    <!-- Static, deliberately. A consumer also ships a selectable list card — hover lift, selected
         ring, colour-coded left border — and that is a different component by the kit's own rule,
         because it differs in INTERACTION and not only in shape. -->
    <Card>
      <div class="g-card-cap">Loads &amp; supports</div>
      <div>8 supports · 166 loads · 4 supported edges</div>
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
  font-size: 12px;
  color: var(--aether-ink-soft);
  margin-bottom: 4px;
}
.g-card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
</style>
