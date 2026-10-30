/** The kit's text field and select: 9 px of padding and 1 px of border on each side, and 2 px for the caret. */
export declare const PAD = 22;
/** The room a select's arrow takes. */
export declare const ARROW = 24;
export declare const NUMBER: {
    floor: number;
    ceiling: number;
};
export declare const CHOICE: {
    floor: number;
    ceiling: number;
};
export declare const TEXT_CEILING = 200;
/** The width a text takes in px, in the font of the kit's controls. */
export type Measure = (text: string) => number;
/**
 * Measures in the font the kit's controls draw in: 13.5 px of the page's family with tabular figures, as a table's fields
 * set them, one character at a time in a hidden span, each character once. CHAR a character where nothing lays out (a
 * width of 0), and every character where there is no document. Characters are measured again once the page's fonts have
 * loaded.
 */
export declare function measurer(): Measure;
/** A number column's width: its widest value; NUMBER.floor where no value is written. */
export declare function numberWidth(values: readonly string[], measure: Measure): number;
/** A choice column's width: its longest option. */
export declare function choiceWidth(options: readonly string[], measure: Measure): number;
/** Whether `text` is cut in a control `width` px wide, `chrome` px of which are not text. */
export declare const isCut: (text: string, width: number, chrome: number, measure: Measure) => boolean;
