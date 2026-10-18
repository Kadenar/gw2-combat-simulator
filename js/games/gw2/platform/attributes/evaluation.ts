import { CONDITION, BOON } from '#gw2/platform/constants.js';
import { boonKey, MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import { resolveAttributeEffects } from '#gw2/platform/attributes/calculation.js';
import type {
  Gw2AttributeContext,
  Gw2AttributeContributions,
  Gw2AttributeConversionInputs,
  Gw2AttributeEffect,
  Gw2AttributeLoadout,
  Gw2NumericAttributes
} from '#gw2/platform/attributes/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/attributes/stats.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';

const ATTRIBUTE_ENTRIES = Object.entries(ATTRIBUTE_NAMES) as [keyof typeof ATTRIBUTE_NAMES, string][];

/** Live boon reads share prototype accessors rather than allocating nine descriptors for every sample. */
class AttributeAssumptions {
  readonly [key: string]: unknown;
  constructor(private readonly context: Gw2ModifierContext) {}
  get fury() {
    return boonActive(this.context, boonKey(BOON.FURY));
  }
  get quickness() {
    return boonActive(this.context, boonKey(BOON.QUICKNESS));
  }
  get alacrity() {
    return boonActive(this.context, boonKey(BOON.ALACRITY));
  }
  get regeneration() {
    return boonActive(this.context, boonKey(BOON.REGENERATION));
  }
  get protection() {
    return boonActive(this.context, boonKey(BOON.PROTECTION));
  }
  get resolution() {
    return boonActive(this.context, boonKey(BOON.RESOLUTION));
  }
  get swiftness() {
    return boonActive(this.context, boonKey(BOON.SWIFTNESS));
  }
  get vigor() {
    return boonActive(this.context, boonKey(BOON.VIGOR));
  }
  get aegis() {
    return boonActive(this.context, boonKey(BOON.AEGIS));
  }
}

/** Build and live queries supply the same read-only facts; declaration arithmetic never depends on preapplied totals. */
export function attributeContext(
  context: Gw2ModifierContext,
  balanceContext: ProfessionBalanceContext,
  loadout?: Gw2AttributeLoadout
): Gw2AttributeContext {
  const config = context.config ?? {};
  return {
    ...context,
    balanceContext,
    profession: context.profession ?? { catalog: balanceContext.catalog },
    weaponSet: context.runtime?.activeWeaponSet ?? config.startingWeaponSet ?? 1,
    loadout: loadout ?? {
      weapons: gw2ConfiguredWeaponSet(config, 1),
      alternateWeapons: gw2ConfiguredWeaponSet(config, 2),
      assumptions: new AttributeAssumptions(context),
      selectedLegends: (config as { selectedLegends?: readonly string[] }).selectedLegends ?? [],
      merged: false
    }
  };
}

/** Resolve every ordinary conversion against one immutable pool, independent of declaration order or live Might. */
export function resolveAttributeContributions(
  seed: Gw2AttributeConversionInputs,
  contributions: readonly Gw2AttributeContributions[]
) {
  const effects: Gw2AttributeEffect[] = [];
  const durations: Gw2NumericAttributes = {};
  let criticalChance = 0;
  // Gather ordinary declarations in one pass; conversion ordering remains the effect resolver's responsibility.
  for (const entry of contributions) {
    if (entry.attributeEffects) effects.push(...entry.attributeEffects);

    criticalChance += entry.traitCriticalChance ?? 0;
    for (const name in entry.traitDurations) {
      if (!Object.hasOwn(entry.traitDurations, name)) continue;

      const amount = entry.traitDurations[name];
      durations[name] = (durations[name] ?? 0) + amount;
    }
  }

  return {
    ...resolveAttributeEffects(seed, effects),
    durations,
    criticalChance
  };
}

/** Add ordinary declarations, then apply accumulated scaling and actor projections without altering source pools. */
export function applyAttributeContributions(
  seed: Gw2AttributeConversionInputs,
  initial: Gw2Stats,
  contributions: readonly Gw2AttributeContributions[]
): Gw2Stats {
  const result: Gw2MutableStats = { ...initial };
  const resolved = resolveAttributeContributions(seed, contributions);
  for (const [key, name] of ATTRIBUTE_ENTRIES)
    if (resolved.attributes[name] || resolved.utilityAttributes[name])
      result[key] = (initial[key] ?? 0) + (resolved.attributes[name] ?? 0) + (resolved.utilityAttributes[name] ?? 0);
  // Copy each duration map only when first changed, keeping both the input and shared declarations immutable.
  let boonDurations: Record<string, number> | undefined;
  let conditionDurations: Record<string, number> | undefined;
  for (const name in resolved.durations) {
    const amount = resolved.durations[name];

    if (name === 'Condition Duration') result.conditionDurationBonus = (result.conditionDurationBonus ?? 0) + amount;
    else if (name === 'Boon Duration') result.boonDurationBonus = (result.boonDurationBonus ?? 0) + amount;
    else if (['Quickness Duration', 'Might Duration', 'Fury Duration'].includes(name)) {
      const boon = name.slice(0, -9).toLowerCase();
      boonDurations ??= { ...initial.boonDurationBonuses };
      boonDurations[boon] = (boonDurations[boon] ?? 0) + amount;
    } else if (name.endsWith(' Duration')) {
      const condition = name.slice(0, -9);
      const key = condition === 'Poison' ? CONDITION.POISONED : condition;
      conditionDurations ??= { ...initial.conditionDurationBonuses };
      conditionDurations[key] = (conditionDurations[key] ?? 0) + amount;
    }
  }

  if (boonDurations) result.boonDurationBonuses = boonDurations;

  if (conditionDurations) result.conditionDurationBonuses = conditionDurations;

  if (resolved.criticalChance)
    result.professionCriticalChanceBonus = (initial.professionCriticalChanceBonus ?? 0) + resolved.criticalChance;

  const uncapped = contributions.reduce((sum, entry) => sum + (entry.uncappedBoonDuration ?? 0), 0);

  if (uncapped) result.uncappedBoonDurationBonus = (initial.uncappedBoonDurationBonus ?? 0) + uncapped;

  // Scaling consumes accumulated attributes; actor projections follow scaling regardless of declaration order.
  for (const entry of contributions)
    if (entry.transforms)
      for (const transform of entry.transforms)
        if (transform.kind === 'scale' && transform.factor !== 1)
          for (const [key] of ATTRIBUTE_ENTRIES) result[key] = (result[key] ?? 0) * transform.factor;
  for (const entry of contributions)
    if (entry.transforms)
      for (const transform of entry.transforms)
        if (transform.kind === 'convert-current')
          result[transform.to] = (result[transform.to] ?? 0) + (result[transform.from] ?? 0) * transform.multiplier;
  // Add the eligible-pool conversion without scaling final-only buffs or exposing it to later conversions.
  for (const [key, name] of ATTRIBUTE_ENTRIES)
    if (resolved.reinforcedArmorAttributes[name])
      result[key] = (result[key] ?? 0) + resolved.reinforcedArmorAttributes[name];
  let projected: Gw2Stats = result;
  for (const entry of contributions)
    if (entry.transforms)
      for (const transform of entry.transforms)
        if (transform.kind === 'project')
          projected = transform.replace ? { ...transform.attributes } : { ...projected, ...transform.attributes };
  return projected;
}

/** Baseline and trait-adjusted Might are one phase, never ordinary conversion input. */
export function applyMightAttributes(
  initial: Gw2Stats,
  stacks: number,
  contributions: readonly Gw2AttributeContributions[]
): Gw2Stats {
  const might = Math.max(0, Math.min(25, stacks));

  if (!might) return initial;

  let power = 0;
  let conditionDamage = 0;
  for (const entry of contributions) {
    power += entry.mightPerStack?.power ?? 0;
    conditionDamage += entry.mightPerStack?.conditionDamage ?? 0;
  }

  return {
    ...initial,
    power: (initial.power ?? 0) + might * (MIGHT_ATTRIBUTE_BONUS_PER_STACK + power),
    conditionDamage: (initial.conditionDamage ?? 0) + might * (MIGHT_ATTRIBUTE_BONUS_PER_STACK + conditionDamage)
  };
}

/** Condition replacements sample final Power only after relic and actor projection. */
export function applyFinalConditionAttributes(
  context: Gw2ModifierContext,
  initial: Gw2Stats,
  contributions: readonly Gw2AttributeContributions[]
): Gw2Stats {
  if (!isGw2PlayerModifierOwnedEvent(context.event)) return initial;

  let result = initial;
  for (const entry of contributions) {
    if (entry.finalCondition && entry.finalCondition.condition === context.event?.condition)
      result = { ...result, conditionDamage: (result.power ?? 0) * entry.finalCondition.powerMultiplier };
  }

  return result;
}
