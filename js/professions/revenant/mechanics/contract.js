import { revenantCastAvailability } from "./availability.js";
import {
  advanceRevenantEnergy,
  spendRevenantEnergy,
} from "./specific/energy.js";
import {
  handleRevenantUpkeepPulse,
} from "./specific/upkeep.js";
import {
  beginRevenantWeaponCast,
  completeRevenantWeaponCast,
  expireImperialGuard,
  updateRevenantWeaponState,
} from "./specific/weapon-state.js";
import {
  afterRevenantCast,
  initializeRevenantTraits,
  modifyRevenantCastDuration,
  modifyRevenantRechargeDuration,
  observeRevenantEvent,
} from "./specific/traits.js";
import {
  completeBeguilingHaze,
  handleConduitAffinityHit,
} from "./specific/conduit.js";

function onCastStart(context, skill) {
  spendRevenantEnergy(context, skill);
  beginRevenantWeaponCast(context, skill);
}

function onCastComplete(context, skill) {
  completeBeguilingHaze(context, skill);
  completeRevenantWeaponCast(context, skill);
}

function afterCast(context, skill) {
  updateRevenantWeaponState(context, skill);
  afterRevenantCast(context, skill);
}

export const revenantCastRules = Object.freeze({
  availability: {
    id: "revenant.availability",
    order: 10,
    handler: revenantCastAvailability,
  },
  modifyCastDuration: modifyRevenantCastDuration,
  modifyRechargeDuration: modifyRevenantRechargeDuration,
});

export const revenantSchedulerHooks = Object.freeze({
  initialize: initializeRevenantTraits,
  advance: advanceRevenantEnergy,
  onCastStart,
  onCastComplete,
  afterCast,
  onCooldownReset: context => {
    context.state.profession.legendSwapReadyAt = context.state.time;
    context.state.profession.beguilingHazeReadyAt = context.state.time;
  },
  onEventScheduled: observeRevenantEvent,
  taskHandlers: Object.freeze({
    "revenant.affinity-hit": handleConduitAffinityHit,
    "revenant.upkeep-pulse": handleRevenantUpkeepPulse,
    "revenant.imperial-guard-expire": expireImperialGuard,
  }),
});
