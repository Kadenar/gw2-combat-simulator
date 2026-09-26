import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { armSkillFlip, consumeSkillFlip, followUpOf } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { rangerCoreCastAvailability } from '#gw2/professions/ranger/core/mechanics/availability.js';
import { rangerEndurance } from '#gw2/professions/ranger/core/mechanics/resources.js';
import { rangerRechargeWork } from '#gw2/professions/ranger/core/mechanics/recharge.js';
import {
  applyRangerDodgeTraits,
  applyRangerPetSwapTraits,
  applyRangerWeaponSwapTraits,
  completeRangerTraits,
  rangerCoreProfiledCriticalReaction,
  reactToRangerCoreBuff,
  reactToRangerCoreControl
} from '#gw2/professions/ranger/core/traits/index.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { reactToRangerGreatswordDamage } from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import {
  handleRangerPetSwapped,
  handleRangerBloodThirst,
  handleRangerBeastSkillUsed,
  handleRangerPoisonousStrikes,
  handleRangerSharpeningStone,
  handleRangerWinterBiteReady
} from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import {
  beginRangerPetCommand,
  prepareRangerPetEvent,
  rangerPetCompanionId,
  rangerPetTasks,
  resetRangerPet,
  startRangerPet
} from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';
import { isRangerHammerVariant } from '#gw2/professions/ranger/data/hammer-variants.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';

const spearAttacks = new Set(Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT));
const critical = onResolvedCriticalHit(rangerCoreProfiledCriticalReaction);

/** Charges are granted only at their actual activation boundary and consumed by resolved-hit owners. */
function grantSkillCharges(runtime: RangerRuntime, cast: RuntimeCast, type: string, profileId: number | string): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  runtime.emit(
    rangerEvent(
      {
        at: runtime.time,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        charges: balanceProfileNumber(profile, 'playerStacks'),
        duration: balanceProfileNumber(profile, 'durationMultiplier')
      },
      type
    )
  );
}

/** Copy both actors from one executed-time snapshot so the first copy never feeds the second. */
function copyHealingBoons(runtime: RangerRuntime, cast: RuntimeCast): void {
  const timeline = createGw2TimelineIndex({ events: runtime.history });
  const companionId = rangerPetCompanionId(runtime);
  const petActive = runtime.profession.core.petActive;
  const copies = (cast.skill.effects ?? [])
    .filter((effect) => effect.type === 'boon')
    .map((effect) => {
      const kind = String(effect.boon);
      const maximum = kind === 'might' || kind === 'stability' ? 25 : 1;
      const configured = runtime.config.boons?.[kind];
      const player = Math.min(
        maximum,
        Number(configured || 0) +
          buffApplicationStacks(runtime.boons.get(kind) ?? [], kind, runtime.time, maximum, { ordered: true })
      );
      return {
        kind,
        duration: Number(effect.duration),
        player,
        pet: petActive ? timeline.buffStacksAt(kind, runtime.time, 0, maximum, 'summon', companionId) : player
      };
    });
  for (const { kind, duration, player, pet } of copies) {
    const event = rangerEvent(
      { at: runtime.time, skillId: cast.skill.id, skillName: cast.skill.name, activationId: cast.id, kind, duration },
      'buff'
    );
    if (pet > 0) runtime.emitProcedural({ ...event, stacks: pet, audience: { recipients: 'self' } });
    if (petActive && player > 0)
      runtime.emitProcedural({
        ...event,
        stacks: player,
        audience: {
          recipients: 'summons',
          affectsSelf: false,
          maximumRecipients: 1,
          eligibleCompanionIds: [companionId]
        }
      });
  }
}

