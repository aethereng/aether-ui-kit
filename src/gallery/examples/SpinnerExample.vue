<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import Spinner from '@aether/ui-kit/controls/spinner'
import Badge from '@aether/ui-kit/controls/badge'
</script>

<template>
  <div class="g-sp">
    <!-- No label: the text beside it already says what is happening, and naming the spinner too
         would have a screen reader read the same state twice in two vocabularies. -->
    <div class="g-sp-row">
      <Spinner :size="14" />
      <span>analysing 1,284 samples…</span>
    </div>

    <!-- Labelled: nothing else here says anything, so unnamed it would be invisible to a screen
         reader and the panel would read as idle. -->
    <div class="g-sp-row">
      <Spinner :size="16" label="Indexing results" />
      <Badge tone="neutral">indexing</Badge>
    </div>

    <!-- The stroke is derived from the size and rounded to a whole pixel: unrounded, size/8 gives
         1.75px at 14 and a browser floors a sub-pixel border, so one ring drew thinner than its
         neighbour for no reason a reader could see. -->
    <div class="g-sp-row">
      <Spinner :size="14" />
      <Spinner :size="16" />
      <Spinner :size="24" />
      <Spinner :size="32" />
      <span class="g-sp-note">14 · 16 · 24 · 32</span>
    </div>
  </div>
</template>

<style scoped>
.g-sp {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
}
.g-sp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.g-sp-note {
  font-size: 12px;
  color: var(--aether-faint);
}
</style>
