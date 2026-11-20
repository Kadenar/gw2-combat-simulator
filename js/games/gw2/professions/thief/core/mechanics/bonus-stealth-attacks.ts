/** The active elite owns its grants. Combat and planning read them at the requested time. */
import type { SpecializationRuntimeState } from '#gw2/platform/profession-definition/state.js';
import { activeBatchCount, type Batch } from '#kernel/resources/batch.js';

export interface BonusStealthAttackCharges {
  grants(profession: SpecializationRuntimeState): readonly Readonly<Batch>[];
  spend(profession: SpecializationRuntimeState, at: number, stealthed: boolean): void;
}

/** Combat and the palette can check a charge through its deadline without spending it. */
export function hasBonusStealthAttack(grants: readonly Readonly<Batch>[] | undefined, at: number): boolean {
  return grants?.some((grant) => activeBatchCount(grant, at) > 0) ?? false;
}

/** Publish the remaining count and deadline of each live grant for the palette and Active State. */
export function projectBonusStealthAttackCharges(
  charges: BonusStealthAttackCharges,
  profession: SpecializationRuntimeState,
  at: number
): Batch[] {
  return charges
    .grants(profession)
    .filter((grant) => activeBatchCount(grant, at) > 0)
    .map(({ count, expiresAt }) => ({ count, expiresAt }));
}
