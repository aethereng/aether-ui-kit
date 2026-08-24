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
/* Same rule as Tool above: the rail's groups are the kit's Disclosure, not a hand-rolled panel. */
import Disclosure from '@aether/ui-kit/controls/disclosure'
import { COMPONENTS, GROUPS, byGroup, type Group } from './meta'
/* Examples live in their own files so the gallery can RENDER one and DISPLAY its source from the
 * same bytes -- see GSection's `source` prop. `?raw` is Vite giving us the file as a string. */
import SegExample from './examples/SegExample.vue'
import SegExampleSrc from './examples/SegExample.vue?raw'
import ChipExample from './examples/ChipExample.vue'
import ChipExampleSrc from './examples/ChipExample.vue?raw'
import BadgeExample from './examples/BadgeExample.vue'
import CalloutExample from './examples/CalloutExample.vue'
import BadgeExampleSrc from './examples/BadgeExample.vue?raw'
import CalloutExampleSrc from './examples/CalloutExample.vue?raw'
import CardExample from './examples/CardExample.vue'
import CardExampleSrc from './examples/CardExample.vue?raw'
import DateFieldExample from './examples/DateFieldExample.vue'
import DateFieldExampleSrc from './examples/DateFieldExample.vue?raw'
import RadioGroupExample from './examples/RadioGroupExample.vue'
import RadioGroupExampleSrc from './examples/RadioGroupExample.vue?raw'
import TextFieldExample from './examples/TextFieldExample.vue'
import TextFieldExampleSrc from './examples/TextFieldExample.vue?raw'
import NumberFieldExample from './examples/NumberFieldExample.vue'
import NumberFieldExampleSrc from './examples/NumberFieldExample.vue?raw'
import SelectExample from './examples/SelectExample.vue'
import SelectExampleSrc from './examples/SelectExample.vue?raw'
import SliderExample from './examples/SliderExample.vue'
import SliderExampleSrc from './examples/SliderExample.vue?raw'
import SpinnerExample from './examples/SpinnerExample.vue'
import SpinnerExampleSrc from './examples/SpinnerExample.vue?raw'
import SwitchExample from './examples/SwitchExample.vue'
import SwitchExampleSrc from './examples/SwitchExample.vue?raw'
import TooltipExample from './examples/TooltipExample.vue'
import TooltipExampleSrc from './examples/TooltipExample.vue?raw'
import MenuExample from './examples/MenuExample.vue'
import MenuExampleSrc from './examples/MenuExample.vue?raw'
import DialogExample from './examples/DialogExample.vue'
import DialogExampleSrc from './examples/DialogExample.vue?raw'
import ToolExample from './examples/ToolExample.vue'
import ToolExampleSrc from './examples/ToolExample.vue?raw'
import TreeExample from './examples/TreeExample.vue'
import TreeExampleSrc from './examples/TreeExample.vue?raw'
import DisclosureExample from './examples/DisclosureExample.vue'
import DisclosureExampleSrc from './examples/DisclosureExample.vue?raw'
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

function saved(): 'paper' | 'timber' {
  try {
    return localStorage.getItem(THEME_KEY) === 'timber' ? 'timber' : 'paper'
  } catch {
    return 'paper' /* private mode — the switch still works for this session */
  }
}

/* APPLIED AT SETUP, NOT onMounted, and that is a bug fix rather than a tidy-up.
 *
 * Applied after mount, the page painted once in the light palette and then had the dark one
 * swapped underneath it — which starts a transition on every element whose background is a token.
 * Most settle. `.aether-chip--row.on` did not: measured on a clean load in the dark theme, its
 * background stayed at the light palette's panel colour indefinitely, giving light ink on a light
 * pill at 1.1:1 while `getAnimations()` reported nothing running. A transition that begins before
 * the element has settled can commit its start value and never finish.
 *
 * Setting the attribute during setup means the first paint is already in the right palette, so
 * there is no transition to lose. */
const theme = ref<'paper' | 'timber'>(saved())
document.documentElement.setAttribute('data-theme', theme.value)

