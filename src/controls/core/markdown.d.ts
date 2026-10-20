import type { ChatMark } from './chat';
import { type ReferenceScopes } from './refs';
/** One inline piece. A text piece carries the kind of the mark that covers it, or null. A reference
 *  carries `scope:path`, without its braces, for the panel to resolve. */
export type MdInline = {
    kind: 'text';
    text: string;
    mark: string | null;
} | {
    kind: 'ref';
    ref: string;
} | {
    kind: 'br';
} | {
    kind: 'strong' | 'em' | 'code';
    children: MdInline[];
};
/** One block. A list's `start` is the number its first item carries. A bullet list starts at 1 and
 *  the panel ignores its start. */
export type MdBlock = {
    kind: 'p';
    children: MdInline[];
} | {
    kind: 'list';
    ordered: boolean;
    start: number;
    items: MdInline[][];
};
/** The marks that can be drawn: whole spans of `text`, in order, none overlapping. The app's gate
 *  decides what to mark. A malformed span is dropped here rather than thrown, so one bad offset
 *  cannot blank a reply. Of two overlapping spans the first wins. */
export declare function usableMarks(text: string, marks?: readonly ChatMark[]): ChatMark[];
/** The blocks of a reply's text. `marks` are the gate's spans, offsets into `text`; a malformed mark is
 *  dropped by `usableMarks`. */
export declare function markdownBlocks(text: string, marks?: readonly ChatMark[], scopes?: ReferenceScopes): MdBlock[];
