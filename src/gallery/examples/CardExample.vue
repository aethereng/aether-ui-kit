<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import Card from '@aether/ui-kit/controls/card'
import Spinner from '@aether/ui-kit/controls/spinner'
import Badge from '@aether/ui-kit/controls/badge'

/* Both real consumers stack these in one column beside a Disclosure, which is why Card's padding
   and radius are Disclosure's rather than its own invention. */
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
      <!-- No label: the text beside it already says what is happening, and naming the spinner too
           would have a screen reader read the same state twice. -->
      <div class="g-card-row">
        <Spinner :size="14" />
        <span>verifying 1564 members…</span>
      </div>
    </Card>

    <Card>
      <div class="g-card-cap">Connections</div>
      <!-- Labelled: nothing beside it says anything, so unnamed it would be invisible to a screen
           reader and the panel would read as idle. -->
      <div class="g-card-row">
        <Spinner :size="16" label="Deriving connections" />
        <Badge tone="neutral">deriving</Badge>
      </div>
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
