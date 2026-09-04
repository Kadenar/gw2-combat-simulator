import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { BalanceProfile, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';

interface RevenantEffectOwner {
  readonly name: string;
  readonly effects?: readonly SkillEffect[];
}

/** Requires patched Revenant balance data where missing declarations are invalid content. */
export function requireRevenantBalanceProfile(context: unknown, id: SkillId): BalanceProfile {
  const profile = balanceProfileFromContext(context, id);
  if (!profile) throw new Error(`Missing Revenant balance profile ${String(id)}.`);
  return profile;
}

/** Requires an untriggered root effect while leaving nested triggered packets to their owner. */
export function requireRevenantEffect(owner: RevenantEffectOwner, type: SkillEffect['type']): SkillEffect {
  const effect = owner.effects?.find(
    (candidate) => candidate.type === type && String(candidate.metadata?.trigger || '') === ''
  );
  if (!effect) throw new Error(`${owner.name} is missing its ${type} effect.`);
  return effect;
}
