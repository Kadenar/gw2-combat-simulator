/** Registers scheduler-phase skill activations for this module. */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import { recordWarriorAmmoSpend } from '#gw2/content/professions/warrior/ammunition.js';
import { applyWarriorSkillResource } from '#gw2/content/professions/warrior/resources.js';
import {
  applyWarriorBurstSpendTraits,
  applyRecklessDodge,
  grantBerserkersPowerOnFirstHit
} from '#gw2/content/professions/warrior/core/traits/index.js';
import type {
  WarriorCastContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';
import {
  warriorBalanceProfile,
  warriorBalanceProfileEffect,
  WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/content/professions/warrior/core/profiles.js';

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

// Use the adrenaline snapshot captured before effects to grant first-hit traits
// once and replace tiered Eviscerate and Kill Shot packets with their correct values.
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

  if (event.type !== 'damage' || !(Number(event.coefficient) > 0)) {
    return;
  }

  const tier = burstTier(context, spent);
  if (skill.name === 'Kill Shot') {
    context.replaceEvent(event, {
      coefficient: [2.25, 2.75, 3.25][tier - 1],
      name: `Kill Shot — Level ${tier} Damage`
    });
    return;
  }

  if (skill.id !== ID.EVISCERATE) return;
  const variantId = [PROFILE.eviscerateTier1, PROFILE.eviscerateTier2, PROFILE.eviscerateTier3][tier - 1];
  const strike = warriorBalanceProfileEffect(warriorBalanceProfile(context, variantId), 'strike');
  context.replaceEvent(event, {
    coefficient: Number(strike?.coefficient || [2, 2.5, 3][tier - 1]),
    name: `Eviscerate — Level ${tier} Damage`
  });
}

// Spend burst resources, scale the fire field and pulse count by burst tier, and
// grant first-hit Berserker's Power from the earliest persistent pulse.
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
    const damage = emitSkillDamage(context, {
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
    })[0];
    if (
      !resource.berserkersPowerGranted &&
      grantBerserkersPowerOnFirstHit(context, skill, damage as WarriorSimulationEvent, resource.spent)
    ) {
      resource.berserkersPowerGranted = true;
    }

    emitSkillCondition(context, {
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

// Consume Dragon's Roar's available ammo snapshot and scale its committed packet
// count without disturbing count-recharge progress.
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
    emitSkillDamage(context, {
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
  Object.assign(state, spendEndurance(state, cost, context.start, state.maximumEndurance));
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
