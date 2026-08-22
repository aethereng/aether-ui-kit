export declare const SPINE_H = 92;
export declare const LANE_ROW = 34;
export declare const LANE_PAD = 10;
export declare const LANE_MIN = 54;
export declare const DENS_H = 36;
export declare function computePPD(view: string, scrollWidth: number, ndays: number, monthDays?: number): number;
export interface GanttItem {
    id: string;
    start: number;
    end?: number | null;
    type: string;
    anchor?: boolean;
    status?: string;
    title: string;
}
export interface GanttLane {
    type: string;
    name: string;
    color: string;
    wash: string;
}
export interface LaneLayout {
    type: string;
    meta: GanttLane;
    empty: boolean;
    height: number;
    spans: GanttItem[];
    points: GanttItem[];
    byDay: Record<number, GanttItem[]>;
    expanded: GanttItem[] | null;
    rows: number[];
    /** Stacking row per span id. Returned as data rather than stamped onto the caller's
     *  objects: this function must not mutate its input. A consumer may hand us a deep
     *  reactive array (the gallery does), and writing to it from inside the computed that
     *  reads it is a write-during-read — currently idempotent, but it stops being so the
     *  moment a drag changes rows mid-gesture. */
    rowOf: Record<string, number>;
}
export declare function isPoint(it: GanttItem): boolean;
export declare function laneLayout(lanesMeta: GanttLane[], visible: GanttItem[], expandDay: {
    t: string;
    i: number;
} | null): Record<string, LaneLayout>;
export declare function lanesHeight(lanes: Record<string, LaneLayout>): number;
export declare function densGeom(L: LaneLayout): {
    dy: number;
    base: number;
};
