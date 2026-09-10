import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/**
 * Handlers for necromancer events pulled off the scheduler/resolver queue.
 *
 *   - `handleNecromancerStateEvent` reconciles the resolver's profession state
 *     with the snapshot carried on a `necromancer.state` event, restoring
 *     scheduler-owned fields while preserving resolver fields and merging carapace
 *     stacks (see mergeExpiryStacks).
 *   - `handleNecromancerSummonAttack` materializes a queued minion
 *     autoattack into a damage event, dropping it if the summon has expired.
 */
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';
import { restoreNecromancerStateSlice } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';

// Union independently observed expiry stacks while preserving the largest multiplicity at each timestamp.
function mergeExpiryStacks(left: readonly number[] = [], right: readonly number[] = []): number[] {
  const counts = new Map<number, number>();
  for (const values of [left, right]) {
    const local = new Map<number, number>();
    for (const expiresAt of values) {
      local.set(expiresAt, (local.get(expiresAt) || 0) + 1);
    }

    for (const [expiresAt, count] of local) {
      counts.set(expiresAt, Math.max(counts.get(expiresAt) || 0, count));
    }
  }

  return [...counts.entries()]
    .flatMap(([expiresAt, count]) => Array(count).fill(expiresAt))
    .sort((a, b) => a - b)
    .slice(-30);
}

/** Reconciles a state snapshot while preserving resolver-only and specialization-owned fields. */
export function handleNecromancerStateEvent(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const core = professionCoreState(context);
  const resolverCarapace = core.carapaceExpiries || [];
  const snapshot = event.state || {};
  restoreNecromancerStateSlice(core, snapshot);
  restoreNecromancerStateSlice(context.profession.specialization.state, snapshot);
  // Carapace is observed in both phases; preserve the greatest multiplicity of each expiry.
  core.carapaceExpiries = mergeExpiryStacks(core.carapaceExpiries, resolverCarapace);
}

/** Drops stale summon packets, then materializes attacks whose owner and generation remain active. */
export function handleNecromancerSummonAttack(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (
    event.requiresMinion &&
    !(
      Number(professionCoreState(context).activeMinions?.[event.requiresMinion]) >
        Number(event.requiresMinionIndex || 0) &&
      (event.requiresMinionGeneration == null ||
        Number(professionCoreState(context).minionGenerations?.[event.requiresMinion] || 0) ===
          Number(event.requiresMinionGeneration)) &&
      (event.requiresMinionAttackGeneration == null ||
        Number(professionCoreState(context).minionAttackGenerations?.[event.requiresMinion] || 0) ===
          Number(event.requiresMinionAttackGeneration))
    )
  )
    return;
  materializeNecromancerSummonAttack(context, event);
}

/** Materializes an attack after the owning module has validated its creature lifetime. */
export function materializeNecromancerSummonAttack(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  // Materialize the strike first so same-timestamp secondary effects retain scheduler ordering.
  context.queue.enqueue({
    type: 'damage',
    at: event.at,
    source: event.source,
    sourceId: event.sourceId,
    actorType: 'summon',
    skillId: event.skillId,
    skillName: event.skillName,
    parentSkillName: event.parentSkillName,
    name: event.name,
    icon: event.icon,
    coefficient: Number(event.coefficient || 0),
    comboFinishers: event.deferredComboFinishers,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: 'Unequipped',
    weaponStrength: event.weaponStrength,
    canCrit: true,
    summonKind: event.summonKind,
    summonCount: event.summonCount,
    summonOwner: event.summonOwner,
    summonOwnerBase: event.summonOwnerBase,
    summonBasePower: event.summonBasePower,
    summonDamagePerCoefficient: event.summonDamagePerCoefficient,
    summonCriticalChance: event.summonCriticalChance,
    summonCriticalDamage: event.summonCriticalDamage,
    summonInheritsCriticalAttributes: event.summonInheritsCriticalAttributes,
    summonStrikeMultiplier: event.summonStrikeMultiplier,
    independentSummonStrike: event.independentSummonStrike,
    metadata: event.metadata
  });
  // Follow the strike with its optional condition and control payloads.
  if (Array.isArray(event.onHitCondition)) {
    const [condition, stacks, duration] = event.onHitCondition;
    context.queue.enqueue({
      type: 'condition',
      at: event.at,
      source: event.source,
      sourceId: event.sourceId,
      actorType: 'summon',
      skillId: event.skillId,
      skillName: event.skillName,
      parentSkillName: event.parentSkillName,
      name: `${event.skillName || event.name || 'Minion Attack'} — ${String(condition)}`,
      condition: String(condition),
      stacks: Number(stacks || 0),
      duration: Number(duration || 0)
    });
  }

  if (event.controlKind) {
    context.queue.enqueue({
      type: 'control',
      at: event.at,
      source: event.source,
      sourceId: event.sourceId,
      actorType: 'summon',
      skillId: event.skillId,
      skillName: event.skillName,
      parentSkillName: event.parentSkillName,
      name: event.skillName || event.name,
      controlKind: event.controlKind,
      duration: Number(event.controlDuration || 0)
    });
  }
}
