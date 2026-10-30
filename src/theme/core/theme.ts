/* An app's palette on the page: the format, the stylesheet, and the controller that owns which
 * theme is on.
 *
 * The palette is the app's. The kit's --aether-* tokens are mapped onto it by the app's own
 * stylesheet, so no part of this depends on a UI framework's theme. `cssTokens()` emits a palette
 * as `--<prefix>-<role>` custom properties, which the app's stylesheets and its mapping both read.
 *
 * COMMA-SEPARATED TRIPLES, deliberately: `--q-surface: 23,30,74`. A call site composes a colour as
 * `rgb(var(--q-x))` and an alpha as `rgba(var(--q-x), α)`; a space-separated triple would break
 * every alpha form among them, so the format must hold. A triple also cannot be used where a
 * colour is expected, so a token used without its rgb() wrapper fails loudly instead of resolving
 * to something plausible. The kit's own tokens are full colours, as its contract requires; the
 * app's mapping wraps these in rgb().
 *
 * Framework-free: the controller is read through getters and tells its listeners of a change.
 * `themeRefs` (theme/refs) is the Vue form. */

export interface ThemeDef {
  dark: boolean
  colors: Record<string, string>
}

/** `#0E1338` -> `14,19,56`. Shorthand is expanded; anything not a hex is returned untouched, so a
 *  non-hex value a theme might carry cannot be mangled into a broken triple. */
export function hexToTriple(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const h = m[1]!
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

/**
 * The stylesheet text for a set of themes, one block per theme, each role as
 * `--<prefix>-<role>`. ONE SELECTOR, `[data-theme='<name>']`, which the controller sets on the
 * document root.
 */
export function cssTokens(themes: Record<string, ThemeDef>, prefix: string): string {
  return Object.entries(themes)
    .map(([name, def]) => {
      const decls = Object.entries(def.colors)
        .map(([role, hex]) => `  --${prefix}-${role}: ${hexToTriple(hex)};`)
        .join('\n')
      return `\n[data-theme='${name}'] {\n${decls}\n}`
    })
    .join('\n')
}

export interface ThemeOptions {
  themes: Record<string, ThemeDef>
  /** The name of the dark theme among `themes`. */
  dark: string
  /** The name of the light theme among `themes`. */
  light: string
  /** The localStorage key the reader's choice is kept under. Own key per app: two apps served
   *  from one origin share its storage. */
  storageKey: string
  /** The custom properties' prefix: `q` gives `--q-surface`. */
  prefix: string
  /** Paper is light: while the page prints, the document wears the light theme. Default true. */
  paper?: boolean
}

export interface ThemeController {
  /** The active theme's name: the `dark` or the `light` name the controller was given. */
  readonly name: string
  readonly isDark: boolean
  /** The active palette, for what cannot read CSS (a WebGL scene). */
  readonly colors: Record<string, string>
  /** Turns dark to light or light to dark, and keeps the choice. */
  toggle(): void
  /** Calls `listener` with the new name after every toggle; gives back the call that stops it. */
  subscribe(listener: (name: string) => void): () => void
}

/**
 * Owns which theme is on, and puts its tokens on the page.
 *
 * BEFORE FIRST PAINT, deliberately. Called at module scope, this puts the tokens and `data-theme`
 * on the document before anything mounts. A theme applied after mount once left a control holding
 * the outgoing palette for good: a `transition` on a token-coloured background started before the
 * element had settled and committed its start value. The cheap defence is to never paint the
 * wrong palette in the first place.
 *
 * Without a document (a server render, a node test) it reads the same and touches nothing.
 */
export function createThemeController(options: ThemeOptions): ThemeController {
  const { themes, dark, light, storageKey, prefix, paper = true } = options

  /* An explicit saved choice wins; otherwise follow the OS. Read synchronously so there is no
     flash of the wrong theme. */
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null
  const prefersDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  let name = saved === dark || saved === light ? saved : prefersDark ? dark : light
  const listeners = new Set<(name: string) => void>()

  if (typeof document !== 'undefined') {
    const id = `${prefix}-tokens-${storageKey}`
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = cssTokens(themes, prefix)
      document.head.appendChild(style)
    }
    document.documentElement.setAttribute('data-theme', name)
  }

  /* Paper is light. While the page prints, the document wears the light theme, so a print
     stylesheet reads the same tokens and there is no second palette to keep in step. `name` is not
     touched: it is the reader's choice, what reads the palette follows it, and it comes back
     afterwards. Two signals because neither is complete on its own: beforeprint and afterprint
     fire for a real print and not for an emulated print medium, and the media query fires for
     both. */
  if (paper && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const wear = (on: boolean): void => document.documentElement.setAttribute('data-theme', on ? light : name)
    window.addEventListener('beforeprint', () => wear(true))
    window.addEventListener('afterprint', () => wear(false))
    if (typeof window.matchMedia === 'function') {
      window.matchMedia('print').addEventListener?.('change', (e) => wear(e.matches))
    }
  }

  function toggle(): void {
    name = (themes[name]?.dark ?? true) ? light : dark
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', name)
    try {
      localStorage.setItem(storageKey, name)
    } catch {
      /* private mode, or storage refused: the choice holds for this page only */
    }
    for (const listener of listeners) listener(name)
  }

  return {
    get name() {
      return name
    },
    get isDark() {
      return themes[name]?.dark ?? true
    },
    get colors() {
      return themes[name]?.colors ?? {}
    },
    toggle,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
