/** `mixed` is a group some of whose members are on. */
export type CheckState = 'off' | 'on' | 'mixed';
/** `mixed` wins over `checked`: a group partly on is partly on, whichever value its caller holds. */
export declare function checkState(checked: boolean, mixed?: boolean): CheckState;
/** The value of `aria-checked` for a state. */
export declare function ariaChecked(state: CheckState): 'true' | 'false' | 'mixed';
/** What a press asks for. A group partly on asks for all of it on, so one press settles it whichever
 *  value the caller holds behind `mixed`. */
export declare function nextChecked(checked: boolean, mixed?: boolean): boolean;
/** Space presses a checkbox and Enter does not, as with the browser's own. */
export declare function isCheckboxKey(key: string): boolean;
export interface CheckboxLengths {
    /** The side of the key, whole and even, so a dot or a bar has a whole pixel to sit on each way. */
    side: number;
    radius: number;
    dot: number;
    barWidth: number;
    barHeight: number;
}
export declare function checkboxLengths(size: number): CheckboxLengths;
