/* What a tool card's detail shows of a tool's output. Framework-free.
 *
 * The output is JSON. A value the tool minted a reference for is shown as that reference. Any other
 * number is withheld, and so is every numeral inside a text that the numeral gate would mark: the
 * card shows no number without its source. Identifiers the caller admits stay as they are. */
import { DEFAULT_REFERENCE_SCOPES, numeralGate, type ReferenceScopes } from '../../controls/core/refs'

/** What the card shows in place of a number the tool minted no reference for. */
export const NUMBER_WITHHELD = 'withheld: a number with no reference'

/** What the card shows in place of a numeral inside a text that carries no reference. */
export const NUMERAL_WITHHELD = '[withheld]'

/** The most characters a card's detail shows. */
export const DETAIL_CAP = 20000

const NL = String.fromCharCode(10)

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** A text as the card shows it: each numeral the gate would mark is withheld, so a digit is shown
 *  only inside a reference or as an identifier in `admitted`. */
export function withholdBare(text: string, admitted: Iterable<string>, scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES): string {
  const bare = numeralGate(text, admitted, () => true, scopes).filter((v) => v.kind === 'bare_numeral')
  let shown = ''
  let at = 0
  for (const v of bare) {
    shown += text.slice(at, v.start) + NUMERAL_WITHHELD
    at = v.end
  }
  return shown + text.slice(at)
}

/** The card's detail: the output as JSON, each `{ ref, value }` pair shown as its reference, any
 *  other number withheld, and every numeral inside a text that the gate would mark withheld; cut at
 *  `DETAIL_CAP`. */
export function cardDetail(out: unknown, admitted: Iterable<string> = [], scopes: ReferenceScopes = DEFAULT_REFERENCE_SCOPES): string {
  const ids = [...admitted]
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (isRecord(v)) {
      if (typeof v.ref === 'string' && 'value' in v) return v.ref
      return Object.fromEntries(Object.entries(v).map(([k, c]) => [k, walk(c)]))
    }
    if (typeof v === 'string') return withholdBare(v, ids, scopes)
    return typeof v === 'number' ? NUMBER_WITHHELD : v
  }
  const text = JSON.stringify(walk(out), null, 2) ?? ''
  return text.length > DETAIL_CAP ? text.slice(0, DETAIL_CAP) + NL + '(cut short: the rest is not shown)' : text
}
