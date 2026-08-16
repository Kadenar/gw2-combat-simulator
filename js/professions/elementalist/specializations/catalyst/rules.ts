import type {
  AvailabilityResult,
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  Skill,
} from "../../../../platform/engine/types.js";
import type { Gw2ModifierContext } from "../../../../platform/gw2/types.js";
import { hasTrait as hasGw2Trait } from "../../../../platform/gw2/trait-state.js";
import {
  applyElementalistAura,
  elementalistBuffDuration,
  emitElementalistBuff,
} from "../../core/rules.js";
import {
  elementalistCoreState,
  type ElementalistAttunement,
} from "../../core/state.js";
import type { CatalystEmpowermentPool } from "../../types.js";
import type {
  ElementalistCastContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext,
} from "../../types.js";
import { CATALYST_MAXIMUM_ENERGY, catalystState } from "./state.js";
import { catalystModifierRules } from "./modifiers.js";

const SPHERE_COST = 10;
const CATALYST_ENERGY_HIT_TASK = "elementalist.catalyst-energy-hit";

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

function catalystModifierState(context: Gw2ModifierContext): CatalystStateLike {
  const profession = context.runtime?.profession as
    | {
        specialization?: {
          kind?: string;
          state?: CatalystStateLike;
        };
      }
    | undefined;
  return profession?.specialization?.kind === "Catalyst"
    ? profession.specialization.state || {}
    : {};
}

interface CatalystStateLike {
  readonly elementalEmpowermentExpiries?: readonly number[];
}

function catalystBaseEmpowermentActive(context: Gw2ModifierContext): boolean {
  const combatStartTime = context.runtime?.combatStartTime;
  return combatStartTime == null || context.time >= Number(combatStartTime);
}

function modifyCatalystAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  if (!hasTrait(context, "Elemental Empowerment")) return attributes;

  const timedStacks = (
    catalystModifierState(context).elementalEmpowermentExpiries || []
  ).filter((expiresAt) => expiresAt > context.time).length;
  const stacks = Math.min(
    10,
    (catalystBaseEmpowermentActive(context) ? 3 : 0) + timedStacks,
  );
  const multiplier = hasTrait(context, "Empowered Empowerment")
    ? stacks === 10
      ? 0.2
      : stacks * 0.015
    : stacks * 0.01;
  const pool = context.config?.catalystEmpowermentPool as
    | Partial<CatalystEmpowermentPool>
    | undefined;
  const modified = { ...attributes };

  for (const stat of [
    "power",
    "precision",
    "ferocity",
    "conditionDamage",
    "expertise",
    "concentration",
  ] as const) {
    const eligible = Number(pool?.[stat] ?? modified[stat] ?? 0);
    const bonus = eligible * multiplier;
    modified[stat] =
      Number(modified[stat] || 0) +
      (["power", "conditionDamage"].includes(stat) ? Math.round(bonus) : bonus);
  }

  return modified;
}

function availability(
  context: ElementalistPrecastContext,
  skill: Skill,
): AvailabilityResult {
  if (skill.skillFamily !== "Jade Sphere") return { ready: true };
  const state = catalystState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  if (skill.attunement !== core.primaryAttunement) {
    return {
      ready: false,
      retryAt: null,
      code: "elementalist.catalyst-attunement",
      reason: `${skill.name} is unavailable — requires ${String(skill.attunement)} attunement.`,
    };
  }
  return state.energy >= SPHERE_COST
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: "elementalist.catalyst-energy",
        reason: `${skill.name} is unavailable — requires ${SPHERE_COST} energy.`,
      };
}

