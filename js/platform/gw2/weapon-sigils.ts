import type { Gw2Build, Gw2SigilSet } from './types.js';
import { SIGIL_DATA, SIGIL_NAMES } from './sigil-data.js';

export const DEFAULT_WEAPON_SIGILS: readonly (readonly string[])[] = Object.freeze([
  Object.freeze(['Force', 'Accuracy']),
  Object.freeze(['Force', 'Accuracy'])
]);

export function normalizeWeaponSigils(
  value: readonly (readonly string[])[] | null | undefined,
  fallback: readonly (readonly string[])[] = DEFAULT_WEAPON_SIGILS
): string[][] {
  return [0, 1].map((setIndex) => {
    const normalized = [0, 1].map((slotIndex) => {
      const selected = value?.[setIndex]?.[slotIndex];
      if (typeof selected === 'string' && SIGIL_NAMES.includes(selected)) {
        return selected;
      }

      return fallback?.[setIndex]?.[slotIndex] || DEFAULT_WEAPON_SIGILS[setIndex]?.[slotIndex] || 'Force';
    });
    if (normalized[0] === normalized[1]) {
      const replacement = [fallback[setIndex]?.[1], ...(DEFAULT_WEAPON_SIGILS[setIndex] || []), ...SIGIL_NAMES].find(
        (name) => typeof name === 'string' && SIGIL_NAMES.includes(name) && name !== normalized[0]
      );
      if (replacement) normalized[1] = replacement;
    }

    return normalized;
  });
}

export function weaponSigilsForSet(build: Gw2Build, setNumber = 1): string[] {
  const setIndex = setNumber - 1;
  return [0, 1].map((slotIndex) => {
    const selected = build?.weaponSigils?.[setIndex]?.[slotIndex];
    return typeof selected === 'string' && SIGIL_NAMES.includes(selected)
      ? selected
      : DEFAULT_WEAPON_SIGILS[setIndex]?.[slotIndex] || 'Force';
  });
}

export function setWeaponSigil(build: Gw2Build, setIndex: number, slotIndex: number, name: string): void {
  if (![0, 1].includes(setIndex) || ![0, 1].includes(slotIndex) || !SIGIL_NAMES.includes(name)) {
    return;
  }

  const normalized = normalizeWeaponSigils(build.weaponSigils);
  build.weaponSigils = normalized;
  const sigils = normalized[setIndex];
  const otherSlot = slotIndex === 0 ? 1 : 0;
  const previous = sigils[slotIndex];
  if (sigils[otherSlot] === name) sigils[otherSlot] = previous;
  sigils[slotIndex] = name;
}

interface MutableSigilSet {
  [field: string]: unknown;
  names: string[];
  criticalChanceBonus: number;
  strikeAdd: number;
  strike: number;
  nightStrikeMultiplier: number;
  conditionAdd: number;
  condition: number;
  conditionDurationBonus: number;
  conditionDurationBonuses: Record<string, number>;
  boonDurationBonus: number;
}

export function aggregateSigilSet(sigilNames: readonly string[] | null | undefined): Gw2SigilSet {
  const effects: MutableSigilSet = {
    names: [...new Set(sigilNames || [])],
    criticalChanceBonus: 0,
    strikeAdd: 0,
    strike: 1,
    nightStrikeMultiplier: 1,
    conditionAdd: 0,
    condition: 1,
    conditionDurationBonus: 0,
    conditionDurationBonuses: {},
    boonDurationBonus: 0
  };
  const durationFields: Readonly<Record<string, string>> = {
    bleedingDuration: 'Bleeding',
    burningDuration: 'Burning',
    poisonDuration: 'Poisoned',
    tormentDuration: 'Torment'
  };

  for (const name of new Set(sigilNames || [])) {
    const sigil = SIGIL_DATA[name];
    if (!sigil) continue;
    effects.criticalChanceBonus += Number(sigil.criticalChance || 0);
    effects.strikeAdd += Number(sigil.strikeDamageA || 0) / 100;
    effects.nightStrikeMultiplier *= 1 + Number(sigil.nightStrikeDamageM || 0) / 100;
    effects.conditionAdd += Number(sigil.conditionDamageA || 0) / 100;
    effects.conditionDurationBonus += Number(sigil.conditionDuration || 0);
    effects.boonDurationBonus += Number(sigil.boonDuration || 0);
    for (const [field, condition] of Object.entries(durationFields)) {
      const bonus = Number(sigil[field] || 0);
      if (bonus) {
        effects.conditionDurationBonuses[condition] = (effects.conditionDurationBonuses[condition] || 0) + bonus;
      }
    }
  }

  effects.strike = 1 + effects.strikeAdd;
  effects.condition = 1 + effects.conditionAdd;
  return effects;
}
