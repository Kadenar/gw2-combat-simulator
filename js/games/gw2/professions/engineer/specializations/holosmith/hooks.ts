import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { HOLOSMITH_FORGE_TOGGLE_SKILL_IDS } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { holosmithCastAvailability } from '#gw2/professions/engineer/specializations/holosmith/mechanics/availability.js';
import { decorateHolosmithHeatEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
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
  prepareEvent: decorateHolosmithHeatEvent,
  onCastStart(runtime, cast) {
    const skill = cast.skill as HolosmithSkill;
    if (skill.id === ID.DODGE) triggerThermalReleaseValve(runtime, skill, runtime.time);
    if (skill.id === ID.CORONA_BURST) applyCoronaBurstHeat(runtime, skill, cast);
    else if (skill.id === ID.PHOTON_BLITZ) applyPhotonBlitzHeat(runtime, skill, cast);
    else if (Number(skill.heatGain) > 0) applyHeat(runtime, skill, cast);
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    if (cast.skill.id === ID.ENGAGE_PHOTON_FORGE) enterPhotonForge(runtime, cast.skill);
    else if (HOLOSMITH_FORGE_TOGGLE_SKILL_IDS.has(Number(cast.skill.id))) exitPhotonForge(runtime, cast.skill);
    handleHolosmithKitEquip(runtime, cast.skill);
  },
  tasks: photonForgeTasks,
  eventHandlers: { ...holosmithResolverEventHandlers, 'engineer.heat': OBSERVABLE_EVENT_HANDLER },
  reactions: { 'damage.resolving': consumeSolarFocusingLens }
};
