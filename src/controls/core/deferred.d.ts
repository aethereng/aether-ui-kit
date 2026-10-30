export interface DeferredFlagOptions {
    /** How long the source must be up before the flag shows, in ms. */
    showDelayMs?: number;
    /** How long the flag stays up once shown, at least, in ms. */
    minVisibleMs?: number;
}
export interface DeferredFlag {
    /** Tells the flag what the source reads now. */
    set(on: boolean): void;
    /** Whether the flag shows. */
    readonly visible: boolean;
    /** Cancels a change still waiting; the flag keeps what it shows. */
    stop(): void;
}
export declare function deferredFlag(onChange: (visible: boolean) => void, { showDelayMs, minVisibleMs }?: DeferredFlagOptions): DeferredFlag;
