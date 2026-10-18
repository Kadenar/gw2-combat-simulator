import { ACTOR, BOON } from '#gw2/platform/constants.js';
import { boonKey, gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { createRangerPetState, rangerPetInstanceId } from '#gw2/professions/ranger/core/mechanics/pet-state.js';
import {
  RANGER_PET_SKILL_TIMINGS,
  rangerPetSkillTiming
} from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { gw2CooldownReadyAt, quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
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
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import {
  rangerPetCombatMetadata,
  rangerPetCompanionId
} from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isPetActorEvent } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import {
  rangerPetAutoProfile,
  type PetAutoProfile,
  type PetAutoSkill
} from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { ibogaAutonomousRecharge } from '#gw2/professions/ranger/core/skills/pets/fanged-iboga.js';
import {
  beastlyWardenPetDamageMultiplier,
  packAlphaPetRecharge
} from '#gw2/professions/ranger/core/traits/beastmastery/pet-attributes.js';
import { lingeringMagicConcentration } from '#gw2/professions/ranger/core/traits/nature-magic/index.js';
import {
  rangerPetSkillCommandable,
  rangerPetSkillsRequireCommands
} from '#gw2/professions/ranger/data/pet-commands.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerPetDefinition,
  RangerRuntime,
  RangerSkill,
  RangerRuntimeState
} from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

export { RANGER_PET_STRIKE_SCALING } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

const PET_AUTO_TASK = 'ranger.pet-autonomous-skill';
const PET_COMMAND_START_TASK = 'ranger.pet-command-start';
const PET_AUTO_OWNER = 'ranger.active-pet';
const PET_AI_ATTACK_OWNER = 'ranger.pet-ai-attack';

/** Stamps pet-owned packets before shared consumers such as combo finishers derive child events. */
export function prepareRangerPetEvent(context: RangerRuntime, event: SimulationEventBase): SimulationEventBase {
  if (!isPetActorEvent(event)) return event;

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
    : {
        ...event,
        summonOwner: rangerPetCompanionId(context),
        entityName: context.profession.core.activePet,
        independentConditionOwner: true
      };
}

/** Pet scheduling generations are separate from the lifetime of each companion's emitted effects. */
function owner(context: RangerRuntime, id = PET_AUTO_OWNER) {
  return { id: `${rangerPetCompanionId(context)}:${id}`, generation: 0 };
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
function rangerPetCastDurationMs(context: MechanicQueriesOf<RangerRuntime>, skill: Skill, durationMs: number): number {
  if (!skill.petSkill) return durationMs;

  const petName = context.profession.core.activePet;
  const definition = RANGER_PET_SKILL_TIMINGS[skill.id];
  // Measured animations and per-pet overrides replace cast metadata; other skills retain their authored tuning.
  const timing =
    definition?.overridesSkillCastTime || definition?.petOverrides?.[petName]
      ? rangerPetSkillTiming(petName, skill.id)
      : undefined;
  return quantizeGw2ActionDurationUp(
    petBoonActive(context, boonKey(BOON.QUICKNESS))
      ? (timing?.quicknessCastTimeMs ?? summonQuicknessCastTimeMs(skill))
      : (timing?.castTimeMs ?? skill.castTimeMs ?? 0)
  );
}

/** Measured recovery overrides include decision gaps; unmeasured attacks retain their authored action-rate model. */
function petRecovery(petName: string, skillId: string | number, recovery: number, quickness: boolean): number {
  const timing = rangerPetSkillTiming(petName, skillId);
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

  if (rangerPetSkillTiming(context.profession.core.activePet, skillId) || special)
    return petRecovery(
      context.profession.core.activePet,
      skillId,
      special?.recovery ?? 0,
      petBoonActive(context, boonKey(BOON.QUICKNESS))
    );

  return (
    quantizeGw2ActionDurationUp((profile?.commandRecovery[String(skillId)] ?? cast.effectiveEnd - cast.start) * 1000) /
    1000
  );
}

function schedulePet(context: RangerRuntime, at: number): void {
  if (!autonomousActionsAllowed(context)) return;

  const state = context.profession.core;
  state.pet!.autoStarted = true;
  state.pet!.autoNextAt = gw2CooldownReadyAt(Math.max(context.time, at, state.pet!.busyUntil));
  context.schedule(PET_AUTO_TASK, state.pet!.autoNextAt, state.pet!.autoNextAt, owner(context), 10);
}

/** Interrupt only autonomous work; launched effects and manually commanded skills retain their ownership. */
function interruptPetAutoattack(context: RangerRuntime): void {
  const state = context.profession.core;

  if (!state.pet!.autoAction) return;

  context.cancelOwner(owner(context, PET_AI_ATTACK_OWNER));

  if (state.pet!.autoAction.endsAt > context.time) {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'action_update',
        at: context.time,
        source: 'ranger-pet',
        sourceId: state.activePet,
        actorType: ACTOR.SUMMON,
        activationId: state.pet!.autoAction.activationId,
        endsAt: context.time,
        interrupted: true
      }
    });
  }

  state.pet!.busyUntil = context.time;
  state.pet!.autoAction = null;
}