/* A deliberate theme SWITCH is the other half: the palette changes under a rendered page, so the
 * same transitions fire for real. They are there to make a hover feel responsive, and a hover is
 * not what happened — suppressed for one frame so the swap is instant and nothing can latch. */
function applyTheme(t: 'paper' | 'timber') {
  const root = document.documentElement
  root.classList.add('g-no-transition')
  theme.value = t
  root.setAttribute('data-theme', t)
  /* Force the new palette to commit while transitions are off, then restore them — synchronously,
     in one turn. A requestAnimationFrame pair is the usual way to write this and it is wrong here:
     rAF is throttled in a background tab, so switching the theme and then leaving the tab would
     strand the class and disable every transition on the page until it was next foregrounded.
     Reading offsetHeight forces the reflow with no timer to miss. */
  void root.offsetHeight
  root.classList.remove('g-no-transition')
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* private mode */
  }
}

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

/* ── the rail's groups ──
   The rail listed every component flat: 26 rows plus 4 headings in a 260px column, which is past
   the fold on a laptop, so finding a component meant scrolling a list to find a list. The groups
   collapse now and the rail is four rows until asked for more.

   Built from the kit's own Disclosure, for the same reason the nav's buttons are Tools: chrome this
   page hand-rolls is chrome that cannot fail when the component it imitates regresses. It also puts
   Disclosure under a shape its own demo does not — four controlled instances sharing one state, and
   the `aside` slot carrying a real control rather than an illustrative one. */
const openGroups = ref(new Set<Group>())

/** The group holding whatever the URL points at — a component id (#slider) or a group anchor
 *  (#forms), because both are real targets on this page. */
