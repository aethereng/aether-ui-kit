<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import ChatRefChip from '@aether/ui-kit/controls/chat-ref-chip'
import type { RefChipData } from '@aether/ui-kit/controls/core'

/* The chip shows what it is given. The app resolves the reference; null is "I could not", and the chip
   says so in words, with the reference it was given. A click only asks. */
const data: RefChipData = {
  value: '0.0123',
  unit: 'm',
  source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a6b7c' },
  path: 'result.max',
  provenance: 'Example provenance line.',
}
const opened = ref('none yet')
</script>

<template>
  <div class="g-ex">
    <ChatRefChip reference="r1:result.max" :data="data" @open="opened = $event" />
    <ChatRefChip reference="r9:result.missing" :data="null" @open="opened = $event" />
  </div>

  <code class="g-ex-state">open = {{ opened }}</code>
</template>
