import { type ReferenceScopes } from '../../controls/core/refs';
/** What the card shows in place of a number the tool minted no reference for. */
export declare const NUMBER_WITHHELD = "withheld: a number with no reference";
/** What the card shows in place of a numeral inside a text that carries no reference. */
export declare const NUMERAL_WITHHELD = "[withheld]";
/** The most characters a card's detail shows. */
export declare const DETAIL_CAP = 20000;
/** A text as the card shows it: each numeral the gate would mark is withheld, so a digit is shown
 *  only inside a reference or as an identifier in `admitted`. */
export declare function withholdBare(text: string, admitted: Iterable<string>, scopes?: ReferenceScopes): string;
/** The card's detail: the output as JSON, each `{ ref, value }` pair shown as its reference, any
 *  other number withheld, and every numeral inside a text that the gate would mark withheld; cut at
 *  `DETAIL_CAP`. */
export declare function cardDetail(out: unknown, admitted?: Iterable<string>, scopes?: ReferenceScopes): string;
