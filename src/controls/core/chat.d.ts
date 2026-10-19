export interface ChatMark {
    start: number;
    end: number;
    kind: string;
}
export interface ChatMessage {
    kind?: 'text';
    role: 'you' | 'agent' | 'sys';
    text: string;
    queued?: boolean;
    refs?: string[];
    /** The text is still arriving. The message is marked busy and ends in a caret. */
    streaming?: boolean;
    /** Spans to highlight; offsets index into `text`. A mark that is out of range, empty, inverted or
     *  overlapping an earlier one is dropped, and of two overlapping marks the first wins. */
    marks?: ChatMark[];
}
export type ChatToolStatus = 'running' | 'done' | 'refused' | 'failed';
export interface ChatToolMessage {
    kind: 'tool';
    callId: string;
    name: string;
    status: ChatToolStatus;
    /** One line. */
    summary: string;
    /** Shown behind a Disclosure when present. */
    detail?: string;
    /** Whether the detail is revealed. The app owns it and flips it on `toggle-tool`. */
    open?: boolean;
}
export interface ChatRefusalMessage {
    kind: 'refusal';
    /** Rendered verbatim, whitespace preserved. */
    text: string;
    source: 'engine' | 'api';
}
export interface ChatProposalRow {
    path: string;
    before: string;
    after: string;
}
export interface ChatProposalFlag {
    text: string;
    /** A reference string, `scope:path`, rendered as a chip. */
    reference: string;
}
export type ChatProposalStatus = 'pending' | 'accepted' | 'discarded' | 'superseded' | 'refused';
export interface ChatProposalMessage {
    kind: 'proposal';
    id: string;
    title: string;
    rows: ChatProposalRow[];
    flags: ChatProposalFlag[];
    /** Accept and Discard show only while `pending`; the app moves it on. */
    status: ChatProposalStatus;
}
export interface ChatCardMessage {
    kind: 'card';
    title: string;
    body: string;
    source: string;
}
export type ChatEntry = ChatMessage | ChatToolMessage | ChatRefusalMessage | ChatProposalMessage | ChatCardMessage;
export declare function isTextMessage(m: ChatEntry): m is ChatMessage;
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
 *  pair with no opening pair, `{{}}`, a scope outside the grammar, whitespace inside the braces.
 *  A reference whose closing braces have not arrived is therefore plain text until they do, which is
 *  what a streaming message needs.
 *
 *  A NESTED opening pair makes the outer pair plain text; a valid reference inside it is still a
 *  reference. `{{r1:{{r2:x}}}}` is text `{{r1:`, the reference `r2:x`, text `}}`: the leftmost
 *  complete reference wins and the leftover braces are not consumed. */
export declare function splitReferences(text: string): ChatSegment[];
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
 *  and `J12's's` all compare as `J12`. The comparison is exact and case-sensitive. A backtick and
 *  an asterisk are not in the strip set, so a code span or bold text around an identifier makes it
 *  a violation, and a code span is read like any other text.
 *
 *  A token is a VIOLATION when, stripped, it holds a digit and does not equal an admitted
 *  identifier, unless it is an ordered-list marker (ASCII digits then `.` or `)`) that starts its
 *  line after optional indentation. A token is the whole run, so `J12,J13` is one token and a
 *  violation. The span covers the stripped token, without the punctuation around it.
 *
 *  UNRESOLVED REFERENCES ARE LEFT TO THE CALLER. A reference is skipped whatever its scope id,
 *  because this function is handed the identifiers admitted in text and not the app's index of run,
 *  model and proposal ids; it cannot know that `{{r999:x}}` points at nothing. The caller asks its
 *  own index and reports an unresolved reference itself. A reference still being
 *  typed is not yet a reference, so it is plain text here and its digit is a violation.
 *
 *  Not a markdown parser: it does not know a fenced block from a sentence. */
export declare function findBareNumerals(text: string, admittedIds: Iterable<string>): BareNumeralSpan[];
export type RefSourceKind = 'run' | 'model' | 'proposal' | 'capabilities' | 'schema';
/** What the app's `resolveRef` returns for a reference it can answer. The kit shows these fields
 *  and decides nothing about them. */
export interface RefChipData {
    /** The value as text. */
    value: string;
    unit: string | null;
    source: {
        kind: RefSourceKind;
        /** `r1`, `m1`, `p2`; null for capabilities and schema. */
        id: string | null;
        /** The engine build for a run, the input or proposal hash for a model or proposal, the
         *  viewer build for capabilities and schema. Shown shortened; full on hover. */
        hash: string;
    };
    path: string;
    /** The provenance line as text. */
    provenance: string | null;
    /** True when the viewer reduced the value. */
    reduced?: boolean;
}
/** Characters of a hash shown in the chip's tag. */
export declare const REF_HASH_LENGTH = 7;
/** The word on a chip whose reference the app could not resolve. */
export declare const UNRESOLVED_TEXT = "unresolved";
export declare const REDUCED_TEXT = "reduced by the viewer";
/** How far from the bottom, in px, a log still counts as AT the bottom for the one rule that
 *  follows a growing stream: a reader inside it keeps following, a reader outside it is left
 *  where they are. About one line of the log's message text, rounded up; the scroll test pins
 *  both sides of it. */
export declare const STREAM_FOLLOW_THRESHOLD = 20;
export type RefChipText = {
    resolved: true;
    /** Value and unit as shown: `0.0123 m`. */
    quantity: string;
    /** The source tag as shown: `r1 · 3b1f2c9`, or `build 9c04e2d` for a viewer build. */
    tag: string;
    /** The chip's accessible name: path, value, unit and tag. */
    name: string;
    /** The hover text: path, provenance, the full hash. */
    hover: string;
} | {
    resolved: false;
    /** The chip's accessible name: the word and the reference. */
    name: string;
};
/** The words a chip shows, names and hovers over, for a reference and the data the app returned
 *  for it (`null` when it could not). One place builds them, so what the chip draws and what the
 *  panel announces when a reply settles cannot drift apart. */
export declare function describeRef(ref: string, data: RefChipData | null): RefChipText;
