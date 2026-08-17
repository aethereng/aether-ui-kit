<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Toast from '@aether/ui-kit/controls/toast'
import Tool from '@aether/ui-kit/controls/tool'

/* Controlled, like the rest of the kit: the caller owns the message. A non-empty string shows the
   toast; the component clears it by emitting an update, so this ref stays the single source of
   truth — which also means a host can dismiss early by setting ''. */
const toast = ref('')

/* Not a queue. A second message while one is up replaces it and restarts the timer, which is what
   you want for "Copied" / "Queued" / "Saved". Click the buttons in quick succession to see it. */
function say(msg: string) {
  toast.value = msg
}
</script>

<template>
  <div class="g-ex g-ex--tile">
    <span class="g-variant">default duration (1700ms)</span>
    <Tool label="Copied" @click="say('Copied to clipboard')" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">a second message replaces the first and restarts the timer</span>
    <Tool label="Saved" @click="say('Saved')" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">dismiss early by setting the model to ''</span>
    <Tool label="Dismiss now" danger :disabled="!toast" @click="toast = ''" />
  </div>

  <!-- Fixed bottom-centre and pointer-events:none, so it never blocks what is under it. -->
  <Toast v-model="toast" />

  <code class="g-ex-state">
    modelValue = {{ toast ? '"' + toast + '"' : "'' (hidden)" }}
  </code>
</template>
