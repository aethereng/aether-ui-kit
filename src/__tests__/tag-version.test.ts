// The release procedure, which lives outside this repo, runs scripts/check-tag-version.mjs before it cuts a tag.
// These run the script as a child process, as that procedure does, and read its exit code. No test here tags anything.
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

describe('the release workflow runs the same check before anything is built', () => {
  const WORKFLOW = readFileSync(resolve(__dirname, '../../.github/workflows/deploy-gallery.yml'), 'utf8')

  /* The steps of the build job, each block running from one step's dash to the next. A `run:` or `if:`
   * counts only where it opens a line, so a comment that names the same command is not a step. */
  const stepsOf = (text: string) => text.slice(text.indexOf('\n    steps:')).split(/\n(?= {6}- )/).slice(1)

  /* The guard is a step limited to tag pushes, and the install and the build come after it, in step order. */
  const guardFirst = (text: string) => {
    const steps = stepsOf(text)
    const guard = steps.findIndex((s) => /^ *(- )?run: node scripts\/check-tag-version\.mjs/m.test(s))
    const install = steps.findIndex((s) => /^ *(- )?run: npm ci$/m.test(s))
    const build = steps.findIndex((s) => /^ *(- )?run: npm run build$/m.test(s))
    return (
      guard > -1 &&
      /^ +if: startsWith\(github\.ref, 'refs\/tags\/'\)$/m.test(steps[guard]!) &&
      install > guard &&
      build > guard
    )
  }

  it('the package script names the same check, so the release procedure can run it before cutting a tag', () => {
    const scripts = (PACKAGE as { scripts?: Record<string, string> }).scripts ?? {}
    expect(scripts['tag:check']).toBe('node scripts/check-tag-version.mjs')
  })

  it('the first step on a tag push runs the check, before the install and the build', () => {
    expect(guardFirst(WORKFLOW)).toBe(true)
  })

  it('negative arm: a workflow whose check is not the first step, or is not limited to tags, fails the pin', () => {
    expect(guardFirst(WORKFLOW.replace('run: node scripts/check-tag-version.mjs', 'run: echo skipped'))).toBe(false)
    expect(guardFirst(WORKFLOW.replace("if: startsWith(github.ref, 'refs/tags/')", 'if: always()'))).toBe(false)
    const moved = WORKFLOW.replace('run: node scripts/check-tag-version.mjs "${GITHUB_REF_NAME}"', 'run: echo skipped').replace(
      '- run: npm ci',
      '- run: npm ci\n      - run: node scripts/check-tag-version.mjs "${GITHUB_REF_NAME}"',
    )
    expect(guardFirst(moved)).toBe(false)
  })

  it('negative arm: a guard named only in a comment, with the real step gone, is not a step', () => {
    const commented = WORKFLOW.replace('run: node scripts/check-tag-version.mjs "${GITHUB_REF_NAME}"', 'run: echo skipped').replace(
      '      - run: npm ci',
      '      # run: node scripts/check-tag-version.mjs "${GITHUB_REF_NAME}"\n      - run: npm ci',
    )
    expect(guardFirst(commented)).toBe(false)
  })
})
