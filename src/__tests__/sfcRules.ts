import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'vue/compiler-sfc'

/* A component's own CSS, for a test to read. The suite's jsdom gets none of a mounted component's
 * styles, so a rule that decides what a reader sees (a hidden layer letting clicks through, a bar
 * still drawn under reduced motion) has no failing test unless one reads the rule. The block comes
 * from the SFC parser and the rules from the DOM's own stylesheet, so a comment or a brace in a value
 * cannot move where a rule starts or ends. */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Puts a component's <style> blocks in the document, so a mounted part takes them, and returns the
 *  sheet. `file` is relative to src/. */
export function stylesOf(file: string): CSSStyleSheet {
  const { descriptor } = parse(readFileSync(resolve(SRC, file), 'utf8'))
  const el = document.createElement('style')
  el.textContent = descriptor.styles.map((s) => s.content).join('\n')
  document.head.append(el)
  return el.sheet!
}

function listed(selectorText: string, selector: string): boolean {
  return selectorText.split(',').some((s) => s.trim() === selector)
}

/** The declarations of every rule that lists `selector`, inside `@media <media>` if that is given, in
 *  source order. Throws when there is none, so a renamed selector fails the test that reads it. */
export function declared(sheet: CSSStyleSheet, selector: string, media?: string): Record<string, string> {
  let rules: CSSRule[] = Array.from(sheet.cssRules)
  if (media !== undefined) {
    const blocks = rules.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule && r.media.mediaText === media)
    if (!blocks.length) throw new Error(`no @media ${media} in the sheet`)
    rules = blocks.flatMap((b) => Array.from(b.cssRules))
  }
  const found = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && listed(r.selectorText, selector))
  if (!found.length) throw new Error(`no rule lists ${selector}${media === undefined ? '' : ` in @media ${media}`}`)
  const out: Record<string, string> = {}
  for (const r of found) {
    for (const name of Array.from(r.style)) out[name] = r.style.getPropertyValue(name)
  }
  return out
}
