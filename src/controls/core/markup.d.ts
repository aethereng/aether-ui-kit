export declare const MAX_QUOTE_DEPTH = 8;
export declare const QUOTE_LINE: RegExp;
export declare const LIST_LINE: RegExp;
/** Whether the token `raw`, at `at` in `text`, opens a list item the parser reads. The text from the start
 *  of its line to `at` must be quote prefixes (no more than the parser strips) and indentation, and the
 *  token must be the marker: an ordered number followed by a space or the end of the line. */
export declare function opensListItem(text: string, at: number, raw: string): boolean;
