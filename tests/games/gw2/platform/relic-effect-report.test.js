import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

// Exercise native relic emissions through accepted storage and reporting, without saved-rotation snapshots.
for (const [relic, name, hook, skill, extra] of [
  ['Claw', 'Relic of the Claw', 'control'],
  [
    'Brawler',
    'Relic of the Brawler',
    'boon',
    {},
    { kind: 'protection', duration: 4, resolvedAudience: { includesSelf: true } }
  ],
  ['Deadeye', 'Relic of the Deadeye', 'completed', { categories: ['Cantrip'] }],
  ['Dragonhunter', 'Relic of the Dragonhunter', 'afterHit', { categories: ['Trap'] }],
  ['Fireworks', 'Relic of Fireworks', 'afterHit', { type: 'Weapon', cooldown: 20 }],
  ['Director', 'Relic of the Director', 'activate'],
  ['Mount Balrior', 'Relic of Mount Balrior', 'activate'],
  ['Bloodstone', 'Relic of Bloodstone', 'damagePayload'],
  ['Peitha', 'Relic of Peitha', 'damagePayload']
]) {
  test(`${relic} reports one accepted buff track under its full relic name`, () => {
    const result = resolveTestGw2Events({
      config: { relic },
      endTime: 12,
      helpers: { skillsById: new Map([[991001, skill]]) },
      engineInitialize(runtime) {
        invokeRelicHook(
          runtime,
          hook,
          {
            type: 'damage',
            at: 0,
            source: 'Test',
            sourceId: 'test.relic-trigger',
            actorType: 'player',
            skillId: 991001,
            skillName: 'Relic trigger',
            ...extra
          },
          skill
        );
      }
    });
    const tracks = result.effectReport.tracks.filter((track) => track.category === 'buff');
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].name, name);
    assert.equal(effectStateAt(result.effectReport, tracks[0], 1).count, 1);
    assert.equal(effectStateAt(result.effectReport, tracks[0], 12).count, 0);
    assert.ok(result.procSteps.some((proc) => proc.skill === name && proc.expiresAt > proc.start));
    const series = buildChartSeries(result);
    assert.deepEqual(
      Object.keys(series.effects).filter((key) => series.effectTypes[key] === 'buff'),
      [name]
    );
  });
}

test('Luminary Claw refreshes retain one named track and expire with the accepted buff', () => {
  const result = runGuardian(
    [
      'Piercing Stance',
      { type: 'wait', durationMs: 2000 },
      'Enter Radiant Forge',
      'Dazzling Hammer',
      { type: 'wait', durationMs: 10000 }
    ],
    { specialization: 'Luminary', relic: 'Claw' }
  );
  const procs = result.procSteps.filter((proc) => proc.skill === 'Relic of the Claw');
  assert.ok(procs.some((proc) => proc.detail === 'refreshed'));
  const tracks = result.effectReport.tracks.filter((track) => /claw/i.test(track.kind));
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].name, 'Relic of the Claw');
  const expiresAt = procs.at(-1).expiresAt / 1000;
  assert.equal(effectStateAt(result.effectReport, tracks[0], expiresAt - 0.001).count, 1);
  assert.equal(effectStateAt(result.effectReport, tracks[0], expiresAt).count, 0);
  assert.deepEqual(
    Object.keys(buildChartSeries(result).effects).filter((name) => /claw/i.test(name)),
    ['Relic of the Claw']
  );
});

test('Nourys retains its mechanic-owned reward track and expiry', () => {
  const result = resolveTestGw2Events({ config: { relic: 'Nourys' }, combatStartTime: 0, endTime: 40 });
  const track = result.effectReport.tracks.find((track) => track.name === 'Relic of Nourys');
  assert.ok(track);
  assert.equal(effectStateAt(result.effectReport, track, 29).count, 0);
  assert.equal(effectStateAt(result.effectReport, track, 30).count, 1);
  assert.equal(effectStateAt(result.effectReport, track, 35).count, 0);
});
