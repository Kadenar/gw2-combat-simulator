export type EncounterDifficulty = 'normal' | 'challenge' | 'legendary';

export interface EncounterPhaseDefinition {
  id: string;
  kind: 'boss' | 'split';
  label: string;
  endHealthPercent: number | null;
  targetIndexes?: readonly number[];
  startHealthPercent?: number;
  entryHealthLossPercent?: number;
  /** Fixed no-HP-damage checkpoints within a platform; authoring retains one group-DPS input for that platform. */
  barrierHealthPercents?: readonly number[];
  /** Expanded execution segments retain the authored platform number in reports and timeline markers. */
  phaseNumber?: number;
  /** Presentation bounds for health windows; these do not reset the live target health. */
  healthRange?: readonly [number, number];
  /** Authored time until a mechanic ends this damage window, independent of target health. */
  damageWindow?: { label: string; defaultSeconds: number };
}

export interface EncounterExecutionPhaseDefinition extends Omit<EncounterPhaseDefinition, 'kind'> {
  kind: 'boss' | 'split' | 'intermission';
  durationSeconds?: number;
}

/** CM barriers use five-second intermissions so both target damage and rotation commands wait for the checkpoint. */
export function encounterExecutionPhases(
  definitions: readonly EncounterPhaseDefinition[]
): EncounterExecutionPhaseDefinition[] {
  let phaseNumber = 0;
  return definitions.flatMap((definition) => {
    if (definition.kind !== 'boss') return [definition];

    phaseNumber++;

    if (!definition.barrierHealthPercents?.length) return [definition];

    const segments: EncounterExecutionPhaseDefinition[] = [];
    let start = definition.healthRange![0];
    for (const threshold of definition.barrierHealthPercents) {
      segments.push(
        {
          ...definition,
          id: `${definition.id}-to-${threshold}`,
          label: `${start}–${threshold}%`,
          healthRange: [start, threshold],
          endHealthPercent: threshold,
          phaseNumber
        },
        {
          id: `${definition.id}-barrier-${threshold}`,
          kind: 'intermission',
          label: `Barrier at ${threshold}%`,
          endHealthPercent: null,
          durationSeconds: 5
        }
      );
      start = threshold;
    }

    segments.push({
      ...definition,
      phaseNumber,
      label: `${start}–${definition.endHealthPercent}%`,
      healthRange: [start, definition.endHealthPercent!]
    });
    return segments;
  });
}

export interface EncounterPhasePlan {
  phases: readonly EncounterPhaseDefinition[];
  /** Mechanic cycles repeat until the encounter ends; they are not invented health gates. */
  repeats: boolean;
}

/** Boss rules own phase order and thresholds; scenario documents contain only DPS and split durations. */
function healthPlan(thresholds: readonly number[], splits: Readonly<Record<number, string>>): EncounterPhasePlan {
  const phases: EncounterPhaseDefinition[] = [];
  for (const [index, end] of [...thresholds, 0].entries()) {
    const start = index === 0 ? 100 : thresholds[index - 1]!;
    phases.push({ id: `boss-${index}`, kind: 'boss', label: `${start}% – ${end}%`, endHealthPercent: end });

    // Explicit names bind each downtime interval to its boss mechanic instead of a generic health label.
    if (splits[end]) phases.push({ id: `split-${index}`, kind: 'split', label: splits[end], endHealthPercent: null });
  }

  return { phases, repeats: false };
}

/** Event-driven encounters keep named stages rather than pretending every transition is a health percentage. */
function mechanicPlan(stages: readonly (readonly ['boss' | 'split', string])[], repeats = false): EncounterPhasePlan {
  return {
    phases: stages.map(([kind, label], index) => ({ id: `${kind}-${index}`, kind, label, endHealthPercent: null })),
    repeats
  };
}

