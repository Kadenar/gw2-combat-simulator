import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { buffApplicationStacks, gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { STANDARD_TARGET_ARMOR } from '#gw2/platform/combat/formulas.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/engine/skills/recharge.js';
import { cancelledBeforeEffectCommit } from '#gw2/platform/execution/effect-adapter.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  castWasInterrupted,
  GW2_QUICKNESS_ACTION_RATE,
  gw2CooldownReadyAt,
  quantizeGw2ActionDurationUp,
  summonQuicknessCastTimeMs
} from '#gw2/platform/skills/timing.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import {
  rangerPetAutoProfile,
  rangerPetBaseAttributes,
  RANGER_PET_SKILL_TIMINGS,
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
  beastlyWardenPetDamageMultiplier,
  packAlphaPetRecharge
} from '#gw2/professions/ranger/core/traits/pet-behavior.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  rangerPetSkillCommandable,
  rangerPetSkillsRequireCommands
} from '#gw2/professions/ranger/data/pet-commands.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { EPSILON } from '#kernel/core/clock.js';

export { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

const PET_AUTO_TASK = 'ranger.pet-autonomous-skill';
const PET_COMMAND_START_TASK = 'ranger.pet-command-start';
const PET_AUTO_OWNER = 'ranger.active-pet';
const PET_AI_ATTACK_OWNER = 'ranger.pet-ai-attack';

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
    summonDamagePerCoefficient:
      ((2880 * attributes.power) / STANDARD_TARGET_ARMOR) * beastlyWardenPetDamageMultiplier(context)
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
    ? {
        ...event,
        ...rangerPetCombatMetadata(context),
        // Authored pet weapon profiles replace the generic pet roll without losing the family strike bonus.
        ...(event.weaponStrengthProfileId
          ? {
              weaponStrengthProfileId: event.weaponStrengthProfileId,
              summonStrikeMultiplier: beastlyWardenPetDamageMultiplier(context)
            }
          : {})
      }
    : { ...event, summonOwner: rangerPetCompanionId(context), independentConditionOwner: true };
}

