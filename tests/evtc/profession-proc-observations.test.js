import assert from 'node:assert/strict';
import test from 'node:test';

import { bleedingDuration } from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';
import {
  analyzeEngineerSerratedSteelObservation,
  analyzeEngineerShrapnelObservation
} from '#gw2/integrations/logs/evtc/rotation/professions/engineer/proc-observations.js';
import { analyzeMesmerSharperImagesObservation } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/sharper-images-observation.js';
import { analyzeNecromancerBarbedPrecisionObservation } from '#gw2/integrations/logs/evtc/rotation/professions/necromancer/barbed-precision-observation.js';
import { analyzeRangerSharpenedEdgesObservation } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/sharpened-edges-observation.js';
import { ENGINEER_TRAIT_IDS as ENGINEER_TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { MESMER_TRAIT_IDS as MESMER_TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { NECROMANCER_TRAIT_IDS as NECROMANCER_TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { RANGER_TRAIT_IDS as RANGER_TRAIT } from '#gw2/professions/ranger/data/ids.js';

const PLAYER = 0x1000n;
const TARGET = 0x2000n;
const CLONE = 0x3000n;
const OTHER_CLONE = 0x4000n;
const TIGER = 0x5000n;
const SPIDER = 0x6000n;
const EXPLOSION_SKILL_ID = 1_000;
const STRIKE_SKILL_ID = 2_000;

// Proc duration lookup uses the first Bleeding condition and tolerates absent profile effects.
test('Bleeding duration lookup ignores unrelated effects and defaults missing durations to zero', () => {
  assert.equal(bleedingDuration({}), 0);
  assert.equal(bleedingDuration({ effects: [] }), 0);
  assert.equal(bleedingDuration({ effects: [{ type: 'condition', condition: 'Burning', duration: 8 }] }), 0);
  assert.equal(bleedingDuration({ effects: [{ type: 'condition', condition: 'Bleeding' }] }), 0);
  assert.equal(
    bleedingDuration({
      effects: [
        { type: 'strike', condition: 'Bleeding', duration: 9 },
        { type: 'condition', condition: 'Burning', duration: 8 },
        { type: 'condition', condition: 'bLeEdInG', duration: '3' },
        { type: 'condition', condition: 'Bleeding', duration: 5 }
      ]
    }),
    3
  );
});

function event(overrides = {}) {
  return {
    time: 1_000,
    source: PLAYER,
    target: TARGET,
    value: 100,
    buffDamage: 0,
    overstackValue: 0,
    skillId: STRIKE_SKILL_ID,
    sourceInstance: 1,
    targetInstance: 2,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 1,
    buff: 0,
    result: 1,
    activation: 0,
    buffRemove: 0,
    ninety: 0,
    fifty: 0,
    moving: 0,
    stateChange: 0,
    flanking: 0,
    shields: 0,
    offcycle: 0,
    pad: 0,
    ...overrides
  };
}

function condition(time, skillId, duration, overrides = {}) {
  return event({
    time,
    value: duration,
    skillId,
    buff: 1,
    result: 0,
    stateChange: 69,
    ...overrides
  });
}

function fixture(
  events,
  skills = [
    { id: EXPLOSION_SKILL_ID, name: 'Test Explosion' },
    { id: STRIKE_SKILL_ID, name: 'Test Strike' }
  ],
  agents = []
) {
  return {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260815',
      revision: 1,
      encounterId: 16_199,
      agentCount: agents.length,
      skillCount: skills.length,
      eventCount: events.length
    },
    agents,
    skills,
    events
  };
}

function catalog(profiles) {
  const skills = [
    {
      id: EXPLOSION_SKILL_ID,
      name: 'Test Explosion',
      effects: [{ type: 'strike', damageKind: 'explosion' }]
    },
    { id: STRIKE_SKILL_ID, name: 'Test Strike', effects: [{ type: 'strike' }] }
  ];
  return {
    skills,
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillsByName: new Map(skills.map((skill) => [skill.name, skill])),
    balanceProfilesById: new Map(profiles.map((profile) => [profile.id, profile])),
    balanceProfilesByName: new Map(profiles.map((profile) => [profile.name, profile]))
  };
}

const shrapnelProfile = {
  id: ENGINEER_TRAIT.SHRAPNEL,
  name: 'Shrapnel',
  profileKind: 'trait',
  procChance: 0.33,
  effects: [
    { type: 'condition', condition: 'Bleeding', duration: 6 },
    { type: 'condition', condition: 'Crippled', duration: 1 }
  ]
};

const serratedSteelProfile = {
  id: ENGINEER_TRAIT.SERRATED_STEEL,
  name: 'Serrated Steel',
  profileKind: 'trait',
  procChance: 0.33,
  effects: [{ type: 'condition', condition: 'Bleeding', duration: 3 }]
};

const barbedPrecisionProfile = {
  id: NECROMANCER_TRAIT.BARBED_PRECISION,
  name: 'Barbed Precision',
  profileKind: 'trait',
  criticalChance: 0.33,
  effects: [{ type: 'condition', condition: 'Bleeding', duration: 3 }]
};

const sharperImagesProfile = {
  id: MESMER_TRAIT.SHARPER_IMAGES,
  name: 'Sharper Images',
  profileKind: 'trait',
  effects: [{ type: 'condition', condition: 'Bleeding', duration: 5 }]
};

const sharpenedEdgesProfile = {
  id: RANGER_TRAIT.SHARPENED_EDGES,
  name: 'Sharpened Edges',
  profileKind: 'trait',
  criticalChance: 0.33,
  effects: [{ type: 'condition', condition: 'Bleeding', duration: 3 }]
};

const arachnophobiaProfile = {
  id: RANGER_TRAIT.ARACHNOPHOBIA,
  name: 'Arachnophobia',
  profileKind: 'trait',
  attributeBonus: 150,
  weaponAttributeBonus: 225
};

test('matches Shrapnel only when expertise-scaled Bleeding and Crippled applications are paired', () => {
  const explosionHits = Array.from({ length: 4 }, (_, index) =>
    event({ time: 1_000 + index, skillId: EXPLOSION_SKILL_ID, result: index % 2 })
  );
  const result = analyzeEngineerShrapnelObservation(
    fixture([
      ...explosionHits,
      event({ time: 1_010, skillId: STRIKE_SKILL_ID }),
      condition(1_100, 736, 9_000),
      condition(1_125, 721, 1_500),
      condition(1_200, 736, 9_000),
      condition(1_200, 721, 1_500),
      condition(1_300, 736, 9_000),
      condition(1_300, 721, 1_000),
      condition(1_400, 736, 9_000, { target: 0x3000n }),
      condition(1_400, 721, 1_500, { target: 0x3000n })
    ]),
    PLAYER,
    catalog([shrapnelProfile]),
    {
      selectedTraitIds: [ENGINEER_TRAIT.SHRAPNEL],
      stats: { expertise: 750 },
      sigilSets: [{}, {}]
    }
  );

  assert.deepEqual(result, {
    targetAddress: TARGET,
    explosionHits: 4,
    matchedApplications: 2,
    observedProcRate: 0.5,
    expectedProcChance: 0.33,
    expectedApplications: 1.32,
    matchedBleedingDurationsMs: [9_000],
    matchedCrippledDurationsMs: [1_500]
  });
});

test('counts raw EVTC names for explosions whose catalog effects receive their flag at runtime', () => {
  const result = analyzeEngineerShrapnelObservation(
    fixture(
      [event({ skillId: 3_000 }), condition(1_100, 736, 6_000), condition(1_100, 721, 1_000)],
      [{ id: 3_000, name: 'Explosive Entrance' }]
    ),
    PLAYER,
    catalog([shrapnelProfile]),
    {
      selectedTraitIds: [ENGINEER_TRAIT.SHRAPNEL],
      stats: { expertise: 0 }
    }
  );

  assert.equal(result?.explosionHits, 1);
  assert.equal(result?.matchedApplications, 1);
});

test('Shrapnel observation includes generated rocket explosions but excludes orbital strikes', () => {
  // Raw rocket damage names must agree with the resolver's explosion eligibility.
  const result = analyzeEngineerShrapnelObservation(
    fixture(
      [event({ skillId: 29889 }), event({ time: 2000, skillId: 41612 })],
      [
        { id: 29889, name: 'Aim-Assisted Rocket' },
        { id: 41612, name: 'Orbital Command Strike' }
      ]
    ),
    PLAYER,
    catalog([shrapnelProfile]),
    { selectedTraitIds: [ENGINEER_TRAIT.SHRAPNEL] }
  );
  assert.equal(result?.explosionHits, 1);
  assert.equal(result?.expectedApplications, 0.33);
});

test('matches profile-owned Serrated Steel duration against critical hits', () => {
  const criticalHits = Array.from({ length: 5 }, (_, index) => event({ time: 1_000 + index }));
  const result = analyzeEngineerSerratedSteelObservation(
    fixture([
      ...criticalHits,
      event({ time: 1_010, result: 0 }),
      condition(1_100, 736, 5_320),
      condition(1_200, 736, 5_320),
      condition(1_300, 736, 10_640)
    ]),
    PLAYER,
    catalog([
      {
        ...serratedSteelProfile,
        effects: [{ type: 'condition', condition: 'Bleeding', duration: 4 }]
      }
    ]),
    {
      selectedTraitIds: [ENGINEER_TRAIT.SERRATED_STEEL],
      stats: { expertise: 0, conditionDurationBonuses: { Bleeding: 33 } },
      sigilSets: [{}]
    }
  );

  assert.deepEqual(result, {
    targetAddress: TARGET,
    criticalHits: 5,
    matchedApplications: 2,
    observedProcRate: 0.4,
    expectedProcChance: 0.33,
    expectedApplications: 1.6500000000000001,
    matchedDurationsMs: [5_320]
  });
});

test('matches expertise-scaled 3-second Barbed Precision applications against critical hits', () => {
  const result = analyzeNecromancerBarbedPrecisionObservation(
    fixture([
      event({ time: 1_000 }),
      event({ time: 1_001 }),
      event({ time: 1_002 }),
      event({ time: 1_003, result: 0 }),
      condition(1_100, 736, 4_000),
      condition(1_200, 736, 3_000)
    ]),
    PLAYER,
    catalog([barbedPrecisionProfile]),
    {
      selectedTraitIds: [NECROMANCER_TRAIT.BARBED_PRECISION],
      stats: { expertise: 500 },
      sigilSets: [{}]
    }
  );

  assert.deepEqual(result, {
    targetAddress: TARGET,
    criticalHits: 3,
    matchedApplications: 1,
    observedProcRate: 1 / 3,
    expectedProcChance: 0.33,
    expectedApplications: 0.99,
    matchedDurationsMs: [4_000]
  });
});

test('pairs player-attributed Sharper Images applications across Signet of Midnight expertise states', () => {
  const result = analyzeMesmerSharperImagesObservation(
    fixture(
      [
        event({ time: 900, sourceInstance: 7 }),
        event({ time: 1_000, source: CLONE, sourceMasterInstance: 7 }),
        condition(1_025, 736, 7_500),
        condition(1_025, 736, 7_500),
        event({ time: 1_100, source: CLONE, sourceMasterInstance: 7 }),
        condition(1_125, 736, 6_900, { stateChange: 0 }),
        event({ time: 1_300, source: OTHER_CLONE, sourceMasterInstance: 8 }),
        condition(1_300, 736, 7_500)
      ],
      undefined,
      [
        { address: CLONE, character: 'Clone' },
        { address: OTHER_CLONE, character: 'Clone' }
      ]
    ),
    PLAYER,
    catalog([sharperImagesProfile]),
    {
      selectedTraitIds: [MESMER_TRAIT.SHARPER_IMAGES],
      selectedSkills: ['Signet of Midnight'],
      stats: { expertise: 750 }
    }
  );

  assert.deepEqual(result, {
    targetAddress: TARGET,
    cloneCriticalHits: 2,
    matchedApplications: 2,
    observedProcRate: 1,
    expectedProcChance: 1,
    expectedApplications: 2,
    matchedDurationsMs: [6_900, 7_500]
  });
});

test('matches Sharpened Edges with separate player and equipped-pet expertise', () => {
  const result = analyzeRangerSharpenedEdgesObservation(
    fixture(
      [
        event({ time: 900, sourceInstance: 7, result: 0 }),
        event({ time: 1_000, sourceInstance: 7 }),
        event({ time: 1_001, sourceInstance: 7 }),
        condition(1_100, 736, 4_500, { sourceInstance: 7 }),
        event({ time: 1_200, source: TIGER, sourceInstance: 8, sourceMasterInstance: 7 }),
        condition(1_300, 736, 3_300, { source: TIGER, sourceInstance: 8, sourceMasterInstance: 7 }),
        event({ time: 1_400, source: SPIDER, sourceInstance: 9, sourceMasterInstance: 7 }),
        condition(1_500, 736, 3_750, { source: SPIDER, sourceInstance: 9, sourceMasterInstance: 7 }),
        condition(1_600, 736, 4_500, { source: SPIDER, sourceInstance: 9, sourceMasterInstance: 7 })
      ],
      undefined,
      [
        { address: TIGER, profession: 1, character: 'Juvenile Tiger' },
        { address: SPIDER, profession: 2, character: 'Juvenile Forest Spider' }
      ]
    ),
    PLAYER,
    catalog([sharpenedEdgesProfile, arachnophobiaProfile]),
    {
      selectedTraitIds: [RANGER_TRAIT.SHARPENED_EDGES, RANGER_TRAIT.ARACHNOPHOBIA],
      stats: { expertise: 750 }
    }
  );

  assert.deepEqual(result, {
    targetAddress: TARGET,
    criticalHits: 4,
    playerCriticalHits: 2,
    petCriticalHits: 2,
    matchedApplications: 3,
    playerMatchedApplications: 1,
    petMatchedApplications: 2,
    observedProcRate: 0.75,
    expectedProcChance: 0.33,
    expectedApplications: 1.32,
    playerMatchedDurationsMs: [4_500],
    pets: [
      {
        address: TIGER,
        name: 'Tiger',
        criticalHits: 1,
        matchedApplications: 1,
        matchedDurationMs: 3_300
      },
      {
        address: SPIDER,
        name: 'Forest Spider',
        criticalHits: 1,
        matchedApplications: 1,
        matchedDurationMs: 3_750
      }
    ]
  });
});

test('matches Sharpened Edges before and during Light on Your Feet', () => {
  const result = analyzeRangerSharpenedEdgesObservation(
    fixture([
      event({ time: 1_000, sourceInstance: 7 }),
      condition(1_000, 736, 4_500, { sourceInstance: 7 }),
      event({ time: 2_000, sourceInstance: 7 }),
      condition(2_000, 736, 4_800, { sourceInstance: 7 })
    ]),
    PLAYER,
    catalog([sharpenedEdgesProfile]),
    {
      selectedTraitIds: [RANGER_TRAIT.SHARPENED_EDGES, RANGER_TRAIT.LIGHT_ON_YOUR_FEET],
      stats: { expertise: 750 }
    }
  );

  assert.equal(result.playerCriticalHits, 2);
  assert.equal(result.playerMatchedApplications, 2);
  assert.deepEqual(result.playerMatchedDurationsMs, [4_500, 4_800]);
});

test('does not infer profession trait procs when the active build omits each trait', () => {
  const log = fixture([event({ skillId: EXPLOSION_SKILL_ID })]);
  assert.equal(analyzeEngineerShrapnelObservation(log, PLAYER, catalog([shrapnelProfile]), {}), null);
  assert.equal(analyzeEngineerSerratedSteelObservation(log, PLAYER, catalog([serratedSteelProfile]), {}), null);
  assert.equal(analyzeMesmerSharperImagesObservation(log, PLAYER, catalog([sharperImagesProfile]), {}), null);
  assert.equal(analyzeNecromancerBarbedPrecisionObservation(log, PLAYER, catalog([barbedPrecisionProfile]), {}), null);
  assert.equal(analyzeRangerSharpenedEdgesObservation(log, PLAYER, catalog([sharpenedEdgesProfile]), {}), null);
});
