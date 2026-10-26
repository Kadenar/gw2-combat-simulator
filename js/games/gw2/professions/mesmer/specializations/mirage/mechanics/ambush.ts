import { CONDITION } from '#gw2/platform/constants.js';
import { requireSkillFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { requireCanonicalSkillEffects } from '#gw2/platform/effects/validation.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ConditionEffect, StatusEffect } from '#gw2/platform/effects/types.js';
import type { MesmerAmbushAttack } from '#gw2/professions/mesmer/types.js';

// Merge Mirage skill status effects into the base skill while preserving
// explicit skill overrides and packet ordering.
function ambushStatuses<T extends 'condition' | 'boon'>(
  profile: MesmerAmbushAttack,
  type: T,
  source: 'Player' | 'Clone'
): (T extends 'condition' ? ConditionEffect : StatusEffect)[] {
  // Keep selected effects canonical so runtime expansion retains patched payloads and metadata.
  return requireCanonicalSkillEffects(profile).filter(
    (effect) => effect.type === type && effect.source === source
  ) as (T extends 'condition' ? ConditionEffect : StatusEffect)[];
}

/** Applies the active Mirage ambush skill to its runtime attack definition. */
export function mesmerSelectedAmbush(context: unknown, id: SkillId): MesmerAmbushAttack {
  const attack = requireSkillFromContext(context, id) as MesmerAmbushAttack;
  const profile = attack;
  const playerStrike = requireEffect(profile, 'strike', 'Player attack');
  const cloneStrike = requireEffect(profile, 'strike', 'Clone attack');
  const vulnerability = attack.hasVulnerability
    ? requireEffect(attack, 'condition', CONDITION.VULNERABILITY)
    : undefined;
  return {
    ...attack,
    player: {
      castTimeMs: attack.player.castTimeMs,
      damageAtMs: attack.player.damageAtMs,
      statusAtMs: attack.player.statusAtMs,
      ...playerStrike,
      conditions: ambushStatuses(profile, 'condition', 'Player'),
      boons: ambushStatuses(profile, 'boon', 'Player')
    },
    clone: {
      castTimeMs: attack.clone.castTimeMs,
      damageAtMs: attack.clone.damageAtMs,
      ...cloneStrike,
      conditions: ambushStatuses(profile, 'condition', 'Clone'),
      boons: ambushStatuses(profile, 'boon', 'Clone')
    },
    vulnerability: vulnerability
      ? {
          duration: Number(vulnerability.duration),
          stacks: Number(vulnerability.stacks)
        }
      : undefined
  };
}
