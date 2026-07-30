import { isInternalCooldownReady } from "../../engine/internal-cooldown.js";
import { SIGIL_PROCS } from "../gear-data.js";
import {
  GW2_EVENT_ACTOR_TYPES,
  gw2EventActorType,
  isGw2PlayerActorEvent,
} from "../event-ownership.js";
import { createGw2CombatQuery, selectedGw2TraitValues } from "../query.js";
import { canonicalTargetConditionName } from "../target-state.js";

export const GW2_MATERIALIZE_EVENT_TASK = "platform.gw2.materialize-event";

// Materializer work runs before ordinary same-time profession tasks but after
// core cast completion tasks. Derived events still receive causal event order.
const MATERIALIZER_TASK_PRIORITY = -60;
const PROC_PROGRESS_TOLERANCE = 1e-9;
const OBSERVED_EVENT_TYPES = new Set([
  "combat_start",
  "buff",
  "damage",
  "condition",
  "control",
  "blind",
  "weapon_set",
  "sigil_swap",
]);

function conditionName(value) {
  return canonicalTargetConditionName(value);
}

function activeSigilNames(config, weaponSet) {
  return config.sigilSets?.[Math.max(1, weaponSet) - 1]?.names || [];
}

/**
 * Chronologically materializes shared GW2 trigger effects before the resolver
 * handoff. Numeric damage and condition resolution remain resolver-owned.
 */