function groupFromHash(hash: string): Group | undefined {
  const id = hash.replace(/^#/, '')
  if (!id) return undefined
  return COMPONENTS.find((c) => c.id === id)?.group ?? GROUPS.find((g) => groupAnchor(g) === id)
}

/* Exactly one group open on arrival: the one you were sent to, or the first. Opening none leaves
   four dead rows on first paint; opening all restores the wall this replaces. Set at setup rather
   than onMounted so the rail paints in its final state — the same first-paint rule the theme
   above follows, and for the same reason. */
openGroups.value.add(groupFromHash(location.hash) ?? GROUPS[0]!)

/* Independent, not an accordion. Collapsing a group the reader opened, because they opened another
   one, is the kind of tidiness that costs a comparison they were in the middle of. */
function setGroup(g: Group, open: boolean) {
  if (open) openGroups.value.add(g)
  else openGroups.value.delete(g)
}
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

  <!-- Docked beside the content on a wide screen, a dismissible sheet below that. One source of
       truth for the order -- `byGroup` also drives the sections below, so the rail cannot list
       them in an order the page does not use. -->
  <aside id="g-rail" class="g-rail" :class="{ open: railOpen }" aria-label="Components">
    <Disclosure
      v-for="g in GROUPS"
      :key="g"
      :label="g"
      :meta="`${byGroup(g).length} components`"
      :open="openGroups.has(g)"
      @update:open="setGroup(g, $event)"
    >
      <!-- The group heading is still somewhere you can go, and the toggle no longer takes you
           there. `aside` is Disclosure's slot for precisely this: a control that stays reachable
           while the panel is COLLAPSED, rendered as a sibling of the toggle so it is its own tab
           stop rather than a link nested inside a button. -->
      <template #aside>
        <a
          class="g-rail__jump"
          :href="'#' + groupAnchor(g)"
          :aria-label="`Jump to ${g}`"
          :title="`Jump to ${g}`"
          @click="railOpen = false"
          >→</a
        >
      </template>
      <a
        v-for="c in byGroup(g)"
        :key="c.id"
        class="g-rail__item"
        :href="'#' + c.id"
        @click="railOpen = false"
        >{{ c.name }}</a
      >
    </Disclosure>
  </aside>
  <!-- A scrim is a mouse convenience, and it cannot carry the keyboard path the rule asks for: it
       is not focusable, so a keydown bound here would never fire. The keyboard equivalent already
       exists elsewhere and is what makes this dismissible without a pointer — `onRailKey` closes on
       Escape, and the toggle carries aria-expanded. Disabled with that as the reason, not to quiet
       the rule. -->
  <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
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

        <GSection v-else-if="c.id === 'date-field'" :meta="c" :source="DateFieldExampleSrc">
          <DateFieldExample />
        </GSection>

        <GSection v-else-if="c.id === 'radio-group'" :meta="c" :source="RadioGroupExampleSrc">
          <RadioGroupExample />
        </GSection>

        <GSection v-else-if="c.id === 'card'" :meta="c" :source="CardExampleSrc">
          <CardExample />
        </GSection>

        <GSection v-else-if="c.id === 'badge'" :meta="c" :source="BadgeExampleSrc">
          <BadgeExample />
        </GSection>

        <GSection v-else-if="c.id === 'callout'" :meta="c" :source="CalloutExampleSrc">
          <CalloutExample />
        </GSection>

        <GSection v-else-if="c.id === 'switch'" :meta="c" :source="SwitchExampleSrc">
          <SwitchExample />
        </GSection>

        <GSection v-else-if="c.id === 'text-field'" :meta="c" :source="TextFieldExampleSrc">
          <TextFieldExample />
        </GSection>

        <GSection v-else-if="c.id === 'number-field'" :meta="c" :source="NumberFieldExampleSrc">
          <NumberFieldExample />
        </GSection>

        <GSection v-else-if="c.id === 'select'" :meta="c" :source="SelectExampleSrc">
          <SelectExample />
        </GSection>

        <GSection v-else-if="c.id === 'slider'" :meta="c" :source="SliderExampleSrc">
          <SliderExample />
        </GSection>

        <GSection v-else-if="c.id === 'spinner'" :meta="c" :source="SpinnerExampleSrc">
          <SpinnerExample />
        </GSection>

        <GSection v-else-if="c.id === 'tooltip'" :meta="c" :source="TooltipExampleSrc">
          <TooltipExample />
        </GSection>

        <GSection v-else-if="c.id === 'menu'" :meta="c" :source="MenuExampleSrc">
          <MenuExample />
        </GSection>

        <GSection v-else-if="c.id === 'dialog'" :meta="c" :source="DialogExampleSrc">
          <DialogExample />
        </GSection>

        <GSection v-else-if="c.id === 'tool'" :meta="c" :source="ToolExampleSrc">
          <ToolExample />
        </GSection>

        <GSection v-else-if="c.id === 'tree'" :meta="c" :source="TreeExampleSrc">
          <TreeExample />
        </GSection>

        <GSection v-else-if="c.id === 'disclosure'" :meta="c" :source="DisclosureExampleSrc">
          <DisclosureExample />
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
/* This is `paper`, the light theme -- named the same as `applyTheme('paper')` and
   `html[data-theme='timber']` below, and selected the same way, so the two themes are equally
   real in this file rather than one being an explicit block and the other "whatever :root
   happens to resolve to when data-theme isn't set to something else". `:root` stays alongside
   the explicit selector rather than being replaced by it: `data-theme` is set by JS on mount, so
   there is a brief window before that where nothing has `[data-theme='paper']` yet, and the
   bare `:root` is what keeps that window themed correctly instead of unstyled. */
html[data-theme='paper'],
:root {
  --aether-surface: #fbf8f2;
  --aether-panel: #e5dfd2;
  --aether-ink: #1b1e23;
  --aether-ink-soft: #4a4f57;
  --aether-line: rgba(27, 30, 35, 0.14);
  --aether-line-strong: rgba(27, 30, 35, 0.26);
  --aether-warm: #a9591b;
  --aether-rose: #a33b52;
  --aether-ok: #3f6b3a;
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
  /* Declared explicitly, not left to the UA: `color-scheme` is what themes the native widgets
     the kit cannot draw -- the date picker popup, spinner arrows. The kit reads no token for it,
     because it is an inherited property and only the host knows which way its palette runs. */
  color-scheme: light;
  --aether-transport-shadow: 0 4px 20px rgba(27, 30, 35, 0.14);

  /* gallery-own chrome — deliberately NOT --aether-*, so it is obvious which tokens
     belong to the kit's contract and which are this page's own furniture */
  --g-page: #f4f0e8;
  --g-code: #efe9dd;
  /* Syntax palette.
     Ratios are WCAG against --g-code, computed on the rendered page rather than estimated: an
     early pass here was eyeballed and three of the ten sat under 4.5 while the comments beside
     them claimed otherwise. Comment and punct were the worst, and they are the two that carry the
     most characters — quiet is a colour choice, unreadable is not.

     REBALANCED — this set used to be "warm against the paper ground, so a code block reads as part
     of the page rather than a screenshot of an editor dropped onto it". That intent was right and
     was taken too far: six of the ten landed in a 23-49° hue band and comment, attr and punct sat
     at 10-15% saturation, which is grey. Since comments are most of the characters in these files,
     the whole block read brown-on-cream — monochrome, accurately. Mean saturation was 38%.

     The rule now is by ROLE rather than uniformly warm. The quiet tokens that carry bulk text
     (attr, punct) stay warm-neutral so the block still belongs to the page; the tokens that
     actually distinguish one thing from another (keyword, string, tag, fn, directive, interp) get
     real chroma; and comment moves to sage, off the warm axis entirely, so the most common token is
     no longer a slightly different brown from its neighbours. That also makes the two themes agree
     on meaning — timber's comment is already sage, its tag teal, its fn blue.
     Mean saturation 57%, hues spread from six-in-a-band to 16/28/45/49/57/135/145/173/216/326. */
  --g-tok-comment: #5a6b61; /* 4.68 — sage, off the warm axis so bulk comment text separates */
  --g-tok-string: #7a5e0c; /* 5.06 */
  --g-tok-keyword: #b03d12; /* 4.93 */
  --g-tok-number: #8a4d16; /* 5.51 */
  --g-tok-fn: #2a5da8; /* 5.38 */
  --g-tok-tag: #0a6f64; /* 5.00 */
  --g-tok-directive: #a81f6d; /* 5.64 — loudest, and bolded */
  --g-tok-attr: #6d6337; /* 4.98 — deliberately quiet: it carries bulk text */
  --g-tok-interp: #19702f; /* 5.11 */
  --g-tok-punct: #64634f; /* 5.05 — quietest, and the most frequent glyph on the page */
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
  /* Inverted with the rest of the tone family. Left at the kit's dark default green, a filled
     success badge is dark-green-on-dark-ink at 2.84 — the failure is silent, because every other
     tone still looks right. */
  --aether-ok: #8fbf84;
  --aether-cool: #8fc6c2;
  --aether-cool-soft: #a8d8d4;
  --aether-cool-wash: rgba(143, 198, 194, 0.16);
  /* Tried teal (the token's default), then warm amber, then rose -- see git history for that
     back-and-forth. Currently back on teal, to compare the light theme's own accent carried into
     timber unchanged against the alternates. --aether-cool resolves to timber's own light-blue
     value here (#8fc6c2), not paper's dark one -- same token name, theme-appropriate value, which
     is the whole point of it being a token. */
  --aether-scrollbar: var(--aether-cool);
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
  /* Hand-picked per theme rather than lightened programmatically: on a dark ground a saturated hue
     reads as MORE saturated, so the light theme's values inverted come out garish while its quiet
     ones vanish. Pulled toward this theme's own timber-and-sage family.
     Ratios measured against --g-code on the rendered page, same as above. */
  --g-tok-comment: #869a91; /* 5.2 — quiet, but it was 3.8 and comments are most of these files */
  --g-tok-string: #c9b458; /* 7.5 */
  --g-tok-keyword: #e39a6b; /* 6.7 */
  --g-tok-number: #d8a97e; /* 7.3 */
  --g-tok-fn: #8fb8de; /* 7.4 */
  --g-tok-tag: #6fc7ba; /* 7.8 */
  --g-tok-directive: #e59ac2; /* 7.2 — loudest here too */
  --g-tok-attr: #b6b39c; /* 7.3 */
  --g-tok-interp: #97ce8b; /* 8.5 */
  --g-tok-punct: #7f9189; /* 4.7 */
}

/* Kills every transition for the one frame a theme swap takes. Without it the palette change
   animates: a colour transition meant for a hover fires on every themed element at once, which
   both looks wrong and can leave a value latched at the outgoing palette. */
html.g-no-transition *,
html.g-no-transition *::before,
html.g-no-transition *::after {
  transition: none !important;
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
  /* No gap: each group carries its own hairline now, and a gap on top of it separates twice. */
  gap: 0;
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
/* Disclosure arrives dressed as a CARD -- 1px border, surface fill, 8px radius, 10/14 padding --
   which is right in a content column and too heavy four-deep in a 260px nav. These strip it back to
   navigation: no fill, no border but a hairline between groups, and header padding pulled in to sit
   over the items it reveals.
   ID SELECTORS, deliberately. The rules being overridden are Disclosure's own scoped ones, so they
   carry its scope attribute: `.aether-disclosure[data-v-x]` is (0,2,0). THIS style block is not
   scoped, so a plain `.g-rail .aether-disclosure` is also (0,2,0) and the winner would be decided
   by bundle order -- which is not something to hang a layout on. `#g-rail` makes it (1,1,0) and
   settles it. `:deep()` is not the answer here either: it is only transformed inside a `scoped`
   block, and in a global one it survives as a literal selector the browser cannot parse, so the
   whole rule is dropped without a warning. (It was written that way first, and every override
   silently did nothing.) */
#g-rail .aether-disclosure {
  border: 0;
  border-radius: 0;
  background: none;
  /* Disclosure clips its own corners so the 0fr reveal can animate. Kept -- nothing in the rail
     escapes its panel -- but with the radius gone it is now doing only the clipping. */
  border-bottom: 1px solid var(--aether-line);
  /* Without this, opening a group when the rail is already tight on height did not reveal a
     scrollbar -- it silently squeezed the panel that just opened down to a few px instead,
     while every OTHER open group kept its full size. Textbook flexbox: .g-rail is a fixed-
     height flex COLUMN, .aether-disclosure is an ordinary flex item (flex-shrink: 1 by
     default), and its own overflow: hidden descendant gives the flex algorithm's automatic
     minimum size nothing to protect -- so once the column's combined content exceeds what the
     rail can show, later items get compressed toward zero rather than the CONTAINER scrolling
     past them, even though #g-rail is `overflow-y: auto` and very much willing to. flex-shrink:
     0 is what makes each group keep the height its own content asked for, so the rail is what
     ends up too tall — which is exactly the case overflow-y: auto is already there to handle. */
  flex-shrink: 0;
}
#g-rail .aether-disclosure:last-child {
  border-bottom: 0;
}
#g-rail .aether-disclosure__head {
  padding: 7px 10px;
  border-radius: 7px;
}
/* The whole head lights up, not just the label: at this size the toggle and its jump link read as
   one row, and hovering half a row is a worse signal than hovering none. */
