import { professionCoreState } from "../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { gw2StatsForWeaponSet } from "../../../platform/gw2/runtime-rules.js";
import { CANONICAL_TARGET_CONDITIONS } from "../../../platform/gw2/target-state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type {
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails,
} from "../types.js";

function handleThiefState(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
): void {
  const incoming = structuredClone(event.state || {}) as Record<
    string,
    unknown
  >;
  const core = professionCoreState(context) as unknown as Record<
    string,
    unknown
  >;
  const specialization = context.profession.specialization
    .state as unknown as Record<string, unknown>;
  const ownerFor = (key: string): Record<string, unknown> =>
    Object.hasOwn(specialization, key) ? specialization : core;
  const preserved: Record<string, unknown> = {
    traitProcProgress: core.traitProcProgress || {},
    traitProcReadyAt: core.traitProcReadyAt || {},
  };
  for (const generationField of Object.keys(incoming).filter((key) =>
    key.endsWith("Generation"),
  )) {
    const prefix = generationField.slice(0, -"Generation".length);
    const chargesField = `${prefix}Charges`;
    const expiresAtField = `${prefix}ExpiresAt`;
    const owner = ownerFor(generationField);
    const incomingGeneration = Number(incoming[generationField] || 0);
    const currentGeneration = Number(owner[generationField] || 0);
    if (
      generationField === "spiderVenomGeneration" &&
      incomingGeneration < currentGeneration
    ) {
      preserved[generationField] = owner[generationField] || 0;
      if (Object.hasOwn(owner, chargesField)) {
        preserved[chargesField] = owner[chargesField] || 0;
      }
      if (Object.hasOwn(owner, expiresAtField)) {
        preserved[expiresAtField] = owner[expiresAtField] || 0;
      }
      continue;
    }
    if (
      incomingGeneration === currentGeneration &&
      Number(incoming[expiresAtField] || 0) > event.at &&
      Object.hasOwn(owner, chargesField)
    ) {
      preserved[chargesField] = owner[chargesField] || 0;
    }
  }
  for (const [key, value] of Object.entries(incoming)) {
    ownerFor(key)[key] = value;
  }
  for (const [key, value] of Object.entries(preserved)) {
    ownerFor(key)[key] = value;
  }
}

export const thiefCoreResolverEventHandlers = Object.freeze({
  "thief.state": handleThiefState,
});

const EPSILON = 1e-9;

function thiefBoonDuration(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  kind: string,
  baseDuration: number,
): number {
  const stats = context.query.statsAt(event.at, event, context);
  const configuredStats = gw2StatsForWeaponSet(
    context.config,
    context.activeWeaponSet,
  );
  const sigil = context.query.activeSigilSetAt(event.at);
  const name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(configuredStats.boonDurationBonus || 0) / 100 +
    Number(configuredStats.boonDurationBonuses?.[name] || 0) / 100 +
    Number(sigil?.boonDurationBonus || 0) / 100;
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function queueThiefBoon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  {
    traitId,
    traitName,
    boon,
    duration,
    stacks = 1,
    recipients = "self",
  }: {
    readonly traitId: SkillId;
    readonly traitName: string;
    readonly boon: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly recipients?: "self" | "party";
  },
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillId: traitId,
    skillName: traitName,
    name: `${traitName} - ${boon}`,
    kind: boon.toLowerCase(),
    duration: thiefBoonDuration(context, event, boon, duration),
    stacks,
    recipients,
    maximumRecipients: recipients === "party" ? 5 : 1,
    triggeredBy: event.skillName,
  });
}

function activeSelfFuryApplications(context: ThiefResolverContext, at: number) {
  return (context.boons.get("fury") || []).filter(
    (application) =>
      application.affectsSelf !== false &&
      application.at <= at + EPSILON &&
      application.expiresAt > at + EPSILON,
  );
}

function extendActiveFury(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  duration: number,
): void {
  const applications = context.boons.get("fury") || [];
  const active = new Set(activeSelfFuryApplications(context, event.at));
  if (!active.size) return;
  context.boons.set(
    "fury",
    applications.map((application) =>
      active.has(application)
        ? { ...application, expiresAt: application.expiresAt + duration }
        : application,
    ),
  );
  enqueueOrdered(context.queue, {
    type: "proc",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.NO_QUARTER,
    actorType: "effect",
    skillId: TRAIT.NO_QUARTER,
    skillName: "No Quarter",
    name: "No Quarter - Fury Extension",
    duration,
    triggeredBy: event.skillName,
  });
}

function traitCriticalProgress(
  context: ThiefResolverContext,
  traitId: SkillId,
): number {
  return Number(
    professionCoreState(context).traitProcProgress[String(traitId)] || 0,
  );
}

