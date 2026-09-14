import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { boonApplicationsAt } from '#gw2/platform/combat/state/boon-extensions.js';
import { insertSorted } from '#kernel/core/collections.js';
import { eventCausalOrder } from '#kernel/events/queue.js';
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  isStandardBoon,
  normalizeBoonDuration,
  remainingDurationStackSeconds,
  sumActiveStacks
} from '#gw2/platform/combat/state/boons.js';
import { gw2SigilSet } from '#gw2/platform/combat/query/runtime-rules.js';

import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2BuffAudience } from '#gw2/platform/combat/state/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SigilSet } from '#gw2/platform/equipment/types.js';
import type { Gw2TimelineIndex } from '#gw2/platform/combat/query/types.js';

interface CreateGw2TimelineIndexOptions {
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly resolved?: boolean;
  readonly sigilSet?: (config: Gw2Config, weaponSet: number) => Gw2SigilSet;
}

type IndexedEvents = Record<'weaponSet' | 'cooldown', SimulationEvent[]>;

interface IndexedBuffEvents {
  readonly all: SimulationEvent[];
  readonly summon: SimulationEvent[];
  readonly summonTrait: SimulationEvent[];
}

interface CachedBuffStacks {
  readonly duration: number;
  readonly maximum: number;
  readonly audience: Gw2BuffAudience;
  readonly companionId: string | null | undefined;
  readonly value: number;
}

/**
 * Common timestamp queries over scheduled GW2 events.
 */