/** Complete weapon transitions once; spear variants retain their shared recharge on interrupted attempts. */
function completeWeapon(runtime: RangerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  for (const [parentId, flip] of Object.entries(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT)) {
    const parent = Number(parentId);
    if (parent === ID.PANTHERS_PROWL || (skill.id !== parent && skill.id !== flip)) continue;
    runtime.cooldownController.copy(skill.id, parent);
    runtime.cooldownController.copy(skill.id, flip);
  }

  if (skill.id === ID.PATH_OF_SCARS || skill.id === ID.PATH_OF_SCARS_MAX_RANGE) {
    runtime.cooldownController.copy(skill.id, ID.PATH_OF_SCARS);
    runtime.cooldownController.copy(skill.id, ID.PATH_OF_SCARS_MAX_RANGE);
  }

  if (castWasInterrupted(cast)) return;
  const flips = runtime.profession.core.availableFlips;
  if (skill.id === ID.PANTHERS_PROWL)
    for (const flip of spearAttacks) armSkillFlip(flips, flip, runtime.time, runtime.time + 3);
  if (skill.id === ID.HILT_BASH) {
    runtime.cooldownController.clear(ID.MAUL_SOULBEAST);
    runtime.cooldownController.clear(ID.MAUL_BASE);
  }

  if (skill.id === ID.ENDURING_SWING) runtime.endurance.grant(Number(skill.resourceGain ?? 15));
  if (skill.type !== 'Weapon' || isRangerHammerVariant(skill.id)) return;
  const followUp = followUpOf(runtime.helpers.skillsById, skill);
  if (followUp) armSkillFlip(flips, followUp.id, runtime.time, runtime.time + Number(skill.flipDuration || 5));

  if (skill.flipParentId != null && !spearAttacks.has(Number(skill.id))) consumeSkillFlip(flips, skill.id);
}

