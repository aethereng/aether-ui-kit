/** The scopes a reference may name. An `indexed` scope is a letter and a positive number written
 *  without a leading zero (`m1`, `p2`); a `bare` scope is a letter alone (`c`, `s`). A reference
 *  names a scope in its list or it is plain text, and a digit in plain text is a bare numeral to the gate. */
export interface ReferenceScopes {
    readonly indexed: readonly string[];
    readonly bare: readonly string[];
}
/** The default scope list: runs, models and proposals by index, and capability and schema documents
 *  bare. */
export declare const DEFAULT_REFERENCE_SCOPES: ReferenceScopes;
/** A span of text, or one reference, in the order it appears. A reference segment keeps its braces
 *  in `text`; `ref` is `scope:path` without them. */
export type ChatSegment = {
    kind: 'text';
    text: string;
    start: number;
    end: number;
} | {
    kind: 'ref';
    /** The token as written, braces included. */
    text: string;
    /** `scope:path`: what `resolveRef` is asked for and what `open-ref` carries. */
    ref: string;
    scope: string;
    path: string;
    start: number;
    end: number;
};
/** Split `text` into alternating text and reference segments, in order, with nothing lost: the
 *  segments' `text` concatenates back to the input, and `start`/`end` are UTF-16 offsets into it.
 *  No empty text segment is emitted, so the empty string yields no segments.
 *
 *  Malformed input is plain text, each case whole: an opening pair with no closing pair, a closing
 *  pair with no opening pair, `{{}}`, a scope outside `scopes`, whitespace inside the braces. A
 *  reference whose closing braces have not arrived is therefore plain text until they do, which is
 *  what a streaming message needs.
 *
 *  A NESTED opening pair makes the outer pair plain text; a valid reference inside it is still a
 *  reference. `{{r1:{{r2:x}}}}` is text `{{r1:`, the reference `r2:x`, text `}}`: the leftmost
 *  complete reference wins and the leftover braces are not consumed. */
export declare function splitReferences(text: string, scopes?: ReferenceScopes): ChatSegment[];
/** The references in a text, as written and in order. */
export declare function referencesIn(text: string, scopes?: ReferenceScopes): string[];
export interface BareNumeralSpan {
    start: number;
    end: number;
}
/** The spans of `text` holding a digit that is not an admitted identifier, in UTF-16 code units,
 *  ascending.
 *
 *  A TOKEN is a maximal run of non-whitespace characters in the text between references (a
 *  reference is a token boundary, and is never read). Leading and trailing punctuation is stripped
 *  before comparing, namely `. , ; : ! ? ( ) [ ] { } "`, the apostrophe `'` and the typographic
 *  single quotes U+2018 and U+2019, and a trailing apostrophe-s (`'s`, in any of the three). The
 *  trailing strip repeats until nothing more comes off, so `J12.`, `(J12)`, `J12's`, `(J12's).`
 *  and `J12's's` all compare as `J12`. The comparison is exact and case-sensitive. A backtick, an
 *  asterisk and an underscore strip like the rest, so `` `J12` ``, `**J12**`, `_J12_` and `(`J12`)` all
 *  compare as `J12`: the markup stays in the text, and a violation's span covers the digits only.
 *
 *  A token is a VIOLATION when, stripped, it holds a digit and does not equal an admitted
 *  identifier, unless it opens a list item the parser reads (`opensListItem`: an ordered marker after
 *  optional indentation and any quote prefixes). A token is the whole run, so `J12,J13` is one token and a
 *  violation. The span covers the stripped token, without the punctuation around it.
 *
 *  UNRESOLVED REFERENCES ARE LEFT TO THE CALLER. A reference is skipped whatever its scope id,
 *  because this function is handed the admitted identifiers and has no view of the app's index of
 *  minted references; it cannot know that `{{r999:x}}` points at nothing. The caller asks its
 *  own index and reports an unresolved reference itself. A reference still being typed is not yet a
 *  reference, so it is plain text here and its digit is a violation.
 *
 *  AN IDENTIFIER OF SEVERAL WORDS is read as one phrase. `Table 3.1`, `EN 1993-1-1` and `A572 Gr 50` are
 *  admitted as written; the digits of an admitted phrase are not violations where the whole phrase
 *  stands between token edges, a line break between its words included. A digit outside any such phrase
 *  is still a violation: `3.1` alone is flagged while `Table 3.1` stands. A phrase is not read across a
 *  reference, and a phrase glued to a letter or a bold marker does not stand, so its digits are read as
 *  before.
 *
 *  Not a markdown parser: it does not know a fenced block from a sentence. */
export declare function findBareNumerals(text: string, admittedIds: Iterable<string>, scopes?: ReferenceScopes): BareNumeralSpan[];
/** `bare_numeral`: a token holding a digit that is no admitted identifier. `unresolved_reference`:
 *  a reference the app's index does not hold. */
