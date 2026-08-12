import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { materializeSkillEffectApplications } from "../../../platform/engine/effect-materializer.js";
import {
  GW2_ALACRITY_RECHARGE_RATE,
  gw2BuffActiveForAudience,
} from "../../../platform/gw2/scheduler/policy.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
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
  RangerResolverContext,
  RangerSchedulerContext,
  RangerSkill,
} from "../types.js";

const PET_AUTO_TASK = "ranger.pet-autonomous-skill";
const PET_COMMAND_START_TASK = "ranger.pet-command-start";
const PET_AUTO_OWNER = "ranger.active-pet";
const QUICKNESS_ACTION_RATE = 1.5;

export function rangerPetCompanionId(
  context: RangerSchedulerContext | RangerResolverContext,
): string {
  const state = professionCoreState(context);
  return `ranger-pet:${state.activePetSlot}:${state.petAutoGeneration}`;
}

function petHasTrait(
  context: RangerSchedulerContext,
  traitId: SkillId,
): boolean {
  const key = String(traitId);
  return Boolean(
    context.config.selectedTraitIds?.some(
      (value) => value === traitId || String(value) === key,
    ),
  );
}

function petHasSelectedSkill(
  context: RangerSchedulerContext,
  skillName: string,
): boolean {
  const source = context.config.selectedSkills || [];
  const selected = Array.isArray(source) ? source : Object.values(source);
  return selected.map(String).includes(skillName);
}

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

function rangerPetAttributes(context?: RangerSchedulerContext) {
  const petName = context
    ? professionCoreState(context).activePet
    : "Carrion Devourer";
  let power = 1524;
  let precision = petName === "Tiger" ? 2211 : petName === "Pig" ? 1180 : 1524;
  let toughness = petName === "Pig" ? 2211 : 1000;
  let vitality = petName === "Pig" ? 3585 : 1000;
  let ferocity = 0;
  let conditionDamage = petName === "Pig" ? 700 : 1000;
  let expertise = 0;
  const healingPower = petName === "Pig" ? 600 : 0;
  if (petName === "Jacaranda") {
    power = 1868;
    conditionDamage = 400;
  }
  if (context) {
    if (petHasTrait(context, TRAIT.PACK_ALPHA)) {
      power += 300;
      precision += 300;
      toughness += 300;
      vitality += 300;
      conditionDamage += 300;
    }
    if (petHasTrait(context, TRAIT.STRIDERS_STRENGTH)) power += 120;
    if (petHasTrait(context, TRAIT.HONED_AXES)) ferocity += 120;
    if (petHasTrait(context, TRAIT.PETS_PROWESS)) ferocity += 300;
    if (
      petHasSelectedSkill(context, "Signet of the Wild") &&
      Number(context.state.cooldowns.get(ID.SIGNET_OF_THE_WILD) || 0) <=
        context.state.time
    ) {
      ferocity += 180;
    }
  }
  return {
    power,
    precision,
    toughness,
    vitality,
    ferocity,
    conditionDamage,
    expertise,
    healingPower,
  };
}

