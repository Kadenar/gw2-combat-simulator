import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasTrait } from "./shared.js";

export function handleNecromancerStateEvent(context, event) {
  const resolverOnly = {
    targetChilledUntil: context.profession.targetChilledUntil,
    dreadUntil: context.profession.dreadUntil,
    fearOfDeathReadyAt: context.profession.fearOfDeathReadyAt,
    vampiricPresenceReadyAt: context.profession.vampiricPresenceReadyAt,
    barbedPrecisionProgress: context.profession.barbedPrecisionProgress,
    demonicLoreReadyAt: context.profession.demonicLoreReadyAt,
    traitProcReadyAt: context.profession.traitProcReadyAt,
  };
  for (const key of Object.keys(context.profession)) {
    delete context.profession[key];
  }
  Object.assign(context.profession, structuredClone(event.state || {}));
  for (const [key, value] of Object.entries(resolverOnly)) {
    if (value !== undefined) context.profession[key] = value;
  }
}

export function handleNecromancerChillEvent(context, event) {
  context.profession.targetChilledUntil = Math.max(
    Number(context.profession.targetChilledUntil || 0),
    event.at + Number(event.duration || 0),
  );
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
