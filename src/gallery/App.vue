<script setup lang="ts">
/* @aether/ui-kit gallery.
 *
 * This page is also the kit's own proof: it is a HOST APP. It defines the --aether-* tokens
 * itself (light + dark below) and the kit's components follow, which is exactly the contract
 * a consumer gets. The theme switch at the top is not a mock — it re-themes this page, and the
 * components re-theme with it because they never hardcode a colour. */
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import GSection from './GSection.vue'
/* The nav's two buttons are the kit's own Tool. This page is the kit's proof, so its chrome
 * should be built from it: a hand-rolled <button> here would mean a Tool regression could not
 * show up on the page that documents Tool. It also makes the two the same height on every
 * pointer type by construction, including the 44px coarse floor. */
import Tool from '@aether/ui-kit/controls/tool'
import { COMPONENTS, GROUPS, byGroup, type Group } from './meta'
/* Examples live in their own files so the gallery can RENDER one and DISPLAY its source from the
 * same bytes -- see GSection's `source` prop. `?raw` is Vite giving us the file as a string. */
import SegExample from './examples/SegExample.vue'
import SegExampleSrc from './examples/SegExample.vue?raw'
import ChipExample from './examples/ChipExample.vue'
import ChipExampleSrc from './examples/ChipExample.vue?raw'
import ToolExample from './examples/ToolExample.vue'
import ToolExampleSrc from './examples/ToolExample.vue?raw'
import SearchFieldExample from './examples/SearchFieldExample.vue'
import SearchFieldExampleSrc from './examples/SearchFieldExample.vue?raw'
import FilterRailExample from './examples/FilterRailExample.vue'
import FilterRailExampleSrc from './examples/FilterRailExample.vue?raw'
import ChatPanelExample from './examples/ChatPanelExample.vue'
import ChatPanelExampleSrc from './examples/ChatPanelExample.vue?raw'
import ToastExample from './examples/ToastExample.vue'
import ToastExampleSrc from './examples/ToastExample.vue?raw'
import TransportExample from './examples/TransportExample.vue'
import TransportExampleSrc from './examples/TransportExample.vue?raw'
import PropertyEditorExample from './examples/PropertyEditorExample.vue'
import PropertyEditorExampleSrc from './examples/PropertyEditorExample.vue?raw'
import Graph2DExample from './examples/Graph2DExample.vue'
import Graph2DExampleSrc from './examples/Graph2DExample.vue?raw'
import GanttExample from './examples/GanttExample.vue'
import GanttExampleSrc from './examples/GanttExample.vue?raw'



/* ── page theme — the kit's token contract, demonstrated rather than described ── */
const THEME_KEY = 'aether-theme'
const theme = ref<'paper' | 'timber'>('paper')
function applyTheme(t: 'paper' | 'timber') {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* private mode — the switch still works for this session */
  }
}
onMounted(() => {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(THEME_KEY)
  } catch {
    /* ignore */
  }
  applyTheme(saved === 'timber' ? 'timber' : 'paper')
})

const KIT_VERSION = __KIT_VERSION__

/* ── stats: derived, never hand-counted, so they cannot go stale ── */
const stats = computed(() => ({
  components: COMPONENTS.length,
  cores: COMPONENTS.filter((c) => c.core).length,
  props: COMPONENTS.reduce((n, c) => n + c.props.length, 0),
}))

/* The component rail. Open state only matters below the dock breakpoint, where it is a
   sheet; above it the rail is permanently docked and this flag is inert. */
const railOpen = ref(false)
function onRailKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && railOpen.value) railOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onRailKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onRailKey))

const groupAnchor = (g: Group) => g.toLowerCase()
</script>

