import type { SimulationActorType, SkillId } from '../engine/types.js';
import { gw2EventActorType } from '../gw2/event-ownership.js';
import type { Gw2DamageBreakdownEntry, Gw2ResolverEvent, Gw2ResolverResult } from '../gw2/types.js';

export interface SkillBreakdownRow {
  readonly [field: string]: unknown;
  readonly name: string;
  readonly sourceSkill: string;
  readonly parentSkill: string;
  readonly icon: string;
  readonly skillId: SkillId | null;
  readonly sourceId: SkillId | null;
  readonly actorType: SimulationActorType;
  readonly group: 'Player' | 'Entities';
  readonly strike: number;
  readonly condition: number;
  readonly hits: number;
  readonly casts: number;
  readonly total: number;
  readonly dps: number;
  readonly average: number | null;
  readonly dct: number | null;
  // Stable identity shared with the chart's per-hit series (`group|name`), so a
  // clicked breakdown row can highlight its own damage over time.
  readonly key: string;
  // Average crit chance across this skill's strike hits (0-1), or null when the
  // row has no crit-eligible strike hits (pure-condition rows). critHits and
  // critEligibleHits back the hover tooltip.
  readonly critChance: number | null;
  readonly critHits: number;
  readonly critEligibleHits: number;
}

interface GroupedSkillBreakdown {
  name: string;
  sourceSkill: string;
  parentSkill: string;
  icon: string;
  skillId: SkillId | null;
  sourceId: SkillId | null;
  actorType: SimulationActorType;
  group: 'Player' | 'Entities';
  strike: number;
  condition: number;
  hits: number;
  critHits: number;
  critEligibleHits: number;
  fallbackCasts: number;
}

// Generated breakdown names commonly append "— Effect"; the prefix is the
// final attribution fallback when no explicit source skill survives resolution.
const baseName = (name: unknown): string =>
  String(name || '')
    .split('—')[0]!
    .trim();

function breakdownActorType(
  entry: Gw2DamageBreakdownEntry,
  sourceEvent: Gw2ResolverEvent | undefined
): SimulationActorType {
  const explicit = entry.actorType ?? sourceEvent?.actorType;
  if (explicit === 'phantasm') return explicit;
  return gw2EventActorType({
    actorType: explicit,
    source: entry.source ?? sourceEvent?.source
  });
}

const breakdownGroup = (actorType: SimulationActorType): 'Player' | 'Entities' =>
  actorType === 'summon' || actorType === 'phantasm' ? 'Entities' : 'Player';

const CHRONOPHANTASMA_SUFFIX = ' - Chronophantasma';
const PARENT_SKILL_SEPARATOR = ' \u2014 ';

function breakdownDisplayName(
  entry: Gw2DamageBreakdownEntry,
  sourceSkill: string,
  parentSkill: string,
  group: 'Player' | 'Entities',
  damageBreakdownName: string
): string {
  if (group !== 'Entities' || !parentSkill) return sourceSkill;
  let name = damageBreakdownName || String(entry.name || sourceSkill);
  const parentPrefix = `${parentSkill}${PARENT_SKILL_SEPARATOR}`;
  if (name.startsWith(parentPrefix)) name = name.slice(parentPrefix.length);
  return name.endsWith(CHRONOPHANTASMA_SUFFIX) ? name.slice(0, -CHRONOPHANTASMA_SUFFIX.length) : name;
}

const eventIdentity = (id: SkillId | null | undefined, name: string): string =>
  id == null ? '' : `${String(id)}|${name}`;

export const skillBreakdownKey = (group: 'Player' | 'Entities', name: string): string => `${group}|${name}`;

interface ResolvedLookup {
  readonly resolvedByName: Map<string, Gw2ResolverEvent>;
  readonly resolvedByIdentity: Map<string, Gw2ResolverEvent>;
}

