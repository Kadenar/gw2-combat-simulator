/**
 * Derives which visible event-log row caused each other row, using provenance the runtime already records.
 *
 * Rules run in order and the first match wins:
 * 1. Recorded parent: `parentEventOrder`, walked through events the log hides (combo finishers, sigil swaps); a walk
 *    that ends on a hidden packet of a cast resolves to that cast.
 * 2. Proc pairs: a proc's damage sits under its trigger row (inferred).
 * 3. Activation: `activationId` names a cast.
 * 4. Spawned entity: derived activation ids such as `guardian.symbol:<id>:cast:3:1.6` or `cast:3:flames`
 *    become a synthetic group under the cast that spawned them.
 * 5. Named trigger: `triggeredBy` matches the latest hit, condition, or proc from that skill, preferring the hit
 *    when several share that instant (inferred).
 * Rows that should have an owner but match nothing are marked as orphans; autonomous summon packets are not.
 */
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { EventLogParentLink, EventLogSource } from '#ui/results/event-log.js';

export interface EventLogOwnership {
  readonly id: string;
  readonly parentId?: string;
  readonly parentLink?: EventLogParentLink;
  readonly orphan?: boolean;
}

/** A symbol, damage-over-time field, or minion that outlives its cast and owns later rows. */
export interface EventLogEntity {
  readonly id: string;
  readonly parentId: string;
  readonly parentLink: EventLogParentLink;
  readonly label: string;
  /** First owned event; the entity row takes its time and display position. */
  readonly firstEvent: SimulationEvent;
}

const TRIGGERED_BY: EventLogParentLink = Object.freeze({ kind: 'recorded', label: 'triggered by' });
const PART_OF: EventLogParentLink = Object.freeze({ kind: 'recorded', label: 'part of' });
const OWNED_BY: EventLogParentLink = Object.freeze({ kind: 'recorded', label: 'owned by' });
const SPAWNED_BY: EventLogParentLink = Object.freeze({ kind: 'recorded', label: 'spawned by' });
const inferredFrom = (name: string): EventLogParentLink => ({ kind: 'inferred', label: `inferred from "${name}"` });
/** The cast is chosen as the latest one of the packet's skill, so the link is inferred; the trigger stays named. */
const effectOf = (trigger: SimulationEvent | undefined): EventLogParentLink => ({
  kind: 'inferred',
  label: trigger
    ? `effect of this cast, triggered by ${trigger.skillName || trigger.name || trigger.type} ${trigger.type === 'damage' ? 'hit' : trigger.type}`
    : 'effect of this cast'
});
const skillKey = (event: SimulationEvent): string => String(event.skillId ?? event.sourceId ?? '');

export const CAST_LINK = PART_OF;
export const ENTITY_SOURCE: EventLogSource = Object.freeze({ id: 'entity', label: 'Spawned' });
const SKILL_SOURCE: EventLogSource = Object.freeze({ id: 'skill', label: 'Skill', badge: false });
const SUMMON_SOURCE: EventLogSource = Object.freeze({ id: 'summon', label: 'Summon' });
const CLONE_SOURCE: EventLogSource = Object.freeze({ id: 'clone', label: 'Clone' });
const REACTION_SOURCES: Readonly<Record<string, EventLogSource>> = Object.freeze({
  Trait: Object.freeze({ id: 'trait', label: 'Trait' }),
  Relic: Object.freeze({ id: 'relic', label: 'Relic' }),
  Sigil: Object.freeze({ id: 'sigil', label: 'Sigil' }),
  Rune: Object.freeze({ id: 'rune', label: 'Rune' }),
  Food: Object.freeze({ id: 'food', label: 'Food' })
});
/**
 * Combat effects always come from something; state facts and markers may legitimately stand alone. Summons (clones,
 * pets, mech, minions) act autonomously, so their unlinked packets are expected rather than missing a cause.
 */
const OWNED_TYPES = new Set(['damage', 'condition', 'buff', 'proc', 'control', 'resource']);
const expectsOwner = (event: SimulationEvent): boolean => OWNED_TYPES.has(event.type) && event.actorType !== 'summon';

/** Classifies a row's origin so reactions carry a badge and can be hidden as a group. */
export function eventLogSource(event: SimulationEvent): EventLogSource | undefined {
  if (event.actorType === 'environment') return undefined;
  if (event.actorType === 'summon') return event.source === 'Clone' ? CLONE_SOURCE : SUMMON_SOURCE;
  return REACTION_SOURCES[event.source] ?? SKILL_SOURCE;
}

