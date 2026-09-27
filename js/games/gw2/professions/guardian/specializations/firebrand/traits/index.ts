import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';

export function reactToFirebrandJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: hasTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE),
    skillId: GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
    skillName: 'Tome of Justice',
    // Tome passive Burning starts at one second; Amplified Wrath applies separately.
    passiveBurnDuration: 1
  });
}
