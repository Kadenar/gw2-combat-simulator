import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import {
  GW2_ALACRITY_RECHARGE_RATE,
  gw2BuffActiveForAudience,
  gw2SchedulerBoonDuration
} from '#gw2/platform/scheduler/policy.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import type {
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  SimulationEventInput,
  SkillEffect,
  SkillId
} from '#gw2/platform/engine/types.js';
import type {
  RangerCastContext,
  RangerResolverContext,
  RangerSchedulerContext,
  RangerSkill
} from '#gw2/content/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/core/profiles.js';
import { rangerPetByName } from '#gw2/content/professions/ranger/core/state.js';

const PET_AUTO_TASK = 'ranger.pet-autonomous-skill';
const PET_COMMAND_START_TASK = 'ranger.pet-command-start';
const PET_AUTO_OWNER = 'ranger.active-pet';
const QUICKNESS_ACTION_RATE = 1.5;

export function rangerPetCompanionId(context: RangerSchedulerContext | RangerResolverContext): string {
  const state = professionCoreState(context);
  return `ranger-pet:${state.activePetSlot}:${state.petAutoGeneration}`;
}

function petHasSelectedSkill(context: RangerSchedulerContext, skillName: string): boolean {
  return selectedSkillNameSet(context.config.selectedSkills).has(skillName);
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
  damagePerCoefficient: (2880 * 1524) / 2597
});

// Resolve each active pet's level-80 base attributes plus inherited Ranger
// traits so independent summon packets do not fall back to player attributes.
function rangerPetAttributes(context?: RangerSchedulerContext | RangerResolverContext) {
  const petName = context ? professionCoreState(context).activePet : 'Carrion Devourer';
  let power = 1524;
  let precision = petName === 'Tiger' ? 2211 : petName === 'Pig' ? 1180 : 1524;
  let toughness = petName === 'Tiger' ? 1524 : petName === 'Pig' ? 2211 : 1000;
  let vitality = petName === 'Tiger' ? 2211 : petName === 'Pig' ? 3585 : 1000;
  let ferocity = 0;
  let conditionDamage = petName === 'Pig' ? 700 : 1000;
  let expertise = 0;
  let healingPower = petName === 'Pig' ? 600 : 0;

  if (petName === 'Carrion Devourer') {
    toughness = 2898;
    vitality = 2211;
  }

  if (petName === 'Jacaranda') {
    power = 1868;
    toughness = 2211;
    vitality = 2211;
    conditionDamage = 400;
    healingPower = 1200;
  }

  if (context) {
    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      const bonus = balanceProfileValueFromContext(context, PROFILE.packAlpha, 'weaponAttributeBonus', 300);
      power += bonus;
      precision += bonus;
      toughness += bonus;
      vitality += bonus;
      conditionDamage += bonus;
    }

    if (hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
      power += balanceProfileValueFromContext(context, PROFILE.stridersStrength, 'attributeBonus', 120);
    }

    if (hasTrait(context, TRAIT.HONED_AXES)) {
      ferocity += balanceProfileValueFromContext(context, PROFILE.honedAxes, 'attributeBonus', 120);
    }

    if (hasTrait(context, TRAIT.PETS_PROWESS)) {
      ferocity += balanceProfileValueFromContext(context, PROFILE.petsProwess, 'attributeBonus', 300);
    }

    if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
      expertise += balanceProfileValueFromContext(context, PROFILE.arachnophobia, 'attributeBonus', 150);
      if (['spider', 'devourer'].includes(rangerPetByName(petName).family)) {
        expertise += balanceProfileValueFromContext(context, PROFILE.arachnophobia, 'weaponAttributeBonus', 225);
      }
    }

    const scheduler = 'state' in context ? (context as RangerSchedulerContext) : null;
    if (
      scheduler &&
      petHasSelectedSkill(scheduler, 'Signet of the Wild') &&
      Number(scheduler.state.cooldowns.get(ID.SIGNET_OF_THE_WILD) || 0) <= scheduler.state.time
    ) {
      ferocity += balanceProfileValueFromContext(context, PROFILE.signetOfTheWild, 'attributeBonus', 180);
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
    healingPower
  };
}

export function rangerPetCombatMetadata(
  context?: RangerSchedulerContext | RangerResolverContext
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
    summonDamagePerCoefficient: (2880 * attributes.power) / 2597
  };
}

/** Stamps pet-owned packets before shared scheduler consumers such as combo finishers derive child events. */
export function prepareRangerPetEvent(
  context: RangerSchedulerContext,
  event: SimulationEventInput
): SimulationEventInput {
  return event.source === 'ranger-pet' &&
    event.actorType === 'summon' &&
    (event.type === 'damage' || event.type === 'condition')
    ? { ...event, ...rangerPetCombatMetadata(context) }
    : event;
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
  readonly skillId: SkillId;
  readonly provisionalCooldownReadyAt: number;
}

