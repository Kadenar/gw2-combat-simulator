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

/** Potion conversions add final stats without feeding another attribute conversion. */
export function fractalAttributes(buffs: FractalBuffs | undefined): Record<string, number> {
  validateFractalBuffs(buffs);

  if (!buffs?.enabled) return {};

  // Fractal buffs assume maximum mastery and five stacks of all three potions.
  const bonus = buffs.agonyResistance * 1.5;
  return {
    Vitality: bonus,
    Toughness: bonus,
    Concentration: bonus
  };
}
