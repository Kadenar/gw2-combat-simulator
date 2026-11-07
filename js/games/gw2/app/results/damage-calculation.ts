/** Turns a hit's captured formula facts into the event log's calculation: the equation first, raw facts on request. */
import { effectName } from '#gw2/app/results/effect-labels.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import {
  BASE_CRITICAL_DAMAGE_MULTIPLIER,
  CRITICAL_DAMAGE_FEROCITY_CONTRIBUTOR,
  FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
  STANDARD_TARGET_ARMOR
} from '#gw2/platform/combat/formulas.js';
import type { Gw2DamageCalculation, SimulationEvent } from '#gw2/platform/events/events.js';
import type { ProfessionEffectPresentation } from '#gw2/platform/profession-presentation/types.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';
import type { EventLogCalculation, EventLogCalculationFactor } from '#ui/results/event-log.js';

/** Boons that commonly change damage or rotation timing lead the list, ahead of profession effects and other boons. */
const LEADING_BOONS = Object.freeze(['might', 'fury', 'quickness', 'alacrity']);

const grouped = (value: number, decimals = 0): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Drops trailing zeros while keeping compound factors such as 1.1025 exact enough to recognize. */
const trimmed = (value: number): string => String(Number(value.toFixed(4)));

const percent = (fraction: number): string => `${Number((fraction * 100).toFixed(1))}%`;

const signed = (value: number, text: string): string => `${value < 0 ? '−' : '+'}${text}`;

/** Spells out base damage so its result can be checked by hand, using the formula this packet actually took. */
function baseExplanation(event: SimulationEvent, calculation: Gw2DamageCalculation): string {
  const { power, targetArmor } = calculation;

  if (targetArmor == null) return 'Fixed packet';

  const scaled = `${grouped(power)} Power × ${trimmed(Number(event.coefficient ?? 0))} coef`;

  if (event.resolvedWeaponStrength != null) {
    return `${scaled} × ${grouped(Number(event.resolvedWeaponStrength))} weapon ÷ ${grouped(targetArmor)} armor`;
  }

  // Independent summons without a weapon profile replace weapon strength with a fixed base-power ratio.
  return `${scaled} × ${grouped(Number(event.summonDamagePerCoefficient))} per coef ÷ ${grouped(Number(event.summonBasePower))} base Power × ${grouped(STANDARD_TARGET_ARMOR)} ÷ ${grouped(targetArmor)} armor`;
}

/** Rebuilds the critical multiplier step by step, including grants that bypass the displayed Ferocity attribute. */
function criticalDamageFormula(event: SimulationEvent, calculation: Gw2DamageCalculation): string {
  const contributors = calculation.criticalDamageContributors;

  if (!contributors) return `×${trimmed(Number(event.criticalDamage ?? 1))} authored`;

  let formula = String(BASE_CRITICAL_DAMAGE_MULTIPLIER);
  for (const { id, label, bucket, value } of contributors) {
    if (id === CRITICAL_DAMAGE_FEROCITY_CONTRIBUTOR) {
      formula += ` + ${grouped(calculation.ferocity ?? 0)} Fero/${FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER}`;
    } else if (bucket === 'additive') {
      formula += ` ${value < 0 ? '−' : '+'} ${Math.abs(value).toFixed(3)} ${label}`;
    } else {
      formula = `(${formula}) × ${trimmed(value)} ${label}`;
    }
  }

  return formula;
}

/** States how the critical step was applied, because an averaged multiplier differs from the multiplier on a crit. */
function criticalExplanation(event: SimulationEvent, calculation: Gw2DamageCalculation): string {
  if (!event.critEligible) return 'Cannot crit';

  const chance = Number(event.criticalChance ?? 0);
  const label = percent(chance);

  if (event.averagedCriticalDamage) {
    const formula = criticalDamageFormula(event, calculation);
    return chance >= 1 ? `${label} · ${formula}` : `${label}, averaged · ${formula} on crit`;
  }

  return event.didCrit
    ? `Rolled crit at ${label} · ${criticalDamageFormula(event, calculation)}`
    : `Rolled no crit at ${label}`;
}

