import { EPSILON } from '../../../../../kernel/core/clock.js';
import { insertSorted } from '../../../../../kernel/core/collections.js';
import { eventCausalOrder, eventTimestamp } from '../../engine/events/events.js';
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  remainingDurationStackSeconds,
  sumActiveStacks
} from '../state/boons.js';
import { gw2SigilSet } from './runtime-rules.js';

import type { SimulationEvent, SkillId } from '../../engine/types.js';
import type { Gw2BuffAudience } from '../state/types.js';
import type { Gw2Config } from '../../simulation/config.js';
import type { Gw2SigilSet } from '../../equipment/types.js';
import type { Gw2TimelineIndex } from './types.js';

interface CreateGw2TimelineIndexOptions {
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly sigilSet?: (config: Gw2Config, weaponSet: number) => Gw2SigilSet;
}

type IndexedEvents = Record<'weaponSet' | 'cooldown', SimulationEvent[]>;

interface IndexedBuffEvents {
  readonly all: SimulationEvent[];
  readonly summon: SimulationEvent[];
  readonly summonTrait: SimulationEvent[];
}

/**
 * Common timestamp queries over scheduled GW2 events.
 *
 * @param {{
 *   config?: Gw2Config,
 *   events?: readonly SimulationEvent[],
 *   sigilSet?: (config: Gw2Config, weaponSet: number) => Gw2SigilSet
 * }} [options]
 * @returns {Readonly<Gw2TimelineIndex>}
 */
export function createGw2TimelineIndex({
  config = {},
  events = [],
  sigilSet = gw2SigilSet
}: CreateGw2TimelineIndexOptions = {}): Readonly<Gw2TimelineIndex> {
  // Timestamp ties follow scheduler causal order so derived events are queried
  // in the same order the resolver consumes them.
  /**
   * @param {SimulationEvent} left
   * @param {SimulationEvent} right
   */
  const compareEvents = (left: SimulationEvent, right: SimulationEvent): number =>
    eventTimestamp(left) - eventTimestamp(right) || (eventCausalOrder(left) ?? 0) - (eventCausalOrder(right) ?? 0);
  // Late-derived events use neutral stable insertion without changing the GW2-specific comparator.
  const insertOrdered = (target: SimulationEvent[], event: SimulationEvent): void =>
    insertSorted(target, event, compareEvents);

  const indexed: IndexedEvents = {
    weaponSet: [],
    cooldown: []
  };
  const indexedBuffs = new Map<string, IndexedBuffEvents>();
  let indexedLength = 0;
  const resetIndex = (): void => {
    for (const values of Object.values(indexed)) values.length = 0;
    indexedBuffs.clear();
    indexedLength = 0;
  };

  const indexBuff = (event: SimulationEvent): void => {
    const kind = String(event.kind || '').toLowerCase();
    let bucket = indexedBuffs.get(kind);
    if (!bucket) {
      bucket = { all: [], summon: [], summonTrait: [] };
      indexedBuffs.set(kind, bucket);
    }

    if (buffMatchesAudience(event, 'all')) {
      insertOrdered(bucket.all, event);
    }

    if (buffMatchesAudience(event, 'summon')) {
      insertOrdered(bucket.summon, event);
    }

    if (buffMatchesAudience(event, 'summon-trait')) {
      insertOrdered(bucket.summonTrait, event);
    }
  };

  const refreshIndex = (): void => {
    // The source array is append-oriented. Shrinking it signals replacement and
    // rebuilds the index; same-length in-place mutation is outside the contract.
    if (events.length < indexedLength) resetIndex();
    if (events.length === indexedLength) return;
    while (indexedLength < events.length) {
      const event = events[indexedLength++];
      if (event.type === 'buff') {
        indexBuff(event);
      }

      if (event.type === 'weapon_set') {
        insertOrdered(indexed.weaponSet, event);
      }

      if (event.type === 'action' || event.type === 'cooldown_snapshot') {
        insertOrdered(indexed.cooldown, event);
      }
    }
  };

  /**
   * @param {string} kind
   * @param {number} time
   * @param {number} duration
   * @param {number} maximum
   * @param {Gw2BuffAudience} [audience]
   * @param {string | null} [companionId]
   */
  const buffStacksAt = (
    kind: string,
    time: number,
    duration: number,
    maximum: number,
    audience: Gw2BuffAudience = 'all',
    companionId?: string | null
  ): number => {
    refreshIndex();
    const bucket = indexedBuffs.get(String(kind || '').toLowerCase());
    const applications =
      audience === 'summon-trait' ? bucket?.summonTrait : audience === 'summon' ? bucket?.summon : bucket?.all;
    if (isDurationStackingBoon(kind)) {
      const remaining = remainingDurationStackSeconds(applications || [], time + EPSILON, {
        includes: (event) => buffMatchesAudience(event, audience, companionId),
        duration: (event) => Number(event.duration || duration),
        maximum: durationStackingBoonCapSeconds(kind)
      });
      return remaining > EPSILON ? Math.min(1, Math.max(0, maximum)) : 0;
    }

    return sumActiveStacks(
      applications || [],
      // Event duration wins; duration is a fallback for compact buff records.
      (event) =>
        buffMatchesAudience(event, audience, companionId) && event.at + Number(event.duration || duration) > time,
      (event) => Number(event.stacks || 1),
      maximum,
      (event) => event.at > time + EPSILON
    );
  };

  const timedStacks = (kind: string, time: number, duration: number, maximum: number): number =>
    buffStacksAt(kind, time, duration, maximum);

  /**
   * @param {string} kind
   * @param {number} time
   */
  const timedActive = (kind: string, time: number): boolean => {
    return buffStacksAt(kind, time, 0, 1) > 0;
  };

  /** @param {number} time */
  const vigorActiveAt = (time: number): boolean => Boolean(config.boons?.vigor) || timedActive('vigor', time);

  /** @param {number} time */
  const activeWeaponSetAt = (time: number): number => {
    refreshIndex();
    let activeSet = Number(config.startingWeaponSet) === 2 ? 2 : 1;
    for (const event of indexed.weaponSet) {
      if (event.at > time + EPSILON) break;
      // Same-timestamp swaps are visible to effects emitted after the swap.
      activeSet = Number(event.weaponSet);
    }

    return activeSet;
  };

  /** @param {number} time */
  const activeSigilSetAt = (time: number): Gw2SigilSet => sigilSet(config, activeWeaponSetAt(time));

  /**
   * @param {SkillId} skillId
   * @param {number} time
   */
  const skillOnCooldownAt = (skillId: SkillId, time: number): boolean => {
    refreshIndex();
    let readyAt = 0;
    for (const event of indexed.cooldown) {
      if (event.at > time + EPSILON) break;
      if (event.type === 'action' && event.skillId === skillId) {
        // Query the state before an action at this exact timestamp; otherwise
        // the action would see the cooldown it is about to create.
        if (event.at >= time - EPSILON) continue;
        readyAt = Number(event.rechargeReadyAt || 0);
      } else if (event.type === 'cooldown_snapshot') {
        // A snapshot replaces prior knowledge for the requested skill.
        const cooldowns = (event.cooldowns || {}) as Readonly<Record<string, unknown>>;
        readyAt = Number(cooldowns[String(skillId)] || 0);
      }
    }

    return readyAt > time + EPSILON;
  };

  return Object.freeze({
    buffStacksAt,
    timedStacks,
    timedActive,
    vigorActiveAt,
    activeWeaponSetAt,
    activeSigilSetAt,
    skillOnCooldownAt
  });
}
