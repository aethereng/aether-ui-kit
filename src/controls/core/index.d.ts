import type { ChipOption } from './types';
export type { SegOption, ChipOption, FilterGroup, SegProps, ChipProps, ToolProps, ChatMessage, } from './types';
export declare function isSegActive<V extends string>(value: V, active: V): boolean;
export declare function isChipActive<V extends string>(value: V, active: V | Set<V>): boolean;
export declare function hasVisibleOptions<V extends string>(options: ChipOption<V>[]): boolean;
export { DEFAULT_SPEEDS, cycleSpeed, isAtEnd, beginScrub, endScrub } from './transport';
export type { ScrubHandle } from './transport';