/** Every renewed pet owns a fresh generation; already launched persistent effects have no pet-loop owner. */
function owner(context: RangerRuntime, id = PET_AUTO_OWNER) {
  return { id, generation: context.profession.core.petAutoGeneration };
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

/** Pet commands use their companion's speed rather than inheriting the player's Quickness. */
export function rangerPetCastDurationMs(context: RangerRuntime, skill: Skill, durationMs: number): number {
  if (!skill.petSkill) return durationMs;
  return quantizeGw2ActionDurationUp(
    petBuff(context, 'quickness') ? summonQuicknessCastTimeMs(skill) : (skill.castTimeMs ?? 0)
  );
}

/** Measured recovery overrides include decision gaps; unmeasured attacks retain their authored action-rate model. */
function petRecovery(skillId: string | number, recovery: number, quickness: boolean): number {
  const timing = RANGER_PET_SKILL_TIMINGS[String(skillId)];
  return (
    quantizeGw2ActionDurationUp(
      timing
        ? quickness
          ? timing.quicknessRecoveryMs
          : timing.recoveryMs
        : (recovery * 1000) / (quickness ? GW2_QUICKNESS_ACTION_RATE : 1)
    ) / 1000
  );
}

/** Automatic and commanded attacks reserve the same pet lane using live companion boons. */
function petCommandRecovery(context: RangerRuntime, cast: RuntimeCast<RangerSkill>): number {
  const profile = rangerPetAutoProfile(context.profession.core.activePet);
  const skillId = cast.skill.id;
  const special = profile?.specials.find((entry) => entry.id === skillId);
  if (RANGER_PET_SKILL_TIMINGS[String(skillId)] || special)
    return petRecovery(skillId, special?.recovery ?? 0, petBuff(context, 'quickness'));
  return (
    quantizeGw2ActionDurationUp((profile?.commandRecovery[String(skillId)] ?? cast.effectiveEnd - cast.start) * 1000) /
    1000
  );
}

function schedulePet(context: RangerRuntime, at: number): void {
  const state = context.profession.core;
  state.petAutoNextAt = gw2CooldownReadyAt(Math.max(context.time, at, state.petAutoBusyUntil));
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
  // A replaced or merged pet cannot carry an unspent venom into the next companion generation.
  state.paralyzingVenomUntil = 0;
  context.cancelOwner(owner(context));
  context.cancelOwner(owner(context, PET_AI_ATTACK_OWNER));
  state.petAutoGeneration += 1;
  state.petAutoNextAt = 0;
  state.petAutoBusyUntil = context.time;
  state.petAutoAction = null;
  state.petCommandReadyAt = context.time;
  if (context.combatActive) startRangerPet(context);
}

export function setRangerPetActive(context: RangerRuntime, active: boolean): void {
  if (context.profession.core.petActive === active) return;
  context.profession.core.petActive = active;
  resetRangerPet(context);
}

/** The first accepted strike by the armed companion consumes its venom, retaining pet condition ownership. */
export function consumeParalyzingVenom(context: RangerRuntime, event: Gw2ResolverEvent): void {
  const state = context.profession.core;
  if (
    state.paralyzingVenomUntil <= context.time ||
    !state.petActive ||
    event.actorType !== 'summon' ||
    event.source !== 'ranger-pet' ||
    event.summonOwner !== rangerPetCompanionId(context) ||
    !(Number(event.coefficient) > 0)
  )
    return;
  state.paralyzingVenomUntil = 0;
  context.effects.emit({
    kind: 'profile',
    profile: requireBalanceProfileFromContext(context, PROFILE.paralyzingVenom),
    attribution: {
      source: 'ranger-pet',
      sourceId: ID.PARALYZING_VENOM,
      actorType: 'summon',
      skillId: ID.PARALYZING_VENOM,
      skillName: 'Paralyzing Venom',
      activationId: event.activationId
    },
    transform: (packet) => ({ ...packet, ...rangerPetCombatMetadata(context) })
  });
}

/** Reproject command recharge from earned work so copied Alacrity cannot leave a stale deadline. */
function petCommandRechargeReadyAt(context: RangerRuntime, skillId: string | number): number {
  const progress = context.profession.core.petCommandRecharges[String(skillId)];
  const skill = context.helpers.skillsById.get(skillId);
  return progress && skill ? context.cooldownController.project(skill, progress) : 0;
}

function autonomousSkill(context: RangerRuntime, profile: PetAutoProfile, quickness: boolean): PetAutoSkill {
  const state = context.profession.core;
  // Command-controlled pets retain their basic cadence without spending F1/F3, including the opener.
  if (rangerPetSkillsRequireCommands(context.config.specialization || 'Core')) {
    state.petAutoOpeningBasic = false;
    return profile.basic;
  }

  if (state.petAutoOpeningBasic) {
    state.petAutoOpeningBasic = false;
    // A precombat manual command may already have spent the opening skill's recharge.
    const opening = profile.opening || profile.basic;
    return petCommandRechargeReadyAt(context, opening.id) <= context.time + EPSILON ? opening : profile.basic;
  }

  const later = state.activePet === 'Fanged Iboga' && state.petAutoActivationCounts[state.activePetSlot - 1] > 1;
  return (
    (later ? [...profile.specials].reverse() : profile.specials).find(
      (skill) =>
        (!later || quickness || (state.petAutoActivationUses[String(skill.id)] || 0) < 1) &&
        Math.max(state.petAutoCooldowns[String(skill.id)] || 0, petCommandRechargeReadyAt(context, skill.id)) <=
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
  cast?: RuntimeCast<RangerSkill>
): void {
  const timing = RANGER_PET_SKILL_TIMINGS[String(skill.id)];
  const quickness = petBuff(context, 'quickness');
  for (const effect of skill.effects ?? []) {
    if (
      cast &&
      castWasInterrupted(cast) &&
      !timing &&
      skill.interruptMode !== 'per-packet' &&
      cancelledBeforeEffectCommit(skill, effect, cast.start, cast.fullEnd, cast.effectiveEnd)
    )
      continue;
    // Preserve pet commitment, measured timing, and generation cancellation on the shared heap.
    context.effects.emit({
      kind: 'profile',
      profile: skill,
      effects: [cast ? scaleCastBoundTiming(cast, skill, effect) : effect],
      at: start,
      fullEnd,
      owner: cast || effect.persistsAfterInterrupt ? undefined : owner(context, PET_AI_ATTACK_OWNER),
      // Actual impacts follow same-time commitment rewards; the removed -20 task only prepared these packets.
      priority: 0,
      attribution: {
        activationId,
        source: effect.source ?? (cast ? 'ranger' : 'ranger-pet'),
        sourceId: effect.sourceId ?? skill.id,
        actorType: effect.actorType ?? (cast ? 'player' : 'summon'),
        skillId: skill.id,
        skillName: skill.name
      },
      transform(event) {
        const offsetMs = Math.round((event.at - start) * 1000);
        const at = gw2CooldownReadyAt(
          timing && !quickness ? start + (timing.unbuffedImpactMs[offsetMs] ?? offsetMs) / 1000 : event.at
        );
        if (
          cast &&
          castWasInterrupted(cast) &&
          (timing || skill.interruptMode === 'per-packet') &&
          at > cast.effectiveEnd + (start - cast.start) + EPSILON &&
          !effect.persistsAfterInterrupt
        )
          return null;
        return { ...prepareRangerPetEvent(context, event), at, icon: skill.icon };
      }
    });
  }
}

/** A manual command reserves the pet's own lane without delaying independent player casts. */
function petCommandStart(context: RangerRuntime, skill: RangerSkill): number {
  const state = context.profession.core;
  const profile = rangerPetAutoProfile(state.activePet);
  const interruptsAI = rangerPetSkillsRequireCommands(context.config.specialization || 'Core');
  const opening = interruptsAI ? undefined : profile?.opening || profile?.basic;
  const openingEnd =
    opening && state.petAutoOpeningBasic && state.petAutoNextAt > context.time + EPSILON
      ? state.petAutoNextAt +
        petRecovery(opening.id, opening.recovery, petBuff(context, 'quickness')) +
        (profile?.openingRecoveryDelay || 0)
      : 0;
  return gw2CooldownReadyAt(
    Math.max(
      context.time,
      interruptsAI && state.petAutoAction ? context.time : state.petAutoBusyUntil,
      state.petCommandReadyAt,
      petCommandRechargeReadyAt(context, skill.id),
      state.petAutoCooldowns[String(skill.id)] || 0,
      openingEnd
    )
  );
}

export function beginRangerPetCommand(context: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const skill = cast.skill;
  if (!rangerPetSkillCommandable(skill, context.config.specialization || 'Core') || !context.profession.core.petActive)
    return;
  const state = context.profession.core;
  const start = petCommandStart(context, skill);
  const recovery = petCommandRecovery(context, cast);
  state.petCommandReadyAt = start + recovery;
  state.petCommandRecharges[String(skill.id)] = {
    startedAt: start,
    work: cast.rechargeWork
  };
  context.scheduleForCast(PET_COMMAND_START_TASK, start, cast, {}, owner(context));
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
    const recovery = petRecovery(selected.id, selected.recovery, quickness);
    if (skill) {
      const fullEnd = gw2CooldownReadyAt(
        context.time +
          (RANGER_PET_SKILL_TIMINGS[String(selected.id)] ? rangerPetCastDurationMs(context, skill, 0) / 1000 : recovery)
      );
      // Combat activation identity is independent of event and announcement allocation.
      const activationId = `ranger-pet:${++state.petAutoSequence}`;
      context.effects.emit({
        kind: 'packet',
        event: {
          activationId,
          type: 'action',
          at: context.time,
          source: 'ranger-pet',
          sourceId: skill.id,
          actorType: 'summon',
          skillId: skill.id,
          skillName: skill.name,
          name: skill.name,
          endsAt: fullEnd,
          fullEndsAt: fullEnd,
          icon: skill.icon
        }
      });
      state.petAutoAction = { activationId, endsAt: fullEnd };
      emitPetSkill(context, skill, context.time, fullEnd, activationId);
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
      state.petAutoCooldowns[String(selected.id)] = gw2CooldownReadyAt(context.time + cooldown / rate);
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
    let { cast } = data as { cast: RuntimeCast<RangerSkill> };
    const state = context.profession.core;
    // Command-controlled pets preempt AI windups and recovery, cancelling only unlaunched AI effects.
    // Queued commands and already launched persistent effects retain their separate ownership.
    if (rangerPetSkillsRequireCommands(context.config.specialization || 'Core') && state.petAutoAction) {
      context.cancelOwner(owner(context, PET_AI_ATTACK_OWNER));
      if (state.petAutoAction.endsAt > context.time) {
        // Publish a lifecycle transition; shared emission references remain immutable.
        context.effects.emit({
          kind: 'packet',
          event: {
            type: 'action_update',
            at: context.time,
            source: 'ranger-pet',
            sourceId: state.activePet,
            actorType: 'summon',
            activationId: state.petAutoAction.activationId,
            endsAt: context.time,
            interrupted: true
          }
        });
      }

      state.petAutoBusyUntil = context.time;
      state.petAutoAction = null;
    }

    // Automatic attacks may start while a queued command waits for recharge; finish that action first.
    if (context.time < state.petAutoBusyUntil - EPSILON) {
      context.scheduleForCast(PET_COMMAND_START_TASK, state.petAutoBusyUntil, cast, {}, owner(context));
      return;
    }

    // Every queued pet command samples its companion at execution, after any intervening boon changes.
    // ponytail: speed stays fixed during an activation; in-flight boon retiming needs a live animation clock.
    const fullEnd = cast.start + rangerPetCastDurationMs(context, cast.skill, 0) / 1000;
    cast = {
      ...cast,
      fullEnd,
      effectiveEnd: castWasInterrupted(cast) ? Math.min(cast.effectiveEnd, fullEnd) : fullEnd
    };
    // A recovery estimate may never release the pet before its own accepted animation finishes.
    const busyUntil = gw2CooldownReadyAt(
      context.time + Math.max(petCommandRecovery(context, cast), cast.effectiveEnd - cast.start)
    );

    context.effects.emit({
      kind: 'packet',
      event: {
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
        endsAt: gw2CooldownReadyAt(cast.effectiveEnd + context.time - cast.start),
        fullEndsAt: gw2CooldownReadyAt(cast.fullEnd + context.time - cast.start),
        cancelled: castWasInterrupted(cast)
      }
    });
    state.petAutoBusyUntil = Math.max(state.petAutoBusyUntil, busyUntil);
    state.petAutoAction = null;
    state.petAutoNextAt = 0;
    state.petCommandRecharges[String(cast.skill.id)] = { startedAt: context.time, work: cast.rechargeWork };
    context.cooldownController.startRecharge(cast.skill, context.time, cast.rechargeWork);
    emitPetSkill(context, cast.skill, context.time, cast.fullEnd + context.time - cast.start, cast.id, cast);
    schedulePet(context, state.petAutoBusyUntil);
  }
};

/** Pet-created boons use companion concentration; recipient alone never changes the granting actor's stats. */
export function rangerBoonDuration(
  context: RangerRuntime,
  event: Gw2ResolverEvent,
  baseDuration: number,
  scaledDuration: number
): number {
  if (event.source !== 'ranger-pet' || event.actorType !== 'summon') return scaledDuration;
  const concentration = hasTrait(context, TRAIT.LINGERING_MAGIC)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_MAGIC), 'attributeBonus')
    : 0;
  return baseDuration * gw2BoonDurationMultiplier(String(event.kind), { concentration });
}
