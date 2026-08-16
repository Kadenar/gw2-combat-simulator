import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { EPSILON } from "../../../platform/engine/clock.js";
import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type { NativeResolvedDamageDetails } from "../../../platform/gw2/native-module-types.js";
import { gw2StatsForWeaponSet } from "../../../platform/gw2/runtime-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import type {
  Gw2ApplyCondition,
  Gw2EventDraft,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../../../platform/gw2/types.js";
import {
  isElementalistAttunement,
  type ElementalistAuraState,
  type ElementalistCoreState,
} from "./state.js";

const PERSISTING_FLAMES_FIELD_SKILLS = new Set([
  "Flamewall",
  "Pyroclastic Blast",
  "Burning Retreat",
  "Burning Speed",
  "Flame Uprising",
  "Ring of Fire",
  "Lava Font",
  "Wildfire",
]);
const BOON_KINDS = new Set([
  "aegis",
  "alacrity",
  "fury",
  "might",
  "protection",
  "quickness",
  "regeneration",
  "resistance",
  "resolution",
  "stability",
  "superspeed",
  "swiftness",
  "vigor",
]);

interface ElementalistConditionReactionDetails extends SchedulerRecord {
  readonly applyCondition?: Gw2ApplyCondition;
}

function coreState(context: Gw2ResolverRuntime): ElementalistCoreState {
  const profession = context.profession as {
    core?: ElementalistCoreState;
  } & SchedulerRecord;
  return profession.core || (profession as unknown as ElementalistCoreState);
}

export function elementalistSourceSkill(event: Gw2ResolverEvent): string {
  return String(event.skillName || event.name || event.source || "");
}

function titleCase(value: string): string {
  const normalized = value.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buffDuration(
  context: Gw2ResolverRuntime,
  kind: string,
  duration: number,
): number {
  const normalized = kind.toLowerCase();
  if (!BOON_KINDS.has(normalized)) return duration;
  const weaponSet = context.activeWeaponSet === 2 ? 2 : 1;
  const stats = gw2StatsForWeaponSet(context.config, weaponSet);
  const sigils = context.config.sigilSets?.[weaponSet - 1] || {};
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(stats.boonDurationBonus || 0) / 100 +
    Number(stats.boonDurationBonuses?.[titleCase(normalized)] || 0) / 100 +
    Number(sigils.boonDurationBonus || 0) / 100;
  return duration * Math.min(2, Math.max(1, 1 + bonus));
}

function applyCondition(
  context: Gw2ResolverRuntime,
  details: ElementalistConditionReactionDetails | NativeResolvedDamageDetails,
  event: Gw2ResolverEvent,
  {
    source,
    sourceId = event.skillId ?? event.sourceId,
    condition,
    stacks,
    duration,
  }: {
    readonly source: string;
    readonly sourceId?: Gw2EventDraft["sourceId"];
    readonly condition: string;
    readonly stacks: number;
    readonly duration: number;
  },
): void {
  const application: Gw2EventDraft = {
    type: "condition",
    at: event.at,
    source,
    sourceId,
    actorType: "player",
    skillName: source,
    name: `${source} — ${condition}`,
    condition,
    stacks,
    duration,
    triggeredBy: elementalistSourceSkill(event),
  };
  if (details.applyCondition) {
    details.applyCondition(context, application);
  } else {
    enqueueOrdered(context.queue, application as Gw2ResolverEvent);
  }
}

export function queueElementalistBuff(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  kind: string,
  stacks: number,
  duration: number,
  source: string,
): void {
  const adjustedDuration = buffDuration(context, kind, duration);
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source,
    sourceId: event.skillId ?? event.sourceId ?? source,
    actorType: "player",
    skillName: source,
    name: source,
    kind: kind.toLowerCase(),
    stacks,
    duration: adjustedDuration,
    triggeredBy: elementalistSourceSkill(event),
    ...(Number(event.priority || 0)
      ? { priority: Number(event.priority) }
      : {}),
  });
}

export function activeElementalistBuffs(
  context: Gw2ResolverRuntime,
  kind: string,
  at: number,
) {
  return (context.boons.get(kind.toLowerCase()) || []).filter(
    (application) =>
      application.at <= at + EPSILON && application.expiresAt > at + EPSILON,
  );
}

export function refreshElementalistBuffs(
  context: Gw2ResolverRuntime,
  kind: string,
  at: number,
  expiresAt: (currentExpiresAt: number) => number,
) {
  const normalized = kind.toLowerCase();
  const applications = context.boons.get(normalized) || [];
  const active = new Set(activeElementalistBuffs(context, normalized, at));
  context.boons.set(
    normalized,
    applications.map((application) =>
      active.has(application)
        ? {
            ...application,
            expiresAt: expiresAt(application.expiresAt),
          }
        : application,
    ),
  );
  return [...active];
}

export function queueElementalistAura(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  aura: string,
  duration: number,
  skillName: string,
): void {
  const adjustedDuration = hasTrait(context, "Smothering Auras")
    ? duration * 1.33
    : duration;
  enqueueOrdered(context.queue, {
    type: "elementalist.aura",
    at: event.at,
    source: skillName,
    sourceId: event.skillId ?? event.sourceId ?? skillName,
    actorType: "effect",
    skillName,
    aura,
    duration: adjustedDuration,
    elementalistResolverGeneratedAura: true,
  });
}