export type ViolationKind = 'bare_numeral' | 'unresolved_reference';
/** One finding, with its offsets in UTF-16 code units into the text it was found in. */
export interface Violation {
    token: string;
    start: number;
    end: number;
    kind: ViolationKind;
}
/** The gate over one finished text. A digit outside a reference is a violation unless its token
 *  equals an identifier in `admitted` or is an ordered-list marker opening a line (the rule of
 *  `findBareNumerals`). A reference is read only to ask `holds` whether the app minted it: one it
 *  did not is a violation of its own kind. The reference is passed as written, braces included,
 *  which is how an index keys its references. */
export declare function numeralGate(text: string, admitted: Iterable<string>, holds: (ref: string) => boolean, scopes?: ReferenceScopes): Violation[];
/** How a path reads an id that is written in brackets.
 *
 *  Off (the default): an id holding `.`, `[`, `]`, `{`, `}`, `~` or whitespace, or beginning `#`, is
 *  not reached by its id. An id written in brackets that holds a `.` is refused.
 *
 *  On: an id in brackets is read verbatim up to the first `]`, so an id holding `.` is reached by
 *  its id. Only an id holding `]`, `{`, `}`, `~`, whitespace or a leading `#` is reached by its
 *  position; `modelLeaves` lists such an id in `skipped`. */
export interface PathRules {
    readonly verbatimBracketIds: boolean;
}
export declare const DEFAULT_PATH_RULES: PathRules;
/** Whether an id is reached only by its position under `rules`. */
export declare function hasReservedCharacter(id: string, rules?: PathRules): boolean;
/** The reserved characters an id holds, each named once in the order they first appear; a leading
 *  `#` is named as such and whitespace as `whitespace`. */
export declare function reservedCharactersOf(id: string, rules?: PathRules): string[];
/** Every string value of an `id` field anywhere in a document's JSON: the identifiers a caller may
 *  write bare. */
export declare function idsIn(json: unknown, into?: Set<string>): Set<string>;
/** Lower case; letters and digits kept; every other run of characters one hyphen; no hyphen at
 *  either end. A path built from a heading uses it. */
export declare function slug(text: string): string;
/** One step of a dotted path: a key, an array element by its `id`, or an element by position. */
export type PathStep = {
    key: string;
} | {
    id: string;
} | {
    index: number;
};
/** A value the app computes over a run: an extreme over a member's samples, the sample position it
 *  sits at, or the parameter there. Written after a `~`. The app computes it; this file only reads
 *  the name. */
export interface Reduction {
    extreme: 'max' | 'min';
    part: 'value' | 'at' | 'xi';
}
export interface ParsedPath {
    steps: PathStep[];
    reduction: Reduction | null;
}
/** Parse a path; null when it is not one. `members[beam].forces.M3~max` is the key `members`, the
 *  element `beam`, the keys `forces` and `M3`, and the reduction `max`. A `[#i]` is a position
 *  under either rule; a bracket that holds `#` but no zero-based index is refused. */
export declare function parsePath(path: string, rules?: PathRules): ParsedPath | null;
/** The text of a path, the inverse of `parsePath`. */
export declare function formatPath(steps: readonly PathStep[], reduction?: Reduction | null): string;
/** The component names of the fixed-length tuples a document holds, by the field that holds each,
 *  and the fields whose tuple is held once per element of an array. A tuple whose field names no
 *  components is reached by position and is not in the table. The app supplies it from the comments
 *  beside its own fields. */
export interface TupleTable {
    readonly components: Readonly<Record<string, readonly string[]>>;
    readonly perElement: readonly string[];
}
/**
 * The value a parsed path reaches in a document's JSON, or undefined. `count` on an array is its
 * length. A key naming a tuple component (`translation.u_x`, `forces[#12].M3`) reaches that
 * component when `tuples` names it. A reduction is not resolved here: the app computes it.
 */
export declare function resolvePath(json: unknown, steps: readonly PathStep[], tuples?: TupleTable | null): unknown;
/** One numeric leaf under a subtree, with the path that reaches it. */
export interface Leaf {
    path: string;
    value: number;
}
export interface LeafOptions {
    /** Stops the walk once it has found more leaves than this; the caller reads that as too many. */
    limit?: number;
    rules?: PathRules;
    tuples?: TupleTable | null;
}
/**
 * Every numeric leaf of a document's JSON under `steps`, with its path: an element with an `id` is
 * addressed by it, any other by position. An element whose id is reached only by position under
 * `rules` gets no path into it; its id is listed in `skipped` instead.
 */
export declare function modelLeaves(json: unknown, steps: readonly PathStep[], options?: LeafOptions): {
    leaves: Leaf[];
    skipped: string[];
    over: boolean;
};
