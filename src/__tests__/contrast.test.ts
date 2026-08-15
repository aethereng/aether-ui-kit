import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* The palette clears WCAG AA by a hair, not by a mile, and that is a design decision rather than an
 * accident: `--aether-faint` was tuned to land just over the 4.5 floor on `--aether-panel`, which is
 * the tightest pairing the kit paints. Measured at the time: 4.61 here, 4.61 and 4.94 in the two
 * host palettes, 4.59 in a third. Nobody has headroom.
 *
 * That is fine while nobody touches the greys. It stops being fine the moment someone nudges one for
 * aesthetic reasons, because the failure is invisible — the page still renders, nothing errors, and
 * only a contrast checker or a person who cannot read it finds out. This test is the tripwire.
 *
 * It reads the SHIPPED stylesheet rather than a copy of the values, so editing ui-kit.css is what
 * runs it. A duplicated palette here would drift and then guard nothing.
 */

const css = readFileSync(resolve(__dirname, '../styles/ui-kit.css'), 'utf8')

/** The `:root` block only — later blocks redefine tokens for other contexts. */
function rootTokens(): Record<string, string> {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)
  if (!root) throw new Error('contrast: no :root block found in ui-kit.css')
  const out: Record<string, string> = {}
  for (const m of root[1]!.matchAll(/(--aether-[a-z0-9-]+)\s*:\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim()
  return out
}

const HEX = /^#([0-9a-f]{6})$/i
function luminance(hex: string): number {
  const m = HEX.exec(hex)
  if (!m) throw new Error(`contrast: expected a 6-digit hex, got "${hex}"`)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255)
  const lin = [r!, g!, b!].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}
function ratio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi! + 0.05) / (lo! + 0.05)
}

const tokens = rootTokens()
const t = (name: string) => {
  const v = tokens[name]
  if (!v) throw new Error(`contrast: ${name} is not defined on :root`)
  return v
}

/* The text ladder, over both surfaces the kit actually paints text on. `--aether-panel` is the one
 * that decides it: every one of these clears comfortably on `--aether-surface` and only just on
 * `--aether-panel`, so testing surface alone would pass while the real risk went unguarded. */
const TEXT = ['--aether-ink', '--aether-ink-soft', '--aether-faint'] as const
const GROUNDS = ['--aether-surface', '--aether-panel'] as const

describe('the kit palette clears WCAG AA', () => {
  for (const fg of TEXT)
    for (const bg of GROUNDS)
      it(`${fg} on ${bg}`, () => {
        const r = ratio(t(fg), t(bg))
        expect(
          r,
          `${fg} (${t(fg)}) on ${bg} (${t(bg)}) measures ${r.toFixed(2)}, under the 4.5 floor for ` +
            `normal-size text. Raising the text token is not automatically the fix — see the ladder ` +
            `test below, which a lone raise will invert.`,
        ).toBeGreaterThanOrEqual(4.5)
      })

  it('keeps the ladder monotonic, so a fix to one rung cannot invert another', () => {
    /* This is not theory. Raising `faint` alone to clear AA once made it HIGHER contrast than
     * `muted` in a host palette — the type hierarchy inverted, and the quietest text became the
     * loudest. Both tokens had to move together. Ordering is part of the contract, not a nicety. */
    const ground = t('--aether-panel')
    const ink = ratio(t('--aether-ink'), ground)
    const soft = ratio(t('--aether-ink-soft'), ground)
    const faint = ratio(t('--aether-faint'), ground)
    expect([ink, soft, faint]).toEqual([...[ink, soft, faint]].sort((a, b) => b - a))
    expect(ink).toBeGreaterThan(soft)
    expect(soft).toBeGreaterThan(faint)
  })

  it('reports how much headroom is left, so a near-miss is visible before it is a failure', () => {
    /* Deliberately not an assertion on the margin. The palette ships at ~0.1 over the floor by
     * design; failing on a thin margin would fail today. This prints it instead, so anyone editing
     * a grey sees what they are spending. */
    const rows = TEXT.flatMap((fg) =>
      GROUNDS.map((bg) => `${fg} on ${bg}: ${ratio(t(fg), t(bg)).toFixed(2)}`),
    )
    console.log('  contrast — ' + rows.join(' · '))
    expect(rows).toHaveLength(6)
  })
})
