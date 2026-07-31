import {
  engineerAfterEffects,
} from "../../core/handler-strategies.js";
import {
  advancePhotonForgeState,
  engineerPhotonForgeSkillHandlers,
  handleHolosmithKitEquip,
  handlePhotonForgeHeat,
  observeHolosmithScheduledEvent,
  triggerThermalReleaseValve,
} from "./photon-forge.js";
import {
  holosmithResolverEventHandlers,
} from "./resolver.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../../types.js";

function handleHolosmithAfterCast(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  handleHolosmithKitEquip(context, skill);
  if (skill.id === -5) {
    triggerThermalReleaseValve(context, skill, context.start);
  }
}

export const holosmithSkillHandlers = Object.freeze({
  "engineer.photon-forge-enter": engineerAfterEffects(
    engineerPhotonForgeSkillHandlers["engineer.photon-forge-enter"],
  ),
  "engineer.photon-forge-exit": engineerAfterEffects(
    engineerPhotonForgeSkillHandlers["engineer.photon-forge-exit"],
  ),
  "engineer.heat": engineerAfterEffects(
    engineerPhotonForgeSkillHandlers["engineer.heat"],
  ),
});

export const holosmithSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "engineer.holosmith-events",
    order: 30,
    handler: observeHolosmithScheduledEvent,
  },
  advance: {
    id: "engineer.photon-forge",
    order: 20,
    handler: advancePhotonForgeState,
  },
  afterCast: {
    id: "engineer.holosmith-after-cast",
    order: 30,
    handler: handleHolosmithAfterCast,
  },
  taskHandlers: Object.freeze({
    "engineer.photon-forge-heat": handlePhotonForgeHeat,
  }),
});

export const holosmithEventHandlers = holosmithResolverEventHandlers;
