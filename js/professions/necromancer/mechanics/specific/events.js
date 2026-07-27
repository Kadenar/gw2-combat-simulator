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
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasTrait } from "./shared.js";

function mergeExpiryStacks(left = [], right = []) {
  const counts = new Map();
  for (const values of [left, right]) {
    const local = new Map();
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

export function handleNecromancerStateEvent(context, event) {
  const resolverCarapace = context.profession.carapaceExpiries || [];
  const resolverOnly = {
    targetChilledUntil: context.profession.targetChilledUntil,
    dreadUntil: context.profession.dreadUntil,
    fearOfDeathReadyAt: context.profession.fearOfDeathReadyAt,
    vampiricPresenceReadyAt: context.profession.vampiricPresenceReadyAt,
    barbedPrecisionProgress: context.profession.barbedPrecisionProgress,
    chillingNovaProgress: context.profession.chillingNovaProgress,
    demonicLoreReadyAt: context.profession.demonicLoreReadyAt,
    traitProcReadyAt: context.profession.traitProcReadyAt,
  };
  for (const key of Object.keys(context.profession)) {
    delete context.profession[key];
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

export function handleNecromancerChillEvent(context, event) {
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
    context.recordProc?.(
      "trait",
      "Bitter Chill",
      event.at,
      event.skillName,
    );
  }
  if (hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    enqueueOrdered(context.queue, {
      type: "condition",
      at: event.at,
      name: "Deathly Chill — Bleeding",
      skillName: "Deathly Chill",
      condition: "Bleeding",
      stacks: 3,
      duration: 8,
      source: "Trait",
      sourceId: TRAIT.DEATHLY_CHILL,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.(
      "trait",
      "Deathly Chill",
      event.at,
      event.skillName,
    );
  }
}

export function handleNecromancerSummonAttack(context, event) {
  if (
    event.requiresMinion
    && !(Number(context.profession.activeMinions?.[event.requiresMinion]) > 0)
  ) return;
  if (
    event.requiresSpirit
    && !context.profession.activeSpirits?.[event.requiresSpirit]
  ) return;
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: event.source,
    sourceId: event.sourceId,
    actorType: "summon",
    skillId: event.skillId,
    skillName: event.skillName,
    name: event.name,
    coefficient: event.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    canCrit: true,
    summonKind: event.summonKind,
  });
}
