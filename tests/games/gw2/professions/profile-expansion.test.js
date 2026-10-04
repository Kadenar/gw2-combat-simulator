import assert from 'node:assert/strict';
import test from 'node:test';
import { ENGINEER_TRAIT_IDS as ENGINEER } from '#gw2/professions/engineer/data/ids.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const wait = { type: 'wait', durationMs: 2000 };
const conduit = {
  specialization: 'Conduit',
  selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
  startingLegend: LEGEND.ENTITY,
  initialEnergy: 100
};

// Charge consumption is independent of authored output; delayed applications retain their own timing and values.
test('Kinetic Battery expands the surviving fifth-charge package', () => {
  for (const effects of [
    [],
    [
      {
        type: 'buff',
        name: 'superspeed',
        kind: 'superspeed',
        stacks: 1,
        duration: 3,
        atMs: 400,
        applications: 2,
        intervalMs: 300
      }
    ]
  ]) {
    const result = runEngineer(
      ['Regenerating Mist', wait],
      { selectedTraitIds: [ENGINEER.KINETIC_BATTERY], selectedSkillIds: [5857] },
      {
        initialize(runtime) {
          runtime.profession.core.kineticCharges = 4;
        },
        extend: (native) => ({ catalog: withProfile(native.catalog, ENGINEER.KINETIC_BATTERY, { effects }) })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.core.kineticCharges, 0);
    const packets = result.events.filter((event) => event.sourceId === ENGINEER.KINETIC_BATTERY);
    assert.deepEqual(
      packets.map((event) => [event.at, event.duration]),
      effects.length
        ? [
            [0.7, 3],
            [1, 3]
          ]
        : []
    );
  }
});

// Profile strikes must preserve individual coefficients, timing, and reaction identities rather than aggregate hits.
test('Grenadier expands authored ticks and registers their effect reactions', () => {
  const result = runEngineer(
    ['Healing Turret', wait],
    { selectedTraitIds: [ENGINEER.GRENADIER] },
    {
      extend: (native) => ({
        catalog: withProfile(native.catalog, ENGINEER.GRENADIER, {
          effects: [
            {
              type: 'strike',
              name: 'Grenadier',
              ticks: [
                { atMs: 100, coefficient: 0.2 },
                { atMs: 600, coefficient: 0.8 }
              ],
              reactions: [
                {
                  on: 'damage.resolved',
                  actor: 'effect',
                  packets: 'each',
                  do: { type: 'emitProfile', profileId: ENGINEER.OPTIMIZED_ACTIVATION }
                }
              ]
            }
          ]
        })
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  const hits = result.events.filter((event) => event.sourceId === ENGINEER.GRENADIER && event.type === 'damage');
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [0.2, 0.8]
  );
  assert.ok(Math.abs(hits[1].at - hits[0].at - 0.5) < 1e-9);
  assert.ok(hits.every((event) => event.effectReaction));
  assert.equal(result.events.filter((event) => event.kind === 'vigor').length, 2);
});

// Removed components must not be reconstructed from sibling effects, even with an eligible legend equipped.
test('Twin Moon Sweep emits only surviving authored components', () => {
  const result = runRevenant(['Twin Moon Sweep', wait], conduit, {
    catalog: (catalog) =>
      withSkill(catalog, ID.TWIN_MOON_SWEEP, {
        effects: [
          {
            type: 'condition',
            condition: 'Bleeding',
            stacks: 2,
            duration: 3,
            timingAnchor: 'castStart',
            atMs: 200,
            applications: 2,
            intervalMs: 300
          }
        ]
      })
  });
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter((event) => event.skillId === ID.TWIN_MOON_SWEEP);
  assert.deepEqual(
    packets.filter((event) => event.type === 'condition').map((event) => event.at),
    [0.2, 0.5]
  );
  assert.equal(
    packets.some((event) => event.type === 'damage' || event.type === 'buff'),
    false
  );
});

test('Hex-Eater Vortex retains conditions when its strike is removed', () => {
  const result = runRevenant(['Hex-Eater Vortex', wait], conduit, {
    catalog: (catalog) =>
      withSkill(catalog, ID.HEX_EATER_VORTEX, {
        effects: [
          {
            type: 'condition',
            condition: 'Torment',
            stacks: 1,
            duration: 2,
            timingAnchor: 'castStart',
            atMs: 200,
            applications: 2,
            intervalMs: 400
          }
        ]
      })
  });
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter((event) => event.skillId === ID.HEX_EATER_VORTEX);
  assert.deepEqual(
    packets.filter((event) => event.type === 'condition').map((event) => event.at),
    [0.2, 0.6]
  );
  assert.equal(
    packets.some((event) => event.type === 'damage'),
    false
  );
});

test('empty Mesmer Release Potential has no fallback strike, control, or self-condition', () => {
  const result = runRevenant(
    ['Release Potential: Mesmer', wait],
    { ...conduit, startingLegend: LEGEND.DEMON },
    {
      catalog: (catalog) => withSkill(catalog, ID.RELEASE_POTENTIAL_MESMER, { effects: [] })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some(
      (event) =>
        event.skillId === ID.RELEASE_POTENTIAL_MESMER && ['damage', 'condition', 'control'].includes(event.type)
    ),
    false
  );
  assert.deepEqual(observedRuntime(result).profession.core.selfConditions, []);
});

// One landing can own multiple unequal hits; untimed secondary packets still begin at landing.
test('Vindicator preserves landing tick offsets and repeated secondary applications', () => {
  const result = runRevenant(
    ['Dodge', wait],
    {
      specialization: 'Vindicator',
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ALLIANCE
    },
    {
      catalog: (catalog) =>
        withSkill(catalog, ID.DEATH_DROP, {
          effects: [
            {
              type: 'strike',
              timingAnchor: 'castStart',
              ticks: [
                { atMs: 160, coefficient: 1 },
                { atMs: 560, coefficient: 2 }
              ]
            },
            { type: 'boon', boon: 'might', stacks: 1, duration: 3, applications: 2, intervalMs: 200 }
          ]
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Death Drop');
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [1, 2]
  );
  assert.ok(Math.abs(hits[1].at - hits[0].at - 0.4) < 1e-9);
  const boons = result.events.filter((event) => event.sourceId === ID.DEATH_DROP && event.kind === 'might');
  assert.deepEqual(
    boons.map((event) => event.at),
    [hits[0].at, hits[0].at + 0.2]
  );
});