function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  if (skill.skillFamily !== "Jade Sphere") return;
  const state = catalystState.from(context);
  state.energy = Math.max(0, state.energy - SPHERE_COST);
  const duration = Math.max(
    0,
    Number(
      skill.comboFields?.find((field) => field.ownerId === "elementalist")
        ?.duration || 5,
    ),
  );
  state.sphereActiveUntil = Math.max(
    state.sphereActiveUntil,
    context.effectiveEnd + duration,
  );
  state.sphereExpiry[String(skill.attunement)] =
    context.effectiveEnd + duration;
  context.emit({
    type: "resource",
    at: context.start,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillName: skill.name,
    kind: "catalyst-energy",
    value: state.energy,
    maximum: CATALYST_MAXIMUM_ENERGY,
    change: -SPHERE_COST,
  });
  if (hasTrait(context, "Spectacular Sphere")) {
    const durationMultiplier = hasTrait(context, "Sphere Specialist") ? 2 : 1;
    context.emit({
      type: "buff",
      at: context.start,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "quickness",
      stacks: 1,
      duration: elementalistBuffDuration(
        context as never,
        "quickness",
        durationMultiplier,
        skill.name,
        skill.id,
      ),
      recipients: "party",
      maximumRecipients: 5,
      sphereSpecialistScaled: true,
    });
    const boon =
      skill.attunement === "Fire"
        ? (["might", 5, 10] as const)
        : skill.attunement === "Water"
          ? (["vigor", 1, 5] as const)
          : skill.attunement === "Air"
            ? (["fury", 1, 5] as const)
            : (["aegis", 1, 3] as const);
    context.emit({
      type: "buff",
      at: context.start,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: boon[0],
      stacks: boon[1],
      duration: elementalistBuffDuration(
        context as never,
        boon[0],
        boon[2] * durationMultiplier,
        skill.name,
        skill.id,
      ),
      recipients: "party",
      maximumRecipients: 5,
      sphereSpecialistScaled: true,
    });
  }
}

function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (
    skill.skillFamily !== "Jade Sphere" ||
    !hasTrait(context, "Sphere Specialist")
  ) {
    return;
  }
  for (const event of context.events) {
    if (
      event.activationId === context.reservationId &&
      event.type === "buff" &&
      event.sphereSpecialistScaled !== true
    ) {
      context.replaceEvent(event, {
        duration: Number(event.duration || 0) * 2,
      });
    }
  }
}

function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  const state = catalystState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  if (skill.name === "Relentless Fire") {
    context.emit({
      type: "buff",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "relentless fire",
      stacks: 1,
      duration: state.sphereExpiry.Fire > at ? 8 : 5,
    });
  } else if (skill.name === "Shattering Ice") {
    const duration = state.sphereExpiry.Water > at ? 8 : 5;
    state.shatteringIceUntil = at + duration;
    state.shatteringIceReadyAt = at;
    context.emit({
      type: "buff",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "shattering ice",
      stacks: 1,
      duration,
    });
  } else if (skill.name === "Elemental Celerity") {
    for (const candidate of context.catalog.skills) {
      if (
        candidate.type === "Weapon" &&
        Number(candidate.cooldown || 0) > 0 &&
        String(candidate.attunement || "")
          .split("+")
          .includes(core.primaryAttunement)
      ) {
        context.state.cooldowns.set(candidate.id, at);
      }
    }
    const boons: readonly (readonly [
      ElementalistAttunement,
      string,
      number,
      number,
    ])[] = [
      ["Fire", "might", 5, 6],
      ["Water", "vigor", 1, 6],
      ["Air", "fury", 1, 6],
      ["Earth", "protection", 1, 4],
    ];
    for (const [element, kind, stacks, duration] of boons) {
      if (state.sphereExpiry[element] <= at) continue;
      emitElementalistBuff(
        context as never,
        at,
        kind,
        stacks,
        duration,
        skill.name,
        skill.id,
      );
    }
  }
}

