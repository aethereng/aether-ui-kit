import { type ReferenceScopes } from '../../controls/core/refs';
import type { RefChipData } from '../../controls/core/chat';
/** One minted reference, keyed in the index by the reference as written, braces included. */
export interface RefEntry {
    ref: string;
    scope: string;
    path: string;
    value: unknown;
    unit: string | null;
    source: RefChipData['source'];
    provenance: string | null;
    mintedBy: string;
    reduced: boolean;
}
export declare class ReferenceIndex {
    readonly scopes: ReferenceScopes;
    readonly index: Map<string, RefEntry>;
    readonly admitted: Set<string>;
    constructor(scopes?: ReferenceScopes);
    /** Mint `{{scope:path}}` for a value and return it as written. Minting the same reference again
     *  replaces its entry; an artefact of a conversation does not change, so the value is the same. */
    mint(scope: string, path: string, value: unknown, unit: string | null, source: RefChipData['source'], mintedBy: string, provenance?: string | null, reduced?: boolean): string;
    /** Whether the conversation minted `ref`, braces included. */
    holds(ref: string): boolean;
    /** Admit identifiers the numeral gate may read bare. */
    admit(ids: Iterable<string>): void;
    clear(): void;
}
