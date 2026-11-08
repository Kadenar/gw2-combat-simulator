// Minimal application histories protect generated supply independently of benchmark rotations.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import {
  buildBoonGeneration,
  createBoonGenerationCollector,
  generatedBoonCoverage,
  projectedPartyEffects
} from '#gw2/platform/results/boon-generation.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const grant = (at, duration, options = {}) => ({
  type: 'buff',
  kind: 'quickness',
  at,
  duration,
  stacks: 1,
  audience: { recipients: 'party', maximumRecipients: 1 },
  ...options
});
const extension = (at, duration, options = {}) => ({
  type: 'boon_extension',
  at,
  duration,
  extensionAudience: 'all',
  ...options
});

test('compact generation preserves capped extension eligibility, preparation, and causal order', () => {
  const events = [
    grant(0, 30),
    grant(1, 30),
    grant(2, 100, { audience: { recipients: 'self' } }),
    extension(30, 2),
    extension(34, 2),
    grant(35, 1, { causalOrder: 1 }),
    extension(35, 3, { causalOrder: 2 }),
    grant(36, 10, { cancelled: true }),
    grant(36, 10, { actorType: 'environment' }),
    grant(37, 20, { kind: 'fury' }),
    grant(40, 100)
  ];
  const compact = createBoonGenerationCollector(false, () => ({ start: 3, end: 40 }));
  for (const event of events) compact.record(event);
  const result = compact.finish(3, 40);
  const detailed = buildBoonGeneration(events, 3, 40);
  assert.deepEqual(result.boons.get('quickness'), detailed.boons.get('quickness'));
  assert.equal(result.boons.get('quickness').ally.generatedStackSeconds, 6);
  assert.equal(result.boons.has('fury'), false);
  assert.ok([...result.allyApplications.values()].every((history) => history.length <= 1));
  assert.deepEqual(generatedBoonCoverage(result.boons, 0).quickness, { selfPercent: 0, allyPercent: 0 });
});

const profession = defineTestProfession({ id: 'generation-window', name: 'Generation window' });

// Named grants belong to ally 1 only; other allies cannot add supply or keep its pool alive for extensions.
for (const audienceField of ['audience', 'resolvedAudience']) {
  test(`named-ally generation uses one representative with ${audienceField}`, () => {
    const namedGrant = (ally, at, duration) =>
      grant(at, duration, {
        audience: undefined,
        [audienceField]:
          audienceField === 'audience'
            ? { recipients: 'party', affectsSelf: false, maximumRecipients: 1, alliedPlayerIndex: ally }
            : {
                includesSelf: false,
                includesSummons: false,
                alliedPlayerCount: 1,
                alliedPlayerIndex: ally,
                companionIds: [],
                recipientCount: 1
              }
      });
    const events = [
      ...[1, 2, 3, 4].map((ally) => namedGrant(ally, 0, 2)),
      extension(1, 1),
      namedGrant(2, 4, 10),
      extension(5, 2)
    ];
    for (const retainHistory of [false, true]) {
      const collector = createBoonGenerationCollector(retainHistory, () => ({ start: 0, end: 10 }));
      for (const event of events) collector.record(event);
      const result = collector.finish(0, 10);
      assert.deepEqual(result.boons.get('quickness'), {
        intensityStacking: false,
        self: { generatedStackSeconds: 0 },
        ally: { generatedStackSeconds: 3 }
      });
    }
  });
}

// Distinct combat, damage, and observation clocks expose accidental credit for preparation or the end boundary.
for (const explicit of [false, true]) {
  for (const targetDeath of [false, true]) {
    test(`score and detail agree with ${explicit ? 'explicit' : 'implicit'} entry and ${targetDeath ? 'target death' : 'observation end'}`, () => {
      const run = (output, collectBoonCoverage = true) =>
        observeGw2Runtime({
          profession: profession.runtimeFor({}),
          output,
          collectBoonCoverage,
          config: {
            attributeInputs: baseAttributeInputs({ concentration: 1500 }),
            ...(targetDeath ? { target: { health: 1 } } : {})
          },
          rotation: [
            { type: 'wait', durationMs: 2000 },
            ...(explicit ? [{ type: 'combat-start' }] : []),
            { type: 'wait', durationMs: 6000 }
          ],
          engineInitialize(runtime) {
            for (const event of [
              grant(0, 5),
              extension(2, 2),
              grant(3, 2),
              grant(4, 3),
              { type: 'damage', at: 4, coefficient: 1, weaponStrengthProfileId: 'weapon.axe' },
              extension(6, 2),
              grant(8, 100)
            ])
              runtime.effects.emit({
                kind: 'packet',
                event: { source: 'Fixture', sourceId: 'fixture', actorType: 'player', ...event }
              });
          }
        });
      const detailed = run('detailed');
      const score = run('score');
      const unconstrained = run('score', false);
      const start = detailed.combatStartTime ?? detailed.dpsStartTime;
      const replay = buildBoonGeneration(detailed.resolvedEvents, start, detailed.combatEndTime);
      assert.deepEqual(detailed.boonGeneration.boons, Object.fromEntries(replay.boons));
      assert.deepEqual(
        detailed.effectReport.tracks.filter((track) => track.origin === 'party-projection'),
        projectedPartyEffects(replay, detailed.combatEndTime).tracks
      );
      assert.deepEqual(score.boonCoverage, generatedBoonCoverage(replay.boons, detailed.dpsWindow));
      assert.deepEqual(score.boonCoverage, detailed.boonCoverage);
      assert.equal(score.dpsStartTime, 4);
      assert.equal(score.combatStartTime, explicit ? 2 : 4);
      assert.equal(score.combatEndTime, targetDeath ? 4 : 8);

      if (!targetDeath) assert.equal(score.boonCoverage.quickness.allyPercent, explicit ? 350 : 200);

      assert.equal(score.dps, unconstrained.dps);
      assert.equal(unconstrained.boonCoverage, undefined);
      assert.equal(observedRuntime(unconstrained).boonGeneration, null);
      assert.deepEqual(observedRuntime(score).resolved, []);
    });
  }
}

test('damage-free runs use the reporting fallback window without losing earlier generation', () => {
  const collector = createBoonGenerationCollector(false, () => ({ start: null, end: 10 }));
  for (const event of [grant(0, 2), grant(3, 2), grant(9, 20)]) collector.record(event);
  assert.equal(collector.finish(0, 10).boons.get('quickness').ally.generatedStackSeconds, 24);
});