/** Converts stable minion ownership ids into readable per-minion log labels. */
export function minionAttackerLabel(event: SimulationEvent): string {
  const match = /^minion:([^:]+):(\d+)$/.exec(String(event.summonOwner || ''));
  if (!match) return '';
  const name = match[1]
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return name ? `${name} #${Number(match[2]) + 1}` : '';
}

const finiteOrder = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function findLast<T>(items: readonly T[] | undefined, predicate: (item: T) => boolean): T | undefined {
  if (!items) return undefined;
  for (let index = items.length - 1; index >= 0; index -= 1) if (predicate(items[index])) return items[index];
  return undefined;
}

/**
 * `shown` lists the events that produce visible rows; `recorded` holds every emitted and resolved event so
 * parent links can be followed through events the log does not present.
 */
export function deriveEventLogOwnership(
  shown: readonly SimulationEvent[],
  recorded: readonly SimulationEvent[]
): { readonly owners: Map<SimulationEvent, EventLogOwnership>; readonly entities: readonly EventLogEntity[] } {
  const byOrder = new Map<number, SimulationEvent>();
  for (const event of recorded) {
    const order = finiteOrder(event.eventOrder);
    if (order != null) byOrder.set(order, event);
  }

  const ids = new Map<SimulationEvent, string>();
  const eventById = new Map<string, SimulationEvent>();
  const idByOrder = new Map<number, string>();
  const castIds = new Map<string, string>();
  shown.forEach((event, index) => {
    const order = finiteOrder(event.eventOrder);
    // Casts use their activation id so collapsed groups survive reruns of an unchanged rotation prefix.
    const id =
      event.type === 'action' && event.activationId
        ? `activation:${event.activationId}`
        : order != null
          ? `event:${order}`
          : `event:#${index}`;
    ids.set(event, id);
    eventById.set(id, event);
    if (order != null) idByOrder.set(order, id);
    if (event.type === 'action' && event.activationId) castIds.set(event.activationId, id);
  });

  // A chain that ends on a hidden packet of a cast (a blind, a sigil swap, an unresolved hit) belongs to that cast.
  const recordedParent = (event: SimulationEvent): string | undefined => {
    let order = finiteOrder(event.parentEventOrder);
    for (let guard = 0; order != null && guard < 64; guard += 1) {
      const id = idByOrder.get(order);
      if (id) return id;
      const hidden = byOrder.get(order);
      order = finiteOrder(hidden?.parentEventOrder);
      if (order == null && hidden?.activationId) return castIds.get(hidden.activationId);
    }

    return undefined;
  };

  const entities: EventLogEntity[] = [];
  const entityIds = new Map<string, string>();
  // Derived ids nest their spawner: `<kind>:<instance>:<spawner id>[:<time>]` or `cast:N:<kind>[:...]`.
  const resolveEntity = (activationId: string, event: SimulationEvent): string | undefined => {
    const cast = castIds.get(activationId);
    if (cast) return cast;
    const known = entityIds.get(activationId);
    if (known) return known;
    const name = String(event.skillName || event.name || '');
    const nested = /^([a-z][\w.-]*):(\d+):(.+)$/i.exec(activationId);
    const suffixed = /^(cast:\d+):([a-z][\w-]*)/i.exec(activationId);
    let key = activationId;
    let parentId: string | undefined;
    let label = '';
    if (nested && nested[1] !== 'cast') {
      parentId = resolveEntity(nested[3].replace(/:[\d.]+$/, ''), event);
      label = `${nested[1].split('.').pop()!.toUpperCase()} ${name}`;
    } else if (suffixed && castIds.has(suffixed[1])) {
      // One group per spawning cast and kind keeps a minion's repeated attack chains together.
      key = `${suffixed[1]}:${suffixed[2]}`;
      const grouped = entityIds.get(key);
      if (grouped) {
        entityIds.set(activationId, grouped);
        return grouped;
      }

      parentId = castIds.get(suffixed[1]);
      label =
        event.actorType === 'summon'
          ? `MINION ${minionAttackerLabel(event) || name}`
          : `${suffixed[2].toUpperCase()} ${name}`;
    }

    if (!parentId) return undefined;
    const id = `entity:${key}`;
    entities.push({ id, parentId, parentLink: SPAWNED_BY, label: label.trim(), firstEvent: event });
    entityIds.set(key, id);
    entityIds.set(activationId, id);
    return id;
  };

  // Name-based rules look backwards in time, so resolve rows chronologically.
  const sorted = shown
    .map((event, index) => ({ event, index }))
    .sort(
      (left, right) =>
        left.event.at - right.event.at ||
        (finiteOrder(left.event.eventOrder) ?? left.index) - (finiteOrder(right.event.eventOrder) ?? right.index)
    );
  const byName = new Map<string, { readonly at: number; readonly id: string; readonly hit: boolean }[]>();
  const castsBySkill = new Map<
    string,
    { readonly at: number; readonly id: string; readonly activationId?: string }[]
  >();
  /**
   * A reaction carrying a cast skill's identity that a later strike or condition set off, such as the bleed a hit
   * draws from Shattering Stone's armed charges, belongs to that skill's latest cast rather than to the packet that
   * consumed it. Reactions to a cast stay with that cast, combo outcomes with their finisher, summons in their own
   * lanes, and packets already inside that cast or a spawned entity are left alone.
   */
  const owningCast = (event: SimulationEvent, parentId: string | undefined): string | undefined => {
    if (event.comboId != null || event.actorType === 'summon' || parentId?.startsWith('entity:')) return undefined;
    const trigger = parentId ? eventById.get(parentId) : undefined;
    const key = skillKey(event);
    if (!trigger || trigger.type === 'action' || !key || skillKey(trigger) === key) return undefined;
    const cast = findLast(castsBySkill.get(key), (entry) => entry.at <= event.at + 1e-9);
    if (!cast || cast.id === parentId || (event.activationId != null && event.activationId === cast.activationId))
      return undefined;
    return cast.id;
  };

  const procs = new Map<string, { readonly name: string; readonly id: string }[]>();
  const owners = new Map<SimulationEvent, EventLogOwnership>();

  for (const { event } of sorted) {
    const id = ids.get(event)!;
    let parentId: string | undefined;
    let parentLink: EventLogParentLink | undefined;
    if (event.type !== 'action') {
      const recordedId = recordedParent(event);
      const proc =
        event.type === 'damage' && event.parentSkillName && event.activationId
          ? findLast(procs.get(event.activationId), (candidate) => candidate.name === event.skillName)
          : undefined;
      if (recordedId && recordedId !== id) {
        parentId = recordedId;
        parentLink = TRIGGERED_BY;
      } else if (proc) {
        parentId = proc.id;
        parentLink = inferredFrom(proc.name);
      } else if (event.activationId && castIds.has(event.activationId)) {
        parentId = castIds.get(event.activationId);
        parentLink = PART_OF;
      } else if (event.activationId) {
        parentId = resolveEntity(event.activationId, event);
        if (parentId) parentLink = OWNED_BY;
      }

      if (!parentId && event.triggeredBy) {
        const entries = byName.get(event.triggeredBy);
        const latest = findLast(entries, (entry) => entry.at <= event.at + 1e-9);
        // On-hit procs name the skill, not the packet; at one instant the strike is the likelier trigger.
        const trigger =
          latest && (findLast(entries, (entry) => entry.hit && Math.abs(entry.at - latest.at) < 1e-9) ?? latest);
        if (trigger) {
          parentId = trigger.id;
          parentLink = inferredFrom(event.triggeredBy);
        }
      }

      const owner = owningCast(event, parentId);
      if (owner) {
        const trigger = parentId ? eventById.get(parentId) : undefined;
        parentLink = effectOf(trigger);
        parentId = owner;
      }
    } else {
      const entries = castsBySkill.get(skillKey(event)) || [];
      entries.push({ at: event.at, id, activationId: event.activationId });
      castsBySkill.set(skillKey(event), entries);
    }

    owners.set(event, {
      id,
      ...(parentId ? { parentId, parentLink } : {}),
      ...(!parentId && expectsOwner(event) ? { orphan: true } : {})
    });

    if (event.type === 'damage' || event.type === 'condition' || event.type === 'proc') {
      for (const name of new Set([event.skillName, event.name])) {
        if (!name) continue;
        const entries = byName.get(name) || [];
        entries.push({ at: event.at, id, hit: event.type === 'damage' });
        byName.set(name, entries);
      }
    }

    if (event.type === 'proc' && event.activationId && event.name) {
      const entries = procs.get(event.activationId) || [];
      entries.push({ name: event.name, id });
      procs.set(event.activationId, entries);
    }
  }

  return { owners, entities };
}
