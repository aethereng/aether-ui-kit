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
    /** The reasoning behind this reply, kept under its turn once the reply settles and shown folded.
     *  Read under `actions="assistant"` only, and only on an agent message. */
    reasoning?: string;
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
/** Where a proposed value came from. `suggestion` is a value the assistant chose itself; the panel
 *  marks it as the assistant's suggestion. Nothing about the value is checked here. */
export interface ChatProposalBasis {
    kind: 'person' | 'file' | 'list' | 'suggestion';
    text: string;
}
/** A cell that carries the parts a reply's text carries: `marks` are highlighted and `{{scope:path}}`
 *  references in `text` are chips, drawn as the reply draws them. A plain string cell is plain text. */
export interface ChatProposalCell {
    text: string;
    marks?: ChatMark[];
}
export interface ChatProposalRow {
    path: string;
    before: string | ChatProposalCell;
    after: string | ChatProposalCell;
    /** Shown in its own column when any row of the proposal has a basis. */
    basis?: ChatProposalBasis | null;
    /** The reader may take or leave this row: it draws a tick, on by default. A proposal with a selectable
     *  row asks for selection, and its card's actions say so. */
    selectable?: boolean;
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
    /** The card says so in text, and its Accept control is labelled for it. Not by colour alone. */
    destructive?: boolean;
    /** A card that can still be taken up after its status has moved on: `accept` for a superseded or
     *  discarded card, `load-again` for an accepted one. Absent or null shows neither. */
    later?: 'accept' | 'load-again' | null;
    /** The card carries a note field. What the reader writes goes out with each decision. */
    note?: boolean;
}
/** What the reader decided on a proposal card, as its events carry it. `rows` are indexes into the
 *  card's `rows`: the ticked rows and every row the app did not mark selectable for Accept, all of them
 *  for Accept all, and none for Discard. `note` is the note field's text, empty when there is none. */
export interface ChatProposalDecision {
    rows: number[];
    note: string;
}
export interface ChatCardMessage {
    kind: 'card';
    title: string;
    body: string;
    source: string;
}
export type ChatEntry = ChatMessage | ChatToolMessage | ChatRefusalMessage | ChatProposalMessage | ChatCardMessage;
export declare function isTextMessage(m: ChatEntry): m is ChatMessage;
export { findBareNumerals, referencesIn, splitReferences } from './refs';
export type { BareNumeralSpan, ChatSegment, ReferenceScopes } from './refs';
export type RefSourceKind = 'run' | 'model' | 'proposal' | 'capabilities' | 'schema' | 'verification' | 'findings' | 'registry';
/** What the app's `resolveRef` returns for a reference it can answer. The kit shows these fields
 *  and decides nothing about them. */
export interface RefChipData {
    /** The value as text. */
    value: string;
    unit: string | null;
    source: {
        kind: RefSourceKind;
        /** `r1`, `m1`, `p2`, `v1`, `f1`; null for a bare scope (`c`, `s`, `g`) and for capabilities and schema. */
        id: string | null;
        /** The hash the tag shows, by kind: the engine build for a run, the input hash for a model, the
         *  proposal hash for a proposal, the building result hash for a verification, the build for a
         *  findings, registry, capabilities or schema entry. Shown shortened; full on hover. */
        hash: string;
    };
    path: string;
    /** The provenance line as text. */
    provenance: string | null;
    /** True when the value is a reduction of its source. The tag and hover say so; `mark` names it in the app's words. */
    reduced?: boolean;
    /** A mark drawn after the value, such as `(lower bound)` for a value that bounds the true one. */
    mark?: string | null;
    /** The word the hover puts before "build" for a capabilities or schema value, in the app's words:
     *  the hover reads `<buildNoun> build <hash>`. Absent or null, it reads `build <hash>`. */
    buildNoun?: string | null;
}
/** Characters of a hash shown in the chip's tag. */
export declare const REF_HASH_LENGTH = 7;
/** The word on a chip whose reference the app could not resolve. */
export declare const UNRESOLVED_TEXT = "unresolved";
/** The word a reduced value carries in its tag, its name and its hover. An app that names the reduction
 *  in its own words sets `mark` and leaves `reduced` unset. */
export declare const REDUCED_TEXT = "reduced";
/** How far from the bottom, in px, a log still counts as AT the bottom for the rule that follows a
 *  stream. The rule has two triggers, the stream's growth and an entry appended during it, and
 *  both use this distance: a reader within it keeps following, a reader beyond it is left where
 *  they are. About one line of the log's message text, rounded up; the scroll test pins both sides
 *  of it. */
export declare const STREAM_FOLLOW_THRESHOLD = 20;
/** Characters of a value a chip shows before it is shortened. The full text stays in the hover and
 *  in the accessible name. */
export declare const CHIP_TEXT_LIMIT = 40;
export type RefChipText = {
    resolved: true;
    /** Value and unit as shown: `0.0123 m`. */
    quantity: string;
    /** The source tag as shown: `r1 · 3b1f2c9`, or `build 9c04e2d` for a capabilities or schema value. */
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
