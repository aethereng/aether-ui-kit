<script setup lang="ts">
/* A persistent, toned block of prose: a severity, an optional title, and a body.
 *
 * WHY NOT A CARD. A Card is a neutral surface that says nothing about what it holds. A Callout's
 * whole job is to say "this one is different, and here is how" — which is a claim about meaning,
 * not about layout, and it has to survive being read aloud and being printed. A screen reader
 * given a Card hears a plain box; the colour that makes a failure legible to a sighted reader is
 * not information it has at all.
 *
 * WHY NOT A TOAST. Toast is transient, fixed-position and auto-dismisses at 1700ms, and it carries
 * no tone. This is the opposite on every axis: it sits in the document flow, stays, and prints.
 *
 * THE SEVERITY IS TEXT, NOT ONLY COLOUR. Every callout renders a visually-hidden severity word
 * before its content, so "Danger" and "Note" differ in the accessibility tree and not merely in
 * hue. That is the part a Card cannot substitute for, and it is also the part that survives a
 * greyscale print — the left border carries weight but the word carries the meaning.
 *
 * NOT A LIVE REGION BY DEFAULT. `role="note"` is the resting state, because the case this was
 * built for is a verification report where five of these are present on first paint; announcing
 * each one assertively as it renders would make the document unusable. A caller rendering a
 * callout in RESPONSE to something sets `live`, which promotes it to `alert` for the two tones
 * that stop you and `status` for the two that do not. Same reasoning Badge records for not
 * defaulting to role="status".
 *
 * TONE NAMES MATCH BADGE. success / warning / danger are Badge's existing union, and `info` is the
 * addition. A kit that says `danger` in one component and `error` in another has standardised
 * nothing. */

type Tone = 'info' | 'success' | 'warning' | 'danger'

withDefaults(
  defineProps<{
    /** info is the default and the quiet one; danger and warning are meant to stop you. */
    tone?: Tone
    /** Optional heading. The body reads as prose without one. */
    title?: string
    /**
     * Promote to a live region, for a callout that appears in response to an action rather than
     * being present when the document is first read.
     */
    live?: boolean
  }>(),
  { tone: 'info', title: undefined, live: false },
)

/* The word a screen reader hears, and the only place the severity exists as text. "Note" rather
   than "Info" because it is read aloud as a sentence opener. */
const SEVERITY: Record<Tone, string> = {
  info: 'Note',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
}
</script>

<template>
  <div
    class="aether-callout"
    :class="`tone-${tone}`"
    :role="live ? (tone === 'danger' || tone === 'warning' ? 'alert' : 'status') : 'note'"
    :aria-live="live ? (tone === 'danger' || tone === 'warning' ? 'assertive' : 'polite') : undefined"
  >
    <span class="aether-callout-severity">{{ SEVERITY[tone] }}:</span>
    <p v-if="title" class="aether-callout-title">{{ title }}</p>
    <div class="aether-callout-body"><slot /></div>
  </div>
</template>

<style scoped>
/* box-sizing is stated because this sets its own padding and the kit ships no global reset — the
   same reason Card declares it. */
.aether-callout {
  box-sizing: border-box;
  /* Containing block for the clipped severity span below. Without it that span positions against
     whatever ancestor happens to be positioned, and a 1px absolutely-positioned element in a
     scroll container can extend its scroll extent — a bug that would surface far from here. */
  position: relative;
  background: var(--tone-wash);
  /* The left border is the visual weight. A full border in the tone reads as a filled alert and
     competes with Card in a stacked column; a rule on one edge marks it without restyling the
     surface family. */
  border-left: 3px solid var(--tone-ink);
  /* Matches Card and Disclosure. A callout sits in the same column as both and mismatched insets
     show up as content edges that do not line up. */
  border-radius: var(--aether-radius-surface);
  padding: 12px 14px;
  color: var(--aether-ink);
}

/* Body text stays --aether-ink rather than the tone. Tinting prose to the severity is what drove
   --aether-warm-ink into existence: --aether-warm on --aether-panel measures 3.83, under the 4.5
   floor for small text, and a host that inverts the hue for a dark theme moves the ratio again.
   Only the title and the border carry the tone, and the title is large enough for the 3:1 rule. */
.aether-callout-title {
  margin: 0 0 4px;
  font-weight: 600;
  color: var(--tone-ink);
}

.aether-callout-body {
  /* A body of plain text needs no wrapper margin; a body of <p>s brings its own. Collapsing the
     first and last keeps both callers looking the same. */
  margin: 0;
}
.aether-callout-body :deep(> :first-child) {
  margin-top: 0;
}
.aether-callout-body :deep(> :last-child) {
  margin-bottom: 0;
}

/* Visually hidden, but present for a screen reader AND for a text-only rendering. NOT
   `display: none` or `visibility: hidden`, both of which remove it from the accessibility tree —
   which would delete the one thing that distinguishes a failure from a note without colour. */
.aether-callout-severity {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.tone-info {
  --tone-ink: var(--aether-tone-info);
  --tone-wash: var(--aether-tone-info-wash);
}
.tone-success {
  --tone-ink: var(--aether-tone-success);
  --tone-wash: var(--aether-tone-success-wash);
}
.tone-warning {
  --tone-ink: var(--aether-tone-warning);
  --tone-wash: var(--aether-tone-warning-wash);
}
.tone-danger {
  --tone-ink: var(--aether-tone-danger);
  --tone-wash: var(--aether-tone-danger-wash);
}

/* PRINTABLE, which is a requirement rather than a nicety: the report this was built for is handed
   to a client as a document. Backgrounds are commonly dropped by print settings, so the border is
   forced to print — without it a danger callout and a note become the same grey block. */
@media print {
  .aether-callout {
    border-left-width: 4px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    /* Never split a verdict across a page boundary. */
    break-inside: avoid;
  }
}
</style>
