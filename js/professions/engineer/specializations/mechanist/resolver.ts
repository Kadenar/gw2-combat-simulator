import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { applyCondition, procState, queueBuff, recordTrait, resolverSkill } from '../../core/shared.js';
import type { EngineerResolverContext, EngineerResolverEvent, EngineerResolverReactionDetails } from '../../types.js';

function isEngineerMechEvent(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.engineerMech === true || event.application?.engineerMech === true) return true;
  if (event.actorType !== 'summon') return false;
  const skill = resolverSkill(context, event.skillId ?? event.application?.skillId);
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

function reactToMechanistDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  details: EngineerResolverReactionDetails = {}
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  if (!isEngineerMechEvent(context, event)) return;

  if (hasTrait(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS) && Number(state.singleEdgeCutters || 0) <= event.at) {
    // 1-second ICD: store next-eligible timestamp so rapid mech hits don't
    // trigger the trait on every packet.
    state.singleEdgeCutters = event.at + 1;
    applyCondition(details, context, event, {
      name: 'Mech Arms: Single-Edge Cutters',
      condition: 'Bleeding',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      actorType: 'summon',
      metadata: { engineerMech: true }
    });
    recordTrait(context, 'Mech Arms: Single-Edge Cutters', event);
  }
  if (hasTrait(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS) && Number(state.highImpactDrivers || 0) <= event.at) {
    // Same 1-second ICD pattern as Single-Edge Cutters above.
    state.highImpactDrivers = event.at + 1;
    queueBuff(context, event, {
      name: 'Mech Arms: High-Impact Drivers',
      kind: 'might',
      stacks: 1,
      duration: 10,
      sourceId: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
      actorType: 'effect'
    });
    recordTrait(context, 'Mech Arms: High-Impact Drivers', event);
  }
  if (event.mechBasicAttack === true && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS)) {
    applyCondition(details, context, event, {
      name: 'Mech Arms: Jade Cannons',
      condition: 'Vulnerability',
      stacks: 1,
      duration: 6,
      sourceId: TRAIT.MECH_ARMS_JADE_CANNONS,
      actorType: 'summon',
      metadata: { engineerMech: true }
    });
  }
}

export const mechanistResolverEventReactions = Object.freeze({
  damage: reactToMechanistDamage
});
