import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { emitNecromancerShroudTrait } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerConfig,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** The accepted player strike reads post-hit target health before its shared percentage grant. */
export function spitefulFortitudeLifeForce(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.SPITEFUL_FORTITUDE) && targetBelowHalfHealth(runtime)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SPITEFUL_FORTITUDE), 'lifeForceGain')
    : 0;
}

/** Reports whether the target is strictly below half health, using the shared threshold contract. */
function targetBelowHalfHealth(context: NecromancerResolverContext): boolean {
  return context.combat.targetHealthBelow(0.5);
}

export function applyReapersMight(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.REAPERS_MIGHT) || !firstHit || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.REAPERS_MIGHT);
  const effect = requireEffect(profile, 'boon', 'might');
  // The proc record reports only a delivered boon.
  if (!effect) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverBuff({
      at: event.at,

      skillName: "Reaper's Might",
      kind: String(effect.boon),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration'),
      source: 'Trait',
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: 'effect',
      triggeredBy: event.skillName
    }),
    durationContext: event
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: "Reaper's Might", at: event.at, sourceSkill: event.skillName }
  });
}

export function applySiphonedPower(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.SIPHONED_POWER) || !targetBelowHalfHealth(context)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.SIPHONED_POWER);
  const effect = requireEffect(profile, 'boon', 'might');
  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // might, so a removed boon leaves it ready.
  if (!effect || !context.procs.claimCooldown('siphonedPower', event.at, balanceProfileNumber(profile, 'cooldown')))
    return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverBuff({
      at: event.at,

      skillName: 'Siphoned Power',
      kind: String(effect.boon),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration'),
      source: 'Trait',
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: 'effect',
      triggeredBy: event.skillName
    }),
    durationContext: event
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Siphoned Power', at: event.at, sourceSkill: event.skillName }
  });
}

export function applyChillOfDeath(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.CHILL_OF_DEATH) || !targetBelowHalfHealth(context)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILL_OF_DEATH);
  // No target boons can be removed, so use only the zero-boon strike profile.
  const strike = requireEffect(profile, 'strike', 'Lesser Spinal Shivers - No Boons');
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  // Claim only after local eligibility, before conditions, resources or queued strikes; with both packets removed
  // there is no proc to gate.
  if (
    (!strike && !chilled) ||
    !context.procs.claimCooldown('chillOfDeath', event.at, balanceProfileNumber(profile, 'cooldown'))
  )
    return;
  if (strike) {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ context.effects.emit({
      kind: 'packet',
      event: {
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.CHILL_OF_DEATH,
        actorType: 'effect',
        skillName: 'Lesser Spinal Shivers',
        triggeredBy: event.skillName,
        type: 'damage',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        skillWeapon: 'Unequipped',
        canCrit: false,
        hits: 1,
        ...(event.summonOwner ? { summonOwner: event.summonOwner } : {})
      }
    });
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Lesser Spinal Shivers', at: event.at, sourceSkill: event.skillName }
    });
  }
  // Without its strike, Chill has no resolved hit to follow and applies at the trigger instead.
  else if (chilled) queueChillOfDeathCondition(context, event, profile, chilled);
}

function queueChillOfDeathCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  profile: BalanceProfile,
  chilled: ConditionEffect
): void {
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      condition: String(chilled.condition),
      stacks: effectNumber(profile, chilled, 'stacks'),
      name: 'Lesser Spinal Shivers — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILL_OF_DEATH,
      actorType: 'effect',
      skillName: 'Lesser Spinal Shivers',
      duration: effectNumber(profile, chilled, 'duration')
    })
  });
}

/** Queue Chill from the resolved trait strike so sibling strikes keep their pre-Chill state. */
export function applyChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType !== 'effect' || event.sourceId !== TRAIT.CHILL_OF_DEATH) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILL_OF_DEATH);
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  if (chilled) queueChillOfDeathCondition(context, event, profile, chilled);
}

/** Applies Awaken the Pain at the original attribute-conversion position. */
export function modifyAwakenThePainAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    const awakenThePainProfile = requireBalanceProfileFromContext(context, TRAIT.AWAKEN_THE_PAIN);
    const perStack = balanceProfileNumber(awakenThePainProfile, 'attributePerStack');
    result.power += (context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) * perStack;
  }
}

/** Applies Spiteful Fortitude at the original attribute-conversion position. */
export function modifySpitefulFortitudeAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.SPITEFUL_FORTITUDE)) {
    const spitefulFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.SPITEFUL_FORTITUDE);
    result.vitality +=
      (context.config?.stats?.power || 0) * balanceProfileNumber(spitefulFortitudeProfile, 'attributeConversion');
  }
}

/** Emits awaken the pain at the ordered post-entry boundary. */
export function enterAwakenThePain(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.AWAKEN_THE_PAIN);
}

/** Emits spiteful spirit at the ordered post-entry boundary. */
export function enterSpitefulSpirit(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.SPITEFUL_SPIRIT);
}

/** Capacity calculation uses the same common Power conversion as static attribute calculation. */
export function spitefulFortitudeVitality(config: NecromancerConfig, balanceContext: unknown): number {
  return hasTrait(config, TRAIT.SPITEFUL_FORTITUDE)
    ? (config.stats?.power ?? 1000) *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.SPITEFUL_FORTITUDE),
          'attributeConversion'
        )
    : 0;
}

/** Selected signet passives remain active during shroud even while their skill recharges. */
export function signetsOfSufferingPassive(runtime: NecromancerRuntime, inShroud: boolean): boolean {
  return hasTrait(runtime, TRAIT.SIGNETS_OF_SUFFERING) && inShroud;
}

export function applyBitterChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition !== 'Chilled' || !hasTrait(context, TRAIT.BITTER_CHILL)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.BITTER_CHILL);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: event.at,
      name: 'Bitter Chill',
      skillName: 'Bitter Chill',
      condition: String(vulnerability.condition),
      stacks: effectNumber(profile, vulnerability, 'stacks'),
      duration: effectNumber(profile, vulnerability, 'duration'),
      source: 'Trait',
      sourceId: TRAIT.BITTER_CHILL,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Bitter Chill', at: event.at, sourceSkill: event.skillName }
  });
}

/** Fear refreshes the existing observation window; Dread's selected modifier decides whether it contributes. */
export function applyDreadWindow(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition === 'Fear' && hasTrait(context, TRAIT.DREAD)) {
    context.effects.emit({
      kind: 'packet',
      cause: event,
      settlement: 'reaction',
      event: {
        type: 'buff',
        kind: 'necromancer-dread',
        at: event.at,
        duration: 3,
        stacks: 1,
        source: 'Trait',
        sourceId: TRAIT.DREAD,
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Dread',
        skillName: 'Dread',
        audience: { recipients: 'self' }
      }
    });
  }
}
