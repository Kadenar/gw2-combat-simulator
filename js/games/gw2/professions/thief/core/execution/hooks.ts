import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';

import type { ThiefSchedulerContext } from '#gw2/professions/thief/types.js';
import { observeThievesGuildCombatEvent } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { applyThiefWeaponSwapEffects } from '#gw2/professions/thief/core/execution/actions.js';
import { thiefCoreTaskHandlers } from '#gw2/professions/thief/core/mechanics/task-handlers.js';
import { stealthBreakingReaction } from '#gw2/professions/thief/core/mechanics/stealth.js';
import {
  updateThiefWeaponState,
  thiefAxeReaction,
  expireThiefScepterChain,
  THIEF_SCEPTER_CHAIN_EXPIRY_TASK
} from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import { updateThiefTraitCastState, thiefCriticalBoonReaction } from '#gw2/professions/thief/core/traits/index.js';
import {
  advanceThiefCoreResources,
  completeThiefCoreResources,
  restartInfiltratorsSignetPassive,
  infiltratorsSignetPassive,
  spendThiefCoreResources
} from '#gw2/professions/thief/core/mechanics/resources.js';

/** Registers Core Thief resources, weapons, traits, and tasks in scheduler order. */
export const thiefCoreSchedulerHooks = Object.freeze({
  initialize: { id: 'thief.infiltrators-signet', order: 10, handler: restartInfiltratorsSignetPassive },
  onCooldownReset: { id: 'thief.infiltrators-signet', order: 10, handler: restartInfiltratorsSignetPassive },
  advance: advanceThiefCoreResources,
  onCastStart: spendThiefCoreResources,
  onEventScheduled: Object.freeze([
    { id: 'thief.spinning-axe', order: 40, handler: thiefAxeReaction.onEventScheduled.handler },
    { id: 'thief.critical-boons', order: 30, handler: thiefCriticalBoonReaction.onEventScheduled.handler },
    {
      id: 'thief.stealth-breaking-strikes',
      order: 10,
      handler: stealthBreakingReaction.onEventScheduled.handler
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
    [THIEF_SCEPTER_CHAIN_EXPIRY_TASK]: expireThiefScepterChain,
    ...infiltratorsSignetPassive.taskHandlers,
    ...thiefCoreTaskHandlers,
    ...thiefCriticalBoonReaction.taskHandlers,
    ...thiefAxeReaction.taskHandlers
  },
  snapshot: (context: ThiefSchedulerContext) => snapshotProfessionState(context.state.profession)
});
