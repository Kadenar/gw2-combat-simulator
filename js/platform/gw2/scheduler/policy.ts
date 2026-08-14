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
 * Explicit effect offsets are also authored against the unquickened timeline:
 *
 *     runtimeOffset = authoredOffset * runtimeCast / castTimeMs
 *
 * This scaling only applies to effects marked `timingScale: "cast"`.
 * `timingScale: "fixed"` keeps its authored offsets unchanged. An interval on
 * a cast-scaled effect follows the same scale unless it explicitly declares
 * `intervalTimingScale: "fixed"`.
 */
import {
  createGw2TriggerMaterializer,
  GW2_MATERIALIZE_EVENT_TASK,
} from "./proc-materializer.js";
import {
  createGw2ComboMaterializer,
  GW2_COMBO_MATERIALIZE_EVENT_TASK,
} from "./combo-materializer.js";
import { createGw2EventPreparer } from "./event-preparer.js";
import { clamp } from "../numeric.js";
import { gw2StatsForWeaponSet } from "../runtime-rules.js";
import type {
  CanonicalCatalog,
  CastContext,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
  SkillEffect,
} from "../../engine/types.js";
import {
  defaultWeaponSkillMatchesSet,
  weaponSkillMatchesSet,
} from "../weapon-skill-matcher.js";
import type {
  Gw2Config,
  Gw2SchedulerPolicy,
  Gw2WeaponSkillMatcher,
} from "../types.js";

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

/** Quickness increases action rate by 50%, so duration is divided by 1.5. */
const QUICKNESS_ACTION_RATE = 1.5;
/** GW2 completes calculated cast durations on 40 ms action-tick boundaries. */
const ACTION_TICK_MS = 40;
/** Alacrity increases recharge rate by 25%, so duration is divided by 1.25. */
export const GW2_ALACRITY_RECHARGE_RATE = 1.25;
const OUT_OF_COMBAT_SWAP_SKILLS = new Set(["Swap Weapons", "Swap Legends"]);

/** Rounds a positive duration up to the next server/action interval. */
function quantizeUp(value: number, interval: number): number {
  if (!(value > 0)) return 0;
  // Casts complete on the first 40 ms action tick at or after their scaled
  // duration. The epsilon avoids rounding an exact boundary into the next tick.
  return Math.ceil(value / interval - 1e-9) * interval;
}

function baseCastDurationMs(skill: Skill): number {
  return Math.max(0, Number(skill.castTimeMs || 0));
}

/**
 * Projects an effect from its unquickened cast timeline onto the runtime cast.
 *
 * For example, an effect at 840 ms on a 1320 ms base cast occurs at 560 ms
 * when the runtime cast is 880 ms: `840 * 880 / 1320`.
 *
 * `timingAnchor` remains independent: the scaled offset is still measured from
 * whichever anchor the effect declares (`castStart` or `castEnd`).
 */
function scaleCastBoundTiming(
  context: CastBoundTimingContext,
  skill: Skill,
  effect: SkillEffect,
): SkillEffect {
  if (effect.timingScale !== "cast") return effect;
  const baseCastMs = baseCastDurationMs(skill);
  if (!(baseCastMs > 0)) return effect;
  const adjustedCastMs =
    Math.max(0, Number(context.fullEnd - context.start)) * 1000;
  const scale = adjustedCastMs / baseCastMs;
  // Return a copy because skill metadata is shared by every simulation run.
  return {
    ...effect,
    ...(Array.isArray(effect.ticks)
      ? {
          ticks: effect.ticks.map((tick) => ({
            ...tick,
            atMs: Number(tick.atMs) * scale,
          })),
        }
      : {}),
    ...(effect.atMs == null ? {} : { atMs: Number(effect.atMs) * scale }),
    ...(effect.intervalMs == null || effect.intervalTimingScale === "fixed"
      ? {}
      : { intervalMs: Number(effect.intervalMs) * scale }),
  };
}

function titleCase(value: unknown): string {
  const normalized = String(value || "").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function gw2BuffActiveForAudience<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  kind: string,
  at: number,
  audience: "self" | "summon" = "self",
): boolean {
  if (audience === "self") return context.hasBuff(kind, at);
  const normalized = String(kind || "").toLowerCase();
  return context.events.some(
    (event) =>
      event.type === "buff" &&
      String(event.kind || "").toLowerCase() === normalized &&
      event.affectsSummons === true &&
      Number(event.stacks || 1) > 0 &&
      event.at <= at + context.epsilon &&
      event.at + Math.max(0, Number(event.duration || 0)) >
        at + context.epsilon,
  );
}

