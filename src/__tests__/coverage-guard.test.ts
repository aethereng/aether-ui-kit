import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPONENTS } from '../gallery/meta'

/* TWO GUARDS OVER THE GALLERY AND THE SUITE, both for failures that are silent by nature.
 *
 * A component can ship, or move directory, and lose its tests without anything going red: the
 * suite still passes, with one fewer file in it. That happened three times: Chip shipped with no
 * test file at all and an accessibility defect that survived months in the control behind every
 * filter rail in both apps; DateField lost its coverage moving out of property-editor/; and
 * Transport was skipped knowingly, with `package-contract.test.ts` noting the gap in a comment
 * rather than failing on it.
 *
 * And meta.ts hand-transcribes each component's props, emits and slots. Its own header says what
 * happens when it drifts ("the gallery is lying") and nothing checked. Adding Tool's `#trailing`
 * slot required remembering to update it by hand, which is exactly the shape of thing nobody
 * remembers twice. */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const all = walk(SRC)
const testFiles = all.filter((p) => p.includes('__tests__') && p.endsWith('.ts'))
const testText = testFiles.map((p) => readFileSync(p, 'utf8')).join('\n')

/** Every shipped Vue component: the gallery's own files are chrome, not product. */
const components = all
  .filter((p) => p.endsWith('.vue') && !p.includes('gallery'))
  .map((p) => basename(p, '.vue'))

describe('every component is exercised by the suite', () => {
  it.each(components)('%s is mounted by at least one test', (name) => {
    /* Mounted, not merely mentioned: a component named only in a comment is how Transport looked
     * covered. `mount(X` is the shape every suite here uses. */
    expect(testText).toContain(`mount(${name}`)
  })

  it('the suite has not quietly shrunk', () => {
    expect(testFiles.length).toBeGreaterThanOrEqual(29)
    expect(components.length).toBeGreaterThanOrEqual(26)
  })
})

describe('meta.ts describes the components as they actually are', () => {
  /* Names only, deliberately. The `note` fields are editorial and often better than the JSDoc for
   * someone browsing the gallery, so this does not try to generate them; it only checks that the
   * gallery cannot document a prop that does not exist, or miss one that does. */
  const sourceOf = (id: string): string | null => {
    const meta = COMPONENTS.find((c) => c.id === id)!
    const file = all.find(
      (p) => p.endsWith('.vue') && !p.includes('gallery') && basename(p) === `${meta.name}.vue`,
    )
    return file ? readFileSync(file, 'utf8') : null
  }

  /* A prop reaches the component either inline in defineProps or through an exported *Props
     interface, so the check looks at the component text plus core/types.ts. */
  const types = readFileSync(join(SRC, 'controls', 'core', 'types.ts'), 'utf8')

  it.each(COMPONENTS.map((c) => [c.id, c.name] as const))(
    '%s documents only props the component declares',
    (id) => {
      const src = sourceOf(id)
      if (!src) return // a section whose component lives outside controls/ (covered by its own file)
      const meta = COMPONENTS.find((c) => c.id === id)!
      const hay = src + types
      /* A row may document several props at once: `min / max / step` is one row for three props
         that all pass straight to the native input. Split rather than forbid it: the combined row
         reads better in the table, and each name still has to exist. */
      for (const row of meta.props) {
        for (const name of row.name.split('/').map((n) => n.trim())) {
          expect(hay, `${meta.name}: meta documents prop \`${name}\` that the source does not declare`)
            .toContain(name)
        }
      }
      for (const row of meta.slots ?? []) {
        /* The default slot has no name in the source; it is `<slot />`. Every other slot is
           `name="x"`, so that is what gets looked for. */
        const needle = row.name === 'default' ? '<slot />' : row.name
        expect(src, `${meta.name}: meta documents slot \`${row.name}\` that the source does not declare`)
          .toContain(needle)
      }
      for (const row of meta.emits ?? []) {
        expect(src, `${meta.name}: meta documents emit \`${row.name}\` that the source does not emit`)
          .toContain(row.name)
      }
    },
  )
})

describe('the site shows what the kit ships', () => {
  /* The README sends a reader to the site for the components, and a part that ships with no section
   * is invisible there with every test green. So a part is either on the site or on this list, and
   * the README's sentence names the same list. */
  const NOT_ON_THE_SITE = ['Icon', 'RecordField', 'RecordTable']
  const app = readFileSync(join(SRC, 'gallery', 'App.vue'), 'utf8')
  const readme = readFileSync(join(SRC, '..', 'README.md'), 'utf8')

  it('has a section for every shipped part, but for the ones listed', () => {
    const named = new Set(COMPONENTS.map((c) => c.name))
    expect([...new Set(components)].filter((n) => !named.has(n)).sort()).toEqual(NOT_ON_THE_SITE)
  })

  it.each(COMPONENTS.map((c) => [c.id, c.name] as const))('%s renders its own example', (id, name) => {
    expect(existsSync(join(SRC, 'gallery', 'examples', `${name}Example.vue`)), `${name}Example.vue`).toBe(true)
    const branch = app.slice(app.indexOf(`c.id === '${id}'`))
    expect(app, `App.vue has no branch for ${id}`).toContain(`c.id === '${id}'`)
    expect(branch.slice(0, branch.indexOf('</GSection>'))).toContain(`<${name}Example />`)
  })

  it('and the README says which are not there', () => {
    const start = readme.indexOf('\n## Gallery')
    expect(start, 'precondition: the section was found').toBeGreaterThan(0)
    const section = readme.slice(start, readme.indexOf('\n## ', start + 1))
    for (const name of NOT_ON_THE_SITE) expect(section).toContain(`\`${name}\``)
    expect(section).not.toMatch(/every component/i)
  })
})
