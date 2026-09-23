import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  elementalistAfterCast,
  elementalistOnCastComplete,
  elementalistOnCastStart
} from '#gw2/professions/elementalist/core/execution/index.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { freshAirReaction } from '#gw2/professions/elementalist/core/traits/air.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import { resetElementalistAttunementCooldowns } from '#gw2/professions/elementalist/core/state.js';
import { prepareElementalistHitboxEvent } from '#gw2/professions/elementalist/core/mechanics/hitbox.js';
import {
  advanceElementalistState,
  observeElementalistEvent
} from '#gw2/professions/elementalist/core/mechanics/scheduler-state.js';
import { elementalistWeaponStateTaskHandlers } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import {
  elementalistElementalCompanionId,
  elementalistElementalTaskHandlers
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';

/** Registers ordered Core Elementalist hooks while implementations stay with their owning concepts. */
export const elementalistCoreSchedulerHooks = Object.freeze({
  initialize: Object.freeze([
    {
      id: 'elementalist.endurance-initialize',
      order: 5,
      handler(context: ElementalistSchedulerContext) {
        // Begin at the selected capacity so a patched cap also changes the first dodge's available resource.
        professionCoreState(context).endurance = balanceProfileNumberFromContext(
          context,
          PROFILE.resources,
          'maximumStacks'
        );
      }
    },
    ...freshAirReaction.initialize
  ]),
  taskHandlers: Object.freeze({
    ...elementalistElementalTaskHandlers,
    ...elementalistWeaponStateTaskHandlers,
    ...freshAirReaction.taskHandlers
  }),
  prepareEvent: Object.freeze([
    {
      id: 'elementalist.boon-companion-candidates',
      order: 5,
      // A live summoned elemental is an extra boon target, so it must be
      // offered through its final impact timestamp, before the expiry task removes it.
      handler(context: ElementalistSchedulerContext, event: SimulationEventBase): SimulationEventBase {
        const elemental = professionCoreState(context).summonedElemental;
        const active = elemental.element !== null && elemental.activeUntil >= Number(event.at ?? context.state.time);
        return prepareGw2BuffCompanionCandidates(
          event,
          active ? [elementalistElementalCompanionId(elemental.summonGeneration)] : []
        );
      }
    },
    {
      id: 'elementalist.hitbox',
      order: 10,
      handler: prepareElementalistHitboxEvent
    }
  ]),
  onCastStart: {
    id: 'elementalist.core-cast-start',
    order: 10,
    handler: elementalistOnCastStart
  },
  afterCast: {
    id: 'elementalist.core-after-cast',
    order: 10,
    handler: elementalistAfterCast
  },
  advance: {
    id: 'elementalist.core-state',
    order: 10,
    handler: advanceElementalistState
  },
  onEventScheduled: {
    id: 'elementalist.combos-and-fresh-air',
    order: 10,
    handler: observeElementalistEvent
  },
  onCastComplete: {
    id: 'elementalist.core-cast-complete',
    order: 10,
    handler: elementalistOnCastComplete
  },
  onCooldownReset: {
    id: 'elementalist.attunement-cooldown-reset',
    order: 10,
    handler: resetElementalistAttunementCooldowns
  }
});
