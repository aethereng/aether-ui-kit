import { type ComputedRef } from 'vue';
import type { ThemeController } from '../core/theme';
export interface ThemeRefs {
    /** The active theme's name. */
    name: ComputedRef<string>;
    isDark: ComputedRef<boolean>;
    /** The active palette, for what cannot read CSS (a WebGL scene). */
    colors: ComputedRef<Record<string, string>>;
    /** The controller's toggle. */
    toggle(): void;
}
export declare function themeRefs(controller: ThemeController): ThemeRefs;
