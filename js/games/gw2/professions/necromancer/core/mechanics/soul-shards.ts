import { ACTOR } from '#gw2/platform/constants.js';
import { expireCharges } from '#gw2/platform/combat/resources/charges.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireSkillFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  addSoulShards,
  consumeSoulShards,
  necromancerSoulShardMaximum
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

const SHARD_EXPIRY = 'necromancer.soul-shards-expire';

/** A refresh extends the actual grant; an older expiry cannot erase shards gained later. */
export function grantNecromancerSoulShards(runtime: NecromancerRuntime, amount: number): void {
  addSoulShards(runtime.profession.core, amount, runtime.time, necromancerSoulShardMaximum(runtime));
  runtime.schedule(SHARD_EXPIRY, runtime.profession.core.soulShardGrant.expiresAt, null, undefined, -20);
}

/** The consumed shard emits an independent siphon through the shared formula and cannot recursively consume another shard. */
export function perforate(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!consumeSoulShards(runtime.profession.core, 1, runtime.time)) return;

  emitSoulShard(runtime, event);
}

/** One shard's payload is shared with the conditional calculator. */
export function emitSoulShard(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.soulShards);
  const skill = requireSkillFromContext(runtime, ID.SOUL_SHARDS);
  const strike = requireEffect(skill, 'strike', 'Soul Shards');

  if (!strike) return;

  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.SOUL_SHARDS,
      actorType: ACTOR.EFFECT,
      skillId: ID.SOUL_SHARDS,
      skillName: 'Soul Shards',
      // The consumed shard owns its siphon even when a weapon hit supplies the causal parent.
      procType: 'profession',
      parentSkillName: event.skillName,
      icon: new URL('@images/wiki/soul-shards.png', import.meta.url).href,
      coefficient: 0,
      skillWeapon: 'Unequipped',
      flatStrikeBase: effectNumber(skill, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(skill, strike, 'flatStrikePowerCoeff'),
      flatStrikeMultiplier: soulBarbsSiphonMultiplier(runtime),
      flatStrikeHealthThreshold: balanceProfileNumber(profile, 'threshold'),
      flatStrikeThresholdMultiplier: balanceProfileNumber(profile, 'damageMultiplier'),
      canCrit: strike.canCrit !== false,
      damageKind: strike.damageKind || ''
    })
  });
}

/** Expire only the current Soul Shards grant so stale scheduled tasks cannot clear refreshed charges. */
const soulShardTasks = {
  [SHARD_EXPIRY](runtime: NecromancerRuntime) {
    expireCharges(runtime.profession.core.soulShardGrant, runtime.time);
  }
};

/** Registers soul shard tasks with the Core hook assembly. */
export const soulShardLifecycle = {
  tasks: soulShardTasks
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;

/** Siphon packets apply the same active Soul Barbs window outside ordinary strike modifiers. */
function soulBarbsSiphonMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.SOUL_BARBS) &&
    runtime.combat.activeBuffStacks('necromancer-soul-barbs', runtime.time, 1) > 0
    ? 1 + balanceNumberFromContext(runtime, TRAIT.SOUL_BARBS, 'damageIncrease')
    : 1;
}
