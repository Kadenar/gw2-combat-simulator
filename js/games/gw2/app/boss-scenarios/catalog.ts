import { ENCOUNTER_HEALTH } from '#gw2/app/boss-scenarios/health-data.js';

/** The roster and report observations are separate so events are never assigned invented boss health. */
export interface EncounterTemplate {
  id: string;
  name: string;
  group: string;
  source: string;
  kind: 'boss' | 'multiple' | 'event';
}

export const ENCOUNTER_ROSTER_SOURCE =
  'https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/235aa084f2450f6aae8022b06ee9b5380e421589/LogIDs.md';

const groups: readonly [string, readonly [string, string, EncounterTemplate['kind']?][]][] = [
  [
    'Wing 1 · Spirit Vale',
    [
      ['020101', 'Vale Guardian'],
      ['020102', 'Gorseval'],
      ['020103', 'Sabetha'],
      ['020104', 'Spirit Race', 'event']
    ]
  ],
  [
    'Wing 2 · Salvation Pass',
    [
      ['020201', 'Slothasor'],
      ['020202', 'Bandit Trio', 'multiple'],
      ['020203', 'Matthias Gabrel']
    ]
  ],
  [
    'Wing 3 · Stronghold of the Faithful',
    [
      ['020301', 'Escort', 'event'],
      ['020302', 'Keep Construct'],
      ['020303', 'Twisted Castle', 'event'],
      ['020304', 'Xera']
    ]
  ],
  [
    'Wing 4 · Bastion of the Penitent',
    [
      ['020401', 'Cairn'],
      ['020402', 'Mursaat Overseer'],
      ['020403', 'Samarog'],
      ['020404', 'Deimos']
    ]
  ],
  [
    'Wing 5 · Hall of Chains',
    [
      ['020501', 'Soulless Horror'],
      ['020502', 'River of Souls', 'event'],
      ['020503', 'Broken King'],
      ['020504', 'Eater of Souls'],
      ['020505', 'Eyes of Fate and Judgment', 'multiple'],
      ['020506', 'Dhuum']
    ]
  ],
  [
    'Wing 6 · Mythwright Gambit',
    [
      ['020601', 'Conjured Amalgamate'],
      ['020602', 'Twin Largos', 'multiple'],
      ['020603', 'Qadim']
    ]
  ],
  [
    'Wing 7 · The Key of Ahdashim',
    [
      ['020701', 'Cardinal Adina'],
      ['020702', 'Cardinal Sabir'],
      ['020703', 'Qadim the Peerless']
    ]
  ],
  [
    'Wing 8 · Mount Balrior',
    [
      ['020801', 'Greer, the Blightbringer'],
      ['020802', 'Decima, the Stormsinger'],
      ['020803', 'Ura, the Steamshrieker']
    ]
  ],
  [
    'The Icebrood Saga',
    [
      ['040201', 'Icebrood Construct'],
      ['040202', 'Fraenir of Jormag'],
      ['040203', 'Voice and Claw of the Fallen', 'multiple'],
      ['040204', 'Boneskinner'],
      ['040205', 'Whisper of Jormag']
    ]
  ],
  [
    'End of Dragons',
    [
      ['040301', 'Aetherblade Hideout'],
      ['040302', 'Xunlai Jade Junkyard'],
      ['040303', 'Kaineng Overlook'],
      ['040304', 'Harvest Temple', 'multiple'],
      ['040305', "Old Lion's Court", 'multiple']
    ]
  ],
  [
    'Secrets of the Obscure',
    [
      ['040501', 'Cosmic Observatory'],
      ['040502', 'Temple of Febe']
    ]
  ],
  [
    'Visions of Eternity',
    [
      ['040601', "Guardian's Glade"],
      ['040602', 'Nexus of Eternity']
    ]
  ]
];

// Roster completeness is independent of data completeness; events and multiple-target encounters stay selectable.
export const ENCOUNTER_TEMPLATES: readonly EncounterTemplate[] = groups.flatMap(([group, encounters]) =>
  encounters.map(([id, name, kind = 'boss']) => ({
    id,
    name,
    group,
    kind,
    source: ENCOUNTER_ROSTER_SOURCE
  }))
);

/** Select only evidence for the chosen encounter and mode; NM health is never reused as CM health. */
export function encounterHealth(encounterId: string, difficulty: 'normal' | 'challenge' | 'legendary') {
  return ENCOUNTER_HEALTH.find((entry) => entry.encounterId === encounterId && entry.difficulty === difficulty);
}

/** Offer recorded modes only; event entries still have a normal-mode authoring document without invented health. */
export function encounterDifficulties(encounterId: string): ('normal' | 'challenge' | 'legendary')[] {
  return (['normal', 'challenge', 'legendary'] as const).filter(
    (mode) => mode === 'normal' || encounterHealth(encounterId, mode)
  );
}