/** Instant pet commands restart autonomous attacks across families without interrupting a manual pet command. */
export function restartRangerPetAutoattack(context: RangerRuntime): void {
  const state = context.profession.core;

  if (!state.pet) return;

  interruptPetAutoattack(context);
  schedulePet(context, context.time);
}

/** Combat starts the autonomous cadence once; commands and swaps only replace their own pending wake. */
export function startRangerPet(context: RangerRuntime): void {
  const state = context.profession.core;
  const profile = rangerPetAutoProfile(state.activePet);

  if (!autonomousActionsAllowed(context) || !state.pet || !profile || state.pet.autoStarted) return;

  schedulePet(context, context.time + profile.openingDelay);
}

/** Retire the pet under the causing skill's identity; cooldown work survives after its Alacrity is discarded. */
export function retireRangerPet(context: RangerRuntime, sourceId: SkillId): void {
  const state = context.profession.core;

  if (!state.pet) return;

  const id = state.pet.id;
  context.cooldownController.retireCompanion(id, context.time);
  context.cancelOwner(owner(context));
  context.cancelOwner(owner(context, PET_AI_ATTACK_OWNER));
  context.cancelOwner({ id, generation: 0 });
  context.combat.retireCompanion(id, context.time);
  state.pet = null;
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'marker',
      action: 'companion-retired',
      at: context.time,
      source: 'ranger',
      sourceId,
      actorType: ACTOR.PLAYER,
      summonOwner: id
    }
  });
}

/** Merging disposes of the pet; unmerging constructs a fresh instance with no transferred rewards. */
export function setRangerPetActive(context: RangerRuntime, active: boolean, sourceId: SkillId): void {
  const state = context.profession.core;

  if (Boolean(state.pet) === active) return;

  if (!active) {
    retireRangerPet(context, sourceId);
    return;
  }

  state.pet = createRangerPetState(rangerPetInstanceId(state.activePetSlot, state.nextPetInstance++));
  state.pet.busyUntil = context.time;
  state.pet.commandReadyAt = context.time;
  context.combat.registerCompanion(state.pet.id, state.pet.effects);
  startRangerPet(context);
}

/** Swap whole lifetimes before observers grant rewards to the incoming pet. */
export function applyRangerPetSwap(context: RangerRuntime, pet: RangerPetDefinition, slot: 1 | 2): void {
  retireRangerPet(context, ID.PET_SWAP);
  const state = context.profession.core;
  state.activePet = pet.name;
  state.activePetSlot = slot;
  state.activePetSkillIds = [...pet.skillIds];
  setRangerPetActive(context, true, ID.PET_SWAP);
}

/** Autonomous decisions and commands consult the same global skill cooldown. */
function petRechargeReadyAt(context: RangerRuntime, skillId: string | number): number {
  return gw2CooldownReadyAt(context.cooldownController.readyAt(skillId) ?? 0);
}

