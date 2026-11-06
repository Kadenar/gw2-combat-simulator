import type { BalanceSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceNumber, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Resolve the entry's explicit owner in the selected catalog for both live drain and tooltips. */
export function necromancerShroudDrain(source: BalanceSource, entry: NecromancerSkill): number {
  const owner = entry.shroudTuning;

  if (!owner) throw new Error(`Missing shroud tuning owner: ${entry.id}`);

  return owner.kind === 'skill'
    ? skillNumber(requireSkill(source, owner.id), 'lifeForceDrain')
    : balanceNumber(source, owner.id, 'lifeForceDrain');
}
