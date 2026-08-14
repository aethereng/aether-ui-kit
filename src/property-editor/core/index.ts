/* The public surface of the property-editor core. A symbol not re-exported here is NOT reachable:
 * the exports map declares this file for './property-editor/core' and carries no wildcard, so a
 * deep import of a sibling module fails with ERR_PACKAGE_PATH_NOT_EXPORTED. `coerceNumberInput`
 * and `numberStep` were documented for consumers writing their own numeric inputs while missing
 * from this list, which made that documentation an instruction to write a failing import. */
export { PropertyEditorEngine, coerceNumberInput, numberStep } from './PropertyEditorEngine'
export type { NumberInputResult } from './PropertyEditorEngine'
export type {
  ChangeEvent,
  EnumOption,
  EnumVariant,
  FieldDescriptor,
  FieldType,
  FieldValues,
  PlacementValue,
  ValidationError,
} from './types'
