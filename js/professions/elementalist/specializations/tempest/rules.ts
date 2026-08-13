import type {
  AvailabilityResult,
  CastContext,
  CastLifecycleContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
} from "../../../../platform/engine/types.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  applyElementalistAura,
  emitElementalistBuff,
  emitElementalistProc,
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
    emitElementalistBuff(
      context as never,
      context.start,
      "Protection",
      1,
      3,
      "Hardy Conduit",
      skill.id,
    );
  }
  if (hasTrait(context, "Harmonious Conduit")) {
    emitElementalistBuff(
      context as never,
      context.start,
      "Swiftness",
      1,
      8,
      "Harmonious Conduit",
      skill.id,
    );
    emitElementalistBuff(
      context as never,
      context.start,
      "Stability",
      1,
      4,
      "Harmonious Conduit",
      skill.id,
    );
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
  const dwell =
    (hasTrait(context, "Transcendent Tempest") ? 4 : 6) /
    (context.config.boons?.alacrity ? 1.25 : 1);
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

function afterCast(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  if (!skill.overload || !hasTrait(context, "Lucid Singularity")) return;
  const hits = context.events
    .filter(
      (event: SimulationEvent) =>
        event.activationId === context.reservationId &&
        event.type === "damage" &&
        Number(event.coefficient || 0) > 0,
    )
    .sort((left: SimulationEvent, right: SimulationEvent) => left.at - right.at)
    .slice(0, 5);
  hits.forEach((event: SimulationEvent, index: number) => {
    emitElementalistBuff(
      context as never,
      event.at,
      "Alacrity",
      1,
      index === 4 ? 4.5 : 1,
      "Lucid Singularity",
      skill.id,
    );
  });
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
    emitElementalistProc(context as never, {
      at: context.effectiveEnd,
      name: "Lightning Jolt",
      procType: "skill",
      sourceId: skill.id,
      sourceSkill: skill.name,
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
  afterCast: {
    id: "elementalist.tempest-after-cast",
    order: 30,
    handler: afterCast,
  },
  onCastComplete: {
    id: "elementalist.tempest-complete",
    order: 30,
    handler: onCastComplete,
  },
});
