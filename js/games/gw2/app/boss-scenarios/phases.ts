export type EncounterDifficulty = 'normal' | 'challenge' | 'legendary';

export interface EncounterPhaseDefinition {
  id: string;
  kind: 'boss' | 'split';
  label: string;
  endHealthPercent: number | null;
}

export interface EncounterPhasePlan {
  phases: readonly EncounterPhaseDefinition[];
  source: string;
  /** Mechanic cycles repeat until the encounter ends; they are not invented health gates. */
  repeats: boolean;
}

const wiki = (name: string) => `https://wiki.guildwars2.com/wiki/${name}`;
const eiRoot =
  'https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/120c88a2612dee1d7efb0b3c030c8c14affa9c05/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/LogLogic/Raids/';
const ei = (path: string) => `${eiRoot}${path}.cs`;

/** Boss rules own phase order and thresholds; scenario documents contain only DPS and split durations. */
function healthPlan(
  thresholds: readonly number[],
  source: string,
  splits: Readonly<Record<number, string>>
): EncounterPhasePlan {
  const phases: EncounterPhaseDefinition[] = [];
  for (const [index, end] of [...thresholds, 0].entries()) {
    const start = index === 0 ? 100 : thresholds[index - 1]!;
    phases.push({ id: `boss-${index}`, kind: 'boss', label: `${start}% – ${end}%`, endHealthPercent: end });

    // Explicit names bind each downtime interval to its boss mechanic instead of a generic health label.
    if (splits[end]) phases.push({ id: `split-${index}`, kind: 'split', label: splits[end], endHealthPercent: null });
  }

  return { phases, source, repeats: false };
}

/** Event-driven encounters keep named stages rather than pretending every transition is a health percentage. */
function mechanicPlan(
  stages: readonly (readonly ['boss' | 'split', string])[],
  source: string,
  repeats = false
): EncounterPhasePlan {
  return {
    phases: stages.map(([kind, label], index) => ({ id: `${kind}-${index}`, kind, label, endHealthPercent: null })),
    source,
    repeats
  };
}

