/* A small syntax highlighter for the gallery's Template and Script panels.
 *
 * @internal — gallery furniture, not part of the kit's contract.
 *
 * HAND-ROLLED because the package declares zero runtime dependencies and a test enforces it. The
 * input is also not arbitrary: it is this repo's own example files, so the tokenizer only has to
 * survive the subset they use, and a highlighter that mis-colours an edge case is a cosmetic bug
 * rather than a broken page.
 *
 * ONE PASS, ORDERED ALTERNATION. Comments and strings come first in the pattern so a keyword
 * inside a comment, or an angle bracket inside a string, is never re-tokenized — the classic way
 * these go wrong. Everything not matched is emitted as escaped plain text.
 *
 * Output is HTML, so every slice goes through `esc` on the way out — including the unmatched text
 * between tokens. The source is ours, but a highlighter that forgets to escape is one example file
 * away from injecting markup into the page that documents it.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const span = (cls: string, text: string) => `<span class="tok-${cls}">${esc(text)}</span>`

/* TypeScript: comments, then strings (all three quote forms), then the words worth colouring.
   `ref|computed` are in the keyword set deliberately — in these examples they are the load-bearing
   vocabulary, and a reader scanning a script tab is looking for exactly those. */
const TS = new RegExp(
  [
    /(?<comment>\/\*[\s\S]*?\*\/|\/\/[^\n]*)/.source,
    /(?<string>'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/.source,
    /(?<keyword>\b(?:const|let|var|function|return|import|export|from|type|interface|as|new|if|else|for|of|in|async|await|true|false|null|undefined|ref|computed)\b)/
      .source,
    /(?<number>\b\d+(?:\.\d+)?\b)/.source,
    /(?<fn>\b[A-Za-z_]\w*(?=\())/.source,
  ].join('|'),
  'g',
)

/* Vue template: comments, interpolation, then tags and their attributes. Directives get their own
   class rather than sharing with plain attributes — `v-model`, `:prop` and `@event` are where the
   behaviour is, and colouring them apart is most of the value of highlighting a template at all. */
const VUE = new RegExp(
  [
    /(?<comment><!--[\s\S]*?-->)/.source,
    /(?<interp>\{\{[^}]*\}\})/.source,
    /(?<tag><\/?[A-Za-z][\w.-]*)/.source,
    /(?<directive>\B[:@]\w[\w.-]*|\bv-[\w.-]+)/.source,
    /(?<string>"(?:[^"]*)"|'(?:[^']*)')/.source,
    /(?<attr>\b[A-Za-z_][\w.-]*(?==))/.source,
    /(?<punct>\/?>)/.source,
  ].join('|'),
  'g',
)

function run(src: string, re: RegExp): string {
  let out = ''
  let last = 0
  for (const m of src.matchAll(re)) {
    const at = m.index ?? 0
    if (at > last) out += esc(src.slice(last, at))
    // exactly one named group matches per alternation, so the first defined one names the class
    const [cls] = Object.entries(m.groups ?? {}).find(([, v]) => v !== undefined) ?? []
    out += cls ? span(cls, m[0]) : esc(m[0])
    last = at + m[0].length
  }
  return out + esc(src.slice(last))
}

export function highlight(src: string, lang: 'template' | 'script'): string {
  return run(src, lang === 'script' ? TS : VUE)
}
