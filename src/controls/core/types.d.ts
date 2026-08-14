export type SegOption<V extends string = string> = {
    value: V;
    label: string;
    disabled?: boolean;
};
export interface SegProps<V extends string = string> {
    options: SegOption<V>[];
    /** `null` means NO option is selected, which any preset selector over continuous or derived
     *  state needs: "the current value matches none of these". The alternative -- a synthetic
     *  "Custom" option standing in for nothing-selected -- lies about the option set AND becomes
     *  selectable, so it needs its own guard against being chosen. This does not. */
    modelValue: V | null;
    ariaLabel?: string;
    /** 'default' — square-cornered, panel-grey active segment.
     *  'pill'    — fully rounded, uppercase mono, accent-wash active segment. A second real look
     *              that already shipped in a consumer's header, not a style hook: the same
     *              precedent Chip's `variant` set. */
    variant?: 'default' | 'pill';
}
export type ChipOption<V extends string = string> = {
    value: V;
    label: string;
    count?: number;
    /** Leading dot. Omit for none. */
    dotColor?: string;
    /** A raw CSS declaration list for the leading swatch, e.g. 'background:#c33' or
     *  'border:1.5px dashed #c33'. Where dotColor gives an 8px colour dot, this gives a wider
     *  block that can carry the SAME encoding as the thing being filtered — a dashed border for
     *  "planned", a faded fill for "done". That is what lets a set of chips replace a legend
     *  rather than sit beside one. Takes precedence over dotColor. */
    swatch?: string;
    /** Accent for the chip's own text and active border. Distinct from dotColor because
     *  the two encode different things and surfaces use them independently: a rail may
     *  colour the dot by category while leaving the label neutral, or colour the label to
     *  carry the encoding with no dot at all. */
    color?: string;
    /** De-emphasise without disabling. The canonical filter behaviour dims an option whose count
     *  is zero but keeps it clickable, so a user can still see the axis exists. Distinct from
     *  `disabled`, which removes the interaction entirely. */
    muted?: boolean;
    disabled?: boolean;
    /** Per-option explanatory text, rendered as the native `title` attribute.
     *
     *  KNOWN TRADEOFF, not an oversight: native `title` has no touch equivalent. On a phone or
     *  tablet this text is simply unreachable, and nothing errors -- it fails silently. Fine for a
     *  label restatement or a hint; NOT fine if the text is load-bearing content a user needs to
     *  make the choice. A chip carrying real explanatory content needs a different affordance
     *  (visible helper text, or a disclosure), not a tooltip. */
    title?: string;
};
export interface ChipProps<V extends string = string> {
    options: ChipOption<V>[];
    modelValue: V | Set<V>;
    ariaLabel?: string;
}
export interface ToolProps {
    label: string;
    hot?: boolean;
    disabled?: boolean;
}
export interface DisclosureProps {
    /** Header text, and the toggle's accessible name. */
    label: string;
    /** Whether the region is revealed. The caller owns it. */
    open?: boolean;
    /** Quieter second line under `label` — a filename, a count, what is inside. */
    meta?: string;
    /** Disable the toggle. The region stays in whatever state `open` says. */
    disabled?: boolean;
}
export interface FilterGroup<V extends string = string> {
    key: string;
    label: string;
    options: ChipOption<V>[];
    selected: Set<V>;
}
export interface ChatMessage {
    role: 'you' | 'agent' | 'sys';
    text: string;
    queued?: boolean;
    refs?: string[];
}
