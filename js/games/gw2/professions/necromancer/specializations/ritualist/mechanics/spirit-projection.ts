import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

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

/** Resolve only the named attacks the spirit can execute from the selected balance profile. */
export function spiritAttackEffects(context: unknown, skillId: SkillId) {
  const attacks = SPIRIT_ATTACKS.get(skillId);
  if (!attacks) return undefined;
  const profile = requireBalanceProfileFromContext(context, RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID[Number(skillId)]);
  const strike = (name: string | undefined) => (name ? requireEffect(profile, 'strike', name) : undefined);
  return {
    key: attacks.key,
    profile,
    autoattack: strike(attacks.autoattack),
    initial: strike(attacks.initial),
    lingering: strike(attacks.lingering),
    active: strike(attacks.active)
  };
}
