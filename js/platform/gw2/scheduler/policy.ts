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
import { CAST_READY, denyCast } from '../../engine/skills/availability.js';
import {
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  isStandardBoon,
  remainingDurationStackSeconds
} from '../combat/state/boons.js';
import { relicWeaponSwapRechargeMultiplier } from '../equipment/relics/catalog.js';
import { gw2BoonDurationMultiplier, gw2SigilSet, gw2StatsForWeaponSet } from '../combat/query/runtime-rules.js';
import { projectCastRelativeEffectTimingMs, quicknessReferenceCastTimeMs } from '../skills/timing.js';
import type {
  CanonicalCatalog,
  CastContext,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
  SkillEffect
} from '../../engine/types.js';
import { defaultWeaponSkillMatchesSet, weaponSkillMatchesSet } from '../equipment/weapons/skill-matcher.js';
import type { Gw2CombatQuery } from '../combat/query/types.js';
import type { Gw2Config } from '../simulation/config.js';
import type { Gw2SchedulerPolicy } from './types.js';
import type { Gw2Stats } from '../equipment/types.js';
import type { Gw2WeaponSkillMatcher } from '../equipment/weapons/types.js';

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
const WEAPON_SWAP_SKILL = 'Swap Weapons';

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

/** Applies the shared GW2 boon-duration policy to a scheduler-owned base duration. */
export function gw2SchedulerBoonDuration<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  boon: string,
  baseDuration: number,
  { fixedDuration = false }: { readonly fixedDuration?: boolean } = {}
): number {
  // Manual profession emissions use the same policy boundary as declarative
  // skill boons so live profession attributes and the active weapon set agree.
  if (fixedDuration || !isStandardBoon(boon)) return baseDuration;
  return (
    context.schedulerPolicy?.effectDuration?.(
      context,
      skill,
      { type: 'boon', boon, duration: baseDuration, fixedDuration },
      baseDuration
    ) ?? baseDuration
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

    availability(context: CastContext, skill: Skill) {
      return isGw2WeaponSkillEquipped(context, skill, matcher, catalog)
        ? CAST_READY
        : denyCast('gw2.weapon-not-equipped', `${skill.name} is unavailable — its required weapon is not equipped.`);
    },

    effectDuration(_context, _skill, effect, baseDuration) {
      const boon = effect.boon || effect.kind || effect.name;

      // Generic positive buffs have fixed durations. Concentration and boon-
      // duration bonuses apply only to authored standard-boon applications.
      if (effect.fixedDuration === true || effect.type !== 'boon' || !isStandardBoon(boon)) {
        return baseDuration;
      }

      const weaponSet = _context.state?.activeWeaponSet === 2 ? 2 : 1;
      const sigils = gw2SigilSet(config, weaponSet);
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
      return baseDuration * gw2BoonDurationMultiplier(String(boon), stats, sigils);
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

      // Weapon swap ignores Alacrity; an equipped relic modifier instead changes
      // its base recharge directly so rotations use the game's actual timing.
      if (skill.name === WEAPON_SWAP_SKILL) {
        return baseDuration * relicWeaponSwapRechargeMultiplier(config.relic);
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
