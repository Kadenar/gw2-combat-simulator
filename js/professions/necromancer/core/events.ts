import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * Handlers for necromancer events pulled off the scheduler/resolver queue.
 *
 *   - `handleNecromancerStateEvent` reconciles the resolver's profession state
 *     with the snapshot carried on a `necromancer.state` event, replacing it
 *     wholesale while preserving resolver-only fields and merging carapace
 *     stacks (see mergeExpiryStacks).
 *   - `handleNecromancerChillEvent` applies the on-chill trait procs (Bitter
 *     Chill vulnerability, Deathly Chill bleeding).
 *   - `handleNecromancerSummonAttack` materializes a queued minion/spirit
 *     autoattack into a damage event, dropping it if the summon has expired.
 */
import { enqueueOrdered } from '../../../platform/engine/event-queue.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { hasTrait } from './shared.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '../types.js';

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
    chillingNovaProgress: core.chillingNovaProgress,
    demonicLoreReadyAt: core.demonicLoreReadyAt,
    spitefulFortitudeLifeForce: core.spitefulFortitudeLifeForce,
    traitProcReadyAt: core.traitProcReadyAt
  };
  const ritualistOnly =
    active.kind === 'Ritualist'
      ? {
          painfulBondUntil: active.state.painfulBondUntil,
          painfulBondPulseAnchorAt: active.state.painfulBondPulseAnchorAt,
          weaponSpells: active.state.weaponSpells
        }
      : null;
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

  if (ritualistOnly) {
    Object.assign(active.state, ritualistOnly);
  }
}

export function handleNecromancerChillEvent(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  professionCoreState(context).targetChilledUntil = Math.max(
    Number(professionCoreState(context).targetChilledUntil || 0),
    event.at + Number(event.duration || 0)
  );
  if (hasTrait(context, TRAIT.BITTER_CHILL)) {
    enqueueOrdered(context.queue, {
      type: 'buff',
      at: event.at,
      name: 'Bitter Chill',
      skillName: 'Bitter Chill',
      kind: 'target-vulnerability',
      stacks: 3,
      duration: 8,
      source: 'Trait',
      sourceId: TRAIT.BITTER_CHILL,
      actorType: 'effect',
      triggeredBy: event.skillName
    });
    context.recordProc?.('trait', 'Bitter Chill', event.at, event.skillName);
  }

  if (hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    enqueueOrdered(context.queue, {
      type: 'condition',
      at: event.at,
      name: 'Deathly Chill — Bleeding',
      skillName: 'Deathly Chill',
      condition: 'Bleeding',
      stacks: 4,
      duration: 4,
      source: 'Trait',
      sourceId: TRAIT.DEATHLY_CHILL,
      actorType: 'effect',
      triggeredBy: event.skillName
    });
    context.recordProc?.('trait', 'Deathly Chill', event.at, event.skillName);
  }
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
  if (
    event.requiresSpirit &&
    !(() => {
      const active = context.profession.specialization;
      if (active.kind !== 'Ritualist') return false;
      return (
        active.state.activeSpirits[event.requiresSpirit] &&
        (event.requiresSpiritGeneration == null ||
          Number(active.state.spiritGenerations[event.requiresSpirit] || 0) ===
            Number(event.requiresSpiritGeneration)) &&
        Number(active.state.spiritBusyUntil[event.requiresSpirit] || 0) <= event.at
      );
    })()
  )
    return;
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
