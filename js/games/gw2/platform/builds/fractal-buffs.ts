/** Saved fractal assumptions and potion bonuses shared by every build consumer. */
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

/** Reject malformed saved assumptions before previews or workers evaluate them. */
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

/** Full potion stacks at maximum mastery grant this much Vitality, Toughness, and Concentration per AR. */
const FRACTAL_POTION_STATS_PER_AR = 1.5;

/** Five offensive potion stacks multiply player damage before account augmentation. */
export const FRACTAL_POTION_DAMAGE_MULTIPLIER = 1.15;

/** Full potion stacks with maximum mastery add final stats without feeding other conversions. */
export function fractalPotionBonus(buffs?: FractalBuffs): number {
  return buffs?.enabled ? buffs.agonyResistance * FRACTAL_POTION_STATS_PER_AR : 0;
}
