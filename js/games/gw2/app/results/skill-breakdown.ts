import { gw2EventActorType } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, type SimulationActorType } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { failedPlayerCasts } from '#gw2/platform/results/cast-activity.js';
import type { Gw2DamageBreakdownEntry } from '#gw2/platform/results/damage-report.js';
import { countProcActivations } from '#gw2/platform/results/proc-counts.js';
import type { Gw2ResolverResult } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

export interface OwnerConditionDamage {
  readonly ownerKey: string;
  readonly ownerName: string;
  readonly name: string;
  readonly damage: number;
  readonly dps: number;
  readonly share: number;
}

/** Split payouts using the table's player/entity ownership, so each disclosure shares its subtotal and DPS window. */
export function ownerConditionBreakdown(result: Gw2ResolverResult): OwnerConditionDamage[] {
  const owners = new Map<string, { name: string; conditions: Map<string, number> }>();
  for (const event of result.resolvedEvents || []) {
    if (event.type !== 'condition' || !event.condition) continue;

    const group = breakdownGroup(gw2EventActorType(event));

    if (group === 'Environment' || (group === 'Entities' && !event.entityName)) continue;

    const ownerKey = group === 'Entities' ? `Entities|${event.entityName}` : 'Player';
    const damage = Number(event.damage || 0);

    if (damage <= 0) continue;

    const owner = owners.get(ownerKey) || {
      name: group === 'Entities' ? event.entityName! : 'Player',
      conditions: new Map<string, number>()
    };
    owner.conditions.set(event.condition, (owner.conditions.get(event.condition) || 0) + damage);
    owners.set(ownerKey, owner);
  }

  const duration = Math.max(0.001, Number(result.dpsWindow ?? result.rotationEndTime ?? 0));
  return [...owners].flatMap(([ownerKey, { name: ownerName, conditions }]) => {
    const total = [...conditions.values()].reduce((sum, damage) => sum + damage, 0);
    return [...conditions]
      .map(([name, damage]) => ({
        ownerKey,
        ownerName,
        name,
        damage,
        dps: damage / duration,
        share: (damage / total) * 100
      }))
      .sort((left, right) => right.damage - left.damage);
  });
}

export interface SkillBreakdownRow {
  readonly [field: string]: unknown;
  readonly name: string;
  readonly sourceSkill: string;
  readonly parentSkill: string;
  readonly icon: string;
  readonly skillId: SkillId | null;
  readonly sourceId: SkillId | null;
  readonly actorType: SimulationActorType;
  readonly entityName: string;
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
  readonly deadTimeMs: number | null;
  readonly procDamage: readonly { sourceSkill: string; total: number; dps: number }[];
  // Stable identity shared with the chart's per-hit series, so a
  // clicked breakdown row can highlight its own damage over time.
  readonly key: string;
  // Fraction of eligible strikes with successful seeded critical rolls (0-1), or null when the
  // row has no crit-eligible strike hits (pure-condition rows). critHits and
  // critEligibleHits back the hover tooltip.
  readonly observedCritRate: number | null;
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
  entityName: string;
  group: 'Player' | 'Entities' | 'Environment';
  strike: number;
  condition: number;
  hits: number;
  critHits: number;
  critEligibleHits: number;
  fallbackActions: Set<SimulationEvent>;
}

// Split only the spaced effect separator so hyphenated skill names retain their attribution.
// Generated breakdown names commonly append " - Effect"; the prefix is the
// final attribution fallback when no explicit source skill survives resolution.
export const baseBreakdownName = (name: unknown): string =>
  String(name || '')
    .split(' - ')[0]!
    .trim();

const breakdownGroup = (actorType: SimulationActorType): 'Player' | 'Entities' | 'Environment' =>
  actorType === ACTOR.SUMMON ? 'Entities' : actorType === ACTOR.ENVIRONMENT ? 'Environment' : 'Player';

const CHRONOPHANTASMA_SUFFIX = ' - Chronophantasma';
const PARENT_SKILL_SEPARATOR = ' - ';

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

// Include the named owner so shared pet skills cannot merge rows or their hit inspectors.
const skillBreakdownKey = (group: string, name: string, entityName: string): string =>
  entityName ? `${group}|${entityName}|${name}` : `${group}|${name}`;

