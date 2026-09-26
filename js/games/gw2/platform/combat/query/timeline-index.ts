import type { Gw2BuffAudience } from '#gw2/platform/combat/boons.js';
import {
  boonApplicationsAt,
  buffApplicationStacks,
  buffMatchesAudience,
  isDurationStackingBoon,
  isStandardBoon,
  normalizeBoonDuration
} from '#gw2/platform/combat/boons.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
import { gw2RechargeRate, projectRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { gw2SigilSet } from '#gw2/platform/equipment/sigils/rules.js';
import type { Gw2SigilSet } from '#gw2/platform/equipment/sigils/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { gw2CooldownReadyAt, gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { insertSorted } from '#kernel/core/collections.js';
import { eventCausalOrder } from '#kernel/events/queue.js';

interface CreateGw2TimelineIndexOptions {
  readonly skillOnCooldown?: (skillId: import('#gw2/platform/engine/skills/types.js').SkillId, time: number) => boolean;
  readonly config?: Gw2Config;
  readonly events?: readonly SimulationEvent[];
  readonly skillsById?: ReadonlyMap<SkillId, Skill>;
  readonly resolved?: boolean;
  readonly sigilSet?: (config: Gw2Config, weaponSet: number) => Gw2SigilSet;
}

type IndexedEvents = Record<'weaponSet' | 'cooldown', SimulationEvent[]>;

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
 * Common timestamp queries over scheduled GW2 events.
 */
export function createGw2TimelineIndex({
  config = {},
  skillOnCooldown,
  events = [],
  skillsById,
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
  // Only queried skills need their own history; snapshots and resets remain visible to every skill.
  const indexedCooldowns = new Map<SkillId, SimulationEvent[]>();
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
    indexedCooldowns.clear();
    indexedLength = 0;
    hasExtensions = false;
  };

  const indexBuff = (event: SimulationEvent): void => {
    event = normalizeBoonDuration(event);
    const kind = String(event.kind || '').toLowerCase();
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
        for (const [skillId, history] of indexedCooldowns) {
          if (event.type !== 'action' || event.skillId === skillId) insertOrdered(history, event);
        }
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
      return buffApplicationStacks(applications, kind, time, maximum, { audience, companionId });
    }

    const bucket = indexedBuffs.get(String(kind || '').toLowerCase());
    const applications =
      audience === 'summon-trait' ? bucket?.summonTrait : audience === 'summon' ? bucket?.summon : bucket?.all;
    if (isDurationStackingBoon(kind)) {
      return buffApplicationStacks(applications || [], kind, time, maximum, {
        audience,
        companionId,
        duration: (event) => Number(event.duration ?? duration)
      });
    }

    // The longest grant gives a monotonic expiry bound even when individual grants expire out of order.
    // Long grants widen this scan; use an expiry index if mixed lifetimes dominate.
    const history = applications || [];
    const maximumDuration = Math.max(bucket?.maximumDuration ?? 0, Number(duration) || 0);
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
      duration: (event) => Number(event.duration ?? duration),
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
    if (skillOnCooldown) return skillOnCooldown(skillId, time);
    refreshQueryCache(time);
    const cached = cooldownCache.get(skillId);
    if (cached !== undefined) return cached;
    let history = indexedCooldowns.get(skillId);
    if (!history) {
      history = indexed.cooldown.filter((event) => event.type !== 'action' || event.skillId === skillId);
      indexedCooldowns.set(skillId, history);
    }

    // Find the latest visible update without replaying earlier cooldowns; history stays available for backward queries.
    let low = 0;
    let high = history.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (canonicalTime(history[middle].at) <= time) low = middle + 1;
      else high = middle;
    }

    let readyAt = 0;
    let progress: RechargeProgress | undefined;
    for (let index = low - 1; index >= 0; index -= 1) {
      const event = history[index];
      if (event.type === 'action') {
        // Predictions must not see their own action's cooldown; resolved history contains only completed events.
        if (!resolved && canonicalTime(event.at) === time) continue;
        readyAt = Number(event.rechargeReadyAt || 0);
        progress = event.rechargeProgress;
      } else if (event.type === 'cooldown_snapshot') {
        // A snapshot replaces prior knowledge for the requested skill.
        const cooldowns = (event.cooldowns || {}) as Readonly<Record<string, unknown>>;
        readyAt = Number(cooldowns[String(skillId)] || 0);
        progress = event.rechargeProgressBySkillId?.[String(skillId)];
      } else if (event.type === 'marker' && event.action === 'cooldown-reset') {
        // Training-area resets restore signet passives as soon as the scheduler clears their recharge.
        readyAt = 0;
      }

      break;
    }

    if (progress) {
      // Project committed work with the same constant recharge rate used by scheduling.
      const skill = skillsById?.get(skillId);
      if (!skill) throw new Error(`Missing skill ${skillId} for passive recharge query.`);
      readyAt = gw2CooldownReadyAt(projectRecharge(progress, gw2RechargeRate(config, skill)));
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
    skillOnCooldownAt,
    rechargeReadyAt(skill: Skill, progress: RechargeProgress): number {
      // Rewinds and passive queries share the scheduler's constant recharge rate.
      return projectRecharge(progress, gw2RechargeRate(config, skill));
    }
  });
}

export interface Gw2TimelineIndex {
  rechargeReadyAt(skill: Skill, progress: RechargeProgress): number;
  /** Invalidates indexed history after the source owner replaces an event. */
  onEventReplaced(previous: SimulationEvent, replacement: SimulationEvent): void;
  buffStacksAt(
    kind: string,
    time: number,
    duration: number,
    maximum: number,
    audience?: Gw2BuffAudience,
    companionId?: string | null
  ): number;
  timedStacks(kind: string, time: number, duration: number, maximum: number): number;
  timedActive(kind: string, time: number): boolean;
  vigorActiveAt(time: number): boolean;
  activeWeaponSetAt(time: number): number;
  activeSigilSetAt(time: number): Gw2SigilSet;
  skillOnCooldownAt(skillId: import('#gw2/platform/engine/skills/types.js').SkillId, time: number): boolean;
}
