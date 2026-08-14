/* Fails if an internal name reaches the published surface of this PUBLIC repo.
 *
 * This existed as inline shell inside the CI workflow and nothing else, which is precisely how it
 * failed: an internal name entered a CSS comment in v0.4.1 and CI stayed red across four tagged
 * releases without anyone noticing, because the local gate sequence (type-check, tests, build,
 * declarations) never ran it. A check that only exists in CI is a check you find out about late.
 * It is an npm script now, and the workflow calls the same script, so there is one implementation
 * and it is runnable before pushing.
 *
 * Node rather than shell so it behaves the same on Windows, where npm hands scripts to cmd.exe
 * and there is no grep.
 *
 *   npm run guard:names
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/* Product and surface names that must not appear in anything published from here. Deliberately
   narrow: it must NOT match this project's own identity -- "@aether/ui-kit",
   "aethereng/aether-ui-kit", "aethereng.github.io", "Aether Engineering" -- all of which are
   asserted against below. A guard that cries wolf gets deleted. */
const PATTERN = /quintus|etere|aetheros|aether-os|deskos|desk-os/i

/* Names that MUST stay allowed. Checked on every run, so widening PATTERN can never silently
   start matching the project's own identity. */
const MUST_NOT_MATCH = [
  '@aether/ui-kit',
  'aethereng/aether-ui-kit',
  'https://aethereng.github.io/aether-ui-kit/',
  'Aether Engineering',
  'aether-ui-kit',
]

const SCAN = ['src', 'package.json', 'README.md', '.github']

/* Files that legitimately contain the pattern because they ARE the guard. Without these the guard
   matches itself and fails on a clean tree -- which is exactly what the first version did. */
const SELF = ['scripts/guard-names.mjs', '.github/workflows/deploy-gallery.yml']

function walk(p, out = []) {
  const abs = join(ROOT, p)
  let st
  try {
    st = statSync(abs)
  } catch {
    return out // a scan path that does not exist is not a failure
  }
  if (st.isFile()) {
    out.push(p)
    return out
  }
  for (const name of readdirSync(abs)) walk(join(p, name), out)
  return out
}

const selfCheck = MUST_NOT_MATCH.filter((s) => PATTERN.test(s))
if (selfCheck.length) {
  console.error("guard-names: PATTERN matches this project's own identity: " + selfCheck.join(', '))
  console.error('Narrow the pattern — as written it would fail on a clean tree.')
  process.exit(2)
}

const hits = []
for (const target of SCAN) {
  for (const file of walk(target)) {
    const rel = relative(ROOT, join(ROOT, file)).split(sep).join('/')
    if (SELF.includes(rel)) continue
    let text
    try {
      text = readFileSync(join(ROOT, file), 'utf8')
    } catch {
      continue // unreadable or binary
    }
    text.split('\n').forEach((line, i) => {
      if (PATTERN.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`)
    })
  }
}

if (hits.length) {
  console.error(`guard-names: ${hits.length} internal name(s) in the published surface:\n`)
  for (const h of hits) console.error('  ' + h)
  console.error('\nThis repo is public. Rewrite the reference without naming the internal surface.')
  process.exit(1)
}

console.log('guard-names: clean — no internal names in the published surface.')
