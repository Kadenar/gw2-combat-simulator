import {
  createGw2TriggerMaterializer,
  GW2_MATERIALIZE_EVENT_TASK,
} from "./proc-materializer.js";
import { createGw2EventPreparer } from "./event-preparer.js";
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
    start: number;
    fullEnd: number;
  };

const QUICKNESS_ACTION_RATE = 1.5;
const ACTION_TICK_MS = 40;
const ALACRITY_RECHARGE_RATE = 1.25;

function quantizeUp(value: number, interval: number): number {
  if (!(value > 0)) return 0;
  // Casts complete on the first 40 ms action tick at or after their scaled
  // duration. The epsilon avoids rounding an exact boundary into the next tick.
  return Math.ceil(value / interval - 1e-9) * interval;
}

function baseCastDurationMs(skill: Skill): number {
  return Math.max(0, Number(skill.castTimeMs || 0));
}

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

/** Composes the shared GW2 scheduler policy around the neutral engine. */
export function createGw2SchedulerPolicy(
  config: Gw2Config = {},
  {
    traits = null,
    catalog = null,
    weaponSkillMatchesSet: matcher = defaultWeaponSkillMatchesSet,
  }: CreateGw2SchedulerPolicyOptions = {},
): Readonly<Gw2SchedulerPolicy> {
  const materializer = createGw2TriggerMaterializer(config, { traits });
  const eventPreparer = createGw2EventPreparer();
  const policy: Gw2SchedulerPolicy = {
    taskHandlers: Object.freeze({
      [GW2_MATERIALIZE_EVENT_TASK]: (context, task) =>
        materializer.handleTask(context, task),
    }),

    initialize(context) {
      materializer.initialize(context);
    },

    prepareEvent(context, event) {
      return eventPreparer.prepare(context, event);
    },

    onEventScheduled(context, event: SimulationEvent) {
      materializer.onEventScheduled(context, event);
    },

    critical(_context, event) {
      return materializer.critical(event);
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
      if (effect.type !== "boon" && effect.type !== "buff") {
        return baseDuration;
      }
      const name = titleCase(effect.boon || effect.kind || effect.name);
      const weaponSet = _context.state?.activeWeaponSet === 2 ? 2 : 1;
      const sigils = config.sigilSets?.[weaponSet - 1] || {};
      const bonus =
        Number(config.stats?.concentration || 0) / 1500 +
        Number(config.stats?.boonDurationBonus || 0) / 100 +
        Number(config.stats?.boonDurationBonuses?.[name] || 0) / 100 +
        Number(sigils.boonDurationBonus || 0) / 100;
      // GW2 boon duration cannot be reduced below base here and caps at +100%.
      return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
    },

    castDuration(context, skill, baseDuration) {
      if (!context.hasBuff("quickness", context.start)) return baseDuration;
      // Explicit metadata wins for skills measured in-game; otherwise apply the
      // standard action-rate multiplier and server-tick quantization.
      if (skill.quicknessCastTimeMs != null) {
        return Math.max(0, Number(skill.quicknessCastTimeMs)) / 1000;
      }
      const quicknessMs = (baseDuration * 1000) / QUICKNESS_ACTION_RATE;
      return quantizeUp(quicknessMs, ACTION_TICK_MS) / 1000;
    },

    effectTiming(context, skill, effect) {
      if (!context.hasBuff("quickness", context.start)) return effect;
      // Pulses attached to cast completion must move with the shortened cast.
      return scaleCastBoundTiming(context, skill, effect);
    },

    rechargeDuration(context, _skill, baseDuration) {
      const at = Number(
        context.at ?? context.effectiveEnd ?? context.start ?? 0,
      );
      const rate = context.hasBuff("alacrity", at)
        ? Number(config.alacrityRechargeRate || ALACRITY_RECHARGE_RATE)
        : 1;
      // Recharge speed is a rate, so elapsed duration is divided by it.
      return baseDuration / Math.max(Number.EPSILON, rate);
    },

    maximumAmmo(_context, skill, baseMaximum) {
      return baseMaximum ?? Number(skill.ammo || 0);
    },
  };
  return Object.freeze(policy);
}
