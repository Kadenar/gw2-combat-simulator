import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { type SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { type EngineerSkill, type EngineerModifierContext } from '#gw2/professions/engineer/types.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

// Evolve variants share ammo and Mercurial Tendencies recharge.
const EVOLVE_SKILL_IDS = new Set<SkillId>([ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX]);

/** Only the selected Double Helix variant receives the active profile's Evolve ammo capacity. */
export function amalgamMaximumAmmo(context: MaximumAmmoContext<object>, skill: EngineerSkill, maximum: number): number {
  if (!EVOLVE_SKILL_IDS.has(Number(skill.id))) return maximum;
  return skill.id === ID.EVOLVE_DOUBLE_HELIX && context.hasTrait(TRAIT.DOUBLE_HELIX)
    ? Math.max(balanceProfileNumber(context.requireBalanceProfile(PROFILE.evolve), 'maximumStacks'), maximum || 0)
    : 0;
}

/** Double Helix chooses the Evolved bonus without changing the shared pre-profession conversion pool. */
export function evolveAttributeFactor(context: EngineerModifierContext): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.evolve);
  return balanceProfileNumber(
    profile,
    hasTrait(context, TRAIT.DOUBLE_HELIX) ? 'coefficientMultiplier' : 'damageMultiplier'
  );
}

/** Restrict Symbiotic Synergy to player-owned Morph strikes. */
export function morphStrike(context: EngineerModifierContext): boolean {
  return Boolean(
    isGw2PlayerModifierOwnedEvent(context.event) &&
    skillForEvent(context.profession?.catalog, context.event, context.skillId)?.categories?.includes('Morph')
  );
}