function setTraitCriticalProgress(
  context: ThiefResolverContext,
  traitId: SkillId,
  value: number,
): void {
  professionCoreState(context).traitProcProgress[String(traitId)] = value;
}

export const thiefCoreCriticalReactions = Object.freeze({
  unrelentingStrikes: Object.freeze({
    id: "thief.unrelenting-strikes",
    order: 10,
    actorTypes: ["player"] as const,
    when: (
      context: ThiefResolverContext,
      event: ThiefResolverEvent,
      details: ThiefResolverReactionDetails,
    ) =>
      Boolean(details.hitContext?.critEligible) &&
      Number(event.coefficient) > 0 &&
      hasThiefTrait(context.config, TRAIT.UNRELENTING_STRIKES),
    expectedProgress: {
      get: (context: ThiefResolverContext) =>
        traitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES),
      set: (context: ThiefResolverContext, value: number) =>
        setTraitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES, value),
    },
    internalCooldown: {
      duration: 8,
      readyAt: (context: ThiefResolverContext) =>
        Number(
          professionCoreState(context).traitProcReadyAt[
            TRAIT.UNRELENTING_STRIKES
          ] || 0,
        ),
      setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
        professionCoreState(context).traitProcReadyAt[
          TRAIT.UNRELENTING_STRIKES
        ] = readyAt;
      },
    },
    attribution: {
      kind: "trait" as const,
      id: TRAIT.UNRELENTING_STRIKES,
    },
    handler: (context: ThiefResolverContext, event: ThiefResolverEvent) =>
      queueThiefBoon(context, event, {
        traitId: TRAIT.UNRELENTING_STRIKES,
        traitName: "Unrelenting Strikes",
        boon: "Fury",
        duration: 4,
        recipients: "party",
      }),
  }),
  noQuarter: Object.freeze({
    id: "thief.no-quarter",
    order: 20,
    actorTypes: ["player"] as const,
    when: (
      context: ThiefResolverContext,
      event: ThiefResolverEvent,
      details: ThiefResolverReactionDetails,
    ) =>
      Boolean(details.hitContext?.critEligible) &&
      Number(event.coefficient) > 0 &&
      hasThiefTrait(context.config, TRAIT.NO_QUARTER) &&
      context.query.furyActiveAt(event.at, context, event),
    expectedProgress: {
      get: (context: ThiefResolverContext) =>
        traitCriticalProgress(context, TRAIT.NO_QUARTER),
      set: (context: ThiefResolverContext, value: number) =>
        setTraitCriticalProgress(context, TRAIT.NO_QUARTER, value),
    },
    internalCooldown: {
      duration: 2,
      readyAt: (context: ThiefResolverContext) =>
        Number(
          professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] || 0,
        ),
      setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
        professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] =
          readyAt;
      },
    },
    attribution: { kind: "trait" as const, id: TRAIT.NO_QUARTER },
    handler: (context: ThiefResolverContext, event: ThiefResolverEvent) =>
      extendActiveFury(context, event, 2),
  }),
});

export function reactToThiefCoreBuff(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
): void {
  if (
    String(event.kind || "").toLowerCase() !== "fury" ||
    event.affectsSelf === false ||
    !hasThiefTrait(context.config, TRAIT.ASSASSINS_FURY)
  )
    return;
  const state = professionCoreState(context);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] || 0);
  if (event.at + EPSILON < readyAt) return;
  state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] = event.at + 2;
  queueThiefBoon(context, event, {
    traitId: TRAIT.ASSASSINS_FURY,
    traitName: "Assassin's Fury",
    boon: "Might",
    duration: 8,
    stacks: 3,
  });
}

function enqueueSiphon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  {
    sourceId,
    name,
    coefficient,
  }: {
    readonly sourceId: SkillId;
    readonly name: string;
    readonly coefficient: number;
  },
): void {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name,
    coefficient,
    hits: 1,
    canCrit: false,
    noCrit: true,
    lifeSiphon: true,
    triggeredBy: event.skillName,
  });
}

function applySpiderVenom(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {},
): void {
  if (event.actorType !== "player" || !(Number(event.coefficient) > 0)) return;
  const state = professionCoreState(context);
  if (
    Number(state.spiderVenomCharges || 0) <= 0 ||
    Number(state.spiderVenomExpiresAt || 0) <= event.at
  )
    return;
  state.spiderVenomCharges -= 1;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "thief",
    sourceId: ID.SPIDER_VENOM,
    actorType: "player",
    skillId: ID.SPIDER_VENOM,
    skillName: "Spider Venom",
    name: "Spider Venom - Poison",
    condition: "Poisoned",
    stacks: 1,
    duration: 3,
    activationId: event.activationId || `${event.skillId}:${event.at}`,
    triggeredBy: event.skillName,
  });
  if (hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    enqueueSiphon(context, event, {
      sourceId: TRAIT.LEECHING_VENOMS,
      name: "Leeching Venoms",
      coefficient: 0.033,
    });
  }
}

