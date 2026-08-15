type __VLS_Props = {
    current: number;
    duration: number;
    playing: boolean;
    speed?: number;
    speeds?: number[];
    phase?: 'play' | 'precompute';
    precomputePct?: number;
    format?: (t: number) => string;
    /** 'cycle' is one button that steps through `speeds`; 'presets' lays them all out as a
     *  row of toggles. Both real consumers exist — the editor diagnostic cycles, the viewer
     *  shows the ladder — so this is the interaction axis they differ on, not two components. */
    speedMode?: 'cycle' | 'presets';
    /** Label a speed. Defaults to `1×`; a host wanting `½×` supplies its own. */
    speedLabel?: (s: number) => string;
    /** Render the dismiss button. The editor diagnostic has no stop affordance of its own —
     *  it is left via the surrounding UI — so the button has to be omittable. */
    stoppable?: boolean;
    /** Text shown beside the progress bar during `phase: 'precompute'`. */
    computeLabel?: string;
};
type __VLS_Slots = {
    play?: (props: {
        playing: boolean;
        atEnd: boolean;
    }) => unknown;
    stop?: () => unknown;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    stop: () => any;
    toggle: () => any;
    seek: (t: number) => any;
    "set-speed": (s: number) => any;
    "scrub-start": () => any;
    "scrub-end": () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onStop?: (() => any) | undefined;
    onToggle?: (() => any) | undefined;
    onSeek?: ((t: number) => any) | undefined;
    "onSet-speed"?: ((s: number) => any) | undefined;
    "onScrub-start"?: (() => any) | undefined;
    "onScrub-end"?: (() => any) | undefined;
}>, {
    speed: number;
    speeds: number[];
    phase: "play" | "precompute";
    precomputePct: number;
    format: (t: number) => string;
    speedMode: "cycle" | "presets";
    speedLabel: (s: number) => string;
    stoppable: boolean;
    computeLabel: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