const plans: Readonly<Record<string, EncounterPhasePlan>> = {
  '020101': healthPlan([66, 33], {
    '66': 'Red, Green and Blue Guardians',
    '33': 'Red, Green and Blue Guardians'
  }),
  '020102': healthPlan([66, 33], { '66': 'Charged Souls', '33': 'Charged Souls' }),
  '020103': healthPlan([75, 50, 25], { '75': 'Kernan', '50': 'Knuckles', '25': 'Karde' }),
  '020201': healthPlan([80, 60, 40, 20, 10], {
    '80': 'Narcolepsy',
    '60': 'Narcolepsy',
    '40': 'Narcolepsy',
    '20': 'Narcolepsy',
    '10': 'Narcolepsy'
  }),
  '020203': healthPlan([80, 60, 40], { '40': 'Abomination transformation' }),
  '020302': healthPlan([66, 33], { '66': 'Magic Blast', '33': 'Magic Blast' }),
  '020304': healthPlan([50], { '50': 'Floating platforms' }),
  '020401': healthPlan([75, 50, 25], {}),
  '020402': healthPlan([], {}),
  '020403': healthPlan([66, 33], { '66': 'Rigom and Guldhem', '33': 'Rigom and Guldhem' }),
  '020404': healthPlan([10], { '10': 'Demonic realm' }),
  '020501': healthPlan([], {}),
  '020506': {
    ...healthPlan([10], { '10': 'Ritual' }),
    phases: [
      { id: 'opening', kind: 'split', label: 'Reapers and souls', endHealthPercent: null },
      ...healthPlan([10], { '10': 'Ritual' }).phases
    ]
  },
  '020601': {
    repeats: false,
    phases: [
      { id: 'arms-0', kind: 'split', label: 'First arm', endHealthPercent: null },
      {
        id: 'burn-0',
        kind: 'boss',
        label: 'First Junk Absorption',
        endHealthPercent: 50,
        entryHealthLossPercent: 10,
        damageWindow: { label: 'Expected burn window', defaultSeconds: 40 }
      },
      { id: 'arms-1', kind: 'split', label: 'Second arm', endHealthPercent: null },
      {
        id: 'burn-1',
        kind: 'boss',
        label: 'Second Junk Absorption',
        endHealthPercent: 25,
        entryHealthLossPercent: 10,
        damageWindow: { label: 'Expected burn window', defaultSeconds: 40 }
      },
      { id: 'arms-2', kind: 'split', label: 'Regrown arms', endHealthPercent: null },
      { id: 'burn-2', kind: 'boss', label: 'Final burn', endHealthPercent: 0, entryHealthLossPercent: 10 }
    ]
  },
  // Both opening platforms are mandatory; the scenario's single choice applies only to the last two phases.
  '020602': {
    repeats: false,
    phases: [
      { id: 'nikare-opening', kind: 'boss', label: 'Nikare 100% - 50%', targetIndexes: [0], endHealthPercent: 50 },
      { id: 'kenut-travel', kind: 'split', label: 'Move to Kenut', endHealthPercent: null },
      { id: 'kenut-opening', kind: 'boss', label: 'Kenut 100% - 50%', targetIndexes: [1], endHealthPercent: 50 },
      { id: 'separate-platforms', kind: 'split', label: 'Separate platforms', endHealthPercent: null },
      { id: 'selected-platform', kind: 'boss', label: '50% - 25%', endHealthPercent: 25 },
      { id: 'final-platform', kind: 'split', label: 'Final platform', endHealthPercent: null },
      { id: 'final-burn', kind: 'boss', label: '25% - 0%', endHealthPercent: 0 }
    ]
  },
  '020603': {
    ...healthPlan([66, 33], {
      '66': 'Apocalypse Bringer and pyres',
      '33': 'Wyverns and pyres'
    }),
    phases: [
      { id: 'opening', kind: 'split', label: 'Hydra and pyres', endHealthPercent: null },
      ...healthPlan([66, 33], {
        '66': 'Apocalypse Bringer and pyres',
        '33': 'Wyverns and pyres'
      }).phases
    ]
  },
  '020701': healthPlan([75, 50, 25], {
    '75': 'Hands of Erosion',
    '50': 'Hands of Erosion and Eruption',
    '25': 'Hands of Erosion and Eruption'
  }),
  '020702': healthPlan([80, 60], { '80': 'Wisps and platforms', '60': 'Wisps and platforms' }),
  '020703': healthPlan([80, 60, 40, 30, 20], {
    '80': 'Pylon intermission',
    '60': 'Pylon intermission',
    '40': 'Pylon destruction',
    '30': 'Pylon destruction',
    '20': 'Pylon destruction'
  }),
  '020801': healthPlan([65, 35], {
    '65': 'Gree and Reeg',
    '35': 'Gree and Reeg'
  }),
  '020802': healthPlan([75, 40], { '75': 'Flux Nova', '40': 'Flux Nova' }),
  '020803': healthPlan([70, 40], {}),
  '040201': healthPlan([50], { 50: 'Arm shatter' }),
  '040202': mechanicPlan([
    ['boss', 'Fraenir 100% – 75%'],
    ['split', 'Transformation'],
    ['boss', 'Construct intact'],
    ['split', 'Construct invulnerability'],
    ['boss', 'Damaged construct'],
    ['split', 'Transformation'],
    ['boss', 'Fraenir 25% – 0%']
  ]),
  '040203': mechanicPlan(
    [
      ['boss', 'Voice and Claw'],
      ['boss', 'Deadly Synergy']
    ],
    true
  ),
  '040204': healthPlan([], {}),
  '040205': healthPlan([75, 25], {
    '75': 'Doppelgangers',
    '25': 'Doppelgangers'
  }),
  '040301': mechanicPlan([
    ['boss', 'Mai Trin phase 1'],
    ['split', 'Mai Trin untargetable'],
    ['boss', 'Mai Trin phase 2'],
    ['split', 'Scarlet phantoms'],
    ['boss', 'Mai Trin phase 3'],
    ['split', 'Echo transformation'],
    ['boss', 'Echo phase 1'],
    ['split', 'Scarlet phantoms'],
    ['boss', 'Echo phase 2'],
    ['split', 'Laser sweep'],
    ['boss', 'Echo phase 3'],
    ['split', 'Scarlet phantoms'],
    ['boss', 'Echo phase 4'],
    ['split', 'Laser sweep'],
    ['boss', 'Echo phase 5']
  ]),
  '040302': healthPlan([75, 40], {
    '75': 'Relocation and Necrotic Ritual',
    '40': 'Relocation and Necrotic Ritual'
  }),
  '040303': healthPlan([66, 33], {
    '66': 'Enforcer, Mindblade and Ritualist',
    '33': 'Mech Rider and Sniper'
  }),
  '040304': mechanicPlan([
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
  ]),
  '040305': healthPlan([80, 40, 10], {
    '80': 'Watchknight Triumvirate',
    '40': 'Watchknight Triumvirate',
    '10': 'Watchknight Triumvirate'
  }),
  '040501': healthPlan([75, 50, 25], {
    '75': 'Tormented',
    '50': 'Tormented',
    '25': 'Tormented'
  }),
  '040502': healthPlan([80, 50, 10], {
    '80': 'Embodiments',
    '50': 'Embodiments'
  }),
  '040601': mechanicPlan(
    [
      ['boss', 'Kela'],
      ['split', 'Storm phase']
    ],
    true
  ),
  '040602': healthPlan([70, 40, 10], {
    '70': 'Weapon change',
    '40': 'Weapon change',
    '10': 'Final transition'
  })
};

