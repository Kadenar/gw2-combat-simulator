/** Registers scheduler-phase skill activations for this module. */
import {
  balanceProfileFromContext,
  balanceProfileEffect,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { applyRangerDodgeTraits, applyRangerPetSwapTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

function performRangerDodge(context: RangerCastContext): boolean {
  const state = professionCoreState(context);
  Object.assign(
    state,
    spendEndurance(
      state,
      balanceProfileValueFromContext(context, PROFILE.resources, 'resourceCost', 50),
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
  'ranger.dodge': replaceSkill({
    beforeEffects: performRangerDodge
  }),
  'ranger.pet-swap': replaceSkill({
    beforeEffects: swapRangerPets
  }),
  'ranger.weapon-swap': gw2WeaponSwapSkillHandler,
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
      const profile = balanceProfileFromContext(context, PROFILE.poisonousStrikes);
      context.emit({
        type: 'ranger.poisonous-strikes',
        at: context.effectiveEnd,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        charges: Number(profile?.playerStacks ?? 2),
        duration: Number(profile?.durationMultiplier ?? 10)
      });
    }
  },
  'ranger.sharpening-stone': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const profile = balanceProfileFromContext(context, PROFILE.sharpeningStone);
      context.emit({
        type: 'ranger.sharpening-stone',
        at: context.start,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        charges: Number(profile?.playerStacks ?? 10),
        duration: Number(profile?.durationMultiplier ?? 30)
      });
    }
  },
  'ranger.sun-spirit': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const burning = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.sunSpirit), 'condition');
      emitSkillCondition(context, {
        at: context.effectiveEnd,
        source: 'ranger',
        sourceId: ID.SOLAR_FLARE,
        actorType: 'player',
        skillId: ID.SOLAR_FLARE,
        skillName: 'Solar Flare',
        name: 'Solar Flare - Burning',
        condition: 'Burning',
        stacks: Number(burning?.stacks ?? 3),
        duration: Number(burning?.duration ?? 6),
        triggeredBy: skill.name
      });
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
        duration: balanceProfileValueFromContext(context, PROFILE.sicEm, 'durationMultiplier', 10),
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
        charges: balanceProfileValueFromContext(context, PROFILE.bloodThirst, 'playerStacks', 3)
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