interface BreakdownAttribution {
  readonly entityName: string;
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
    entityName: actorType === ACTOR.SUMMON ? entry.entityName || '' : '',
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

// Use the resolver's breakdown key to match rows to resolved damage and condition events.
// The key contains `identityId|actor|parentSkill|name|entityName`.
// Matching only by name would merge different damage sources from one skill,
// such as the cast's direct strike and its later field pulses,
// into the same chart bucket.
export function skillDamageIdentityKey(fields: {
  readonly skillId?: SkillId | null;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType | null;
  readonly summonKind?: string | null;
  readonly entityName?: string | null;
  readonly source?: string | null;
  readonly parentSkill?: string | null;
  readonly name?: string | null;
}): string {
  const identityId = fields.skillId ?? fields.sourceId ?? '';
  const actorIdentity = fields.summonKind
    ? `${fields.actorType ?? ''}:${fields.summonKind}`
    : (fields.actorType ?? fields.source ?? '');
  const entityName = fields.actorType === ACTOR.SUMMON ? fields.entityName || '' : '';
  return `${String(identityId)}|${String(actorIdentity)}|${fields.parentSkill || ''}|${fields.name || ''}|${entityName}`;
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
      entityName: entry.entityName,
      source: entry.source,
      parentSkill: entry.parentSkill,
      name: entry.name
    });

    if (keyByIdentity.has(identity)) continue;

    const { group, name, entityName } = attributeBreakdownEntry(entry);
    keyByIdentity.set(identity, skillBreakdownKey(group, name, entityName));
  }

  return keyByIdentity;
}

