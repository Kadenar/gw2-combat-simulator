import { BOON, CONDITION } from '#gw2/platform/constants.js';
import type {
  Gw2AttributeInputs,
  Gw2AttributeSeed,
  Gw2SeedAttributeConversion,
  Gw2CommonAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/attributes/types.js';
import type { Gw2Stats } from '#gw2/platform/attributes/stats.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { UTILITY_DATA } from '#gw2/platform/equipment/consumables/utilities.js';

/** Seed declarations keep utilities and permanent reinforcement in the same grouped conversion phase. */
export function equipmentAttributeConversions(utility = ''): readonly Gw2SeedAttributeConversion[] {
  const conversions: Gw2SeedAttributeConversion[] = Object.hasOwn(UTILITY_DATA, utility)
    ? UTILITY_DATA[utility as keyof typeof UTILITY_DATA].map(({ from, to, percent }) => ({
        source: 'utility',
        from,
        to,
        multiplier: percent / 100,
        rounding: 'round'
      }))
    : [];
  conversions.push({
    source: 'reinforcedArmor',
    from: 'Vitality',
    to: 'Vitality',
    multiplier: 0.05,
    rounding: 'round'
  });
  return conversions;
}

export const ATTRIBUTE_NAMES = Object.freeze({
  power: 'Power',
  precision: 'Precision',
  toughness: 'Toughness',
  vitality: 'Vitality',
  ferocity: 'Ferocity',
  conditionDamage: 'Condition Damage',
  expertise: 'Expertise',
  concentration: 'Concentration',
  healingPower: 'Healing Power'
} as const);

/**
 * Direct callers explicitly author base stats, all eligible for ordinary conversions; calculated totals are not inputs.
 * Tests use distinct base and alternate seeds to exercise the same weapon-set input contract as equipment builds.
 */
export function baseAttributeInputs(base: Gw2Stats = {}, alternate: Gw2Stats = base): Gw2AttributeInputs {
  const seed = (stats: Gw2Stats): Gw2AttributeSeed => {
    const commonTotals = {
      power: 1000,
      precision: 1000,
      toughness: 1000,
      vitality: 1000,
      ferocity: 0,
      conditionDamage: 0,
      expertise: 0,
      concentration: 0,
      healingPower: 0,
      ...stats
    };
    const conversionPool = Object.fromEntries(
      Object.entries(ATTRIBUTE_NAMES).map(([key, name]) => [name, commonTotals[key as keyof typeof ATTRIBUTE_NAMES]])
    );
    return { commonTotals, conversionPool, conversions: equipmentAttributeConversions(), sources: {} };
  };

  const inputs = { weaponSets: [seed(base), seed(alternate)] as const };
  validateAttributeInputs(inputs);
  return inputs;
}

const BASE_INPUTS = baseAttributeInputs();
const validatedInputs = new WeakSet();

/** Reject ambiguous or malformed sources before queries can silently lose conversion inputs. */
export function validateAttributeInputs(value: unknown): asserts value is Gw2AttributeInputs {
  const inputs = value as { weaponSets?: unknown[] } | null;

  if (!inputs || !Array.isArray(inputs.weaponSets) || inputs.weaponSets.length !== 2)
    throw new TypeError('Attribute inputs require exactly two weapon-set seeds.');

  for (const candidate of inputs.weaponSets) {
    const seed = candidate as Partial<Gw2AttributeSeed> | null;

    if (!seed?.commonTotals || !seed.conversionPool || !seed.sources || !Array.isArray(seed.conversions))
      throw new TypeError(
        'Attribute seed requires common totals, conversion pool, conversion declarations, and sources.'
      );

    for (const conversion of seed.conversions) {
      if (
        !conversion ||
        !['utility', 'reinforcedArmor'].includes(conversion.source) ||
        !Object.values(ATTRIBUTE_NAMES).includes(conversion.from) ||
        !Object.values(ATTRIBUTE_NAMES).includes(conversion.to) ||
        !Number.isFinite(conversion.multiplier) ||
        !['round', 'floor', 'none'].includes(conversion.rounding)
      )
        throw new TypeError('Attribute seed requires valid conversion declarations.');
    }

    for (const [key, name] of Object.entries(ATTRIBUTE_NAMES)) {
      if (
        !Number.isFinite(seed.commonTotals[key as keyof typeof ATTRIBUTE_NAMES]) ||
        !Number.isFinite(seed.conversionPool[name])
      )
        throw new TypeError(`Attribute seed requires finite ${name} totals and conversion inputs.`);
    }

    for (const values of [seed.commonTotals, seed.conversionPool])
      for (const value of Object.values(values) as unknown[])
        if (
          typeof value === 'number'
            ? !Number.isFinite(value)
            : !value || typeof value !== 'object' || Object.values(value).some((entry) => !Number.isFinite(entry))
        )
          throw new TypeError('Attribute inputs must contain finite numeric values.');
    for (const source of Object.values(seed.sources) as unknown[])
      if (
        !source ||
        typeof source !== 'object' ||
        Array.isArray(source) ||
        Object.values(source).some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
        ['final', 'base', 'gear', 'runes', 'food', 'utility', 'jbc', 'traits', 'sigils', 'infusions'].some(
          (key) => !Number.isFinite((source as Record<string, unknown>)[key])
        )
      )
        throw new TypeError('Attribute sources must contain finite numeric breakdowns.');
  }
}

/** The absence of authored equipment means a naked level-80 character, never precomputed profession stats. */
export function attributeSeed(config: Gw2Config, weaponSet = config.startingWeaponSet): Gw2AttributeSeed {
  const inputs = config.attributeInputs ?? BASE_INPUTS;

  if (!validatedInputs.has(inputs)) {
    validateAttributeInputs(inputs);
    validatedInputs.add(inputs);
  }

  return inputs.weaponSets[Number(weaponSet) === 2 ? 1 : 0];
}

/** Preserve the common calculator's eligibility and source breakdown before adding profession contributions. */
export function attributeSeedFromCommon(common: Gw2CommonAttributeResult): Gw2AttributeSeed {
  const value = (name: string) => common.attributes[name]?.final ?? 0;
  const duration = (name: string) => value(name) - (common.attributes[name]?.sigils ?? 0);
  const commonTotals: Gw2Stats = {
    ...Object.fromEntries(Object.entries(ATTRIBUTE_NAMES).map(([key, name]) => [key, value(name)])),
    boonDurationBonus: Math.max(0, duration('Boon Duration') - value('Concentration') / 15),
    conditionDurationBonus: Math.max(0, duration('Condition Duration') - value('Expertise') / 15),
    conditionDurationBonuses: Object.fromEntries(
      [CONDITION.BLEEDING, CONDITION.BURNING, CONDITION.CONFUSION, 'Poison', CONDITION.TORMENT].map((name) => [
        name === 'Poison' ? CONDITION.POISONED : name,
        duration(name + ' Duration')
      ])
    ),
    boonDurationBonuses: Object.fromEntries(
      [BOON.QUICKNESS, BOON.MIGHT, BOON.FURY].map((name) => [name.toLowerCase(), duration(name + ' Duration')])
    )
  };
  return {
    commonTotals,
    conversionPool: { ...common.commonContext.conversionPool },
    conversions: common.commonContext.conversions,
    sources: structuredClone(common.attributes)
  };
}

const equipmentSourcePools = new WeakMap<Gw2AttributeSeed, Readonly<Gw2NumericAttributes>>();

/** Specialized policies share immutable equipment-only pools; weapon sets have separate seeds. */
export function attributeSourcePool(
  config: Gw2Config,
  policy: 'common' | 'catalyst',
  weaponSet?: number
): Readonly<Gw2NumericAttributes> {
  const seed = attributeSeed(config, weaponSet);

  if (policy === 'common') return seed.conversionPool;

  const cached = equipmentSourcePools.get(seed);

  if (cached) return cached;

  const pool = Object.freeze(
    Object.fromEntries(
      Object.entries(ATTRIBUTE_NAMES).map(([key, name]) => {
        const source = seed.sources[name];
        const amount = source
          ? ['base', 'gear', 'runes', 'infusions', 'food', 'jbc'].reduce(
              (sum, part) => sum + (source[part as keyof typeof source] ?? 0),
              0
            ) + (key === 'conditionDamage' ? source.utility : 0)
          : (seed.conversionPool[name] ?? 0);
        return [key, amount];
      })
    )
  );
  equipmentSourcePools.set(seed, pool);
  return pool;
}
