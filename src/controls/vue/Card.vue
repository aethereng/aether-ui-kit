<script setup lang="ts">
/* A panel surface: a bordered, padded box with a background. It holds content and does nothing.
 *
 * WHY IT IS A COMPONENT AND NOT A CSS CLASS. Badge set the precedent — a <span> with no behaviour
 * is still a component here, because the alternative asks every consumer to remember a class name
 * and the tokens behind it. This is the same shape of thing: no state, no events, one slot.
 *
 * DELIBERATELY STATIC, and that is the line rather than an omission. A consumer of this kit ships
 * a selectable list card — hover lift, selected ring, a colour-coded left border, absolutely
 * positioned badges, cursor: pointer — and that is NOT this component. The kit's own rule decides
 * it: different INTERACTION means a different component, different SHAPE means a prop. A clickable
 * card is a different interaction and would drag click, disabled, selected and a keyboard contract
 * in behind it. A roomier card is only a different shape.
 *
 * WHICH IS WHY PADDING IS NOT A PROP. There is one padding here and it matches Disclosure's body
 * exactly (12px 14px), because a Card and a Disclosure are the same surface family and consumers
 * stack them in one column — mismatched insets show up as content edges that do not line up. A
 * caller wanting a roomier or denser box sets padding at the call site, the same way Seg's
 * `width: fit-content` leaves stretching to the host. A prop can arrive when a second consumer
 * actually needs a second value, rather than in anticipation of one.
 *
 * The radius is 8px rather than `var(--aether-radius)`, and that is deliberate too: the token is
 * the CONTROL radius — chips, buttons, fields — and a surface is not a control. Disclosure made
 * the same call with the same number, and the two must agree or the column looks assembled from
 * two kits. */
</script>

<template>
  <div class="aether-card"><slot /></div>
</template>

<style scoped>
/* box-sizing is stated because this sets its own padding, and the kit ships no global reset — it
   must not impose one on a host, so every component that takes up space declares its own box. */
.aether-card {
  box-sizing: border-box;
  background: var(--aether-surface);
  border: 1px solid var(--aether-line);
  border-radius: 8px;
  padding: 12px 14px;
}
</style>
