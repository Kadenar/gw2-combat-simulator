import type { RateInterval } from '#gw2/platform/combat/resources/pool.js';
import type { Gw2BuffAudience } from '#gw2/platform/combat/boons.js';
import {
  timedBuffApplicationsAt,
  buffApplicationStacks,
  buffMatchesAudience,
  isDurationStackingBoon,
  isStandardBoon,
  normalizeBoonDuration,
  prepareBoonWindows,
  type BoonWindow
} from '#gw2/platform/combat/boons.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { GW2_ALACRITY_RECHARGE_RATE, gw2RechargeIntervals } from '#gw2/platform/combat/recharge.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { insertSorted } from '#kernel/core/collections.js';
import { eventCausalOrder } from '#kernel/events/queue.js';

interface CreateGw2TimelineIndexOptions {
  readonly playerAlacrityRechargeRate?: number;
  /** Required when querying cooldowns; previews supply their own explicit readiness policy. */
  readonly skillOnCooldown?: (skillId: SkillId, time: number) => boolean;
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  /** Executed input retains its settled application order, including same-time priorities and nested reactions. */
  readonly resolved?: boolean;
}

interface IndexedBuffEvents {
  readonly all: SimulationEvent[];
  readonly summon: SimulationEvent[];
  readonly summonTrait: SimulationEvent[];
  maximumDuration: number;
}

interface CachedBuffStacks {
  readonly duration: number;
  readonly maximum: number;
  readonly audience: Gw2BuffAudience;
  readonly companionId: string | null | undefined;
  readonly value: number;
}

/**
 * Indexes scheduled or resolved GW2 events so combat calculations can query
 * timestamped state without repeatedly scanning the full event history.
 */
