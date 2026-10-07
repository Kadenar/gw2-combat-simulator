import type { SimulationActorType } from '#gw2/platform/events/actors.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2DamageBreakdownEntry } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverResult } from '#gw2/platform/results/types.js';

export interface SkillBreakdownRow {
  readonly [field: string]: unknown;
  readonly name: string;
  readonly sourceSkill: string;
  readonly parentSkill: string;
  readonly icon: string;
  readonly skillId: SkillId | null;
  readonly sourceId: SkillId | null;
  readonly actorType: SimulationActorType;
  readonly group: 'Player' | 'Entities' | 'Environment';
  readonly strike: number;
  readonly condition: number;
  readonly hits: number;
  readonly procCount: number;
  readonly casts: number;
  readonly total: number;
  readonly dps: number;
  readonly average: number | null;
  readonly dct: number | null;
  readonly procDamage: readonly { sourceSkill: string; total: number; dps: number }[];
  // Stable identity shared with the chart's per-hit series (`group|name`), so a
  // clicked breakdown row can highlight its own damage over time.
  readonly key: string;
  // Fraction of eligible strikes with successful seeded critical rolls (0-1), or null when the
  // row has no crit-eligible strike hits (pure-condition rows). critHits and
  // critEligibleHits back the hover tooltip.
  readonly critChance: number | null;
  readonly critHits: number;
  readonly critEligibleHits: number;
}

interface GroupedSkillBreakdown {
  name: string;
  sourceSkill: string;
  sourceSkills: Set<string>;
  parentSkill: string;
  icon: string;
  skillId: SkillId | null;
  sourceId: SkillId | null;
  actorType: SimulationActorType;
  group: 'Player' | 'Entities' | 'Environment';
  strike: number;
  condition: number;
  hits: number;
  critHits: number;
  critEligibleHits: number;
  fallbackCasts: number;
}

// Generated breakdown names commonly append "— Effect"; the prefix is the
// final attribution fallback when no explicit source skill survives resolution.
export const baseBreakdownName = (name: unknown): string =>
  String(name || '')
    .split('—')[0]!
    .trim();

const breakdownGroup = (actorType: SimulationActorType): 'Player' | 'Entities' | 'Environment' =>
  actorType === 'summon' ? 'Entities' : actorType === 'environment' ? 'Environment' : 'Player';

const CHRONOPHANTASMA_SUFFIX = ' - Chronophantasma';
const PARENT_SKILL_SEPARATOR = ' \u2014 ';

function breakdownDisplayName(
  entry: Gw2DamageBreakdownEntry,
  sourceSkill: string,
  parentSkill: string,
  group: 'Player' | 'Entities' | 'Environment',
  damageBreakdownName: string
): string {
  // Player effects can opt into a separate row without losing parent-skill cast attribution.
  if (group !== 'Entities' || !parentSkill) return damageBreakdownName || sourceSkill;
  let name = damageBreakdownName || String(entry.name || sourceSkill);
  const parentPrefix = `${parentSkill}${PARENT_SKILL_SEPARATOR}`;
  if (name.startsWith(parentPrefix)) name = name.slice(parentPrefix.length);
  return name.endsWith(CHRONOPHANTASMA_SUFFIX) ? name.slice(0, -CHRONOPHANTASMA_SUFFIX.length) : name;
}

const skillBreakdownKey = (group: 'Player' | 'Entities' | 'Environment', name: string): string => `${group}|${name}`;

interface BreakdownAttribution {
  readonly group: 'Player' | 'Entities' | 'Environment';
  readonly name: string;
  readonly sourceSkill: string;
  readonly parentSkill: string;
  readonly icon: string;
  readonly skillId: SkillId | null;
  readonly sourceId: SkillId | null;
  readonly actorType: SimulationActorType;
}

function attributeBreakdownEntry(entry: Gw2DamageBreakdownEntry): BreakdownAttribution {
  // The resolver owns attribution. An absent skill ID is intentional and must not borrow a same-named event's trigger.
  const sourceSkill = entry.sourceSkill || baseBreakdownName(entry.name);
  const parentSkill = entry.parentSkill;
  const icon = entry.icon;
  const skillId = entry.skillId ?? null;
  const sourceId = entry.sourceId ?? null;
  const actorType = gw2EventActorType({ actorType: entry.actorType });
  const group = breakdownGroup(actorType);
  const name = breakdownDisplayName(entry, sourceSkill, parentSkill, group, String(entry.damageBreakdownName || ''));
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
  readonly summonKind?: string | null;
  readonly source?: string | null;
  readonly parentSkill?: string | null;
  readonly name?: string | null;
}): string {
  const identityId = fields.skillId ?? fields.sourceId ?? '';
  const actorIdentity = fields.summonKind
    ? `${fields.actorType ?? ''}:${fields.summonKind}`
    : (fields.actorType ?? fields.source ?? '');
  return `${String(identityId)}|${String(actorIdentity)}|${fields.parentSkill || ''}|${fields.name || ''}`;
}

// Maps each resolved event identity to the grouped skill row key it belongs to,
// so per-hit chart series can be attributed to the exact rows the breakdown
// table renders.
export function skillDamageKeyByIdentity(result: Gw2ResolverResult): Map<string, string> {
  const keyByIdentity = new Map<string, string>();
  for (const entry of result.breakdown || []) {
    const identity = skillDamageIdentityKey({
      skillId: entry.skillId,
      sourceId: entry.sourceId,
      actorType: entry.actorType,
      summonKind: entry.summonKind,
      source: entry.source,
      parentSkill: entry.parentSkill,
      name: entry.name
    });
    if (keyByIdentity.has(identity)) continue;
    const { group, name } = attributeBreakdownEntry(entry);
    keyByIdentity.set(identity, skillBreakdownKey(group, name));
  }

  return keyByIdentity;
}

