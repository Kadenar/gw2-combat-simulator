import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import type { EngineerSchedulerContext } from '#gw2/professions/engineer/types.js';
import { observeEngineerMineFieldEvent } from '#gw2/professions/engineer/core/mechanics/mine-field.js';
import { applyEngineerCastTraits, observeEngineerHghEvent } from '#gw2/professions/engineer/core/traits/index.js';
import { lightningRod } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { healingTurretWindow } from '#gw2/professions/engineer/core/mechanics/healing-turret.js';
import { advanceEngineerResources } from '#gw2/professions/engineer/core/mechanics/resources.js';

/** Registers Core Engineer resources, weapons, traits, and tasks in scheduler order. */
export const engineerCoreSchedulerHooks = Object.freeze({
  initialize: {
    id: 'engineer.endurance-initialize',
    order: 5,
    handler(context: EngineerSchedulerContext) {
      // Both current and maximum endurance begin at the selected profile's capacity.
      const state = professionCoreState(context);
      const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
      state.maximumEndurance = balanceProfileNumber(resourcesProfile, 'maximumStacks');
      state.endurance = state.maximumEndurance;
    }
  },
  advance: {
    id: 'engineer.resources',
    order: 10,
    handler: advanceEngineerResources
  },
  afterCast: Object.freeze([
    {
      id: 'engineer.core-traits',
      order: 20,
      handler: applyEngineerCastTraits
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'engineer.mine-field',
      order: 10,
      handler: observeEngineerMineFieldEvent
    },
    {
      id: 'engineer.hgh-duration',
      order: 20,
      handler: observeEngineerHghEvent
    }
  ]),
  taskHandlers: Object.freeze({
    ...lightningRod.taskHandlers,
    ...healingTurretWindow.taskHandlers
  })
});
