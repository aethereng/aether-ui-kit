#!/usr/bin/env node
/* Assert that every `exports` subpath survives into the copy a consumer actually receives.
 *
 * WHY THIS EXISTS. `@aether/ui-kit` is public, `type: module`, has no `main`, and declares 32
 * exports subpaths over 64 condition targets. That is the same manifest shape as the two quintus
 * packages that shipped unimportable — except this one is already published and already consumed,
 * by aether-os and quintus, as a tag-pinned git dependency. Nothing verified that any of those 64
 * targets reaches an installed copy. It is decision-log policy that a published package is
 * verified by executing what a consumer receives; the kit was the package where that had never
 * been done.
 *
 * WHAT WAS ALREADY THERE, AND WHY IT COULD NOT CATCH THIS. `src/__tests__/package-contract.test.ts`
 * has an assertion named "ships every exported file inside the published `files` globs". Its
 * predicate is:
 *
 *     globs.some((g) => !g.startsWith('!') && rel.startsWith(g.replace(/\/.*$/, '')))
 *
 * It FILTERS OUT the negation patterns — `!src/**\/__tests__` and `!src/**\/*.test.ts` are the only
 * two globs in `files` that can exclude anything — and then reduces each survivor to its first path
 * segment, so the test reduces to `rel.startsWith('src')`. Measured: it returns true for
 * `src/controls/vue/__tests__/Seg.dom.test.ts`, for `src/anything.test.ts`, and for
 * `srcXYZ/not-even-a-real-dir.ts`. The assertion cannot fail. A gate that matches everything and a
 * gate that matches nothing are the same defect wearing opposite signs.
 *
 * Its sibling assertion, "resolves to a file that exists", resolves against the WORKSPACE. Every
 * target exists there by construction; the question is whether it exists in the tarball, and a
 * workspace symlink is precisely what hides that.
 *
 * THE RUNTIME IS NOT NODE, SO THE QUINTUS GATE DOES NOT PORT. The kit publishes SOURCE — `files`
 * is `["src", "!src/**\/__tests__", "!src/**\/*.test.ts", "NOTICE"]` — so 30 of the 32 subpaths
 * point at `.vue` files, which Node cannot import at all. "Import it under Node" is the wrong
 * question here. The property is identical; the runtime is a bundler.
 *
 * THREE STAGES, and they answer three different questions:
 *
 *   PACK    every condition target is present in the extracted tarball. Cheap, and the one that
 *           catches the negation-pattern trap directly.
 *   GITDEP  the tarball an npm `pack` produces from the WORKSPACE and the one a git dependency
 *           produces from a CLEAN CLONE are compared file-for-file. A git install clones at the
 *           ref and packs honouring `files`, so it can only ever see committed files. Any file
 *           that is untracked or ignored but matches `files` is in one tree and not the other,
 *           and the consumer gets the smaller one. Exercised rather than assumed: the two paths
 *           are not the same code and the assumption that they agree is what this checks.
 *   BUNDLER a real Vite build importing all 32 subpaths FROM THE EXTRACT — not from the
 *           workspace, not through a `file:` link. A workspace symlink resolves a subpath whose
 *           target never left the repo, which is the whole class.
 *
 *   0 clean · 1 a subpath does not survive · 3 could not execute
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const NL = String.fromCharCode(10)  // no escape to lose (cascade 3.0)

const CLEAN = 0
const BLOCKING = 1
const CANNOT_RUN = 3

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPO = resolve(HERE, '..')

/** npm's own CLI, run under this node. `npm.cmd` cannot be spawned without a shell on current
 *  Node (the .cmd-injection fix), and `shell: true` would put every temp path through cmd.exe
 *  quoting for no gain. This is the same npm, one layer down. */
