import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Field extensions use the authored skill tag; individual damage packets carry their own symbol eligibility. */
export function isGuardianSymbolSkill(skill: GuardianSkill | undefined): boolean {
  return skill?.tags?.includes('symbol') === true;
}
