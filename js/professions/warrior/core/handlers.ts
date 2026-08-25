import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { augmentSkillHandler, replaceSkillHandler } from '../../../platform/engine/skills/handlers.js';
import { gw2WeaponSwapSkillHandler } from '../../../platform/gw2/equipment/weapons/swap.js';
import { WARRIOR_SKILL_IDS as ID } from '../data/ids.js';
import { recordWarriorAmmoSpend } from '../ammunition.js';
import { applyWarriorSkillResource } from '../resources.js';
import { applyWarriorBurstSpendTraits, applyRecklessDodge, grantBerserkersPowerOnFirstHit } from './traits.js';
import type { WarriorCastContext, WarriorSimulationEvent, WarriorSkill } from '../types.js';
import {
  warriorBalanceProfile,
  warriorBalanceProfileEffect,
  WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE
} from './profiles.js';

function burstTier(context: WarriorCastContext, spent: number): number {
  const tiers = warriorBalanceProfile(context, PROFILE.burstTiers);
  return spent >= Number(tiers?.maximumStacks || 30) ? 3 : spent >= Number(tiers?.threshold || 20) ? 2 : 1;
}

function afterResourceSkill(
  context: WarriorCastContext,
  skill: WarriorSkill
): { spent: number; berserkersPowerGranted: boolean } {
  const spent = applyWarriorSkillResource(context, skill);
  applyWarriorBurstSpendTraits(context, skill, spent);
  return { spent, berserkersPowerGranted: false };
}

function adjustResourceSkillEffect(
  context: WarriorCastContext,
  skill: WarriorSkill,
  event: WarriorSimulationEvent,
  handlerState: unknown
): void {
  const state = handlerState as {
    spent: number;
    berserkersPowerGranted: boolean;
  };
  const spent = Number(state?.spent || 0);
  if (!state.berserkersPowerGranted && grantBerserkersPowerOnFirstHit(context, skill, event, spent)) {
    state.berserkersPowerGranted = true;
  }

  if (skill.id === ID.BLOODTHIRSTER && event.type === 'condition' && event.condition === 'Bleeding') {
    const tier = burstTier(context, spent);
    const bleeding = warriorBalanceProfileEffect(
      warriorBalanceProfile(context, PROFILE.bloodthirsterTiers),
      'condition',
      tier - 1
    );
    context.replaceEvent(event, {
      stacks: Number(bleeding?.stacks || tier * 3),
      duration: Number(bleeding?.duration || event.duration)
    });
  }

  if (skill.id !== ID.EVISCERATE || event.type !== 'damage' || !(Number(event.coefficient) > 0)) {
    return;
  }

  const tier = burstTier(context, spent);
  const variantId = [PROFILE.eviscerateTier1, PROFILE.eviscerateTier2, PROFILE.eviscerateTier3][tier - 1];
  const strike = warriorBalanceProfileEffect(warriorBalanceProfile(context, variantId), 'strike');
  context.replaceEvent(event, {
    coefficient: Number(strike?.coefficient || [2, 2.5, 3][tier - 1]),
    name: `Eviscerate — Level ${tier} Damage`
  });
}

function useCombustiveShot(context: WarriorCastContext, skill: WarriorSkill): void {
  const resource = afterResourceSkill(context, skill);
  const tier = burstTier(context, resource.spent);
  const pulses = tier + 1;
  const profile = warriorBalanceProfile(context, PROFILE.combustiveShot);
  const strike = warriorBalanceProfileEffect(profile, 'strike');
  const burning = warriorBalanceProfileEffect(profile, 'condition');
  const interval = Number(profile?.pulseInterval || 3);
  const durationPerTier = Number(profile?.durationPerTier || 3);
  const ownedField = skill.comboFields?.find((field) => field.ownerId === 'warrior');
  context.replaceEvent(context.action, {
    burstTier: tier,
    ...(ownedField ? { comboFields: [{ ...ownedField, duration: tier * durationPerTier }] } : {})
  });
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const at = context.fullEnd + pulse * interval;
    const damage = context.emit({
      type: 'damage',
      at,
      source: 'Warrior',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} - Level ${tier} Damage`,
      coefficient: Number(strike?.coefficient || 0.5),
      hits: 1,
      hitIndex: pulse + 1,
      totalHits: pulses,
      skillWeapon: skill.weapon || 'Longbow',
      persistsAfterInterrupt: true
    });
    if (
      !resource.berserkersPowerGranted &&
      grantBerserkersPowerOnFirstHit(context, skill, damage as WarriorSimulationEvent, resource.spent)
    ) {
      resource.berserkersPowerGranted = true;
    }

    context.emit({
      type: 'condition',
      at,
      source: 'Warrior',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} - Burning`,
      condition: String(burning?.condition || 'Burning'),
      stacks: Number(burning?.stacks || 1),
      duration: Number(burning?.duration || 5),
      applicationIndex: pulse + 1,
      totalApplications: pulses,
      persistsAfterInterrupt: true
    });
  }
}

