<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Disclosure from '@aether/ui-kit/controls/disclosure'

/* Controlled, like Graph2D/Gantt/Transport: the caller owns `open`, and `v-model:open` is the
   binding. One ref per panel here rather than none, because a real consumer usually keys open-state
   by row — an id, a filename — and often persists it, which a self-managing panel cannot express.

   Why this is not a <details>/<summary>, which would have given the keyboard and screen-reader
   contract for free: everything after a <summary> is hidden while the panel is CLOSED, so a header
   control that must stay reachable when collapsed cannot live there — and nesting it inside the
   <summary> instead flattens it in the accessibility tree. The `#aside` slot below is that case,
   and it is the reason this component owns its header row. */
const options = ref(true)
const limits = ref(false)
const diagnostics = ref(false)
</script>

<template>
  <div class="g-ex g-ex--full">
    <span class="g-variant">label + meta — the meta line says what is inside, so collapsing it does
      not hide that it exists</span>
    <Disclosure v-model:open="options" label="Advanced options" meta="4 set · 2 left at default">
      <p>
        Anything can go in the region — a form, a table, a chart. The panel measures nothing and
        lays out nothing inside it; it only shows and hides.
      </p>
    </Disclosure>
  </div>

  <div class="g-ex g-ex--full">
    <span class="g-variant">#aside — a header control that stays reachable while COLLAPSED, and is
      its own tab stop rather than nested inside the toggle</span>
    <Disclosure v-model:open="limits" label="Rate limits" meta="inherited from the parent policy">
      <template #aside>
        <a class="g-aside-link" href="#disclosure" @click.prevent>Docs ↗</a>
      </template>
      <p>
        Tab from the toggle and focus lands on the link, not past it. Shut the panel and the link is
        still there — that is the whole reason this is a button and a region rather than a
        &lt;details&gt;.
      </p>
    </Disclosure>
  </div>

  <div class="g-ex g-ex--full">
    <span class="g-variant">disabled — the toggle emits nothing; `open` still says what the region
      does</span>
    <Disclosure v-model:open="diagnostics" label="Diagnostics" meta="nothing to show yet" disabled>
      <p>Unreachable while disabled.</p>
    </Disclosure>
  </div>

  <p class="g-hint">
    Collapsed panels are hidden with <code>hidden="until-found"</code>, not
    <code>display: none</code> — so the browser's find-in-page still reaches the text inside a
    closed one and fires <code>beforematch</code>, which the component turns into
    <code>update:open</code>. Try Ctrl+F for “measures” with the first panel shut.
  </p>
</template>

<style scoped>
/* The aside is the caller's markup, so the caller styles it — the kit ships no link appearance. */
.g-aside-link {
  flex: none;
  color: var(--aether-cool);
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
}
.g-aside-link:hover {
  text-decoration: underline;
}
</style>
