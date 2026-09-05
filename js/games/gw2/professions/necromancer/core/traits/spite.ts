/** Owns imperative Core Necromancer Spite trait behavior for ordered dispatcher calls. */
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { queueTraitCoefficientDamage } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Reports whether resolved player and environment damage has crossed half the configured target health. */
function targetBelowHalfHealth(context: NecromancerResolverContext): boolean {
  const maximum = Number(context.config.target?.health || 0);
  if (!(maximum > 0)) return false;
  return targetHealthLoss(context.config, context) > maximum * 0.5;
}

export function applyReapersMight(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.REAPERS_MIGHT) || !firstHit || !shroudSkillOne) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.reapersMight), 'boon');
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    name: "Reaper's Might",
    skillName: "Reaper's Might",
    kind: String(effect?.boon || 'might'),
    stacks: Number(effect?.stacks ?? 1),
    duration: gw2ResolverBoonDuration(context, event, String(effect?.boon || 'might'), Number(effect?.duration ?? 15)),
    source: 'Trait',
    sourceId: TRAIT.REAPERS_MIGHT,
    actorType: 'effect',
    triggeredBy: event.skillName
  });
  context.recordProc?.('trait', "Reaper's Might", event.at, event.skillName);
}

export function applySiphonedPower(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.SIPHONED_POWER) ||
    !targetBelowHalfHealth(context) ||
    !isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt.siphonedPower || 0))
  )
    return;
  const profile = balanceProfileFromContext(context, PROFILE.siphonedPower);
  const effect = balanceProfileEffect(profile, 'boon');
  professionCoreState(context).traitProcReadyAt.siphonedPower = event.at + Number(profile?.cooldown ?? 1);
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    name: 'Siphoned Power',
    skillName: 'Siphoned Power',
    kind: String(effect?.boon || 'might'),
    stacks: Number(effect?.stacks ?? 3),
    duration: gw2ResolverBoonDuration(context, event, String(effect?.boon || 'might'), Number(effect?.duration ?? 8)),
    source: 'Trait',
    sourceId: TRAIT.SIPHONED_POWER,
    actorType: 'effect',
    triggeredBy: event.skillName
  });
  context.recordProc?.('trait', 'Siphoned Power', event.at, event.skillName);
}

export function applySpitefulFortitude(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  lifeForceMultiplier: number
): void {
  if (!hasTrait(context, TRAIT.SPITEFUL_FORTITUDE) || event.actorType !== 'player' || !targetBelowHalfHealth(context)) {
    return;
  }

  professionCoreState(context).spitefulFortitudeLifeForce =
    Number(professionCoreState(context).spitefulFortitudeLifeForce || 0) +
    Number(balanceProfileFromContext(context, PROFILE.spitefulFortitude)?.lifeForceGain ?? 1) * lifeForceMultiplier;
}

export function applyChillOfDeath(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.CHILL_OF_DEATH) ||
    !targetBelowHalfHealth(context) ||
    !isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt.chillOfDeath || 0))
  )
    return;
  const profile = balanceProfileFromContext(context, PROFILE.chillOfDeath);
  professionCoreState(context).traitProcReadyAt.chillOfDeath = event.at + Number(profile?.cooldown ?? 16);
  const boons = context.config.target?.boonless
    ? 0
    : Math.min(
        3,
        Math.max(
          0,
          Number(
            context.config.target?.boonCount ??
              (Array.isArray(context.config.target?.boons) ? context.config.target.boons.length : 1)
          )
        )
      );
  const coefficient = Number(
    profile?.effects?.filter((effect) => effect.type === 'strike')[boons]?.coefficient ?? [0.6, 0.9, 1.5, 2.1][boons]
  );
  queueTraitCoefficientDamage(context, event, {
    name: 'Lesser Spinal Shivers',
    traitId: TRAIT.CHILL_OF_DEATH,
    coefficient,
    noCrit: true
  });
  enqueueOrdered(context.queue, {
    type: 'necromancer.chill',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.CHILL_OF_DEATH,
    actorType: 'effect',
    skillName: 'Lesser Spinal Shivers',
    duration: Number(balanceProfileEffect(profile, 'condition')?.duration ?? 5)
  });
}

export function applySignetsOfSuffering(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (!skill.categories?.includes('Signet') || !hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING)) return;
  emitSkillDamage(context, skill, {
    at: context.effectiveEnd,
    name: 'Signets of Suffering',
    source: 'Trait',
    sourceId: TRAIT.SIGNETS_OF_SUFFERING,
    actorType: 'effect',
    coefficient: 0,
    skillWeapon: 'Unequipped',
    flatStrikeBase: 1413,
    noCrit: true,
    damageKind: 'life-steal'
  });
}

export function applyMaliciousSwarm(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  if (
    skill.type !== 'Heal' ||
    !hasTrait(context, TRAIT.MALICIOUS_SWARM) ||
    !isInternalCooldownReady(context.effectiveEnd, Number(state.traitProcReadyAt.maliciousSwarm || 0))
  )
    return;
  state.traitProcReadyAt.maliciousSwarm = context.effectiveEnd + 15;
  emitSkillDamage(context, skill, {
    at: context.effectiveEnd,
    name: 'Lesser Signet of the Locust',
    source: 'Trait',
    sourceId: TRAIT.MALICIOUS_SWARM,
    actorType: 'effect',
    coefficient: 1,
    skillWeapon: 'Unequipped'
  });
}
