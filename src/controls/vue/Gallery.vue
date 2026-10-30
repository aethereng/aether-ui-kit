<script setup lang="ts">
/* A gallery of samples: one section per family, each a heading and a grid of cards, a card a button
 * with a picture, a title, a line and a foot.
 *
 * The page around it stays the app's: its head, whether it scrolls as a page or as a layer, what closes
 * it, and any way in that is not a sample. So does the data. The app gives `picture` as the address for
 * the theme in force, and it is told which item was opened.
 *
 * THE CARD IS THE LIST ITEM AND THE BUTTON IS INSIDE IT, so a `note` can sit beside the button as plain
 * text a reader can select. The inner parts carry `aether-gallery__*` classes for an app that sets a
 * card differently, and the picture stands on `--aether-gallery-ground`, the colour it was taken on. */
import { computed, useId } from 'vue'
import { gallerySections, type GalleryFamily, type GalleryItem } from '../core/gallery'
import Icon from './Icon.vue'

const props = defineProps<{
  /** The sections, in their order. A family with no items is left out. */
  families: readonly GalleryFamily[]
  items: readonly GalleryItem[]
}>()

defineEmits<{ open: [id: string] }>()

const uid = useId()
const sections = computed(() => gallerySections(props.families, props.items))
</script>

<template>
  <div class="aether-gallery">
    <section v-for="s in sections" :key="s.id" class="aether-gallery__family" :aria-labelledby="`${uid}-${s.id}`" :data-family="s.id">
      <div class="aether-gallery__head">
        <h3 :id="`${uid}-${s.id}`" class="aether-gallery__heading">{{ s.title }}</h3>
        <p v-if="s.line" class="aether-gallery__line">{{ s.line }}</p>
      </div>
      <ul class="aether-gallery__grid">
        <li v-for="c in s.items" :key="c.id" class="aether-gallery__card" :style="{ '--place': c.place }" :data-card="c.id">
          <button type="button" class="aether-gallery__open" @click="$emit('open', c.id)">
            <span v-if="c.picture" class="aether-gallery__media">
              <img class="aether-gallery__picture" :src="c.picture" alt="" width="800" height="500" loading="lazy" decoding="async" />
            </span>
            <span v-else-if="c.icon" class="aether-gallery__media aether-gallery__media--icon">
              <Icon :path="c.icon" class="aether-gallery__icon" />
            </span>
            <span class="aether-gallery__body">
              <span class="aether-gallery__title">{{ c.title }}</span>
              <span v-if="c.line" class="aether-gallery__text">{{ c.line }}</span>
              <span v-if="c.foot" class="aether-gallery__foot" data-card-foot>
                <Icon v-if="c.footIcon" :path="c.footIcon" class="aether-gallery__foot-icon" />
                <span>{{ c.foot }}</span>
              </span>
            </span>
          </button>
          <p v-if="c.note" class="aether-gallery__note" data-card-note>
            <strong>{{ c.note.label }}.</strong> {{ c.note.text }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.aether-gallery__family {
  margin-top: 30px;
}
.aether-gallery__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--aether-line);
}
.aether-gallery__heading {
  margin: 0;
  font-size: var(--aether-text-sm);
  font-weight: var(--aether-weight-strong);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--aether-faint);
}
.aether-gallery__line {
  margin: 0;
  font-size: 0.84rem;
  color: var(--aether-faint);
}
.aether-gallery__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}
.aether-gallery__card {
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--aether-line);
  background: var(--aether-surface);
  overflow: hidden;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}
.aether-gallery__card:hover,
.aether-gallery__card:focus-within {
  transform: translateY(-3px);
  border-color: var(--aether-cool-soft);
}
.aether-gallery__open {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border: 0;
  background: none;
}
.aether-gallery__open:focus-visible {
  outline: 2px solid var(--aether-cool-soft);
  outline-offset: -2px;
}
/* box-sizing is stated because the ratio holds its border, and the kit ships no global reset. */
.aether-gallery__media {
  box-sizing: border-box;
  display: block;
  aspect-ratio: 8 / 5;
  overflow: hidden;
  background: var(--aether-gallery-ground);
  border-bottom: 1px solid var(--aether-line);
}
.aether-gallery__media--icon {
  display: grid;
  place-items: center;
}
.aether-gallery__icon {
  font-size: 56px;
  color: var(--aether-warm);
}
.aether-gallery__picture {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.aether-gallery__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px 14px;
}
.aether-gallery__title {
  font-weight: 600;
  font-size: 0.98rem;
  line-height: 1.3;
}
.aether-gallery__text {
  font-size: 0.84rem;
  line-height: 1.45;
}
/* pushed to the card's foot, so the rows of a section line up */
.aether-gallery__foot {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: auto;
  padding-top: 6px;
  font-family: var(--aether-font-mono);
  font-size: 0.76rem;
  line-height: 1.4;
  color: var(--aether-faint);
}
.aether-gallery__foot-icon {
  flex: none;
  margin-top: 1px;
}
.aether-gallery__note {
  margin: 0;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--aether-line);
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--aether-faint);
}
.aether-gallery__note strong {
  color: var(--aether-ink);
  font-weight: 600;
}
/* On arrival each card rises into place in turn. `backwards` holds a card at the keyframe it rises from
   while it waits its turn and lets go at the end: `both` would hold the last keyframe's transform for
   good, and an animation's value outranks the lift a card takes on hover. */
@keyframes aether-gallery-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .aether-gallery__card {
    animation: aether-gallery-rise 0.45s ease backwards;
    animation-delay: calc(var(--place, 0) * 35ms);
  }
}
@media (prefers-reduced-motion: reduce) {
  .aether-gallery__card {
    transition: none;
  }
  .aether-gallery__card:hover,
  .aether-gallery__card:focus-within {
    transform: none;
  }
}
/* A phone keeps one column, with the pictures cut to 16:9 so a screen shows more of the list. The line
   is never cut. */
@media (max-width: 719.98px) {
  .aether-gallery__grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .aether-gallery__media {
    aspect-ratio: 16 / 9;
  }
}
</style>
