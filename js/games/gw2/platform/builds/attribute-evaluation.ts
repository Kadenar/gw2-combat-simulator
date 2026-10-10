import { ATTRIBUTE_NAMES, attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';
import { resolveAttributeEffects } from '#gw2/platform/builds/attributes.js';
import type {
  Gw2AttributeContext,
  Gw2AttributeContributionCalculator,
  Gw2AttributeContributions,
  Gw2AttributeLoadout,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';

/** Build and live queries supply the same read-only facts; declaration arithmetic never depends on preapplied totals. */
export function attributeContext(
  context: Gw2ModifierContext,
  balanceContext: ProfessionBalanceContext,
  loadout?: Gw2AttributeLoadout
): Gw2AttributeContext {
  const config = context.config ?? {};
  const boons = [
    'fury',
    'quickness',
    'alacrity',
    'regeneration',
    'protection',
    'resolution',
    'swiftness',
    'vigor',
    'aegis'
  ];
  return {
    ...context,
    balanceContext,
    profession: context.profession ?? { catalog: balanceContext.catalog },
    weaponSet: context.runtime?.activeWeaponSet ?? config.startingWeaponSet ?? 1,
    loadout: loadout ?? {
      weapons: gw2ConfiguredWeaponSet(config, 1),
      alternateWeapons: gw2ConfiguredWeaponSet(config, 2),
      assumptions: Object.defineProperties(
        {},
        Object.fromEntries(boons.map((boon) => [boon, { enumerable: true, get: () => boonActive(context, boon) }]))
      ),
      selectedLegends: (config as { selectedLegends?: readonly string[] }).selectedLegends ?? [],
      merged: false
    }
  };
}

/** Resolve every ordinary conversion against one immutable pool, independent of declaration order or live Might. */
export function resolveAttributeContributions(
  pool: Readonly<Gw2NumericAttributes>,
  contributions: readonly Gw2AttributeContributions[]
) {
  const attributes = resolveAttributeEffects(
    pool,
    contributions.flatMap((entry) => entry.attributeEffects ?? [])
  );
  const durations: Gw2NumericAttributes = {};
  for (const entry of contributions)
    for (const [name, amount] of Object.entries(entry.traitDurations ?? {}))
      durations[name] = (durations[name] ?? 0) + amount;
  return {
    attributes,
    durations,
    criticalChance: contributions.reduce((sum, entry) => sum + (entry.traitCriticalChance ?? 0), 0)
  };
}

/** Add ordinary declarations, then apply accumulated scaling and actor projections without altering source pools. */
export function applyAttributeContributions(
  context: Gw2AttributeContext,
  initial: Gw2Stats,
  calculate: Gw2AttributeContributionCalculator
): Gw2Stats {
  const result: Gw2MutableStats = { ...initial };
  const contributions = calculate(context);
  const resolved = resolveAttributeContributions(
    attributeSeed(context.config ?? {}, context.weaponSet).conversionPool,
    contributions
  );
  for (const [key, name] of Object.entries(ATTRIBUTE_NAMES))
    if (resolved.attributes[name])
      result[key as keyof typeof ATTRIBUTE_NAMES] =
        (initial[key as keyof typeof ATTRIBUTE_NAMES] ?? 0) + (resolved.attributes[name] ?? 0);
  for (const [name, amount] of Object.entries(resolved.durations)) {
    if (name === 'Condition Duration') result.conditionDurationBonus = (result.conditionDurationBonus ?? 0) + amount;
    else if (name === 'Boon Duration') result.boonDurationBonus = (result.boonDurationBonus ?? 0) + amount;
    else if (['Quickness Duration', 'Might Duration', 'Fury Duration'].includes(name)) {
      const boon = name.slice(0, -9).toLowerCase();
      result.boonDurationBonuses = {
        ...result.boonDurationBonuses,
        [boon]: (result.boonDurationBonuses?.[boon] ?? 0) + amount
      };
    } else if (name.endsWith(' Duration')) {
      const condition = name.slice(0, -9);
      result.conditionDurationBonuses = {
        ...result.conditionDurationBonuses,
        [condition === 'Poison' ? 'Poisoned' : condition]:
          (result.conditionDurationBonuses?.[condition === 'Poison' ? 'Poisoned' : condition] ?? 0) + amount
      };
    }
  }

  if (resolved.criticalChance)
    result.professionCriticalChanceBonus = (initial.professionCriticalChanceBonus ?? 0) + resolved.criticalChance;
  const uncapped = contributions.reduce((sum, entry) => sum + (entry.uncappedBoonDuration ?? 0), 0);
  if (uncapped) result.uncappedBoonDurationBonus = (initial.uncappedBoonDurationBonus ?? 0) + uncapped;
  // Scaling consumes accumulated attributes; actor projections follow scaling regardless of declaration order.
  for (const transform of contributions
    .flatMap((entry) => entry.transforms ?? [])
    .filter((entry) => entry.kind === 'scale')
    .filter((entry) => entry.factor !== 1))
    for (const key of Object.keys(ATTRIBUTE_NAMES) as (keyof typeof ATTRIBUTE_NAMES)[])
      result[key] = (result[key] ?? 0) * transform.factor;
  for (const transform of contributions
    .flatMap((entry) => entry.transforms ?? [])
    .filter((entry) => entry.kind === 'convert-current'))
    result[transform.to] = (result[transform.to] ?? 0) + (result[transform.from] ?? 0) * transform.multiplier;
  let projected: Gw2Stats = result;
  for (const transform of contributions
    .flatMap((entry) => entry.transforms ?? [])
    .filter((entry) => entry.kind === 'project'))
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
  return {
    ...initial,
    power:
      (initial.power ?? 0) +
      might *
        (MIGHT_ATTRIBUTE_BONUS_PER_STACK +
          contributions.reduce((sum, entry) => sum + (entry.mightPerStack?.power ?? 0), 0)),
    conditionDamage:
      (initial.conditionDamage ?? 0) +
      might *
        (MIGHT_ATTRIBUTE_BONUS_PER_STACK +
          contributions.reduce((sum, entry) => sum + (entry.mightPerStack?.conditionDamage ?? 0), 0))
  };
}

/** Condition replacements sample final Power only after relic and actor projection. */
export function applyFinalConditionAttributes(
  context: Gw2AttributeContext,
  initial: Gw2Stats,
  calculate: Gw2AttributeContributionCalculator
): Gw2Stats {
  if (!isGw2PlayerModifierOwnedEvent(context.event)) return initial;
  let result = initial;
  for (const entry of calculate(context)) {
    if (entry.finalCondition && entry.finalCondition.condition === context.event?.condition)
      result = { ...result, conditionDamage: (result.power ?? 0) * entry.finalCondition.powerMultiplier };
  }

  return result;
}
