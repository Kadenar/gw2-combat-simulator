import { observeEngineerMineFieldEvent } from '#gw2/professions/engineer/core/mechanics/mine-field.js';
import { applyEngineerCastTraits, observeEngineerHghEvent } from '#gw2/professions/engineer/core/traits/index.js';
import { lightningRod } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { healingTurretWindow } from '#gw2/professions/engineer/core/mechanics/healing-turret.js';
import { advanceEngineerResources } from '#gw2/professions/engineer/core/mechanics/resources.js';

/** Registers Core Engineer resources, weapons, traits, and tasks in scheduler order. */
export const engineerCoreSchedulerHooks = Object.freeze({
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
