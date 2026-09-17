import { observeEngineerMineFieldEvent } from '#gw2/professions/engineer/core/mechanics/mine-field.js';
import { applyEngineerCastTraits, observeEngineerHghEvent } from '#gw2/professions/engineer/core/traits/index.js';
import {
  handleElectricArtilleryExpire,
  handleElectricArtilleryReady,
  handleLightningRodCharge
} from '#gw2/professions/engineer/core/mechanics/spear.js';
import { handleHealingTurretSwapToCleansingBurst } from '#gw2/professions/engineer/core/mechanics/healing-turret.js';
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
    'engineer.lightning-rod-charge': handleLightningRodCharge,
    'engineer.electric-artillery-ready': handleElectricArtilleryReady,
    'engineer.electric-artillery-expire': handleElectricArtilleryExpire,
    'engineer.healing-turret-swap-to-cleansing-burst': handleHealingTurretSwapToCleansingBurst
  })
});
