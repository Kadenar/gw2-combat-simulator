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
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasTrait } from "./shared.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
} from "../types.js";

function mergeExpiryStacks(
  left: readonly number[] = [],
  right: readonly number[] = [],
): number[] {
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
  event: NecromancerResolverEvent,
): void {
  const resolverCarapace = context.profession.carapaceExpiries || [];
  const resolverOnly = {
    targetChilledUntil: context.profession.targetChilledUntil,
    targetControlledUntil: context.profession.targetControlledUntil,
    painfulBondUntil: context.profession.painfulBondUntil,
    painfulBondPulseAnchorAt: context.profession.painfulBondPulseAnchorAt,
    weaponSpells: context.profession.weaponSpells,
    dreadUntil: context.profession.dreadUntil,
    fearOfDeathReadyAt: context.profession.fearOfDeathReadyAt,
    vampiricPresenceReadyAt: context.profession.vampiricPresenceReadyAt,
    barbedPrecisionProgress: context.profession.barbedPrecisionProgress,
    chillingNovaProgress: context.profession.chillingNovaProgress,
    demonicLoreReadyAt: context.profession.demonicLoreReadyAt,
    spitefulFortitudeLifeForce: context.profession.spitefulFortitudeLifeForce,
    traitProcReadyAt: context.profession.traitProcReadyAt,
  };
  const runtime = context.profession as unknown as {
    readonly core?: Record<string, unknown>;
    readonly specialization?: {
      readonly state?: Record<string, unknown>;
    };
  };
  if (runtime.core && runtime.specialization?.state) {
    for (const key of Object.keys(runtime.core)) delete runtime.core[key];
    for (const key of Object.keys(runtime.specialization.state)) {
      delete runtime.specialization.state[key];
    }
  } else {
    for (const key of Object.keys(context.profession)) {
      delete context.profession[key];
    }
  }
  Object.assign(context.profession, structuredClone(event.state || {}));
  context.profession.carapaceExpiries = mergeExpiryStacks(
    context.profession.carapaceExpiries,
    resolverCarapace,
  );
  for (const [key, value] of Object.entries(resolverOnly)) {
    if (value !== undefined) context.profession[key] = value;
  }
}

export function handleNecromancerChillEvent(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  context.profession.targetChilledUntil = Math.max(
    Number(context.profession.targetChilledUntil || 0),
    event.at + Number(event.duration || 0),
  );
  if (hasTrait(context, TRAIT.BITTER_CHILL)) {
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at,
      name: "Bitter Chill",
      skillName: "Bitter Chill",
      kind: "target-vulnerability",
      stacks: 3,
      duration: 8,
      source: "Trait",
      sourceId: TRAIT.BITTER_CHILL,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.("trait", "Bitter Chill", event.at, event.skillName);
  }
  if (hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    enqueueOrdered(context.queue, {
      type: "condition",
      at: event.at,
      name: "Deathly Chill — Bleeding",
      skillName: "Deathly Chill",
      condition: "Bleeding",
      stacks: 4,
      duration: 4,
      source: "Trait",
      sourceId: TRAIT.DEATHLY_CHILL,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.("trait", "Deathly Chill", event.at, event.skillName);
  }
}

export function handleNecromancerSummonAttack(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  if (
    event.requiresMinion &&
    !(
      Number(context.profession.activeMinions?.[event.requiresMinion]) >
        Number(event.requiresMinionIndex || 0) &&
      (event.requiresMinionGeneration == null ||
        Number(
          context.profession.minionGenerations?.[event.requiresMinion] || 0,
        ) === Number(event.requiresMinionGeneration)) &&
      (event.requiresMinionAttackGeneration == null ||
        Number(
          context.profession.minionAttackGenerations?.[event.requiresMinion] ||
            0,
        ) === Number(event.requiresMinionAttackGeneration))
    )
  )
    return;
  if (
    event.requiresSpirit &&
    !(
      context.profession.activeSpirits?.[event.requiresSpirit] &&
      (event.requiresSpiritGeneration == null ||
        Number(
          context.profession.spiritGenerations?.[event.requiresSpirit] || 0,
        ) === Number(event.requiresSpiritGeneration)) &&
      Number(context.profession.spiritBusyUntil?.[event.requiresSpirit] || 0) <=
        event.at
    )
  )
    return;
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: event.source,
    sourceId: event.sourceId,
    actorType: "summon",
    skillId: event.skillId,
    skillName: event.skillName,
    parentSkillName: event.parentSkillName,
    name: event.name,
    icon: event.icon,
    coefficient: Number(event.coefficient || 0),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
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
    independentSummonStrike: event.independentSummonStrike,
    spirit: event.spirit,
    spiritAttackType: event.spiritAttackType,
    anguishConditionalDamage: event.anguishConditionalDamage,
  });
}
