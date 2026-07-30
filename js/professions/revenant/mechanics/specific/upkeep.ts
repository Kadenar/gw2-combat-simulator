/**
 * Revenant upkeep, facet, and pulse state machines.
 *
 * Toggles and releases upkeep skills, manages facet consume flips, materializes
 * dynamic replacement casts, and handles the recurring revenant.upkeep-pulse
 * task. Pulse profiles come from handler-mechanics.js; active instances and
 * their next allied/affinity proc times live in profession state.
 */
import { emitRevenantState } from "./shared.js";
import { gw2AlliedPlayerAssumptions } from "../../../../platform/gw2/allied-players.js";
import {
  emitLesserEnchantedDaggers,
  emitRevenantBoon,
  gainConduitAffinity,
} from "./conduit.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { REVENANT_SKILL_IDS as ID } from "../../data/ids.js";
import type {
  SchedulerRecord,
  SimulationActorType,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill,
  RevenantState,
  RevenantUpkeepState,
} from "../../types.js";

interface UpkeepDamageOptions {
  readonly actorType?: SimulationActorType;
  readonly name?: string;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly extendsResolutionHorizon?: boolean;
}

interface UpkeepTaskPayload extends SchedulerRecord {
  readonly skillId: SkillId;
}

function emitDamage(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  at: number,
  coefficient: number,
  options: UpkeepDamageOptions = {},
): void {
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: options.actorType || "player",
    skillId: skill.id,
    skillName: skill.name,
    name: options.name || skill.name,
    coefficient,
    hits: 1,
    hitIndex: options.hitIndex || 1,
    totalHits: options.totalHits || 1,
    skillWeapon: "Unequipped",
    ...(options.extendsResolutionHorizon
      ? { extendsResolutionHorizon: true }
      : {}),
  });
}

