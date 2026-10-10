import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { balanceProfileNumber, effectNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Poison-producing traits share the selected stack override while retaining their own profile tuning. */
export function potentPoisonStacks(context: unknown, profile: BalanceProfile, effect: SkillEffect): number {
  return hasTrait(context, TRAIT.POTENT_POISON)
    ? balanceProfileNumber(profile, 'playerStacks')
    : effectNumber(profile, effect, 'stacks');
}
