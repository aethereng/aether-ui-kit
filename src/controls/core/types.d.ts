export type SegOption<V extends string = string> = {
    value: V;
    label: string;
    disabled?: boolean;
};
export interface SegProps<V extends string = string> {
    options: SegOption<V>[];
    modelValue: V;
    ariaLabel?: string;
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