export function skillBreakdownRows(
  result: Gw2ResolverResult,
  keyByIdentity: ReadonlyMap<string, string> = skillDamageKeyByIdentity(result)
): SkillBreakdownRow[] {
  // Attribute resolved proc damage to its trigger, retaining actual tick damage and the report's DPS window.
  const damageByTrigger = new Map<string, Map<string, number>>();
  const eventKey = (event: (typeof result.resolvedEvents)[number]) =>
    keyByIdentity.get(skillDamageIdentityKey({ ...event, parentSkill: event.parentSkillName }));
  for (const event of result.resolvedEvents || []) {
    if (event.type !== 'damage' && event.type !== 'condition') continue;

    const key = keyByIdentity.get(skillDamageIdentityKey({ ...event, parentSkill: event.parentSkillName }));

    if (!key) continue;

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
  const actionsBySource = new Map<string, Set<SimulationEvent>>();
  const playerActionsBySource = new Map<string, Set<SimulationEvent>>();
  const actionsById = new Map<string, Set<SimulationEvent>>();
  const actionsByEventName = new Map<string, Set<SimulationEvent>>();
  const actionKey = (name: string, entityName: string): string => JSON.stringify([entityName, name]);
  const addAction = (index: Map<string, Set<SimulationEvent>>, key: string, event: SimulationEvent) => {
    const actions = index.get(key) ?? new Set<SimulationEvent>();
    actions.add(event);
    index.set(key, actions);
  };

  for (const event of result.events || []) {
    // Failed-cast rows retain attempted player actions even when aimed away from the target.
    if (event.type === 'action' && event.actorType === ACTOR.PLAYER)
      addAction(playerActionsBySource, actionKey(String(event.skillName || event.name || event.sourceId), ''), event);

    // Counts and damage averages describe accepted casts aimed at the target.
    if (event.type !== 'action' || event.offTarget === true) continue;

    const entityName = event.actorType === ACTOR.SUMMON ? event.entityName || '' : '';
    // Some pet commands deal player-owned damage, so those rows share their command actions.
    for (const scope of entityName ? ['', entityName] : ['']) {
      addAction(actionsById, actionKey(String(event.skillId ?? event.sourceId), scope), event);
      addAction(actionsByEventName, actionKey(event.name || event.skillName || String(event.sourceId), scope), event);
      addAction(actionsBySource, actionKey(String(event.skillName || event.name || event.sourceId), scope), event);
    }
  }

  // Only output backed by an actual cast makes a row native; an unmarked proc sibling cannot suppress its count.
  const nativeRows = new Set(
    (result.resolvedEvents || [])
      .filter((event) => {
        if (
          (event.type !== 'damage' && event.type !== 'condition') ||
          event.actorType === ACTOR.EFFECT ||
          event.procActivation ||
          event.traitId != null
        )
          return false;

        const entityName = event.actorType === ACTOR.SUMMON ? event.entityName || '' : '';
        return actionsById.has(actionKey(String(event.skillId ?? event.sourceId), entityName));
      })
      .map(eventKey)
  );
  // Child rewards may share their parent's visible row, but they must not add another activation to its average.
  const rowByEventOrder = new Map<number, string>();
  for (const event of result.resolvedEvents || []) {
    const key = eventKey(event);

    if (key != null && event.eventOrder != null) rowByEventOrder.set(event.eventOrder, key);
  }

  const childActivations = new Map<string, Set<string>>();
  for (const event of result.resolvedEvents || []) {
    const key = eventKey(event);

    if (
      !key ||
      !event.procActivation ||
      typeof event.parentEventOrder !== 'number' ||
      rowByEventOrder.get(event.parentEventOrder) !== key
    )
      continue;

    const activations = childActivations.get(key) ?? new Set<string>();
    activations.add(event.procActivation.id);
    childActivations.set(key, activations);
  }

  const procCounts = countProcActivations(result.resolvedEvents || [], (event) => {
    if (event.type !== 'damage' && event.type !== 'condition') return undefined;

    const key = eventKey(event);
    return nativeRows.has(key) ||
      (key != null && event.procActivation && childActivations.get(key)?.has(event.procActivation.id))
      ? undefined
      : key;
  });

  const grouped = new Map<string, GroupedSkillBreakdown>();
  for (const entry of result.breakdown || []) {
    const { group, name, sourceSkill, parentSkill, icon, skillId, sourceId, actorType, entityName } =
      attributeBreakdownEntry(entry);
    const groupKey = skillBreakdownKey(group, name, entityName);
    const current = grouped.get(groupKey) || {
      name,
      sourceSkill,
      sourceSkills: new Set<string>(),
      parentSkill,
      icon,
      skillId,
      sourceId,
      actorType,
      entityName,
      group,
      strike: 0,
      condition: 0,
      hits: 0,
      critHits: 0,
      critEligibleHits: 0,
      fallbackActions: new Set<SimulationEvent>()
    };

    if (!current.parentSkill && parentSkill) current.parentSkill = parentSkill;

    if (!current.icon && icon) current.icon = icon;

    if (current.skillId == null && skillId != null) current.skillId = skillId;

    if (current.sourceId == null && sourceId != null) {
      current.sourceId = sourceId;
    }

    // Effect packets retain triggering skill IDs for lineage, but do not own the trigger's casts or occupied time.
    if (actorType !== ACTOR.EFFECT) current.sourceSkills.add(sourceSkill);

    current.strike += Number(entry.strikeDamage || 0);
    current.condition += Number(entry.conditionDamage || 0);
    current.hits += Number(entry.hits || 0);
    current.critHits += Number(entry.critHits || 0);
    current.critEligibleHits += Number(entry.critEligibleHits || 0);
    const contributionActions =
      actorType === ACTOR.EFFECT
        ? undefined
        : (actionsById.get(actionKey(String(entry.skillId ?? entry.sourceId), entityName)) ??
          actionsByEventName.get(actionKey(entry.name, entityName)));
    for (const action of contributionActions ?? []) current.fallbackActions.add(action);
    grouped.set(groupKey, current);
  }

  const rowsByAction = new Map<SimulationEvent, SkillBreakdownRow>();
  const rows = [...grouped.values()].map((entry): SkillBreakdownRow => {
    const procCount =
      procCounts.get(skillBreakdownKey(entry.group, entry.name, entry.entityName)) ||
      equipmentProcCounts.get(entry.name) ||
      0;
    // Prefer source-name counts; renamed contributions use ID/display-name counts.
    // Child effects and proc-only rows cannot borrow casts from their triggering skill ID.
    // A shared row can contain distinct range variants; count each source's actions once.
    const sources = [...entry.sourceSkills].map((source) => actionKey(source, entry.entityName));
    const actions = sources.some((source) => actionsBySource.has(source))
      ? new Set(sources.flatMap((source) => [...(actionsBySource.get(source) ?? [])]))
      : entry.parentSkill || procCount > 0
        ? new Set<SimulationEvent>()
        : entry.fallbackActions;
    const casts = actions.size;
    const total = entry.strike + entry.condition;
    const castTime = [...actions].reduce(
      (sum, action) => sum + Math.max(0, Number(action.endsAt ?? action.at) - action.at),
      0
    );
    // Proc-only rows have no cast events, so use their canonical activation count for average damage.
    const averageCount = casts || procCount;
    const row: SkillBreakdownRow = {
      name: entry.name,
      key: skillBreakdownKey(entry.group, entry.name, entry.entityName),
      sourceSkill: entry.sourceSkill,
      parentSkill: entry.parentSkill,
      icon: entry.icon,
      skillId: entry.skillId,
      sourceId: entry.sourceId,
      actorType: entry.actorType,
      entityName: entry.entityName,
      group: entry.group,
      strike: entry.strike,
      condition: entry.condition,
      hits: entry.hits || procCount,
      procCount,
      total,
      dps: total / Math.max(0.001, Number(result.dpsWindow ?? result.rotationEndTime ?? 0)),
      procDamage: [...(damageByTrigger.get(skillBreakdownKey(entry.group, entry.name, entry.entityName)) || [])].map(
        ([sourceSkill, damage]) => ({
          sourceSkill,
          total: damage,
          dps: damage / Math.max(0.001, Number(result.dpsWindow ?? result.rotationEndTime ?? 0))
        })
      ),
      average: total > 0 && averageCount > 0 ? total / averageCount : null,
      // DCT is damage divided by occupied cast time, not encounter duration.
      dct: total > 0 && castTime > 0 ? total / castTime : null,
      casts,
      deadTimeMs: entry.group === 'Player' && casts > 0 && !entry.parentSkill ? 0 : null,
      observedCritRate: entry.critEligibleHits > 0 ? entry.critHits / entry.critEligibleHits : null,
      critHits: entry.critHits,
      critEligibleHits: entry.critEligibleHits
    };

    // Reuse the exact action set behind Casts and DCT, including every source in a merged row.
    if (row.deadTimeMs !== null) {
      const playerActions = new Set([
        ...actions,
        ...sources.flatMap((source) => [...(playerActionsBySource.get(source) ?? [])])
      ]);
      for (const action of playerActions) {
        if (!rowsByAction.has(action) || entry.name === entry.sourceSkill) rowsByAction.set(action, row);
      }
    }

    return row;
  });

  const deadTimeByRow = new Map<SkillBreakdownRow, number>();
  const missingRows = new Map<string, SkillBreakdownRow>();
  for (const { action, durationMs } of failedPlayerCasts(result)) {
    let row = rowsByAction.get(action);

    if (!row) {
      const name = action.skillName || action.name || String(action.skillId ?? action.sourceId);
      const key = skillBreakdownKey('Player', name, '');
      row = missingRows.get(key);

      if (!row) {
        const actions = playerActionsBySource.get(actionKey(name, '')) ?? new Set([action]);
        row = {
          name,
          sourceSkill: name,
          parentSkill: '',
          icon: '',
          skillId: action.skillId ?? null,
          sourceId: action.sourceId ?? null,
          actorType: ACTOR.PLAYER,
          entityName: '',
          group: 'Player',
          strike: 0,
          condition: 0,
          hits: 0,
          procCount: 0,
          casts: actions.size,
          total: 0,
          dps: 0,
          average: null,
          dct: null,
          deadTimeMs: 0,
          procDamage: [],
          key,
          observedCritRate: null,
          critHits: 0,
          critEligibleHits: 0
        };
        missingRows.set(key, row);
        rows.push(row);
      }
    }

    deadTimeByRow.set(row, (deadTimeByRow.get(row) ?? 0) + durationMs);
  }

  return rows
    .map((row) => ({ ...row, deadTimeMs: deadTimeByRow.get(row) ?? row.deadTimeMs }))
    .filter((row) => row.total > 0 || Number(row.deadTimeMs) > 0)
    .sort((left, right) => right.total - left.total);
}
