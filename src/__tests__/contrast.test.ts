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

/* Badge paints its OWN ground, so its three semantic tones are read against `--aether-warm-ink`
 * rather than against the page. That is the whole reason it is filled: measured tone-on-page,
 * `--aether-warm` lands at 3.83 on `--aether-panel` and cannot be made to pass by tinting, because
 * a wash pulls the background toward the text. Filled removes the page from the calculation, which
 * is also what makes one badge safe in two host palettes with different surfaces.
 *
 * 11px at weight 650 is NORMAL text under WCAG — "large" starts at 18.66px bold — so the floor here
 * is 4.5, not 3.0. */
const FILLED_TONES = ['--aether-ok', '--aether-warm', '--aether-rose'] as const

describe('Badge tones clear WCAG AA', () => {
  for (const tone of FILLED_TONES)
    it(`${tone} against --aether-warm-ink`, () => {
      const r = ratio(t('--aether-warm-ink'), t(tone))
      expect(
        r,
        `Badge text on ${tone} (${t(tone)}) measures ${r.toFixed(2)}, under the 4.5 floor. The ` +
          `badge is filled precisely so this pairing is the only one that matters — if it fails, ` +
          `the tone itself is wrong, not the treatment.`,
      ).toBeGreaterThanOrEqual(4.5)
    })

  it('neutral stays readable without being filled', () => {
    // The quiet tone is the one that appears six-in-a-row, so it paints panel rather than a colour.
    expect(ratio(t('--aether-ink-soft'), t('--aether-panel'))).toBeGreaterThanOrEqual(4.5)
  })

  it('success is NOT the selection accent', () => {
    /* --aether-selected resolves to --aether-cool. A success badge in that colour would make
     * "this passed" and "this is selected" the same pixels — the failure that made Transport stop
     * distinguishing two host apps, one level worse because these sit side by side in a row. */
    expect(t('--aether-ok')).not.toBe(t('--aether-cool'))
    expect(tokens['--aether-ok']).not.toContain('cool')
  })

  it('reports the tone headroom too', () => {
    const rows = FILLED_TONES.map((x) => `${x}: ${ratio(t('--aether-warm-ink'), t(x)).toFixed(2)}`)
    console.log('  badge tones — ' + rows.join(' · '))
    expect(rows).toHaveLength(3)
  })
})

/* The blocks above read ui-kit.css, which ships LIGHT tokens only — every dark theme lives in a
 * host. That gap is not theoretical: `--aether-ok` was added to the kit and the gallery's dark
 * theme did not get it, so a filled success badge rendered dark-green on dark ink at 2.84 while
 * every other tone still looked correct. Nothing in the kit could see it, because nothing in the
 * kit knows the theme exists.
 *
 * The gallery is the kit's own host, so its themes are testable here and stand in for the check
 * every other host owns for itself. A new tone token that a theme forgets now fails a test instead
 * of shipping. */
