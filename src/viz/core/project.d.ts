import type { Projection } from './types';
export declare const ortho2d: Projection;
export declare const iso3d: Projection;
export interface Fit {
    minX: number;
    minY: number;
    s: number;
    pad: number;
}
export declare function fitToViewport(pts: {
    x: number;
    y: number;
}[], w: number, h: number, pad?: number): Fit;
/** Viewport point -> the world coordinate that projects to it. */
export declare function unproject(vx: number, vy: number, f: Fit): {
    x: number;
    y: number;
};
