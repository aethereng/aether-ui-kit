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
export { findBareNumerals, referencesIn, splitReferences } from './refs';
export type { BareNumeralSpan, ChatSegment, ReferenceScopes } from './refs';
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
/** How far from the bottom, in px, a log still counts as AT the bottom for the rule that follows a
 *  stream. The rule has two triggers, the stream's growth and an entry appended during it, and
 *  both use this distance: a reader within it keeps following, a reader beyond it is left where
 *  they are. About one line of the log's message text, rounded up; the scroll test pins both sides
 *  of it. */
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
