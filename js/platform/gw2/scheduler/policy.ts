/**
 * Shared Guild Wars 2 scheduling rules used by `simulateGw2`.
 *
 * The neutral scheduler owns ordering and task execution. This policy adds the
 * game-specific rules that every profession on that pipeline shares: weapon
 * validation, boon duration, Quickness timing, Alacrity recharge, ammunition,
 * critical-hit fact prediction, and combat-start tracking.
 *
 * ## Cast and effect timing
 *
 * `skill.castTimeMs` is the canonical unquickened baseline. The catalog can
 * derive it from `quicknessCastTimeMs`. When Quickness is present at cast start,
 * the measured Quickness duration is used when supplied. Otherwise the baseline
 * is divided by the 1.5 action-rate multiplier and rounded up to the next 40 ms
 * action tick.
 *
 * Explicit cast-scaled effect offsets are authored against the Quickness timeline:
 *
 *     runtimeOffset = authoredOffset * runtimeCast / quicknessReferenceCastTimeMs
 *
 * A Quickness cast therefore uses the authored values 1:1, while an unquickened
 * cast expands them. This scaling only applies to effects marked
 * `timingScale: "cast"`.
 * `timingScale: "fixed"` keeps its authored offsets unchanged. An interval on
 * a cast-scaled effect follows the same scale unless it explicitly declares
 * `intervalTimingScale: "fixed"`.
 */
import { createGw2TriggerMaterializer, GW2_MATERIALIZE_EVENT_TASK } from './proc-materializer.js';
import { createGw2ComboMaterializer, GW2_COMBO_MATERIALIZE_EVENT_TASK } from './combo-materializer.js';
import { createGw2EventPreparer } from './event-preparer.js';
import {
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  remainingDurationStackSeconds
} from '../boon-state.js';
import { clamp } from '../numeric.js';
import { gw2StatsForWeaponSet } from '../runtime-rules.js';
import { projectCastRelativeEffectTimingMs, quicknessReferenceCastTimeMs } from '../skill-timing.js';
import type {
  CanonicalCatalog,
  CastContext,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
  SkillEffect
} from '../../engine/types.js';
import { defaultWeaponSkillMatchesSet, weaponSkillMatchesSet } from '../weapon-skill-matcher.js';
import type { Gw2CombatQuery, Gw2Config, Gw2SchedulerPolicy, Gw2Stats, Gw2WeaponSkillMatcher } from '../types.js';

interface CreateGw2SchedulerPolicyOptions {
  readonly traits?: ReadonlySet<string | number> | null;
  readonly catalog?: CanonicalCatalog | null;
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
}

type CastBoundTimingContext = SchedulerContext &
  SchedulerRecord & {
    /** Cast start and planned full completion, in simulation seconds. */
    start: number;
    fullEnd: number;
  };

/** Alacrity increases recharge rate by 25%, so duration is divided by 1.25. */
export const GW2_ALACRITY_RECHARGE_RATE = 1.25;
const OUT_OF_COMBAT_SWAP_SKILLS = new Set(['Swap Weapons', 'Swap Legends']);

function baseCastDurationMs(skill: Skill): number {
  return Math.max(0, Number(skill.castTimeMs || 0));
}

/**
 * Projects Quickness-relative effect timing onto the actual runtime cast.
 * Quickened casts use the stored packet values unchanged; slower casts scale
 * them upward while retaining their declared cast-start or cast-end anchor.
 */
function scaleCastBoundTiming(context: CastBoundTimingContext, skill: Skill, effect: SkillEffect): SkillEffect {
  if (effect.timingScale !== 'cast') return effect;
  const baseCastMs = baseCastDurationMs(skill);
  if (!(baseCastMs > 0) || skill.unaffectedByQuickness) return effect;
  const adjustedCastMs = Math.max(0, Number(context.fullEnd - context.start)) * 1000;
  // Return a copy because skill metadata is shared by every simulation run.
  return {
    ...effect,
    ...(Array.isArray(effect.ticks)
      ? {
          ticks: effect.ticks.map((tick) => ({
            ...tick,
            atMs: projectCastRelativeEffectTimingMs(skill, adjustedCastMs, Number(tick.atMs))
          }))
        }
      : {}),
    ...(effect.atMs == null
      ? {}
      : { atMs: projectCastRelativeEffectTimingMs(skill, adjustedCastMs, Number(effect.atMs)) }),
    ...(effect.intervalMs == null || effect.intervalTimingScale === 'fixed'
      ? {}
      : { intervalMs: projectCastRelativeEffectTimingMs(skill, adjustedCastMs, Number(effect.intervalMs)) })
  };
}

