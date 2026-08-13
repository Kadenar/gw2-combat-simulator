import type {
  AvailabilityResult,
  CastContext,
  CastLifecycleContext,
  SchedulerRecord,
  Skill,
} from "../../../../platform/engine/types.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  applyElementalistAura,
  triggerElementalistEarthenBlast,
  triggerElementalistElectricDischarge,
  triggerElementalistFlameExpulsion,
  triggerElementalistSunspot,
} from "../../core/rules.js";
import {
  elementalistCoreState,
  setElementalistAttunementReadyAt,
} from "../../core/state.js";

function onCastStart(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  if (!skill.overload) return;
  if (hasTrait(context, "Hardy Conduit")) {
    context.emit({
      type: "buff",
      at: context.start,
      source: "Hardy Conduit",
      sourceId: skill.id,
      actorType: "player",
      skillName: "Hardy Conduit",
      kind: "protection",
      stacks: 1,
      duration: 3,
    });
  }
  if (skill.attunement === "Fire") {
    triggerElementalistSunspot(context as never, context.start, skill.id);
  } else if (skill.attunement === "Air") {
    triggerElementalistElectricDischarge(
      context as never,
      context.start,
      skill.id,
    );
  } else if (skill.attunement === "Earth") {
    triggerElementalistEarthenBlast(context as never, context.start, skill.id);
  }
}

function availability(
  context: CastContext<SchedulerRecord>,
  skill: Skill,
): AvailabilityResult {
  if (!skill.overload) return { ready: true };
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (skill.attunement !== state.primaryAttunement) {
    return {
      ready: false,
      retryAt: null,
      code: "elementalist.tempest-attunement",
      reason: `${skill.name} is unavailable — requires ${String(skill.attunement)} attunement.`,
    };
  }
  const dwell = hasTrait(context, "Transcendent Tempest") ? 4 : 6;
  const readyAt = state.attunementEnteredAt + dwell;
  return readyAt > context.start + context.epsilon
    ? {
        ready: false,
        retryAt: readyAt,
        code: "elementalist.tempest-dwell",
        reason: `${skill.name} is unavailable until the attunement singularity forms.`,
      }
    : { ready: true };
}

function onCastComplete(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  if (!skill.overload) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const attunement = String(skill.attunement);
  if (attunement in state.attunementReadyAt) {
    const typedAttunement = attunement as keyof typeof state.attunementReadyAt;
    setElementalistAttunementReadyAt(
      context,
      typedAttunement,
      Math.max(
        state.attunementReadyAt[typedAttunement],
        Number(context.rechargeReadyAt || context.effectiveEnd),
      ),
    );
  }
  if (hasTrait(context, "Unstable Conduit")) {
    const aura =
      attunement === "Fire"
        ? "Fire Aura"
        : attunement === "Water"
          ? "Frost Aura"
          : attunement === "Air"
            ? "Shocking Aura"
            : "Magnetic Aura";
    applyElementalistAura(context as never, {
      at: context.effectiveEnd,
      aura,
      duration: 4,
      skillName: "Unstable Conduit",
      sourceId: skill.id,
    });
  }
  if (attunement === "Fire") {
    triggerElementalistFlameExpulsion(
      context as never,
      context.effectiveEnd,
      skill.id,
    );
  }
  if (skill.name === "Overload Air") {
    context.emit({
      type: "damage",
      at: context.effectiveEnd,
      source: "Lightning Jolt",
      sourceId: skill.id,
      actorType: "effect",
      skillName: "Lightning Jolt",
      coefficient: 2.64,
      skillWeapon: "Unequipped",
      noCrit: true,
    });
  }
  if (hasTrait(context, "Transcendent Tempest")) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Transcendent Tempest",
      sourceId: skill.id,
      actorType: "player",
      skillName: "Transcendent Tempest",
      kind: "transcendent-tempest",
      stacks: 1,
      duration: 7,
    });
  }
}

export const tempestCastRules = Object.freeze({
  availability: {
    id: "elementalist.tempest-overload",
    order: 30,
    handler: availability,
  },
});

export const tempestSchedulerHooks = Object.freeze({
  onCastStart: {
    id: "elementalist.tempest-start",
    order: 30,
    handler: onCastStart,
  },
  onCastComplete: {
    id: "elementalist.tempest-complete",
    order: 30,
    handler: onCastComplete,
  },
});
