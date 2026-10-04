import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import type { Gw2DamageCalculation } from '#gw2/platform/events/events.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { Gw2ResolvedConditionApplication } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { DamageCalculationError } from '#gw2/platform/skill-damage/errors.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import type {
  SkillDamageConditionRow,
  SkillDamageEvaluation,
  SkillDamageMeasurement,
  SkillDamageOccurrence,
  SkillDamageOccurrenceResult,
  SkillDamageRequest,
  SkillDamageStrikeBreakdown
} from '#gw2/platform/skill-damage/types.js';

type ConditionApplication = Gw2ResolvedConditionApplication;

type StrikeHit = Gw2ResolverEvent & {
  readonly damage: number;
  readonly damageCalculation?: Gw2DamageCalculation;
  readonly hits?: number;
  readonly coefficient?: number;
  readonly criticalChance?: number;
  readonly criticalDamage?: number;
  readonly resolvedWeaponStrength?: number;
};

export type SkillDamageCache = Map<string, SkillDamageOccurrenceResult>;

const contentIds = new WeakMap<Gw2ProfessionSource, number>();

let nextContentId = 0;

/** Measure each declared occurrence independently; no trigger sampling or activation probability enters the result. */
export function evaluateSkillDamage(
  request: SkillDamageRequest,
  profession: Gw2ProfessionSource,
  cache?: SkillDamageCache
): SkillDamageEvaluation {
  let contentId = contentIds.get(profession);
  if (contentId == null) {
    contentId = ++nextContentId;
    contentIds.set(profession, contentId);
  }

  const configKey = `${contentId}|${JSON.stringify(request.config)}|${JSON.stringify(request.inputs)}`;
  return {
    occurrences: request.occurrences.map((occurrence) => {
      const key = `${configKey}|${JSON.stringify(occurrence)}`;
      let result = cache?.get(key);
      if (!result) result = evaluateOccurrence(request, profession, occurrence);
      if (cache) {
        cache.delete(key);
        cache.set(key, result);
        if (cache.size > 256) cache.delete(cache.keys().next().value!);
      }

      return result;
    })
  };
}

/** Variants keep their own calculation failures instead of disappearing or changing the primary silently. */
function evaluateOccurrence(
  request: SkillDamageRequest,
  profession: Gw2ProfessionSource,
  occurrence: SkillDamageOccurrence
): SkillDamageOccurrenceResult {
  const run = (entry: SkillDamageOccurrence) => {
    try {
      const result = executeDamageOccurrence(profession, request.config, entry, request.inputs);
      const strikes = result.events.filter(
        (event): event is StrikeHit =>
          event.type === 'damage' &&
          typeof event.damage === 'number' &&
          (event.damageKind !== 'condition' || event.flatDamage != null)
      );
      const conditions = result.events.filter(
        (event): event is ConditionApplication =>
          typeof event.condition === 'string' && typeof event.effectiveDuration === 'number'
      );
      const measurement = measureEvents(strikes, conditions, result.castSeconds);
      return {
        measurement,
        status: measurement.total > 0 ? ('measured' as const) : ('zero' as const),
        damaging: result.damaging
      };
    } catch (error) {
      return {
        measurement: null,
        status: error instanceof DamageCalculationError ? error.status : ('failed' as const),
        reason: error instanceof Error ? error.message : String(error),
        damaging: true
      };
    }
  };

  const variants = (occurrence.variants ?? []).map((variant) => ({
    id: variant.id,
    label: variant.label,
    ...run({
      ...occurrence,
      inputs: { ...occurrence.inputs, ...variant.inputs },
      cast: { ...occurrence.cast, ...variant.cast }
    })
  }));
  const primary = variants.find((variant) => variant.id === occurrence.primaryVariantId) ?? variants.at(-1);
  return {
    ...(primary ?? run(occurrence)),
    id: occurrence.id,
    variants,
    primaryVariantId: primary?.id,
    unit: occurrence.unit,
    assumptions: occurrence.assumptions ?? []
  };
}

