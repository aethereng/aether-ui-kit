import { type GanttItem, type GanttLane } from '../core/gantt';
type __VLS_Props = {
    items: GanttItem[];
    lanes: GanttLane[];
    ppd: number;
    ndays: number;
    currentDay?: number | null;
    selection?: string | null;
    markers?: {
        day: number;
        label: string;
    }[];
    weekends?: number[];
    weekdays?: number[];
    /** Small labels down the spine, one per week separator. The reference chart fills the
     *  middle of the anchor band with these; without them the band reads as empty space.
     *  Labels are caller-supplied because the component works in day indices, not dates. */
    weekLabels?: {
        day: number;
        label: string;
    }[];
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    move: (id: string, start: number, end: number | null) => any;
    select: (id: string) => any;
    resize: (id: string, edge: "l" | "r", value: number) => any;
    dragStart: (id: string) => any;
    dragEnd: (id: string) => any;
    newAt: (day: number, type: string) => any;
    expandDay: (day: {
        t: string;
        i: number;
    } | null) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onMove?: ((id: string, start: number, end: number | null) => any) | undefined;
    onSelect?: ((id: string) => any) | undefined;
    onResize?: ((id: string, edge: "l" | "r", value: number) => any) | undefined;
    onDragStart?: ((id: string) => any) | undefined;
    onDragEnd?: ((id: string) => any) | undefined;
    onNewAt?: ((day: number, type: string) => any) | undefined;
    onExpandDay?: ((day: {
        t: string;
        i: number;
    } | null) => any) | undefined;
}>, {
    currentDay: number | null;
    selection: string | null;
    markers: {
        day: number;
        label: string;
    }[];
    weekends: number[];
    weekdays: number[];
    weekLabels: {
        day: number;
        label: string;
    }[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
