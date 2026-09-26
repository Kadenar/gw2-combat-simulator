import { expireCharges } from '#gw2/platform/combat/resources/charges.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireEffect,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import {
  addSoulShards,
  consumeSoulShards,
  necromancerActiveBoonCompanionIds
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/live.js';
import { reactToNecromancerAxeHealth } from '#gw2/professions/necromancer/core/mechanics/axe.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

const SHARD_EXPIRY = 'necromancer.soul-shards-expire';

/** A refresh extends the actual grant; an older expiry cannot erase shards gained later. */
function grantShards(runtime: NecromancerRuntime, amount: number): void {
  addSoulShards(runtime.profession.core, amount, runtime.time);
  runtime.schedule(SHARD_EXPIRY, runtime.profession.core.soulShardGrant.expiresAt, null, undefined, -20);
}

/** Only Addle's activation gate is captured; resource consumption and target state stay live at impact. */
export function modifyNecromancerWeaponEffects(
  runtime: NecromancerRuntime,
  cast: RuntimeCast,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (cast.skill.id !== ID.ADDLE) return effects;
  const grant = runtime.profession.core.soulShardGrant;
  const immobilize = grant.charges >= 3 && grant.expiresAt > runtime.time;
  return effects.map((effect) =>
    effect.type === 'strike'
      ? { ...effect, metadata: { ...effect.metadata, necromancerAddleImmobilize: immobilize } }
      : effect
  );
}

/** The consumed shard emits an independent siphon through the shared formula and cannot recursively consume another shard. */
function perforate(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!consumeSoulShards(runtime.profession.core, 1, runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.soulShards);
  const strike = requireEffect(profile, 'strike', 'Soul Shards');
  if (!strike) return;
  runtime.emitDerived(
    event,
    buildResolverStrike({
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.SOUL_SHARDS,
      actorType: 'effect',
      skillId: ID.SOUL_SHARDS,
      skillName: 'Soul Shards',
      parentSkillName: event.skillName,
      icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png',
      coefficient: 0,
      skillWeapon: 'Unequipped',
      flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
      flatStrikeMultiplier:
        hasTrait(runtime, TRAIT.SOUL_BARBS) &&
        runtime.query.timeline.timedActive('necromancer-soul-barbs', runtime.time)
          ? 1.1
          : 1,
      flatStrikeHealthThreshold: balanceProfileNumber(profile, 'threshold'),
      flatStrikeThresholdMultiplier: balanceProfileNumber(profile, 'damageMultiplier'),
      noCrit: strike.noCrit === true,
      damageKind: String(strike.damageKind || '')
    })
  );
}

/** Landed weapon packets own shard gains and consumption, half-health bonuses, and condition-count rewards. */
export function reactToNecromancerWeapons(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  reactToNecromancerAxeHealth(runtime, event);
  if (event.skillId === ID.PERFORATE) perforate(runtime, event);
  if (Number(event.hitIndex ?? 1) !== 1) return;
  if (event.skillId === ID.DEADLY_SLICE || event.skillId === ID.SINISTER_STAB) grantShards(runtime, 1);
  else if (event.skillId === ID.EXTIRPATE) grantShards(runtime, 2);
  else if (event.skillId === ID.ADDLE) {
    runtime.emitDerived(event, {
      type: 'control',
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.ADDLE,
      actorType: 'player',
      skillId: ID.ADDLE,
      skillName: event.skillName,
      controlKind: 'daze'
    });
    if (event.metadata?.necromancerAddleImmobilize)
      runtime.emitDerived(
        event,
        buildResolverCondition({
          at: runtime.time,
          source: 'necromancer',
          sourceId: ID.ADDLE,
          actorType: 'player',
          skillId: ID.ADDLE,
          skillName: event.skillName,
          condition: 'Immobilized',
          stacks: 1,
          duration: 1.5
        })
      );
    const bonus = Boolean(runtime.config.target?.defiant || runtime.config.target?.activatingSkills);
    if (bonus) grantNecromancerLifeForce(runtime, 10);
    grantShards(runtime, bonus ? 4 : 2);
  } else if (event.skillId === ID.OPPRESSIVE_COLLAPSE) {
    const stacks =
      2 *
      Math.min(7, targetConditionCount({ config: runtime.config, query: runtime.query, runtime, time: runtime.time }));
    if (!stacks) return;
    const boon = {
      type: 'buff' as const,
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.OPPRESSIVE_COLLAPSE,
      actorType: 'player' as const,
      skillId: ID.OPPRESSIVE_COLLAPSE,
      skillName: event.skillName,
      activationId: event.activationId,
      kind: 'might',
      stacks,
      duration: 8,
      audience: {
        recipients: 'party' as const,
        maximumRecipients: 5,
        eligibleCompanionIds: necromancerActiveBoonCompanionIds(runtime)
      }
    };
    queueResolverBoon(runtime, event, boon);
  }
}

/** Distress is a self transition: completing it refreshes Perforate and grants the single-target shard allowance. */
export function completeNecromancerWeapon(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  if (cast.skill.id !== ID.DISTRESS) return;
  runtime.cooldownController.clear(ID.PERFORATE);
  grantShards(runtime, 6);
}

export const liveWeaponTasks = {
  [SHARD_EXPIRY](runtime: NecromancerRuntime) {
    expireCharges(runtime.profession.core.soulShardGrant, runtime.time);
  }
};
