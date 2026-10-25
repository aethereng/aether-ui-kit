#!/usr/bin/env node
/* Refuse a release tag that names another version than package.json states. The release procedure,
 * which lives outside this repo, runs this before it cuts the tag (`npm run tag:check -- vX.Y.Z`), so no
 * tag sits on a commit whose package.json says a different version: a consumer pins the tag, and the
 * version it reads from the package is the one the tag names.
 *
 * usage: node scripts/check-tag-version.mjs v0.23.0
 *   0 the tag is the package's version · 1 the tag names another version · 3 could not run
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CLEAN = 0
const MISMATCH = 1
const CANNOT_RUN = 3

const tag = process.argv[2]
if (!tag) {
  console.error('check-tag-version: no tag given; usage: node scripts/check-tag-version.mjs vX.Y.Z')
  process.exit(CANNOT_RUN)
}

let version
try {
  version = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version
} catch (e) {
  console.error(`check-tag-version: cannot read the version from package.json: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(CANNOT_RUN)
}
if (typeof version !== 'string' || version === '') {
  console.error('check-tag-version: package.json has no version string')
  process.exit(CANNOT_RUN)
}

if (tag !== `v${version}`) {
  console.error(`check-tag-version: tag ${tag} is refused; package.json says ${version}, so the tag must be v${version}. Set the version, commit, then tag.`)
  process.exit(MISMATCH)
}
console.log(`check-tag-version: ${tag} is package.json's version ${version}`)
process.exit(CLEAN)
