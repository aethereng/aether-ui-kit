/* The Vue forms of two small parts of controls/core: a busy flag for the eye, and how a popover
 * closes. Each is a thin wrapper; the rules are in the core, where they are tested without a
 * framework. */
import { onBeforeUnmount, onMounted, onScopeDispose, ref, watch, type Ref, type WatchSource } from 'vue'
import { deferredFlag, type DeferredFlagOptions } from '../core/deferred'
import { bindDismiss, type DismissOptions } from '../core/dismiss'

/**
 * A display flag from a raw one ("a solve is running"): it shows only once the source has been up
 * `showDelayMs`, and stays up at least `minVisibleMs` once shown. The rules and their defaults are
 * `deferredFlag`'s (controls/core). The timers stop with the scope that called this.
 */
export function useDeferredFlag(source: WatchSource<boolean>, options?: DeferredFlagOptions): Readonly<Ref<boolean>> {
  const visible = ref(false)
  const flag = deferredFlag((on) => {
    visible.value = on
  }, options)
  watch(source, (on) => flag.set(on), { immediate: true })
  onScopeDispose(flag.stop)
  return visible
}

/**
 * Closes the popover `open` names on Escape, handing focus back to `trigger`, or on a press outside
 * `root`, which holds both the popover and its control. Bound while the calling component is
 * mounted. `options` are `bindDismiss`'s (controls/core): by default the popover takes Escape
 * first and leaves it to an input method composing text.
 */
export function useDismiss(
  open: Ref<boolean>,
  root: Readonly<Ref<HTMLElement | null>>,
  trigger: () => HTMLElement | null,
  options?: DismissOptions,
): void {
  let unbind: (() => void) | undefined
  onMounted(() => {
    unbind = bindDismiss(
      window,
      {
        isOpen: () => open.value,
        close: () => {
          open.value = false
        },
        root: () => root.value,
        trigger,
      },
      options,
    )
  })
  onBeforeUnmount(() => unbind?.())
}
