import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { expireCharges } from '#gw2/platform/combat/resources/charges.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  addSoulShards,
  consumeSoulShards,
  necromancerActiveBoonCompanionIds
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { soulBarbsSiphonMultiplier } from '#gw2/professions/necromancer/core/traits/shroud.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

const SHARD_EXPIRY = 'necromancer.soul-shards-expire';

/** A refresh extends the actual grant; an older expiry cannot erase shards gained later. */
export function grantNecromancerSoulShards(runtime: NecromancerRuntime, amount: number): void {
  addSoulShards(runtime.profession.core, amount, runtime.time);
  runtime.schedule(SHARD_EXPIRY, runtime.profession.core.soulShardGrant.expiresAt, null, undefined, -20);
}

/** The consumed shard emits an independent siphon through the shared formula and cannot recursively consume another shard. */
export function perforate(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!consumeSoulShards(runtime.profession.core, 1, runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.soulShards);
  const strike = requireEffect(profile, 'strike', 'Soul Shards');
  if (!strike) return;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.SOUL_SHARDS,
      actorType: 'effect',
      skillId: ID.SOUL_SHARDS,
      skillName: 'Soul Shards',
      // The consumed shard owns its siphon even when a weapon hit supplies the causal parent.
      procType: 'profession',
      parentSkillName: event.skillName,
      icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png',
      coefficient: 0,
      skillWeapon: 'Unequipped',
      flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
      flatStrikeMultiplier: soulBarbsSiphonMultiplier(runtime),
      flatStrikeHealthThreshold: balanceProfileNumber(profile, 'threshold'),
      flatStrikeThresholdMultiplier: balanceProfileNumber(profile, 'damageMultiplier'),
      canCrit: strike.canCrit !== false,
      damageKind: strike.damageKind || ''
    })
  });
}

/** Party Might samples live conditions and companion eligibility at the accepted impact. */
export function resolveNecromancerOppressiveCollapse(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
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
  runtime.effects.emit({ kind: 'packet', event: boon, durationContext: event });
}

export const necromancerWeaponTasks = {
  [SHARD_EXPIRY](runtime: NecromancerRuntime) {
    expireCharges(runtime.profession.core.soulShardGrant, runtime.time);
  }
};