function emitCondition(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  at: number,
  condition: string,
  stacks: number,
  duration: number,
): void {
  context.emit({
    type: "condition",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — ${condition}`,
    condition,
    stacks,
    duration,
  });
}

function upkeepPulseInterval(skill: RevenantSkill | undefined): number {
  const profile = MECHANICS.upkeep;
  if (skill?.id === ID.VENGEFUL_HAMMERS) {
    return profile.vengefulHammersPulseInterval;
  }
  if (skill?.facet) return profile.facetPulseInterval;
  return profile.defaultPulseInterval;
}

function facetConsumeId(
  skill: RevenantSkill,
  state: RevenantState,
): SkillId | undefined {
  const trueNatureByLegend =
    MECHANICS.upkeep.trueNatureConsumeByLegendId as Readonly<
      Record<string, SkillId>
    >;
  const consumeBySkill =
    MECHANICS.upkeep.facetConsumeBySkillId as Readonly<
      Record<SkillId, SkillId>
    >;
  if (skill?.id === ID.FACET_OF_NATURE) {
    return trueNatureByLegend[state.activeLegendId];
  }
  return consumeBySkill[skill.id];
}

function emitEmbraceTheDarknessPulse(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  active: RevenantUpkeepState,
  at: number,
): void {
  const profile = MECHANICS.upkeep.embraceTheDarkness;
  emitDamage(context, skill, at, profile.coefficient);
  emitCondition(
    context,
    skill,
    at,
    "Torment",
    active.empoweredNextPulse
      ? profile.empoweredTormentStacks
      : profile.tormentStacks,
    profile.tormentDuration,
  );
  active.empoweredNextPulse = false;
}

/** Toggles an upkeep instance and schedules/cancels its recurring pulse task. */
export function toggleRevenantUpkeep(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const index = state.activeUpkeeps.findIndex(
    (upkeep) => upkeep.skillId === skill.id,
  );
  if (index >= 0) {
    state.activeUpkeeps.splice(index, 1);
    const consumeId = facetConsumeId(skill, state);
    const consume = consumeId == null
      ? undefined
      : context.catalog.skillsById.get(consumeId);
    if (consume) delete state.availableFlips[consume.id];
    context.tasks.cancelOwner(`revenant.upkeep:${skill.id}`);
    emitRevenantState(context, at, "upkeep-disabled");
    return;
  }
  const active: RevenantUpkeepState = {
    skillId: skill.id,
    upkeepCost: Number(skill.upkeepCost || 0),
    empoweredNextPulse: false,
    nextAlliedProcAt: (() => {
      const allies = gw2AlliedPlayerAssumptions(context.config);
      return allies.count && allies.strikesPerSecond
        ? at + Math.max(1, 1 / allies.strikesPerSecond)
        : null;
    })(),
    nextAffinityAt:
      context.config.specialization === "Conduit"
        ? at + MECHANICS.upkeep.enigmaticUpkeep.interval
        : null,
  };
  state.activeUpkeeps.push(active);
  const consumeId = facetConsumeId(skill, state);
  const consume = consumeId == null
    ? undefined
    : context.catalog.skillsById.get(consumeId);
  if (consume) state.availableFlips[consume.id] = true;
  const release =
    skill.flipSkillId == null
      ? null
      : context.catalog.skillsById.get(skill.flipSkillId);
  if (release) state.availableFlips[release.id] = true;
  if (skill.id === ID.EMBRACE_THE_DARKNESS) {
    emitEmbraceTheDarknessPulse(context, skill, active, at);
  }
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at: skill.id === ID.EMBRACE_THE_DARKNESS
      ? Math.floor(at + context.epsilon) + 1
      : at + upkeepPulseInterval(skill),
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId: skill.id },
  });
  emitRevenantState(context, at, "upkeep-enabled");
}

/** Releases an upkeep parent and applies its manual-release cooldown. */
export function releaseRevenantUpkeep(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const parent =
    skill.flipParentId == null
      ? null
      : context.catalog.skillsById.get(skill.flipParentId);
  if (!parent) return;
  state.activeUpkeeps = state.activeUpkeeps.filter(
    (upkeep) => upkeep.skillId !== parent.id,
  );
  delete state.availableFlips[skill.id];
  context.tasks.cancelOwner(`revenant.upkeep:${parent.id}`);
  const cooldown = Math.max(0, Number(parent.manualReleaseCooldown || 0));
  if (cooldown > 0) {
    context.state.cooldowns.set(parent.id, at + cooldown);
  }
  emitRevenantState(context, at, "upkeep-released");
}

/** Emits Inspiring Reinforcement's dynamic strike, condition, and boon field. */
export function castInspiringReinforcement(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.upkeep.inspiringReinforcement;
  const at = context.effectiveEnd;
  emitDamage(context, skill, at, profile.coefficient);
  emitCondition(
    context,
    skill,
    at,
    "Weakness",
    profile.weaknessStacks,
    profile.weaknessDuration,
  );
  emitRevenantBoon(
    context,
    skill,
    "stability",
    profile.stabilityDuration,
    profile.stabilityStacks,
    { at },
  );
  for (let index = 0; index < profile.pulses; index += 1) {
    emitRevenantBoon(
      context,
      skill,
      "stability",
      profile.stabilityDuration,
      profile.stabilityStacks,
      {
        at: at + profile.firstPulseDelay + index * profile.pulseInterval,
        name: `Inspiring Reinforcement — Stability ${index + 1}`,
        extendsResolutionHorizon: index === profile.pulses - 1,
      },
    );
  }
}

/** Emits Elemental Blast's ordered damage/condition pulse sequence. */
export function castElementalBlast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.upkeep.elementalBlast;
  // The activation includes roughly 200 ms of aftercast under Quickness.
  // EVTC consistently places the first packet 280 ms after cast start.
  const firstAt = context.start + profile.firstImpactDelay;
  const pulses = profile.conditions.length;
  for (let pulse = 1; pulse <= pulses; pulse += 1) {
    const at = firstAt + (pulse - 1) * profile.pulseInterval;
    emitDamage(context, skill, at, profile.coefficientPerPulse, {
      name: `Elemental Blast — Pulse ${pulse}`,
      hitIndex: pulse,
      totalHits: pulses,
      extendsResolutionHorizon: pulse === pulses,
    });
    const [condition, stacks, duration] = (
      profile.conditions as readonly (
        readonly [string, number, number]
      )[]
    )[pulse - 1];
    emitCondition(context, skill, at, condition, stacks, duration);
  }
}

/** Removes the active facet and consumes its temporary flip. */
export function consumeRevenantFacet(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const facetByConsume =
    MECHANICS.upkeep.facetSkillByConsumeId as Readonly<
      Record<SkillId, SkillId>
    >;
  const facetId = facetByConsume[skill.id];
  const facet = facetId == null
    ? undefined
    : context.catalog.skillsById.get(facetId);
  state.activeUpkeeps = state.activeUpkeeps.filter(
    (upkeep) => upkeep.skillId !== facet?.id,
  );
  delete state.availableFlips[skill.id];
  if (facet) {
    const cooldown = Math.max(0, Number(context.rechargeDuration || 0));
    if (cooldown > 0) {
      context.state.cooldowns.set(facet.id, at + cooldown);
    }
    context.tasks.cancelOwner(`revenant.upkeep:${facet.id}`);
  }
  emitRevenantState(context, at, "facet-consumed");
}

/** Resolves one recurring upkeep pulse and schedules the next occurrence. */
export function handleRevenantUpkeepPulse(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<UpkeepTaskPayload>,
): void {
  if (!task.payload) return;
  const payload = task.payload;
  const active = context.state.profession.activeUpkeeps.find(
    (upkeep) => upkeep.skillId === payload.skillId,
  );
  if (!active) return;
  const skill = context.catalog.skillsById.get(payload.skillId);
  if (skill?.id === ID.EMBRACE_THE_DARKNESS) {
    emitEmbraceTheDarknessPulse(context, skill, active, task.at);
  } else if (skill?.id === ID.VENGEFUL_HAMMERS) {
    const profile = MECHANICS.upkeep.vengefulHammers;
    for (let hammer = 1; hammer <= profile.hammers; hammer += 1) {
      emitDamage(context, skill, task.at, profile.coefficientPerHammer, {
        name: `Vengeful Hammers — Hammer ${hammer}`,
        hitIndex: hammer,
        totalHits: profile.hammers,
      });
    }
  } else if (skill?.facet) {
    const pulses =
      MECHANICS.upkeep.facetPulseBySkillId as Readonly<
        Record<
          SkillId,
          { readonly kind: string; readonly duration: number; readonly stacks: number }
        >
      >;
    const pulse = pulses[skill.id];
    if (pulse) {
      emitRevenantBoon(
        context,
        skill,
        pulse.kind,
        pulse.duration,
        pulse.stacks,
        { at: task.at },
      );
    }
  } else if (skill?.id === ID.SOULCLEAVES_SUMMIT) {
    const profile = MECHANICS.soulcleave;
    const allies = gw2AlliedPlayerAssumptions(context.config);
    if (
      active.nextAlliedProcAt != null &&
      task.at + context.epsilon >= active.nextAlliedProcAt
    ) {
      for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
        emitDamage(context, skill, task.at, profile.coefficient, {
          actorType: "effect",
          name: `Soulcleave's Summit — Ally ${allyIndex} Additional Strike`,
        });
        context.emit({
          type: "damage",
          at: task.at,
          source: "revenant",
          sourceId: skill.id,
          actorType: "effect",
          skillId: skill.id,
          skillName: skill.name,
          name: `Soulcleave's Summit — Ally ${allyIndex} Life Siphon`,
          coefficient: 0,
          flatStrikeBase: profile.siphon.flatStrikeBase,
          flatStrikePowerCoeff: profile.siphon.flatStrikePowerCoeff,
          noCrit: true,
          hits: 1,
          hitIndex: 1,
          totalHits: 1,
          skillWeapon: "Unequipped",
          extendsResolutionHorizon: true,
        });
      }
      active.nextAlliedProcAt += Math.max(
        profile.interval,
        1 / allies.strikesPerSecond,
      );
    }
  }
  if (skill?.id === ID.IMPOSSIBLE_ODDS) {
    emitLesserEnchantedDaggers(context, skill, task.at);
  }
  if (
    context.config.specialization === "Conduit" &&
    active.nextAffinityAt != null &&
    task.at + context.epsilon >= active.nextAffinityAt
  ) {
    const profile = MECHANICS.upkeep.enigmaticUpkeep;
    gainConduitAffinity(context, profile.affinity, "enigmatic-upkeep");
    active.nextAffinityAt += profile.interval;
  }
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at: task.at + upkeepPulseInterval(skill),
    ownerId: `revenant.upkeep:${payload.skillId}`,
    payload,
  });
}

/** Raw upkeep/facet callbacks consumed by the central handler registry. */
export const revenantUpkeepSkillHandlers = Object.freeze({
  "revenant.upkeep": toggleRevenantUpkeep,
  "revenant.upkeep-release": releaseRevenantUpkeep,
  "revenant.inspiring-reinforcement": castInspiringReinforcement,
  "revenant.elemental-blast": castElementalBlast,
  "revenant.facet-consume": consumeRevenantFacet,
});