const NPM_CLI = (() => {
  const d = dirname(process.execPath)
  for (const p of [join(d, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
                   join(d, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')]) {
    if (existsSync(p)) return p
  }
  return null
})()

function sh(cmd, args, cwd, quiet = true) {
  let exe = cmd
  let argv = args
  if (cmd === 'npm') {
    if (!NPM_CLI) throw new Error('npm CLI not found beside this node executable')
    exe = process.execPath
    argv = [NPM_CLI, ...args]
  }
  return execFileSync(exe, argv, {
    cwd, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
}

/** Every file under `dir`, as POSIX-relative paths. `sep` rather than a literal backslash: a
 *  backslash in a string is one more escape to lose, and cascade §3.0 is about exactly that. */
function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, base, out)
    else out.push(p.slice(base.length + 1).split(sep).join('/'))
  }
  return out
}

/** exports -> [{subpath, condition, target}], one row per condition. */
export function conditionTargets(pkg) {
  const rows = []
  for (const [subpath, val] of Object.entries(pkg.exports ?? {})) {
    const conds = typeof val === 'string' ? { default: val } : val
    for (const [condition, target] of Object.entries(conds)) {
      if (typeof target !== 'string') continue
      rows.push({ subpath, condition, target: target.replace(/^\.\//, '') })
    }
  }
  return rows
}

/** npm pack in `cwd`, extract, return {dir, files}. */
function packAndExtract(cwd, label, work) {
  const dest = join(work, label)
  mkdirSync(dest, { recursive: true })
  sh('npm', ['pack', '--pack-destination', dest, '--silent'], cwd)
  const tgz = readdirSync(dest).find((f) => f.endsWith('.tgz'))
  if (!tgz) throw new Error(`${label}: npm pack produced no tarball`)
  sh('tar', ['xzf', tgz], dest)
  const root = join(dest, 'package')
  return { dir: root, files: new Set(walk(root)) }
}

async function main() {
  const argv = process.argv.slice(2)
  let repo = DEFAULT_REPO
  let skipBundler = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') repo = resolve(argv[++i])
    if (argv[i] === '--skip-bundler') skipBundler = true
  }

  const problems = []
  const blocked = []
  let work
  try {
    work = mkdtempSync(join(tmpdir(), 'kit-exports-'))
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))
    const rows = conditionTargets(pkg)
    if (!rows.length) {
      console.error('check-exports: package.json declares no exports subpaths')
      process.exit(CANNOT_RUN)
    }

    // --- RUNTIME: the bundler-only decision, checked rather than assumed ---
    // RULED 2026-08-25, Platform, as owner of this package: @aether/ui-kit is BUNDLER-ONLY. It is
    // not a preference, it is what the manifest already is -- 27 of the 32 import targets are
    // .vue, 4 are .ts and 1 is .css, and Node can import none of those. That is why quintus's
    // "import it under Node" gate does not port, and why the dynamic half above is a Vite build.
    //
    // Recorded here as well as in README.md so it cannot decay into folklore. If someone adds a
    // .js or .mjs subpath, the bundler-only premise no longer covers the package -- a consumer
    // could reasonably require() it and find nothing has ever executed it under Node -- and this
    // stops rather than letting the new assumption inherit the old exemption silently.
    const BUNDLER_EXT = ['.vue', '.ts', '.tsx', '.css']
    const nodeish = rows.filter((r) => r.condition !== 'types'
      && !BUNDLER_EXT.some((e) => r.target.endsWith(e)))
    if (nodeish.length) {
      problems.push(
        'RUNTIME -- ' + nodeish.length + ' subpath target(s) are not bundler-compiled sources: '
        + nodeish.map((r) => r.subpath + ' -> ' + r.target).join(', ') + '. This package is ruled '
        + 'bundler-only (README.md), which is why nothing here imports it under Node. A target '
        + 'Node could plausibly load needs that decision revisited and a Node-runtime stage added, '
        + 'not an exemption inherited from the .vue targets beside it.')
    }
    console.log('  runtime: bundler-only, ' + (rows.length - nodeish.length) + ' of ' + rows.length
      + ' targets are bundler-compiled sources or type declarations')

    // --- GITDEP: what a git dependency actually installs, i.e. a clean clone at HEAD ---
    const clone = join(work, 'clone')
    let cloned = true
    try {
      sh('git', ['clone', '--quiet', '--no-hardlinks', repo, clone], work)
      sh('git', ['checkout', '--quiet', 'HEAD'], clone)
    } catch (e) {
      cloned = false
      blocked.push(`could not clone ${repo} to model the git-dependency install: ${String(e.message).split('\n')[0]}`)
    }

    const fromWorkspace = packAndExtract(repo, 'workspace', work)
    const fromClone = cloned ? packAndExtract(clone, 'clone', work) : null

    if (fromClone) {
      const onlyWs = [...fromWorkspace.files].filter((f) => !fromClone.files.has(f))
      const onlyCl = [...fromClone.files].filter((f) => !fromWorkspace.files.has(f))
      if (onlyWs.length || onlyCl.length) {
        problems.push(
          `GITDEP — npm pack from the workspace and from a clean clone disagree. A git dependency ` +
          `installs the CLONE's tree, so anything present only in the workspace is a file the ` +
          `consumer does not get.\n` +
          onlyWs.slice(0, 10).map((f) => `      workspace only: ${f}`).join('\n') +
          (onlyWs.length > 10 ? `\n      … and ${onlyWs.length - 10} more` : '') +
          (onlyCl.length ? '\n' + onlyCl.slice(0, 10).map((f) => `      clone only: ${f}`).join('\n') : ''),
        )
      }
    }

    // --- PACK: every condition target present in what the consumer receives ---
    // Checked against the CLONE's tarball when there is one: that is the tree a git dependency
    // installs, and it is the smaller of the two whenever they differ.
    const consumer = fromClone ?? fromWorkspace
    const which = fromClone ? 'clean-clone tarball' : 'workspace tarball'
    for (const r of rows) {
      if (!consumer.files.has(r.target)) {
        problems.push(
          `PACK — ${r.subpath} [${r.condition}] -> ${r.target} is NOT in the ${which}. ` +
          `It resolves in the workspace and 404s for anyone who installs the package.`,
        )
      }
    }
    console.log(`  pack: ${rows.length} condition targets over ${Object.keys(pkg.exports).length} ` +
      `subpaths, against the ${which} (${consumer.files.size} files)`)

    // --- BUNDLER: a real build, importing every subpath from the extract ---
    if (skipBundler) {
      console.log('  bundler: skipped (--skip-bundler)')
    } else if (problems.length) {
      console.log('  bundler: not run — a target is already missing, so a build failure would ' +
        'only restate it')
    } else {
      // A REAL CONSUMER INSTALL, not an alias. Aliasing the package name to the extract would
      // bypass the exports map entirely and resolve `@aether/ui-kit/controls/seg` as a directory
      // path -- which is not what a consumer does, and the exports map is the thing under test.
      // The tarball goes into node_modules where npm would put it, so Vite's resolver reads the
      // package's own exports field.
      // A REAL CONSUMER INSTALL, not an alias. Aliasing the package name to the extract would
      // bypass the exports map and resolve the subpath as a directory path -- which is not what a
      // consumer does, and the exports map is the thing under test. The tarball goes into
      // node_modules where npm would put it, so Vite's resolver reads the package's own exports.
      const app = join(work, 'app')
      const installed = join(app, 'node_modules', ...pkg.name.split('/'))
      mkdirSync(join(app, 'src'), { recursive: true })
      mkdirSync(dirname(installed), { recursive: true })
      cpSync(consumer.dir, installed, { recursive: true })

      const subpaths = Object.keys(pkg.exports)
      const src = []
      subpaths.forEach((sp, i) => {
        src.push('import * as m' + i + ' from ' + JSON.stringify(pkg.name + sp.slice(1)))
      })
      src.push('const all = [' + subpaths.map((_, i) => 'm' + i).join(', ') + ']')
      src.push("if (all.some((m) => m == null)) throw new Error('a subpath imported as null')")
      src.push('export default all.length')
      writeFileSync(join(app, 'src', 'main.ts'), src.join(NL) + NL)

      // vite and the vue plugin are imported FROM THIS FILE, which lives in the kit, so they
      // resolve out of the kit's own node_modules -- the versions its consumers build against.
      // No network, and no config file in a temp directory that cannot resolve either of them.
      let build = null
      let vue = null
      try {
        ;({ build } = await import('vite'))
        vue = (await import('@vitejs/plugin-vue')).default
      } catch (e) {
        blocked.push('vite or @vitejs/plugin-vue not importable from the kit ('
          + String(e.message).split(NL)[0] + ') -- run npm ci here; a bundler check that could not '
          + 'run must not report as one that passed')
      }
      if (build) {
        try {
          await build({
            root: app,
            logLevel: 'silent',
            configFile: false,
            plugins: [vue()],
            build: {
              write: false,
              lib: { entry: join(app, 'src', 'main.ts'), formats: ['es'], fileName: 'out' },
              rollupOptions: { external: ['vue'] },
            },
          })
          console.log('  bundler: vite resolved and built all ' + subpaths.length
            + " subpaths through the installed package's own exports map")
        } catch (e) {
          problems.push('BUNDLER -- vite could not build an entry importing all ' + subpaths.length
            + ' subpaths from the installed tarball:' + NL
            + String(e.message).split(NL).slice(0, 8).map((l) => '      ' + l).join(NL))
        }
      }
    }
  } catch (e) {
    blocked.push(String(e.message).split('\n')[0])
  } finally {
    if (work) { try { rmSync(work, { recursive: true, force: true }) } catch { /* temp */ } }
  }

  if (blocked.length) {
    console.error('\ncheck-exports: COULD NOT EXECUTE\n')
    for (const b of blocked) console.error(`  - ${b}`)
    console.error('\nA package that could not be verified is not a package that passed.')
    process.exit(CANNOT_RUN)
  }
  if (problems.length) {
    console.error('\ncheck-exports: FAILED\n')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(BLOCKING)
  }
  console.log('\ncheck-exports: clean — every exports subpath survives into an installed copy.')
  process.exit(CLEAN)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main()
