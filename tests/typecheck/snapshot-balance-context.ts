import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type {
  ProfessionStateSnapshotContext,
  ProfessionUiContract
} from '#gw2/platform/profession-presentation/types.js';
import type { selectedTraits } from '#gw2/professions/shared/trait-data.js';

type Assert<T extends true> = T;

/** Snapshots carry one required balance source and cannot supply independent catalogs or modifier maps. */
export type SnapshotBalanceAssertions = [
  Assert<ProfessionStateSnapshotContext['balanceContext'] extends ProfessionBalanceContext ? true : false>,
  Assert<'catalog' extends keyof ProfessionStateSnapshotContext ? false : true>,
  Assert<'modifierRulesById' extends keyof ProfessionStateSnapshotContext ? false : true>
];

/** Trait resolution and threshold hooks reject absent catalogs instead of silently hiding selected traits. */
export type TraitCatalogAssertions = [
  Assert<undefined extends Parameters<typeof selectedTraits>[0] ? false : true>,
  Assert<null extends Parameters<typeof selectedTraits>[0] ? false : true>,
  Assert<{} extends Parameters<ProfessionUiContract['targetHealthThresholds']>[0] ? false : true>
];
