import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { activeInstrumentCount } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-queries.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Flute's intrinsic endurance contribution retains its playing-window gate without current trait selection. */
export function symphonicResonanceEndurance(context: MesmerRuntime, flutePlaying: boolean): number {
  return flutePlaying
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.SYMPHONIC_RESONANCE),
        'enduranceRegenerationMultiplier'
      ) - 1
    : 0;
}

/** Fortissimo scales the original attributes once per currently playing instrument. */
export function applyTroubadourAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const instrumentCount = hasTrait(context, TRAIT.FORTISSIMO) ? activeInstrumentCount(context) : 0;
  const fortissimo = instrumentCount
    ? 1 +
      instrumentCount *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FORTISSIMO), 'attributeConversion')
    : 1;
  if (fortissimo === 1) return attributes;
  return {
    ...attributes,
    power: (attributes.power || 0) * fortissimo,
    precision: (attributes.precision || 0) * fortissimo,
    toughness: (attributes.toughness || 0) * fortissimo,
    vitality: (attributes.vitality || 0) * fortissimo,
    ferocity: (attributes.ferocity || 0) * fortissimo,
    conditionDamage: (attributes.conditionDamage || 0) * fortissimo,
    expertise: (attributes.expertise || 0) * fortissimo,
    concentration: (attributes.concentration || 0) * fortissimo,
    healingPower: (attributes.healingPower || 0) * fortissimo
  };
}
