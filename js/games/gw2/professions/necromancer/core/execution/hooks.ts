import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { necromancerMaximumHealth } from '#gw2/professions/necromancer/core/state.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { observeNecromancerPlagueSendingEvent } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import {
  advanceNecromancerState,
  alliedAttackOpportunities,
  startAlliedAttackOpportunities,
  resetNecromancerResources
} from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { replayNecromancerLifeForceGains } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
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
    // Resource capacity must use the same patched vitality traits as the attribute calculator.
    const core = professionCoreState(context);
    const maximumHealth = necromancerMaximumHealth(
      context.config,
      normalizeSelectedTraitIds(context.config.selectedTraitIds),
      context
    );
    core.lifeForcePoolCapacity *= maximumHealth / core.maximumHealth;
    core.maximumHealth = maximumHealth;
    // Preserve the configured starting percentage when a patch changes the life-force capacity.
    if (hasTrait(context, TRAIT.SOUL_BATTERY)) {
      const state = professionCoreState(context);
      const maximum =
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.SOUL_BATTERY),
          'lifeForceCapacityMultiplier'
        );
      const ratio = maximum / state.maximumLifeForce;
      state.lifeForce *= ratio;
      state.lifeForcePoolCapacity *= ratio;
      state.maximumLifeForce = maximum;
    }

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
    ...necromancerSwordTaskHandlers,
    ...necromancerGreatswordTaskHandlers,
    ...necromancerSpearTaskHandlers,
    ...necromancerMinionTaskHandlers
  })
});
