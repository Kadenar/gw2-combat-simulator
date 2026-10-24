import { ENCOUNTER_HEALTH } from '#gw2/app/boss-scenarios/health-data.js';

/** The selectable roster contains display identity; phase plans and EI evidence own encounter behavior. */
export interface EncounterTemplate {
  id: string;
  name: string;
  group: string;
}

const groups: readonly [string, readonly [string, string][]][] = [
  [
    'Wing 1 · Spirit Vale',
    [
      ['020101', 'Vale Guardian'],
      ['020102', 'Gorseval'],
      ['020103', 'Sabetha']
    ]
  ],
  [
    'Wing 2 · Salvation Pass',
    [
      ['020201', 'Slothasor'],
      ['020203', 'Matthias Gabrel']
    ]
  ],
  [
    'Wing 3 · Stronghold of the Faithful',
    [
      ['020302', 'Keep Construct'],
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
      ['020506', 'Dhuum']
    ]
  ],
  [
    'Wing 6 · Mythwright Gambit',
    [
      ['020601', 'Conjured Amalgamate'],
      ['020602', 'Twin Largos'],
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
      ['040203', 'Voice and Claw of the Fallen'],
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
      ['040304', 'Harvest Temple'],
      ['040305', "Old Lion's Court"]
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

// Only encounters in the supported authoring roster are selectable; health availability is checked separately.
export const ENCOUNTER_TEMPLATES: readonly EncounterTemplate[] = groups.flatMap(([group, encounters]) =>
  encounters.map(([id, name]) => ({
    id,
    name,
    group
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