/** Difficulty changes select the authored mechanics for that mode, independently of EI health totals. */
export function encounterPhasePlan(id: string, difficulty: EncounterDifficulty): EncounterPhasePlan {
  let base = plans[id];

  if (!base) throw new Error('No encounter phase definition.');

  // Sequential fights select their real target; simultaneous fights retain independent health pools.
  if (id === '040202') {
    const stages = [
      { targetIndexes: [0], endHealthPercent: 75 },
      { targetIndexes: [1], endHealthPercent: 50 },
      { targetIndexes: [1], endHealthPercent: 0 },
      { targetIndexes: [0], startHealthPercent: 25, endHealthPercent: 0 }
    ];
    let stage = 0;
    base = {
      ...base,
      phases: base.phases.map((phase) => (phase.kind === 'boss' ? { ...phase, ...stages[stage++]! } : phase))
    };
  }

  if (id === '040301') {
    const stages = [
      { targetIndexes: [0], endHealthPercent: 60 },
      { targetIndexes: [0], endHealthPercent: 30 },
      { targetIndexes: [0], endHealthPercent: 10 },
      { targetIndexes: [1], endHealthPercent: 80 },
      { targetIndexes: [1], endHealthPercent: 60 },
      { targetIndexes: [1], endHealthPercent: 40 },
      { targetIndexes: [1], endHealthPercent: 20 },
      { targetIndexes: [1], endHealthPercent: 0 }
    ];
    let stage = 0;
    base = {
      ...base,
      phases: base.phases.map((phase) => (phase.kind === 'boss' ? { ...phase, ...stages[stage++]! } : phase))
    };
  }

  if (id === '040304') {
    let stage = 0;
    base = {
      ...base,
      phases: base.phases.map((phase) => {
        if (phase.kind !== 'boss') return phase;

        const targetIndexes = [Math.min(stage, 5)];
        const endHealthPercent = stage === 5 ? 50 : 0;
        stage += 1;
        return { ...phase, targetIndexes, endHealthPercent };
      })
    };
  }

  if (id === '040203' || id === '040601') {
    base = {
      ...base,
      phases: base.phases.map((phase) =>
        phase.kind === 'boss'
          ? {
              ...phase,
              endHealthPercent: 0,
              damageWindow: {
                label:
                  id === '040601'
                    ? 'Expected calm duration'
                    : phase.id === 'boss-0'
                      ? 'Expected time to merge'
                      : 'Expected merged duration',
                defaultSeconds: 60
              }
            }
          : phase
      )
    };
  }

  if (difficulty !== 'normal') {
    if (id === '020602') {
      // Openings cross 80/60%; the selected final platforms cross 40% and 20% respectively.
      const checkpoints: Readonly<Record<string, { start: number; thresholds: readonly number[] }>> = {
        'nikare-opening': { start: 100, thresholds: [80, 60] },
        'kenut-opening': { start: 100, thresholds: [80, 60] },
        'selected-platform': { start: 50, thresholds: [40] },
        'final-burn': { start: 25, thresholds: [20] }
      };
      return {
        ...base,
        phases: base.phases.map((phase) =>
          phase.kind === 'boss'
            ? {
                ...phase,
                barrierHealthPercents: checkpoints[phase.id]!.thresholds,
                healthRange: [checkpoints[phase.id]!.start, phase.endHealthPercent!]
              }
            : phase
        )
      };
    }

    if (id === '040305') return healthPlan([60, 20], { 60: 'Watchknight Triumvirate', 20: 'Watchknight Triumvirate' });

    if (id === '020801')
      return healthPlan([65, 35, 10], {
        65: 'Gree, Reeg and Ereg',
        35: 'Gree, Reeg and Ereg',
        10: 'Proto-Greerlings'
      });

    if (id === '020802') return healthPlan([75, 40, 10], { 75: 'Flux Nova', 40: 'Flux Nova', 10: 'Final transition' });

    if (id === '020803') {
      const plan = healthPlan([70, 40, 1], { 1: 'Armor shatter' });
      return {
        ...plan,
        phases: plan.phases.map((phase) =>
          phase.id === 'boss-3' ? { ...phase, label: `${difficulty === 'legendary' ? 31 : 16}% - 0%` } : phase
        )
      };
    }
  }

  return base;
}
