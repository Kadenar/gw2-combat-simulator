import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { gw2CooldownReadyAt, quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import { gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { cancelledBeforeEffectCommit } from '#gw2/platform/execution/cast-effects.js';
import {
  castWasInterrupted,
  GW2_QUICKNESS_ACTION_RATE,
  scaleCastBoundTiming,
  summonQuicknessCastTimeMs
} from '#gw2/platform/execution/cast-timing.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  rangerPetCombatMetadata,
  rangerPetCompanionId
} from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import {
  RANGER_PET_SKILL_TIMINGS,
  rangerPetAutoProfile,
  type PetAutoProfile,
  type PetAutoSkill
} from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import {
  beastlyWardenPetDamageMultiplier,
  packAlphaPetRecharge
} from '#gw2/professions/ranger/core/traits/beastmastery/pet-attributes.js';
import { lingeringMagicConcentration } from '#gw2/professions/ranger/core/traits/nature-magic/index.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import {
  rangerPetSkillCommandable,
  rangerPetSkillsRequireCommands
} from '#gw2/professions/ranger/data/pet-commands.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

const PET_AUTO_TASK = 'ranger.pet-autonomous-skill';
const PET_COMMAND_START_TASK = 'ranger.pet-command-start';
const PET_AUTO_OWNER = 'ranger.active-pet';
const PET_AI_ATTACK_OWNER = 'ranger.pet-ai-attack';