function configuredWeaponSet(
  config: Gw2Config,
  weaponSet: number,
): [string | undefined, string | undefined] {
  if (weaponSet === 2) {
    return [config.weaponSet2Primary, config.weaponSet2Secondary];
  }
  return [config.primaryWeapon, config.secondaryWeapon];
}

export function isGw2WeaponSkillEquipped(
  context: SchedulerContext,
  skill: Skill,
  matcher: Gw2WeaponSkillMatcher = defaultWeaponSkillMatchesSet,
  catalog: CanonicalCatalog | null = null,
): boolean {
  if (skill.type !== "Weapon" || !skill.weapon) return true;
  const configured = configuredWeaponSet(
    context.config as Gw2Config,
    context.state?.activeWeaponSet === 2 ? 2 : 1,
  );
  // Empty weapon configuration is treated as an unrestricted sandbox build.
  return (
    configured.every((value) => !value) ||
    weaponSkillMatchesSet(matcher, skill, configured, {
      catalog,
      config: context.config,
      state: context.state,
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
    weaponSkillMatchesSet: matcher = defaultWeaponSkillMatchesSet,
  }: CreateGw2SchedulerPolicyOptions = {},
): Readonly<Gw2SchedulerPolicy> {
  const materializer = createGw2TriggerMaterializer(config, { traits });
  const comboMaterializer = createGw2ComboMaterializer(config);
  const eventPreparer = createGw2EventPreparer();
  const policy: Gw2SchedulerPolicy = {
    taskHandlers: Object.freeze({
      [GW2_MATERIALIZE_EVENT_TASK]: (context, task) =>
        materializer.handleTask(context, task),
      [GW2_COMBO_MATERIALIZE_EVENT_TASK]: (context, task) =>
        comboMaterializer.handleTask(context, task),
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
      if (
        (effect.type !== "boon" && effect.type !== "buff") ||
        effect.durationScale === "fixed"
      ) {
        return baseDuration;
      }
      const name = titleCase(effect.boon || effect.kind || effect.name);
      const weaponSet = _context.state?.activeWeaponSet === 2 ? 2 : 1;
      const sigils = config.sigilSets?.[weaponSet - 1] || {};
      const stats = gw2StatsForWeaponSet(config, weaponSet);
      const bonus =
        Number(stats.concentration || 0) / 1500 +
        Number(stats.boonDurationBonus || 0) / 100 +
        Number(stats.boonDurationBonuses?.[name] || 0) / 100 +
        Number(sigils.boonDurationBonus || 0) / 100;
      // GW2 boon duration cannot be reduced below base here and caps at +100%.
      return baseDuration * clamp(1 + bonus, 1, 2);
    },

    castDuration(context, skill, baseDuration) {
      if (skill.unaffectedByQuickness) return baseDuration;
      // Quickness is snapshotted at cast start for both the action and any
      // cast-scaled effect offsets belonging to that action.
      if (!context.hasBuff("quickness", context.start)) return baseDuration;
      // Measured metadata wins and is not quantized again. The fallback models
      // the standard action-rate conversion and action-tick boundary.
      if (skill.quicknessCastTimeMs != null) {
        return Math.max(0, Number(skill.quicknessCastTimeMs)) / 1000;
      }
      const quicknessMs = (baseDuration * 1000) / QUICKNESS_ACTION_RATE;
      return quantizeUp(quicknessMs, ACTION_TICK_MS) / 1000;
    },

    effectTiming(context, skill, effect) {
      if (skill.unaffectedByQuickness) return effect;
      if (!context.hasBuff("quickness", context.start)) return effect;
      // The helper leaves fixed effects untouched and scales opted-in offsets,
      // tick arrays, and non-fixed intervals without mutating catalog metadata.
      return scaleCastBoundTiming(context, skill, effect);
    },

    rechargeDuration(context, skill, baseDuration) {
      const at = Number(
        context.at ?? context.effectiveEnd ?? context.start ?? 0,
      );
      if (
        OUT_OF_COMBAT_SWAP_SKILLS.has(skill.name) &&
        !materializer.isCombatActive()
      ) {
        return 0;
      }
      const hasAlacrity = gw2BuffActiveForAudience(
        context,
        "alacrity",
        at,
        skill.rechargeBuffAudience || "self",
      );
      const rate = hasAlacrity
        ? Number(config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE)
        : 1;
      // Alacrity is evaluated when recharge begins, which can differ from cast
      // start for skills whose recharge anchor is cast end or an effect event.
      // Recharge speed is a rate, so elapsed duration is divided by it.
      return baseDuration / Math.max(Number.EPSILON, rate);
    },

    maximumAmmo(_context, skill, baseMaximum) {
      return baseMaximum ?? Number(skill.ammo || 0);
    },
  };
  return Object.freeze(policy);
}
