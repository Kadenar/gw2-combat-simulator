import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { materializeSkillEffectApplications } from "../../../platform/engine/effect-materializer.js";
import {
  GW2_ALACRITY_RECHARGE_RATE,
  gw2BuffActiveForAudience,
} from "../../../platform/gw2/scheduler/policy.js";
import { RANGER_SKILL_IDS as ID } from "../data/ids.js";
import type {
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  SimulationEventInput,
  SkillEffect,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  RangerCastContext,
  RangerSchedulerContext,
  RangerSkill,
} from "../types.js";

const PET_AUTO_TASK = "ranger.pet-autonomous-skill";
const PET_COMMAND_START_TASK = "ranger.pet-command-start";
const PET_AUTO_OWNER = "ranger.active-pet";

// Level-80 Carrion Devourer and Fanged Iboga offensive attributes. Their
// tooltip damage resolves to a 2,880 internal weapon-strength roll.
export const RANGER_PET_STRIKE_SCALING = Object.freeze({
  basePower: 1524,
  basePrecision: 1524,
  baseFerocity: 0,
  baseConditionDamage: 1000,
  baseExpertise: 0,
  criticalChance: (1524 - 1000) / 2100,
  criticalDamage: 1.5,
  damagePerCoefficient: (2880 * 1524) / 2597,
});

export function rangerPetCombatMetadata(): Readonly<SchedulerRecord> {
  return {
    weaponStrength: undefined,
    weaponStrengthProfileId: undefined,
    independentSummonStrike: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: RANGER_PET_STRIKE_SCALING.basePower,
    summonBasePrecision: RANGER_PET_STRIKE_SCALING.basePrecision,
    summonBaseFerocity: RANGER_PET_STRIKE_SCALING.baseFerocity,
    summonBaseConditionDamage: RANGER_PET_STRIKE_SCALING.baseConditionDamage,
    summonBaseExpertise: RANGER_PET_STRIKE_SCALING.baseExpertise,
    summonCriticalChance: RANGER_PET_STRIKE_SCALING.criticalChance,
    summonCriticalDamage: RANGER_PET_STRIKE_SCALING.criticalDamage,
    summonDamagePerCoefficient: RANGER_PET_STRIKE_SCALING.damagePerCoefficient,
  };
}

interface PetAutoSkill {
  readonly id: SkillId;
  readonly recovery: number;
  readonly cooldown?: number;
}

interface PetAutoProfile {
  readonly openingDelay: number;
  readonly openingRecoveryDelay?: number;
  readonly basic: PetAutoSkill;
  readonly specials: readonly PetAutoSkill[];
  readonly commandRecovery: Readonly<Record<string, number>>;
}

interface PetAutoTaskPayload extends SchedulerRecord {
  readonly generation: number;
}

interface PetAutoEffectTaskPayload extends PetAutoTaskPayload {
  readonly event: SimulationEventInput;
}

interface PetCommandStartTaskPayload extends PetAutoTaskPayload {
  readonly busyUntil: number;
}

const PET_AUTO_PROFILES: Readonly<Record<string, PetAutoProfile>> =
  Object.freeze({
    "Carrion Devourer": {
      openingDelay: 0.44,
      openingRecoveryDelay: 0.8,
      basic: { id: ID.TWIN_DARTS, recovery: 1.88 },
      specials: [{ id: ID.PET_TAIL_LASH, recovery: 2.4, cooldown: 22.4 }],
      commandRecovery: { [ID.POISONOUS_CLOUD]: 2.08 },
    },
    "Fanged Iboga": {
      openingDelay: 0.44,
      basic: { id: ID.CONSUMING_BITE, recovery: 1.84 },
      // The EVTC shows roughly twenty seconds between AI selections even
      // though Crippling Anguish's skill recharge is shorter.
      specials: [
        { id: ID.CRIPPLING_ANGUISH_PET, recovery: 1.8, cooldown: 20 },
        { id: ID.FANG_GRAPPLE, recovery: 2.4, cooldown: 20 },
      ],
      commandRecovery: { [ID.NARCOTIC_SPORES_PET]: 1.84 },
    },
  });

function activeProfile(context: RangerSchedulerContext): PetAutoProfile | null {
  const state = professionCoreState(context);
  return PET_AUTO_PROFILES[state.activePet] || null;
}

function schedulePetAuto(
  context: RangerSchedulerContext,
  at: number,
  reset = false,
): void {
  const state = professionCoreState(context);
  const profile = activeProfile(context);
  if (!profile) {
    state.petAutoNextAt = 0;
    return;
  }
  if (reset) {
    context.tasks.cancelOwner(PET_AUTO_OWNER);
    state.petAutoGeneration += 1;
    state.petAutoTaskId = "";
  }
  const nextAt = Math.max(context.state.time, at, state.petAutoBusyUntil);
  state.petAutoNextAt = nextAt;
  state.petAutoTaskId = context.tasks.schedule({
    type: PET_AUTO_TASK,
    at: nextAt,
    priority: 10,
    ownerId: PET_AUTO_OWNER,
    payload: { generation: state.petAutoGeneration },
  });
}

