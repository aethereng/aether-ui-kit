// Framework-free core for the shared control primitives (Seg, Chip, Tool).
// Per the packaging decision: zero Vue imports; the mechanical contract (which
// option is active, what a click emits) lives here, domain semantics stay with the caller.
//
// The `import type { ChipOption }` that used to sit here went with hasVisibleOptions; it was that
// function's parameter type and nothing else's. ChipOption is still re-exported below.

// Re-export the whole type surface. A consumer types its own state against these:
// FilterGroup[] in particular is the shape a caller must build to use FilterRail, so
// omitting it made the component unusable from outside without reaching past the
// exports map into ./types directly.
export type {
  SegOption,
  ChipOption,
  FilterGroup,
  SegProps,
  ChipProps,
  ToolProps,
  DisclosureProps,
  SelectOption,
  SelectGroup,
  SliderTick,
  RadioOption,
  RadioGroupProps,
} from './types'

/* Menu's keyboard model, exported for the same reason Tree's is: a caller building its own menu
   surface should be able to reuse the model rather than re-derive which keys wrap and which items
   are skipped. `typeahead` lives in ./tree and is shared by both. */
export type { MenuItem, MenuKeyResult } from './menu'
export { focusableItems, firstItem, lastItem, menuKey, isTypeaheadKey } from './menu'

/* Chip supports a single active value OR a Set of them (multi-select filters), and choosing
 * between those two shapes is the only real decision in this file; this is why this is the only
 * predicate left. Chip.vue calls it; a caller reproducing Chip's active-state logic should too.
 *
 * REMOVED in 0.7.0: `isSegActive` and `hasVisibleOptions`.
 *   isSegActive was `return value === active` with zero callers: Seg.vue always inlined the
 *   comparison. It encoded nothing a caller could not write, and once Seg's modelValue widened to
 *   `V | null` its own signature could no longer express the contract it was named for.
 *   hasVisibleOptions was `options.some(o => (o.count ?? 0) > 0)`, also with zero callers, and
 *   "is a zero-count option worth showing" is a caller's policy, not this kit's mechanics; the
 *   `muted` flag exists precisely so a host can keep such an option visible.
 * Neither was used by any component, so their presence claimed a core-logic split that Seg did
 * not actually have. */
export function isChipActive<V extends string>(value: V, active: V | Set<V>): boolean {
  if (active instanceof Set) return active.has(value)
  return value === active
}

// The transport core is the other half of controls/. Re-exported here because the scrub
// bargain in particular (beginScrub/endScrub) is a decision every playback host must make
// identically; leaving it reachable only from inside the kit meant the one consumer that
// needed it wrote its own copy, which is the duplication this package exists to end.
export { DEFAULT_SPEEDS, cycleSpeed, isAtEnd, beginScrub, endScrub } from './transport'
export type { ScrubHandle } from './transport'

// The ChatPanel core: the message union, the `{{scope:path}}` reference grammar and the bare-numeral
// rule. Public because the app that fills a log in is the one that knows what a reference points at
// and which numerals it admits, and may run the same rules outside any component.
export type {
  ChatMessage,
  ChatMark,
  ChatToolMessage,
  ChatToolStatus,
  ChatRefusalMessage,
  ChatProposalMessage,
  ChatProposalRow,
  ChatProposalCell,
  ChatProposalDecision,
  ChatProposalBasis,
  ChatProposalFlag,
  ChatProposalStatus,
  ChatCardMessage,
  ChatEntry,
  ChatSegment,
  BareNumeralSpan,
  RefSourceKind,
  RefChipData,
  RefChipText,
} from './chat'
export {
  isTextMessage,
  splitReferences,
  findBareNumerals,
  describeRef,
  REF_HASH_LENGTH,
  UNRESOLVED_TEXT,
  REDUCED_TEXT,
  STREAM_FOLLOW_THRESHOLD,
  CHIP_TEXT_LIMIT,
} from './chat'

// The reference grammar: the scope list, the numeral gate and the path rules. An app that mints or
// resolves references runs these, so its gate and the panel's chips read one vocabulary.
export {
  DEFAULT_REFERENCE_SCOPES,
  DEFAULT_PATH_RULES,
  numeralGate,
  referencesIn,
  hasReservedCharacter,
  reservedCharactersOf,
  idsIn,
  slug,
  parsePath,
  formatPath,
  resolvePath,
  modelLeaves,
} from './refs'
export type {
  ReferenceScopes,
  Violation,
  ViolationKind,
  PathRules,
  PathStep,
  ParsedPath,
  Reduction,
  TupleTable,
  Leaf,
  LeafOptions,
} from './refs'

// The Tree core: the row model and the whole keyboard contract, framework-free. Public because a
// caller types its own node data against TreeNode<T> and may drive the same key handling itself.
export { visibleRows, treeKey, typeahead, ancestorIds, isExpandable } from './tree'
export type { TreeNode, TreeRow, TreeKeyResult } from './tree'

// A busy flag that shows late and stays a minimum time, and how a popover closes: the halves of
// useDeferredFlag and useDismiss (controls/composables) that need no framework.
export { deferredFlag } from './deferred'
export type { DeferredFlag, DeferredFlagOptions } from './deferred'
export { bindDismiss } from './dismiss'
export type { DismissTarget, DismissOptions } from './dismiss'
