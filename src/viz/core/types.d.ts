export type Vec = number[];
export interface GNode {
    id: string;
    pos: Vec;
    label?: string;
    color?: string;
    r?: number;
    /** Fill opacity, e.g. to fade a parked/archived node without removing it from the layout. */
    opacity?: number;
    /** Ring colour — a second visual channel independent of fill, e.g. "this is yours" without
     *  giving up the fill colour that already encodes type/category. */
    stroke?: string;
    strokeWidth?: number;
    meta?: Record<string, unknown>;
}
export interface GEdge {
    a: string;
    b: string;
    w?: number;
}
export interface Projected {
    x: number;
    y: number;
    depth?: number;
    t?: number;
    d?: number;
}
export interface Projection {
    name: string;
    project(pos: Vec, dims: number): Projected;
}
export interface LayoutOptions {
    dims: number;
    repulsion?: number;
    spring?: number;
    damping?: number;
    rest?: number;
    /** Repulsion range. Beyond this distance nodes stop pushing each other, which is what keeps
     *  a graph with disconnected parts from drifting apart without bound. 0 disables the cutoff. */
    cutoff?: number;
    /** Pull toward `center`, per sub-step. Without it nothing holds the cloud together and a
     *  layout with no edges simply expands forever. */
    centering?: number;
    /** Where `centering` pulls toward. Defaults to the origin, which is right for a caller that
     *  re-centres on projection (mapping='fit'). A caller drawing 1:1 (mapping='direct') works
     *  in viewport coordinates, where the origin is the TOP-LEFT CORNER — centering there drags
     *  the whole graph into the corner, so those callers pass the stage centre. */
    center?: number[];
    /** Terminal velocity: max distance one node may travel per step at full alpha. Repulsion is
     *  k/d², so a pair that seeds a few px apart produces an enormous force — on a dense graph
     *  that reads as an explosion rather than a layout settling, and flings nodes far enough
     *  that alpha decays before centering can recover them. Capping SPEED leaves the equilibrium
     *  untouched; it only bounds the transient. Default Infinity (uncapped). */
    maxSpeed?: number;
    /** Hard clamp on the first two axes, [minX, minY, maxX, maxY], applied after each step.
     *  The reference implementation pins nodes inside the viewport this way so the layout can
     *  be drawn 1:1 with no rescaling — which is what lets a drag track the cursor exactly. */
    bounds?: [number, number, number, number];
    /** Force sub-steps per step(). Forces accumulate into velocity across sub-steps, then the
     *  layout damps and integrates ONCE — matching the reference implementation this came from. */
    substeps?: number;
}
export interface Viewport {
    width: number;
    height: number;
    pad?: number;
}