function themeTokens(selector: RegExp, from: string): Record<string, string> {
  /* All matches, not the first. App.vue contains TWO `:root` blocks — one is the documentation
     snippet showing a host how to remap tokens (`--aether-surface: var(--my-surface)`), and it is
     not CSS that runs. Taking the first match silently read the example and reported every token
     as missing. Real theme blocks are the ones declaring literal colours. */
  const blocks = [...from.matchAll(selector)]
    .map((m) => m[1]!)
    .filter((body) => /:\s*#[0-9a-f]{3,8}/i.test(body))
  if (!blocks.length) throw new Error(`contrast: no literal-valued block matching ${selector}`)
  const out: Record<string, string> = {}
  for (const body of blocks)
    for (const m of body.matchAll(/(--aether-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim()
  return out
}

const galleryCss = readFileSync(resolve(__dirname, '../gallery/App.vue'), 'utf8')
const THEMES = {
  'gallery light': themeTokens(/\n:root\s*\{([\s\S]*?)\n\}/g, galleryCss),
  'gallery dark (timber)': themeTokens(/html\[data-theme='timber'\]\s*\{([\s\S]*?)\n\}/g, galleryCss),
}

/* Tokens resolve kit :root -> host :root -> theme block, so a theme only has to restate what it
   changes. Extracted as a pure function over a resolved map so the SAME logic can be run against
   deliberately broken maps below — a check nobody has ever seen fail is a check nobody knows works. */
function resolveTheme(theme: Record<string, string>): Record<string, string> {
  return { ...tokens, ...THEMES['gallery light'], ...theme }
}
function toneFailures(resolved: Record<string, string>): string[] {
  const ink = resolved['--aether-warm-ink']!
  return FILLED_TONES.filter((tone) => ratio(ink, resolved[tone]!) < 4.5)
}
function textFailures(resolved: Record<string, string>): string[] {
  return TEXT.filter((fg) => GROUNDS.some((bg) => ratio(resolved[fg]!, resolved[bg]!) < 4.5))
}

describe('every host theme carries the tone tokens it overrides', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    const resolved = resolveTheme(theme)

    it(`${name} defines --aether-ok`, () => {
      expect(
        theme['--aether-ok'] ?? THEMES['gallery light']['--aether-ok'],
        `${name} never sets --aether-ok, so it inherits the kit's light-theme green.`,
      ).toBeDefined()
    })

    it(`${name}: every filled tone clears AA`, () => {
      const bad = toneFailures(resolved)
      expect(
        bad,
        `In ${name}, ${bad.map((x) => `${x} (${resolved[x]}) = ${ratio(resolved['--aether-warm-ink']!, resolved[x]!).toFixed(2)}`).join(', ')} ` +
          `against ink ${resolved['--aether-warm-ink']}.`,
      ).toEqual([])
    })
  }
})

/* MUTATION FIXTURES — tests of the tests.
 *
 * Everything above is green, which proves the palette is currently fine and proves NOTHING about
 * whether the checks would notice if it stopped being fine. A loosened threshold, a regex that
 * quietly stops matching, a merge order that makes a lookup always find a default — each leaves the
 * whole file passing while guarding nothing. That is not hypothetical: the theme parser here DID
 * silently read App.vue's documentation snippet instead of its real `:root`, and reported every
 * token as missing rather than failing.
 *
 * So each fixture below takes the real inputs, breaks ONE thing the way it has actually broken in
 * this repo, and asserts the corresponding check fires. If a fixture ever goes green, the check it
 * names has stopped working. */
describe('the checks above have teeth', () => {
  it('the theme parser reads real CSS, not the documentation snippet', () => {
    /* App.vue contains two `:root` blocks. The first is the example showing a host how to remap
     * tokens — `--aether-surface: var(--my-surface)` — and reading it made every token look absent.
     * A value that is a `var(--my-…)` here means the parser has drifted back onto the prose. */
    const light = THEMES['gallery light']
    expect(light['--aether-surface']).toMatch(/^#[0-9a-f]{6}$/i)
    expect(Object.values(light).join(' ')).not.toContain('var(--my-')
  })

  it('fires when a dark theme forgets --aether-warm-ink', () => {
    /* The failure a consumer actually shipped: their ink resolved through a framework's automatic
     * on-primary, which derives from the LIGHT accent and gives near-white in every theme. Our own
     * timber theme is one deleted line from the same thing — measured, all three tones collapse to
     * roughly 2.0, which is worse than the consumer's 2.91/2.74/3.50. */
    const timber = { ...THEMES['gallery dark (timber)'] }
    delete timber['--aether-warm-ink']
    const bad = toneFailures(resolveTheme(timber))
    expect(bad).toEqual([...FILLED_TONES]) // all three, not just one
  })

  it('fires when a dark theme forgets to invert --aether-ok, and names only that tone', () => {
    /* The exact bug that shipped into the gallery: --aether-ok was added to the kit, timber never
     * got it, and a filled success badge rendered dark-green on dark ink at 2.84 while warm and
     * rose still looked correct. Asserting the OTHER two still pass is the point — a check that
     * failed everything here would pass this test while being useless. */
    const timber = { ...THEMES['gallery dark (timber)'], '--aether-ok': '#3f6b3a' }
    expect(toneFailures(resolveTheme(timber))).toEqual(['--aether-ok'])
  })

  it('fires when a grey is nudged back below the floor', () => {
    /* --aether-faint shipped at #8A857A before it was raised: 3.47 on surface and 2.77 on panel.
     * The tripwire above exists for exactly this edit, so it is worth proving it still catches it. */
    expect(textFailures({ ...tokens, '--aether-faint': '#8A857A' })).toEqual(['--aether-faint'])
  })

  it('does NOT fire on the real palette — the fixtures are detecting the break, not everything', () => {
    // Without this, all four above would pass even if the checks returned "broken" unconditionally.
    expect(toneFailures(resolveTheme(THEMES['gallery dark (timber)']))).toEqual([])
    expect(textFailures(tokens)).toEqual([])
  })
})

describe('the tokens a host is expected to remap', () => {
  /* These default to another token rather than to a literal. That is what makes them free to
   * ignore — a host that never sets them sees exactly the previous appearance — so the defaults
   * are part of the contract and worth pinning. */
  it('--aether-selected defaults to the cool accent', () => {
    expect(tokens['--aether-selected']).toBe('var(--aether-cool)')
    expect(tokens['--aether-selected-wash']).toBe('var(--aether-cool-wash)')
  })

  it('--aether-control-font-size keeps the size controls shipped with', () => {
    expect(tokens['--aether-control-font-size']).toBe('12.5px')
  })

  it('text on a filled destructive button uses the inverting token, not a literal', () => {
    // A hardcoded white here is unreadable the moment a host inverts --aether-rose for a dark theme.
    expect(css).toContain('.aether-tool--fill.danger')
    const block = css.slice(css.indexOf('.aether-tool--fill.danger'))
    expect(block.slice(0, 200)).toContain('var(--aether-warm-ink)')
  })
})