function onEventScheduled(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  const state = catalystState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    event.type === "elementalist.aura" &&
    hasTrait(context, "Elemental Epitome")
  ) {
    emitElementalistBuff(
      context as never,
      event.at,
      "Elemental Empowerment",
      1,
      15,
      String(event.skillName || event.source || "Elemental Epitome"),
      event.skillId ?? event.sourceId,
    );
    return;
  }
  if (
    event.type === "elementalist.attunement" &&
    hasTrait(context, "Energized Elements")
  ) {
    const before = state.energy;
    state.energy = Math.min(CATALYST_MAXIMUM_ENERGY, state.energy + 2);
    emitElementalistBuff(
      context as never,
      event.at,
      "Fury",
      1,
      2,
      "Energized Elements",
      event.sourceId,
    );
    if (state.energy !== before) {
      context.emitDerived(event, {
        type: "resource",
        at: event.at,
        source: "Energized Elements",
        sourceId: event.sourceId,
        actorType: "player",
        skillName: "Energized Elements",
        kind: "catalyst-energy",
        value: state.energy,
        maximum: CATALYST_MAXIMUM_ENERGY,
        change: state.energy - before,
      });
    }
    return;
  }
  if (event.type === "combo") {
    const attunement = String(
      event.attunement || core.primaryAttunement,
    ) as ElementalistAttunement;
    if (
      hasTrait(context, "Elemental Epitome") &&
      Number(state.elementalEpitomeReadyAt[attunement] || 0) <=
        event.at + context.epsilon
    ) {
      state.elementalEpitomeReadyAt[attunement] = event.at + 10;
      const aura =
        attunement === "Fire"
          ? (["Fire Aura", 4] as const)
          : attunement === "Water"
            ? (["Frost Aura", 4] as const)
            : attunement === "Air"
              ? (["Shocking Aura", 3] as const)
              : (["Magnetic Aura", 3] as const);
      applyElementalistAura(context as never, {
        at: event.at,
        aura: aura[0],
        duration: aura[1],
        skillName: "Elemental Epitome",
        sourceId: event.sourceId,
      });
    }
    if (
      hasTrait(context, "Elemental Synergy") &&
      Number(state.elementalSynergyReadyAt[attunement] || 0) <=
        event.at + context.epsilon
    ) {
      state.elementalSynergyReadyAt[attunement] = event.at + 10;
      if (attunement === "Fire" || attunement === "Earth") {
        emitElementalistBuff(
          context as never,
          event.at,
          attunement === "Fire" ? "Might" : "Stability",
          attunement === "Fire" ? 6 : 2,
          attunement === "Fire" ? 10 : 6,
          "Elemental Synergy",
          event.sourceId,
        );
      } else if (attunement === "Air") {
        core.endurance = Math.min(100, core.endurance + 50);
      }
    }
    return;
  }
  if (
    event.type !== "damage" ||
    event.actorType === "summon" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  context.tasks.schedule({
    type: CATALYST_ENERGY_HIT_TASK,
    at: event.at,
    ownerId: String(event.activationId || event.sourceId || event.skillName),
    payload: {
      sourceId: event.skillId ?? event.sourceId,
      skillName: String(event.skillName || "Catalyst Energy"),
    },
  });
}

function handleCatalystEnergyHit(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<SchedulerRecord>,
): void {
  const state = catalystState.from(context);
  if (
    task.at < state.sphereActiveUntil &&
    !hasTrait(context, "Sphere Specialist")
  ) {
    return;
  }
  const before = state.energy;
  state.energy = Math.min(CATALYST_MAXIMUM_ENERGY, state.energy + 1);
  if (state.energy === before) return;
  context.emit({
    type: "resource",
    at: task.at,
    source: "Catalyst Energy",
    sourceId: String(task.payload?.sourceId || "catalyst-energy"),
    actorType: "player",
    skillName: String(task.payload?.skillName || "Catalyst Energy"),
    kind: "catalyst-energy",
    value: state.energy,
    maximum: CATALYST_MAXIMUM_ENERGY,
    change: 1,
  });
}

export const catalystCastRules = Object.freeze({
  availability: {
    id: "elementalist.catalyst-availability",
    order: 30,
    handler: availability,
  },
});

export const catalystAttributeRules = Object.freeze({
  modifyAttributes: modifyCatalystAttributes,
  modifierRules: catalystModifierRules,
});

export const catalystSchedulerHooks = Object.freeze({
  onCastStart: {
    id: "elementalist.catalyst-spend",
    order: 30,
    handler: onCastStart,
  },
  afterCast: {
    id: "elementalist.catalyst-after-cast",
    order: 30,
    handler: afterCast,
  },
  onEventScheduled: {
    id: "elementalist.catalyst-gain",
    order: 30,
    handler: onEventScheduled,
  },
  taskHandlers: Object.freeze({
    [CATALYST_ENERGY_HIT_TASK]: handleCatalystEnergyHit,
  }),
  onCastComplete: {
    id: "elementalist.catalyst-complete",
    order: 30,
    handler: onCastComplete,
  },
});
