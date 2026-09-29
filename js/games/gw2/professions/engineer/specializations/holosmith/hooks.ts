import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { holosmithCastAvailability } from '#gw2/professions/engineer/specializations/holosmith/mechanics/availability.js';
import {
  applyCoronaBurstHeat,
  applyHeat,
  applyPhotonBlitzHeat,
  enterPhotonForge,
  exitPhotonForge,
  handleHolosmithKitEquip,
  initializePhotonForgeHeat,
  photonForgeTasks
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import {
  holosmithSlotEventHandlers,
  prepareHolosmithSlotEvent
} from '#gw2/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import {
  holosmithSwordEventHandlers,
  prepareHolosmithSwordEvent
} from '#gw2/professions/engineer/specializations/holosmith/skills/weapons/sword.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';

/** Heat pulses execute during the cast; committed pulses may survive its animation or a later Forge exit. */
export const holosmithHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  initialize: initializePhotonForgeHeat,
  availability: holosmithCastAvailability,
  prepareEvent: (runtime, event) => prepareHolosmithSwordEvent(runtime, prepareHolosmithSlotEvent(runtime, event)),
  sideEffectHandlers: {
    'engineer.enter-forge'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Forge entry requires a cast trigger.');
      enterPhotonForge(runtime, context.skill);
    },
    'engineer.exit-forge'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Forge exit requires a cast trigger.');
      exitPhotonForge(runtime, context.skill);
    },
    'engineer.forge-heat'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Forge heat requires a cast trigger.');
      applyHeat(runtime, context.skill, context.cast);
    },
    'engineer.corona-heat'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Corona heat requires a cast trigger.');
      applyCoronaBurstHeat(runtime, context.skill, context.cast);
    },
    'engineer.blitz-heat'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Blitz heat requires a cast trigger.');
      applyPhotonBlitzHeat(runtime, context.skill, context.cast);
    }
  },

  onCastCommit(runtime, cast) {
    handleHolosmithKitEquip(runtime, cast.skill);
  },
  tasks: photonForgeTasks,
  eventHandlers: {
    ...holosmithSlotEventHandlers,
    ...holosmithSwordEventHandlers,

    'engineer.heat': OBSERVABLE_EVENT_HANDLER
  }
};