export function rangerPetCombatMetadata(
  context?: RangerSchedulerContext,
): Readonly<SchedulerRecord> {
  const attributes = rangerPetAttributes(context);
  return {
    weaponStrength: undefined,
    weaponStrengthProfileId: undefined,
    independentSummonStrike: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: attributes.power,
    summonBasePrecision: attributes.precision,
    summonBaseToughness: attributes.toughness,
    summonBaseVitality: attributes.vitality,
    summonBaseFerocity: attributes.ferocity,
    summonBaseConditionDamage: attributes.conditionDamage,
    summonBaseExpertise: attributes.expertise,
    summonBaseHealingPower: attributes.healingPower,
    ...(context ? { summonOwner: rangerPetCompanionId(context) } : {}),
    summonCriticalChance: (attributes.precision - 1000) / 2100,
    summonCriticalDamage: 1.5 + attributes.ferocity / 1500,
    summonDamagePerCoefficient: (2880 * attributes.power) / 2597,
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
  readonly quicknessOpeningRecoveryDelay?: number;
  readonly opening?: PetAutoSkill;
  readonly basic: PetAutoSkill;
  readonly specials: readonly PetAutoSkill[];
  readonly commandRecovery: Readonly<Record<string, number>>;
  readonly ignoresAlacrity?: boolean;
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
      quicknessOpeningRecoveryDelay: 0.8,
      basic: { id: ID.CONSUMING_BITE, recovery: 1.87 },
      specials: [
        { id: ID.CRIPPLING_ANGUISH_PET, recovery: 1.8, cooldown: 20 },
        { id: ID.FANG_GRAPPLE, recovery: 2.4, cooldown: 20 },
      ],
      commandRecovery: { [ID.NARCOTIC_SPORES_PET]: 1.84 },
    },
    Tiger: {
      ignoresAlacrity: true,
      openingDelay: 0.48,
      opening: { id: ID.FELINE_BITE, recovery: 1.32, cooldown: 7.9 },
      basic: { id: ID.FELINE_SLASH, recovery: 1.35 },
      specials: [
        { id: ID.FELINE_MAUL, recovery: 1.44, cooldown: 16 },
        { id: ID.FELINE_BITE, recovery: 1.32, cooldown: 7.9 },
      ],
      commandRecovery: { [ID.FURIOUS_POUNCE]: 1.76 },
    },
    Jacaranda: {
      openingDelay: 0.44,
      basic: { id: ID.JACARANDA_ROOT_SLAP, recovery: 1.6 },
      specials: [
        { id: ID.JACARANDA_CALL_LIGHTNING, recovery: 1.48, cooldown: 10 },
        { id: ID.PHOTOSYNTHESIZE, recovery: 1.48, cooldown: 20 },
      ],
      commandRecovery: { [ID.JACARANDAS_EMBRACE]: 1.48 },
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
  quickness: boolean,
): PetAutoSkill {
  const state = professionCoreState(context);
  if (state.petAutoOpeningBasic) {
    state.petAutoOpeningBasic = false;
    return profile.opening || profile.basic;
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
          quickness ||
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
  const quickness = gw2BuffActiveForAudience(
    context,
    "quickness",
    task.at,
    "summon",
  );
  const selected = autonomousSkill(context, profile, task.at, quickness);
  const recovery = selected.recovery / (quickness ? QUICKNESS_ACTION_RATE : 1);
  emitAutonomousSkill(context, selected.id, task.at, recovery);
  state.petAutoBusyUntil = task.at + recovery;
  if (selected.cooldown) {
    const rechargeRate =
      !profile.ignoresAlacrity &&
      gw2BuffActiveForAudience(context, "alacrity", task.at, "summon")
        ? Number(
            context.config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE,
          )
        : 1;
    const cooldown =
      selected.id === ID.CRIPPLING_ANGUISH_PET && quickness
        ? 12
        : Number(selected.cooldown) *
          (petHasTrait(context, TRAIT.PACK_ALPHA) ? 0.8 : 1);
    state.petAutoCooldowns[String(selected.id)] =
      task.at + cooldown / Math.max(Number.EPSILON, rechargeRate);
    state.petAutoActivationUses[String(selected.id)] =
      Number(state.petAutoActivationUses[String(selected.id)] || 0) + 1;
  }
  schedulePetAuto(
    context,
    task.at +
      recovery +
      (openingBasic
        ? Number(profile.openingRecoveryDelay || 0) +
          (quickness ? Number(profile.quicknessOpeningRecoveryDelay || 0) : 0)
        : 0),
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
  const companionIds = Array.isArray(event.companionIds)
    ? event.companionIds.map(String)
    : [];
  if (
    event.type === "buff" &&
    event.affectsSummons === true &&
    (companionIds.length === 0 ||
      companionIds.every((id) => id === "ranger-pet"))
  ) {
    updates.companionIds = [rangerPetCompanionId(context)];
  }
  if (commandDelay > 0 && event.type !== "action") {
    updates.at = Number(event.at) + commandDelay;
  }
  if (
    event.source === "ranger-pet" &&
    event.actorType === "summon" &&
    (event.type === "damage" || event.type === "condition")
  ) {
    Object.assign(updates, rangerPetCombatMetadata(context));
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
        (profile.opening || profile.basic).recovery +
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
