import assert from 'node:assert/strict';
import test from 'node:test';

import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

// Delayed precasts must cross Combat Start without postponing clone conversion or delaying on-hit traits twice.
test('Phantasmal Mage targeting moves hostile applications across Combat Start while retaining resources', () => {
  const run = (targeting = {}) =>
    simulateMesmer(
      [
        { type: 'cast', skillId: ID.PHANTASMAL_MAGE, ...targeting },
        { type: 'combat-start', concurrentOffsetMs: 800 },
        { type: 'wait', durationMs: 5000 }
      ],
      {
        specialization: 'Troubadour',
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Torch',
        initialResource: 0,
        selectedTraitIds: [TRAIT.THE_PLEDGE]
      }
    );
  const base = run();
  const delayed = run({ impactDelayMs: 800 });
  const missed = run({ offTarget: true });
  for (const result of [base, delayed, missed]) assert.deepEqual(result.warnings, []);

  const playerStrike = (event) =>
    event.type === 'damage' && event.skillId === ID.PHANTASMAL_MAGE && event.actorType === 'player';
  const original = base.events.find(playerStrike);
  const landed = delayed.resolvedEvents.find(playerStrike);
  assert.ok(original.at < base.combatStartTime);
  assert.ok(!base.resolvedEvents.some((event) => playerStrike(event) && event.damage > 0));
  assert.equal(delayed.combatStartTime, base.combatStartTime);
  assert.equal(landed.at, original.at + 0.8);
  assert.equal(delayed.firstHitTime, landed.at);
  assert.ok(landed.damage > 0);

  const burning = delayed.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.condition === 'Burning' && event.actorType === 'player'
  );
  assert.ok(burning.some((event) => event.sourceId === ID.PHANTASMAL_MAGE && event.damage > 0));
  assert.ok(burning.some((event) => event.sourceId === TRAIT.THE_PLEDGE && event.damage > 0));
  assert.ok(burning.every((event) => event.at === landed.at));

  // The summon shares targeting, but its independent conversion still grants the same resource at the same time.
  const summonStrike = (event) =>
    event.type === 'damage' && event.skillId === ID.PHANTASMAL_MAGE && event.actorType === 'summon';
  assert.equal(
    Math.round(delayed.resolvedEvents.find(summonStrike).at * 1000),
    Math.round(base.resolvedEvents.find(summonStrike).at * 1000) + 800
  );
  const resources = (result) =>
    result.events
      .filter((event) => event.type === 'resource')
      .map(({ at, resource, value }) => ({ at, resource, value }));
  assert.ok(resources(base).length > 0);
  assert.deepEqual(resources(delayed), resources(base));
  assert.deepEqual(resources(missed), resources(base));
  assert.equal(missed.totalDamage, 0);
});