export function createGw2TriggerMaterializer(
  config = {},
  { traits = null } = {},
) {
  const configuredProcNames = new Set(
    (config.sigilSets || [])
      .flatMap((set) => set?.names || [])
      .filter((name) => SIGIL_PROCS[name]),
  );
  const hasProcSigils = configuredProcNames.size > 0;
  const hasCriticalSigils = [...configuredProcNames].some(
    (name) => SIGIL_PROCS[name].trigger === "crit",
  );
  const hasSwapSigils = [...configuredProcNames].some(
    (name) => SIGIL_PROCS[name].trigger === "swap",
  );
  // This deliberately mirrors the subset of resolver state consumed by combat
  // queries. It computes trigger facts only; numeric damage remains resolver-owned.
  const state = {
    config,
    traits,
    query: null,
    state: null,
    profession: null,
    activeWeaponSet: Number(config.startingWeaponSet) === 2 ? 2 : 1,
    combatActive: false,
    combatBeganAt: null,
    criticalFactsRequired: hasCriticalSigils,
    boons: new Map(),
    conditionState: new Map(),
    totals: { strike: 0, condition: 0 },
    relic: { buffUntil: 0 },
    sigil: {
      readyAt: new Map(),
      criticalProgress: 0,
      doomPending: false,
      severanceUntil: 0,
    },
  };

  const sigilReady = (name, at) =>
    isInternalCooldownReady(at, state.sigil.readyAt.get(name) || 0);
  const armSigil = (name, at, cooldown) => {
    state.sigil.readyAt.set(name, at + cooldown);
  };
  const emitProc = (context, cause, name, sourceSkill = "") =>
    context.emitDerived(cause, {
      type: "proc",
      procType: "sigil",
      at: cause.at,
      name: `Sigil of ${name}`,
      sourceSkill,
      source: "Sigil",
      sourceId: `sigil.${name.toLowerCase()}`,
      actorType: "effect",
      icon: SIGIL_PROCS[name]?.icon || "",
    });
  const emitCondition = (context, cause, name, proc) =>
    context.emitDerived(cause, {
      type: "condition",
      at: cause.at,
      name: `Sigil of ${name} — ${proc.condition}`,
      skillName: `Sigil of ${name}`,
      condition: proc.condition,
      duration: proc.duration,
      stacks: proc.stacks,
      source: "Sigil",
      sourceId: `sigil.${name.toLowerCase()}`,
      actorType: "effect",
    });
  const emitStrike = (context, cause, name, proc) =>
    context.emitDerived(cause, {
      type: "damage",
      at: cause.at,
      name: `Sigil of ${name}`,
      skillName: `Sigil of ${name}`,
      coefficient: proc.coefficient,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "Sigil",
      sourceId: `sigil.${name.toLowerCase()}`,
      actorType: "effect",
      weaponStrength: proc.weaponStrength,
      skillWeapon: "Unequipped",
      noCrit: !proc.canCrit,
    });
  const restoreEndurance = (context, cause, name, proc) => {
    const profession = state.profession;
    const maximum = Number(profession?.maximumEndurance);
    const current = Number(profession?.endurance);
    if (!Number.isFinite(maximum) || !Number.isFinite(current)) return;
    const amount = Math.max(0, Number(proc.amount || 0));
    profession.endurance = Math.min(maximum, current + amount);
    profession.enduranceUpdatedAt = cause.at;
    context.emitDerived(cause, {
      type: "resource",
      at: cause.at,
      name: `Sigil of ${name} — endurance`,
      resource: "endurance",
      amount,
      source: "Sigil",
      sourceId: `sigil.${name.toLowerCase()}`,
      actorType: "effect",
    });
  };

  const beforeExplicitCombatStart = (context, event) =>
    context.hasExplicitCombatStart &&
    (context.combatStartTime == null || event.at < context.combatStartTime);
  const activateCombat = (at) => {
    if (!state.combatActive) {
      state.combatBeganAt = Number(at);
    }
    state.combatActive = true;
  };
  const markCombatActive = (context, event) => {
    // An explicit marker creates a hard pre-combat boundary. Without one, the
    // first player/summon combat event starts combat implicitly.
    if (beforeExplicitCombatStart(context, event)) return false;
    const actorType = gw2EventActorType(event);
    if (
      actorType === GW2_EVENT_ACTOR_TYPES.PLAYER ||
      actorType === GW2_EVENT_ACTOR_TYPES.SUMMON
    ) {
      activateCombat(event.at);
    }
    return state.combatActive;
  };
  const recordBuff = (event) => {
    const kind = String(event.kind || "").toLowerCase();
    const applications = state.boons.get(kind) || [];
    applications.push({
      at: event.at,
      expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
      stacks: Math.max(1, Number(event.stacks || 1)),
    });
    // Historical applications stay in the map because combat queries ask about
    // arbitrary event timestamps, not only the scheduler's current clock.
    state.boons.set(kind, applications);
  };
  const recordCondition = (event) => {
    const name = conditionName(event.condition);
    const stats = state.query.statsAt(event.at, event, state);
    const durationMultiplier = event.fixedDuration
      ? 1
      : state.query.conditionDurationMultiplier(
          name,
          event.at,
          stats,
          event,
          state,
        );
    const baseDurationMultiplier = event.fixedDuration
      ? 1
      : (state.query.conditionBaseDurationMultiplier?.(
          name,
          event.at,
          event,
          state,
        ) ?? 1);
    const duration =
      Math.max(0, Number(event.duration || 0)) *
      baseDurationMultiplier *
      durationMultiplier;
    const stacks = Math.max(0, Number(event.stacks || 0));
    if (!(duration > 0) || !(stacks > 0)) return;
    const entry = state.conditionState.get(name) || { stacks: [] };
    entry.stacks.push({
      appliedAt: event.at,
      expiresAt: event.at + duration,
      weight: stacks,
    });
    state.conditionState.set(name, entry);
  };

  const materializeCriticalSigils = (context, event) => {
    if (
      (!isGw2PlayerActorEvent(event) &&
        event.canTriggerCriticalSigils !== true) ||
      !(event.coefficient > 0)
    )
      return;
    const names = activeSigilNames(config, state.activeWeaponSet).filter(
      (name) => SIGIL_PROCS[name]?.trigger === "crit",
    );
    if (!names.length) return;
    const critical = state.query.critical(event, event.at, state);
    if (!(critical.chance > 0)) return;

    // Accumulate expected critical hits deterministically. Crossing one expected
    // crit gives every equipped, ready on-crit sigil the same trigger event.
    state.sigil.criticalProgress += critical.chance;
    if (state.sigil.criticalProgress < 1 - PROC_PROGRESS_TOLERANCE) return;
    state.sigil.criticalProgress -= 1;

    for (const name of names) {
      const proc = SIGIL_PROCS[name];
      if (!sigilReady(name, event.at)) continue;
      armSigil(name, event.at, proc.cooldown);
      if (proc.effect === "strike") {
        emitStrike(context, event, name, proc);
      } else if (proc.effect === "condition") {
        emitCondition(context, event, name, proc);
      }
      emitProc(context, event, name, event.skillName);
    }
  };

  const consumeDoom = (context, event) => {
    if (
      !state.sigil.doomPending ||
      !isGw2PlayerActorEvent(event) ||
      !(event.coefficient > 0)
    )
      return;
    state.sigil.doomPending = false;
    // Doom records its proc on the consuming hit, not when the swap arms it.
    emitCondition(context, event, "Doom", SIGIL_PROCS.Doom);
    emitProc(context, event, "Doom", event.skillName);
  };

  const materializeSwapSigils = (context, event) => {
    if (!state.combatActive) return;
    const sourceSkill = event.skillName || "Swap Weapons";
    const weaponSet =
      Number(event.weaponSet) === 2
        ? 2
        : Number(event.weaponSet) === 1
          ? 1
          : state.activeWeaponSet;
    // Swap effects belong to the set that becomes active. This also lets a
    // synthetic sigil_swap event state its set without mutating global state.
    for (const name of activeSigilNames(config, weaponSet)) {
      const proc = SIGIL_PROCS[name];
      if (proc?.trigger !== "swap" || !sigilReady(name, event.at)) continue;
      armSigil(name, event.at, proc.cooldown);
      if (proc.effect === "next-hit-condition") {
        // Arming emits nothing yet; the next eligible player strike owns the
        // condition event and trigger attribution.
        state.sigil.doomPending = true;
        continue;
      }
      if (proc.effect === "condition") {
        emitCondition(context, event, name, proc);
      } else if (
        proc.effect === "strike" ||
        proc.effect === "strike-condition"
      ) {
        emitStrike(context, event, name, proc);
        if (proc.condition) emitCondition(context, event, name, proc);
      } else if (proc.effect === "endurance") {
        restoreEndurance(context, event, name, proc);
      }
      emitProc(context, event, name, sourceSkill);
    }
  };

  const materializeControlSigils = (context, event) => {
    for (const name of activeSigilNames(config, state.activeWeaponSet)) {
      const proc = SIGIL_PROCS[name];
      if (proc?.trigger !== "control" || !sigilReady(name, event.at)) continue;
      armSigil(name, event.at, proc.cooldown);
      if (proc.effect === "severance") {
        state.sigil.severanceUntil = Math.max(
          state.sigil.severanceUntil,
          event.at + proc.duration,
        );
        context.emitDerived(event, {
          type: "buff",
          at: event.at,
          kind: "sigil-severance",
          stacks: 1,
          duration: proc.duration,
          source: "Sigil",
          sourceId: "sigil.severance",
          actorType: "effect",
        });
      }
      emitProc(context, event, name, event.skillName);
    }
  };

  const processEvent = (context, event) => {
    // Observation tasks process the scheduler's immutable canonical event. Any
    // proc output is emitted as a derived event and re-enters observation later.
    switch (event.type) {
      case "combat_start":
        activateCombat(event.at);
        break;
      case "buff":
        if (
          event.kind !== "target-vulnerability" ||
          !beforeExplicitCombatStart(context, event)
        ) {
          recordBuff(event);
        }
        break;
      case "condition":
        if (!markCombatActive(context, event)) break;
        recordCondition(event);
        break;
      case "damage":
        markCombatActive(context, event);
        if (!state.combatActive) break;
        materializeCriticalSigils(context, event);
        consumeDoom(context, event);
        break;
      case "control":
        markCombatActive(context, event);
        if (state.combatActive) {
          materializeControlSigils(context, event);
        }
        break;
      case "blind":
        markCombatActive(context, event);
        break;
      case "weapon_set":
        // Update first so the swap reads sigils on the newly active set.
        state.activeWeaponSet = Number(event.weaponSet) === 2 ? 2 : 1;
        materializeSwapSigils(context, event);
        break;
      case "sigil_swap":
        materializeSwapSigils(context, event);
        break;
      default:
        break;
    }
  };

  return Object.freeze({
    state,
    initialize(context) {
      state.traits =
        traits || selectedGw2TraitValues(config, context.profession.catalog);
      state.state = context.state;
      state.profession = context.state.profession;
      state.activeWeaponSet = context.state.activeWeaponSet;
      state.query = createGw2CombatQuery({
        profession: context.profession,
        config,
        events: context.events,
        traits: state.traits,
      });
    },
    onEventScheduled(context, event) {
      if (!OBSERVED_EVENT_TYPES.has(event.type)) return;
      const needsCriticalFacts = state.criticalFactsRequired;
      const tracksCombat = [
        "combat_start",
        "damage",
        "condition",
        "control",
        "blind",
      ].includes(event.type);
      const relevant =
        tracksCombat ||
        (event.type === "buff" && needsCriticalFacts) ||
        (event.type === "damage" && (needsCriticalFacts || hasProcSigils)) ||
        (event.type === "condition" && (needsCriticalFacts || hasProcSigils)) ||
        (event.type === "control" && hasProcSigils) ||
        (event.type === "blind" && hasProcSigils) ||
        (event.type === "weapon_set" && hasProcSigils) ||
        (event.type === "sigil_swap" && hasSwapSigils);
      if (!relevant) return;
      // Deferring to the task queue avoids recursive mutation inside the
      // scheduler's event-observation callback and preserves chronology.
      context.tasks.schedule({
        type: GW2_MATERIALIZE_EVENT_TASK,
        at: Math.max(context.state.time, event.at),
        priority: MATERIALIZER_TASK_PRIORITY,
        payload: { event },
      });
    },
    handleTask(context, task) {
      processEvent(context, task.payload.event);
    },
    critical(event) {
      return state.query.critical(event, event.at, state);
    },
    isCombatActive() {
      return state.combatActive;
    },
    combatBeganAt() {
      return state.combatBeganAt;
    },
    requireCriticalFacts() {
      // Professions can request critical-state tracking even when the build has
      // no on-crit sigil (for example, for their own scheduled trigger rules).
      state.criticalFactsRequired = true;
    },
  });
}
