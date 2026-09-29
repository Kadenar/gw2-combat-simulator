import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { STANDARD_TARGET_ARMOR } from '#gw2/platform/combat/formulas.js';
import { materializeSkillEffectApplications, scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/engine/skills/recharge.js';
import { cancelledBeforeEffectCommit } from '#gw2/platform/execution/effect-adapter.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { castWasInterrupted, GW2_QUICKNESS_ACTION_RATE } from '#gw2/platform/skills/timing.js';
import {
  rangerPetAutoProfile,
  rangerPetBaseAttributes,
  type PetAutoProfile,
  type PetAutoSkill
} from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { signetOfTheWildBonus } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import {
  applyArachnophobiaPet,
  applyFangAndClawPet,
  applyStridersStrengthPet
} from '#gw2/professions/ranger/core/traits/behavior.js';
import {
  applyHonedAxesPet,
  applyPackAlphaPet,
  applyPetsProwessPet,
  packAlphaPetRecharge
} from '#gw2/professions/ranger/core/traits/pet-behavior.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { EPSILON } from '#kernel/core/clock.js';

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

/** Snapshot independent-pet attributes after trait inheritance and the live signet passive. */
function rangerPetAttributes(context: RangerRuntime | RangerResolverContext) {
  const petName = professionCoreState(context).activePet;
  const attributes = { ...rangerPetBaseAttributes(petName) };
  applyPackAlphaPet(context, attributes);
  applyStridersStrengthPet(context, attributes);
  applyHonedAxesPet(context, attributes);
  applyPetsProwessPet(context, attributes);
  applyFangAndClawPet(context, attributes, petName);
  applyArachnophobiaPet(context, attributes, petName);
  const runtime = 'cooldowns' in context ? context : null;
  if (runtime)
    attributes.ferocity += signetOfTheWildBonus(
      context,
      petHasSelectedSkill(runtime, 'Signet of the Wild'),
      (runtime.cooldowns.get(ID.SIGNET_OF_THE_WILD) || 0) <= runtime.time
    );
  return attributes;
}

/** Pet combat packets always retain the active companion's identity and trait-derived attributes. */
export function rangerPetCombatMetadata(context: RangerRuntime | RangerResolverContext) {
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
    summonOwner: rangerPetCompanionId(context),
    summonCriticalChance: (attributes.precision - 1000) / 2100,
    summonCriticalDamage: 1.5 + attributes.ferocity / 1500,
    summonDamagePerCoefficient: (2880 * attributes.power) / STANDARD_TARGET_ARMOR
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
    // A precombat manual command may already have spent the opening skill's recharge.
    const opening = profile.opening || profile.basic;
    return (state.petCommandCooldowns[String(opening.id)] || 0) <= context.time + EPSILON ? opening : profile.basic;
  }

  const later = state.activePet === 'Fanged Iboga' && state.petAutoActivationCounts[state.activePetSlot - 1] > 1;
  return (
    (later ? [...profile.specials].reverse() : profile.specials).find(
      (skill) =>
        (!later || quickness || (state.petAutoActivationUses[String(skill.id)] || 0) < 1) &&
        Math.max(state.petAutoCooldowns[String(skill.id)] || 0, state.petCommandCooldowns[String(skill.id)] || 0) <=
          context.time + EPSILON
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
        source: effect.source ?? (cast ? 'ranger' : 'ranger-pet'),
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
        { ...prepareRangerPetEvent(context, event), icon: skill.icon },
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
      ? state.petAutoNextAt + (profile.opening || profile.basic).recovery + (profile.openingRecoveryDelay || 0)
      : 0;
  return Math.max(
    context.time,
    state.petAutoBusyUntil,
    state.petCommandReadyAt,
    state.petCommandCooldowns[String(skill.id)] || 0,
    state.petAutoCooldowns[String(skill.id)] || 0,
    openingEnd
  );
}

export function beginRangerPetCommand(context: RangerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as RangerSkill;
  if (!rangerPetSkillCommandable(skill, context.config.specialization || 'Core') || !context.profession.core.petActive)
    return;
  const state = context.profession.core;
  const profile = rangerPetAutoProfile(state.activePet);
  const start = petCommandStart(context, skill);
  const recovery =
    profile?.commandRecovery[String(skill.id)] ||
    profile?.specials.find((entry) => entry.id === skill.id)?.recovery ||
    cast.effectiveEnd - cast.start;
  state.petCommandReadyAt = start + recovery;
  state.petCommandCooldowns[String(skill.id)] = context.cooldownController.project(skill, {
    startedAt: start,
    work: cast.rechargeWork
  });
  context.scheduleForCast(PET_COMMAND_START_TASK, start, cast, { busyUntil: start + recovery }, owner(context));
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
    const skill = context.helpers.skillsById.get(selected.id);
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
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, PROFILE.cripplingAnguishQuickness),
              'cooldown'
            )
          : selected.cooldown * packAlphaPetRecharge(context);
      state.petAutoCooldowns[String(selected.id)] = context.time + cooldown / rate;
      // Commandable automatic pet activations also publish recharge for manual commands.
      if (rangerPetSkillCommandable(skill, context.config.specialization || 'Core'))
        context.cooldownController.setReadyAt(selected.id, state.petAutoCooldowns[String(selected.id)]);
      state.petAutoActivationUses[String(selected.id)] = (state.petAutoActivationUses[String(selected.id)] || 0) + 1;
    }

    schedulePet(
      context,
      context.time +
        recovery +
        (opening
          ? (profile.openingRecoveryDelay || 0) + (quickness ? profile.quicknessOpeningRecoveryDelay || 0 : 0)
          : 0)
    );
  },
  [PET_COMMAND_START_TASK](context: RangerRuntime, data: unknown): void {
    const { cast, busyUntil } = data as { cast: RuntimeCast; busyUntil: number };
    const state = context.profession.core;
    // Automatic attacks may start while a queued command waits for recharge; finish that action first.
    if (context.time < state.petAutoBusyUntil - EPSILON) {
      const delayedBusyUntil = busyUntil + state.petAutoBusyUntil - context.time;
      state.petCommandReadyAt = Math.max(state.petCommandReadyAt, delayedBusyUntil);
      context.scheduleForCast(
        PET_COMMAND_START_TASK,
        state.petAutoBusyUntil,
        cast,
        { busyUntil: delayedBusyUntil },
        owner(context)
      );
      return;
    }

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
    emitPetSkill(context, cast.skill, context.time, cast.fullEnd + context.time - cast.start, cast.id, cast);
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