const PET_AUTO_PROFILES: Readonly<Record<string, PetAutoProfile>> = Object.freeze({
  'Carrion Devourer': {
    openingDelay: 0.44,
    openingRecoveryDelay: 0.8,
    basic: { id: ID.TWIN_DARTS, recovery: 1.88 },
    // Tail Lash recovery is serialized separately from its twenty-second recharge.
    specials: [{ id: ID.PET_TAIL_LASH, recovery: 2.4, cooldown: 20 }],
    commandRecovery: { [ID.POISONOUS_CLOUD]: 2.08 }
  },
  'Fanged Iboga': {
    openingDelay: 0.44,
    quicknessOpeningRecoveryDelay: 0.8,
    basic: { id: ID.CONSUMING_BITE, recovery: 1.87 },
    specials: [
      { id: ID.CRIPPLING_ANGUISH_PET, recovery: 1.8, cooldown: 20 },
      { id: ID.FANG_GRAPPLE, recovery: 2.4, cooldown: 20 }
    ],
    commandRecovery: { [ID.NARCOTIC_SPORES_PET]: 1.84 }
  },
  Tiger: {
    ignoresAlacrity: true,
    openingDelay: 0.48,
    opening: { id: ID.FELINE_BITE, recovery: 1.32, cooldown: 8 },
    basic: { id: ID.FELINE_SLASH, recovery: 1.35 },
    specials: [
      { id: ID.FELINE_MAUL, recovery: 1.44, cooldown: 16 },
      { id: ID.FELINE_BITE, recovery: 1.32, cooldown: 8 }
    ],
    commandRecovery: { [ID.FURIOUS_POUNCE]: 1.76 }
  },
  Jacaranda: {
    openingDelay: 0.44,
    basic: { id: ID.JACARANDA_ROOT_SLAP, recovery: 1.6 },
    specials: [
      // Match the observed pet recharge used by the catalog skill.
      { id: ID.JACARANDA_CALL_LIGHTNING, recovery: 1.48, cooldown: 15 },
      { id: ID.PHOTOSYNTHESIZE, recovery: 1.48, cooldown: 20 }
    ],
    commandRecovery: { [ID.JACARANDAS_EMBRACE]: 1.48 }
  }
});

function activeProfile(context: RangerSchedulerContext): PetAutoProfile | null {
  const state = professionCoreState(context);
  return PET_AUTO_PROFILES[state.activePet] || null;
}

function schedulePetAuto(context: RangerSchedulerContext, at: number, reset = false): void {
  const state = professionCoreState(context);
  const profile = activeProfile(context);
  if (!profile) {
    state.petAutoNextAt = 0;
    return;
  }

  if (reset) {
    context.tasks.cancelOwner(PET_AUTO_OWNER);
    state.petAutoGeneration += 1;
    state.petAutoTaskId = '';
  }

  const nextAt = Math.max(context.state.time, at, state.petAutoBusyUntil);
  state.petAutoNextAt = nextAt;
  state.petAutoTaskId = context.tasks.schedule({
    type: PET_AUTO_TASK,
    at: nextAt,
    priority: 10,
    ownerId: PET_AUTO_OWNER,
    payload: { generation: state.petAutoGeneration }
  });
}

function startPetAuto(context: RangerSchedulerContext, at: number, reset = false): void {
  const state = professionCoreState(context);
  if (!state.petActive) return;
  const profile = activeProfile(context);
  if (!profile) return;
  if (!reset && state.petAutoNextAt > context.state.time + context.epsilon) {
    return;
  }

  schedulePetAuto(context, at + profile.openingDelay, reset);
}

// Choose the pet's opening, first ready special, or fallback basic attack while
// preserving pet-specific activation ordering and Quickness exceptions.
function autonomousSkill(
  context: RangerSchedulerContext,
  profile: PetAutoProfile,
  at: number,
  quickness: boolean
): PetAutoSkill {
  const state = professionCoreState(context);
  if (state.petAutoOpeningBasic) {
    state.petAutoOpeningBasic = false;
    return profile.opening || profile.basic;
  }

  const laterIbogaActivation =
    state.activePet === 'Fanged Iboga' && state.petAutoActivationCounts[state.activePetSlot - 1] > 1;
  const specials = laterIbogaActivation ? [...profile.specials].reverse() : profile.specials;
  return (
    specials.find(
      (skill) =>
        (!laterIbogaActivation || quickness || Number(state.petAutoActivationUses[String(skill.id)] || 0) < 1) &&
        Number(state.petAutoCooldowns[String(skill.id)] || 0) <= at + context.epsilon
    ) || profile.basic
  );
}

