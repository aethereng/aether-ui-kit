/** Under every assistant answer. `subject` is the noun phrase the panel shows with an article, such
 *  as "a number" (a panel that shows no verdicts) or "a number or a verdict". `unlabelled` is the
 *  clause for a value without a tag; it defaults to "<subject> without one", which is the wording of
 *  a panel that shows numbers only. */
export declare function fixedLine(noun: string, subject: string, unlabelled?: string): string;
/** On every proposal card. `verb` is how the app's proposal takes effect, as in "Nothing is loaded
 *  until you accept." or "Nothing is changed until you accept.". */
export declare function proposalLine(verb: string): string;
/** In the panel's About text. The last sentence names the app's record file, so it is present only
 *  when the app keeps one. */
export declare function termsLine({ record }: {
    record: boolean;
}): string;
