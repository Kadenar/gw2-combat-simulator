import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

// Separate from the pool policy in resources.ts: passives grant life force while that policy reads passive timing.

/** Grants accepted outcomes directly to the current pool, applying percentage capacity and Gluttony once. */
export function grantNecromancerLifeForce(runtime: NecromancerRuntime, percent: number): void {
  if (!(percent > 0)) return;
  const multiplier = hasTrait(runtime, TRAIT.GLUTTONY)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.GLUTTONY), 'lifeForceGainMultiplier')
    : 1;
  runtime.resourceController.grant(
    'lifeForce',
    ((percent * runtime.profession.core.lifeForce.maximum) / 100) * multiplier
  );
}

/** Selected strikes and conditions grant live skill tuning; target counts can be snapshotted by their emitter. */
export function grantNecromancerSkillLifeForce(
  runtime: NecromancerRuntime,
  skill: Skill,
  event: Gw2ResolverEvent
): void {
  let amount = Number(
    skill.lifeForceGain ?? skill.lifeForcePerHit ?? skill.lifeForcePerPulse ?? skill.lifeForceOnHit ?? 0
  );
  if (Number(skill.lifeForcePerCondition) > 0) {
    const count = Number(
      event.metadata?.necromancerConditionCount ??
        targetConditionCount({ config: runtime.config, query: runtime.query, runtime, time: runtime.time })
    );
    amount += Math.min(Number(skill.maximumConditions), count) * Number(skill.lifeForcePerCondition);
  }

  grantNecromancerLifeForce(runtime, amount);
}