export function createGw2TimelineIndex({
  playerAlacrityRechargeRate = GW2_ALACRITY_RECHARGE_RATE,
  config = {},
  skillOnCooldown,
  events = [],
  resolved = false
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

  const weaponSets: SimulationEvent[] = [];
  const indexedBuffs = new Map<string, IndexedBuffEvents>();
  const retiredCompanions = new Map<string, number>();
  // retain one argument combination per kind; cache variants if mixed-audience sampling dominates.
  const buffCache = new Map<string, CachedBuffStacks>();
  let cachedTime: number | undefined;
  // Sampling repeatedly asks for the same facts; retain only the current time's answers within this timeline.
  const clearQueryCache = (): void => {
    buffCache.clear();
  };

  const alacrityWindows = new Map<string, readonly BoonWindow[]>();
  // Cache each incarnation's pool and retain earned work before its retirement boundary.
  const summonAlacrityWindows = (companionId: string): readonly BoonWindow[] => {
    refreshIndex();
    const cached = alacrityWindows.get(companionId);
    if (cached) return cached;
    const retiredAt = retiredCompanions.get(companionId) ?? Infinity;
    const windows = prepareBoonWindows(events, 'alacrity', 'summon', companionId, resolved)
      .filter((window) => window.start < retiredAt)
      .map((window) => ({ ...window, end: Math.min(window.end, retiredAt) }));
    if (Number.isFinite(retiredAt)) windows.push({ start: retiredAt, end: Infinity, active: false });
    alacrityWindows.set(companionId, windows);
    return windows;
  };

  const rechargeIntervals = (skill: Skill, start: number, end: number, companionId?: string): Iterable<RateInterval> =>
    gw2RechargeIntervals(
      playerAlacrityRechargeRate,
      () => {
        // Summon recharges require an explicit owner; an aggregate audience is never a recharge owner.
        if (!companionId) throw new TypeError(`Summon recharge for skill ${skill.id} requires a companion identity.`);
        return summonAlacrityWindows(companionId);
      },
      skill,
      start,
      end
    );

  let indexedLength = 0;
  let hasExtensions = false;
  const resetIndex = (): void => {
    clearQueryCache();
    weaponSets.length = 0;
    indexedBuffs.clear();
    retiredCompanions.clear();
    alacrityWindows.clear();
    indexedLength = 0;
    hasExtensions = false;
  };

  const indexBuff = (event: SimulationEvent): void => {
    event = normalizeBoonDuration(event);
    const kind = (event.kind || '').toLowerCase();
    let bucket = indexedBuffs.get(kind);
    if (!bucket) {
      bucket = { all: [], summon: [], summonTrait: [], maximumDuration: 0 };
      indexedBuffs.set(kind, bucket);
    }

    bucket.maximumDuration = Math.max(bucket.maximumDuration, Number(event.duration) || 0);
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
    // Index append-only histories incrementally; truncation discards the previous cache.
    if (events.length < indexedLength) resetIndex();
    if (events.length === indexedLength) return;
    clearQueryCache();
    while (indexedLength < events.length) {
      const event = events[indexedLength++];
      if (event.type === 'marker' && event.action === 'companion-retired' && event.summonOwner) {
        const companionId = String(event.summonOwner);
        retiredCompanions.set(companionId, event.at);
        alacrityWindows.delete(companionId);
      }

      if (event.type === 'boon_extension') {
        hasExtensions = true;
        alacrityWindows.clear();
      }

      if (event.type === 'buff') {
        if (event.kind === 'alacrity') alacrityWindows.clear();
        indexBuff(event);
      }

      if (event.type === 'weapon_set') {
        insertOrdered(weaponSets, event);
      }
    }
  };

  const refreshQueryCache = (time: number): void => {
    // Refresh before reuse so same-time appends and backwards queries never see stale history.
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
    // Retirement facts end recipient visibility without rewriting earlier shared boon applications.
    if (audience !== 'all' && companionId && time >= (retiredCompanions.get(companionId) ?? Infinity)) return 0;
    // Reuse chronological extension replay only for histories that contain an extension.
    if (hasExtensions && isStandardBoon(kind)) {
      const applications = timedBuffApplicationsAt(events, kind.toLowerCase(), time, duration, resolved);
      return buffApplicationStacks(applications, kind, time, maximum, { audience, companionId });
    }

    const bucket = indexedBuffs.get((kind || '').toLowerCase());
    const applications =
      audience === 'summon-trait' ? bucket?.summonTrait : audience === 'summon' ? bucket?.summon : bucket?.all;
    if (isDurationStackingBoon(kind)) {
      return buffApplicationStacks(applications || [], kind, time, maximum, {
        audience,
        companionId,
        duration: (event) => event.duration ?? duration
      });
    }

    // The longest grant gives a monotonic expiry bound even when individual grants expire out of order.
    // Long grants widen this scan; use an expiry index if mixed lifetimes dominate.
    const history = applications || [];
    const maximumDuration = Math.max(bucket?.maximumDuration ?? 0, duration || 0);
    let low = 0;
    let high = history.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (gw2EffectExpiresAt(history[middle].at, maximumDuration) <= time) low = middle + 1;
      else high = middle;
    }

    return buffApplicationStacks(history, kind, time, maximum, {
      audience,
      companionId,
      duration: (event) => event.duration ?? duration,
      start: low,
      ordered: true
    });
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

  // Presence queries share the same expiry and audience rules as stack queries.
  const timedActive = (kind: string, time: number): boolean => {
    return buffStacksAt(kind, time, 0, 1) > 0;
  };

  const vigorActiveAt = (time: number): boolean => Boolean(config.boons?.vigor) || timedActive('vigor', time);

  const activeWeaponSetAt = (time: number): number => {
    time = canonicalTime(time);
    refreshIndex();
    let activeSet = Number(config.startingWeaponSet) === 2 ? 2 : 1;
    for (const event of weaponSets) {
      if (canonicalTime(event.at) > time) break;
      // Same-timestamp swaps are visible to effects emitted after the swap.
      activeSet = Number(event.weaponSet);
    }

    return activeSet;
  };

  const skillOnCooldownAt = (skillId: SkillId, time: number): boolean => {
    // The owner supplies current cooldown state or an explicit preview policy; events cannot reconstruct it.
    if (!skillOnCooldown) throw new Error('Cooldown queries require a readiness provider.');
    return skillOnCooldown(skillId, canonicalTime(time));
  };

  return Object.freeze({
    buffStacksAt,
    timedActive,
    vigorActiveAt,
    activeWeaponSetAt,
    skillOnCooldownAt,
    rechargeIntervals
  });
}

export interface Gw2TimelineIndex {
  rechargeIntervals(skill: Skill, start: number, end: number, companionId?: string): Iterable<RateInterval>;
  buffStacksAt(
    kind: string,
    time: number,
    duration: number,
    maximum: number,
    audience?: Gw2BuffAudience,
    companionId?: string | null
  ): number;
  timedActive(kind: string, time: number): boolean;
  vigorActiveAt(time: number): boolean;
  activeWeaponSetAt(time: number): number;
  skillOnCooldownAt(skillId: SkillId, time: number): boolean;
}
