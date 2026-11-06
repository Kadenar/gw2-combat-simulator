import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillSource } from '#gw2/platform/skills/balance-profiles.js';
import { requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Named roles are shared by spirit execution and presentation, so removing a sibling cannot reclassify an attack. */
const SPIRIT_ATTACKS: ReadonlyMap<
  SkillId,
  {
    readonly key: string;
    readonly autoattack: string;
    readonly initial?: string;
    readonly lingering?: string;
    readonly active?: string;
  }
> = new Map([
  [
    ID.ANGUISH,
    {
      key: 'anguish',
      autoattack: 'Anguish Autoattack',
      initial: 'Anguish Initial Barrage',
      active: 'Summon Spirits - Anguish'
    }
  ],
  [
    ID.WANDERLUST,
    {
      key: 'wanderlust',
      autoattack: 'Wanderlust Autoattack',
      initial: 'Wanderlust Initial Swing',
      lingering: 'Wanderlust Initial Field',
      active: 'Summon Spirits - Wanderlust'
    }
  ],
  [ID.PRESERVATION, { key: 'preservation', autoattack: 'Preservation Autoattack' }]
]);

export const RITUALIST_SPIRIT_SKILL_IDS = Object.freeze([...SPIRIT_ATTACKS.keys()]);

/** Resolve only the named attacks the spirit can execute from their selected skill and action owners. */
export function spiritAttackEffects(source: SkillSource, skillId: SkillId) {
  const attacks = SPIRIT_ATTACKS.get(skillId);

  if (!attacks) return undefined;

  const summon: NecromancerSkill = requireSkill(source, skillId);
  const profile = requireSkill(source, summon.summonAttackId as SkillId);
  const opening = requireSkillAction(summon, 'opening');
  const command = requireSkill(source, ID.SUMMON_SPIRITS);
  const commands = requireSkillAction(command, 'commands');
  return {
    key: attacks.key,
    profile,
    opening,
    autoattack: requireEffect(profile, 'strike', attacks.autoattack),
    initial: attacks.initial ? requireEffect(summon, 'strike', attacks.initial, opening) : undefined,
    lingering: attacks.lingering ? requireEffect(summon, 'strike', attacks.lingering, opening) : undefined,
    active: attacks.active ? requireEffect(command, 'strike', attacks.active, commands) : undefined
  };
}
