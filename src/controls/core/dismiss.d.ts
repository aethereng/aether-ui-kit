export interface DismissTarget {
    /** Whether the popover is open now. */
    isOpen(): boolean;
    /** Closes it. */
    close(): void;
    /** The element holding both the popover and the control that opens it. */
    root(): Element | null;
    /** The control that opens it; it takes focus back when Escape closes the popover. */
    trigger(): HTMLElement | null;
}
export interface DismissOptions {
    /**
     * The popover takes Escape before anything under it: the key is read in the capture phase and
     * marked as used (`preventDefault`), so a handler that reads `defaultPrevented` can skip the same
     * press. False reads it after the page's own handlers and leaves it unmarked.
     * Default true.
     */
    first?: boolean;
    /**
     * Escape pressed while an input method composes text stays with the composition, where it
     * cancels what is being composed. False closes the popover on it as well. Default true.
     */
    keepComposition?: boolean;
}
export declare function bindDismiss(win: Window, target: DismissTarget, options?: DismissOptions): () => void;
