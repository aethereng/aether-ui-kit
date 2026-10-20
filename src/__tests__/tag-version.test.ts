// The tag step runs scripts/check-tag-version.mjs before it cuts a tag. These run the script as the tag step
// does, as a child process, and read its exit code. No test here tags anything.
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SCRIPT = resolve(__dirname, '../../scripts/check-tag-version.mjs')
const PACKAGE = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as { version: string }

const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })

describe('the tag step names a tag only as the package version', () => {
  it('passes the tag that names the version package.json states', () => {
    const r = run(`v${PACKAGE.version}`)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(`is package.json's version ${PACKAGE.version}`)
  })

  it('negative arm: a tag naming another version is refused with exit 1, and says why', () => {
    const r = run('v9.9.9')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain(`package.json says ${PACKAGE.version}`)
  })

  it('negative arm: a tag without the leading v is refused, since the tag names the version with it', () => {
    const r = run(PACKAGE.version)
    expect(r.status).toBe(1)
  })

  it('negative arm: no tag given does not run, and exits 3 rather than passing', () => {
    expect(run().status).toBe(3)
  })
})