function autonomousSkill(context: RangerRuntime, profile: PetAutoProfile): PetAutoSkill {
  const pet = context.profession.core.pet!;

  if (rangerPetSkillsRequireCommands(context.config.specialization || 'Core')) {
    pet.openingBasic = false;
    return profile.basic;
  }

  if (pet.openingBasic) {
    // Each fresh lifetime starts with its opening action, unless its globally retained cooldown blocks it.
    pet.openingBasic = false;
    const opening = profile.opening || profile.basic;
    return petRechargeReadyAt(context, opening.id) <= context.time ? opening : profile.basic;
  }

  // Later decisions use the family's special-skill priority; no previous pet lifetime contributes AI history.
  return profile.specials.find((skill) => petRechargeReadyAt(context, skill.id) <= context.time) || profile.basic;
}

/** Materialize each pet activation once, keeping original stats and attribution across swaps. */
export function emitRangerPetSkill(
  context: RangerRuntime,
  skill: RangerSkill,
  start: number,
  fullEnd: number,
  activationId: string,
  cast?: RuntimeCast<RangerSkill>
): void {
  const companionId = rangerPetCompanionId(context);
  const entityName = context.profession.core.activePet;
  const timing = rangerPetSkillTiming(entityName, skill.id);
  const quickness = petBoonActive(context, boonKey(BOON.QUICKNESS));
  for (const effect of skill.effects ?? []) {
    // Pet-owned emission must retain the same acceptance checks as the standard cast pipeline.
    if (cast && effect.when && !effect.when(context.queries, cast)) continue;

    if (
      cast &&
      castWasInterrupted(cast) &&
      !timing &&
      skill.interruptMode !== 'per-packet' &&
      cancelledBeforeEffectCommit(skill, effect, cast.start, cast.fullEnd, cast.effectiveEnd)
    )
      continue;

    // Ranger-stat damage is independent; all other pending skill effects require the casting pet.
    const rangerDamage = effect.actorType === ACTOR.PLAYER && (effect.type === 'strike' || effect.type === 'condition');
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
        actorType: effect.actorType ?? (cast ? ACTOR.PLAYER : ACTOR.SUMMON),
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
        // Capture the name with the caster so delayed packets cannot borrow a replacement pet's label.
        return {
          ...prepareRangerPetEvent(context, event),
          entityName,
          summonOwner: companionId,
          // Moving commanded effects onto the pet's owner must preserve rotation targeting options.
          at: at + (isHostileTargetEvent(event) ? (cast?.command.impactDelayMs ?? 0) / 1000 : 0),
          offTarget: cast?.command.offTarget,
          icon: skill.icon
        };
      }
    });
  }
}

/** Commands preempt autonomous activity on every specialization, but wait for earlier manual commands. */
function petCommandStart(context: RangerRuntime, skill: RangerSkill): number {
  const state = context.profession.core;
  return gw2CooldownReadyAt(
    Math.max(
      context.time,
      state.pet!.autoAction ? context.time : state.pet!.busyUntil,
      state.pet!.commandReadyAt,
      petRechargeReadyAt(context, skill.id)
    )
  );
}

export function beginRangerPetCommand(context: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const skill = cast.skill;

  if (!rangerPetSkillCommandable(skill, context.config.specialization || 'Core') || !context.profession.core.pet)
    return;

  const state = context.profession.core;
  const start = petCommandStart(context, skill);
  const recovery = petCommandRecovery(context, cast);
  state.pet!.commandReadyAt = start + recovery;

  context.scheduleForCast(PET_COMMAND_START_TASK, start, cast, {}, owner(context));
}

