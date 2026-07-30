import { createSimulationRandom } from "../../engine/simulation-random.js";
import { createRelicRuntime } from "../relic-rules.js";

import type {
  CreateGw2ResolverRuntimeStateOptions,
  Gw2DamageBreakdownEntry,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../types.js";

/**
 * Creates the mutable state for the full GW2 timeline resolver.
 * Profession state is supplied independently from common relic, sigil,
 * condition, damage, and reporting state.
 */
export function createGw2ResolverRuntimeState(
  {
    config,
    traits = new Set(),
    horizon,
    query,
    helpers,
    queue,
    professionState = {},
    warnings = [],
    eventFilterState = {},
  }: CreateGw2ResolverRuntimeStateOptions,
): Gw2ResolverRuntime {
  const runtime: Gw2ResolverRuntime = {
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
    weaponStrengthRolls: new Map(),
    weaponStrengthActivationOrder: 0,

    recordProc(
      type: string,
      name: string,
      at: number,
      sourceSkill = "",
      detail = "",
      icon = "",
      cooldownReduction: number | null = null,
    ): void {
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

    addBreakdown(
      name: string,
      damage: number,
      type: "strikeDamage" | "conditionDamage",
      hits = 0,
      source: Gw2ResolverEvent | null = null,
    ): void {
      const sourceSkill = source?.skillName || source?.name || name;
      const parentSkill = source?.parentSkillName || "";
      const skillId = source?.skillId ?? null;
      const sourceId = source?.sourceId ?? skillId ?? sourceSkill;
      const identityId = skillId ?? sourceId;
      const key = source
        ? `${String(identityId)}|${parentSkill}|${name}`
        : name;
      const current: Gw2DamageBreakdownEntry =
        this.breakdown.get(key) || {
        name,
        sourceSkill,
        parentSkill,
        icon: source?.icon || "",
        skillId,
        sourceId,
        actorType: source?.actorType,
        source: source?.source,
        damage: 0,
        strikeDamage: 0,
        conditionDamage: 0,
        hits: 0,
        };
      if (current.skillId == null && source?.skillId != null) {
        current.skillId = source.skillId;
      }
      if (current.sourceId == null && sourceId != null) {
        current.sourceId = sourceId;
      }
      if (!current.actorType && source?.actorType) {
        current.actorType = source.actorType;
      }
      if (!current.source && source?.source) {
        current.source = source.source;
      }
      current.damage += damage;
      current[type] += damage;
      current.hits += hits;
      this.breakdown.set(key, current);
    },

    markDamageTime(at: number): void {
      if (this.firstHitTime == null) this.firstHitTime = at;
      this.lastHitTime = at;
    },
  };
  return runtime;
}