#g-rail .aether-disclosure__head:hover {
  background: var(--aether-panel);
}
#g-rail .aether-disclosure__label {
  font-family: var(--g-mono);
  font-size: 10.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  font-weight: 600;
}
#g-rail .aether-disclosure__meta {
  font-size: 11px;
}
/* The body holds a link list, so it wants no padding beyond a small inset, and no top border --
   the hairline between GROUPS is the separator here, and a second one under every open header
   would double it. */
#g-rail .aether-disclosure__body {
  border-top: 0;
  padding: 0 0 6px 8px;
}
/* Quiet by default, and never the thing the eye lands on first -- it sits beside a group name and
   is worth exactly one glance. Sized to the coarse-pointer floor so it is tappable on the sheet,
   where the rail actually gets used with a thumb. */
.g-rail__jump {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--aether-faint);
  font-size: 13px;
  line-height: 1;
  text-decoration: none;
}
.g-rail__jump:hover {
  color: var(--aether-cool);
  background: var(--aether-surface);
}
.g-rail__jump:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}
@media (pointer: coarse) {
  .g-rail__jump {
    width: var(--aether-touch-dense);
    height: var(--aether-touch-dense);
  }
}
.g-rail__item {
  display: flex;
  align-items: center;
  min-height: 32px;
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
/* The nav's two Tools take the DENSE floor, not the full one. They are chrome in a top bar,
   where height is the scarcest thing on a phone: at 44px each the bar came to 64px before any
   content. 32px keeps them equal to each other, keeps them past WCAG 2.2 AA's 24px minimum, and
   returns 12px of the viewport. Higher specificity than the kit's own coarse rule, so order does
   not matter here. */
@media (pointer: coarse) {
  .g-nav .aether-tool {
    min-height: var(--aether-touch-dense);
  }
}

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
/* Full-width, so a caption cannot be misread as belonging to the block beside it. .g-demo is a
   wrapping flex row, so by default several labelled examples sit shoulder to shoulder and the
   labels stop being attributable -- which is exactly how the Seg section became unreadable. */
.g-ex--full {
  flex-basis: 100%;
}
/* Variants whose CONTROL is far narrower than its caption. Tool's buttons measure 27-88px under
   captions of 129-493px, so the caption set the block width and consecutive buttons ended up
   separated by the length of the previous label -- read as gaps in a row of buttons, which is
   exactly what it was. A tile gives every block the same width, wraps the caption inside it, and
   lets the controls pack left on a grid instead of drifting with the prose.
   `align-self: stretch` overrides .g-demo's `align-items: center` for these only, so a tile fills
   its row's height and the caption below can take the slack. */
.g-ex--tile,
.g-ex--tile-wide {
  /* 146px, measured rather than picked: the narrowest width that still keeps every caption in these
     two sections to TWO lines. 158/172px leave the tile exactly as tall and simply waste width (the
     gap between adjacent buttons grows from 77-106px to 103-132px); 134px fits six per row but tips
     the longest captions onto a third line, buying horizontal space the caption then spends anyway. */
  --g-tile: 146px;
  flex: 0 0 auto;
  align-self: stretch;
}
.g-ex--tile {
  width: var(--g-tile);
}
/* Two columns and the gap between them, so it still lands on the same grid. For a variant whose
   demo is a .g-ex-row: that class exists to keep siblings SIDE BY SIDE, and a one-column tile
   stacks them without saying so -- which is the exact misrepresentation .g-ex-row was added to
   prevent. Derived from --g-tile rather than written as 304px, so the two cannot drift. */
.g-ex--tile-wide {
  width: calc(var(--g-tile) * 2 + 12px);
}
/* The caption absorbs the leftover height, which puts every control on a common line at the bottom
   of the row regardless of whether its label wrapped to one line or three. */
.g-ex--tile .g-variant,
.g-ex--tile-wide .g-variant {
  flex: 1 1 auto;
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
/* a read-out, not a field: monospace so digits do not reflow, and visibly not editable */
.g-ex-readout {
  font-family: var(--g-mono);
  font-size: 12.5px;
  color: var(--aether-ink);
  background: var(--aether-panel);
  border-radius: 6px;
  padding: 4px 8px;
  min-width: 56px;
  text-align: right;
}
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

/* Prose inside a demo. Nothing styled a bare <p> here, so it fell all the way to the UA default --
   16px with `line-height: normal` and 1em margins -- on a page whose largest body text is 14px. The
   unset line-height is what made it read as a different TYPEFACE rather than merely a larger one.
   `:not([class])` deliberately: `.g-hint` is also a <p> inside .g-demo and sets its own smaller
   size, and a bare `.g-demo p` would be (0,1,1) and quietly outrank it. A scoped example's
   `data-v-*` is an attribute, not a class, so scoped prose still matches.
   Selecting the element rather than a class an example must add keeps example files
   copy-pasteable, and makes any future demo with prose right without touching it. */
.g-demo p:not([class]) {
  margin: 0 0 8px;
  font-size: 13.5px;
  line-height: 1.6;
  max-width: 68ch;
}
.g-demo p:not([class]):last-child {
  margin-bottom: 0;
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
