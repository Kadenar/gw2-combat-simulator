import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '#gw2/integrations/patches/authoring/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import { mesmerTraitDamageProfile } from '#gw2/content/professions/mesmer/core/profiles.js';
import {
  MESMER_TROUBADOUR_INSTRUMENTS,
  MESMER_TROUBADOUR_TRAIT_DAMAGE
} from '#gw2/content/professions/mesmer/specializations/troubadour/mechanics/definitions.js';
import type { MesmerInstrument } from '#gw2/content/professions/mesmer/types.js';

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
  honorableRogue: 'mesmer.troubadour.tale-honorable-rogue',
  soulkeeper: 'mesmer.troubadour.tale-soulkeeper',
  valiantMarshal: 'mesmer.troubadour.tale-valiant-marshal',
  harmonize: TRAIT.HARMONIZE,
  mayhem: TRAIT.MAYHEM,
  raconteur: TRAIT.RACONTEUR,
  syncopate: TRAIT.SYNCOPATE,
  shredding: TRAIT.SHREDDING,
  lifeOfTheParty: TRAIT.LIFE_OF_THE_PARTY,
  fortissimo: TRAIT.FORTISSIMO,
  callAndResponse: TRAIT.CALL_AND_RESPONSE,
  alteredChord: TRAIT.ALTERED_CHORD
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
export function mesmerInstrumentProfile(
  id: string,
  parentId: SkillId,
  name: string,
  instrument: MesmerInstrument
): BalanceProfile {
  return variant(id, parentId, `${name} - Instrument`, {
    effects: [
      ...(instrument.hits > 0
        ? [
            {
              type: 'strike' as const,
              coefficient: instrument.coefficient,
              hits: instrument.hits,
              ...(instrument.intervalMs == null
                ? {}
                : {
                    intervalMs: instrument.intervalMs,
                    timingAnchor: 'castEnd' as const,
                    timingScale: 'fixed' as const
                  })
            }
          ]
        : []),
      ...(instrument.conditions || []).map((status) => ({
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
  const profile = balanceProfileFromContext(context, balanceProfileId);
  const strike = balanceProfileEffect(profile, 'strike');
  const conditions = (profile?.effects || [])
    .filter((effect) => effect.type === 'condition')
    .map((effect) => ({
      name: String(effect.condition || ''),
      duration: Number(effect.duration || 0),
      stacks: Number(effect.stacks || 1),
      ...(effect.applications == null ? {} : { applications: Number(effect.applications) })
    }));
  return {
    ...instrument,
    balanceProfileId,
    coefficient: Number(strike?.coefficient ?? instrument.coefficient),
    hits: Number(strike?.hits ?? instrument.hits),
    intervalMs: Number(strike?.intervalMs ?? (instrument.intervalMs || 0)),
    conditions: profile ? conditions : instrument.conditions
  };
}

const tale = (
  id: string,
  parentId: number,
  name: string,
  effects: BalanceProfile['effects'],
  resourceGain = 1
): BalanceProfile => ({
  id,
  parentId,
  name,
  profileKind: 'skill-variant',
  resourceGain,
  effects
});

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
    damageIncrease: 0.1,
    effects: [{ type: 'buff', kind: 'distortion', duration: 2, stacks: 1 }]
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
  tale(TROUBADOUR_BALANCE_PROFILE_IDS.honorableRogue, ID.TALE_OF_THE_HONORABLE_ROGUE, 'Tale of the Honorable Rogue', [
    { type: 'boon', boon: 'aegis', duration: 4, stacks: 1 }
  ]),
  tale(
    TROUBADOUR_BALANCE_PROFILE_IDS.soulkeeper,
    ID.TALE_OF_THE_SOULKEEPER,
    'Tale of the Soulkeeper',
    [
      { type: 'boon', boon: 'might', duration: 15, stacks: 10 },
      { type: 'boon', boon: 'fury', duration: 10, stacks: 1 },
      { type: 'boon', boon: 'quickness', duration: 4, stacks: 1 }
    ],
    2
  ),
  tale(TROUBADOUR_BALANCE_PROFILE_IDS.valiantMarshal, ID.TALE_OF_THE_VALIANT_MARSHAL, 'Tale of the Valiant Marshal', [
    { type: 'boon', boon: 'stability', duration: 4, stacks: 5 },
    { type: 'boon', boon: 'resistance', duration: 3, stacks: 1 }
  ]),
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.harmonize, 'Harmonize', {
    resourceGain: 1
  }),
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.mayhem, 'Mayhem', {
    rechargeReduction: 1.5,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        duration: 5,
        stacks: 4
      }
    ]
  }),
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.raconteur, 'Raconteur', {
    effects: [{ type: 'boon', boon: 'protection', duration: 3, stacks: 1 }]
  }),
  {
    ...mesmerTraitDamageProfile(
      TROUBADOUR_BALANCE_PROFILE_IDS.syncopate,
      'Syncopate',
      MESMER_TROUBADOUR_TRAIT_DAMAGE.Syncopate
    ),
    initialDelay: 3,
    effects: [
      {
        type: 'strike',
        name: 'Immediate wave',
        coefficient: MESMER_TROUBADOUR_TRAIT_DAMAGE.Syncopate.coefficient,
        hits: MESMER_TROUBADOUR_TRAIT_DAMAGE.Syncopate.hits
      },
      {
        type: 'strike',
        name: 'Delayed wave',
        coefficient: MESMER_TROUBADOUR_TRAIT_DAMAGE.SyncopateDelayedWave.coefficient,
        hits: MESMER_TROUBADOUR_TRAIT_DAMAGE.SyncopateDelayedWave.hits
      }
    ]
  },
  {
    id: TROUBADOUR_BALANCE_PROFILE_IDS.crescendo,
    parentId: ID.CRESCENDO,
    name: 'Crescendo',
    profileKind: 'skill-variant',
    damageIncreasePerStack: 0.25,
    effects: [{ type: 'strike', coefficient: 2.25, hits: 1 }]
  },
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.shredding, 'Shredding', {
    damageIncrease: 0.15,
    effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
  }),
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.lifeOfTheParty, 'Life of the Party', {
    effects: [
      {
        type: 'boon',
        name: 'Lute Quickness',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Lute Might',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        name: 'Crescendo Quickness',
        boon: 'quickness',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Crescendo Might',
        boon: 'might',
        duration: 15,
        stacks: 8
      },
      {
        type: 'boon',
        name: 'Crescendo Fury',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  }),
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.fortissimo, 'Fortissimo', {
    attributeConversion: 0.04,
    maximumStacks: 5,
    pulseInterval: 1,
    resourceGain: 1
  }),
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.callAndResponse, 'Call and Response', {
    threshold: 3,
    initialDelay: 1.5
  }),
  trait(TROUBADOUR_BALANCE_PROFILE_IDS.alteredChord, 'Altered Chord', {
    rechargeReduction: 2,
    durationMultiplier: 10,
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        duration: 8,
        stacks: 5
      }
    ]
  })
]);