const rangerPetTasks = {
  [PET_AUTO_TASK](context: RangerRuntime, data: unknown): void {
    const state = context.profession.core;

    if (!autonomousActionsAllowed(context) || !state.pet || state.pet.autoNextAt !== data) return;

    if (context.time < canonicalTime(state.pet.busyUntil)) {
      schedulePet(context, state.pet.busyUntil);
      return;
    }

    state.pet.autoNextAt = 0;
    const profile = rangerPetAutoProfile(state.activePet);

    if (!profile) return;

    const opening = state.pet.openingBasic;
    const quickness = petBoonActive(context, boonKey(BOON.QUICKNESS));
    const selected = autonomousSkill(context, profile);
    const skill = context.helpers.skillsById.get(selected.id);
    const recovery = petRecovery(state.activePet, selected.id, selected.recovery, quickness);

    if (skill) {
      const fullEnd = gw2CooldownReadyAt(
        context.time +
          (rangerPetSkillTiming(state.activePet, selected.id)
            ? rangerPetCastDurationMs(context, skill, 0) / 1000
            : recovery)
      );
      // Combat activation identity is independent of event and announcement allocation.
      const activationId = `${state.pet.id}:action:${++state.pet.sequence}`;
      context.effects.emit({
        kind: 'packet',
        event: {
          activationId,
          type: 'action',
          at: context.time,
          source: 'ranger-pet',
          sourceId: skill.id,
          actorType: ACTOR.SUMMON,
          skillId: skill.id,
          skillName: skill.name,
          name: skill.name,
          endsAt: fullEnd,
          fullEndsAt: fullEnd,
          icon: skill.icon
        }
      });
      state.pet.autoAction = { activationId, endsAt: fullEnd };
      emitRangerPetSkill(context, skill, context.time, fullEnd, activationId);
    }

    state.pet.busyUntil = context.time + recovery;

    if (skill) {
      // Ordinary recharge follows the active catalog; the Iboga owns its measured autonomous exceptions.
      const cooldown =
        ibogaAutonomousRecharge(context, skill, quickness) ?? (skill.cooldown ?? 0) * packAlphaPetRecharge(context);

      // All pet skills, including autonomous-only skills, recharge in the global controller.
      if (cooldown > 0) {
        if (profile.ignoresAlacrity) context.cooldownController.setReadyAt(skill.id, context.time + cooldown);
        else context.cooldownController.startRecharge(skill, context.time, cooldown, rangerPetCompanionId(context));
      }
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
    interruptPetAutoattack(context);

    // Acceptance reserves the pet lane; execution alone spends the shared cooldown.
    const readyAt = petRechargeReadyAt(context, cast.skill.id);

    if (context.time < canonicalTime(state.pet!.busyUntil) || context.time < readyAt) {
      context.scheduleForCast(
        PET_COMMAND_START_TASK,
        Math.max(state.pet!.busyUntil, readyAt),
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
        actorType: ACTOR.SUMMON,
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
    state.pet!.busyUntil = Math.max(state.pet!.busyUntil, busyUntil);
    state.pet!.autoAction = null;
    state.pet!.autoNextAt = 0;

    context.cooldownController.startRecharge(cast.skill, context.time, cast.rechargeWork, cast.rechargeCompanionId);
    emitRangerPetSkill(context, cast.skill, context.time, cast.fullEnd + context.time - cast.start, cast.id, cast);
    schedulePet(context, state.pet!.busyUntil);
  }
};

/** Autonomous pet attacks, pet cast timing, and boon sharing durations share one owner; pet attacks cannot prolong an isolated damage preview. */
export const rangerPetLifecycle = {
  backgroundTasks: Object.keys(rangerPetTasks),
  tasks: rangerPetTasks,
  boonDuration: rangerBoonDuration,
  castDurationMs: rangerPetCastDurationMs
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

/** Pet-created boons use companion concentration; recipient alone never changes the granting actor's stats. */
function rangerBoonDuration(
  context: import('#gw2/platform/profession-definition/runtime-context.js').SelectedContentContext,
  event: Gw2ResolverEvent,
  baseDuration: number,
  scaledDuration: number
): number {
  if (!isPetActorEvent(event)) return scaledDuration;

  const concentration = lingeringMagicConcentration(context);
  return baseDuration * gw2BoonDurationMultiplier(String(event.kind), { concentration });
}