<template>
  <a class="g-skip" href="#controls">Skip to components</a>

  <!-- The bar holds three things and only ever three: brand, the rail trigger, the theme
       switch. The component links used to live here too, and there is no width at which that
       works -- 10 components already overflowed a 1265px desktop by 89px, clipping Graph2D
       and Gantt behind a deliberately hidden scrollbar, and the list grows with every
       component added. They live in the rail below now. -->
  <nav class="g-nav">
    <div class="g-nav__in">
      <a class="g-nav__brand" href="#top">@aether/ui-kit</a>
      <Tool
        class="g-nav__railtoggle"
        :label="railOpen ? 'Close' : 'Components'"
        :aria-expanded="railOpen"
        aria-controls="g-rail"
        @click="railOpen = !railOpen"
      />
      <span class="g-nav__spacer" />
      <!-- One button, not a two-option Seg. A theme switch has exactly one thing to say, and it
           is not "which of these two are you" -- it is "press this to change". The label names the
           theme you will GET, so the button is its own affordance.
           Both nav buttons are the kit's Tool, so they are the same height on every pointer type
           by construction -- including the 44px coarse floor -- rather than by two numbers someone
           has to keep equal. -->
      <Tool
        :label="theme === 'timber' ? 'Light' : 'Dark'"
        :title="theme === 'timber' ? 'Switch to the light theme' : 'Switch to the dark theme'"
        @click="applyTheme(theme === 'timber' ? 'paper' : 'timber')"
      />
    </div>
  </nav>

  <!-- Docked beside the content on a wide screen, a dismissible sheet below that. One list,
       one source of truth, and it scrolls itself -- so it holds 25 components as happily as
       10, which the old strip could not. -->
  <aside id="g-rail" class="g-rail" :class="{ open: railOpen }" aria-label="Components">
    <template v-for="g in GROUPS" :key="g">
      <a class="g-rail__group" :href="'#' + groupAnchor(g)" @click="railOpen = false">{{ g }}</a>
      <a
        v-for="c in byGroup(g)"
        :key="c.id"
        class="g-rail__item"
        :href="'#' + c.id"
        @click="railOpen = false"
      >{{ c.name }}</a>
    </template>
  </aside>
  <div v-if="railOpen" class="g-rail__scrim" @click="railOpen = false"></div>

  <div id="top" class="gallery">
    <header class="g-hero">
      <h1>@aether/ui-kit</h1>
      <p class="g-hero__lede">
        Shared interface components for Aether's engineering surfaces — a framework-free core with a
        thin Vue wrapper, so the mechanics can outlive the framework.
      </p>
      <p class="g-hero__sub">
        Every component here runs in production in our own tools. The kit decides how a control
        <em>behaves</em>; what a category means, what a colour encodes, and what the data
        <em>is</em> stay with the caller.
      </p>
      <dl class="g-stats">
        <div><dt>Components</dt><dd>{{ stats.components }}</dd></div>
        <div><dt>Framework-free cores</dt><dd>{{ stats.cores }}</dd></div>
        <div><dt>Documented props</dt><dd>{{ stats.props }}</dd></div>
        <div><dt>Runtime dependencies</dt><dd>0</dd></div>
      </dl>
      <p class="g-hero__meta">
        <code>v{{ KIT_VERSION }}</code> · Apache-2.0 · Vue 3.5 peer dependency · no runtime dependencies of its
        own
      </p>
    </header>

    <section class="g-contract">
      <h2>The token contract</h2>
      <p>
        Components never hardcode a colour. They read <code>--aether-*</code> custom properties; the
        kit ships a light fallback palette so it renders standalone, and a host app overrides those
        tokens to make the kit its own. <strong>This page is that host</strong> — the light/dark
        switch above rewrites the tokens and every component below follows, with no component code
        involved.
      </p>
      <pre><code>/* in your app, after importing '@aether/ui-kit/styles' */
:root {
  --aether-surface: var(--my-surface);
  --aether-ink:     var(--my-ink);
  --aether-cool:    var(--my-accent);
}</code></pre>
      <p class="g-contract__warn">
        Import order matters: load <code>@aether/ui-kit/styles</code> <em>before</em> your own
        tokens. Both define <code>:root</code>, so on equal specificity the last one wins.
      </p>
    </section>

    <template v-for="g in GROUPS" :key="g">
      <h2 :id="groupAnchor(g)" class="g-group">{{ g }}</h2>

      <template v-for="c in byGroup(g)" :key="c.id">
        <!-- Controls -->
        <GSection v-if="c.id === 'seg'" :meta="c" :source="SegExampleSrc">
          <SegExample />
        </GSection>

        <GSection v-else-if="c.id === 'chip'" :meta="c" :source="ChipExampleSrc">
          <ChipExample />
        </GSection>

        <GSection v-else-if="c.id === 'tool'" :meta="c" :source="ToolExampleSrc">
          <ToolExample />
        </GSection>

        <GSection v-else-if="c.id === 'filter-rail'" :meta="c" :source="FilterRailExampleSrc">
          <FilterRailExample />
        </GSection>

        <GSection v-else-if="c.id === 'search-field'" :meta="c" :source="SearchFieldExampleSrc">
          <SearchFieldExample />
        </GSection>

        <GSection v-else-if="c.id === 'transport'" :meta="c" :source="TransportExampleSrc">
          <TransportExample />
        </GSection>

        <!-- Forms -->
        <GSection v-else-if="c.id === 'property-editor'" :meta="c" :source="PropertyEditorExampleSrc">
          <PropertyEditorExample />
        </GSection>

        <!-- Visualization -->
        <GSection v-else-if="c.id === 'graph2d'" :meta="c" :source="Graph2DExampleSrc">
          <Graph2DExample />
        </GSection>

        <GSection v-else-if="c.id === 'gantt'" :meta="c" :source="GanttExampleSrc">
          <GanttExample />
        </GSection>

        <GSection v-else-if="c.id === 'chat-panel'" :meta="c" :source="ChatPanelExampleSrc">
          <ChatPanelExample />
        </GSection>

        <GSection v-else-if="c.id === 'toast'" :meta="c" :source="ToastExampleSrc">
          <ToastExample />
        </GSection>
      </template>
    </template>

    <footer class="g-foot">
      <h2>Using the kit</h2>
      <pre><code>// once, at your app entry
