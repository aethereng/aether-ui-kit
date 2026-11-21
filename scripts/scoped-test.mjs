#!/usr/bin/env node
/**
 * The two ways to run this repository's tests: a scoped run of named tests under a wall-clock limit,
 * and the milestone run of the full suite with no limit.
 *
 *     npm test -- <runner> <target...> [-- <runner arguments>]      a scoped run
 *     npm run test:full                                             the milestone run, every part
 *     npm run test:full -- <part...>                                some parts of it
 *     npm run test:full -- <runner> <target...> [-- <arguments>]    named tests, with no limit
 *
 * The runners and the milestone parts of this repository are in `scripts/scoped-test.json`, beside
 * this file. `npm test` with no runner, or a runner with no target, prints both and exits 3: a run
 * of everything is never what the scoped command does by default. `npm test -- --milestone` is
 * refused too: the run with no limit is `npm run test:full` and nothing else.
 *
 * THE LIMIT. A scoped run stops at LIMIT_S seconds of wall clock from its start, listing included.
 * At the limit it reads the process table, ends the runner and every process started under it by
 * PID (pytest-xdist workers, the test binaries cargo starts, vitest's forks), reads the table again
 * and names any process that outlived that. It then prints what the run did not reach and exits 3.
 * The limit applies per call. A change is tested twice, once before the work starts and once before
 * it is pushed, and two calls at this limit make the 20 minutes those two runs may take together. A
 * per-call limit keeps no state between calls, so no stale record can stop a run early or let one
 * run long. `--limit <seconds>` (or `--limit=<seconds>`), anywhere before the runner's own `--`,
 * lowers it for one call and never raises it.
 *
 * EVERY CHILD KNOWS WHICH RUN STARTED IT. The runner sets SCOPED_TEST_RUN to `scoped` or `full` in
 * the environment of everything it starts. A suite guard that refuses a run without it cannot be
 * started bare by a habit, only through one of the two commands above.
 *
 * WHAT IT DID NOT REACH. Before or during the run it records the population the run selected and
 * every result it reports, so a stopped run can name the rest:
 *     pytest      every test id: a plugin records the collected ids and each result (xdist included)
 *     cargo       every test name: `cargo test ... -- --list` first, then the run's own result lines
 *     vitest      every test file: `vitest list --filesOnly` first; a reporter records each file and
 *                 each test as it ends
 *     playwright  every test: a reporter records the tests the run selected, then each result
 *     node        every named file: a reporter records each test as it ends
 *     suite       every named suite file
 * A run that reports no result at all fails: a selection that matched nothing is not a pass. A
 * skipped or ignored test is counted apart from a passing one, and a run whose every result was a
 * skip fails. A pytest test that the run's own `-m` or `-k` leaves out is counted apart again.
 *
 * WHAT IT CANNOT END. A process whose parent exited before the limit is no longer under the runner
 * in the process table, so the kill does not find it; it is not named afterwards either. On Linux
 * and macOS the runner starts its child in a group of its own, so Ctrl-C at the terminal stops the
 * runner and not that group: end it with the group's PID.
 *
 * Exit: 0 every selected test ran, and at least one passed · 1 a test failed, or the run examined
 * nothing, or it left part of its selection unreached, or it skipped everything · 3 refused (no
 * target, a bad argument, a runner that is not installed) or stopped at the limit.
 *
 * The milestone run prints that it is one on its first line, runs every part to its end whatever
 * an earlier part did, and exits 0 only when every part passed.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const LIMIT_S = 600
const PASS = 0
const FAIL = 1
const STOP = 3
const NL = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const WIN = process.platform === 'win32'
const TABLE_BOUND_MS = 60_000
const CLOSE_GRACE_MS = 10_000
const SHOWN = 20

const say = (line = '') => process.stdout.write(line + NL)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = join(ROOT, 'scripts', 'scoped-test.json')
const slash = (p) => p.split(sep).join('/')

function usage() {
  const runners = Object.keys(CONFIG.runners).join(', ')
  const parts = CONFIG.milestone.map((p) => p.name).join(', ')
  return [
    `  Named tests:      npm test -- <runner> <target...> [-- <runner arguments>]   at most ${LIMIT_S} s per call`,
    `                    runners here: ${runners}`,
    `  A milestone:      npm run test:full [-- <part...>]   no limit; parts here: ${parts}`,
  ]
}

function refuse(reason) {
  say(`scoped test: REFUSED, ${reason}`)
  for (const line of usage()) say(line)
  process.exit(STOP)
}

let CONFIG
try {
  CONFIG = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
} catch (err) {
  say(`scoped test: REFUSED, ${slash(relative(ROOT, CONFIG_PATH))} is unreadable (${err.message})`)
  process.exit(STOP)
}
for (const part of CONFIG.milestone) {
  if (CONFIG.runners[part.name]) {
    say(`scoped test: REFUSED, the milestone part '${part.name}' has a runner's name, so a call naming it would be ambiguous`)
    process.exit(STOP)
  }
}

// ── commands ────────────────────────────────────────────────────────────────────────────────────

/** The interpreter a `{python}` token stands for: the repository's own virtual environment where
 *  it has one, else `python` from PATH. */
