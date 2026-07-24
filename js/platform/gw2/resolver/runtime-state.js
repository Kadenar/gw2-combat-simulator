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
    totals: {
      strike: 0,
      condition: 0,
    },
    firstHitTime: null,
    lastHitTime: null,
    deathTime: null,
    relic: {
      buffUntil: 0,
      thiefStacks: 0,
      thiefUntil: 0,
      aristocracyStacks: 0,
      aristocracyUntil: 0,
      aristocracyReadyAt: 0,
      fractalReadyAt: 0,
      akeemReadyAt: 0,
      peithaReadyAt: 0,
      thornsStacks: 0,
    },
    profession: professionState,
    sigil: {
      readyAt: new Map(),
      criticalProgress: 0,
      doomPending: false,
      severanceUntil: 0,
    },

    recordProc(type, name, at, sourceSkill = "", detail = "", icon = "") {
      const start = Math.round(at * 1000);
      const key = `${type}|${name}|${start}|${sourceSkill}`;
      if (this.procKeys.has(key)) return;
      this.procKeys.add(key);
      this.procSteps.push({
        ri: -1,
        type: `${type}_proc`,
        skill: name,
        sourceSkill,
        detail,
        icon,
        start,
        end: start,
      });
    },

    addBreakdown(name, damage, type, hits = 0) {
      const current = this.breakdown.get(name) || {
        name,
        damage: 0,
        strikeDamage: 0,
        conditionDamage: 0,
        hits: 0,
      };
      current.damage += damage;
      current[type] += damage;
      current.hits += hits;
      this.breakdown.set(name, current);
    },

    markDamageTime(at) {
      if (this.firstHitTime == null) this.firstHitTime = at;
      this.lastHitTime = at;
    },
  };
}