/** Stamps pet-owned packets before shared consumers such as combo finishers derive child events. */
export function prepareRangerPetEvent(context: RangerRuntime, event: SimulationEventBase): SimulationEventBase {
  if (event.source !== 'ranger-pet' || event.actorType !== 'summon') return event;
  // Packets retain their launching identity so entity retirement cannot retarget them to a replacement.
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

/** Pet scheduling generations are separate from the lifetime of each companion's emitted effects. */
function owner(context: RangerRuntime, id = PET_AUTO_OWNER) {
  return { id, generation: context.profession.core.petAutoGeneration };
}

/** Pet mechanics query only the current incarnation's accepted boons. */
function petBoonActive(context: MechanicQueriesOf<RangerRuntime>, kind: string): boolean {
  return (
    context.combat.activeBoonStacks(kind, context.time, 1, {
      actor: 'companion',
      companionId: rangerPetCompanionId(context)
    }) > 0
  );
}

/** Pet commands use their companion's speed rather than inheriting the player's Quickness. */
export function rangerPetCastDurationMs(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: Skill,
  durationMs: number
): number {
  if (!skill.petSkill) return durationMs;
  return quantizeGw2ActionDurationUp(
    petBoonActive(context, 'quickness') ? summonQuicknessCastTimeMs(skill) : (skill.castTimeMs ?? 0)
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
    return petRecovery(skillId, special?.recovery ?? 0, petBoonActive(context, 'quickness'));
  return (
    quantizeGw2ActionDurationUp((profile?.commandRecovery[String(skillId)] ?? cast.effectiveEnd - cast.start) * 1000) /
    1000
  );
}

function schedulePet(context: RangerRuntime, at: number): void {
  if (!autonomousActionsAllowed(context)) return;
  const state = context.profession.core;
  state.petAutoStarted = true;
  state.petAutoNextAt = gw2CooldownReadyAt(Math.max(context.time, at, state.petAutoBusyUntil));
  context.schedule(PET_AUTO_TASK, state.petAutoNextAt, state.petAutoNextAt, owner(context), 10);
}

/** Combat starts the autonomous cadence once; commands and swaps only replace their own pending wake. */
export function startRangerPet(context: RangerRuntime): void {
  const state = context.profession.core;
  const profile = rangerPetAutoProfile(state.activePet);
  if (!autonomousActionsAllowed(context) || !state.petActive || !profile || state.petAutoStarted) return;
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
  state.petAutoStarted = false;
  state.petAutoBusyUntil = context.time;
  state.petAutoAction = null;
  state.petCommandReadyAt = context.time;
  startRangerPet(context);
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

/** Reproject autonomous work against its original companion's boons, retaining pet-specific immunity after swaps. */
function petAutonomousRechargeReadyAt(context: RangerRuntime, skillId: string | number): number {
  const progress = context.profession.core.petAutoRecharges[String(skillId)];
  const skill = context.helpers.skillsById.get(skillId);
  if (!progress || !skill) return 0;
  return gw2CooldownReadyAt(
    context.cooldownController.project(
      progress.ignoresAlacrity ? { ...skill, rechargeIgnoresAlacrity: true } : skill,
      progress
    )
  );
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
    return Math.max(
      petAutonomousRechargeReadyAt(context, opening.id),
      petCommandRechargeReadyAt(context, opening.id)
    ) <= context.time
      ? opening
      : profile.basic;
  }

  const later = state.activePet === 'Fanged Iboga' && state.petAutoActivationCounts[state.activePetSlot - 1] > 1;
  return (
    (later ? [...profile.specials].reverse() : profile.specials).find(
      (skill) =>
        (!later || quickness || (state.petAutoActivationUses[String(skill.id)] || 0) < 1) &&
        Math.max(petAutonomousRechargeReadyAt(context, skill.id), petCommandRechargeReadyAt(context, skill.id)) <=
          context.time
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
  const companionId = rangerPetCompanionId(context);
  const timing = RANGER_PET_SKILL_TIMINGS[String(skill.id)];
  const quickness = petBoonActive(context, 'quickness');
  for (const effect of skill.effects ?? []) {
    if (
      cast &&
      castWasInterrupted(cast) &&
      !timing &&
      skill.interruptMode !== 'per-packet' &&
      cancelledBeforeEffectCommit(skill, effect, cast.start, cast.fullEnd, cast.effectiveEnd)
    )
      continue;
    // Ranger-stat damage is independent; all other pending skill effects require the casting pet.
    const rangerDamage = effect.actorType === 'player' && (effect.type === 'strike' || effect.type === 'condition');
    context.effects.emit({
      kind: 'profile',
      profile: skill,
      effects: [cast ? scaleCastBoundTiming(cast, skill, effect) : effect],
      at: start,
      fullEnd,
      owner: rangerDamage
        ? undefined
        : !cast && !effect.persistsAfterInterrupt
          ? owner(context, PET_AI_ATTACK_OWNER)
          : { id: companionId, generation: 0 },
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
          canonicalTime(at) > canonicalTime(cast.effectiveEnd + (start - cast.start)) &&
          !effect.persistsAfterInterrupt
        )
          return null;
        // Ranger-stat exceptions retain caster provenance too, so their pet-owned trait children cannot migrate on swap.
        return { ...prepareRangerPetEvent(context, event), summonOwner: companionId, at, icon: skill.icon };
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
    opening && state.petAutoOpeningBasic && state.petAutoNextAt > context.time
      ? state.petAutoNextAt +
        petRecovery(opening.id, opening.recovery, petBoonActive(context, 'quickness')) +
        (profile?.openingRecoveryDelay || 0)
      : 0;
  return gw2CooldownReadyAt(
    Math.max(
      context.time,
      interruptsAI && state.petAutoAction ? context.time : state.petAutoBusyUntil,
      state.petCommandReadyAt,
      petCommandRechargeReadyAt(context, skill.id),
      petAutonomousRechargeReadyAt(context, skill.id),
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
    work: cast.rechargeWork,
    companionId: cast.rechargeCompanionId
  };
  context.scheduleForCast(PET_COMMAND_START_TASK, start, cast, {}, owner(context));
}

export const rangerPetTasks = {
  [PET_AUTO_TASK](context: RangerRuntime, data: unknown): void {
    const state = context.profession.core;
    if (!autonomousActionsAllowed(context) || !state.petActive || state.petAutoNextAt !== data) return;
    if (context.time < canonicalTime(state.petAutoBusyUntil)) {
      schedulePet(context, state.petAutoBusyUntil);
      return;
    }

    state.petAutoNextAt = 0;
    const profile = rangerPetAutoProfile(state.activePet);
    if (!profile) return;
    const opening = state.petAutoOpeningBasic;
    const quickness = petBoonActive(context, 'quickness');
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
      const cooldown =
        selected.id === ID.CRIPPLING_ANGUISH_PET && quickness
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, PROFILE.cripplingAnguishQuickness),
              'cooldown'
            )
          : selected.cooldown * packAlphaPetRecharge(context);
      // Store base work, not the current-rate deadline, so later grants and expiry change only unearned recharge.
      const progress = {
        startedAt: context.time,
        work: cooldown,
        companionId: rangerPetCompanionId(context),
        ignoresAlacrity: profile.ignoresAlacrity === true
      };
      state.petAutoRecharges[String(selected.id)] = progress;
      // Manual commands share this work; an immune autonomous activation deliberately retains a constant deadline.
      if (skill && rangerPetSkillCommandable(skill, context.config.specialization || 'Core')) {
        if (progress.ignoresAlacrity)
          context.cooldownController.setReadyAt(selected.id, petAutonomousRechargeReadyAt(context, selected.id));
        else context.cooldownController.startRecharge(skill, progress.startedAt, progress.work, progress.companionId);
      }

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
    // Launched effects survive command interruption but remain bound to the companion's lifetime.
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

    // A queued command must still wait if autonomous work loses Alacrity or another pet action occupies the lane.
    const autoReadyAt = petAutonomousRechargeReadyAt(context, cast.skill.id);
    if (context.time < canonicalTime(state.petAutoBusyUntil) || context.time < autoReadyAt) {
      context.scheduleForCast(
        PET_COMMAND_START_TASK,
        Math.max(state.petAutoBusyUntil, autoReadyAt),
        cast,
        {},
        owner(context)
      );
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
    state.petCommandRecharges[String(cast.skill.id)] = {
      startedAt: context.time,
      work: cast.rechargeWork,
      companionId: cast.rechargeCompanionId
    };
    context.cooldownController.startRecharge(cast.skill, context.time, cast.rechargeWork, cast.rechargeCompanionId);
    emitPetSkill(context, cast.skill, context.time, cast.fullEnd + context.time - cast.start, cast.id, cast);
    schedulePet(context, state.petAutoBusyUntil);
  }
};

/** Pet-created boons use companion concentration; recipient alone never changes the granting actor's stats. */
export function rangerBoonDuration(
  context: import('#gw2/platform/profession-definition/runtime-context.js').SelectedContentContext,
  event: Gw2ResolverEvent,
  baseDuration: number,
  scaledDuration: number
): number {
  if (event.source !== 'ranger-pet' || event.actorType !== 'summon') return scaledDuration;
  const concentration = lingeringMagicConcentration(context);
  return baseDuration * gw2BoonDurationMultiplier(String(event.kind), { concentration });
}