function python() {
  const venv = join(ROOT, '.venv', WIN ? 'Scripts' : 'bin', WIN ? 'python.exe' : 'python')
  return existsSync(venv) ? venv : 'python'
}

/** The nearest installed binary, walking up from `cwd`; null where none is installed. */
function bin(name, cwd) {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const p = join(dir, 'node_modules', '.bin', WIN ? `${name}.cmd` : name)
    if (existsSync(p)) return p
    if (dirname(dir) === dir) return null
  }
}

/** A configured command with its tokens resolved: `{python}` and `{bin:NAME}`. */
function resolveCommand(words, cwd) {
  return words.map((w) => {
    if (w === '{python}') return python()
    if (w.startsWith('{bin:') && w.endsWith('}')) {
      const name = w.slice(5, -1)
      const found = bin(name, cwd)
      if (!found) refuse(`${name} is not installed under ${slash(relative(ROOT, cwd)) || '.'} (run npm ci first)`)
      return found
    }
    return w
  })
}

const QUOTED = new Set([' ', '"', '&', '|', '<', '>', '^', '(', ')', '%', '!', ';', ',', '='])
const quote = (word) => ([...word].some((c) => QUOTED.has(c)) ? `"${word.split('"').join('""')}"` : word)

/** A target as a session names it: from the directory the command runs in where that holds it (an
 *  npm script runs in its own workspace), else from the repository root. */
function locate(target) {
  const [path, ...rest] = target.split('::')
  const here = resolve(process.cwd(), path)
  const at = !isAbsolute(path) && existsSync(here) ? here : resolve(ROOT, path)
  return { at, rest }
}

// ── the process table and the kill ──────────────────────────────────────────────────────────────

/** Every process running now as {pid, ppid, name, started}, or null when the table is unreadable.
 *  `started` is milliseconds since the epoch on Windows and null elsewhere. */