export function applyElementalistResolverAura(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  if (event.elementalistAuraReactionDispatched === true) return;
  const skillName = elementalistSourceSkill(event);
  const duration = Math.max(0, Number(event.duration || 0));
  const auraState: ElementalistAuraState = {
    type: String(event.aura || ""),
    appliedAt: event.at,
    expiresAt: event.at + duration,
    skillName,
  };
  coreState(context).activeAuras.push(auraState);
  if (event.elementalistResolverGeneratedAura === true) {
    context.resolved.push(event);
  }
  if (hasTrait(context, "Empowering Auras")) {
    const current = activeElementalistBuffs(
      context,
      "Empowering Auras",
      event.at,
    );
    refreshElementalistBuffs(
      context,
      "Empowering Auras",
      event.at,
      () => event.at + 10,
    );
    const activeStacks = current.reduce(
      (total, application) => total + Number(application.stacks || 1),
      0,
    );
    if (activeStacks < 5) {
      queueElementalistBuff(
        context,
        event,
        "Empowering Auras",
        1,
        10,
        skillName,
      );
    }
    recordElementalistTraitProc(context, event, "Empowering Auras");
  }
  if (context.combatStartTime != null && event.at < context.combatStartTime) {
    return;
  }
  if (
    event.elementalistResolverGeneratedAura === true ||
    event.type === "aura"
  ) {
    if (hasTrait(context, "Zephyr's Boon")) {
      queueElementalistBuff(context, event, "Fury", 1, 5, skillName);
      queueElementalistBuff(context, event, "Swiftness", 1, 5, skillName);
    }
    if (hasTrait(context, "Elemental Shielding")) {
      queueElementalistBuff(context, event, "Protection", 1, 3, skillName);
    }
    if (hasTrait(context, "Invigorating Torrents")) {
      queueElementalistBuff(context, event, "Vigor", 1, 5, skillName);
      queueElementalistBuff(context, event, "Regeneration", 1, 5, skillName);
    }
    if (hasTrait(context, "Elemental Bastion")) {
      queueElementalistBuff(context, event, "Alacrity", 1, 4, skillName);
    }
  }
  if (event.type === "elementalist.aura") {
    Object.assign(event, { elementalistAuraReactionDispatched: true });
    context.dispatchReaction("aura.applied", event);
  }
}

export function recordElementalistResolvedEvent(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  context.resolved.push(event);
}

export function recordElementalistTraitProc(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  name: string,
): void {
  context.recordProc("trait", name, event.at, elementalistSourceSkill(event));
}

function applyBurningPrecision(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails,
): void {
  if (
    !hasTrait(context, "Burning Precision") ||
    event.actorType !== "player" ||
    details.hitContext?.critEligible !== true
  ) {
    return;
  }
  const state = coreState(context);
  const chance = Number(details.hitContext.critical.chance || 0);
  state.burningPrecisionProgress += chance * 0.33;
  if (
    state.burningPrecisionProgress < 1 ||
    Number(state.procReadyAt.burningPrecision || 0) >= event.at - EPSILON
  ) {
    return;
  }
  state.burningPrecisionProgress -= 1;
  state.procReadyAt.burningPrecision = event.at + 5;
  applyCondition(context, details, event, {
    source: "Burning Precision",
    sourceId: "Burning Precision",
    condition: "Burning",
    stacks: 1,
    duration: 3,
  });
  recordElementalistTraitProc(context, event, "Burning Precision");
}

function grantPersistingFlames(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  if (!hasTrait(context, "Persisting Flames")) return;
  queueElementalistBuff(
    context,
    event,
    "Persisting Flames",
    1,
    15,
    elementalistSourceSkill(event),
  );
}

export function applyElementalistResolvedDamage(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails = {},
): void {
  applyBurningPrecision(context, event, details);
  if (
    event.damageKind === "field-tick" &&
    PERSISTING_FLAMES_FIELD_SKILLS.has(elementalistSourceSkill(event))
  ) {
    grantPersistingFlames(context, event);
  }
}

export function applyElementalistResolvedCondition(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: ElementalistConditionReactionDetails = {},
): void {
  if (
    ["Immobilize", "Immobilized"].includes(String(event.condition)) &&
    hasTrait(context, "Strength of Stone") &&
    (context.combatStartTime == null || event.at >= context.combatStartTime)
  ) {
    const state = coreState(context);
    if (Number(state.procReadyAt.strengthOfStone || 0) < event.at - EPSILON) {
      state.procReadyAt.strengthOfStone = event.at + 3;
      applyCondition(context, details, event, {
        source: "Strength of Stone",
        sourceId: "Strength of Stone",
        condition: "Bleeding",
        stacks: 3,
        duration: 10,
      });
      recordElementalistTraitProc(context, event, "Strength of Stone");
    }
  }
  if (event.condition === "Burning") grantPersistingFlames(context, event);
}

export function applyElementalistResolverAttunement(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const core = coreState(context);
  if (isElementalistAttunement(event.to)) {
    core.primaryAttunement = event.to;
  }
  core.secondaryAttunement = isElementalistAttunement(event.secondaryAttunement)
    ? event.secondaryAttunement
    : null;
  core.attunementEnteredAt = event.at;
}

export function applyElementalistResolverSignetFire(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const core = coreState(context);
  core.signetOfFireDisabledUntil = Number(event.disabledUntil || event.at);
}
