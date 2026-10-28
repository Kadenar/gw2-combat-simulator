import type {
  BuildAttributes,
  BuildContext,
  BuildContextFactory,
  BuildContextInput,
  BuildContextModule,
  WeaponSet
} from '#gw2/build-context/types.js';
import type { Gw2AttributeMap, Gw2AttributeSeed } from '#gw2/platform/attributes/types.js';

/** Total AR already includes account augmentations, infusions, and temporary bonuses. */
export interface FractalBuffs {
  enabled: boolean;
  agonyResistance: number;
  augmentation: 'none' | 'savant' | 'prodigy' | 'champion' | 'god';
}

// https://wiki.guildwars2.com/wiki/Fractal_Potion and the linked account augmentation effects.
export const FRACTAL_AUGMENTATIONS = {
  none: { label: 'None', damage: 0 },
  savant: { label: 'Fractal Savant (+1% damage)', damage: 0.01 },
  prodigy: { label: 'Fractal Prodigy (+2% damage)', damage: 0.02 },
  champion: { label: 'Fractal Champion (+4% damage)', damage: 0.04 },
  god: { label: 'Fractal God (+7% damage)', damage: 0.07 }
} as const;

export const DEFAULT_FRACTAL_BUFFS: Readonly<FractalBuffs> = Object.freeze({
  enabled: false,
  agonyResistance: 150,
  augmentation: 'none'
});

/** Reject malformed optimizer input before workers evaluate a different scenario. */
export function validateFractalBuffs(value: unknown): asserts value is FractalBuffs | undefined {
  if (value === undefined) return;

  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid fractal buffs.');

  const buffs = value as FractalBuffs;

  if (
    Object.keys(buffs).some((key) => !Object.hasOwn(DEFAULT_FRACTAL_BUFFS, key)) ||
    typeof buffs.enabled !== 'boolean' ||
    !Number.isSafeInteger(buffs.agonyResistance) ||
    buffs.agonyResistance < 0 ||
    !Object.hasOwn(FRACTAL_AUGMENTATIONS, buffs.augmentation)
  )
    throw new TypeError('Invalid fractal buffs: use nonnegative integer AR and a known account augmentation.');
}

/** Potion conversions add final stats without feeding another attribute conversion. */
export function fractalAttributes(buffs: FractalBuffs | undefined): Record<string, number> {
  validateFractalBuffs(buffs);

  if (!buffs?.enabled) return {};

  // Optimization assumes maximum mastery and five stacks of all three potions.
  const bonus = buffs.agonyResistance * 1.5;
  return {
    Vitality: bonus,
    Toughness: bonus,
    Concentration: bonus
  };
}

/** Converted potion stats bypass conversion pools; concentration also contributes its derived boon duration. */
function potionAttributes(attributes: Gw2AttributeMap, bonus: number): Gw2AttributeMap {
  return Object.fromEntries(
    Object.entries(attributes).map(([name, attribute]) => {
      const amount = ['Vitality', 'Toughness', 'Concentration'].includes(name)
        ? bonus
        : name === 'Boon Duration'
          ? bonus / 15
          : 0;
      return [
        name,
        amount
          ? { ...attribute, final: attribute.final + amount, fractalPotions: (attribute.fractalPotions ?? 0) + amount }
          : attribute
      ];
    })
  );
}

/** Only final seed totals change: traits, utilities, and companion policies retain their original conversion sources. */
function potionSeed(seed: Gw2AttributeSeed, bonus: number): Gw2AttributeSeed {
  return {
    ...seed,
    commonTotals: {
      ...seed.commonTotals,
      vitality: (seed.commonTotals.vitality ?? 0) + bonus,
      toughness: (seed.commonTotals.toughness ?? 0) + bonus,
      concentration: (seed.commonTotals.concentration ?? 0) + bonus
    },
    sources: potionAttributes(seed.sources, bonus)
  };
}

/** Decorate an ordinary context inside the optimizer; the shared build pipeline never sees fractal settings. */
export function createOptimizerBuildContext(
  adapter: Pick<BuildContextModule, 'createBuildContext'>,
  input: BuildContextInput,
  buffs?: FractalBuffs
): BuildContext {
  validateFractalBuffs(buffs);
  const context = adapter.createBuildContext(input);

  if (!buffs?.enabled) return context;

  const bonus = fractalAttributes(buffs).Concentration;
  const damage = 1.15 * (1 + FRACTAL_AUGMENTATIONS[buffs.augmentation].damage);
  const attributes = new Map<WeaponSet, BuildAttributes>();
  return {
    ...context,
    attributes(weaponSet) {
      let result = attributes.get(weaponSet);

      if (!result) {
        const base = context.attributes(weaponSet);
        result = {
          ...base,
          attributes: potionAttributes(base.attributes, bonus),
          attributeSeed: potionSeed(base.attributeSeed, bonus)
        };
        attributes.set(weaponSet, result);
      }

      return result;
    },
    simulationConfig() {
      const config = context.simulationConfig();

      if (!config.attributeInputs) throw new Error('Optimizer contexts require attribute inputs.');

      return {
        ...config,
        attributeInputs: {
          weaponSets: [
            potionSeed(config.attributeInputs.weaponSets[0], bonus),
            potionSeed(config.attributeInputs.weaponSets[1], bonus)
          ]
        },
        modifiers: {
          ...config.modifiers,
          playerStrike: (config.modifiers?.playerStrike ?? 1) * damage,
          playerCondition: (config.modifiers?.playerCondition ?? 1) * damage
        }
      };
    }
  };
}

/** Detached preview adapters reuse the optimizer context factory when conditional controls rebuild their inputs. */
export function optimizerBuildContextFactory(
  adapter: Pick<BuildContextModule, 'createBuildContext'>,
  buffs?: FractalBuffs
): BuildContextFactory {
  return (input) => createOptimizerBuildContext(adapter, input, buffs);
}