function processTable() {
  if (WIN) {
    const r = spawnSync(
      join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,@{n='Started';e={([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds()}} | ConvertTo-Json -Compress",
      ],
      { encoding: 'utf8', timeout: TABLE_BOUND_MS, maxBuffer: 1 << 26 },
    )
    if (r.status !== 0) return null
    try {
      const rows = JSON.parse(r.stdout)
      return (Array.isArray(rows) ? rows : [rows]).map((p) => ({
        pid: p.ProcessId,
        ppid: p.ParentProcessId,
        name: p.Name,
        started: p.Started,
      }))
    } catch {
      return null
    }
  }
  const r = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,comm='], { encoding: 'utf8', timeout: TABLE_BOUND_MS })
  if (r.status !== 0) return null
  return r.stdout
    .split(NL)
    .map((line) => line.trim().split(' ').filter(Boolean))
    .filter((w) => w.length >= 3)
    .map((w) => ({ pid: Number(w[0]), ppid: Number(w[1]), name: w.slice(2).join(' '), started: null }))
}

/** `roots` and every process started under them after `since`. The start time keeps a recycled
 *  parent PID from adopting a process that is not ours. */
function treeOf(table, roots, since) {
  const out = []
  const seen = new Set()
  const queue = [...roots]
  while (queue.length) {
    const pid = queue.shift()
    if (seen.has(pid)) continue
    seen.add(pid)
    const row = table.find((p) => p.pid === pid)
    if (row) out.push(row)
    for (const p of table) if (p.ppid === pid && !(p.started !== null && p.started < since)) queue.push(p.pid)
  }
  return out
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Ends `root` and everything under it, by PID. A second pass takes what the first pass's
 *  processes started meanwhile. Returns what was ended and what is alive afterwards. */
function endTree(root, since) {
  const ended = new Map()
  for (let pass = 0; pass < 2; pass++) {
    const table = processTable()
    if (table === null) break
    for (const p of treeOf(table, [root, ...ended.keys()], since)) {
      if (p.pid === process.pid) continue
      ended.set(p.pid, p)
      try {
        process.kill(p.pid, 'SIGKILL')
      } catch {
        // gone already; the table read below says what is alive
      }
    }
    if (!WIN) {
      try {
        process.kill(-root, 'SIGKILL')
      } catch {
        // the group is gone
      }
    }
    pause(500)
  }
  if (ended.size === 0) {
    try {
      process.kill(root, 'SIGKILL')
    } catch {
      // gone already
    }
  }
  const after = processTable()
  const left =
    after === null
      ? null
      : after.filter((p) => {
          const was = ended.get(p.pid)
          return was !== undefined && (was.started === null || was.started === p.started)
        })
  return { ended: [...ended.values()], left }
}

// ── one child process, bounded by the run's deadline ────────────────────────────────────────────

let MODE = 'scoped'

/**
 * Runs one command, echoing its output and handing each line to `onLine`. Resolves with
 * {code, stopped, ended, left}; `stopped` is true when the deadline ended it. A deadline of
 * Infinity sets no timer at all. The child's environment carries SCOPED_TEST_RUN.
 */
function runOne(words, cwd, env, deadline, onLine) {
  return new Promise((done) => {
    const since = Date.now() - 2000
    const [cmd, ...args] = words
    const childEnv = { ...env, SCOPED_TEST_RUN: MODE }
    say(`scoped test: running ${[slash(relative(ROOT, cwd)) || '.', '$', ...words.map(quote)].join(' ')}`)
    const child = WIN
      ? spawn([cmd, ...args].map(quote).join(' '), [], { cwd, env: childEnv, shell: true, windowsHide: true })
      : spawn(cmd, args, { cwd, env: childEnv, detached: true })
    let stopped = null
    let finished = false
    const pending = { out: '', err: '' }
    const feed = (which, stream) => (chunk) => {
      stream.write(chunk)
      pending[which] += chunk.toString('utf8')
      const lines = pending[which].split(NL)
      pending[which] = lines.pop()
      for (const line of lines) onLine(line.endsWith(CR) ? line.slice(0, -1) : line)
    }
    child.stdout.on('data', feed('out', process.stdout))
    child.stderr.on('data', feed('err', process.stderr))
    const finish = (code) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      clearTimeout(grace)
      for (const rest of [pending.out, pending.err]) if (rest) onLine(rest)
      done({ code, stopped: stopped !== null, ended: stopped?.ended ?? [], left: stopped?.left ?? [] })
    }
    let grace
    const timer =
      deadline === Infinity
        ? undefined
        : setTimeout(() => {
            say()
            say(`scoped test: LIMIT REACHED, ending process ${child.pid} and everything started under it, by PID`)
            stopped = endTree(child.pid, since)
            // an orphan can hold the pipes open after its parent is gone; do not wait on it forever
            grace = setTimeout(() => {
              child.stdout.destroy()
              child.stderr.destroy()
              finish(null)
            }, CLOSE_GRACE_MS)
          }, Math.max(0, deadline - Date.now()))
    child.on('error', (err) => {
      say(`scoped test: could not start ${cmd}: ${err.message}`)
      finish(-1)
    })
    child.on('close', (code) => finish(code))
  })
}

// ── reporters, written to a scratch directory for one run ───────────────────────────────────────

const PYTEST_PLUGIN = [
  'import os',
  'import pytest',
  '',
  'OUT = os.environ.get("SCOPED_TEST_REACH")',
  'WORKER = os.environ.get("PYTEST_XDIST_WORKER")',
  '_listed = []',
  '',
  '',
  'def _write(kind, text):',
  '    if OUT and not WORKER:',
  '        with open(OUT, "a", encoding="utf-8") as f:',
  '            f.write(kind + " " + text + chr(10))',
  '',
  '',
  'def pytest_collection_finish(session):',
  '    for item in session.items:',
  '        _write("POP", item.nodeid)',
  '',
  '',
  '@pytest.hookimpl(optionalhook=True)',
  'def pytest_xdist_node_collection_finished(node, ids):',
  '    if not _listed:',
  '        _listed.append(node)',
  '        for nodeid in ids:',
  '            _write("POP", nodeid)',
  '',
  '',
  'def pytest_deselected(items):',
  '    # every xdist worker deselects the same items, so the first one speaks for them',
  '    if OUT and WORKER in (None, "gw0"):',
  '        with open(OUT, "a", encoding="utf-8") as f:',
  '            for item in items:',
  '                f.write("DESEL " + item.nodeid + chr(10))',
  '',
  '',
  'def pytest_runtest_logreport(report):',
  '    if report.when == "call" or (report.when == "setup" and report.outcome != "passed"):',
  '        _write("RAN", report.outcome + " " + report.nodeid)',
  '',
].join(NL)

const VITEST_REPORTER = [
  "import { appendFileSync } from 'node:fs'",
  '',
  'const out = process.env.SCOPED_TEST_REACH',
  'const line = (text) => out && appendFileSync(out, text + String.fromCharCode(10))',
  '',
  'export default class ScopedTestReach {',
  '  onTestCaseResult(testCase) {',
  "    line('CASE ' + testCase.result().state + ' ' + testCase.module.moduleId)",
  '  }',
  '  onTestModuleEnd(testModule) {',
  "    line('RAN ' + testModule.state() + ' ' + testModule.moduleId)",
  '  }',
  '}',
  '',
].join(NL)

const PLAYWRIGHT_REPORTER = [
  "import { appendFileSync } from 'node:fs'",
  '',
  'const out = process.env.SCOPED_TEST_REACH',
  'const line = (text) => out && appendFileSync(out, text + String.fromCharCode(10))',
  "const id = (test) => test.location.file + ':' + test.location.line + ' ' + test.titlePath().filter(Boolean).join(' > ')",
  '',
  'export default class ScopedTestReach {',
  '  onBegin(config, suite) {',
  "    for (const test of suite.allTests()) line('POP ' + id(test))",
  '  }',
  '  onTestEnd(test, result) {',
  "    line('RAN ' + result.status + ' ' + id(test))",
  '  }',
  '  printsToStdio() {',
  '    return false',
  '  }',
  '}',
  '',
].join(NL)

const NODE_REPORTER = [
  'export default async function* scopedTestReach(source) {',
  '  for await (const event of source) {',
  "    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue",
  "    if (event.data.details?.type === 'suite') continue",
  "    const state = event.type === 'test:fail' ? 'failed' : event.data.skip || event.data.todo ? 'skipped' : 'passed'",
  "    yield 'RAN ' + state + ' ' + event.data.file + String.fromCharCode(10)",
  '  }',
  '}',
  '',
].join(NL)

/** A scratch directory holding `files`, and the record file a reporter appends to. */
function scratchWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'scoped-test-'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return { dir, reach: join(dir, 'reach.txt'), path: (name) => join(dir, name) }
}

