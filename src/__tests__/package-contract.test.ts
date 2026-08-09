import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, globSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
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