function titleCase(value: unknown): string {
  const normalized = String(value || '').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function gw2BuffActiveForAudience<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  kind: string,
  at: number,
  audience: 'self' | 'summon' = 'self'
): boolean {
  if (audience === 'self') return context.hasBuff(kind, at);
  const normalized = String(kind || '').toLowerCase();
  if (isDurationStackingBoon(normalized)) {
    return (
      remainingDurationStackSeconds(context.events, at + context.epsilon, {
        includes: (event) =>
          event.type === 'buff' &&
          String(event.kind || '').toLowerCase() === normalized &&
          event.affectsSummons === true &&
          Number(event.stacks || 1) > 0,
        maximum: durationStackingBoonCapSeconds(normalized)
      }) > context.epsilon
    );
  }

  return context.events.some(
    (event) =>
      event.type === 'buff' &&
      String(event.kind || '').toLowerCase() === normalized &&
      event.affectsSummons === true &&
      Number(event.stacks || 1) > 0 &&
      event.at <= at + context.epsilon &&
      event.at + Math.max(0, Number(event.duration || 0)) > at + context.epsilon
  );
}

function configuredWeaponSet(config: Gw2Config, weaponSet: number): [string | undefined, string | undefined] {
  if (weaponSet === 2) {
    return [config.weaponSet2Primary, config.weaponSet2Secondary];
  }

  return [config.primaryWeapon, config.secondaryWeapon];
}

export function isGw2WeaponSkillEquipped(
  context: SchedulerContext,
  skill: Skill,
  matcher: Gw2WeaponSkillMatcher = defaultWeaponSkillMatchesSet,
  catalog: CanonicalCatalog | null = null
): boolean {
  const hasExplicitRequirement =
    skill.requiredMainHand != null ||
    skill.requiredOffHand != null ||
    skill.weaponSet?.mainHand != null ||
    skill.weaponSet?.offHand != null;
  if (!hasExplicitRequirement && (skill.type !== 'Weapon' || !skill.weapon)) {
    return true;
  }

  const configured = configuredWeaponSet(context.config as Gw2Config, context.state?.activeWeaponSet === 2 ? 2 : 1);
  // Empty weapon configuration is treated as an unrestricted sandbox build.
  return (
    configured.every((value) => !value) ||
    weaponSkillMatchesSet(matcher, skill, configured, {
      catalog,
      config: context.config,
      state: context.state
    })
  );
}

/**
 * Composes the shared GW2 scheduler policy around the neutral engine.
 *
 * Profession modules may add cast rules, scheduler hooks, handlers, and event
 * reactions, but casts and declarative effects still pass through this policy.
 */