// One representative resolved event per name/identity is enough to recover
// source/parent attribution for a breakdown entry.
function buildResolvedLookup(result: Gw2ResolverResult): ResolvedLookup {
  const resolvedByName = new Map<string, Gw2ResolverEvent>();
  const resolvedByIdentity = new Map<string, Gw2ResolverEvent>();
  for (const event of result.resolvedEvents || []) {
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
  return { resolvedByName, resolvedByIdentity };
}

interface BreakdownAttribution {
  readonly group: 'Player' | 'Entities';
  readonly name: string;
  readonly sourceSkill: string;
  readonly parentSkill: string;
  readonly icon: string;
  readonly skillId: SkillId | null;
  readonly sourceId: SkillId | null;
  readonly actorType: SimulationActorType;
}

function attributeBreakdownEntry(entry: Gw2DamageBreakdownEntry, lookup: ResolvedLookup): BreakdownAttribution {
  const sourceEvent =
    lookup.resolvedByIdentity.get(eventIdentity(entry.skillId, entry.name)) ||
    lookup.resolvedByIdentity.get(eventIdentity(entry.sourceId, entry.name)) ||
    lookup.resolvedByName.get(entry.name);
  const sourceSkill = entry.sourceSkill || sourceEvent?.skillName || baseName(entry.name);
  const parentSkill = entry.parentSkill || sourceEvent?.parentSkillName || '';
  const icon = entry.icon || sourceEvent?.icon || '';
  const skillId = entry.skillId ?? sourceEvent?.skillId ?? null;
  const sourceId = entry.sourceId ?? sourceEvent?.sourceId ?? null;
  const actorType = breakdownActorType(entry, sourceEvent);
  const group = breakdownGroup(actorType);
  const name = breakdownDisplayName(
    entry,
    sourceSkill,
    parentSkill,
    group,
    String(entry.damageBreakdownName || sourceEvent?.damageBreakdownName || '')
  );
  return {
    group,
    name,
    sourceSkill,
    parentSkill,
    icon,
    skillId,
    sourceId,
    actorType
  };
}

// Identity shared between a breakdown entry and the resolved damage/condition
// events it aggregates, mirroring the resolver's own breakdown key
// (`identityId|actor|parentSkill|name`). Using the full identity — not just the
// name — keeps sibling rows of one skill (e.g. a cast strike vs its field
// pulses) from collapsing into one chart bucket.
export function skillDamageIdentityKey(fields: {
  readonly skillId?: SkillId | null;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType | null;
  readonly source?: string | null;
  readonly parentSkill?: string | null;
  readonly name?: string | null;
}): string {
  const identityId = fields.skillId ?? fields.sourceId ?? '';
  const actorIdentity = fields.actorType ?? fields.source ?? '';
  return `${String(identityId)}|${String(actorIdentity)}|${fields.parentSkill || ''}|${fields.name || ''}`;
}

// Maps each resolved event identity to the grouped skill row key it belongs to,
// so per-hit chart series can be attributed to the exact rows the breakdown
// table renders.
export function skillDamageKeyByIdentity(result: Gw2ResolverResult): Map<string, string> {
  const lookup = buildResolvedLookup(result);
  const keyByIdentity = new Map<string, string>();
  for (const entry of result.breakdown || []) {
    const identity = skillDamageIdentityKey({
      skillId: entry.skillId,
      sourceId: entry.sourceId,
      actorType: entry.actorType,
      source: entry.source,
      parentSkill: entry.parentSkill,
      name: entry.name
    });
    if (keyByIdentity.has(identity)) continue;
    const { group, name } = attributeBreakdownEntry(entry, lookup);
    keyByIdentity.set(identity, skillBreakdownKey(group, name));
  }
  return keyByIdentity;
}

export function skillBreakdownRows(result: Gw2ResolverResult): SkillBreakdownRow[] {
  // Canonical action events are the authoritative source for cast count/time.
  const actionDurations = new Map<string, number>();
  const actionCounts = new Map<string, number>();
  for (const event of result.events || []) {
    if (event.type !== 'action') continue;
    const name = String(event.skillName || event.name || event.sourceId);
    actionDurations.set(
      name,
      (actionDurations.get(name) || 0) + Math.max(0, Number(event.endsAt || event.at) - Number(event.at || 0))
    );
    actionCounts.set(name, (actionCounts.get(name) || 0) + 1);
  }
  const lookup = buildResolvedLookup(result);
  const grouped = new Map<string, GroupedSkillBreakdown>();
  for (const entry of result.breakdown || []) {
    const { group, name, sourceSkill, parentSkill, icon, skillId, sourceId, actorType } = attributeBreakdownEntry(
      entry,
      lookup
    );
    const groupKey = skillBreakdownKey(group, name);
    const current = grouped.get(groupKey) || {
      name,
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
      critHits: 0,
      critEligibleHits: 0,
      fallbackCasts: 0
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
    current.critHits += Number(entry.critHits || 0);
    current.critEligibleHits += Number(entry.critEligibleHits || 0);
    current.fallbackCasts = Math.max(current.fallbackCasts, Number(entry.casts || 0));
    grouped.set(groupKey, current);
  }
  return [...grouped.values()]
    .map((entry): SkillBreakdownRow => {
      // Older breakdown producers supplied casts directly; use that only when
      // no canonical action count is available. Child effects are not casts
      // of their parent skill even when the resolver preserves that skill ID.
      const casts = Number(actionCounts.get(entry.sourceSkill) ?? (entry.parentSkill ? 0 : entry.fallbackCasts));
      const total = entry.strike + entry.condition;
      const castTime = Number(actionDurations.get(entry.sourceSkill) || 0);
      return {
        name: entry.name,
        key: skillBreakdownKey(entry.group, entry.name),
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
        dps: total / Math.max(0.001, Number(result.dpsWindow ?? result.duration ?? 0)),
        average: casts > 0 ? total / casts : null,
        // DCT is damage divided by occupied cast time, not encounter duration.
        dct: castTime > 0 ? total / castTime : null,
        casts,
        critChance: entry.critEligibleHits > 0 ? entry.critHits / entry.critEligibleHits : null,
        critHits: entry.critHits,
        critEligibleHits: entry.critEligibleHits
      };
    })
    .filter((row) => row.total > 0)
    .sort((left, right) => right.total - left.total);
}