function effectDuration(effect: SkillEffect): number | undefined {
  return effect.type === 'boon' || effect.type === 'buff' ? Math.max(0, Number(effect.duration || 0)) : undefined;
}

// Materialize an autonomous pet action and defer each effect under the current
// pet generation so a later swap can invalidate stale packets.
function emitAutonomousSkill(context: RangerSchedulerContext, skillId: SkillId, at: number, recovery: number): void {
  const skill = context.catalog.skillsById.get(skillId) as RangerSkill | undefined;
  if (!skill) return;
  const activationId = context.createActivationId('summon-attack');
  const fullEnd = at + recovery;
  context.emit({
    type: 'action',
    activationId,
    at,
    source: 'ranger-pet',
    sourceId: skill.id,
    actorType: 'summon',
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    endsAt: fullEnd,
    fullEndsAt: fullEnd,
    autonomousPetSkill: true,
    icon: skill.icon
  });
  for (const effect of skill.effects || []) {
    const applications = materializeSkillEffectApplications({
      skill,
      effect,
      start: at,
      fullEnd,
      baseEvent: {
        activationId,
        source: String(effect.source || 'ranger-pet'),
        sourceId: effect.sourceId ?? skill.id,
        actorType: effect.actorType || 'summon',
        skillId: skill.id,
        skillName: skill.name
      },
      statusDuration:
        effect.type === 'boon'
          ? gw2SchedulerBoonDuration(
              context,
              skill,
              String(effect.boon || effect.kind || ''),
              effectDuration(effect) || 0
            )
          : effectDuration(effect)
    });
    for (const application of applications) {
      context.tasks.schedule({
        type: 'ranger.pet-autonomous-effect',
        at: application.at,
        priority: -20,
        ownerId: PET_AUTO_OWNER,
        payload: {
          generation: professionCoreState(context).petAutoGeneration,
          event: {
            ...application.event,
            autonomousPetSkill: true,
            icon: skill.icon
          }
        }
      });
    }
  }
}

export function handleRangerPetAutoEffectTask(
  context: RangerSchedulerContext,
  task: ScheduledTask<PetAutoEffectTaskPayload>
): void {
  if (Number(task.payload?.generation) !== professionCoreState(context).petAutoGeneration) {
    return;
  }

  if (task.payload?.event) context.emit(task.payload.event);
}

// Run one serialized pet activation, applying summon Quickness and Alacrity to
// recovery and recharge before scheduling the next autonomous choice.
export function handleRangerPetAutoTask(
  context: RangerSchedulerContext,
  task: ScheduledTask<PetAutoTaskPayload>
): void {
  const state = professionCoreState(context);
  if (Number(task.payload?.generation) !== state.petAutoGeneration) return;
  state.petAutoTaskId = '';
  state.petAutoNextAt = 0;
  if (!state.petActive) return;
  const profile = activeProfile(context);
  if (!profile) return;
  if (task.at < state.petAutoBusyUntil - context.epsilon) {
    schedulePetAuto(context, state.petAutoBusyUntil);
    return;
  }

  const openingBasic = state.petAutoOpeningBasic;
  const quickness = gw2BuffActiveForAudience(context, 'quickness', task.at, 'summon');
  const selected = autonomousSkill(context, profile, task.at, quickness);
  const recovery = selected.recovery / (quickness ? QUICKNESS_ACTION_RATE : 1);
  emitAutonomousSkill(context, selected.id, task.at, recovery);
  state.petAutoBusyUntil = task.at + recovery;
  if (selected.cooldown) {
    const rechargeRate =
      !profile.ignoresAlacrity && gw2BuffActiveForAudience(context, 'alacrity', task.at, 'summon')
        ? Number(context.config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE)
        : 1;
    const cooldown =
      selected.id === ID.CRIPPLING_ANGUISH_PET && quickness
        ? 12
        : Number(selected.cooldown) * (hasTrait(context, TRAIT.PACK_ALPHA) ? 0.8 : 1);
    state.petAutoCooldowns[String(selected.id)] = task.at + cooldown / Math.max(Number.EPSILON, rechargeRate);
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
        : 0)
  );
}