export const rangerCoreHooks: Partial<RuntimeProfession<RangerRuntimeState>> = {
  endurance: rangerEndurance,
  availability: rangerCoreCastAvailability,
  rechargeWork: rangerRechargeWork,
  reserveRecharge(runtime, skill, work) {
    // Quick Draw is reserved at acceptance so concurrent casts cannot consume the same grant twice.
    if (skill.type === 'Weapon' && skill.slot !== 'Weapon_1' && runtime.profession.core.quickDrawUntil > runtime.time)
      runtime.profession.core.quickDrawUntil = 0;
    return work;
  },
  prepareEvent(runtime, event) {
    const state = runtime.profession.core;
    const skill = runtime.helpers.skillsById.get(event.skillId!);
    // The pet lane publishes its action only when the command actually starts in the current generation.
    if (event.type === 'action' && skill?.petSkill && !skill.petAutonomousSkill && event.actorType !== 'summon')
      return null;
    if (
      runtime.hasExplicitCombatStart &&
      runtime.combatStartPending &&
      event.skillId === ID.FROST_TRAP &&
      !event.cancelled &&
      ['damage', 'condition', 'combo_field'].includes(event.type)
    ) {
      state.pendingFrostTrapEvents.push(event);
      return null;
    }

    return prepareRangerPetEvent(
      runtime,
      prepareGw2BuffCompanionCandidates(event, state.petActive ? [rangerPetCompanionId(runtime)] : [])
    );
  },
  onCombatStart(runtime) {
    startRangerPet(runtime);
    const pending = runtime.profession.core.pendingFrostTrapEvents;
    runtime.profession.core.pendingFrostTrapEvents = [];
    const delay = Math.max(0, runtime.time - Math.min(...pending.map((event) => event.at)));
    for (const event of pending)
      runtime.emit({
        ...event,
        at: event.at + delay,
        ...(event.type === 'combo_field' ? { expiresAt: Number(event.expiresAt) + delay } : {})
      });
  },
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.id === ID.WE_HEAL_AS_ONE || cast.skill.petSkill) return [];
    return cast.skill.id === ID.HILT_BASH && runtime.config.target?.defiant
      ? effects.map((effect) => (effect.type === 'control' ? { ...effect, controlKind: 'Stun' } : effect))
      : effects;
  },
  onCastStart(runtime, cast) {
    const state = runtime.profession.core;
    const skill = cast.skill;
    beginRangerPetCommand(runtime, cast);
    if (spearAttacks.has(Number(skill.id))) {
      for (const flip of spearAttacks) consumeSkillFlip(state.availableFlips, flip);
      state.stealthUntil = runtime.time;
      state.revealedUntil = runtime.time + 3;
    }

    if (skill.evades) applyRangerDodgeTraits(runtime);
    if (cast.cancelled) return;
    if (skill.id === ID.SHARPENING_STONE)
      grantSkillCharges(runtime, cast, 'ranger.sharpening-stone', PROFILE.sharpeningStone);
    if (skill.id === ID.SIC_EM && state.petActive)
      runtime.emitProcedural(
        rangerEvent(
          {
            at: runtime.time,
            skillId: skill.id,
            skillName: skill.name,
            kind: 'sic-em-pet',
            priority: -20,
            stacks: 1,
            duration: balanceProfileNumber(
              requireBalanceProfileFromContext(runtime, PROFILE.sicEm),
              'durationMultiplier'
            )
          },
          'buff'
        )
      );
  },
  onCastComplete(runtime, cast) {
    completeWeapon(runtime, cast);
    if (castWasInterrupted(cast)) return;
    const skill = cast.skill;
    const state = runtime.profession.core;
    if (skill.id === ID.PET_SWAP) {
      const slot = state.activePetSlot === 1 ? 2 : 1;
      const pet = rangerPetByName(state.petNames[slot - 1]);
      handleRangerPetSwapped(
        runtime,
        rangerEvent({ at: runtime.time, activePet: pet.name, activePetSlot: slot }, 'ranger.pet-swapped')
      );
      state.petSwapCount += 1;
      state.petAutoActivationCounts[slot - 1] += 1;
      state.petAutoActivationUses = {};
      state.petAutoOpeningBasic = state.petAutoActivationCounts[slot - 1] === 1;
      resetRangerPet(runtime);
      runtime.emit(
        rangerEvent(
          {
            at: runtime.time,
            skillId: skill.id,
            skillName: skill.name,
            activePet: pet.name,
            activePetSlot: slot,
            generation: state.petAutoGeneration
          },
          'ranger.pet-swapped'
        )
      );
      applyRangerPetSwapTraits(runtime, skill);
    }

    if (skill.id === ID.SWAP_WEAPONS) applyRangerWeaponSwapTraits(runtime, skill);
    if (skill.id === ID.DODGE) applyRangerDodgeTraits(runtime);
    if (skill.id === ID.WE_HEAL_AS_ONE) copyHealingBoons(runtime, cast);
    if (skill.id === ID.WINTERS_BITE) state.winterBiteReady = true;
    if (skill.id === ID.DOUBLE_ARC)
      grantSkillCharges(runtime, cast, 'ranger.poisonous-strikes', PROFILE.poisonousStrikes);
    if (skill.id === ID.CRIPPLING_SHOT) grantSkillCharges(runtime, cast, 'ranger.blood-thirst', PROFILE.bloodThirst);
    if (skill.id === ID.SUN_SPIRIT) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.sunSpirit);
      const burning = requireEffect(profile, 'condition', 'Burning');
      if (burning) {
        const stacks = effectNumber(profile, burning, 'stacks');
        for (let i = 0; i < Math.ceil(stacks); i++)
          runtime.emit(
            rangerEvent(
              {
                at: runtime.time,
                skillId: ID.SOLAR_FLARE,
                skillName: 'Solar Flare',
                name: 'Solar Flare - Burning',
                condition: String(burning.condition),
                stacks: Math.min(1, stacks - i),
                duration: effectNumber(profile, burning, 'duration'),
                triggeredBy: skill.name
              },
              'condition'
            )
          );
      }
    }

    completeRangerTraits(runtime, skill);
  },
  tasks: {
    ...rangerPetTasks,
    'ranger.stealth'(runtime, duration) {
      const state = runtime.profession.core;
      if (state.revealedUntil <= runtime.time)
        state.stealthUntil = Math.min(runtime.time + 15, Math.max(runtime.time, state.stealthUntil) + Number(duration));
    }
  },
  eventHandlers: {
    // This is an executed transition fact for presentation; the completion owner already changed the pet.
    'ranger.pet-swapped': () => {},
    'ranger.blood-thirst': handleRangerBloodThirst,
    'ranger.winter-bite-ready': handleRangerWinterBiteReady,
    'ranger.beast-skill-used': handleRangerBeastSkillUsed,
    'ranger.poisonous-strikes': handleRangerPoisonousStrikes,
    'ranger.sharpening-stone': handleRangerSharpeningStone
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      reactToRangerGreatswordDamage(runtime, event);
      reactToRangerCoreDamage(runtime, event);
      critical.handler(runtime, event, details as NativeResolvedDamageDetails);
      const state = runtime.profession.core;
      if ((event.actorType === 'player' || event.ownerActorType === 'player') && state.stealthUntil > runtime.time) {
        state.stealthUntil = runtime.time;
        state.revealedUntil = runtime.time + 3;
      }
    },
    'control.resolved': reactToRangerCoreControl,
    'buff.applied'(runtime, event) {
      reactToRangerCoreBuff(runtime, event);
      const state = runtime.profession.core;
      if (event.kind === 'stealth' && event.resolvedAudience?.includesSelf && state.revealedUntil <= runtime.time)
        runtime.schedule('ranger.stealth', runtime.time, Number(event.duration || 0), undefined, 10);
    }
  }
};