export function createGw2SchedulerPolicy(
  config: Gw2Config = {},
  {
    traits = null,
    catalog = null,
    weaponSkillMatchesSet: matcher = defaultWeaponSkillMatchesSet
  }: CreateGw2SchedulerPolicyOptions = {}
): Readonly<Gw2SchedulerPolicy> {
  const materializer = createGw2TriggerMaterializer(config, { traits });
  const comboMaterializer = createGw2ComboMaterializer(config);
  const eventPreparer = createGw2EventPreparer();
  const policy: Gw2SchedulerPolicy = {
    taskHandlers: Object.freeze({
      [GW2_MATERIALIZE_EVENT_TASK]: (context, task) => materializer.handleTask(context, task),
      [GW2_COMBO_MATERIALIZE_EVENT_TASK]: (context, task) => comboMaterializer.handleTask(context, task)
    }),

    initialize(context) {
      materializer.initialize(context);
    },

    prepareEvent(context, event) {
      return eventPreparer.prepare(context, event);
    },

    onEventScheduled(context, event: SimulationEvent) {
      materializer.onEventScheduled(context, event);
      comboMaterializer.onEventScheduled(context, event);
    },

    critical(_context, event) {
      return materializer.critical(event);
    },

    rollRandom(probability, stream) {
      return materializer.rollRandom(probability, stream);
    },

    isCombatActive() {
      return materializer.isCombatActive();
    },

    combatBeganAt() {
      return materializer.combatBeganAt();
    },

    requireCriticalFacts() {
      materializer.requireCriticalFacts();
    },

    initialWeaponSet() {
      return Number(config.startingWeaponSet) === 2 ? 2 : 1;
    },

    validateCast(context: CastContext, skill: Skill) {
      return isGw2WeaponSkillEquipped(context, skill, matcher, catalog);
    },

    effectDuration(_context, _skill, effect, baseDuration) {
      if ((effect.type !== 'boon' && effect.type !== 'buff') || effect.durationScale === 'fixed') {
        return baseDuration;
      }

      const name = titleCase(effect.boon || effect.kind || effect.name);
      const weaponSet = _context.state?.activeWeaponSet === 2 ? 2 : 1;
      const sigils = config.sigilSets?.[weaponSet - 1] || {};
      const staticStats = gw2StatsForWeaponSet(config, weaponSet);
      const runtime = {
        ...materializer.state,
        activeWeaponSet: weaponSet,
        combatStartTime: _context.combatStartTime,
        profession: _context.state.profession
      };
      const query = materializer.state.query as Readonly<Gw2CombatQuery> | null | undefined;
      const stats = _context.profession.modifyAttributes(
        {
          profession: _context.profession,
          config,
          time: _context.state.time,
          skillId: _skill.id,
          sourceId: _skill.id,
          actorType: 'player',
          traits,
          query,
          timeline: query?.timeline,
          events: _context.events,
          runtime,
          state: _context.state
        },
        staticStats
      ) as Gw2Stats;
      const bonus =
        Number(stats.concentration || 0) / 1500 +
        Number(stats.boonDurationBonus || 0) / 100 +
        Number(stats.boonDurationBonuses?.[name] || 0) / 100 +
        Number(sigils.boonDurationBonus || 0) / 100;
      // GW2 boon duration cannot be reduced below base here and caps at +100%.
      return baseDuration * clamp(1 + bonus, 1, 2);
    },

    buffStacks(context, kind, at, configuredStacks, applications, defaultStacks) {
      if (!isDurationStackingBoon(kind)) return defaultStacks;
      if (configuredStacks > 0) return 1;
      return remainingDurationStackSeconds(applications, at + context.epsilon, {
        maximum: durationStackingBoonCapSeconds(kind)
      }) > context.epsilon
        ? 1
        : 0;
    },

    castDuration(context, skill, baseDuration) {
      if (skill.unaffectedByQuickness) return baseDuration;
      // Quickness is snapshotted at cast start for both the action and any
      // cast-scaled effect offsets belonging to that action.
      if (!context.hasBuff('quickness', context.start)) return baseDuration;
      // Measured metadata wins and is not quantized again. The fallback models
      // the standard action-rate conversion and action-tick boundary.
      return quicknessReferenceCastTimeMs(skill, baseDuration * 1000) / 1000;
    },

    effectTiming(context, skill, effect) {
      // The helper leaves fixed effects untouched, preserves stored Quickness
      // timing at a 1:1 scale, and expands cast-bound timing for slower casts.
      return scaleCastBoundTiming(context, skill, effect);
    },

    rechargeDuration(context, skill, baseDuration) {
      const at = Number(context.at ?? context.effectiveEnd ?? context.start ?? 0);
      if (OUT_OF_COMBAT_SWAP_SKILLS.has(skill.name) && !materializer.isCombatActive()) {
        return 0;
      }

      const hasAlacrity = gw2BuffActiveForAudience(context, 'alacrity', at, skill.rechargeBuffAudience || 'self');
      const rate = hasAlacrity ? Number(config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE) : 1;
      // Alacrity is evaluated when recharge begins, which can differ from cast
      // start for skills whose recharge anchor is cast end or an effect event.
      // Recharge speed is a rate, so elapsed duration is divided by it.
      return baseDuration / Math.max(Number.EPSILON, rate);
    },

    maximumAmmo(_context, skill, baseMaximum) {
      return baseMaximum ?? Number(skill.ammo || 0);
    }
  };
  return Object.freeze(policy);
}
