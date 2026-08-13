import { createSimulationRandom } from "../../engine/simulation-random.js";

import type {
  CreateGw2ResolverRuntimeStateOptions,
  Gw2CriticalResult,
  Gw2DamageBreakdownEntry,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../types.js";

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
  createEquipmentState,
}: CreateGw2ResolverRuntimeStateOptions): Gw2ResolverRuntime {
  const equipment = createEquipmentState(config);
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
    activeWeaponSet: Number(config.startingWeaponSet) === 2 ? 2 : 1,
    relic: equipment.relic,
    profession: professionState,
    sigil: equipment.sigil,
    food: equipment.food,
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
      critical: Gw2CriticalResult | null = null,
    ): void {
      const sourceSkill = source?.skillName || source?.name || name;
      const parentSkill = source?.parentSkillName || "";
      const skillId = source?.skillId ?? null;
      const sourceId = source?.sourceId ?? skillId ?? sourceSkill;
      const identityId = skillId ?? sourceId;
      const actorIdentity = source?.actorType ?? source?.source ?? "";
      const key = source
        ? `${String(identityId)}|${actorIdentity}|${parentSkill}|${name}`
        : name;
      const current: Gw2DamageBreakdownEntry = this.breakdown.get(key) || {
        name,
        sourceSkill,
        parentSkill,
        damageBreakdownName: source?.damageBreakdownName,
        icon: source?.icon || "",
        skillId,
        sourceId,
        actorType: source?.actorType,
        source: source?.source,
        damage: 0,
        strikeDamage: 0,
        conditionDamage: 0,
        hits: 0,
        critHits: 0,
        critEligibleHits: 0,
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
      // Crit accounting only makes sense for strike hits. In stochastic runs
      // didCrit is a per-event boolean (all hits of the event share it); in
      // deterministic runs it is null, so expected crits = chance * hits.
      if (type === "strikeDamage" && critical) {
        const eligible = Number(hits) || 0;
        current.critEligibleHits = (current.critEligibleHits || 0) + eligible;
        const critShare =
          critical.didCrit === true
            ? eligible
            : critical.didCrit === false
              ? 0
              : Number(critical.chance || 0) * eligible;
        current.critHits = (current.critHits || 0) + critShare;
      }
      this.breakdown.set(key, current);
    },

    markDamageTime(at: number): void {
      if (this.firstHitTime == null) this.firstHitTime = at;
      this.lastHitTime = at;
    },
  };
  return runtime;
}
