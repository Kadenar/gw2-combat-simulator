import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import { holosmithCastAvailability } from '#gw2/professions/engineer/specializations/holosmith/mechanics/availability.js';
import {
  prepareHolosmithSlotEvent,
  holosmithSlotEventHandlers
} from '#gw2/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import {
  prepareHolosmithSwordEvent,
  holosmithSwordEventHandlers
} from '#gw2/professions/engineer/specializations/holosmith/skills/weapons/sword.js';
import {
  applyCoronaBurstHeat,
  applyPhotonBlitzHeat,
  applyHeat,
  enterPhotonForge,
  exitPhotonForge,
  handleHolosmithKitEquip,
  initializePhotonForgeHeat,
  photonForgeTasks,
  triggerThermalReleaseValve
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import {
  consumeSolarFocusingLens,
  holosmithResolverEventHandlers
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-effects.js';

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
  onCastStart(runtime, cast) {
    const skill = cast.skill as HolosmithSkill;
    if (skill.id === SHARED_SKILL_IDS.DODGE) triggerThermalReleaseValve(runtime, skill, runtime.time);
  },
  onCastCommit(runtime, cast) {
    handleHolosmithKitEquip(runtime, cast.skill);
  },
  tasks: photonForgeTasks,
  eventHandlers: {
    ...holosmithSlotEventHandlers,
    ...holosmithSwordEventHandlers,
    ...holosmithResolverEventHandlers,
    'engineer.heat': OBSERVABLE_EVENT_HANDLER
  },
  reactions: { 'damage.resolving': consumeSolarFocusingLens }
};
