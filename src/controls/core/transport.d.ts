export declare const DEFAULT_SPEEDS: number[];
export declare function cycleSpeed(speeds: number[], current: number): number;
export declare function isAtEnd(current: number, duration: number, eps?: number): boolean;
export interface ScrubHandle {
    resume: boolean;
}
export declare function beginScrub(playing: boolean): ScrubHandle;
export declare function endScrub(h: ScrubHandle, playing: boolean): boolean;