function measureEvents(
  strikes: readonly StrikeHit[],
  applications: readonly ConditionApplication[],
  castSeconds: number
): SkillDamageMeasurement {
  const strikeHits = strikes.filter((hit) => hit.damageKind !== 'condition');
  const strike = strikeHits.reduce((total, hit) => total + hit.damage, 0);
  const conditions = conditionRows(applications);
  const conditionDamage =
    conditions.reduce((total, row) => total + row.damage, 0) +
    strikes.filter((hit) => hit.damageKind === 'condition').reduce((total, hit) => total + hit.damage, 0);
  return {
    castSeconds,
    hits: strikeHits.reduce((total, hit) => total + (Number(hit.hits) || 1), 0),
    coefficient: strikeHits.reduce((total, hit) => total + (Number(hit.coefficient) || 0), 0),
    strike,
    conditionDamage,
    total: strike + conditionDamage,
    strikeBreakdown: strikeBreakdown(strikeHits),
    conditions
  };
}

/** Sums counted hits; the factor list comes from the first hit, and a flag says when later hits differed. */
function strikeBreakdown(strikes: readonly StrikeHit[]): SkillDamageStrikeBreakdown | null {
  const calculated = strikes.filter((hit) => hit.damageCalculation);
  const first = calculated[0];
  if (!first?.damageCalculation) return null;
  const calculation = first.damageCalculation;
  let baseDamage = 0;
  let nonCriticalDamage = 0;
  let criticalDamage = 0;
  for (const hit of calculated) {
    const facts = hit.damageCalculation!;
    baseDamage += facts.baseDamage;
    nonCriticalDamage += facts.baseDamage * facts.outgoingMultiplier;
    criticalDamage += facts.baseDamage * (hit.criticalDamage ?? 1) * facts.outgoingMultiplier;
  }

  return {
    weaponStrength: Number.isFinite(Number(first.resolvedWeaponStrength)) ? Number(first.resolvedWeaponStrength) : null,
    power: calculation.power,
    baseDamage,
    nonCriticalDamage,
    criticalDamage,
    criticalChance: first.criticalChance ?? 0,
    criticalDamageMultiplier: first.criticalDamage ?? 1,
    averagedCriticalMultiplier: calculation.criticalMultiplier,
    outgoingMultiplier: calculation.outgoingMultiplier,
    contributors: calculation.outgoingContributors ?? [],
    // A single formula explains the total only when every hit uses the same inputs and contributor factors.
    variesAcrossHits:
      calculated.length !== strikes.length ||
      calculated.some((hit) => {
        const facts = hit.damageCalculation!;
        return (
          facts.power !== calculation.power ||
          hit.resolvedWeaponStrength !== first.resolvedWeaponStrength ||
          hit.criticalChance !== first.criticalChance ||
          hit.criticalDamage !== first.criticalDamage ||
          facts.criticalMultiplier !== calculation.criticalMultiplier ||
          facts.outgoingMultiplier !== calculation.outgoingMultiplier ||
          JSON.stringify(facts.outgoingContributors) !== JSON.stringify(calculation.outgoingContributors)
        );
      })
  };
}

/** Combine only applications with matching duration and sampled damage facts, so each row explains its own stacks. */
function conditionRows(applications: readonly ConditionApplication[]): SkillDamageConditionRow[] {
  const rows = new Map<string, SkillDamageConditionRow>();
  for (const application of applications) {
    // Only conditions with a damage formula belong in a damage table; control conditions deal nothing.
    if (!Object.hasOwn(CONDITION_FORMULAS, application.condition) && !(application.damage > 0)) continue;
    const calculation = application.conditionCalculation;
    const facts = {
      condition: application.condition,
      baseDurationSeconds: calculation?.baseDuration ?? application.duration ?? 0,
      effectiveDurationSeconds: application.effectiveDuration,
      durationMultiplier: calculation?.durationMultiplier ?? 1,
      baseDurationMultiplier: calculation?.baseDurationMultiplier ?? 1,
      durationContributors: calculation?.durationContributors ?? [],
      conditionDamage: calculation?.conditionDamage ?? null,
      rate: calculation?.rate ?? null,
      multiplier: calculation?.multiplier ?? null,
      damageContributors: calculation?.damageContributors ?? []
    };
    const key = JSON.stringify(facts);
    const previous = rows.get(key);
    rows.set(key, {
      ...facts,
      stacks: (previous?.stacks ?? 0) + application.stacks,
      damage: (previous?.damage ?? 0) + application.damage
    });
  }

  return [...rows.values()];
}