import '@aether/ui-kit/styles'
import './your-tokens.css'   // after the kit — see the token contract above

// then, per component
import Seg from '@aether/ui-kit/controls/seg'</code></pre>
      <p>
        Each component exposes its own subpath, so a consumer pulls only what it uses. Components
        with a <span class="g-badge-inline">core</span> badge have a plain-TypeScript module
        underneath with no Vue import — that is the part designed to outlive this wrapper.
      </p>
    </footer>
  </div>
</template>

<style>
/* ── the gallery acting as a host app: it owns the --aether-* tokens ──
   Values are a real application's light and dark palettes, so what you see here is what the
   kit looks like in the app it was extracted from — not a gallery-only fiction. */
:root {
  --aether-surface: #fbf8f2;
  --aether-panel: #e5dfd2;
  --aether-ink: #1b1e23;
  --aether-ink-soft: #4a4f57;
  --aether-line: rgba(27, 30, 35, 0.14);
  --aether-line-strong: rgba(27, 30, 35, 0.26);
  --aether-warm: #a9591b;
  --aether-rose: #a33b52;
  --aether-cool: #2f6f6b;
  --aether-cool-soft: #5fa4a0;
  --aether-cool-wash: rgba(95, 164, 160, 0.15);
  --aether-shadow: 0 1px 2px rgba(27, 30, 35, 0.06);
  /* The rest of the contract. A host that maps only the obvious tokens silently inherits
     the kit's light fallbacks for the others -- which is precisely how a near-white
     --aether-warm-ink ended up on Timber's light amber at 2.02:1. A host defines the whole
     set or it does not really have a theme. */
  --aether-faint: #8a857a;
  --aether-warm-soft: #c8742e;
  --aether-warm-ink: #fbf8f2;
  --aether-rose-wash: rgba(163, 59, 82, 0.12);
  --aether-font-mono: var(--g-mono);
  --aether-transport-bg: rgba(251, 248, 242, 0.82);
  --aether-transport-backdrop: blur(8px) saturate(1.1);
  --aether-transport-radius: 10px;
  --aether-transport-shadow: 0 4px 20px rgba(27, 30, 35, 0.14);

  /* gallery-own chrome — deliberately NOT --aether-*, so it is obvious which tokens
     belong to the kit's contract and which are this page's own furniture */
  --g-page: #f4f0e8;
  --g-code: #efe9dd;
  --g-display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
  --g-mono: 'Spline Sans Mono', ui-monospace, 'SF Mono', Consolas, monospace;
  --g-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
html[data-theme='timber'] {
  color-scheme: dark;
  --aether-surface: #13201f;
  --aether-panel: #22332f;
  --aether-ink: #eaf0ec;
  --aether-ink-soft: #c4d2ca;
  --aether-line: #22332f;
  --aether-line-strong: #2f4641;
  --aether-warm: #e5a45f;
  --aether-rose: #e08fa4;
  --aether-cool: #8fc6c2;
  --aether-cool-soft: #a8d8d4;
  --aether-cool-wash: rgba(143, 198, 194, 0.16);
  --aether-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  --aether-faint: #8fa39a;
  --aether-warm-soft: #c8742e;
  /* Timber inverts --aether-warm to a LIGHT amber, so the text sitting on it has to go
     dark. This is the token's whole reason for existing. */
  --aether-warm-ink: #0e1b1a;
  --aether-rose-wash: rgba(224, 143, 164, 0.16);
  --aether-font-mono: var(--g-mono);
  --aether-transport-bg: rgba(19, 32, 31, 0.8);
  --aether-transport-backdrop: blur(8px) saturate(1.1);
  --aether-transport-radius: 10px;
  --aether-transport-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);

  --g-page: #0e1b1a;
  --g-code: #182726;
}

* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: var(--g-body);
  background: var(--g-page);
  color: var(--aether-ink);
  -webkit-font-smoothing: antialiased;
}

.g-skip {
  position: absolute;
  left: -9999px;
}
.g-skip:focus {
  left: 12px;
  top: 12px;
  z-index: 50;
  background: var(--aether-surface);
  color: var(--aether-ink);
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid var(--aether-line-strong);
}

/* ── sticky nav ── */
.g-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--g-page) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--aether-line);
}
.g-nav__in {
  max-width: 980px;
  margin: 0 auto;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.g-nav__brand {
  font-family: var(--g-mono);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--aether-ink);
  text-decoration: none;
  flex: none;
}
.g-nav__spacer {
  flex: 1 1 auto;
}

/* ── component rail ──
   Sheet by default (any width below the dock breakpoint), docked beside the content above it.
   Its own scroll, so the list length stops being a layout constraint. */
.g-rail {
  position: fixed;
  z-index: 30;
  top: 50px;
  left: 0;
  bottom: 0;
  width: min(260px, 82vw);
  display: none;
  flex-direction: column;
  gap: 1px;
  padding: 14px 12px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--g-page);
  border-right: 1px solid var(--aether-line);
  box-shadow: 6px 0 24px rgba(0, 0, 0, 0.16);
}
.g-rail.open {
  display: flex;
}
.g-rail__scrim {
  position: fixed;
  inset: 0;
  z-index: 25;
}
.g-rail__group {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  opacity: 0.65;
  text-decoration: none;
  margin: 14px 0 4px;
  padding: 0 10px;
}
.g-rail__group:first-child {
  margin-top: 0;
}
.g-rail__item {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--aether-ink-soft);
  text-decoration: none;
}
.g-rail__item:hover {
  background: var(--aether-panel);
  color: var(--aether-cool);
}


.gallery {
  max-width: 980px;
  margin: 0 auto;
  padding: 44px 24px 90px;
}

