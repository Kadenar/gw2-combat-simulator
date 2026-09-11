import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2SigilSet } from '#gw2/platform/equipment/types.js';
import { SIGIL_DATA, SIGIL_NAMES } from '#gw2/platform/equipment/sigils/data.js';
import { WEAPON_DATA } from '#gw2/platform/equipment/weapons/data.js';

/** Only one stacking bonus persists across sets; first equipped set/slot wins when several types are selected. */
export function stackingSigilForBuild(build: Gw2Build): string | undefined {
  return [build.weapons, build.alternateWeapons]
    .flatMap((weapons, set) =>
      (build.weaponSigils?.[set] || []).filter(
        (_, slot) => weapons?.[slot] || (slot === 1 && WEAPON_DATA[weapons?.[0] || '']?.wielding === '2h')
      )
    )
    .find((name) => SIGIL_DATA[name]?.stackingStats);
}

export const DEFAULT_WEAPON_SIGILS: readonly (readonly string[])[] = Object.freeze([
  Object.freeze(['Force', 'Accuracy']),
  Object.freeze(['Force', 'Accuracy'])
]);

/** Only one stacking sigil fits the build; Slaying and other identical sigils conflict only within a set. */
export function canEquipWeaponSigil(
  weaponSigils: readonly (readonly string[])[],
  setIndex: number,
  slotIndex: number,
  name: string
): boolean {
  return !weaponSigils.some((set, otherSet) =>
    set.some((equipped, otherSlot) => {
      if (otherSet === setIndex && otherSlot === slotIndex) return false;
      if (SIGIL_DATA[name]?.stackingStats && SIGIL_DATA[equipped]?.stackingStats) return true;
      return equipped === name && otherSet === setIndex;
    })
  );
}

/** Normalizes both weapon-set sigil pairs against supported names and fallbacks. */
export function normalizeWeaponSigils(
  value: readonly (readonly string[])[] | null | undefined,
  fallback: readonly (readonly string[])[] = DEFAULT_WEAPON_SIGILS
): string[][] {
  const normalized: string[][] = [[], []];
  // Preserve the first legal selection and replace later conflicts with a legal fallback.
  for (const setIndex of [0, 1]) {
    for (const slotIndex of [0, 1]) {
      normalized[setIndex][slotIndex] = [
        value?.[setIndex]?.[slotIndex],
        fallback?.[setIndex]?.[slotIndex],
        ...DEFAULT_WEAPON_SIGILS[setIndex],
        ...SIGIL_NAMES
      ].find(
        (name): name is string =>
          typeof name === 'string' &&
          SIGIL_NAMES.includes(name) &&
          canEquipWeaponSigil(normalized, setIndex, slotIndex, name)
      )!;
    }
  }

  return normalized;
}

/** Returns the validated sigil pair for a one-based weapon set. */
export function weaponSigilsForSet(build: Gw2Build, setNumber = 1): string[] {
  const setIndex = setNumber - 1;
  return [0, 1].map((slotIndex) => {
    const selected = build?.weaponSigils?.[setIndex]?.[slotIndex];
    return typeof selected === 'string' && SIGIL_NAMES.includes(selected)
      ? selected
      : DEFAULT_WEAPON_SIGILS[setIndex]?.[slotIndex] || 'Force';
  });
}

/** Updates one sigil slot while enforcing valid positions and duplicate rules. */
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
  // Reject conflicting programmatic selections too, preserving the existing same-set slot swap.
  if (!canEquipWeaponSigil(normalized, setIndex, slotIndex, name)) return;
  sigils[slotIndex] = name;
}

interface MutableSigilSet {
  [field: string]: unknown;
  names: string[];
  criticalChanceBonus: number;
  strikeAdd: number;
  strike: number;
  strikeMultiplier: number;
  nightStrikeMultiplier: number;
  conditionAdd: number;
  condition: number;
  conditionDurationBonus: number;
  conditionDurationBonuses: Record<string, number>;
  boonDurationBonus: number;
}

/** Combines selected sigil effects into one runtime modifier set. */
export function aggregateSigilSet(sigilNames: readonly string[] | null | undefined): Gw2SigilSet {
  const effects: MutableSigilSet = {
    names: [...new Set(sigilNames || [])],
    criticalChanceBonus: 0,
    strikeAdd: 0,
    strike: 1,
    strikeMultiplier: 1,
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
    // Keep multiplicative bonuses outside the additive bucket used by profession modifiers.
    effects.strikeMultiplier *= 1 + Number(sigil.strikeDamageM || 0) / 100;
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
