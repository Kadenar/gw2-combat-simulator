import {
  isInternalCooldownReady,
} from "../../engine/internal-cooldown.js";
import {
  SIGIL_PROCS,
} from "../gear-data.js";
import {
  GW2_EVENT_ACTOR_TYPES,
  gw2EventActorType,
  isGw2PlayerActorEvent,
} from "../event-ownership.js";
import {
  createGw2CombatQuery,
  selectedGw2TraitValues,
} from "../query.js";

export const GW2_MATERIALIZE_EVENT_TASK =
  "platform.gw2.materialize-event";

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
  const normalized = String(value || "").toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") {
    return "Poisoned";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
      .flatMap(set => set?.names || [])
      .filter(name => SIGIL_PROCS[name]),
  );
  const hasProcSigils = configuredProcNames.size > 0;
  const hasCriticalSigils = [...configuredProcNames].some(name =>
    SIGIL_PROCS[name].trigger === "crit");
  const hasSwapSigils = [...configuredProcNames].some(name =>
    SIGIL_PROCS[name].trigger === "swap");
  const state = {
    config,
    traits,
    query: null,
    state: null,
    profession: null,
    activeWeaponSet: Number(config.startingWeaponSet) === 2 ? 2 : 1,
    combatActive: false,
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

  const beforeExplicitCombatStart = (context, event) =>
    context.hasExplicitCombatStart
    && (
      context.combatStartTime == null
      || event.at < context.combatStartTime
    );
  const markCombatActive = (context, event) => {
    if (beforeExplicitCombatStart(context, event)) return false;
    const actorType = gw2EventActorType(event);
    if (
      actorType === GW2_EVENT_ACTOR_TYPES.PLAYER
      || actorType === GW2_EVENT_ACTOR_TYPES.SUMMON
    ) {
      state.combatActive = true;
    }
    return state.combatActive;
  };
  const recordBuff = event => {
    const kind = String(event.kind || "").toLowerCase();
    const applications = state.boons.get(kind) || [];
    applications.push({
      at: event.at,
      expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
      stacks: Math.max(1, Number(event.stacks || 1)),
    });
    state.boons.set(kind, applications);
  };
  const recordCondition = event => {
    const name = conditionName(event.condition);
    const stats = state.query.statsAt(event.at, event, state);
    const duration = Math.max(0, Number(event.duration || 0))
      * state.query.conditionDurationMultiplier(
        name,
        event.at,
        stats,
        event,
        state,
      );
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
    if (!isGw2PlayerActorEvent(event) || !(event.coefficient > 0)) return;
    const names = activeSigilNames(config, state.activeWeaponSet)
      .filter(name => SIGIL_PROCS[name]?.trigger === "crit");
    if (!names.length) return;
    const critical = state.query.critical(event, event.at, state);
    if (!(critical.chance > 0)) return;

    state.sigil.criticalProgress += critical.chance;
    if (
      state.sigil.criticalProgress
      < 1 - PROC_PROGRESS_TOLERANCE
    ) return;
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
      !state.sigil.doomPending
      || !isGw2PlayerActorEvent(event)
      || !(event.coefficient > 0)
    ) return;
    state.sigil.doomPending = false;
    emitCondition(context, event, "Doom", SIGIL_PROCS.Doom);
    emitProc(context, event, "Doom", event.skillName);
  };

  const materializeSwapSigils = (context, event) => {
    if (!state.combatActive) return;
    const sourceSkill = event.skillName || "Swap Weapons";
    const weaponSet = Number(event.weaponSet) === 2
      ? 2
      : Number(event.weaponSet) === 1
        ? 1
        : state.activeWeaponSet;
    for (const name of activeSigilNames(config, weaponSet)) {
      const proc = SIGIL_PROCS[name];
      if (
        proc?.trigger !== "swap"
        || !sigilReady(name, event.at)
      ) continue;
      armSigil(name, event.at, proc.cooldown);
      if (proc.effect === "next-hit-condition") {
        state.sigil.doomPending = true;
        continue;
      }
      if (proc.effect === "condition") {
        emitCondition(context, event, name, proc);
      } else if (
        proc.effect === "strike"
        || proc.effect === "strike-condition"
      ) {
        emitStrike(context, event, name, proc);
        if (proc.condition) emitCondition(context, event, name, proc);
      }
      emitProc(context, event, name, sourceSkill);
    }
  };

  const materializeControlSigils = (context, event) => {
    for (const name of activeSigilNames(config, state.activeWeaponSet)) {
      const proc = SIGIL_PROCS[name];
      if (
        proc?.trigger !== "control"
        || !sigilReady(name, event.at)
      ) continue;
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
    switch (event.type) {
      case "combat_start":
        state.combatActive = true;
        break;
      case "buff":
        if (
          event.kind !== "target-vulnerability"
          || !beforeExplicitCombatStart(context, event)
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
        state.activeWeaponSet =
          Number(event.weaponSet) === 2 ? 2 : 1;
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
        traits
        || selectedGw2TraitValues(config, context.profession.catalog);
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
      const relevant = (
        (event.type === "combat_start" && hasProcSigils)
        || (event.type === "buff" && needsCriticalFacts)
        || (
          event.type === "damage"
          && (needsCriticalFacts || hasProcSigils)
        )
        || (
          event.type === "condition"
          && (needsCriticalFacts || hasProcSigils)
        )
        || (
          event.type === "control"
          && hasProcSigils
        )
        || (event.type === "blind" && hasProcSigils)
        || (
          (event.type === "weapon_set" || event.type === "sigil_swap")
          && hasSwapSigils
        )
      );
      if (!relevant) return;
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
    requireCriticalFacts() {
      state.criticalFactsRequired = true;
    },
  });
}
