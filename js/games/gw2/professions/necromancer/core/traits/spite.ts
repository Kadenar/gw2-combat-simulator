import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
/** Owns imperative Core Necromancer Spite trait behavior for ordered dispatcher calls. */
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
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
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,

      skillName: "Reaper's Might",
      kind: String(effect?.boon || 'might'),
      stacks: Number(effect?.stacks ?? 1),
      duration: Number(effect?.duration ?? 15),
      source: 'Trait',
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc?.('trait', "Reaper's Might", event.at, event.skillName);
}

export function applySiphonedPower(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.SIPHONED_POWER) || !targetBelowHalfHealth(context)) return;
  const profile = balanceProfileFromContext(context, PROFILE.siphonedPower);
  const effect = balanceProfileEffect(profile, 'boon');
  // Claim only after local eligibility, before conditions, resources or queued strikes.
  if (
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'siphonedPower',
      event.at,
      Number(profile?.cooldown ?? 1)
    )
  )
    return;
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,

      skillName: 'Siphoned Power',
      kind: String(effect?.boon || 'might'),
      stacks: Number(effect?.stacks ?? 3),
      duration: Number(effect?.duration ?? 8),
      source: 'Trait',
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc?.('trait', 'Siphoned Power', event.at, event.skillName);
}

export function applySpitefulFortitude(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.SPITEFUL_FORTITUDE) || event.actorType !== 'player' || !targetBelowHalfHealth(context)) {
    return;
  }

  // Replay raw percentage gains at the strike timestamp; the scheduler owns normalization, Gluttony, and capping.
  context.resolved.push({
    type: 'necromancer.life-force-gain',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.SPITEFUL_FORTITUDE,
    actorType: 'effect',
    amount: Number(balanceProfileFromContext(context, PROFILE.spitefulFortitude)?.lifeForceGain ?? 1)
  });
}

export function applyChillOfDeath(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.CHILL_OF_DEATH) || !targetBelowHalfHealth(context)) return;
  const profile = balanceProfileFromContext(context, PROFILE.chillOfDeath);
  // Claim only after local eligibility, before conditions, resources or queued strikes.
  if (
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'chillOfDeath',
      event.at,
      Number(profile?.cooldown ?? 16)
    )
  )
    return;
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
}

/** Queue Chill from the resolved trait strike so sibling strikes keep their pre-Chill state. */
export function applyChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType !== 'effect' || event.sourceId !== TRAIT.CHILL_OF_DEATH) return;
  const profile = balanceProfileFromContext(context, PROFILE.chillOfDeath);
  context.queue.enqueue(
    buildResolverCondition({
      condition: 'Chilled',
      stacks: 1,
      name: 'Lesser Spinal Shivers — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILL_OF_DEATH,
      actorType: 'effect',
      skillName: 'Lesser Spinal Shivers',
      duration: Number(balanceProfileEffect(profile, 'condition')?.duration ?? 5)
    })
  );
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
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.MALICIOUS_SWARM)) return;
  // Claim only after local eligibility, before conditions, resources or queued strikes.
  if (!tryConsumeProcCooldown(state.traitProcReadyAt, 'maliciousSwarm', context.effectiveEnd, 15)) return;
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
