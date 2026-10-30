<script setup lang="ts">
/* One reference chip: the value an app resolved a `{{scope:path}}` token to, with the run or
 * build it came from written in the chip itself, not behind a hover. ChatPanel draws it in a
 * reply's text, and a caller's own entry may draw it too, so one component keeps those from
 * drifting.
 *
 * Every chip is a <button>. A click says "open this reference" and the app decides what that
 * means; the chip never navigates and never resolves anything. The whole text of a chip is in its
 * accessible name, and in its hover when it resolved. A click carries only the reference, so showing
 * the whole text when the chip is opened is the app's open-ref handler's job. The words come from the core's
 * `describeRef`, the same function the panel uses to announce a settled reply, so what a sighted
 * reader sees and what a screen reader is told cannot disagree.
 *
 * THE WARNING CHIP IS TOLD APART BY MORE THAN COLOUR. A reference the app could not resolve
 * carries the word "unresolved", the reference string, a warning icon and a dashed border. The
 * tone is there for people who can see it; none of the four depends on it. */
import { computed } from 'vue'
import { describeRef, UNRESOLVED_TEXT } from '../core/chat'
import type { RefChipData } from '../core/chat'

const props = defineProps<{
  /** The reference as `scope:path`; what `open` carries back. */
  reference: string
  /** What the app resolved it to, or null when it could not. */
  data: RefChipData | null
}>()

const emit = defineEmits<{
  open: [reference: string]
}>()

const text = computed(() => describeRef(props.reference, props.data))
</script>

<template>
  <button
    type="button"
    class="aether-chat-chip"
    :class="{ 'aether-chat-chip--unresolved': !text.resolved }"
    :aria-label="text.name"
    :title="text.resolved ? text.hover : undefined"
    @click="emit('open', reference)"
  >
    <template v-if="text.resolved"
      ><span class="aether-chat-chip__quantity">{{ text.quantity }}</span
      ><template v-if="text.tag"
        >{{ ' · ' }}<span class="aether-chat-chip__tag">{{ text.tag }}</span></template
      ></template
    >
    <template v-else
      ><svg
        class="aether-chat-chip__icon"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 1.8 15 14H1z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <path d="M8 6.2v3.6M8 11.7v.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg
      ><span class="aether-chat-chip__word">{{ UNRESOLVED_TEXT }}</span
      >{{ ' ' }}<span class="aether-chat-chip__ref">{{ reference }}</span></template
    >
  </button>
</template>

<style scoped>
/* box-sizing is stated because this sets its own padding and border, and the kit ships no
   global reset. inline-block, because a flex container drops the whitespace-only text between its
   items. */
.aether-chat-chip {
  box-sizing: border-box;
  display: inline-block;
  max-width: 100%;
  margin: 0;
  padding: 0 6px;
  border: 1px solid var(--aether-line-strong);
  border-radius: var(--aether-radius);
  background: var(--aether-surface);
  color: var(--aether-ink);
  font-family: var(--aether-font-mono);
  font-size: 0.92em;
  line-height: 1.5;
  text-align: left;
  /* a long path or hash wraps inside the chip rather than pushing the log sideways */
  overflow-wrap: anywhere;
  cursor: pointer;
}
.aether-chat-chip:hover {
  background: var(--aether-panel);
}
/* Own focus ring rather than the shared one in ui-kit.css: scoping adds an attribute selector to
   these rules, so a global ring would lose the specificity contest against them. */
.aether-chat-chip:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 1px;
}
.aether-chat-chip__quantity {
  font-weight: 600;
}
/* The tag is the provenance of the number beside it and the smallest text on the chip, so it takes
   --aether-ink-soft, the stronger of the two quiet greys. */
.aether-chat-chip__tag {
  color: var(--aether-ink-soft);
}

/* Unresolved: dashed where the value chip is solid, a warning icon and a word where the value chip
   has a number. The tone carries the border and the icon only; the text stays --aether-ink, the
   same rule Callout follows, because the warm tone on a panel measures under the small-text floor. */
.aether-chat-chip--unresolved {
  border-style: dashed;
  border-color: var(--aether-tone-warning);
  background: var(--aether-tone-warning-wash);
}
.aether-chat-chip--unresolved:hover {
  background: var(--aether-panel);
}
.aether-chat-chip__icon {
  margin-right: 4px;
  vertical-align: -1px;
  color: var(--aether-tone-warning);
}
.aether-chat-chip__word {
  font-weight: 700;
}
.aether-chat-chip__ref {
  color: var(--aether-ink-soft);
}
</style>
