import { type GNode, type GEdge } from '../core';
type __VLS_Props = {
    nodes: GNode[];
    edges: GEdge[];
    width?: number;
    height?: number;
    projection?: 'ortho2d' | 'iso3d';
    running?: boolean;
    selection?: string | null;
    neighbors?: Set<string> | null;
    /** How positions map to the viewport.
     *  'fit'   — rescale the cloud to fill the box every render. Convenient, but the scale
     *            changes as the data moves, so a dragged node does not track the cursor.
     *  'direct'— positions ARE viewport coordinates, drawn 1:1. What the reference does; pair
     *            it with the layout's `bounds` so nothing can leave the stage. */
    mapping?: 'fit' | 'direct';
    /** Wheel/pinch to zoom, background-drag to pan. Off by default: a graph that eats the
     *  wheel is hostile inside a scrolling page, so the host opts in. */
    zoomable?: boolean;
    minZoom?: number;
    maxZoom?: number;
};
declare function zoomAt(mx: number, my: number, factor: number): void;
declare function zoomIn(): void;
declare function zoomOut(): void;
declare function zoomFit(pad?: number): void;
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    zoomIn: typeof zoomIn;
    zoomOut: typeof zoomOut;
    zoomFit: typeof zoomFit;
    zoomAt: typeof zoomAt;
    zoom: import("vue").Ref<number, number>;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    drag: (id: string, x: number, y: number) => any;
    dragEnd: (id: string) => any;
    nodeClick: (id: string) => any;
    nodeDown: (id: string, x: number, y: number) => any;
    zoom: (k: number) => any;
    nodeHover: (id: string, clientX: number, clientY: number) => any;
    nodeLeave: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onDrag?: ((id: string, x: number, y: number) => any) | undefined;
    onDragEnd?: ((id: string) => any) | undefined;
    onNodeClick?: ((id: string) => any) | undefined;
    onNodeDown?: ((id: string, x: number, y: number) => any) | undefined;
    onZoom?: ((k: number) => any) | undefined;
    onNodeHover?: ((id: string, clientX: number, clientY: number) => any) | undefined;
    onNodeLeave?: (() => any) | undefined;
}>, {
    width: number;
    selection: string | null;
    height: number;
    projection: "ortho2d" | "iso3d";
    running: boolean;
    neighbors: Set<string> | null;
    mapping: "fit" | "direct";
    zoomable: boolean;
    minZoom: number;
    maxZoom: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
