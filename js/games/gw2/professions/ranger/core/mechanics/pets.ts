import { EPSILON } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/engine/skills/recharge.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import {
  rangerPetAutoProfile,
  rangerPetBaseAttributes,
  type PetAutoProfile,
  type PetAutoSkill
} from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

import { GW2_QUICKNESS_ACTION_RATE } from '#gw2/platform/skills/timing.js';

export { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

const PET_AUTO_TASK = 'ranger.pet-autonomous-skill';
const PET_COMMAND_START_TASK = 'ranger.pet-command-start';
const PET_AUTO_OWNER = 'ranger.active-pet';

export function rangerPetCompanionId(context: RangerRuntime | RangerResolverContext): string {
  const state = professionCoreState(context);
  return `ranger-pet:${state.activePetSlot}:${state.petAutoGeneration}`;
}

function petHasSelectedSkill(context: RangerRuntime, skillName: string): boolean {
  return selectedSkillNameSet(context.config.selectedSkills).has(skillName);
}

// Resolve each active pet's level-80 base attributes plus inherited Ranger
// traits so independent summon packets do not fall back to player attributes.
function rangerPetAttributes(context?: RangerRuntime | RangerResolverContext) {
  const petName = context ? professionCoreState(context).activePet : 'Carrion Devourer';
  let { power, precision, toughness, vitality, ferocity, conditionDamage, expertise, healingPower } =
    rangerPetBaseAttributes(petName);

  if (context) {
    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      const packAlphaProfile = requireBalanceProfileFromContext(context, PROFILE.packAlpha);
      const bonus = balanceProfileNumber(packAlphaProfile, 'weaponAttributeBonus');
      power += bonus;
      precision += bonus;
      toughness += bonus;
      vitality += bonus;
      conditionDamage += bonus;
    }

    if (hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
      const stridersStrengthProfile = requireBalanceProfileFromContext(context, PROFILE.stridersStrength);
      power += balanceProfileNumber(stridersStrengthProfile, 'attributeBonus');
    }

    if (hasTrait(context, TRAIT.HONED_AXES)) {
      const honedAxesProfile = requireBalanceProfileFromContext(context, PROFILE.honedAxes);
      ferocity += balanceProfileNumber(honedAxesProfile, 'attributeBonus');
    }

    if (hasTrait(context, TRAIT.PETS_PROWESS)) {
      const petsProwessProfile = requireBalanceProfileFromContext(context, PROFILE.petsProwess);
      ferocity += balanceProfileNumber(petsProwessProfile, 'attributeBonus');
    }

    // Independent pet strikes resolve critical stats from this metadata, not player attribute modifiers.
    if (
      hasTrait(context, TRAIT.FANG_AND_CLAW) &&
      ['feline', 'avian', 'drake'].includes(rangerPetByName(petName).family)
    ) {
      const fangAndClawProfile = requireBalanceProfileFromContext(context, PROFILE.fangAndClaw);
      precision += balanceProfileNumber(fangAndClawProfile, 'attributeBonus');
      ferocity += balanceProfileNumber(fangAndClawProfile, 'weaponAttributeBonus');
    }

    if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
      const arachnophobiaProfile = requireBalanceProfileFromContext(context, PROFILE.arachnophobia);
      expertise += balanceProfileNumber(arachnophobiaProfile, 'attributeBonus');
      if (['spider', 'devourer'].includes(rangerPetByName(petName).family)) {
        expertise += balanceProfileNumber(arachnophobiaProfile, 'weaponAttributeBonus');
      }
    }

    const runtime = 'cooldowns' in context ? context : null;
    if (
      runtime &&
      petHasSelectedSkill(runtime, 'Signet of the Wild') &&
      Number(runtime.cooldowns.get(ID.SIGNET_OF_THE_WILD) || 0) <= runtime.time
    ) {
      const signetOfTheWildProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfTheWild);
      ferocity += balanceProfileNumber(signetOfTheWildProfile, 'attributeBonus');
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

export function rangerPetCombatMetadata(context?: RangerRuntime | RangerResolverContext) {
  const attributes = rangerPetAttributes(context);
  return {
    weaponStrength: undefined,
    weaponStrengthProfileId: undefined,
    independentSummonStrike: true,
    independentConditionOwner: true,
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

/** Stamps pet-owned packets before shared consumers such as combo finishers derive child events. */
export function prepareRangerPetEvent(context: RangerRuntime, event: SimulationEventBase): SimulationEventBase {
  if (event.source !== 'ranger-pet' || event.actorType !== 'summon') return event;
  // Launched pet effects retain their original owner and attributes after a swap.
  if (event.summonOwner) return { ...event, independentConditionOwner: true };
  // Every pet-owned event needs concrete caster identity for audience resolution;
  // damaging packets additionally receive the pet's independent combat stats.
  return event.type === 'damage' || event.type === 'condition'
    ? { ...event, ...rangerPetCombatMetadata(context) }
    : { ...event, summonOwner: rangerPetCompanionId(context), independentConditionOwner: true };
}

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { cancelledBeforeEffectCommit } from '#gw2/platform/execution/effect-adapter.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Every renewed pet owns a fresh generation; already launched persistent effects have no pet-loop owner. */
function owner(context: RangerRuntime) {
  return { id: PET_AUTO_OWNER, generation: context.profession.core.petAutoGeneration };
}

function petBuff(context: RangerRuntime, kind: string): boolean {
  const id = rangerPetCompanionId(context);
  return (
    buffApplicationStacks(
      (context.boons.get(kind) ?? []).filter((buff) => buff.resolvedAudience.companionIds.includes(id)),
      kind,
      context.time,
      1,
      { ordered: true, audience: 'summon', companionId: id }
    ) > 0
  );
}

function schedulePet(context: RangerRuntime, at: number): void {
  const state = context.profession.core;
  state.petAutoNextAt = Math.max(context.time, at, state.petAutoBusyUntil);
  context.schedule(PET_AUTO_TASK, state.petAutoNextAt, state.petAutoNextAt, owner(context), 10);
}

/** Combat starts the autonomous cadence once; commands and swaps only replace their own pending wake. */
export function startRangerPet(context: RangerRuntime): void {
  const state = context.profession.core;
  const profile = rangerPetAutoProfile(state.activePet);
  if (!state.petActive || !profile || state.petAutoNextAt > context.time + EPSILON) return;
  schedulePet(context, context.time + profile.openingDelay);
}

export function resetRangerPet(context: RangerRuntime): void {
  const state = context.profession.core;
  context.cancelOwner(owner(context));
  state.petAutoGeneration += 1;
  state.petAutoNextAt = 0;
  state.petAutoBusyUntil = context.time;
  state.petCommandReadyAt = context.time;
  state.petCommandDelays = {};
  if (context.combatActive) startRangerPet(context);
}

export function setRangerPetActive(context: RangerRuntime, active: boolean): void {
  if (context.profession.core.petActive === active) return;
  context.profession.core.petActive = active;
  resetRangerPet(context);
}

function autonomousSkill(context: RangerRuntime, profile: PetAutoProfile, quickness: boolean): PetAutoSkill {
  const state = context.profession.core;
  if (state.petAutoOpeningBasic) {
    state.petAutoOpeningBasic = false;
    return profile.opening || profile.basic;
  }

  const later = state.activePet === 'Fanged Iboga' && state.petAutoActivationCounts[state.activePetSlot - 1] > 1;
  return (
    (later ? [...profile.specials].reverse() : profile.specials).find(
      (skill) =>
        (!later || quickness || Number(state.petAutoActivationUses[String(skill.id)] || 0) < 1) &&
        Number(state.petAutoCooldowns[String(skill.id)] || 0) <= context.time + EPSILON
    ) || profile.basic
  );
}

/** Materialize each pet activation once, keeping original stats and attribution across swaps. */
function emitPetSkill(
  context: RangerRuntime,
  skill: RangerSkill,
  start: number,
  fullEnd: number,
  activationId: string,
  cast?: RuntimeCast
): void {
  for (const effect of skill.effects ?? []) {
    if (
      cast &&
      castWasInterrupted(cast) &&
      skill.interruptMode !== 'per-packet' &&
      cancelledBeforeEffectCommit(skill, effect, cast.start, cast.fullEnd, cast.effectiveEnd)
    )
      continue;
    for (const { event } of materializeSkillEffectApplications({
      skill,
      effect: cast ? scaleCastBoundTiming(cast, skill, effect) : effect,
      start,
      fullEnd,
      baseEvent: {
        activationId,
        source: String(effect.source ?? (cast ? 'ranger' : 'ranger-pet')),
        sourceId: effect.sourceId ?? skill.id,
        actorType: effect.actorType ?? (cast ? 'player' : 'summon'),
        skillId: skill.id,
        skillName: skill.name
      }
    })) {
      if (
        cast &&
        castWasInterrupted(cast) &&
        skill.interruptMode === 'per-packet' &&
        event.at > cast.effectiveEnd + (start - cast.start) &&
        !effect.persistsAfterInterrupt
      )
        continue;
      context.schedule(
        'ranger.pet-effect',
        event.at,
        { ...prepareRangerPetEvent(context, event), icon: skill.icon, autonomousPetSkill: !cast },
        cast || effect.persistsAfterInterrupt ? undefined : owner(context),
        -20
      );
    }
  }
}

/** A manual command reserves the pet's own lane without delaying independent player casts. */
function petCommandStart(context: RangerRuntime, skill: RangerSkill): number {
  const state = context.profession.core;
  const profile = rangerPetAutoProfile(state.activePet);
  const openingEnd =
    profile && state.petAutoOpeningBasic && state.petAutoNextAt > context.time + EPSILON
      ? state.petAutoNextAt + (profile.opening || profile.basic).recovery + Number(profile.openingRecoveryDelay || 0)
      : 0;
  return Math.max(
    context.time,
    state.petAutoBusyUntil,
    state.petCommandReadyAt,
    state.petCommandCooldowns[String(skill.id)] || 0,
    openingEnd
  );
}

export function beginRangerPetCommand(context: RangerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as RangerSkill;
  if (!skill.petSkill || skill.petAutonomousSkill || !context.profession.core.petActive) return;
  const state = context.profession.core;
  const profile = rangerPetAutoProfile(state.activePet);
  const start = petCommandStart(context, skill);
  const recovery = Number(profile?.commandRecovery[String(skill.id)] || cast.effectiveEnd - cast.start);
  state.petCommandReadyAt = start + recovery;
  state.petCommandDelays[cast.id] = start - cast.start;
  state.petCommandCooldowns[String(skill.id)] = context.cooldownController.project(skill, {
    startedAt: start,
    work: cast.rechargeWork
  });
  context.schedule(PET_COMMAND_START_TASK, start, { cast, busyUntil: start + recovery }, owner(context));
}

export const rangerPetTasks = {
  [PET_AUTO_TASK](context: RangerRuntime, data: unknown): void {
    const state = context.profession.core;
    if (!state.petActive || state.petAutoNextAt !== data) return;
    if (context.time < state.petAutoBusyUntil - EPSILON) {
      schedulePet(context, state.petAutoBusyUntil);
      return;
    }

    state.petAutoNextAt = 0;
    const profile = rangerPetAutoProfile(state.activePet);
    if (!profile) return;
    const opening = state.petAutoOpeningBasic;
    const quickness = petBuff(context, 'quickness');
    const selected = autonomousSkill(context, profile, quickness);
    const skill = context.helpers.skillsById.get(selected.id) as RangerSkill | undefined;
    const recovery = selected.recovery / (quickness ? GW2_QUICKNESS_ACTION_RATE : 1);
    if (skill) {
      const action = context.emit({
        type: 'action',
        at: context.time,
        source: 'ranger-pet',
        sourceId: skill.id,
        actorType: 'summon',
        skillId: skill.id,
        skillName: skill.name,
        name: skill.name,
        endsAt: context.time + recovery,
        fullEndsAt: context.time + recovery,
        autonomousPetSkill: true,
        icon: skill.icon
      });
      const activationId = 'ranger-pet:' + action.eventOrder;
      emitPetSkill(context, skill, context.time, context.time + recovery, activationId);
    }

    state.petAutoBusyUntil = context.time + recovery;
    if (selected.cooldown) {
      // Autonomous pets use only Alacrity addressed to the active companion.
      const rate = !profile.ignoresAlacrity && petBuff(context, 'alacrity') ? GW2_ALACRITY_RECHARGE_RATE : 1;
      const cooldown =
        selected.id === ID.CRIPPLING_ANGUISH_PET && quickness
          ? 12
          : Number(selected.cooldown) * (hasTrait(context, TRAIT.PACK_ALPHA) ? 0.8 : 1);
      state.petAutoCooldowns[String(selected.id)] = context.time + cooldown / rate;
      state.petAutoActivationUses[String(selected.id)] =
        Number(state.petAutoActivationUses[String(selected.id)] || 0) + 1;
    }

    schedulePet(
      context,
      context.time +
        recovery +
        (opening
          ? Number(profile.openingRecoveryDelay || 0) +
            (quickness ? Number(profile.quicknessOpeningRecoveryDelay || 0) : 0)
          : 0)
    );
  },
  [PET_COMMAND_START_TASK](context: RangerRuntime, data: unknown): void {
    const { cast, busyUntil } = data as { cast: RuntimeCast; busyUntil: number };
    const state = context.profession.core;
    context.emit({
      type: 'action',
      at: context.time,
      source: 'ranger-pet',
      sourceId: cast.skill.id,
      actorType: 'summon',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      name: cast.skill.name,
      activationId: cast.id,
      icon: cast.skill.icon,
      endsAt: cast.effectiveEnd + context.time - cast.start,
      fullEndsAt: cast.fullEnd + context.time - cast.start,
      cancelled: castWasInterrupted(cast)
    });
    state.petAutoBusyUntil = Math.max(state.petAutoBusyUntil, busyUntil);
    state.petAutoNextAt = 0;
    state.petCommandCooldowns[String(cast.skill.id)] = context.cooldownController.startRecharge(
      cast.skill,
      context.time,
      cast.rechargeWork
    );
    emitPetSkill(
      context,
      cast.skill as RangerSkill,
      context.time,
      cast.fullEnd + context.time - cast.start,
      cast.id,
      cast
    );
    schedulePet(context, state.petAutoBusyUntil);
  },
  'ranger.pet-effect'(context: RangerRuntime, data: unknown): void {
    const event = data as SimulationEventBase;
    context.emit(
      event.type === 'buff'
        ? {
            ...event,
            duration: gw2ResolverBoonDuration(
              context,
              event as Gw2ResolverEvent,
              String(event.kind),
              Number(event.duration)
            )
          }
        : event
    );
  }
};
