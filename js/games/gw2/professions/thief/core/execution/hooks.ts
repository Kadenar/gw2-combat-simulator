import { snapshotThiefState } from '#gw2/professions/thief/core/state.js';
import type { ThiefSchedulerContext } from '#gw2/professions/thief/types.js';
import { observeThievesGuildCombatEvent } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { applyThiefWeaponSwapEffects } from '#gw2/professions/thief/core/execution/actions.js';
import { thiefCoreTaskHandlers } from '#gw2/professions/thief/core/mechanics/task-handlers.js';
import { observeStealthBreakingStrike } from '#gw2/professions/thief/core/mechanics/stealth.js';
import {
  updateThiefWeaponState,
  observeThiefAxe,
  materializeThiefAxe
} from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import {
  updateThiefTraitCastState,
  observeThiefCriticalBoons,
  materializeThiefCriticalBoons
} from '#gw2/professions/thief/core/traits/index.js';
import {
  advanceThiefCoreResources,
  completeThiefCoreResources,
  restartInfiltratorsSignetPassive,
  pulseInfiltratorsSignet,
  spendThiefCoreResources
} from '#gw2/professions/thief/core/mechanics/resources.js';

/** Registers Core Thief resources, weapons, traits, and tasks in scheduler order. */
export const thiefCoreSchedulerHooks = Object.freeze({
  initialize: { id: 'thief.infiltrators-signet', order: 10, handler: restartInfiltratorsSignetPassive },
  onCooldownReset: { id: 'thief.infiltrators-signet', order: 10, handler: restartInfiltratorsSignetPassive },
  advance: advanceThiefCoreResources,
  onCastStart: spendThiefCoreResources,
  onEventScheduled: Object.freeze([
    { id: 'thief.spinning-axe', order: 40, handler: observeThiefAxe },
    { id: 'thief.critical-boons', order: 30, handler: observeThiefCriticalBoons },
    {
      id: 'thief.stealth-breaking-strikes',
      order: 10,
      handler: observeStealthBreakingStrike
    },
    {
      id: 'thief.thieves-guild-combat',
      order: 20,
      handler: observeThievesGuildCombatEvent
    }
  ]),
  // Thief stance and trait effects run only after the shared swap is committed.
  onWeaponSwap: applyThiefWeaponSwapEffects,
  onCastComplete: {
    id: 'thief.core-resources',
    order: 10,
    handler: completeThiefCoreResources
  },
  afterCast: Object.freeze([
    {
      id: 'thief.weapon-state',
      order: 10,
      handler: updateThiefWeaponState
    },
    {
      id: 'thief.traits',
      order: 20,
      handler: updateThiefTraitCastState
    }
  ]),
  taskHandlers: {
    'thief.infiltrators-signet': pulseInfiltratorsSignet,
    ...thiefCoreTaskHandlers,
    'thief.critical-boons': materializeThiefCriticalBoons,
    'thief.spinning-axe': materializeThiefAxe
  },
  snapshot: (context: ThiefSchedulerContext) => snapshotThiefState(context.state.profession)
});
