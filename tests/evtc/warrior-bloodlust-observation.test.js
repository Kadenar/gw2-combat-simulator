import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeWarriorBloodlustObservation } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/bloodlust-observation.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';

const PLAYER = 0x1000n;
const TARGET = 0x2000n;

function event(overrides = {}) {
  return {
    time: 1_000,
    source: PLAYER,
    target: TARGET,
    value: 100,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 1_000,
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

function fixture(events) {
  return {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260815',
      revision: 1,
      encounterId: 16_199,
      agentCount: 0,
      skillCount: 0,
      eventCount: events.length
    },
    agents: [],
    skills: [],
    events
  };
}

const catalog = {
  balanceProfilesById: new Map([
    [
      TRAIT.BLOODLUST,
      {
        id: TRAIT.BLOODLUST,
        name: 'Bloodlust',
        profileKind: 'trait',
        procChance: 0.33,
        effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
      }
    ]
  ]),
  balanceProfilesByName: new Map()
};

const config = {
  selectedTraitIds: [TRAIT.BLOODLUST],
  stats: { expertise: 1_500 },
  sigilSets: [{}, {}]
};

test('compares critical packets with duration-matched Bloodlust applications on the primary target', () => {
  const criticalHits = Array.from({ length: 5 }, (_, index) => event({ time: 1_000 + index }));
  const applications = Array.from({ length: 2 }, (_, index) =>
    event({
      time: 1_100 + index,
      value: 6_000,
      skillId: 736,
      buff: 1,
      result: 0,
      stateChange: 69
    })
  );
  const result = analyzeWarriorBloodlustObservation(
    fixture([
      ...criticalHits,
      ...applications,
      event({ value: 5_000, skillId: 736, buff: 1, result: 0, stateChange: 69 }),
      event({ target: 0x3000n, value: 10, result: 1 }),
      event({ value: 100, result: 0 })
    ]),
    PLAYER,
    catalog,
    config
  );

  assert.deepEqual(result, {
    targetAddress: TARGET,
    criticalHits: 5,
    matchedApplications: 2,
    observedProcRate: 0.4,
    expectedProcChance: 0.33,
    expectedApplications: 1.6500000000000001,
    matchedDurationsMs: [6_000]
  });
});

test('does not infer Bloodlust applications when the active build omits the trait', () => {
  const result = analyzeWarriorBloodlustObservation(fixture([event()]), PLAYER, catalog, {
    ...config,
    selectedTraitIds: []
  });

  assert.equal(result, null);
});