function outgoingExplanation(calculation: Gw2DamageCalculation): string {
  const count = calculation.outgoingContributors?.length ?? 0;

  if (count) return `${count} ${count === 1 ? 'modifier' : 'modifiers'}`;

  return calculation.outgoingMultiplier === 1 ? 'No modifiers' : 'Fixed multiplier';
}

/** Explains the final step, including a health gate that can leave the packet below its rounded value. */
function damageExplanation(event: SimulationEvent, calculation: Gw2DamageCalculation): string {
  const floored = calculation.rounding === 'floor';
  const rounded = floored ? Math.floor(calculation.unroundedDamage) : roundHalfToEven(calculation.unroundedDamage);
  const limited = Number(event.damage) < rounded ? ', limited by health gate' : '';
  return `${grouped(calculation.unroundedDamage, 2)}, ${floored ? 'floored' : 'rounded half-even'}${limited}`;
}

/**
 * Ranks modifiers by what this hit alone would lose without each one. Additive entries share a single (1 + Σ) factor,
 * so removing one takes only its share; this is packet arithmetic, not a rerun of the rotation without the modifier.
 */
function modifierFactors(calculation: Gw2DamageCalculation): EventLogCalculationFactor[] {
  const contributors = calculation.outgoingContributors ?? [];
  const additiveBucket = contributors.reduce(
    (sum, { bucket, value }) => (bucket === 'additive' ? sum + value : sum),
    1
  );
  return contributors
    .map(({ label, bucket, value }) => {
      const additive = bucket === 'additive';
      const lost = calculation.unroundedDamage * (additive ? value / additiveBucket : 1 - 1 / value);
      return {
        lost: Number.isFinite(lost) ? lost : 0,
        label,
        value: additive ? `${signed(value, percent(Math.abs(value)))} add.` : `×${trimmed(value)}`,
        exact: String(value)
      };
    })
    .sort((left, right) => Math.abs(right.lost) - Math.abs(left.lost))
    .map(({ lost, ...factor }) => ({
      ...factor,
      // Removing a penalty raises damage, so the sign shows the direction of the change rather than a fixed loss.
      impact: Math.round(lost) === 0 ? '0' : signed(-lost, grouped(Math.abs(lost)))
    }));
}

/** Recorded facts at full clock precision; the log's activation grouping is not an execution trace. */
function rawFacts(
  event: SimulationEvent,
  calculation: Gw2DamageCalculation,
  presentations: readonly ProfessionEffectPresentation[]
): string[] {
  // These are captured player effects, not a claim that every effect contributes to this packet's multiplier.
  const buffs = calculation.activeBuffs.map(
    ({ kind, stacks, name }) => `${name ?? effectName(kind, {}, presentations)} x${stacks}`
  );
  const criticalOutcome = event.averagedCriticalDamage ? 'averaged' : event.didCrit ? 'rolled crit' : 'rolled no crit';
  return [
    `Simulation time: ${event.at.toFixed(6)}s; phase: ${calculation.phase}`,
    `Active player buffs and boons: ${buffs.join(', ') || 'None'}`,
    `Target health before: ${calculation.targetHealthBefore ?? 'unbounded'}; fraction: ${calculation.targetHealthFractionBefore ?? 'unbounded'}`,
    ...(calculation.targetArmor == null ? [] : [`Target armor: ${calculation.targetArmor}`]),
    `Power: ${calculation.power}`,
    ...(calculation.precision == null ? [] : [`Precision: ${calculation.precision}`]),
    ...(calculation.ferocity == null ? [] : [`Ferocity: ${calculation.ferocity}`]),
    ...(event.coefficient == null ? [] : [`Authored coefficient: ${event.coefficient}`]),
    ...(event.resolvedWeaponStrength == null
      ? []
      : [`Weapon strength: ${event.resolvedWeaponStrength} (${event.weaponStrengthProfileId})`]),
    ...(event.activationId == null ? [] : [`Activation: ${event.activationId}`]),
    `Base damage: ${calculation.baseDamage}`,
    `Critical chance: ${event.criticalChance}; outcome: ${event.critEligible ? criticalOutcome : 'cannot crit'}; critical damage: ${event.criticalDamage}; applied multiplier: ${calculation.criticalMultiplier}`,
    ...(calculation.criticalDamageContributors ?? []).map(({ label, bucket, value }) =>
      bucket === 'additive'
        ? `Critical damage additive: ${label} ${value >= 0 ? '+' : ''}${value}`
        : `Critical damage factor: ${label} ×${value}`
    ),
    `Outgoing multiplier: ${calculation.outgoingMultiplier}`,
    ...(calculation.outgoingContributors ?? []).map(({ label, bucket, value }) =>
      bucket === 'additive'
        ? `Outgoing additive: ${label} ${value >= 0 ? '+' : ''}${value}`
        : `Outgoing factor: ${label} ×${value}`
    ),
    `Unrounded damage: ${calculation.unroundedDamage}; rounding: ${calculation.rounding}; damage: ${event.damage}`
  ];
}

