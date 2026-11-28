/**
 * Shared live Carapace, Soul Shard, and creature-summon operations.
 * Specializations register creature reactions without coupling Core to their mechanics.
 */
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { consumeCharge, refreshChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { SkillSource } from '#gw2/platform/skills/balance-profiles.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import { purgeExpiredBatch } from '#kernel/resources/batch.js';
import { purgeExpiredStacks } from '#kernel/resources/timed-stacks.js';

const SOUL_SHARD_DURATION_SECONDS = 10;

/** The selected canonical siphon owns whole-stack capacity for both combat grants and presentation. */
export function necromancerSoulShardMaximum(source: SkillSource): number {
  return Math.max(0, Math.trunc(skillNumber(requireSkill(source, ID.SOUL_SHARDS), 'maximumStacks')));
}

/** Returns stable identities for minions eligible to receive shared effects. */
export function necromancerActiveMinionCompanionIds(
  context: Pick<NecromancerRuntime, 'profession'>
): readonly string[] {
  const core = professionCoreState(context.profession);
  const companionIds: string[] = [];
  for (const [key, count] of Object.entries(core.activeMinions)) {
    for (let index = 0; index < (count || 0); index += 1) {
      companionIds.push(`minion:${key}:${index}`);
    }
  }

  return Object.freeze(companionIds);
}

/** Includes every active Necromancer summon that can compete for a shared boon slot. */
export function necromancerActiveBoonCompanionIds(context: Pick<NecromancerRuntime, 'profession'>): readonly string[] {
  const runtime = context.profession;
  // A spirit is active exactly when it appears in the live actor map.
  const spiritIds = Object.keys(
    runtime.specialization.kind === 'Ritualist' ? runtime.specialization.state.activeSpirits : {}
  ).map((key) => `spirit:${key}`);
  return Object.freeze([...necromancerActiveMinionCompanionIds(context), ...spiritIds]);
}

/** Expires timed carapace and Soul Shard stacks, then synchronizes their public resource values. */
export function purgeTimedState(state: NecromancerCoreState, at: number): void {
  state.carapaceExpiries = purgeExpiredStacks(state.carapaceExpiries, at);
  purgeExpiredBatch(state.soulShardGrant, at);
}

/** Refreshes existing Soul Shards and admits new charges up to the selected capacity. */
export function addSoulShards(state: NecromancerCoreState, stacks: number, at: number, maximum: number): void {
  purgeTimedState(state, at);
  state.soulShardGrant.count = Math.min(state.soulShardGrant.count, maximum);
  // Refresh the shared deadline even at the cap, adding only the newly admitted shards.
  const added = boundedInteger(stacks, 0, 0, maximum - state.soulShardGrant.count);
  // The stored deadline must equal the queue's canonical timestamp so exact expiry cannot leave floating-point residue.
  state.soulShardGrant = refreshChargeGrant(state.soulShardGrant, added, gw2Time(at + SOUL_SHARD_DURATION_SECONDS), at);
}

/** Perforate spends one live Soul Shard per trigger. */
export function consumeSoulShard(state: NecromancerCoreState, at: number): boolean {
  purgeTimedState(state, at);
  return consumeCharge(state.soulShardGrant, at);
}

/** Preserve the existing ordered rewards at the accepted creature-summoned boundary. */
export const creatureSummoned = defineTriggerPoint<{
  readonly skill: NecromancerSkill;
  readonly at: number;
  readonly count: number;
  readonly activationId: string | undefined;
}>('necromancer.creature-summoned', [TRAIT.BOON_OF_CREATION, TRAIT.EXPLOSIVE_GROWTH]);

// One active elite may supply a pure creature value policy; summon reactions use compiled points above.
const creatureStrikeScaling = new WeakMap<NecromancerRuntime, () => number>();

/** Install the selected specialization's scalar query without subscribing a trait reaction. */
export function setNecromancerCreatureStrikeScaling(runtime: NecromancerRuntime, scaling: () => number): void {
  creatureStrikeScaling.set(runtime, scaling);
}

/** Core creatures sample their active specialization's scalar when committing an attack. */
export function necromancerCreatureStrikeMultiplier(runtime: NecromancerRuntime): number {
  return creatureStrikeScaling.get(runtime)?.() ?? 1;
}

/** Shares party effects with up to five recipients, including only active minion companions. */
export function necromancerPartyAudience(runtime: NecromancerRuntime) {
  return {
    recipients: RECIPIENT.PARTY,
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
  };
}