function adjustMightyThrowTarget(
  context: WarriorCastContext,
  _skill: WarriorSkill,
  event: WarriorSimulationEvent
): void {
  if (event.name === 'Mighty Throw — Shard Damage' && Math.max(1, Number(context.config.target?.count || 1)) === 1) {
    context.replaceEvent(event, {
      coefficient: 0,
      secondaryTargetOnly: true
    });
  }
}

function adjustFierceBlowDamage(
  context: WarriorCastContext,
  _skill: WarriorSkill,
  event: WarriorSimulationEvent
): void {
  if (
    event.type !== 'damage' ||
    !(Number(event.coefficient) > 0) ||
    !(
      context.config.target?.controlled ||
      context.config.target?.defiant ||
      professionCoreState(context).targetControlledUntil > event.at
    )
  ) {
    return;
  }

  context.replaceEvent(event, {
    coefficient: 2.7,
    name: 'Fierce Blow — Damage to Controlled or Defiant Foes'
  });
}

function consumeDragonRoarAmmo(context: WarriorCastContext, skill: WarriorSkill): void {
  const bullets = Math.max(1, Number(context.ammo?.charges || 1));
  const profile = warriorBalanceProfile(context, PROFILE.dragonsRoar);
  const strike = warriorBalanceProfileEffect(profile, 'strike');
  const castDuration = Math.max(0, context.effectiveEnd - context.start);
  const firstBulletAt = context.start + castDuration * Number(profile?.firstPacketRatio || 6 / 7);
  const bulletInterval = castDuration * Number(profile?.packetIntervalRatio || 2 / 7);
  recordWarriorAmmoSpend(context, bullets, bullets >= Number(context.ammo?.maximum || skill.ammo || 0));

  if (context.ammo && context.ammo.charges > 1) context.ammo.charges = 1;
  context.replaceEvent(context.action, {
    rechargeReadyAt: context.rechargeStart + Math.max(context.rechargeDuration, context.ammoLockoutDuration)
  });
  for (let hitIndex = 1; hitIndex <= bullets; hitIndex += 1) {
    context.emit({
      type: 'damage',
      at: firstBulletAt + (hitIndex - 1) * bulletInterval,
      source: 'Warrior',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: "Dragon's Roar — Damage per Bullet",
      coefficient: Number(strike?.coefficient || 0.75),
      hits: 1,
      hitIndex,
      totalHits: bullets,
      skillWeapon: 'Pistol',
      damageKind: 'explosion'
    });
  }
}

function performWarriorDodge(context: WarriorCastContext, skill: WarriorSkill): boolean {
  const state = professionCoreState(context);
  const cost = Number(warriorBalanceProfile(context, PROFILE.resources)?.resourceCost || 50);
  state.endurance = Math.max(0, state.endurance - cost);
  state.enduranceUpdatedAt = context.start;
  applyRecklessDodge(context, skill);
  return true;
}

export const warriorCoreSkillHandlers = Object.freeze({
  'warrior.resource': augmentSkillHandler(afterResourceSkill, {
    afterEffect: adjustResourceSkillEffect
  }),
  'warrior.combustive-shot': replaceSkillHandler(useCombustiveShot),
  'warrior.mighty-throw': augmentSkillHandler(null, {
    afterEffect: adjustMightyThrowTarget
  }),
  'warrior.fierce-blow': augmentSkillHandler(null, {
    afterEffect: adjustFierceBlowDamage
  }),
  'warrior.weapon-swap': gw2WeaponSwapSkillHandler,
  'warrior.dragons-roar': replaceSkillHandler(consumeDragonRoarAmmo),
  'warrior.dodge': replaceSkillHandler(performWarriorDodge)
});