// Shift command-owned packets to the pet's actual start, stamp summon metadata,
// and start or reset autonomous scheduling at combat and swap boundaries.
export function observeRangerPetEvent(context: RangerSchedulerContext, event: SimulationEvent): void {
  const state = professionCoreState(context);
  const commandDelay = Number(state.petCommandDelays[String(event.activationId || '')] || 0);
  const updates: Record<string, unknown> = {};

  if (commandDelay > 0 && event.type !== 'action') {
    updates.at = Number(event.at) + commandDelay;
  }

  if (event.source === 'ranger-pet' && !event.icon) {
    const skill = context.catalog.skillsById.get(event.skillId ?? event.sourceId);
    if (skill?.icon) updates.icon = skill.icon;
  }

  if (Object.keys(updates).length) context.replaceEvent(event, updates);
  if (event.type === 'ranger.pet-swapped') {
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

  if (event.type === 'combat_start') {
    startPetAuto(context, Number(event.at));
    return;
  }

  if (!context.hasExplicitCombatStart && event.type === 'action' && event.actorType === 'player') {
    startPetAuto(context, Number(event.at));
  }
}

// Serialize a manual command behind pet activity, shifting its action timeline
// and reserving recharge before a task commits the final pet start time.
export function beginRangerPetCommand(context: RangerCastContext, skill: RangerSkill): void {
  if (!skill.petSkill || skill.petAutonomousSkill) return;
  const state = professionCoreState(context);
  if (!state.petActive) return;
  const profile = activeProfile(context);
  if (!profile) return;
  const scheduledOpeningEnd =
    state.petAutoOpeningBasic && state.petAutoNextAt > context.start + context.epsilon
      ? state.petAutoNextAt + (profile.opening || profile.basic).recovery + Number(profile.openingRecoveryDelay || 0)
      : 0;
  const actualStart = Math.max(
    context.start,
    state.petAutoBusyUntil,
    state.petCommandReadyAt,
    Number(state.petCommandCooldowns[String(skill.id)] || 0),
    scheduledOpeningEnd
  );
  const delay = actualStart - context.start;
  const recovery = Number(
    profile.commandRecovery[String(skill.id)] || Math.max(0, context.effectiveEnd - context.start)
  );
  const busyUntil = actualStart + recovery;
  const provisionalCooldownReadyAt = actualStart + context.rechargeDurationFor(skill, actualStart);
  state.petCommandReadyAt = busyUntil;
  state.petCommandCooldowns[String(skill.id)] = provisionalCooldownReadyAt;
  state.petCommandDelays[context.reservationId] = delay;
  context.replaceEvent(context.action, {
    at: actualStart,
    endsAt: context.effectiveEnd + delay,
    fullEndsAt: context.fullEnd + delay,
    rechargeReadyAt: provisionalCooldownReadyAt,
    source: 'ranger-pet',
    actorType: 'summon',
    icon: skill.icon
  });
  context.tasks.schedule({
    type: PET_COMMAND_START_TASK,
    at: actualStart,
    priority: 0,
    ownerId: PET_AUTO_OWNER,
    payload: {
      generation: state.petAutoGeneration,
      busyUntil,
      skillId: skill.id,
      provisionalCooldownReadyAt
    }
  });
}

/** Activates or suspends the generic pet runtime when a specialization changes pet ownership. */
export function setRangerPetActive(context: RangerSchedulerContext, active: boolean, at: number): void {
  const state = professionCoreState(context);
  if (state.petActive === active) return;
  state.petActive = active;
  context.tasks.cancelOwner(PET_AUTO_OWNER);
  state.petAutoGeneration += 1;
  state.petAutoTaskId = '';
  state.petAutoNextAt = 0;
  state.petAutoBusyUntil = at;
  state.petCommandReadyAt = at;
  state.petCommandDelays = {};
  if (active) startPetAuto(context, at);
}

// Commit a delayed pet command's true cooldown and busy window, then restart the
// autonomous loop after command recovery.
export function handleRangerPetCommandStartTask(
  context: RangerSchedulerContext,
  task: ScheduledTask<PetCommandStartTaskPayload>
): void {
  const state = professionCoreState(context);
  const payload = task.payload;
  if (!payload || Number(payload.generation) !== state.petAutoGeneration) return;
  const skill = context.catalog.skillsById.get(payload.skillId) as RangerSkill | undefined;
  if (skill) {
    const key = String(skill.id);
    const provisional = Number(payload.provisionalCooldownReadyAt || 0);
    if (Number(state.petCommandCooldowns[key] || 0) <= provisional) {
      const readyAt = task.at + context.rechargeDurationFor(skill, task.at, { skill });
      state.petCommandCooldowns[key] = readyAt;
      context.state.cooldowns.set(skill.id, readyAt);
    }
  }

  if (state.petAutoTaskId) context.tasks.cancel(state.petAutoTaskId);
  state.petAutoTaskId = '';
  state.petAutoNextAt = 0;
  state.petAutoBusyUntil = Math.max(state.petAutoBusyUntil, Number(payload.busyUntil || task.at));
  schedulePetAuto(context, state.petAutoBusyUntil);
}

export const rangerPetTaskHandlers = Object.freeze({
  [PET_AUTO_TASK]: handleRangerPetAutoTask,
  [PET_COMMAND_START_TASK]: handleRangerPetCommandStartTask,
  'ranger.pet-autonomous-effect': handleRangerPetAutoEffectTask
});