export function createGw2TimelineIndex({
  config = {},
  events = [],
  resolved = false,
  sigilSet = gw2SigilSet
}: CreateGw2TimelineIndexOptions = {}): Readonly<Gw2TimelineIndex> {
  // Timestamp ties follow scheduler causal order so derived events are queried
  // in the same order the resolver consumes them.

  const compareEvents = (left: SimulationEvent, right: SimulationEvent): number =>
    canonicalTime(left.at) - canonicalTime(right.at) || (eventCausalOrder(left) ?? 0) - (eventCausalOrder(right) ?? 0);
  // Late-derived events use neutral stable insertion without changing the GW2-specific comparator.
  const insertOrdered = (target: SimulationEvent[], event: SimulationEvent): void => {
    // Resolved history already follows phase, priority, and causal order; preserve that actual execution order.
    if (resolved) target.push(event);
    else insertSorted(target, event, compareEvents);
  };

  const indexed: IndexedEvents = {
    weaponSet: [],
    cooldown: []
  };
  const indexedBuffs = new Map<string, IndexedBuffEvents>();
  // retain one argument combination per kind; cache variants if mixed-audience sampling dominates.
  const buffCache = new Map<string, CachedBuffStacks>();
  const cooldownCache = new Map<SkillId, boolean>();
  let cachedTime: number | undefined;
  // Sampling repeatedly asks for the same facts; retain only the current time's answers within this timeline.
  const clearQueryCache = (): void => {
    buffCache.clear();
    cooldownCache.clear();
  };

  let indexedLength = 0;
  let hasExtensions = false;
  const resetIndex = (): void => {
    clearQueryCache();
    for (const values of Object.values(indexed)) values.length = 0;
    indexedBuffs.clear();
    indexedLength = 0;
    hasExtensions = false;
  };

  const indexBuff = (event: SimulationEvent): void => {
    event = normalizeBoonDuration(event);
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
    // Appends are indexed incrementally; source replacements must call onEventReplaced.
    if (events.length < indexedLength) resetIndex();
    if (events.length === indexedLength) return;
    clearQueryCache();
    while (indexedLength < events.length) {
      const event = events[indexedLength++];
      if (event.type === 'boon_extension') hasExtensions = true;
      if (event.type === 'buff') {
        indexBuff(event);
      }

      if (event.type === 'weapon_set') {
        insertOrdered(indexed.weaponSet, event);
      }

      if (
        event.type === 'action' ||
        event.type === 'cooldown_snapshot' ||
        (event.type === 'marker' && event.action === 'cooldown-reset')
      ) {
        insertOrdered(indexed.cooldown, event);
      }
    }
  };

  const refreshQueryCache = (time: number): void => {
    // Refresh before reuse so same-time appends, replacements, and backwards queries never see stale history.
    refreshIndex();
    if (cachedTime !== time) {
      clearQueryCache();
      cachedTime = time;
    }
  };

  const calculateBuffStacks = (
    kind: string,
    time: number,
    duration: number,
    maximum: number,
    audience: Gw2BuffAudience = 'all',
    companionId?: string | null
  ): number => {
    time = canonicalTime(time);
    // Reuse chronological extension replay only for histories that contain an extension.
    if (hasExtensions && isStandardBoon(kind)) {
      const applications = boonApplicationsAt(events, String(kind).toLowerCase(), time, duration);
      const includes = (application: (typeof applications)[number]) =>
        buffMatchesAudience(application, audience, companionId);
      if (isDurationStackingBoon(kind)) {
        return remainingDurationStackSeconds(applications, time, {
          includes,
          maximum: durationStackingBoonCapSeconds(kind)
        }) > 0
          ? Math.min(1, Math.max(0, maximum))
          : 0;
      }

      return sumActiveStacks(
        applications,
        (application) => includes(application) && isTimeInWindow(time, application.at, application.expiresAt),
        (application) => application.stacks,
        maximum
      );
    }

    const bucket = indexedBuffs.get(String(kind || '').toLowerCase());
    const applications =
      audience === 'summon-trait' ? bucket?.summonTrait : audience === 'summon' ? bucket?.summon : bucket?.all;
    if (isDurationStackingBoon(kind)) {
      const remaining = remainingDurationStackSeconds(applications || [], time, {
        includes: (event) => buffMatchesAudience(event, audience, companionId),
        duration: (event) => Number(event.duration ?? duration),
        maximum: durationStackingBoonCapSeconds(kind)
      });
      return remaining > 0 ? Math.min(1, Math.max(0, maximum)) : 0;
    }

    return sumActiveStacks(
      applications || [],
      // Explicit zero durations stay empty, including grants rounded down to zero milliseconds.
      (event) =>
        buffMatchesAudience(event, audience, companionId) &&
        isTimeInWindow(time, event.at, event.at + Number(event.duration ?? duration)),
      (event) => Number(event.stacks || 1),
      maximum,
      (event) => canonicalTime(event.at) > time
    );
  };

  const buffStacksAt = (
    kind: string,
    time: number,
    duration: number,
    maximum: number,
    audience: Gw2BuffAudience = 'all',
    companionId?: string | null
  ): number => {
    time = canonicalTime(time);
    refreshQueryCache(time);
    const cached = buffCache.get(kind);
    if (
      cached &&
      cached.duration === duration &&
      cached.maximum === maximum &&
      cached.audience === audience &&
      cached.companionId === companionId
    ) {
      return cached.value;
    }

    const value = calculateBuffStacks(kind, time, duration, maximum, audience, companionId);
    buffCache.set(kind, { duration, maximum, audience, companionId, value });
    return value;
  };

  const timedStacks = (kind: string, time: number, duration: number, maximum: number): number =>
    buffStacksAt(kind, time, duration, maximum);

  const timedActive = (kind: string, time: number): boolean => {
    return buffStacksAt(kind, time, 0, 1) > 0;
  };

  const vigorActiveAt = (time: number): boolean => Boolean(config.boons?.vigor) || timedActive('vigor', time);

  const activeWeaponSetAt = (time: number): number => {
    time = canonicalTime(time);
    refreshIndex();
    let activeSet = Number(config.startingWeaponSet) === 2 ? 2 : 1;
    for (const event of indexed.weaponSet) {
      if (canonicalTime(event.at) > time) break;
      // Same-timestamp swaps are visible to effects emitted after the swap.
      activeSet = Number(event.weaponSet);
    }

    return activeSet;
  };

  const activeSigilSetAt = (time: number): Gw2SigilSet => sigilSet(config, activeWeaponSetAt(time));

  const skillOnCooldownAt = (skillId: SkillId, time: number): boolean => {
    time = canonicalTime(time);
    refreshQueryCache(time);
    const cached = cooldownCache.get(skillId);
    if (cached !== undefined) return cached;
    let readyAt = 0;
    for (const event of indexed.cooldown) {
      if (canonicalTime(event.at) > time) break;
      if (event.type === 'action' && event.skillId === skillId) {
        // Predictions must not see their own action's cooldown; resolved history contains only completed events.
        if (!resolved && canonicalTime(event.at) === time) continue;
        readyAt = Number(event.rechargeReadyAt || 0);
      } else if (event.type === 'cooldown_snapshot') {
        // A snapshot replaces prior knowledge for the requested skill.
        const cooldowns = (event.cooldowns || {}) as Readonly<Record<string, unknown>>;
        readyAt = Number(cooldowns[String(skillId)] || 0);
      } else if (event.type === 'marker' && event.action === 'cooldown-reset') {
        // Training-area resets restore signet passives as soon as the scheduler clears their recharge.
        readyAt = 0;
      }
    }

    const value = readyAt === Infinity || canonicalTime(readyAt) > time;
    cooldownCache.set(skillId, value);
    return value;
  };

  return Object.freeze({
    onEventReplaced(previous: SimulationEvent, replacement: SimulationEvent): void {
      // Rebuild lazily for changed history, but ignore unindexed packets such as critical damage facts.
      if (
        [previous, replacement].some(
          (event) =>
            ['buff', 'boon_extension', 'weapon_set', 'action', 'cooldown_snapshot'].includes(event.type) ||
            (event.type === 'marker' && event.action === 'cooldown-reset')
        )
      ) {
        resetIndex();
      }
    },
    buffStacksAt,
    timedStacks,
    timedActive,
    vigorActiveAt,
    activeWeaponSetAt,
    activeSigilSetAt,
    skillOnCooldownAt
  });
}
