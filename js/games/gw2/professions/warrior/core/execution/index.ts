import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { scheduleDeclarativeEffects } from '#gw2/platform/execution/effect-adapter.js';

import { consumeSkillFlip, armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
/** Registers scheduler-phase skill activations for this module. */

import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { applyWarriorSkillResource, recordWarriorAmmoSpend } from '#gw2/professions/warrior/family-state.js';
import {
  applyWarriorBurstSpendTraits,
  applyRecklessDodge,
  grantBerserkersPowerOnFirstHit
} from '#gw2/professions/warrior/core/traits/index.js';
import type { WarriorCastContext, WarriorSimulationEvent, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';

function burstTier(context: WarriorCastContext, spent: number): number {
  const burstTiersProfile = requireBalanceProfileFromContext(context, PROFILE.burstTiers);
  return spent >= balanceProfileNumber(burstTiersProfile, 'maximumStacks')
    ? 3
    : spent >= balanceProfileNumber(burstTiersProfile, 'threshold')
      ? 2
      : 1;
}

function afterResourceSkill(
  context: WarriorCastContext,
  skill: WarriorSkill
): { spent: number; berserkersPowerGranted: boolean } {
  // Attempting the manual counter consumes the armed flip, including interrupted attacks.
  if (skill.id === ID.TACTICAL_BLOW) consumeSkillFlip(professionCoreState(context).availableFlips, ID.TACTICAL_BLOW);
  const spent = applyWarriorSkillResource(context, skill);
  applyWarriorBurstSpendTraits(context, skill, spent);
  return { spent, berserkersPowerGranted: false };
}

// Use the pre-effect adrenaline snapshot for first-hit traits, tiered packets,
// and Arcing Slice's tier-scaled Fury duration.
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

  if (skill.id === ID.ARCING_SLICE && event.type === 'buff' && event.kind === 'fury') {
    context.replaceEvent(event, { duration: Number(event.duration) * [1, 1.5, 2][burstTier(context, spent) - 1] });
  }

  if (event.type !== 'damage' || !(Number(event.coefficient) > 0)) {
    return;
  }

  const tier = burstTier(context, spent);
  if (skill.id === ID.KILL_SHOT) {
    // Tier scaling must preserve the coefficient emitted from the active skill patch.
    context.replaceEvent(event, {
      coefficient: Number(event.coefficient) * ([2.25, 2.75, 3.25][tier - 1] / 2.25),
      name: `Kill Shot — Level ${tier} Damage`
    });
    return;
  }
}

// Resolve tier replacements before emission so removed packets cannot create hits or trigger traits.
function useResourceSkill(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = afterResourceSkill(context, skill);
  const tier = burstTier(context, state.spent);
  let effects = skill.effects || [];
  // Read each selected tier once, then reuse its values for all matching skill packets.
  if (
    skill.id === ID.BLOODTHIRSTER &&
    effects.some((effect) => effect.type === 'condition' && effect.condition === 'Bleeding')
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.bloodthirsterTiers);
    const bleeding = requireEffect(profile, 'condition', `Tier ${tier}`);
    const values = bleeding && {
      stacks: effectNumber(profile, bleeding, 'stacks'),
      duration: effectNumber(profile, bleeding, 'duration')
    };
    effects = effects.flatMap<(typeof effects)[number]>((effect) =>
      effect.type === 'condition' && effect.condition === 'Bleeding'
        ? values
          ? [{ ...effect, ...values }]
          : []
        : [effect]
    );
  } else if (skill.id === ID.EVISCERATE && effects.some((effect) => effect.type === 'strike')) {
    const variantId = [PROFILE.eviscerateTier1, PROFILE.eviscerateTier2, PROFILE.eviscerateTier3][tier - 1];
    const profile = requireBalanceProfileFromContext(context, variantId);
    const strike = requireEffect(profile, 'strike', 'Strike');
    const values = strike && {
      coefficient: effectNumber(profile, strike, 'coefficient'),
      name: `Eviscerate — Level ${tier} Damage`
    };
    effects = effects.flatMap<(typeof effects)[number]>((effect) =>
      effect.type === 'strike' ? (values ? [{ ...effect, ...values }] : []) : [effect]
    );
  }

  scheduleDeclarativeEffects(
    context,
    { ...skill, effects },
    context.reservationId,
    context.start,
    context.fullEnd,
    context.effectiveEnd,
    (event) => adjustResourceSkillEffect(context, skill, event, state)
  );
}

