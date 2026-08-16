import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, globSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/* The package's PUBLIC CONTRACT, tested the way a consumer meets it.
 *
 * Both classes of bug below have already shipped here once. The exports map pointed at two
 * files that did not exist (an entry point that 404s for anyone importing the package
 * normally), and the CSS read three --aether-* tokens that no palette defined (so a themed
 * host silently got a light fallback in a dark app). Neither is visible to vue-tsc, eslint,
 * or any component test — they only surface when someone installs the thing. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
/* Every stylesheet the package ships: the shared CSS plus each component's scoped <style>.
 * Scanning only ui-kit.css produced a false "unused token" for everything a .vue file reads,
 * which is most of Transport's surface. */
const shippedCss = (() => {
  const files = globSync('src/**/*.{css,vue}', { cwd: root, nodir: true }) as string[]
  return files
    .map((f) => {
      const text = readFileSync(resolve(root, f), 'utf8')
      if (!f.endsWith('.vue')) return text
      return Array.from(text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), (m) => m[1]).join('\n')
    })
    .join('\n')
})()
const css = shippedCss

describe('exports map', () => {
  const entries = Object.entries(pkg.exports as Record<string, Record<string, string>>)

  it('declares subpaths', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it.each(entries)('%s resolves to a file that exists', (subpath, conditions) => {
    for (const [condition, target] of Object.entries(conditions)) {
      const abs = resolve(root, target)
      expect(existsSync(abs), `${subpath} [${condition}] -> ${target} does not exist`).toBe(true)
    }
  })

  it('ships every exported file inside the published "files" globs', () => {
    // exports pointing outside `files` resolve locally and 404 once published
    const globs: string[] = pkg.files
    for (const [subpath, conditions] of entries) {
      for (const target of Object.values(conditions)) {
        const rel = target.replace(/^\.\//, '')
        const covered = globs.some((g) => !g.startsWith('!') && rel.startsWith(g.replace(/\/.*$/, '')))
        expect(covered, `${subpath} -> ${target} is not covered by "files"`).toBe(true)
      }
    }
  })

  it('declares no runtime dependencies', () => {
    // the kit's central promise; a stray dependency here is a breaking change for consumers
    expect(pkg.dependencies ?? {}).toEqual({})
  })

  it('keeps vue a peer dependency rather than a hard one', () => {
    expect(pkg.peerDependencies?.vue).toBeTruthy()
  })
})

describe('token contract', () => {
  /** every --aether-* the stylesheet READS */
  const read = new Set(Array.from(css.matchAll(/var\((--aether-[a-z0-9-]+)/g), (m) => m[1]!))
  /** every --aether-* the stylesheet DEFINES */
  const defined = new Set(Array.from(css.matchAll(/^\s*(--aether-[a-z0-9-]+)\s*:/gm), (m) => m[1]!))

  it('reads at least one token (guards against the regex silently matching nothing)', () => {
    expect(read.size).toBeGreaterThan(5)
    expect(defined.size).toBeGreaterThan(5)
  })

  it('defines every token it reads', () => {
    const missing = [...read].filter((t) => !defined.has(t))
    expect(missing, `read but never defined: ${missing.join(', ')}`).toEqual([])
  })

  it('reads every token it defines', () => {
    // a defined-but-unread token is dead weight a host still has to map
    const unused = [...defined].filter((t) => !read.has(t))
    expect(unused, `defined but never read: ${unused.join(', ')}`).toEqual([])
  })

  it('has no bare hex colours outside the fallback palette block', () => {
    // a hardcoded colour cannot be themed — this is how .aether-tool.hot ended up
    // unreadable on a dark host
    const shared = readFileSync(resolve(root, 'src/styles/ui-kit.css'), 'utf8')
    const body = shared.slice(shared.indexOf('}', shared.indexOf(':root')))
    const hexes = body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hexes, `hardcoded colours outside :root: ${hexes.join(', ')}`).toEqual([])
  })
})

describe('components that set their own dimensions state their own box model', () => {
  /* The kit ships no global reset on purpose — it must not impose one on a host. The cost is
   * that any rule setting an explicit width has to say what that width means, or it silently
   * depends on the host having a reset. The boolean switch did exactly that: 38x22 in the
   * gallery (which resets), 60x36 for anyone else, because it inherited the text-input
   * padding and border. */
  const shared = readFileSync(resolve(root, 'src/styles/ui-kit.css'), 'utf8')

  it('ships no global reset, so this file stays safe to import anywhere', () => {
    expect(/\*\s*\{[^}]*box-sizing/.test(shared)).toBe(false)
  })

  it('the boolean switch pins box-sizing, padding and border', () => {
    /* Reads Switch.vue rather than the shared sheet since 0.13.0: the pill moved out of
     * `.aether-property-editor__field input[type='checkbox']` and into its own component, because
     * the appearance existed only inside a form and a standalone toggle could not reach it. The
     * ASSERTION is unchanged and still load-bearing — the kit ships no global reset, so a control
     * declaring an explicit 38x22 must state its own box model or inherit a host's. */
    const sw = readFileSync(resolve(root, 'src/controls/vue/Switch.vue'), 'utf8')
    const rule = sw.slice(sw.indexOf('.aether-switch {'), sw.indexOf('}', sw.indexOf('.aether-switch {')))
    expect(rule, 'switch rule not found').toBeTruthy()
    for (const decl of ['box-sizing', 'padding', 'border']) {
      expect(rule.includes(decl), `switch must declare ${decl}`).toBe(true)
    }
  })

  it('the shared text-input rule excludes the checkbox', () => {
    // if this selector ever swallows [type=checkbox] again, the switch inherits padding
    expect(shared.includes("input:not([type='checkbox'])")).toBe(true)
  })
})

describe('interactive controls give feedback before they are clicked', () => {
  const shared = readFileSync(resolve(root, 'src/styles/ui-kit.css'), 'utf8')

  it.each([
    ['.aether-tool', '.aether-tool:hover'],
    ['.aether-chip', '.aether-chip:hover'],
    ['.aether-seg button', '.aether-seg button:hover'],
  ])('%s has a hover state', (_name, selector) => {
    expect(shared.includes(selector), `${selector} missing`).toBe(true)
  })

  it.each(['.aether-tool:disabled', '.aether-chip:disabled', '.aether-seg button:disabled'])(
    '%s has a disabled state',
    (selector) => {
      // Seg and Chip both expose a `disabled` prop; without a rule it renders identically
      // to an enabled control, which is an API with no affordance behind it
      expect(shared.includes(selector), `${selector} missing`).toBe(true)
    },
  )
})

describe('every symbol a core module exports is reachable through the exports map', () => {
  /* The bug this exists for: `coerceNumberInput` and `numberStep` were documented as the public
     API for consumers writing their own numeric inputs, while missing from
     property-editor/core's barrel. The exports map declares only the barrel for that subpath and
     carries no wildcard, so the documented import failed with ERR_PACKAGE_PATH_NOT_EXPORTED --
     invisible to vue-tsc, eslint and every component test, because inside the package the symbol
     resolves fine by relative path.

     Stated as a rule rather than a list of expected names, so it also covers the next symbol
     someone adds: a symbol is reachable if its OWN module has an exports-map subpath, or if the
     barrel for its directory re-exports it. */
  const subpathTargets = new Set(
    Object.values(pkg.exports as Record<string, Record<string, string>>).flatMap((c) =>
      Object.values(c).map((t) => t.replace(/^\.\//, '')),
    ),
  )

  /* globSync returns platform separators -- on Windows every path came back with backslashes, so
     the /index.ts filter matched nothing and every module "failed". Normalise before comparing
     against package.json's forward-slash targets. */
  const coreModules = globSync('src/**/core/*.ts', { cwd: root, nodir: true })
    .map((f) => f.split(sep).join('/'))
    .filter((f) => !f.includes('__tests__') && !f.endsWith('.d.ts') && !f.endsWith('/index.ts'))

  it('finds core modules to check (guards against the glob silently matching nothing)', () => {
    expect(coreModules.length).toBeGreaterThan(3)
  })

  it.each(coreModules)('%s', (file) => {
    const dir = file.slice(0, file.lastIndexOf('/'))
    const barrelPath = `${dir}/index.ts`
    // a module with its own subpath (e.g. viz/core/gantt) is reachable directly
    if (subpathTargets.has(file)) return
    const barrel = readFileSync(resolve(root, barrelPath), 'utf8')
    const src = readFileSync(resolve(root, file), 'utf8')

    /* `core/` means framework-free, not public — those are different axes, and this test originally
     * conflated them. A module marked @internal is logic a component keeps to itself, and demanding
     * it be re-exported would force private helpers into the public API just to satisfy the check.
     * The marker has to be explicit: the invariant worth keeping is that a module intended as PUBLIC
     * is reachable, and intent that is never written down cannot be distinguished from an omission —
     * which is the exact bug this test was added to catch. */
    if (/@internal\b/.test(src)) return

    const exported = [
      ...Array.from(src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_]\w*)/gm), (m) => m[1]!),
      ...Array.from(src.matchAll(/^export\s+(?:const|class)\s+([A-Za-z_]\w*)/gm), (m) => m[1]!),
      ...Array.from(src.matchAll(/^export\s+(?:type|interface)\s+([A-Za-z_]\w*)/gm), (m) => m[1]!),
    ]

    /* Parse the barrel's export LISTS into a set of names, rather than substring-matching the
       file. A first attempt used new RegExp(`\b${name}\b`) and matched nothing at all: inside a
       JS string or template literal, \b is the BACKSPACE escape, not a word boundary, so it
       searched for control characters and reported every symbol unreachable. A set of parsed
       names has no escaping to get wrong, and it also will not be fooled by a name that appears
       only in a comment. */
    const reexported = new Set(
      Array.from(barrel.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g), (m) => m[1]!)
        .flatMap((inner) => inner.split(','))
        .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
        .filter(Boolean),
    )
    const unreachable = exported.filter((name) => !reexported.has(name))
    expect(
      unreachable,
      `${file} exports ${unreachable.join(', ')} but ${barrelPath} does not re-export them, and ` +
        `the exports map has no wildcard — a consumer cannot import them at all`,
    ).toEqual([])
  })
})
