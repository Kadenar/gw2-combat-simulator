import type { SimulationEventInput } from '#gw2/platform/engine/events/events.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { observeNecromancerPlagueSendingEvent } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import {
  advanceNecromancerState,
  resetNecromancerResources
} from '#gw2/professions/necromancer/core/mechanics/life-force.js';
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
  prepareEvent: {
    id: 'necromancer.boon-companion-candidates',
    order: 5,
    handler: (context: NecromancerSchedulerContext, event: SimulationEventInput) =>
      prepareGw2BuffCompanionCandidates(event, necromancerActiveBoonCompanionIds(context))
  },
  advance: advanceNecromancerState,
  onCastStart: applyNecromancerCastStartTraits,
  afterCast: applyNecromancerAfterCastTraits,
  onCooldownReset: resetNecromancerResources,
  onEventScheduled: observeNecromancerPlagueSendingEvent,
  taskHandlers: Object.freeze({
    ...necromancerSwordTaskHandlers,
    ...necromancerGreatswordTaskHandlers,
    ...necromancerSpearTaskHandlers,
    ...necromancerMinionTaskHandlers
  })
});
