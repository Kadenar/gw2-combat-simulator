import { CURRENT_PATCH_ID } from '#gw2/integrations/patches/authoring/patches.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';

/** Serializable choice of game data; experimental values belong only to the preview session. */
export interface PatchSelection {
  readonly id: string;
  readonly values?: Readonly<Record<string, number>>;
}

/** One normalized selection shares its immutable catalog and balance context across all consumers. */
export interface ResolvedPatch extends PatchSelection {
  readonly key: string;
  readonly catalog: Readonly<CanonicalCatalog>;
  readonly balanceContext: ProfessionBalanceContext;
  readonly reworks: readonly string[];
}

/** Keep the engine wire representation at this boundary instead of propagating two selection arguments. */
export function selectionFromConfig(config: Readonly<Gw2Config>): PatchSelection {
  return { id: config.patchId || CURRENT_PATCH_ID, values: config.previewValues };
}
