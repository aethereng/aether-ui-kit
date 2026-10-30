import { type Ref, type WatchSource } from 'vue';
import { type DeferredFlagOptions } from '../core/deferred';
import { type DismissOptions } from '../core/dismiss';
/**
 * A display flag from a raw one ("a save is running"): it shows only once the source has been up
 * `showDelayMs`, and stays up at least `minVisibleMs` once shown. The rules and their defaults are
 * `deferredFlag`'s (controls/core). The timers stop with the scope that called this.
 */
export declare function useDeferredFlag(source: WatchSource<boolean>, options?: DeferredFlagOptions): Readonly<Ref<boolean>>;
/**
 * Closes the popover `open` names on Escape, handing focus back to `trigger`, or on a press outside
 * `root`, which holds both the popover and its control. Bound while the calling component is
 * mounted. `options` are `bindDismiss`'s (controls/core): by default the popover takes Escape
 * first and leaves it to an input method composing text.
 */
export declare function useDismiss(open: Ref<boolean>, root: Readonly<Ref<HTMLElement | null>>, trigger: () => HTMLElement | null, options?: DismissOptions): void;
