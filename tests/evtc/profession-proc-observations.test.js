import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeEngineerSerratedSteelObservation,
  analyzeEngineerShrapnelObservation
} from '../../js/games/gw2/integrations/logs/evtc/rotation/professions/engineer/proc-observations.js';
import { analyzeMesmerSharperImagesObservation } from '../../js/games/gw2/integrations/logs/evtc/rotation/professions/mesmer/sharper-images-observation.js';
import { analyzeNecromancerBarbedPrecisionObservation } from '../../js/games/gw2/integrations/logs/evtc/rotation/professions/necromancer/barbed-precision-observation.js';
import { ENGINEER_TRAIT_IDS as ENGINEER_TRAIT } from '../../js/games/gw2/content/professions/engineer/data/ids.js';
import { MESMER_TRAIT_IDS as MESMER_TRAIT } from '../../js/games/gw2/content/professions/mesmer/data/ids.js';
import { NECROMANCER_TRAIT_IDS as NECROMANCER_TRAIT } from '../../js/games/gw2/content/professions/necromancer/data/ids.js';

const PLAYER = 0x1000n;
const TARGET = 0x2000n;
const CLONE = 0x3000n;
const OTHER_CLONE = 0x4000n;
const EXPLOSION_SKILL_ID = 1_000;
const STRIKE_SKILL_ID = 2_000;

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
      effects: [{ type: 'strike', metadata: { damageKind: 'explosion' } }]
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

test('matches expertise-scaled 6-second Serrated Steel applications against critical hits', () => {
  const criticalHits = Array.from({ length: 5 }, (_, index) => event({ time: 1_000 + index }));
  const result = analyzeEngineerSerratedSteelObservation(
    fixture([
      ...criticalHits,
      event({ time: 1_010, result: 0 }),
      condition(1_100, 736, 9_000),
      condition(1_200, 736, 9_000),
      condition(1_300, 736, 4_500)
    ]),
    PLAYER,
    catalog([serratedSteelProfile]),
    {
      selectedTraitIds: [ENGINEER_TRAIT.SERRATED_STEEL],
      stats: { expertise: 750 },
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
    matchedDurationsMs: [9_000]
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

test('pairs owned clone criticals with same-clone expertise-scaled Sharper Images applications', () => {
  const result = analyzeMesmerSharperImagesObservation(
    fixture(
      [
        event({ time: 900, sourceInstance: 7 }),
        event({ time: 1_000, source: CLONE, sourceMasterInstance: 7 }),
        condition(1_025, 736, 7_500, { source: CLONE, sourceMasterInstance: 7 }),
        condition(1_025, 736, 7_500, { source: CLONE, sourceMasterInstance: 7 }),
        event({ time: 1_100, source: CLONE, sourceMasterInstance: 7 }),
        condition(1_200, 736, 7_500, { source: CLONE, sourceMasterInstance: 7 }),
        event({ time: 1_300, source: OTHER_CLONE, sourceMasterInstance: 8 }),
        condition(1_300, 736, 7_500, { source: OTHER_CLONE, sourceMasterInstance: 8 })
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
      stats: { expertise: 750 }
    }
  );

  assert.deepEqual(result, {
    targetAddress: TARGET,
    cloneCriticalHits: 2,
    matchedApplications: 1,
    observedProcRate: 0.5,
    expectedProcChance: 1,
    expectedApplications: 2,
    matchedDurationsMs: [7_500]
  });
});

test('does not infer profession trait procs when the active build omits each trait', () => {
  const log = fixture([event({ skillId: EXPLOSION_SKILL_ID })]);
  assert.equal(analyzeEngineerShrapnelObservation(log, PLAYER, catalog([shrapnelProfile]), {}), null);
  assert.equal(analyzeEngineerSerratedSteelObservation(log, PLAYER, catalog([serratedSteelProfile]), {}), null);
  assert.equal(analyzeMesmerSharperImagesObservation(log, PLAYER, catalog([sharperImagesProfile]), {}), null);
  assert.equal(analyzeNecromancerBarbedPrecisionObservation(log, PLAYER, catalog([barbedPrecisionProfile]), {}), null);
});
