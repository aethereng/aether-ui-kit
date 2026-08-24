<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import Callout from '@aether/ui-kit/controls/callout'

/* Same division of labour Badge documents: the kit maps a tone to pixels and to an accessible
   severity word, and the caller decides which tone a domain state deserves. The difference is
   that a Callout also has to survive being read aloud and being printed, so the severity is text
   in the accessibility tree rather than only a colour. */
type Verdict = 'pass' | 'near-limit' | 'fail'
const toneOf: Record<Verdict, 'success' | 'warning' | 'danger'> = {
  pass: 'success',
  'near-limit': 'warning',
  fail: 'danger',
}
const checks: { verdict: Verdict; title: string; note: string }[] = [
  {
    verdict: 'pass',
    title: 'Cross-section resistance',
    note: 'Utilisation 0.62 against the governing interaction. Within limits.',
  },
  {
    verdict: 'near-limit',
    title: 'Lateral-torsional buckling',
    note: 'Utilisation 0.97. Inside the limit, but a change in restraint spacing would move it out.',
  },
  {
    verdict: 'fail',
    title: 'Code family mismatch',
    note: 'An EC3 check was evaluated on US forces. No verdict is returned rather than a wrong one.',
  },
]
</script>

<template>
  <div class="g-callout-rows">
    <Callout>The four tones, at rest. This one is <code>info</code> — the default and the quiet one.</Callout>

    <!-- Domain -> tone, resolved by the caller. -->
    <Callout v-for="c in checks" :key="c.title" :tone="toneOf[c.verdict]" :title="c.title">
      {{ c.note }}
    </Callout>

    <!-- The reason this is not a Toast. It stays, it prints, and it holds prose rather than a
         line of text. -->
    <Callout tone="warning" title="Withheld from published coverage">
      <p>
        Composite checks are built and exercised, and are not part of what this release claims. A
        check that has not been benchmarked is a check the firm does not claim.
      </p>
      <p>The registry is the ceiling; this note is the reason for it.</p>
    </Callout>
  </div>
</template>

<style scoped>
.g-callout-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.g-callout-rows :deep(p) {
  margin: 0 0 8px;
}
</style>