function startPetAuto(
  context: RangerSchedulerContext,
  at: number,
  reset = false,
): void {
  const state = professionCoreState(context);
  const profile = activeProfile(context);
  if (!profile) return;
  if (!reset && state.petAutoNextAt > context.state.time + context.epsilon) {
    return;
  }
  schedulePetAuto(context, at + profile.openingDelay, reset);
}

function autonomousSkill(
  context: RangerSchedulerContext,
  profile: PetAutoProfile,
  at: number,
): PetAutoSkill {
  const state = professionCoreState(context);
  if (state.petAutoOpeningBasic) {
    state.petAutoOpeningBasic = false;
    return profile.basic;
  }
  const laterIbogaActivation =
    state.activePet === "Fanged Iboga" &&
    state.petAutoActivationCounts[state.activePetSlot - 1] > 1;
  const specials = laterIbogaActivation
    ? [...profile.specials].reverse()
    : profile.specials;
  return (
    specials.find(
      (skill) =>
        (!laterIbogaActivation ||
          Number(state.petAutoActivationUses[String(skill.id)] || 0) < 1) &&
        Number(state.petAutoCooldowns[String(skill.id)] || 0) <=
          at + context.epsilon,
    ) || profile.basic
  );
}

function effectDuration(effect: SkillEffect): number | undefined {
  return effect.type === "boon" || effect.type === "buff"
    ? Math.max(0, Number(effect.duration || 0))
    : undefined;
}

function emitAutonomousSkill(
  context: RangerSchedulerContext,
  skillId: SkillId,
  at: number,
  recovery: number,
): void {
  const skill = context.catalog.skillsById.get(skillId) as
    RangerSkill | undefined;
  if (!skill) return;
  const activationId = context.createActivationId("summon-attack");
  const fullEnd = at + recovery;
  context.emit({
    type: "action",
    activationId,
    at,
    source: "ranger-pet",
    sourceId: skill.id,
    actorType: "summon",
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    endsAt: fullEnd,
    fullEndsAt: fullEnd,
    autonomousPetSkill: true,
    icon: skill.icon,
  });
  for (const effect of skill.effects || []) {
    const applications = materializeSkillEffectApplications({
      skill,
      effect,
      start: at,
      fullEnd,
      baseEvent: {
        activationId,
        source: String(effect.source || "ranger-pet"),
        sourceId: effect.sourceId ?? skill.id,
        actorType: effect.actorType || "summon",
        skillId: skill.id,
        skillName: skill.name,
      },
      statusDuration: effectDuration(effect),
    });
    for (const application of applications) {
      context.tasks.schedule({
        type: "ranger.pet-autonomous-effect",
        at: application.at,
        priority: -20,
        ownerId: PET_AUTO_OWNER,
        payload: {
          generation: professionCoreState(context).petAutoGeneration,
          event: {
            ...application.event,
            autonomousPetSkill: true,
            icon: skill.icon,
          },
        },
      });
    }
  }
}

export function handleRangerPetAutoEffectTask(
  context: RangerSchedulerContext,
  task: ScheduledTask<PetAutoEffectTaskPayload>,
): void {
  if (
    Number(task.payload?.generation) !==
    professionCoreState(context).petAutoGeneration
  ) {
    return;
  }
  if (task.payload?.event) context.emit(task.payload.event);
}

export function handleRangerPetAutoTask(
  context: RangerSchedulerContext,
  task: ScheduledTask<PetAutoTaskPayload>,
): void {
  const state = professionCoreState(context);
  if (Number(task.payload?.generation) !== state.petAutoGeneration) return;
  state.petAutoTaskId = "";
  state.petAutoNextAt = 0;
  if (flattenProfessionState(context.state.profession).beastmodeActive) return;
  const profile = activeProfile(context);
  if (!profile) return;
  if (task.at < state.petAutoBusyUntil - context.epsilon) {
    schedulePetAuto(context, state.petAutoBusyUntil);
    return;
  }
  const openingBasic = state.petAutoOpeningBasic;
  const selected = autonomousSkill(context, profile, task.at);
  emitAutonomousSkill(context, selected.id, task.at, selected.recovery);
  state.petAutoBusyUntil = task.at + selected.recovery;
  if (selected.cooldown) {
    const rechargeRate = gw2BuffActiveForAudience(
      context,
      "alacrity",
      task.at,
      "summon",
    )
      ? Number(
          context.config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE,
        )
      : 1;
    state.petAutoCooldowns[String(selected.id)] =
      task.at + selected.cooldown / Math.max(Number.EPSILON, rechargeRate);
    state.petAutoActivationUses[String(selected.id)] =
      Number(state.petAutoActivationUses[String(selected.id)] || 0) + 1;
  }
  schedulePetAuto(
    context,
    task.at +
      selected.recovery +
      (openingBasic ? Number(profile.openingRecoveryDelay || 0) : 0),
  );
}

