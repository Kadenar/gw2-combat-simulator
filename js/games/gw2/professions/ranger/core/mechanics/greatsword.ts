import { enqueueOrdered } from '#kernel/events/queue.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { RangerResolverContext, RangerResolverEvent } from '#gw2/professions/ranger/types.js';

// Only direct attacks spend the charge; trait and stance damage cannot steal it.
function attackRecipient(event?: SimulationEvent | null): 'pet' | 'player' | undefined {
  if (event?.type !== 'damage' || !(Number(event.coefficient) > 0) || event.actorType === 'effect') return;
  if (isPetStrike(event)) return 'pet';
  if (isPlayerStrike(event)) return 'player';
}

export const rangerAttackOfOpportunityModifier: Gw2ModifierRule = {
  id: 'ranger.attack-of-opportunity',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  parameters: { petFactor: 1.5, playerFactor: 1.25 },
  factor: (context, _target, parameters) =>
    attackRecipient(context.event) === 'pet' ? parameters.petFactor : parameters.playerFactor,
  // Read live applications so consuming the charge also affects other packets at the same timestamp.
  when: (context) => {
    const recipient = attackRecipient(context.event);
    if (!recipient) return false;
    return (context.runtime?.boons?.get(`attack-of-opportunity-${recipient}`) || []).some(
      (application) =>
        application.at <= context.time &&
        application.expiresAt > context.time &&
        application.stacks > 0 &&
        (recipient === 'player' ||
          application.resolvedAudience.companionIds.includes(String(context.event?.summonOwner)))
    );
  }
};

/** Grant Maul's next-attack bonus after its own strike resolves, to the selected recipient. */
export function grantMaulAttackOfOpportunity(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  recipient: 'pet' | 'player'
): void {
  if (!isPlayerStrike(event) || (event.skillId !== ID.MAUL && event.skillId !== ID.MAUL_ID_46629)) return;
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'ranger',
    sourceId: event.skillId,
    actorType: 'player',
    skillId: event.skillId,
    skillName: 'Attack of Opportunity',
    name: 'Attack of Opportunity',
    kind: `attack-of-opportunity-${recipient}`,
    duration: balanceProfileValueFromContext(context, PROFILE.attackOfOpportunity, 'durationMultiplier', 10),
    stacks: 1,
    audience:
      recipient === 'pet'
        ? { recipients: 'summons', eligibleCompanionIds: [rangerPetCompanionId(context)] }
        : { recipients: 'self' },
    triggeredBy: event.skillName
  });
}

/** Consume after damage calculation, then let Maul grant a fresh, non-stacking charge. */
export function reactToRangerGreatswordDamage(context: RangerResolverContext, event: RangerResolverEvent): void {
  const recipient = attackRecipient(event);
  if (!recipient) return;
  const kind = `attack-of-opportunity-${recipient}`;
  const applications = context.boons.get(kind);
  if (applications) {
    context.boons.set(
      kind,
      applications.map((application) =>
        application.at <= event.at &&
        (recipient === 'player' || application.resolvedAudience.companionIds.includes(String(event.summonOwner)))
          ? { ...application, expiresAt: Math.min(application.expiresAt, event.at) }
          : application
      )
    );
  }

  if (professionCoreState(context).petActive) grantMaulAttackOfOpportunity(context, event, 'pet');
}
