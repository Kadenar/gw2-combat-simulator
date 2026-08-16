import { EPSILON } from "../../../../platform/engine/clock.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import type {
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../../../../platform/gw2/types.js";
import { gw2StatsForWeaponSet } from "../../../../platform/gw2/runtime-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type { ElementalistResolverContext } from "../../types.js";
import {
  elementalistSourceSkill,
  queueElementalistAura,
  queueElementalistBuff,
  recordElementalistTraitProc,
} from "../../core/resolver.js";
import { catalystState } from "./state.js";

const MAXIMUM_TIMED_EMPOWERMENT_STACKS = 7;

export function applyCatalystResolverAura(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent,
): void {
  if (
    !hasTrait(context, "Elemental Epitome") ||
    (context.combatStartTime != null && event.at < context.combatStartTime)
  ) {
    return;
  }
  queueElementalistBuff(
    context,
    event,
    "Elemental Empowerment",
    1,
    15,
    elementalistSourceSkill(event),
  );
}

export function applyCatalystComboTraits(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent,
): void {
  const core = professionCoreState(context);
  const state = catalystState.from(context);
  const attunement = core.primaryAttunement;
  const epitomeReadyAt = Number(state.elementalEpitomeReadyAt[attunement] || 0);
  if (
    hasTrait(context, "Elemental Epitome") &&
    epitomeReadyAt <= event.at + EPSILON
  ) {
    state.elementalEpitomeReadyAt[attunement] = event.at + 10;
    const aura =
      attunement === "Fire"
        ? (["Fire Aura", 4] as const)
        : attunement === "Water"
          ? (["Frost Aura", 4] as const)
          : attunement === "Air"
            ? (["Shocking Aura", 3] as const)
            : (["Magnetic Aura", 3] as const);
    queueElementalistAura(
      context,
      event,
      aura[0],
      aura[1],
      "Elemental Epitome",
    );
    recordElementalistTraitProc(context, event, "Elemental Epitome");
  }

  const synergyReadyAt = Number(state.elementalSynergyReadyAt[attunement] || 0);
  if (
    hasTrait(context, "Elemental Synergy") &&
    synergyReadyAt <= event.at + EPSILON
  ) {
    state.elementalSynergyReadyAt[attunement] = event.at + 10;
    if (attunement === "Fire") {
      queueElementalistBuff(
        context,
        event,
        "Might",
        6,
        10,
        "Elemental Synergy",
      );
    } else if (attunement === "Earth") {
      queueElementalistBuff(
        context,
        event,
        "Stability",
        2,
        6,
        "Elemental Synergy",
      );
    } else if (attunement === "Air") {
      core.endurance = Math.min(100, core.endurance + 50);
    }
    recordElementalistTraitProc(context, event, "Elemental Synergy");
  }
}

function catalystBoonDuration(
  context: Gw2ResolverRuntime,
  kind: string,
  duration: number,
): number {
  const weaponSet = context.activeWeaponSet === 2 ? 2 : 1;
  const stats = gw2StatsForWeaponSet(context.config, weaponSet);
  const sigils = context.config.sigilSets?.[weaponSet - 1] || {};
  const name = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(stats.boonDurationBonus || 0) / 100 +
    Number(stats.boonDurationBonuses?.[name] || 0) / 100 +
    Number(sigils.boonDurationBonus || 0) / 100;
  return duration * Math.min(2, Math.max(1, 1 + bonus));
}

function queueCatalystBuff(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  kind: string,
  stacks: number,
  duration: number,
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "Vicious Empowerment",
    sourceId: event.skillId ?? event.sourceId ?? "Vicious Empowerment",
    actorType: "player",
    skillName: "Vicious Empowerment",
    kind,
    stacks,
    duration:
      kind === "might"
        ? catalystBoonDuration(context, kind, duration)
        : duration,
    triggeredBy: event.skillName,
  });
}

export function applyViciousEmpowerment(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const immobilize = ["Immobilize", "Immobilized"].includes(
    String(event.condition || ""),
  );
  if (
    !hasTrait(context, "Vicious Empowerment") ||
    event.actorType !== "player" ||
    (event.type !== "control" && !immobilize) ||
    (context.combatStartTime != null && event.at < context.combatStartTime)
  ) {
    return;
  }
  const state = catalystState.from(context);
  if (state.viciousEmpowermentReadyAt > event.at + EPSILON) return;
  state.viciousEmpowermentReadyAt = event.at + 0.25;
  queueCatalystBuff(context, event, "elemental empowerment", 2, 15);
  queueCatalystBuff(context, event, "might", 2, 10);
  context.recordProc("trait", "Vicious Empowerment", event.at, event.skillName);
}

export function applySteamshrieker(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  if (
    event.actorType !== "player" ||
    context.config.relic !== "Steamshrieker" ||
    !["Blast", "Leap"].includes(String(event.finisherType || "")) ||
    event.fieldType !== "Water"
  ) {
    return;
  }

  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Relic",
    sourceId: "relic.steamshrieker",
    actorType: "effect",
    skillName: "Relic of Steamshrieker",
    name: "Relic of Steamshrieker — Burning",
    condition: "Burning",
    stacks: 1,
    duration: 5,
    triggeredBy: event.skillName,
  });
  context.recordProc(
    "relic",
    "Relic of Steamshrieker",
    event.at,
    event.skillName,
  );
}

/**
 * Elemental Empowerment starts with three permanent stacks. Timed grants fill
 * the remaining seven slots and replace the oldest timed stack at the cap.
 */
export function applyCatalystEmpowerment(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const kind = String(event.kind || "").toLowerCase();
  if (kind === "shattering ice" && event.affectsSelf !== false) {
    const state = catalystState.from(context);
    state.shatteringIceUntil =
      event.at + Math.max(0, Number(event.duration || 0));
    state.shatteringIceReadyAt = event.at;
    return;
  }
  if (kind !== "elemental empowerment" || event.affectsSelf === false) {
    return;
  }

  const state = catalystState.from(context);
  const expiresAt = event.at + Math.max(0, Number(event.duration || 0));
  const grantedStacks = Math.max(1, Number(event.stacks || 1));
  const active = state.elementalEmpowermentExpiries
    .filter((expiry) => expiry > event.at + EPSILON)
    .sort((left, right) => left - right);

  for (let stack = 0; stack < grantedStacks; stack += 1) {
    if (active.length >= MAXIMUM_TIMED_EMPOWERMENT_STACKS) active.shift();
    if (expiresAt > event.at + EPSILON) active.push(expiresAt);
    active.sort((left, right) => left - right);
  }

  state.elementalEmpowermentExpiries = active;
}

export function applyCatalystResolvedDamage(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
): void {
  const state = catalystState.from(context);
  if (
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    event.damageKind === "field-tick" ||
    event.isField ||
    state.shatteringIceUntil <= event.at + EPSILON ||
    state.shatteringIceReadyAt > event.at + EPSILON
  ) {
    return;
  }

  state.shatteringIceReadyAt = event.at + 1;
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: "Shattering Ice Proc",
    sourceId: event.skillId ?? event.sourceId,
    actorType: "effect",
    skillName: "Shattering Ice Proc",
    coefficient: 0.6,
    skillWeapon: "Unequipped",
    triggeredBy: event.skillName,
  });
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Shattering Ice Proc",
    sourceId: event.skillId ?? event.sourceId,
    actorType: "effect",
    skillName: "Shattering Ice Proc",
    condition: "Chilled",
    stacks: 1,
    duration: 1,
    triggeredBy: event.skillName,
  });
}