export function observeRangerPetEvent(
  context: RangerSchedulerContext,
  event: SimulationEvent,
): void {
  const state = professionCoreState(context);
  const commandDelay = Number(
    state.petCommandDelays[String(event.activationId || "")] || 0,
  );
  const updates: Record<string, unknown> = {};
  if (commandDelay > 0 && event.type !== "action") {
    updates.at = Number(event.at) + commandDelay;
  }
  if (
    event.source === "ranger-pet" &&
    event.actorType === "summon" &&
    (event.type === "damage" || event.type === "condition")
  ) {
    Object.assign(updates, rangerPetCombatMetadata());
  }
  if (event.source === "ranger-pet" && !event.icon) {
    const skill = context.catalog.skillsById.get(
      event.skillId ?? event.sourceId,
    );
    if (skill?.icon) updates.icon = skill.icon;
  }
  if (Object.keys(updates).length) context.replaceEvent(event, updates);
  if (event.type === "ranger.pet-swapped") {
    const slot = state.activePetSlot - 1;
    state.petAutoActivationCounts[slot] += 1;
    state.petAutoActivationUses = {};
    state.petAutoOpeningBasic = state.petAutoActivationCounts[slot] === 1;
    state.petAutoBusyUntil = Number(event.at);
    state.petCommandReadyAt = Number(event.at);
    state.petCommandDelays = {};
    startPetAuto(context, Number(event.at), true);
    return;
  }
  if (event.type === "combat_start") {
    startPetAuto(context, Number(event.at));
    return;
  }
  if (
    !context.hasExplicitCombatStart &&
    event.type === "action" &&
    event.actorType === "player"
  ) {
    startPetAuto(context, Number(event.at));
  }
}

export function beginRangerPetCommand(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  if (!skill.petSkill || skill.petAutonomousSkill) return;
  const state = professionCoreState(context);
  const profile = activeProfile(context);
  if (!profile) return;
  const scheduledOpeningEnd =
    state.petAutoOpeningBasic &&
    state.petAutoNextAt > context.start + context.epsilon
      ? state.petAutoNextAt +
        profile.basic.recovery +
        Number(profile.openingRecoveryDelay || 0)
      : 0;
  const actualStart = Math.max(
    context.start,
    state.petAutoBusyUntil,
    state.petCommandReadyAt,
    scheduledOpeningEnd,
  );
  const delay = actualStart - context.start;
  const recovery = Number(
    profile.commandRecovery[String(skill.id)] ||
      Math.max(0, context.effectiveEnd - context.start),
  );
  const busyUntil = actualStart + recovery;
  state.petCommandReadyAt = busyUntil;
  state.petCommandDelays[context.reservationId] = delay;
  context.replaceEvent(context.action, {
    at: actualStart,
    endsAt: context.effectiveEnd + delay,
    fullEndsAt: context.fullEnd + delay,
    source: "ranger-pet",
    actorType: "summon",
    icon: skill.icon,
  });
  context.tasks.schedule({
    type: PET_COMMAND_START_TASK,
    at: actualStart,
    priority: 0,
    ownerId: PET_AUTO_OWNER,
    payload: {
      generation: state.petAutoGeneration,
      busyUntil,
    },
  });
}

export function handleRangerPetCommandStartTask(
  context: RangerSchedulerContext,
  task: ScheduledTask<PetCommandStartTaskPayload>,
): void {
  const state = professionCoreState(context);
  if (Number(task.payload?.generation) !== state.petAutoGeneration) return;
  if (state.petAutoTaskId) context.tasks.cancel(state.petAutoTaskId);
  state.petAutoTaskId = "";
  state.petAutoNextAt = 0;
  state.petAutoBusyUntil = Math.max(
    state.petAutoBusyUntil,
    Number(task.payload?.busyUntil || task.at),
  );
  schedulePetAuto(context, state.petAutoBusyUntil);
}

export const rangerPetTaskHandlers = Object.freeze({
  [PET_AUTO_TASK]: handleRangerPetAutoTask,
  [PET_COMMAND_START_TASK]: handleRangerPetCommandStartTask,
  "ranger.pet-autonomous-effect": handleRangerPetAutoEffectTask,
});