const readLines = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split(NL).filter(Boolean) : [])

/** {passed, failed, skipped} from outcome words, with each runner's own word for a skip. */
function tally(states) {
  const out = { passed: 0, failed: 0, skipped: 0 }
  for (const s of states) {
    if (s === 'passed' || s === 'ok' || s === 'expected' || s === 'flaky') out.passed++
    else if (s === 'skipped' || s === 'ignored' || s === 'pending' || s === 'todo') out.skipped++
    else out.failed++
  }
  return out
}

/** Targets before the runner's `--` that are options rather than files, which only cargo takes. */
function noOptions(name, targets) {
  const options = targets.filter((t) => t.startsWith('-'))
  if (options.length) refuse(`'${options[0]}' is an option: give the ${name} runner its options after its own --`)
}

// ── what a run reached, per runner kind ─────────────────────────────────────────────────────────

const KINDS = {
  async pytest(name, runner, targets, extra, deadline) {
    noOptions(name, targets)
    const cwd = resolve(ROOT, runner.cwd)
    const s = scratchWith({ 'scoped_test_reach.py': PYTEST_PLUGIN })
    const env = {
      ...process.env,
      SCOPED_TEST_REACH: s.reach,
      PYTHONPATH: [s.dir, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
    }
    const named = targets.map((t) => {
      const { at, rest } = locate(t)
      return [slash(relative(cwd, at)), ...rest].join('::')
    })
    const words = resolveCommand([...runner.command, ...(runner.defaults ?? []), '-p', 'scoped_test_reach', ...named, ...extra], cwd)
    const r = await runOne(words, cwd, env, deadline, () => {})
    const lines = readLines(s.reach)
    rmSync(s.dir, { recursive: true, force: true })
    const population = lines.filter((l) => l.startsWith('POP ')).map((l) => l.slice(4))
    const ran = new Map()
    for (const l of lines.filter((x) => x.startsWith('RAN '))) {
      const [outcome, ...id] = l.slice(4).split(' ')
      ran.set(id.join(' '), outcome)
    }
    const tests = tally(ran.values())
    tests.deselected = new Set(lines.filter((l) => l.startsWith('DESEL ')).map((l) => l.slice(6))).size
    return { ...r, unit: 'test', population: population.length ? population : null, reached: [...ran.keys()], tests }
  },

  async cargo(name, runner, targets, extra, deadline) {
    const cwd = resolve(ROOT, runner.cwd)
    const has = (flag) => targets.some((t) => t === flag || t.startsWith(`${flag}=`))
    if (!has('-p') && !has('--package')) refuse('a cargo run names its crate: -p <crate> [--test <name>] [<filter>]')
    if (has('--workspace') || has('--all')) refuse('--workspace is the whole Rust suite, which is a milestone part')
    const defaults = (runner.defaults ?? []).filter((d) => !targets.includes(d))
    const base = resolveCommand([...runner.command, ...defaults, ...targets], cwd)
    const population = []
    const listing = await runOne([...base, '--', ...extra, '--list', '--format', 'terse'], cwd, process.env, deadline, (line) => {
      if (line.endsWith(': test')) population.push(line.slice(0, -': test'.length))
    })
    if (listing.stopped || listing.code !== 0) {
      return { ...listing, unit: 'test', population: null, reached: [], tests: tally([]), phase: 'listing' }
    }
    const reached = []
    const states = []
    const r = await runOne([...base, '--', ...extra], cwd, process.env, deadline, (line) => {
      if (!line.startsWith('test ')) return
      const rest = line.slice(5)
      const at = rest.lastIndexOf(' ... ')
      if (at < 0) return
      reached.push(rest.slice(0, at))
      // `ok`, `FAILED`, or `ignored` (`ignored, <reason>` where the test gives one)
      const word = rest.slice(at + 5).split(' ')[0].split(',')[0]
      states.push(word === 'FAILED' ? 'failed' : word)
    })
    return { ...r, unit: 'test', population, reached, tests: tally(states) }
  },

  async vitest(name, runner, targets, extra, deadline) {
    noOptions(name, targets)
    // the workspace each target is in, read from the root manifest's `workspaces`
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const dirs = []
    for (const p of manifest.workspaces ?? []) {
      if (p.endsWith('/*')) {
        const parent = join(ROOT, p.slice(0, -2))
        if (!existsSync(parent)) continue
        for (const d of readdirSync(parent, { withFileTypes: true })) {
          if (d.isDirectory() && existsSync(join(parent, d.name, 'package.json'))) dirs.push(`${p.slice(0, -2)}/${d.name}`)
        }
      } else dirs.push(p)
    }
    const groups = new Map()
    for (const t of targets) {
      const rel = slash(relative(ROOT, locate(t).at))
      const ws = dirs.filter((d) => rel === d || rel.startsWith(`${d}/`)).sort((a, b) => b.length - a.length)[0] ?? '.'
      if (!groups.has(ws)) groups.set(ws, [])
      groups.get(ws).push(ws === '.' ? rel : rel.slice(ws.length + 1))
    }
    const all = { code: 0, stopped: false, ended: [], left: [], unit: 'file', population: [], reached: [], tests: tally([]), unlisted: [] }
    const order = [...groups.keys()]
    for (const [at, ws] of order.entries()) {
      const files = groups.get(ws)
      const cwd = resolve(ROOT, ws)
      const s = scratchWith({ 'scoped-test-reach.mjs': VITEST_REPORTER })
      const listed = s.path('population.json')
      const vitest = resolveCommand(['{bin:vitest}'], cwd)
      const listing = await runOne([...vitest, 'list', '--filesOnly', `--json=${listed}`, ...(runner.listArgs ?? []), ...files], cwd, process.env, deadline, () => {})
      let population = null
      let unreadable = null
      if (existsSync(listed)) {
        try {
          population = JSON.parse(readFileSync(listed, 'utf8')).map((e) => slash(relative(cwd, typeof e === 'string' ? e : e.file)))
        } catch (err) {
          unreadable = err.message
        }
      }
      if (listing.stopped || listing.code !== 0 || population === null) {
        rmSync(s.dir, { recursive: true, force: true })
        const later = order.slice(at + 1).flatMap((w) => groups.get(w).map((f) => (w === '.' ? f : `${w}/${f}`)))
        return {
          ...all,
          ...listing,
          code: listing.code === 0 && unreadable ? 1 : listing.code,
          population: null,
          unlisted: later,
          phase: unreadable ? `listing of ${ws}, whose JSON is unreadable (${unreadable})` : `listing of ${ws}`,
        }
      }
      all.population.push(...population.map((f) => (ws === '.' ? f : `${ws}/${f}`)))
      const env = { ...process.env, SCOPED_TEST_REACH: s.reach }
      const words = resolveCommand([...runner.command, `--reporter=${slash(s.path('scoped-test-reach.mjs'))}`, ...files, ...extra], cwd)
      const r = await runOne(words, cwd, env, deadline, () => {})
      const cases = []
      for (const line of readLines(s.reach)) {
        const [kind, state, ...file] = line.split(' ')
        if (kind === 'CASE') cases.push(state)
        if (kind !== 'RAN') continue
        const id = slash(relative(ROOT, resolve(cwd, file.join(' '))))
        if (!all.reached.includes(id)) all.reached.push(id)
      }
      const t = tally(cases)
      for (const k of Object.keys(t)) all.tests[k] += t[k]
      rmSync(s.dir, { recursive: true, force: true })
      all.code = all.code || r.code
      all.stopped = r.stopped
      all.ended.push(...r.ended)
      all.left = r.left
      if (r.stopped) {
        all.unlisted = order.slice(at + 1).flatMap((w) => groups.get(w).map((f) => (w === '.' ? f : `${w}/${f}`)))
        break
      }
    }
    return all
  },

  async playwright(name, runner, targets, extra, deadline) {
    noOptions(name, targets)
    const cwd = resolve(ROOT, runner.cwd)
    const files = targets.map((t) => slash(relative(cwd, locate(t).at)))
    const s = scratchWith({ 'scoped-test-reach.mjs': PLAYWRIGHT_REPORTER })
    const env = { ...process.env, SCOPED_TEST_REACH: s.reach }
    const reporters = [...(runner.reporters ?? ['list']), slash(s.path('scoped-test-reach.mjs'))].join(',')
    const r = await runOne(resolveCommand([...runner.command, `--reporter=${reporters}`, ...files, ...extra], cwd), cwd, env, deadline, () => {})
    const lines = readLines(s.reach)
    rmSync(s.dir, { recursive: true, force: true })
    const shown = (id) => {
      const at = id.indexOf(':')
      const colon = id.indexOf(':', at === 1 ? 2 : 0)
      return slash(relative(cwd, id.slice(0, colon))) + id.slice(colon)
    }
    const population = lines.filter((l) => l.startsWith('POP ')).map((l) => shown(l.slice(4)))
    const ran = new Map()
    for (const l of lines.filter((x) => x.startsWith('RAN '))) {
      const [status, ...id] = l.slice(4).split(' ')
      ran.set(shown(id.join(' ')), status)
    }
    return { ...r, unit: 'test', population: population.length ? population : null, reached: [...ran.keys()], tests: tally(ran.values()) }
  },

  async node(name, runner, targets, extra, deadline) {
    noOptions(name, targets)
    const cwd = resolve(ROOT, runner.cwd ?? '.')
    const files = targets.map((t) => locate(t).at)
    const s = scratchWith({ 'scoped-test-reach.mjs': NODE_REPORTER })
    const words = [
      ...resolveCommand(runner.command, cwd),
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
      `--test-reporter=${pathToFileURL(s.path('scoped-test-reach.mjs')).href}`,
      `--test-reporter-destination=${slash(s.reach)}`,
      ...extra,
      ...files.map((f) => slash(relative(cwd, f))),
    ]
    const r = await runOne(words, cwd, process.env, deadline, () => {})
    const states = []
    const reached = new Set()
    for (const line of readLines(s.reach)) {
      const [, state, ...file] = line.split(' ')
      states.push(state)
      reached.add(slash(relative(ROOT, resolve(file.join(' ')))))
    }
    rmSync(s.dir, { recursive: true, force: true })
    return { ...r, unit: 'file', population: files.map((f) => slash(relative(ROOT, f))), reached: [...reached], tests: tally(states) }
  },

  async suite(name, runner, targets, extra, deadline) {
    noOptions(name, targets)
    const cwd = resolve(ROOT, runner.cwd)
    const out = { code: 0, stopped: false, ended: [], left: [], unit: 'suite', population: targets, reached: [], tests: tally([]) }
    for (const t of targets) {
      const r = await runOne(resolveCommand([...runner.command, slash(relative(cwd, locate(t).at)), ...extra], cwd), cwd, process.env, deadline, () => {})
      if (r.stopped) return { ...out, ...r, population: targets, reached: out.reached, tests: out.tests, unit: 'suite' }
      out.reached.push(t)
      if (r.code !== 0) {
        out.tests.failed++
        out.code = r.code
      } else out.tests.passed++
    }
    return out
  },
}

// ── a run of named tests ────────────────────────────────────────────────────────────────────────

async function named(args, limitS, milestone) {
  const name = args[0]
  const runner = CONFIG.runners[name]
  if (!runner) refuse(name === undefined ? 'no runner named' : `'${name}' is not a runner here`)
  const cut = args.indexOf('--')
  const targets = cut < 0 ? args.slice(1) : args.slice(1, cut)
  const extra = cut < 0 ? [] : args.slice(cut + 1)
  if (targets.length === 0) refuse(`the ${name} runner was given no target: name the files, crates or test ids to run`)
  const kind = KINDS[runner.kind]
  if (!kind) refuse(`the ${name} runner has an unknown kind '${runner.kind}' in ${slash(relative(ROOT, CONFIG_PATH))}`)

  const started = Date.now()
  const deadline = limitS === Infinity ? Infinity : started + limitS * 1000
  say(
    milestone
      ? `scoped test: ${name} over ${targets.length} target(s), as a milestone run with no limit`
      : `scoped test: ${name} over ${targets.length} target(s), limit ${limitS} s of wall clock`,
  )
  const r = await kind(name, runner, targets, extra, deadline)
  const took = Math.round((Date.now() - started) / 1000)

  const reached = new Set(r.reached)
  const missing = r.population === null ? null : r.population.filter((p) => !reached.has(p))
  const { passed, failed, skipped } = r.tests
  say()
  say(`scoped test: ${name}, ${took} s`)
  say(`  reached       ${reached.size} ${r.unit}(s)${r.population === null ? '' : ` of ${r.population.length} selected`}`)
  const leftOut = r.tests.deselected ? `, and ${r.tests.deselected} left out by the run's own filter` : ''
  if (r.unit !== 'suite') say(`  tests         ${passed} passed, ${skipped} skipped, ${failed} failed${leftOut}`)
  if (missing === null) {
    say(`  not reached   unknown: the ${r.phase ?? 'run'} ended before the selection was known`)
  } else if (missing.length) {
    say(`  NOT REACHED   ${missing.length} ${r.unit}(s)${missing.length > SHOWN ? `, the first ${SHOWN} shown` : ''}:`)
    for (const m of missing.slice(0, SHOWN)) say(`      ${m}`)
  }
  if (r.unlisted?.length) {
    say(`  NOT REACHED   ${r.unlisted.length} named target(s) whose workspace never started:`)
    for (const m of r.unlisted.slice(0, SHOWN)) say(`      ${m}`)
  }
  if (r.stopped) {
    say(`  STOPPED AT THE LIMIT: ${r.ended.length} process(es) ended by PID`)
    for (const p of r.ended) say(`      ended ${p.pid} ${p.name}`)
    if (r.left === null) say('  the process table could not be read afterwards, so what outlived the kill is unknown')
    else if (r.left.length) for (const p of r.left) say(`  STILL ALIVE   ${p.pid} ${p.name}`)
    else say('  alive afterwards: none of them')
    say(`scoped test: STOPPED at ${limitS} s, so this run verified nothing it did not reach (exit 3)`)
    return STOP
  }
  if (r.code !== 0) {
    say(`scoped test: FAILED, the runner exited ${r.code}${failed ? ` with ${failed} failing test(s)` : ''} (exit 1)`)
    return FAIL
  }
  if (reached.size === 0) {
    say('scoped test: FAILED, the run reported no result, and a selection that ran nothing has not passed (exit 1)')
    return FAIL
  }
  if ((missing !== null && missing.length) || r.unlisted?.length) {
    say(`scoped test: FAILED, the runner exited 0 and left part of its selection unreached (exit 1)`)
    return FAIL
  }
  if (r.unit !== 'suite' && passed === 0) {
    say(`scoped test: FAILED, every one of the ${skipped} test(s) it reached was skipped, and a run that passed nothing has not passed (exit 1)`)
    return FAIL
  }
  say(`scoped test: PASSED, ${reached.size} ${r.unit}(s) ran${r.unit === 'suite' ? '' : `: ${passed} test(s) passed, ${skipped} skipped${leftOut}`}`)
  return PASS
}

// ── the milestone run ───────────────────────────────────────────────────────────────────────────

async function milestone(args) {
  MODE = 'full'
  say('MILESTONE RUN: the full suite, with no wall-clock limit. Named tests run with `npm test -- <runner> <target...>` instead.')
  if (args.length && CONFIG.runners[args[0]]) return named(args, Infinity, true)
  const known = new Map(CONFIG.milestone.map((p) => [p.name, p]))
  for (const a of args) if (!known.has(a)) refuse(`'${a}' is not a milestone part here`)
  const parts = args.length ? args.map((a) => known.get(a)) : CONFIG.milestone
  const results = []
  for (const part of parts) {
    const cwd = resolve(ROOT, part.cwd ?? '.')
    say()
    say(`===== milestone part ${part.name} =====`)
    let code = part.commands?.length ? 0 : 'no command'
    for (const words of part.commands ?? []) {
      const r = await runOne(resolveCommand(words, cwd), cwd, process.env, Infinity, () => {})
      code = r.code
      if (code !== 0) break
    }
    results.push({ name: part.name, code })
  }
  say()
  say('MILESTONE RUN, by part')
  for (const r of results) say(`  ${r.name.padEnd(16)} ${r.code === 0 ? 'passed' : r.code === 'no command' ? 'FAILED: the part names no command' : `FAILED (exit ${r.code})`}`)
  const failed = results.filter((r) => r.code !== 0).length
  say(failed ? `MILESTONE RUN: FAILED, ${failed} of ${results.length} part(s)` : `MILESTONE RUN: all ${results.length} part(s) passed`)
  return failed ? FAIL : PASS
}

// ── entry ───────────────────────────────────────────────────────────────────────────────────────

async function main(argv) {
  const cut = argv.indexOf('--')
  const before = cut < 0 ? argv : argv.slice(0, cut)
  const after = cut < 0 ? [] : argv.slice(cut + 1)
  const isLimit = (a) => a === '--limit' || a.startsWith('--limit=')
  if (after.some(isLimit)) refuse("--limit goes before the runner's own --, which passes everything after it to the runner")
  const event = process.env.npm_lifecycle_event
  if (before[0] === '--milestone') {
    if (event !== undefined && event !== 'test:full') refuse(`--milestone is not taken by 'npm run ${event}': the run with no limit is 'npm run test:full'`)
    if (before.some(isLimit)) refuse('--limit is a scoped run’s, and the milestone run has no limit')
    return milestone(argv.slice(1))
  }
  if (before.includes('--milestone')) refuse('--milestone is never a scoped run’s: the run with no limit is `npm run test:full`')
  let limitS = LIMIT_S
  const rest = []
  for (let i = 0; i < before.length; i++) {
    const a = before[i]
    if (!isLimit(a)) {
      rest.push(a)
      continue
    }
    const value = a === '--limit' ? before[++i] : a.slice('--limit='.length)
    const n = Number(value)
    if (!(Number.isInteger(n) && n > 0 && n <= LIMIT_S)) refuse(`--limit takes whole seconds from 1 to ${LIMIT_S} (got ${value === undefined ? 'nothing' : `'${value}'`})`)
    limitS = n
  }
  return named(cut < 0 ? rest : [...rest, '--', ...after], limitS, false)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