const plans: Readonly<Record<string, EncounterPhasePlan>> = {
  '020101': healthPlan([66, 33], wiki('Spirit_Vale'), {
    '66': 'Red, Green and Blue Guardians',
    '33': 'Red, Green and Blue Guardians'
  }),
  '020102': healthPlan([66, 33], wiki('Gorseval'), { '66': 'Charged Souls', '33': 'Charged Souls' }),
  '020103': healthPlan([75, 50, 25], wiki('Spirit_Vale'), { '75': 'Kernan', '50': 'Knuckles', '25': 'Karde' }),
  '020201': healthPlan([80, 60, 40, 20, 10], wiki('Slothasor'), {
    '80': 'Narcolepsy',
    '60': 'Narcolepsy',
    '40': 'Narcolepsy',
    '20': 'Narcolepsy',
    '10': 'Narcolepsy'
  }),
  '020203': healthPlan([80, 60, 40], wiki('Salvation_Pass'), { '40': 'Abomination transformation' }),
  '020302': healthPlan([66, 33], wiki('Stronghold_of_the_Faithful'), { '66': 'Magic Blast', '33': 'Magic Blast' }),
  '020304': healthPlan([50], ei('RaidWings/W3/Bosses/Xera'), { '50': 'Floating platforms' }),
  '020401': healthPlan([75, 50, 25], ei('RaidWings/W4/Bosses/Cairn'), {}),
  '020402': healthPlan([], ei('RaidWings/W4/Bosses/MursaatOverseer'), {}),
  '020403': healthPlan([66, 33], wiki('Samarog'), { '66': 'Rigom and Guldhem', '33': 'Rigom and Guldhem' }),
  '020404': healthPlan([10], ei('RaidWings/W4/Bosses/Deimos'), { '10': 'Demonic realm' }),
  '020501': healthPlan([], ei('RaidWings/W5/Bosses/SoullessHorror'), {}),
  '020506': {
    ...healthPlan([10], ei('RaidWings/W5/Bosses/Dhuum'), { '10': 'Ritual' }),
    phases: [
      { id: 'opening', kind: 'split', label: 'Reapers and souls', endHealthPercent: null },
      ...healthPlan([10], ei('RaidWings/W5/Bosses/Dhuum'), { '10': 'Ritual' }).phases
    ]
  },
  '020601': mechanicPlan(
    [
      ['split', 'Arms'],
      ['boss', 'Burn phase']
    ],
    ei('RaidWings/W6/Bosses/ConjuredAmalgamate'),
    true
  ),
  '020602': healthPlan([75, 50], wiki('Mythwright_Gambit'), {
    '75': 'Platform transition',
    '50': 'Platform transition'
  }),
  '020603': {
    ...healthPlan([66, 33], wiki('Mythwright_Gambit'), {
      '66': 'Apocalypse Bringer and pyres',
      '33': 'Wyverns and pyres'
    }),
    phases: [
      { id: 'opening', kind: 'split', label: 'Hydra and pyres', endHealthPercent: null },
      ...healthPlan([66, 33], wiki('Mythwright_Gambit'), {
        '66': 'Apocalypse Bringer and pyres',
        '33': 'Wyverns and pyres'
      }).phases
    ]
  },
  '020701': healthPlan([75, 50, 25], wiki('The_Key_of_Ahdashim'), {
    '75': 'Hands of Erosion',
    '50': 'Hands of Erosion and Eruption',
    '25': 'Hands of Erosion and Eruption'
  }),
  '020702': healthPlan([80, 60], wiki('Cardinal_Sabir'), { '80': 'Wisps and platforms', '60': 'Wisps and platforms' }),
  '020703': healthPlan([80, 60, 40, 30, 20], ei('RaidWings/W7/Bosses/QadimThePeerless'), {
    '80': 'Pylon intermission',
    '60': 'Pylon intermission',
    '40': 'Pylon destruction',
    '30': 'Pylon destruction',
    '20': 'Pylon destruction'
  }),
  '020801': healthPlan([65, 35], ei('RaidWings/W8/Bosses/GreerTheBlightbringer'), {
    '65': 'Gree and Reeg',
    '35': 'Gree and Reeg'
  }),
  '020802': healthPlan([75, 40], wiki('Mount_Balrior'), { '75': 'Flux Nova', '40': 'Flux Nova' }),
  '020803': healthPlan([70, 40], ei('RaidWings/W8/Bosses/UraTheSteamshrieker'), {}),
  '040201': mechanicPlan(
    [
      ['boss', 'Icebrood Construct'],
      ['split', 'Invulnerability']
    ],
    ei('RaidEncounters/IcebroodSaga/Grothmar/Bosses/IcebroodConstruct'),
    true
  ),
  '040202': mechanicPlan(
    [
      ['boss', 'Fraenir 100% – 75%'],
      ['split', 'Transformation'],
      ['boss', 'Construct intact'],
      ['split', 'Construct invulnerability'],
      ['boss', 'Damaged construct'],
      ['split', 'Transformation'],
      ['boss', 'Fraenir 25% – 0%']
    ],
    ei('RaidEncounters/IcebroodSaga/Bjora/Bosses/FraenirOfJormag')
  ),
  '040203': mechanicPlan(
    [
      ['boss', 'Voice and Claw'],
      ['split', 'Merged phase']
    ],
    ei('RaidEncounters/IcebroodSaga/Bjora/Bosses/SuperKodanBrothers'),
    true
  ),
  '040204': healthPlan([], ei('RaidEncounters/IcebroodSaga/Bjora/Bosses/Boneskinner'), {}),
  '040205': healthPlan([75, 25], ei('RaidEncounters/IcebroodSaga/Bjora/Bosses/WhisperOfJormag'), {
    '75': 'Doppelgangers',
    '25': 'Doppelgangers'
  }),
  '040301': mechanicPlan(
    [
      ['boss', 'Mai Trin phase 1'],
      ['split', 'Mai Trin untargetable'],
      ['boss', 'Mai Trin phase 2'],
      ['split', 'Scarlet phantoms'],
      ['boss', 'Mai Trin phase 3'],
      ['split', 'Echo transformation'],
      ['boss', 'Echo phase 1'],
      ['split', 'Scarlet phantoms'],
      ['boss', 'Echo phase 2'],
      ['split', 'Scarlet phantoms'],
      ['boss', 'Echo phase 3']
    ],
    ei('RaidEncounters/EndOfDragons/Bosses/AetherbladeHideout')
  ),
  '040302': healthPlan([75, 40], ei('RaidEncounters/EndOfDragons/Bosses/XunlaiJadeJunkyard'), {
    '75': 'Relocation and Necrotic Ritual',
    '40': 'Relocation and Necrotic Ritual'
  }),
  '040303': healthPlan([66, 33], ei('RaidEncounters/EndOfDragons/Bosses/KainengOverlook'), {
    '66': 'Enforcer, Mindblade and Ritualist',
    '33': 'Mech Rider and Sniper'
  }),
  '040304': mechanicPlan(
    [
      ['split', 'Purification 1'],
      ['boss', 'Jormag'],
      ['split', 'Dragon transition'],
      ['boss', 'Primordus'],
      ['split', 'Dragon transition'],
      ['boss', 'Kralkatorrik'],
      ['split', 'Purification 2'],
      ['boss', 'Mordremoth'],
      ['split', 'Giants'],
      ['boss', 'Zhaitan'],
      ['split', 'Purification 3'],
      ['boss', 'Soo-Won 1'],
      ['split', 'Purification 4'],
      ['boss', 'Soo-Won 2']
    ],
    ei('RaidEncounters/EndOfDragons/Bosses/HarvestTemple')
  ),
  '040305': healthPlan([80, 40, 10], ei('RaidEncounters/EndOfDragons/Bosses/OldLionsCourt'), {
    '80': 'Watchknight Triumvirate',
    '40': 'Watchknight Triumvirate',
    '10': 'Watchknight Triumvirate'
  }),
  '040501': healthPlan([75, 50, 25], ei('RaidEncounters/SotO/Bosses/CosmicObservatory'), {
    '75': 'Tormented',
    '50': 'Tormented',
    '25': 'Tormented'
  }),
  '040502': healthPlan([80, 50, 10], ei('RaidEncounters/SotO/Bosses/TempleOfFebe'), {
    '80': 'Embodiments',
    '50': 'Embodiments'
  }),
  '040601': mechanicPlan(
    [
      ['boss', 'Kela'],
      ['split', 'Storm phase']
    ],
    ei('RaidEncounters/VisionsOfEternity/Bosses/GuardiansGlade'),
    true
  ),
  '040602': healthPlan([70, 40, 10], ei('RaidEncounters/VisionsOfEternity/Bosses/NexusOfEternity'), {
    '70': 'Weapon change',
    '40': 'Weapon change',
    '10': 'Final transition'
  })
};

/** Difficulty changes select the authored mechanics for that mode, independently of EI health totals. */
export function encounterPhasePlan(id: string, difficulty: EncounterDifficulty): EncounterPhasePlan {
  const base = plans[id];

  if (!base) throw new Error('No encounter phase definition.');

  if (difficulty !== 'normal') {
    if (id === '040305')
      return healthPlan([60, 20], base.source, { 60: 'Watchknight Triumvirate', 20: 'Watchknight Triumvirate' });

    if (id === '020801')
      return healthPlan([65, 35, 10], base.source, {
        65: 'Gree, Reeg and Ereg',
        35: 'Gree, Reeg and Ereg',
        10: 'Proto-Greerlings'
      });

    if (id === '020802')
      return healthPlan([75, 40, 10], base.source, { 75: 'Flux Nova', 40: 'Flux Nova', 10: 'Final transition' });

    if (id === '020803') return healthPlan([70, 40, 1], base.source, { 1: 'Armor shatter' });
  }

  return base;
}
