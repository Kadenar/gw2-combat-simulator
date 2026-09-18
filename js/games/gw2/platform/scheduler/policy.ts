import { EPSILON, canonicalTime } from '#kernel/core/clock.js';
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
 * Player `skill.castTimeMs` is the effective action duration. Independent summons
 * retain their base and Quickness durations. Cast-relative effect offsets follow
 * runtime skill variants using runtimeCast / referenceCastTimeMs.
 * This scaling only applies to effects marked `timingScale: "cast"`.
 * `timingScale: "fixed"` keeps its authored offsets unchanged. An interval on
 * a cast-scaled effect follows the same scale unless it explicitly declares
 * `intervalTimingScale: "fixed"`.
 */
import { createGw2TriggerMaterializer, GW2_MATERIALIZE_EVENT_TASK } from '#gw2/platform/scheduler/proc-materializer.js';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import {
  createGw2ComboMaterializer,
  GW2_COMBO_MATERIALIZE_EVENT_TASK
} from '#gw2/platform/scheduler/combo-materializer.js';
import { ensurePermanentComboFieldAssumption } from '#gw2/platform/combos/permanent-field-assumption.js';
import { createGw2EventPreparer } from '#gw2/platform/scheduler/event-preparer.js';
import { CAST_READY, denyCast } from '#gw2/platform/engine/skills/availability.js';
import { TRANSITION_LOCKOUT_EVENT } from '#gw2/platform/simulation/transition-delays.js';
import {
  buffApplicationStacks,
  buffMatchesAudience,
  isDurationStackingBoon,
  isStandardBoon,
  normalizeBoonDuration
} from '#gw2/platform/combat/boons.js';
import { relicWeaponSwapRechargeReduction } from '#gw2/platform/equipment/relics/catalog.js';
import { gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { gw2SigilSet } from '#gw2/platform/equipment/sigils/rules.js';
import { gw2StatsForWeaponSet } from '#gw2/platform/combat/query/combat-query.js';
import { projectCastRelativeEffectTimingMs, summonQuicknessCastTimeMs } from '#gw2/platform/skills/timing.js';
import { gw2TrackedRechargeReduction } from '#gw2/platform/skills/recharge.js';
import type { CanonicalCatalog, Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { CastContext, SchedulerContext } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { defaultWeaponSkillMatchesSet, weaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { Gw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/scheduler/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';

interface CreateGw2SchedulerPolicyOptions {
  readonly traits?: ReadonlySet<string | number> | null;
  readonly catalog?: CanonicalCatalog | null;
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
}

type CastBoundTimingContext = SchedulerContext & {
  /** Cast start and planned full completion, in simulation seconds. */
  start: number;
  fullEnd: number;
};

/** Alacrity increases recharge rate by 25%, so duration is divided by 1.25. */
export const GW2_ALACRITY_RECHARGE_RATE = 1.25;
// Bar swaps remain freely available during setup until combat is actually established.
const OUT_OF_COMBAT_SWAP_SKILLS = new Set(['Swap Weapons', 'Swap Legends', 'Unsheathe Gunsaber', 'Sheathe Gunsaber']);
const WEAPON_SWAP_SKILL = 'Swap Weapons';

function baseCastDurationMs(skill: Skill): number {
  return Math.max(0, Number(skill.castTimeMs || 0));
}

/**
 * Projects authored effect timing onto a runtime cast variant while retaining
 * the declared cast-start or cast-end anchor.
 */
function scaleCastBoundTiming(context: CastBoundTimingContext, skill: Skill, effect: SkillEffect): SkillEffect {
  if (effect.timingScale !== 'cast') return effect;
  const baseCastMs = baseCastDurationMs(skill);
  if (!(baseCastMs > 0)) return effect;
  const adjustedCastMs = Math.max(0, Number(context.fullEnd - context.start)) * 1000;
  const firstTickAtMs = Array.isArray(effect.ticks) ? Number(effect.ticks[0]?.atMs || 0) : 0;
  // Return a copy because skill metadata is shared by every simulation run.
  return {
    ...effect,
    ...(Array.isArray(effect.ticks)
      ? {
          ticks: effect.ticks.map((tick) => ({
            ...tick,
            // Persistent fields scale their launch delay, then keep real-time pulse spacing.
            atMs:
              effect.intervalTimingScale === 'fixed'
                ? projectCastRelativeEffectTimingMs(skill, adjustedCastMs, firstTickAtMs) +
                  Number(tick.atMs) -
                  firstTickAtMs
                : projectCastRelativeEffectTimingMs(skill, adjustedCastMs, Number(tick.atMs))
          }))
        }
      : {}),
    ...(effect.atMs == null
      ? {}
      : { atMs: projectCastRelativeEffectTimingMs(skill, adjustedCastMs, Number(effect.atMs)) }),
    ...(effect.intervalMs == null || effect.intervalTimingScale === 'fixed'
      ? {}
      : { intervalMs: projectCastRelativeEffectTimingMs(skill, adjustedCastMs, Number(effect.intervalMs)) })
  } as SkillEffect;
}

export function gw2BuffActiveForAudience<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  kind: string,
  at: number,
  audience: 'self' | 'summon' = 'self',
  companionId?: string
): boolean {
  if (audience === 'self') return context.hasBuff(kind, at);
  const normalized = String(kind || '').toLowerCase();
  if (context.events.some((event) => event.type === 'boon_extension') && isStandardBoon(normalized)) {
    const applications = boonApplicationsAt(context.events, normalized, canonicalTime(at));
    return (
      buffApplicationStacks(applications, normalized, at, 1, {
        audience: 'summon',
        companionId
      }) > 0
    );
  }

  return (
    buffApplicationStacks(context.events, normalized, at, 1, {
      duration: (event) => Number(normalizeBoonDuration(event).duration || 0),
      includes: (event) =>
        event.type === 'buff' &&
        String(event.kind || '').toLowerCase() === normalized &&
        // Recipient-specific clocks must not borrow another summon's boon applications.
        buffMatchesAudience(event, 'summon', companionId) &&
        Number(event.stacks || 1) > 0
    }) > 0
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

  const configured = gw2ConfiguredWeaponSet(context.config as Gw2Config, context.state?.activeWeaponSet === 2 ? 2 : 1);
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
  // Combo predictions reuse ordinary boon scaling while supplying their own effect time and actor.
  const boonDuration = (
    context: SchedulerContext,
    skillId: SkillId,
    boon: string,
    baseDuration: number,
    event?: SimulationEvent
  ): number => {
    const weaponSet = context.state?.activeWeaponSet === 2 ? 2 : 1;
    const runtime = {
      ...materializer.state,
      activeWeaponSet: weaponSet,
      combatStartTime: context.combatStartTime,
      profession: context.state.profession
    };
    const query = materializer.state.query as Readonly<Gw2CombatQuery> | null | undefined;
    const stats = context.profession.modifyAttributes(
      {
        profession: context.profession,
        config,
        time: event?.at ?? context.state.time,
        skillId,
        sourceId: event?.sourceId ?? skillId,
        actorType: event?.actorType ?? 'player',
        ...(event ? { event } : {}),
        traits,
        query,
        timeline: query?.timeline,
        events: context.events,
        runtime,
        state: context.state
      },
      gw2StatsForWeaponSet(config, weaponSet)
    ) as Gw2Stats;
    return baseDuration * gw2BoonDurationMultiplier(boon, stats, gw2SigilSet(config, weaponSet));
  };

  const comboMaterializer = createGw2ComboMaterializer(config, (context, combo, boon, baseDuration) =>
    boonDuration(context, combo.skillId ?? combo.sourceId, boon, baseDuration, combo)
  );
  const eventPreparer = createGw2EventPreparer();
  const policy: Gw2SchedulerPolicy = {
    inputReadyAt(context, at) {
      // Only transitions already reached can block an input; future emissions must not block earlier overlaps.
      return context
        .eventsOfType(TRANSITION_LOCKOUT_EVENT)
        .reduce(
          (readyAt, event) =>
            event.at <= at + EPSILON ? Math.max(readyAt, event.at + Number(event.duration || 0)) : readyAt,
          Number.NEGATIVE_INFINITY
        );
    },
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
      ensurePermanentComboFieldAssumption(context, event);
      materializer.onEventScheduled(context, event);
      comboMaterializer.onEventScheduled(context, event);
    },

    onEventReplaced(context, previous, replacement) {
      materializer.onEventReplaced(previous, replacement);
      comboMaterializer.onEventReplaced(context, replacement, previous);
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

      return boonDuration(_context, _skill.id, String(boon), baseDuration);
    },

    buffStacks(context, kind, at, configuredStacks, applications, _defaultStacks) {
      // Configured duration presence is fixed even with extensions; intensity stacks still need replay.
      if (configuredStacks > 0 && isDurationStackingBoon(kind)) return 1;
      if (context.eventsOfType('boon_extension').length > 0 && isStandardBoon(kind)) {
        const extended = boonApplicationsAt(context.events, kind, canonicalTime(at));
        return configuredStacks + buffApplicationStacks(extended, kind, at, Infinity);
      }

      // Scheduler history is already audience-selected; normalize grants only when reading their lifetime.
      const dynamic = buffApplicationStacks(applications, kind, at, Infinity, {
        includes: () => true,
        duration: (event) => Number(normalizeBoonDuration(event).duration || 0)
      });
      return (isDurationStackingBoon(kind) ? 0 : configuredStacks) + dynamic;
    },

    castDuration(context, skill, baseDuration) {
      // Only independent summon casts still react to Quickness; players already store their effective duration.
      if (!skill.independentCast || !context.hasBuff('quickness', context.start)) return baseDuration;
      return summonQuicknessCastTimeMs(skill, baseDuration * 1000) / 1000;
    },

    effectTiming(context, skill, effect) {
      // Fixed effects keep wall-clock timing; cast-relative effects follow runtime variants.
      return scaleCastBoundTiming(context, skill, effect);
    },

    rechargeDuration(context, skill, baseDuration) {
      const at = Number(context.at ?? context.effectiveEnd ?? context.start ?? 0);
      if (OUT_OF_COMBAT_SWAP_SKILLS.has(skill.name) && !materializer.isCombatActive()) {
        return 0;
      }

      // Weapon swap ignores Alacrity; Relic of the Warrior removes a fixed 2.5 seconds
      // from any base recharge so profession-specific swap timings remain distinct.
      if (skill.name === WEAPON_SWAP_SKILL) {
        return Math.max(0, baseDuration - relicWeaponSwapRechargeReduction(config.relic));
      }

      const hasAlacrity = gw2BuffActiveForAudience(context, 'alacrity', at, skill.rechargeBuffAudience || 'self');
      const rate = hasAlacrity ? Number(config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE) : 1;
      // Alacrity is evaluated when recharge begins, which can differ from cast
      // start for skills whose recharge anchor is cast end or an effect event.
      // Recharge speed is a rate, so elapsed duration is divided by it.
      return baseDuration / Math.max(Number.EPSILON, rate);
    },

    rechargeReduction(context, skill, baseReduction) {
      const at = Number(context.at ?? context.state.time ?? 0);
      const hasAlacrity = gw2BuffActiveForAudience(context, 'alacrity', at, skill.rechargeBuffAudience || 'self');
      const rate = hasAlacrity ? Number(config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE) : 1;
      // Flat recharge reductions advance recharge units; only recharge speed converts them to wall time.
      return gw2TrackedRechargeReduction(baseReduction, rate);
    }
  };
  return Object.freeze(policy);
}
