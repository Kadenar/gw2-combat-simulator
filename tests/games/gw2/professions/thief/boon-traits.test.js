import assert from 'node:assert/strict';
import test from 'node:test';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

// Misses and non-player packets cannot claim the ICD; every boon shares the landed attack's proc boundary.
test('Burst of Agility grants Lesser Haste self boons on defiant hits with a 60-second ICD', () => {
  for (const [selected, defiant] of [
    [true, true],
    [false, true],
    [true, false]
  ]) {
    const result = runThief(
      [{ type: 'wait', durationMs: 62000 }],
      {
        selectedTraitIds: selected ? [TRAIT.BURST_OF_AGILITY] : [],
        target: { armor: 2597, health: 1000000000, defiant, conditions: {} }
      },
      {
        initialize(runtime) {
          for (const [at, fields] of [
            [0.1, { offTarget: true }],
            [0.2, { actorType: 'summon' }],
            [0.3, { actorType: 'effect' }],
            [0.4, { coefficient: 0, flatStrikeBase: 100, damageKind: 'life-steal' }],
            [1, {}],
            [1, {}],
            [60.96, {}],
            [61, {}],
            [61.04, {}]
          ])
            runtime.effects.emit({ kind: 'packet', event: thiefHit(at, fields) });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const boons = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.sourceId === TRAIT.BURST_OF_AGILITY
    );
    assert.deepEqual(
      boons.map((event) => [event.at, event.kind, event.duration]),
      selected && defiant
        ? [1, 61.04].flatMap((at) => ['quickness', 'fury', 'swiftness'].map((kind) => [at, kind, 6]))
        : []
    );
    for (const boon of boons) {
      assert.equal(boon.skillId, ID.LESSER_HASTE);
      assert.equal(boon.skillName, 'Lesser Haste');
      assert.equal(boon.triggeredBy, 'Double Strike');
      assert.equal(boon.resolvedAudience.includesSelf, true);
      assert.equal(boon.audience.recipients, 'self');
    }
  }
});

// Might belongs to the dodge's start, repeats without an ICD, and also applies to specialized dodges.
test('Pumping Up grants three self Might for twenty seconds on each selected dodge', () => {
  for (const specialization of ['Core', 'Daredevil']) {
    for (const selected of [false, true]) {
      const result = runThief(['Dodge', 'Dodge'], {
        specialization,
        selectedTraitIds: [
          ...(selected ? [TRAIT.PUMPING_UP] : []),
          ...(specialization === 'Daredevil' ? [TRAIT.BOUNDING_DODGER] : [])
        ]
      });
      assert.deepEqual(result.warnings, []);
      const might = result.resolvedEvents.filter(
        (event) => event.type === 'buff' && event.sourceId === TRAIT.PUMPING_UP
      );
      assert.deepEqual(
        might.map((event) => [event.at, event.kind, event.stacks, event.duration]),
        selected ? result.steps.map((step) => [step.start / 1000, 'might', 3, 20]) : []
      );
      assert.ok(might.every((event) => event.audience.recipients === 'self' && event.resolvedAudience.includesSelf));
    }
  }
});
