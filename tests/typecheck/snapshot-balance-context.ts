import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type { ProfessionStateSnapshotContext } from '#gw2/platform/profession-presentation/types.js';

type Assert<T extends true> = T;

/** Snapshots carry one required balance source and cannot supply independent catalogs or modifier maps. */
export type SnapshotBalanceAssertions = [
  Assert<ProfessionStateSnapshotContext['balanceContext'] extends ProfessionBalanceContext ? true : false>,
  Assert<'catalog' extends keyof ProfessionStateSnapshotContext ? false : true>,
  Assert<'modifierRulesById' extends keyof ProfessionStateSnapshotContext ? false : true>
];
