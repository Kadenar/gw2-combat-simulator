/** Registers scheduler-phase skill activations for this module. */
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { applyRangerDodgeTraits, applyRangerPetSwapTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Copy both actors' existing boons from one completion-time snapshot, including merged self-copying. */
export function completeRangerHealingSkill(context: RangerCastContext, skill: RangerSkill): void {
  if (skill.id !== ID.WE_HEAL_AS_ONE || castWasInterrupted(context)) return;
  const petActive = professionCoreState(context).petActive;
  const companionId = rangerPetCompanionId(context);
  const timeline = createGw2TimelineIndex({ events: context.events });
  // Snapshot both actors before emitting copies; concentration is applied by the boon emitter.
  if (!skill.effects?.length) throw new Error('We Heal As One is missing boon copy effects');
  const copies = skill.effects
    .filter((effect) => effect.type === 'boon')
    .map((effect) => {
      const kind = String(effect.boon);
      const duration = Number(effect.duration);
      const maximum = kind === 'might' || kind === 'stability' ? 25 : 1;
      const player = Math.min(maximum, context.buffStacks(kind, context.effectiveEnd));
      const pet = petActive
        ? timeline.buffStacksAt(kind, context.effectiveEnd, 0, maximum, 'summon', companionId)
        : player;
      return { kind, duration, player, pet };
    });
  for (const { kind, duration, player, pet } of copies) {
    if (pet > 0)
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        kind,
        duration,
        stacks: pet,
        audience: { recipients: 'self' }
      });
    if (petActive && player > 0)
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        kind,
        duration,
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

function performRangerDodge(context: RangerCastContext): boolean {
  const state = professionCoreState(context);
  Object.assign(
    state,
    spendEndurance(
      state,
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'resourceCost'),
      context.start,
      state.maximumEndurance
    )
  );
  applyRangerDodgeTraits(context);
  return true;
}

function swapRangerPets(context: RangerCastContext, skill: RangerSkill): boolean {
  const state = professionCoreState(context);
  state.petSwapCount += 1;
  state.activePetSlot = state.activePetSlot === 1 ? 2 : 1;
  const pet = rangerPetByName(state.petNames[state.activePetSlot - 1]);
  state.activePet = pet.name;
  state.activePetSkillIds = [...pet.skillIds];
  state.petOpeningStrikeReady = true;
  context.emit({
    type: 'ranger.pet-swapped',
    at: context.effectiveEnd,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    activePet: pet.name,
    activePetSlot: state.activePetSlot
  });
  applyRangerPetSwapTraits(context, skill);
  return true;
}

export const rangerCoreSkillHandlers = Object.freeze({
  // Keep boon effects as metadata so the completion hook can check live boon stacks first.
  'ranger.we-heal-as-one': replaceSkill({}),
  'ranger.dodge': replaceSkill({
    beforeEffects: performRangerDodge
  }),
  'ranger.pet-swap': replaceSkill({
    beforeEffects: swapRangerPets
  }),
  'ranger.weapon-swap': gw2WeaponSwapSkillHandler,
  'ranger.hilt-bash': {
    mode: 'augment' as const,
    afterEffect(context: RangerCastContext, _skill: RangerSkill, event: Gw2ResolverEvent) {
      // Defiant foes receive a stun; both variants remain control packets for trait reactions.
      if (event.type === 'control' && context.config.target?.defiant) {
        context.replaceEvent(event, { controlKind: 'Stun' });
      }
    }
  },
  'ranger.winters-bite': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      professionCoreState(context).winterBiteReady = true;
      context.emit({
        type: 'ranger.winter-bite-ready',
        at: context.effectiveEnd,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      });
    }
  },
  'ranger.poisonous-strikes': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const profile = requireBalanceProfileFromContext(context, PROFILE.poisonousStrikes);
      context.emit({
        type: 'ranger.poisonous-strikes',
        at: context.effectiveEnd,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        charges: balanceProfileNumber(profile, 'playerStacks'),
        duration: balanceProfileNumber(profile, 'durationMultiplier')
      });
    }
  },
  'ranger.sharpening-stone': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const profile = requireBalanceProfileFromContext(context, PROFILE.sharpeningStone);
      context.emit({
        type: 'ranger.sharpening-stone',
        at: context.start,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        charges: balanceProfileNumber(profile, 'playerStacks'),
        duration: balanceProfileNumber(profile, 'durationMultiplier')
      });
    }
  },
  'ranger.sun-spirit': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const profile = requireBalanceProfileFromContext(context, PROFILE.sunSpirit);
      const burning = requireEffect(profile, 'condition', 'Burning');
      if (!burning) return;
      // Separate Burning applications preserve the total, including any fractional final stack.
      const stacks = effectNumber(profile, burning, 'stacks');
      const duration = effectNumber(profile, burning, 'duration');
      for (let index = 0; index < Math.ceil(stacks); index += 1) {
        emitSkillCondition(context, {
          at: context.effectiveEnd,
          skillId: ID.SOLAR_FLARE,
          skillName: 'Solar Flare',
          name: 'Solar Flare - Burning',
          condition: String(burning.condition),
          stacks: Math.min(1, stacks - index),
          duration,
          triggeredBy: skill.name
        });
      }
    }
  },
  'ranger.sic-em': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      if (!professionCoreState(context).petActive) return;
      emitSkillBuff(context, {
        at: context.start,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        kind: 'sic-em-pet',
        // Apply the instant command before simultaneous pet damage queries its modifier.
        priority: -20,
        duration: balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.sicEm), 'durationMultiplier'),
        stacks: 1
      });
    }
  },
  'ranger.crippling-shot': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      context.emit({
        type: 'ranger.blood-thirst',
        at: context.effectiveEnd,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        charges: balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.bloodThirst), 'playerStacks'),
        duration: balanceProfileNumber(
          requireBalanceProfileFromContext(context, PROFILE.bloodThirst),
          'durationMultiplier'
        )
      });
    }
  }
});

/** Runs Core Ranger mechanics owned by one completed skill activation. */
export const rangerCoreSkillMechanicHandlers = Object.freeze({
  'ranger.core.sync-path-of-scars-cooldown': ({
    context,
    skill,
    at
  }: {
    context: RangerSchedulerContext;
    skill: RangerSkill;
    at: number;
  }): void => {
    const readyAt = Number(context.state.cooldowns.get(skill.id) || at);
    context.state.cooldowns.set(ID.PATH_OF_SCARS, readyAt);
    context.state.cooldowns.set(ID.PATH_OF_SCARS_MAX_RANGE, readyAt);
  }
});
