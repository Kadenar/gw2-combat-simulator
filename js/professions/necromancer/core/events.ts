import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * Handlers for necromancer events pulled off the scheduler/resolver queue.
 *
 *   - `handleNecromancerStateEvent` reconciles the resolver's profession state
 *     with the snapshot carried on a `necromancer.state` event, replacing it
 *     wholesale while preserving resolver-only fields and merging carapace
 *     stacks (see mergeExpiryStacks).
 *   - `handleNecromancerChillEvent` canonicalizes internal chill packets.
 *   - `handleNecromancerSummonAttack` materializes a queued minion
 *     autoattack into a damage event, dropping it if the summon has expired.
 */
import { enqueueOrdered } from '../../../platform/engine/event-queue.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '../types.js';
import { captureNecromancerStatePreserver } from './state-reconciliation.js';

/**
 * Declares revive-only skills as supported without changing combat state,
 * because allied downstate and revive progress are outside this simulator.
 */
export function handleNecromancerReviveEvent(): void {}

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

export function handleNecromancerStateEvent(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const core = professionCoreState(context);
  const mutableCore = core as unknown as Record<string, unknown>;
  const active = context.profession.specialization;
  const specializationState = active.state as Record<string, unknown>;
  const coreKeys = new Set(Object.keys(core));
  const specializationKeys = new Set(Object.keys(specializationState));
  const resolverCarapace = core.carapaceExpiries || [];
  const resolverOnly = {
    targetChilledUntil: core.targetChilledUntil,
    targetControlledUntil: core.targetControlledUntil,
    dreadUntil: core.dreadUntil,
    fearOfDeathReadyAt: core.fearOfDeathReadyAt,
    vampiricPresenceReadyAt: core.vampiricPresenceReadyAt,
    barbedPrecisionProgress: core.barbedPrecisionProgress,
    spitefulFortitudeLifeForce: core.spitefulFortitudeLifeForce,
    traitProcReadyAt: core.traitProcReadyAt
  };
  const restoreSpecializationState = captureNecromancerStatePreserver(active.state);
  for (const key of coreKeys) delete mutableCore[key];
  for (const key of specializationKeys) delete specializationState[key];
  for (const [key, value] of Object.entries(event.state || {})) {
    if (coreKeys.has(key)) mutableCore[key] = structuredClone(value);
    if (specializationKeys.has(key)) {
      specializationState[key] = structuredClone(value);
    }
  }

  core.carapaceExpiries = mergeExpiryStacks(core.carapaceExpiries, resolverCarapace);
  for (const [key, value] of Object.entries(resolverOnly)) {
    if (value !== undefined) mutableCore[key] = value;
  }

  restoreSpecializationState();
}

export function handleNecromancerChillEvent(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  // Custom chill packets become canonical conditions so Core and active-specialization reactions share one path.
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    name: `${event.skillName || event.name || 'Necromancer'} — Chilled`,
    skillName: event.skillName,
    condition: 'Chilled',
    stacks: Number(event.stacks || 1),
    duration: Number(event.duration || 0),
    source: event.source,
    sourceId: event.sourceId,
    actorType: event.actorType,
    triggeredBy: event.triggeredBy
  });
}

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
  enqueueOrdered(context.queue, {
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
    spirit: event.spirit,
    spiritAttackType: event.spiritAttackType,
    anguishConditionalDamage: event.anguishConditionalDamage
  });
  if (Array.isArray(event.onHitCondition)) {
    const [condition, stacks, duration] = event.onHitCondition;
    enqueueOrdered(context.queue, {
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
    enqueueOrdered(context.queue, {
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
