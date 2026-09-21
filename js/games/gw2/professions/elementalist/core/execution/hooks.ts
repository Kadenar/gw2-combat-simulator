import { EPSILON } from '#kernel/core/clock.js';
import {
  elementalistAfterCast,
  elementalistOnCastComplete,
  elementalistOnCastStart
} from '#gw2/professions/elementalist/core/execution/index.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { ScheduledTask } from '#gw2/platform/execution/types.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
import { processFreshAirCandidates } from '#gw2/professions/elementalist/core/traits/index.js';
import type { SimulationEventInput } from '#gw2/platform/engine/events/events.js';
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
  initialize(context: ElementalistSchedulerContext) {
    // Fresh Air needs canonical critical results even without critical-triggered equipment.
    if (hasTrait(context, 'Fresh Air')) {
      (context.schedulerPolicy as Gw2SchedulerPolicy).requireCriticalFacts();
    }
  },
  taskHandlers: Object.freeze({
    ...elementalistElementalTaskHandlers,
    ...elementalistWeaponStateTaskHandlers,
    'elementalist.fresh-air-critical': (context: ElementalistSchedulerContext, task: ScheduledTask) =>
      processFreshAirCandidates(context, task.at)
  }),
  prepareEvent: Object.freeze([
    {
      id: 'elementalist.boon-companion-candidates',
      order: 5,
      // A live summoned elemental is an extra boon target, so it must be
      // offered as a companion candidate on every event while it is alive.
      handler(context: ElementalistSchedulerContext, event: SimulationEventInput): SimulationEventInput {
        const elemental = professionCoreState(context).summonedElemental;
        const active =
          elemental.element !== null && elemental.activeUntil > Number(event.at ?? context.state.time) - EPSILON;
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