/** Presents one captured hit; `atSeconds` is the log's combat clock, while raw facts keep the simulation clock. */
export function damageCalculationPresentation(
  event: SimulationEvent,
  calculation: Gw2DamageCalculation,
  {
    heading,
    atSeconds,
    presentations
  }: {
    readonly heading: string;
    readonly atSeconds: number;
    readonly presentations: readonly ProfessionEffectPresentation[];
  }
): EventLogCalculation {
  const { activeBuffs, targetHealthFractionBefore: targetHealth } = calculation;
  const effectLabel = ({ kind, stacks, name }: Gw2DamageCalculation['activeBuffs'][number]): string =>
    `${name ?? effectName(kind, {}, presentations)}${stacks > 1 ? ` ${stacks}` : ''}`;
  const isStandardBoon = ({ kind }: { readonly kind: string }): boolean => GW2_STANDARD_BOONS.includes(kind);
  const isOtherBoon = (buff: { readonly kind: string }): boolean =>
    isStandardBoon(buff) && !LEADING_BOONS.includes(buff.kind);
  return {
    heading,
    meta: `${atSeconds.toFixed(3)}s${targetHealth == null ? '' : ` · target ${percent(targetHealth)} HP`}`,
    steps: [
      {
        label: 'Base',
        explanation: baseExplanation(event, calculation),
        value: grouped(calculation.baseDamage, 2),
        exact: String(calculation.baseDamage)
      },
      {
        label: 'Crit',
        explanation: criticalExplanation(event, calculation),
        value: `× ${grouped(calculation.criticalMultiplier, 3)}`,
        exact: String(calculation.criticalMultiplier)
      },
      {
        label: 'Outgoing',
        explanation: outgoingExplanation(calculation),
        value: `× ${grouped(calculation.outgoingMultiplier, 3)}`,
        exact: String(calculation.outgoingMultiplier)
      },
      {
        label: 'Damage',
        explanation: damageExplanation(event, calculation),
        value: grouped(Number(event.damage)),
        exact: String(calculation.unroundedDamage)
      }
    ],
    factors: modifierFactors(calculation),
    effects: [
      ...LEADING_BOONS.flatMap((kind) => activeBuffs.filter((buff) => buff.kind === kind)),
      ...activeBuffs.filter((buff) => !isStandardBoon(buff)),
      ...activeBuffs.filter(isOtherBoon)
    ].map(effectLabel),
    trace: `sim ${event.at.toFixed(3)}s${event.activationId == null ? '' : ` · ${event.activationId}`} · ${calculation.phase}`,
    raw: rawFacts(event, calculation, presentations)
  };
}
