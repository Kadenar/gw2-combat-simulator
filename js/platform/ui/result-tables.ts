import type {
  SimulationActorType,
  SkillId,
} from "../engine/types.js";
import { gw2EventActorType } from "../gw2/event-ownership.js";
import type {
  Gw2DamageBreakdownEntry,
  Gw2ResolverEvent,
  Gw2ResolverResult,
} from "../gw2/types.js";

export interface SkillBreakdownRow {
  readonly [field: string]: unknown;
  readonly name: string;
  readonly sourceSkill: string;
  readonly parentSkill: string;
  readonly icon: string;
  readonly skillId: SkillId | null;
  readonly sourceId: SkillId | null;
  readonly actorType: SimulationActorType;
  readonly group: "Player" | "Entities";
  readonly strike: number;
  readonly condition: number;
  readonly hits: number;
  readonly casts: number;
  readonly total: number;
  readonly dps: number;
  readonly average: number | null;
  readonly dct: number | null;
}

interface GroupedSkillBreakdown {
  name: string;
  sourceSkill: string;
  parentSkill: string;
  icon: string;
  skillId: SkillId | null;
  sourceId: SkillId | null;
  actorType: SimulationActorType;
  group: "Player" | "Entities";
  strike: number;
  condition: number;
  hits: number;
  fallbackCasts: number;
}

// Generated breakdown names commonly append "— Effect"; the prefix is the
// final attribution fallback when no explicit source skill survives resolution.
const baseName = (name: unknown): string =>
  String(name || "")
    .split("—")[0]!
    .trim();

function breakdownActorType(
  entry: Gw2DamageBreakdownEntry,
  sourceEvent: Gw2ResolverEvent | undefined,
): SimulationActorType {
  const explicit = entry.actorType ?? sourceEvent?.actorType;
  if (explicit === "phantasm") return explicit;
  return gw2EventActorType({
    actorType: explicit,
    source: entry.source ?? sourceEvent?.source,
  });
}

const breakdownGroup = (
  actorType: SimulationActorType,
): "Player" | "Entities" =>
  actorType === "summon" || actorType === "phantasm"
    ? "Entities"
    : "Player";

const eventIdentity = (
  id: SkillId | null | undefined,
  name: string,
): string => id == null ? "" : `${String(id)}|${name}`;

export function skillBreakdownRows(
  result: Gw2ResolverResult,
): SkillBreakdownRow[] {
  // Canonical action events are the authoritative source for cast count/time.
  const actionDurations = new Map<string, number>();
  const actionCounts = new Map<string, number>();
  for (const event of result.events || []) {
    if (event.type !== "action") continue;
    const name = String(event.skillName || event.name || event.sourceId);
    actionDurations.set(
      name,
      (actionDurations.get(name) || 0) +
        Math.max(0, Number(event.endsAt || event.at) - Number(event.at || 0)),
    );
    actionCounts.set(name, (actionCounts.get(name) || 0) + 1);
  }
  const resolvedByName = new Map<string, Gw2ResolverEvent>();
  const resolvedByIdentity = new Map<string, Gw2ResolverEvent>();
  for (const event of result.resolvedEvents || []) {
    // One representative event is enough to recover source/parent attribution.
    if (event.name && !resolvedByName.has(event.name)) {
      resolvedByName.set(event.name, event);
    }
    if (!event.name) continue;
    for (const id of [event.skillId, event.sourceId]) {
      const identity = eventIdentity(id, event.name);
      if (identity && !resolvedByIdentity.has(identity)) {
        resolvedByIdentity.set(identity, event);
      }
    }
  }
  const grouped = new Map<string, GroupedSkillBreakdown>();
  for (const entry of result.breakdown || []) {
    const sourceEvent =
      resolvedByIdentity.get(eventIdentity(entry.skillId, entry.name)) ||
      resolvedByIdentity.get(eventIdentity(entry.sourceId, entry.name)) ||
      resolvedByName.get(entry.name);
    const sourceSkill =
      entry.sourceSkill || sourceEvent?.skillName || baseName(entry.name);
    const parentSkill = entry.parentSkill || sourceEvent?.parentSkillName || "";
    const icon = entry.icon || sourceEvent?.icon || "";
    const skillId = entry.skillId ?? sourceEvent?.skillId ?? null;
    const sourceId = entry.sourceId ?? sourceEvent?.sourceId ?? null;
    const actorType = breakdownActorType(entry, sourceEvent);
    const group = breakdownGroup(actorType);
    const groupKey = `${group}|${sourceSkill}`;
    const current = grouped.get(groupKey) || {
      name: sourceSkill,
      sourceSkill,
      parentSkill,
      icon,
      skillId,
      sourceId,
      actorType,
      group,
      strike: 0,
      condition: 0,
      hits: 0,
      fallbackCasts: 0,
    };
    if (!current.parentSkill && parentSkill) current.parentSkill = parentSkill;
    if (!current.icon && icon) current.icon = icon;
    if (current.skillId == null && skillId != null) current.skillId = skillId;
    if (current.sourceId == null && sourceId != null) {
      current.sourceId = sourceId;
    }
    current.strike += Number(entry.strikeDamage || 0);
    current.condition += Number(entry.conditionDamage || 0);
    current.hits += Number(entry.hits || 0);
    current.fallbackCasts = Math.max(
      current.fallbackCasts,
      Number(entry.casts || 0),
    );
    grouped.set(groupKey, current);
  }
  return [...grouped.values()]
    .map((entry): SkillBreakdownRow => {
      // Older breakdown producers supplied casts directly; use that only when
      // no canonical action count is available.
      const casts = Number(
        actionCounts.get(entry.sourceSkill) ?? entry.fallbackCasts,
      );
      const total = entry.strike + entry.condition;
      const castTime = Number(actionDurations.get(entry.sourceSkill) || 0);
      return {
        name: entry.name,
        sourceSkill: entry.sourceSkill,
        parentSkill: entry.parentSkill,
        icon: entry.icon,
        skillId: entry.skillId,
        sourceId: entry.sourceId,
        actorType: entry.actorType,
        group: entry.group,
        strike: entry.strike,
        condition: entry.condition,
        hits: entry.hits,
        total,
        dps:
          total /
          Math.max(0.001, Number(result.dpsWindow ?? result.duration ?? 0)),
        average: casts > 0 ? total / casts : null,
        // DCT is damage divided by occupied cast time, not encounter duration.
        dct: castTime > 0 ? total / castTime : null,
        casts,
      };
    })
    .filter((row) => row.total > 0)
    .sort((left, right) => right.total - left.total);
}
