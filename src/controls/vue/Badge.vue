<script setup lang="ts">
/* A static status marker. Deliberately NOT a Chip: Chip is a <button> with click, disabled and an
 * emit, and you cannot prop your way out of button semantics — a marker that announces itself as a
 * control is worse than a wrong colour. This is a <span> and it does nothing.
 *
 * The kit maps tone -> pixels. It does NOT map domain -> tone. A caller with `singular`,
 * `stabilized` or `verified` resolves those to a tone itself, exactly as it resolves a unit before
 * handing over a `suffix`: `singular` means something in a stiffness matrix and nothing in a design
 * system.
 *
 * No icon, no count, no close, no size axis. Each of those has a real component behind it already
 * or no call site yet. */

withDefaults(
  defineProps<{
    /** neutral is the default and the quiet one; the three semantic tones are meant to be seen. */
    tone?: 'neutral' | 'success' | 'warning' | 'danger'
  }>(),
  { tone: 'neutral' },
)

/* No role="status". Most badges are static, and a live region on a count that never changes makes a
   screen reader announce furniture. A caller whose badge DOES change — a solve result landing —
   owns that, by wrapping it in its own live region where it knows the update is worth speaking. */
</script>

<template>
  <span :class="['aether-badge', 'aether-badge--' + tone]"><slot /></span>
</template>

<style scoped>
/* Filled, and that is a contrast decision rather than a stylistic one.

   A tonal badge — tone-coloured text on the page's own ground — cannot be made to pass. Measured
   against the shipped palette, `--aether-warm` on `--aether-panel` is 3.83, under the 4.5 floor,
   and tinting the background toward the text colour only makes it worse. Painting its own ground
   fixes it by construction: the ratio becomes tone-vs-`--aether-warm-ink`, which no longer depends
   on what the badge is sitting on. That is also the answer to the same badge shipping into two host
   palettes with different surfaces — there is nothing left for the surface to break.

   `--aether-warm-ink` rather than a literal white for the same reason it exists on the filled Tool:
   a host inverting these tones for a dark theme moves the foreground with them. */
.aether-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 1px 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  line-height: 1.6;
  white-space: nowrap;
  /* A marker is not a selection. */
  user-select: none;
}

/* Neutral stays quiet: it is the one that appears six-in-a-row, and six filled pills read as six
   alarms. Panel + ink-soft measures 6.21, so quiet is not the same as unreadable. */
.aether-badge--neutral {
  background: var(--aether-panel);
  border-color: var(--aether-line-strong);
  color: var(--aether-ink-soft);
}
.aether-badge--success {
  background: var(--aether-ok);
  color: var(--aether-warm-ink);
}
.aether-badge--warning {
  background: var(--aether-warm);
  color: var(--aether-warm-ink);
}
.aether-badge--danger {
  background: var(--aether-rose);
  color: var(--aether-warm-ink);
}
</style>
