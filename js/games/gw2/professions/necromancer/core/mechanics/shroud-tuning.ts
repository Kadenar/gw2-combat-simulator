import { balanceNumberFromContext, skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Resolve the entry's explicit owner in the selected catalog for both live drain and tooltips. */
export function necromancerShroudDrain(context: unknown, entry: NecromancerSkill): number {
  const owner = entry.shroudTuning;

  if (!owner) throw new Error(`Missing shroud tuning owner: ${entry.id}`);

  return owner.kind === 'skill'
    ? skillNumberFromContext(context, owner.id, 'lifeForceDrain')
    : balanceNumberFromContext(context, owner.id, 'lifeForceDrain');
}
