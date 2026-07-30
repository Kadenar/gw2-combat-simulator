import { createSimulationRandom } from "../../engine/simulation-random.js";
import { createRelicRuntime } from "../relic-rules.js";

/**
 * Creates the mutable state for the full GW2 timeline resolver.
 * Profession state is supplied independently from common relic, sigil,
 * condition, damage, and reporting state.
 */
export function createGw2ResolverRuntimeState({
  config,
  traits = new Set(),
  horizon,
  query,
  helpers,
  queue,
  professionState = {},
  warnings = [],
  eventFilterState = {},
} = {}) {
  return {
    config,
    traits,
    horizon,
    query,
    helpers,
    queue,
    warnings,
    eventFilterState,
    breakdown: new Map(),
    conditions: new Map(),
    conditionState: new Map(),
    conditionApplications: [],
    resolved: [],
    procSteps: [],
    procKeys: new Set(),
    boons: new Map(),
    totals: {
      strike: 0,
      condition: 0,
    },
    firstHitTime: null,
    lastHitTime: null,
    deathTime: null,
    combatActive: false,
    activeWeaponSet: Number(config.startingWeaponSet) === 2 ? 2 : 1,
    relic: createRelicRuntime(config.relic),
    profession: professionState,
    sigil: {
      severanceUntil: 0,
    },
    food: {
      criticalProgress: 0,
      readyAt: 0,
    },
    random: createSimulationRandom(config.randomness),

    recordProc(
      type,
      name,
      at,
      sourceSkill = "",
      detail = "",
      icon = "",
      cooldownReduction = null,
    ) {
      const start = Math.round(at * 1000);
      const key = `${type}|${name}|${start}|${sourceSkill}`;
      if (this.procKeys.has(key)) return;
      this.procKeys.add(key);
      const reducedBy = Number(cooldownReduction);
      this.procSteps.push({
        ri: -1,
        type: `${type}_proc`,
        skill: name,
        sourceSkill,
        detail,
        icon,
        ...(Number.isFinite(reducedBy) && reducedBy > 0
          ? { cooldownReduction: reducedBy }
          : {}),
        start,
        end: start,
      });
    },

    addBreakdown(name, damage, type, hits = 0, source = null) {
      const sourceSkill = source?.skillName || source?.name || name;
      const parentSkill = source?.parentSkillName || "";
      const sourceId = source?.skillId ?? source?.sourceId ?? sourceSkill;
      const key = source ? `${String(sourceId)}|${parentSkill}|${name}` : name;
      const current = this.breakdown.get(key) || {
        name,
        sourceSkill,
        parentSkill,
        icon: source?.icon || "",
        damage: 0,
        strikeDamage: 0,
        conditionDamage: 0,
        hits: 0,
      };
      current.damage += damage;
      current[type] += damage;
      current.hits += hits;
      this.breakdown.set(key, current);
    },

    markDamageTime(at) {
      if (this.firstHitTime == null) this.firstHitTime = at;
      this.lastHitTime = at;
    },
  };
}
