import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { normalizeSkillEffects } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import {
  HARMONIOUS_HARP_DISTORTION,
  MESMER_TROUBADOUR_INSTRUMENTS,
  TROUBADOUR_TALE_PROFILES
} from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';

import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';

export const TROUBADOUR_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.troubadour.resources',
  instruments: 'mesmer.troubadour.instruments',
  crescendo: 'mesmer.troubadour.crescendo',
  livelyLute: 'mesmer.troubadour.lively-lute',
  livelyLuteAlternate: 'mesmer.troubadour.lively-lute-alternate',
  flusteringFlute: 'mesmer.troubadour.flustering-flute',
  harmoniousHarp: 'mesmer.troubadour.harmonious-harp',
  harmoniousHarpAlternate: 'mesmer.troubadour.harmonious-harp-alternate',
  deafeningDrum: 'mesmer.troubadour.deafening-drum',
  torturedMastermind: 'mesmer.troubadour.tale-tortured-mastermind',
  honorableRogue: 'mesmer.troubadour.tale-honorable-rogue',
  soulkeeper: 'mesmer.troubadour.tale-soulkeeper',
  valiantMarshal: 'mesmer.troubadour.tale-valiant-marshal'
});

export const TROUBADOUR_INSTRUMENT_PROFILE_IDS: Readonly<Record<number, string>> = Object.freeze({
  [ID.LIVELY_LUTE]: TROUBADOUR_BALANCE_PROFILE_IDS.livelyLute,
  [ID.LIVELY_LUTE_ALTERNATE]: TROUBADOUR_BALANCE_PROFILE_IDS.livelyLuteAlternate,
  [ID.FLUSTERING_FLUTE]: TROUBADOUR_BALANCE_PROFILE_IDS.flusteringFlute,
  [ID.HARMONIOUS_HARP]: TROUBADOUR_BALANCE_PROFILE_IDS.harmoniousHarp,
  [ID.HARMONIOUS_HARP_ALTERNATE]: TROUBADOUR_BALANCE_PROFILE_IDS.harmoniousHarpAlternate,
  [ID.DEAFENING_DRUM]: TROUBADOUR_BALANCE_PROFILE_IDS.deafeningDrum
});

/** Builds the patchable balance profile for one Troubadour instrument. */
function mesmerInstrumentProfile(
  id: string,
  parentId: SkillId,
  name: string,
  instrument: MesmerInstrument
): BalanceProfile {
  return variant(id, parentId, `${name} - Instrument`, {
    effects: [
      ...(instrument.ticks?.length
        ? [
            {
              name: 'Strike',
              type: 'strike' as const,
              ticks: instrument.ticks,
              timingAnchor: 'castEnd' as const,
              timingScale: 'fixed' as const
            }
          ]
        : Number(instrument.hits) > 0
          ? [{ name: 'Strike', type: 'strike' as const, coefficient: instrument.coefficient, hits: instrument.hits }]
          : []),
      ...(instrument.conditions || []).map((status) => ({
        name: status.name,
        type: 'condition' as const,
        condition: status.name,
        duration: status.duration,
        stacks: status.stacks,
        ...(status.applications == null ? {} : { applications: status.applications })
      }))
    ]
  });
}

/** Applies the active Troubadour instrument profile to its runtime definition. */
export function mesmerProfiledInstrument(
  context: unknown,
  instrument: MesmerInstrument,
  balanceProfileId: string
): MesmerInstrument {
  const profile = requireBalanceProfileFromContext(context, balanceProfileId);
  const strike =
    instrument.ticks?.length || Number(instrument.hits) > 0 ? requireEffect(profile, 'strike', 'Strike') : undefined;
  const conditions = normalizeSkillEffects(
    profile.effects || [],
    `profession=mesmer patch=${profile.balanceDataContext?.patchId ?? '<unknown>'} profile=${profile.id}`
  )
    .filter((effect) => effect.type === 'condition')
    .map((effect) => ({
      ...effect,
      summonKind: undefined,
      name: String(effect.condition ?? effect.name)
    }));
  return {
    slot: instrument.slot,
    instrument: instrument.instrument,
    damageAtMs: instrument.damageAtMs,
    persistsAfterInterrupt: instrument.persistsAfterInterrupt,
    balanceProfileId,
    ...strike,
    conditions
  };
}

export const TROUBADOUR_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: TROUBADOUR_BALANCE_PROFILE_IDS.resources,
    name: 'Troubadour Notes',
    profileKind: 'mechanic',
    maximumStacks: 3,
    effects: []
  },
  {
    id: TROUBADOUR_BALANCE_PROFILE_IDS.instruments,
    name: 'Troubadour Instrument Duration',
    profileKind: 'mechanic',
    durationMultiplier: 5,
    durationPerTier: 5,
    effects: [HARMONIOUS_HARP_DISTORTION]
  },
  ...Object.entries(MESMER_TROUBADOUR_INSTRUMENTS).map(([skillId, instrument]) =>
    mesmerInstrumentProfile(
      TROUBADOUR_INSTRUMENT_PROFILE_IDS[Number(skillId)],
      Number(skillId),
      {
        [ID.LIVELY_LUTE]: 'Lively Lute',
        [ID.LIVELY_LUTE_ALTERNATE]: 'Lively Lute (Alternate)',
        [ID.FLUSTERING_FLUTE]: 'Flustering Flute',
        [ID.HARMONIOUS_HARP]: 'Harmonious Harp',
        [ID.HARMONIOUS_HARP_ALTERNATE]: 'Harmonious Harp (Alternate)',
        [ID.DEAFENING_DRUM]: 'Deafening Drum'
      }[Number(skillId)] || `Instrument ${skillId}`,
      instrument
    )
  ),
  ...TROUBADOUR_TALE_PROFILES,
  {
    id: TROUBADOUR_BALANCE_PROFILE_IDS.crescendo,
    parentId: ID.CRESCENDO,
    name: 'Crescendo',
    profileKind: 'skill-variant',
    damageIncreasePerStack: 0.25,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 2.25, hits: 1 }]
  }
]);
