import { ATTRIBUTE_NAMES, attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';
import { resolveAttributeEffects } from '#gw2/platform/builds/attributes.js';
import type {
  Gw2AttributeContext,
  Gw2AttributeContributionCalculator,
  Gw2AttributeContributions,
  Gw2AttributeLoadout,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
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

/** Add declarations to an unprocessed seed; specialized live transforms run after this shared phase. */
export function applyAttributeContributions(
  context: Gw2AttributeContext,
  initial: Gw2Stats,
  calculate: Gw2AttributeContributionCalculator
): Gw2Stats {
  const result: Gw2MutableStats = { ...initial };
  const resolved = resolveAttributeContributions(
    attributeSeed(context.config ?? {}, context.weaponSet).conversionPool,
    calculate(context)
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
  return result;
}
