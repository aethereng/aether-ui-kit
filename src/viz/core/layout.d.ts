import type { GNode, GEdge, LayoutOptions } from './types';
export declare class ForceLayout {
    nodes: GNode[];
    edges: GEdge[];
    opts: Required<LayoutOptions>;
    private vel;
    private alphaValue;
    private pinned;
    constructor(nodes: GNode[], edges: GEdge[], opts: LayoutOptions);
    /** Current temperature, 0..1. Below ~0.02 there is nothing left to see. */
    alpha(): number;
    /** Re-heat. Call on a drag so the neighbourhood relaxes around the moved node. */
    reheat(to?: number): void;
    /** True while the sim is still worth stepping — drive your rAF loop off this. */
    get running(): boolean;
    /** Hold a node in place: forces still propagate FROM it, but nothing moves it. */
    pin(id: string, pos?: number[]): void;
    unpin(id: string): void;
    isPinned(id: string): boolean;
    step(): void;
}