function applyShadowSiphoning(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
): void {
  if (
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    !hasThiefTrait(context.config, TRAIT.SHADOW_SIPHONING)
  )
    return;
  const skill =
    event.skillId == null
      ? undefined
      : context.helpers.skillsById?.get(event.skillId);
  const namedSkill =
    event.skillName == null
      ? undefined
      : context.helpers.skillsByName?.get(event.skillName);
  if (!(skill || namedSkill)?.stealthAttack) return;
  const state = professionCoreState(context);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] || 0);
  if (event.at + 1e-9 < readyAt) return;
  state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] = event.at + 1;
  enqueueSiphon(context, event, {
    sourceId: TRAIT.SHADOW_SIPHONING,
    name: "Shadow Siphoning",
    coefficient: 0.1,
  });
}

function targetConditionCount(
  context: ThiefResolverContext,
  at: number,
): number {
  return CANONICAL_TARGET_CONDITIONS.filter((condition) =>
    context.query?.targetHasCondition(condition, at, context),
  ).length;
}

function applyPanicStrike(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {},
): void {
  if (
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    !hasThiefTrait(context.config, TRAIT.PANIC_STRIKE) ||
    targetConditionCount(context, event.at) < 3
  )
    return;
  const state = professionCoreState(context);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.PANIC_STRIKE] || 0);
  if (event.at + 1e-9 < readyAt) return;
  state.traitProcReadyAt[TRAIT.PANIC_STRIKE] = event.at + 20;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.PANIC_STRIKE,
    actorType: "player",
    skillId: TRAIT.PANIC_STRIKE,
    skillName: "Panic Strike",
    name: "Panic Strike - Immobilized",
    condition: "Immobilized",
    stacks: 1,
    duration: 2.5,
    activationId: `panic-strike:${event.at}`,
    triggeredBy: event.skillName,
  });
}

function applyThiefDamageReactions(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {},
): void {
  applySpiderVenom(context, event, details);
  applyShadowSiphoning(context, event);
  applyPanicStrike(context, event, details);
}

function applyThiefConditionReactions(
  context: ThiefResolverContext,
  application: ThiefResolverEvent,
): void {
  if (
    application.condition === "Poisoned" &&
    application.skillId === ID.SPIDER_VENOM &&
    application.triggeredByAlly &&
    hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)
  ) {
    enqueueSiphon(context, application, {
      sourceId: TRAIT.LEECHING_VENOMS,
      name: "Leeching Venoms",
      coefficient: 0.033,
    });
  }
  if (
    application.condition === "Immobilized" &&
    application.actorType === "player" &&
    hasThiefTrait(context.config, TRAIT.PANIC_STRIKE)
  ) {
    enqueueOrdered(context.queue, {
      type: "condition",
      at: application.at,
      source: "Trait",
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: "player",
      skillId: TRAIT.PANIC_STRIKE,
      skillName: "Panic Strike",
      name: "Panic Strike - Poison",
      condition: "Poisoned",
      stacks: hasThiefTrait(context.config, TRAIT.POTENT_POISON) ? 2 : 1,
      duration: 4,
      activationId:
        application.activationId || `panic-strike:${application.at}`,
      triggeredBy: application.skillName,
    });
  }
  if (
    application.condition === "Blindness" &&
    hasThiefTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)
  ) {
    enqueueSiphon(context, application, {
      sourceId: TRAIT.CLOAKED_IN_SHADOW,
      name: "Cloaked in Shadow",
      coefficient: 0.04,
    });
  }
  if (
    application.condition === "Bleeding" &&
    Number(application.bonusAboveNinetyStacks || 0) > 0
  ) {
    const maximum = Number(context.config?.target?.health || 0);
    const damage =
      Number(context.totals?.strike || 0) +
      Number(context.totals?.condition || 0);
    if (!(maximum > 0) || damage / maximum < 0.1) {
      enqueueOrdered(context.queue, {
        ...application,
        type: "condition",
        name: "Unsuspecting Strike - Bonus Bleeding",
        condition: application.condition,
        duration: Number(application.duration || 0),
        stacks: Number(application.bonusAboveNinetyStacks),
        bonusAboveNinetyStacks: 0,
      });
    }
  }
}

export const thiefCoreResolverEventReactions = Object.freeze({
  damage: applyThiefDamageReactions,
  condition: applyThiefConditionReactions,
});
