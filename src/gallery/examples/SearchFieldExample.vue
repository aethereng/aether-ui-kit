<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref, useTemplateRef } from 'vue'
import SearchField from '@aether/ui-kit/controls/search-field'

const query = ref('')
const cleared = ref(0)

/* focus() is exposed through a template ref, for the '/' shortcut a host usually wants. Shown
   because an exposed method nobody demonstrates is an exposed method nobody knows about. */
const field = useTemplateRef<InstanceType<typeof SearchField>>('field')
</script>

<template>
  <div class="g-ex">
    <span class="g-variant">v-model, with a clear button that appears once there is text</span>
    <SearchField
      ref="field"
      v-model="query"
      placeholder="Search titles, paths, tags…"
      @clear="cleared++"
    />
  </div>

  <div class="g-ex">
    <span class="g-variant">focus() via a template ref</span>
    <button class="g-mini" type="button" @click="field?.focus()">Focus the field</button>
  </div>

  <code class="g-ex-state">
    query = {{ query ? '"' + query + '"' : '∅' }} · cleared {{ cleared }}×
  </code>
</template>