export function skillBreakdownRows(result: Gw2ResolverResult): SkillBreakdownRow[] {
  // Attribute resolved proc damage to its trigger, retaining actual tick damage and the report's DPS window.
  const damageByTrigger = new Map<string, Map<string, number>>();
  const procCounts = new Map<string, number>();
  const keyByIdentity = skillDamageKeyByIdentity(result);
  for (const event of result.resolvedEvents || []) {
    if (event.type !== 'damage' && event.type !== 'condition') continue;
    const key = keyByIdentity.get(skillDamageIdentityKey({ ...event, parentSkill: event.parentSkillName }));
    if (!key) continue;
    // Producers mark one primary effect per activation, so ticks and multi-effect procs cannot inflate Hits.
    const count = Number(event.metadata?.procCount || 0);
    if (count > 0) procCounts.set(key, (procCounts.get(key) || 0) + count);
    if (!event.triggeredBy) continue;
    const sources = damageByTrigger.get(key) || new Map<string, number>();
    sources.set(event.triggeredBy, (sources.get(event.triggeredBy) || 0) + Number(event.damage || 0));
    damageByTrigger.set(key, sources);
  }

  // Equipment procs are recorded once per activation. Keep that count separate
  // from strike hits so mixed effects can average all of their damage per proc.
  const equipmentProcCounts = new Map<string, number>();
  for (const step of result.procSteps || []) {
    if (step.type !== 'relic_proc' && step.type !== 'sigil_proc') continue;
    equipmentProcCounts.set(step.skill, (equipmentProcCounts.get(step.skill) || 0) + 1);
  }

  // Canonical action events are the authoritative source for cast count/time.
  const actionDurations = new Map<string, number>();
  const actionCounts = new Map<string, number>();
  const actionCountsById = new Map<string, number>();
  const actionCountsByEventName = new Map<string, number>();
  for (const event of result.events || []) {
    if (event.type !== 'action') continue;
    // Renamed contributions match accepted actions by ID, then event display name;
    // derive these counts here instead of transporting them on every contribution.
    const id = String(event.skillId ?? event.sourceId);
    const eventName = event.name || event.skillName || String(event.sourceId);
    actionCountsById.set(id, (actionCountsById.get(id) || 0) + 1);
    actionCountsByEventName.set(eventName, (actionCountsByEventName.get(eventName) || 0) + 1);
    const name = String(event.skillName || event.name || event.sourceId);
    actionDurations.set(
      name,
      (actionDurations.get(name) || 0) + Math.max(0, Number(event.endsAt || event.at) - Number(event.at || 0))
    );
    actionCounts.set(name, (actionCounts.get(name) || 0) + 1);
  }

  const grouped = new Map<string, GroupedSkillBreakdown>();
  for (const entry of result.breakdown || []) {
    const { group, name, sourceSkill, parentSkill, icon, skillId, sourceId, actorType } =
      attributeBreakdownEntry(entry);
    const groupKey = skillBreakdownKey(group, name);
    const current = grouped.get(groupKey) || {
      name,
      sourceSkill,
      sourceSkills: new Set<string>(),
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

    current.sourceSkills.add(sourceSkill);
    current.strike += Number(entry.strikeDamage || 0);
    current.condition += Number(entry.conditionDamage || 0);
    current.hits += Number(entry.hits || 0);
    current.critHits += Number(entry.critHits || 0);
    current.critEligibleHits += Number(entry.critEligibleHits || 0);
    const contributionCasts =
      actionCountsById.get(String(entry.skillId ?? entry.sourceId)) ?? actionCountsByEventName.get(entry.name) ?? 0;
    current.fallbackCasts = Math.max(current.fallbackCasts, contributionCasts);
    grouped.set(groupKey, current);
  }

  return [...grouped.values()]
    .map((entry): SkillBreakdownRow => {
      // Prefer source-name counts; renamed contributions use ID/display-name counts.
      // Child effects are not casts of their parent even when they preserve its skill ID.
      // A shared row can contain distinct range variants; count each source's actions once.
      const sources = [...entry.sourceSkills];
      const casts = sources.some((source) => actionCounts.has(source))
        ? sources.reduce((total, source) => total + Number(actionCounts.get(source) || 0), 0)
        : entry.parentSkill
          ? 0
          : entry.fallbackCasts;
      const total = entry.strike + entry.condition;
      const castTime = sources.reduce((total, source) => total + Number(actionDurations.get(source) || 0), 0);
      const procCount =
        procCounts.get(skillBreakdownKey(entry.group, entry.name)) || equipmentProcCounts.get(entry.name) || 0;
      // Proc-only rows have no cast events, so use their canonical activation count for average damage.
      const averageCount = casts || procCount;
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
        hits: entry.hits || procCount,
        procCount,
        total,
        dps: total / Math.max(0.001, Number(result.dpsWindow ?? result.rotationEndTime ?? 0)),
        procDamage: [...(damageByTrigger.get(skillBreakdownKey(entry.group, entry.name)) || [])].map(
          ([sourceSkill, damage]) => ({
            sourceSkill,
            total: damage,
            dps: damage / Math.max(0.001, Number(result.dpsWindow ?? result.rotationEndTime ?? 0))
          })
        ),
        average: averageCount > 0 ? total / averageCount : null,
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