/* ── hero ── */
.g-hero h1 {
  font-family: var(--g-display);
  font-size: 42px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 14px;
}
.g-hero__lede {
  font-size: 17px;
  line-height: 1.6;
  max-width: 62ch;
  margin: 0 0 12px;
}
.g-hero__sub {
  font-size: 14.5px;
  line-height: 1.65;
  max-width: 62ch;
  color: var(--aether-ink-soft);
  margin: 0 0 26px;
}
.g-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 16px;
  padding: 0;
}
.g-stats div {
  flex: 1 1 150px;
  border: 1px solid var(--aether-line);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--aether-surface);
}
.g-stats dt {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
.g-stats dd {
  margin: 4px 0 0;
  font-family: var(--g-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
}
.g-hero__meta {
  font-family: var(--g-mono);
  font-size: 11.5px;
  color: var(--aether-ink-soft);
  margin: 0;
}
.g-hero__meta code {
  font-family: inherit;
}

/* ── token contract ── */
.g-contract {
  margin: 40px 0 8px;
  padding: 22px 24px;
  border: 1px solid var(--aether-line);
  border-left: 3px solid var(--aether-cool);
  border-radius: 10px;
  background: var(--aether-surface);
}
.g-contract h2 {
  font-family: var(--g-display);
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 10px;
}
.g-contract p {
  font-size: 14px;
  line-height: 1.65;
  max-width: 68ch;
  margin: 0 0 12px;
  color: var(--aether-ink-soft);
}
.g-contract strong {
  color: var(--aether-ink);
}
.g-contract__warn {
  font-size: 13px;
  margin-bottom: 0 !important;
}
.g-contract pre,
.g-foot pre {
  margin: 0 0 12px;
  padding: 13px 15px;
  background: var(--g-code);
  border: 1px solid var(--aether-line);
  border-radius: 8px;
  overflow-x: auto;
}
.g-contract code,
.g-foot code {
  font-family: var(--g-mono);
  font-size: 12px;
  line-height: 1.6;
}

/* ── group heading ── */
.g-group {
  font-family: var(--g-mono);
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  margin: 46px 0 0;
  scroll-margin-top: 70px;
}

.g-pe {
  width: 100%;
  max-width: 380px;
}
.g-fill {
  width: 100%;
  min-width: 0;
}
/* ChatPanel is height:100% internally (it's meant to fill a tab pane) -- the demo needs to
   BE that bounded box, or the log has nothing to scroll within. */
.g-chat {
  width: 100%;
  max-width: 480px;
  height: 360px;
  border: 1px solid var(--aether-line-strong);
  border-radius: var(--aether-radius);
  overflow: hidden;
}
.g-rails {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
}
.g-hint {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--aether-ink-soft);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
/* The graph's hover card. Fixed, because it is positioned from the client coordinates
   Graph2D hands over — this is host chrome, deliberately not part of the component. */
.g-hovcard {
  position: fixed;
  z-index: 40;
  pointer-events: none;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 11px;
  border: 1px solid var(--aether-line-strong);
  border-radius: 9px;
  background: var(--aether-surface);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  font-size: 12px;
}
.g-hovcard span {
  font-family: var(--g-mono);
  font-size: 10.5px;
  color: var(--aether-faint);
}
.g-mini {
  border: 1px solid var(--aether-line-strong);
  background: var(--aether-surface);
  color: var(--aether-ink);
  border-radius: 6px;
  padding: 3px 9px;
  font-family: var(--g-mono);
  font-size: 11px;
  cursor: pointer;
}
.g-mini:hover {
  border-color: var(--aether-cool);
  color: var(--aether-cool);
}
/* Caption naming which variant an instance is. It was 10.5px in --aether-faint, a token that
   measures 3.03:1 against the panel and so fails WCAG AA -- present in the DOM and invisible in
   practice, which is why two labelled FilterRail orientations read as one component rendered
   twice. --aether-ink-soft clears AA, and 11.5px is small without being decorative. */
/* ---- example-file chrome ----
   These live in App.vue's UNSCOPED style block on purpose: the examples are separate .vue files
   (src/gallery/examples/), and a scoped block here would not reach them. They are the only
   gallery-owned classes an example file may use, so an example stays copy-pasteable apart from
   this thin labelling layer. */
.g-ex {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
/* siblings that belong side by side rather than stacked -- e.g. two pill capsules that share a
   header in real use, where stacking them would misrepresent the pattern */
.g-ex-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
/* the live state readout, when it belongs to the example rather than the section shell */
.g-ex-state {
  flex-basis: 100%;
  font-family: var(--g-mono);
  font-size: 11.5px;
  color: var(--aether-ink-soft);
}

.g-variant {
  display: block;
  margin-bottom: 8px;
  font-family: var(--g-mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--aether-ink-soft);
}

/* ── footer ── */
.g-foot {
  margin-top: 56px;
  border-top: 1px solid var(--aether-line);
  padding-top: 28px;
}
.g-foot h2 {
  font-family: var(--g-display);
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px;
}
.g-foot p {
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--aether-ink-soft);
  max-width: 68ch;
}
.g-badge-inline {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--aether-line-strong);
}

@media (max-width: 720px) {
  .g-hero h1 {
    font-size: 32px;
  }
  /* the `.g-nav__links { display: none }` that used to live here is gone with the strip
     itself -- it left a phone with no component navigation whatsoever */
}

/* ── rail: docked ──
   1180px is where a 980px column and a 260px rail both fit without overlapping; below it the
   rail stays a sheet rather than squeezing either.
   Deliberately the LAST block in this stylesheet: `.gallery` and `.g-nav__in` both set the
   `margin` SHORTHAND (`0 auto`), which resets margin-left wholesale. Declared any earlier,
   this loses at equal specificity and the content renders underneath the rail -- which is
   exactly what it did when it sat next to the other rail rules. */
@media (min-width: 1180px) {
  /* Above this the rail is permanently docked, so the toggle has nothing to toggle. Targets
     .g-nav__railtoggle, a class passed THROUGH Tool -- when this button stopped being a
     hand-rolled <button class="g-nav__trigger"> the old selector silently stopped matching and
     the button reappeared on desktop. */
  .g-nav__railtoggle {
    display: none;
  }
  .g-rail {
    display: flex;
    top: 51px;
    box-shadow: none;
    background: transparent;
  }
  .g-rail__scrim {
    display: none;
  }
  .g-nav__in,
  .gallery {
    margin-left: 260px;
  }
}
</style>