// Spend burst resources, scale the fire field and pulse count by burst tier, and
// grant first-hit Berserker's Power from the earliest persistent pulse.
function useCombustiveShot(context: WarriorCastContext, skill: WarriorSkill): void {
  const resource = afterResourceSkill(context, skill);
  const tier = burstTier(context, resource.spent);
  const pulses = tier + 1;

  const combustiveShotProfile = requireBalanceProfileFromContext(context, PROFILE.combustiveShot);
  const strike = requireEffect(combustiveShotProfile, 'strike', 'Strike');
  const burning = requireEffect(combustiveShotProfile, 'condition', 'Burning');
  const interval = balanceProfileNumber(combustiveShotProfile, 'pulseInterval');
  const durationPerTier = balanceProfileNumber(combustiveShotProfile, 'durationPerTier');
  // Pulses share one validated packet snapshot; removed components remain absent.
  const coefficient = strike && effectNumber(combustiveShotProfile, strike, 'coefficient');
  const burningValues = burning && {
    stacks: effectNumber(combustiveShotProfile, burning, 'stacks'),
    duration: effectNumber(combustiveShotProfile, burning, 'duration')
  };
  const ownedField = skill.comboFields?.find((field) => field.ownerId === 'warrior');
  context.replaceEvent(context.action, {
    burstTier: tier,
    ...(ownedField ? { comboFields: [{ ...ownedField, duration: tier * durationPerTier }] } : {})
  });
  for (let pulse = 0; pulse < (interval > 0 ? pulses : 1); pulse += 1) {
    const at = context.fullEnd + pulse * interval;
    if (coefficient !== undefined) {
      const damage = emitSkillDamage(context, {
        at,
        source: 'Warrior',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} - Level ${tier} Damage`,
        coefficient,
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
    }

    if (burning && burningValues)
      emitSkillCondition(context, {
        skill,
        at,
        source: 'Warrior',
        name: `${skill.name} - Burning`,
        condition: String(burning.condition),
        ...burningValues,
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
  // Shards only hit secondary enemies, which this single-target simulation excludes.
  if (event.metadata?.packetKind === 'warrior.mighty-throw-shard') {
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

  // Apply the controlled-target bonus to the patched strike, rather than replacing it.
  context.replaceEvent(event, {
    coefficient: Number(event.coefficient) * 1.5,
    name: 'Fierce Blow — Damage to Controlled or Defiant Foes'
  });
}

// Consume Dragon's Roar's available ammo snapshot and scale its committed packet
// count without disturbing count-recharge progress.
function consumeDragonRoarAmmo(context: WarriorCastContext, skill: WarriorSkill): void {
  const bullets = Math.max(1, Number(context.ammo?.charges || 1));

  const dragonsRoarProfile = requireBalanceProfileFromContext(context, PROFILE.dragonsRoar);
  const strike = requireEffect(dragonsRoarProfile, 'strike', 'Strike');
  const castDuration = Math.max(0, context.effectiveEnd - context.start);
  const firstBulletAt = context.start + castDuration * balanceProfileNumber(dragonsRoarProfile, 'firstPacketRatio');
  const bulletInterval = castDuration * balanceProfileNumber(dragonsRoarProfile, 'packetIntervalRatio');
  recordWarriorAmmoSpend(context, bullets, bullets >= Number(context.ammo?.maximum || skill.ammo || 0));

  if (context.ammo && context.ammo.charges > 1) context.ammo.charges = 1;
  context.replaceEvent(context.action, {
    rechargeReadyAt: context.rechargeStart + Math.max(context.rechargeDuration, context.ammoLockoutDuration)
  });
  if (!strike) return;
  // Ammunition changes the packet count, not the coefficient read from this profile.
  const coefficient = effectNumber(dragonsRoarProfile, strike, 'coefficient');
  for (let hitIndex = 1; hitIndex <= bullets; hitIndex += 1) {
    emitSkillDamage(context, {
      at: firstBulletAt + (hitIndex - 1) * bulletInterval,
      source: 'Warrior',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: "Dragon's Roar — Damage per Bullet",
      coefficient,
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
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const cost = balanceProfileNumber(resourcesProfile, 'resourceCost');
  Object.assign(state, spendEndurance(state, cost, context.start, state.maximumEndurance));
  applyRecklessDodge(context, skill);
  return true;
}

export const warriorCoreSkillHandlers = Object.freeze({
  'warrior.counterblow': augmentSkillHandler((context: WarriorCastContext) => {
    // Keep the manual attack available only within the original block channel, even when released early.
    if (!context.action.cancelled) {
      armSkillFlip(professionCoreState(context).availableFlips, ID.TACTICAL_BLOW, context.start, context.fullEnd);
    }
  }),
  'warrior.resource': replaceSkillHandler(useResourceSkill),
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
