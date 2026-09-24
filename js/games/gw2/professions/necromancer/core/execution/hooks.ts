import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { necromancerLifeForceCostMultiplier } from '#gw2/professions/necromancer/core/state.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { observeNecromancerPlagueSendingEvent } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import {
  advanceNecromancerState,
  initializeLifeForcePassives,
  lifeForcePassives,
  lifeForceDepletion,
  lichLifetime,
  finalizeNecromancerCast,
  alliedAttackOpportunities,
  startAlliedAttackOpportunities,
  resetNecromancerResources
} from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  replayNecromancerLifeForceGains,
  lifeForceHitReaction
} from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import { predictGhastlyClawsLifeForce } from '#gw2/professions/necromancer/core/mechanics/axe.js';
import { predictSpitefulFortitude } from '#gw2/professions/necromancer/core/traits/spite.js';
import { necromancerMinionTaskHandlers } from '#gw2/professions/necromancer/core/mechanics/minions.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { necromancerSpearTaskHandlers } from '#gw2/professions/necromancer/core/execution/spear.js';
import { necromancerSwordTaskHandlers } from '#gw2/professions/necromancer/core/mechanics/sword-chain.js';
import {
  applyNecromancerAfterCastTraits,
  applyNecromancerCastStartTraits
} from '#gw2/professions/necromancer/core/traits/index.js';
import { necromancerGreatswordTaskHandlers } from '#gw2/professions/necromancer/core/execution/greatsword.js';
import type { NecromancerSchedulerContext } from '#gw2/professions/necromancer/types.js';

/** Registers ordered Core Necromancer hooks while behavior remains with its resource, condition, weapon, or trait owner. */
export const necromancerSchedulerHooks = Object.freeze({
  initialize: (context: NecromancerSchedulerContext) => {
    const core = professionCoreState(context);
    // The selected catalog may patch vitality traits or Soul Battery after the detached state was created.
    core.lifeForceCostMultiplier = necromancerLifeForceCostMultiplier(context.config, context);
    initializeLifeForcePassives(context);
    if (!context.hasExplicitCombatStart) startAlliedAttackOpportunities(context, 0);
    replayNecromancerLifeForceGains(context);
  },
  prepareEvent: {
    id: 'necromancer.boon-companion-candidates',
    order: 5,
    handler: (context: NecromancerSchedulerContext, event: SimulationEventBase) =>
      prepareGw2BuffCompanionCandidates(event, necromancerActiveBoonCompanionIds(context))
  },
  advance: advanceNecromancerState,
  onCastStart: applyNecromancerCastStartTraits,
  afterCast: applyNecromancerAfterCastTraits,
  onCastComplete: finalizeNecromancerCast,
  onCooldownReset: resetNecromancerResources,
  onEventScheduled: [
    { id: 'necromancer.plague-sending', order: 0, handler: observeNecromancerPlagueSendingEvent },
    // Hit-timed life force is granted in the scheduling pass; refinement verifies it against resolved hits.
    { id: 'necromancer.spiteful-fortitude', order: 0, handler: predictSpitefulFortitude },
    { id: 'necromancer.ghastly-claws-life-force', order: 0, handler: predictGhastlyClawsLifeForce },
    {
      id: 'necromancer.allied-opportunities',
      order: 0,
      handler: (context: NecromancerSchedulerContext, event: SimulationEventBase) => {
        if (context.hasExplicitCombatStart && event.type === 'combat_start')
          startAlliedAttackOpportunities(context, event.at);
      }
    }
  ],
  taskHandlers: Object.freeze({
    ...alliedAttackOpportunities.taskHandlers,
    ...lifeForcePassives.taskHandlers,
    ...lifeForceDepletion.taskHandlers,
    ...lichLifetime.taskHandlers,
    ...lifeForceHitReaction.taskHandlers,
    ...necromancerSwordTaskHandlers,
    ...necromancerGreatswordTaskHandlers,
    ...necromancerSpearTaskHandlers,
    ...necromancerMinionTaskHandlers
  })
});
