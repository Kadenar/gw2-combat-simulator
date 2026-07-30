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
import { EPSILON } from "../../../../platform/engine/clock.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
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
    targetControlledUntil: context.profession.targetControlledUntil,
    painfulBondUntil: context.profession.painfulBondUntil,
    painfulBondPulseAnchorAt:
      context.profession.painfulBondPulseAnchorAt,
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

export function handleNecromancerPainfulBond(context, event) {
  const definition = MECHANICS.painfulBond;
  if (event.mode === "apply") {
    context.profession.painfulBondUntil = Math.max(
      Number(context.profession.painfulBondUntil || 0),
      event.at + Number(event.duration || definition.duration),
    );
    if (!Number.isFinite(context.profession.painfulBondPulseAnchorAt)) {
      const firstPulseAt = event.at + Number(definition.firstPulseDelay || 0);
      context.profession.painfulBondPulseAnchorAt = firstPulseAt;
      enqueueOrdered(context.queue, {
        ...event,
        at: firstPulseAt,
        mode: "tick",
      });
    }
    return;
  }
  if (event.mode !== "tick") return;

  if (event.at < Number(context.profession.painfulBondUntil || 0) - EPSILON) {
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at,
      name: "Painful Bond",
      skillName: "Painful Bond",
      coefficient: 0,
      flatStrikeBase: definition.flatStrikeBase,
      flatStrikePowerCoeff: definition.flatStrikePowerCoeff,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "Spirit",
      sourceId: "ritualist.painful-bond",
      actorType: "effect",
      icon: definition.icon,
      skillWeapon: "Unequipped",
      noCrit: true,
      triggeredBy: event.triggeredBy || "Anguish",
    });
  }

  const nextAt = event.at + Number(definition.interval || 1);
  if (nextAt <= context.horizon + EPSILON) {
    enqueueOrdered(context.queue, {
      ...event,
      at: nextAt,
      mode: "tick",
    });
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

export function handleNecromancerSummonAttack(context, event) {
  if (
    event.requiresMinion &&
    !(
      Number(context.profession.activeMinions?.[event.requiresMinion])
        > Number(event.requiresMinionIndex || 0)
      && (
        event.requiresMinionGeneration == null
        || Number(
          context.profession.minionGenerations?.[event.requiresMinion] || 0,
        ) === Number(event.requiresMinionGeneration)
      )
      && (
        event.requiresMinionAttackGeneration == null
        || Number(
          context.profession.minionAttackGenerations?.[
            event.requiresMinion
          ] || 0,
        ) === Number(event.requiresMinionAttackGeneration)
      )
    )
  )
    return;
  if (
    event.requiresSpirit &&
    !(
      context.profession.activeSpirits?.[event.requiresSpirit]
      && (
        event.requiresSpiritGeneration == null
        || Number(
          context.profession.spiritGenerations?.[event.requiresSpirit] || 0,
        ) === Number(event.requiresSpiritGeneration)
      )
      && Number(
        context.profession.spiritBusyUntil?.[event.requiresSpirit] || 0,
      ) <= event.at
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
    coefficient: event.coefficient,
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

export function handleNecromancerWeaponSpell(context, event) {
  const recipients = {
    player: {
      stacks: Number(event.playerStacks || 0),
      nextAt: 0,
    },
  };
  for (const recipient of event.recipients || []) {
    recipients[recipient] = {
      stacks: Number(event.allyStacks || 0),
      nextAt: 0,
    };
  }
  context.profession.weaponSpells[event.spell] = {
    skillId: event.skillId,
    skillName: event.skillName,
    appliedAt: event.at,
    expiresAt: event.at + Number(event.duration || 0),
    recipients,
    alliesReceiveFullBenefit: Boolean(event.alliesReceiveFullBenefit),
  };
}
