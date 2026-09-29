import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';

export function reactToDragonhunterJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  const core = professionCoreState(context);
  const passiveBefore = core.justicePassiveBurns || 0;
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: false,
    skillId: ID.SPEAR_OF_JUSTICE,
    skillName: 'Spear of Justice'
  });

  // Passive Crippled only fires when the passive burn counter actually incremented,
  // i.e. a new passive Justice proc occurred on this hit (not an active proc).
  if ((core.justicePassiveBurns || 0) > passiveBefore) {
    const tetherProfile = requireBalanceProfileFromContext(context, PROFILE.tether);
    const crippled = requireEffect(tetherProfile, 'condition', 'Crippled (passive)');
    if (crippled) {
      context.applyCondition(
        buildResolverCondition({
          at: event.at,
          source: 'guardian',
          sourceId: ID.SPEAR_OF_JUSTICE,
          // The passive condition belongs to the accepted hit, including delayed impacts.
          activationId: event.activationId,
          causalOrder: event.causalOrder ?? event.eventOrder,
          actorType: 'player',
          skillId: ID.SPEAR_OF_JUSTICE,
          skillName: 'Spear of Justice',
          name: 'Spear of Justice — Passive Crippled',
          condition: String(crippled.condition),
          stacks: effectNumber(tetherProfile, crippled, 'stacks'),
          duration: effectNumber(tetherProfile, crippled, 'duration')
        })
      );
    }
  }
}
