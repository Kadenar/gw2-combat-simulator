import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { CONJURE_PICKUP_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { applyConjureState } from '#gw2/professions/elementalist/core/mechanics/conjures.js';

test('conjure pickup availability and consumption require a finite, unexpired ground copy', () => {
  // Check both boundaries, including a pickup whose animation ends after expiry.
  for (const [id, weapon] of Object.entries(CONJURE_PICKUP_WEAPONS)) {
    const skill = elementalistCatalog.skillsById.get(Number(id));
    for (const expiry of [undefined, null, NaN, Infinity, -Infinity, -1, 0, 0.1, 1]) {
      const core = createElementalistCoreState();
      if (expiry !== undefined) core.conjurePickups[weapon] = expiry;
      const events = [];
      const context = {
        state: { profession: { core } },
        start: 0,
        effectiveEnd: 0.3,
        emit: (event) => events.push(event)
      };
      const expected = expiry === 0 || expiry === 0.1 || expiry === 1;
      assert.equal(elementalistCoreAvailability(context, skill).ready, expected, `${weapon}: ${expiry}`);
      applyConjureState(context, skill);
      assert.equal(core.conjureEquipped, expected ? weapon : null);
      assert.equal(events.length, expected ? 1 : 0);
      if (expected) {
        assert.equal(Object.hasOwn(core.conjurePickups, weapon), false);
        assert.equal(elementalistCoreAvailability(context, skill).ready, false);
        applyConjureState(context, skill);
        assert.equal(events.length, 1);
      }
    }
  }
});

test('native rotations reject nonexistent pickups and consume summoned ground copies once', () => {
  const options = {
    lines: [['Fire'], ['Air'], ['Arcane']],
    selectedSkills: { Utility1: 'Conjure Frost Bow' }
  };
  const missing = runNative({ ...options, rotation: ['__pickup_Frost Bow'] });
  assert.match(missing.warnings[0], /pickup is unavailable or expired/);
  assert.equal(missing.endState.profession.conjureEquipped, null);

  const pickedUp = runNative({
    ...options,
    rotation: ['Conjure Frost Bow', '__drop_bundle', '__pickup_Frost Bow']
  });
  assert.deepEqual(pickedUp.warnings, []);
  assert.equal(pickedUp.endState.profession.conjureEquipped, 'Frost Bow');
  assert.equal(Object.hasOwn(pickedUp.endState.profession.conjurePickups, 'Frost Bow'), false);

  const expired = runNative({
    ...options,
    rotation: ['Conjure Frost Bow', '__drop_bundle', 36000, '__pickup_Frost Bow']
  });
  assert.match(expired.warnings[0], /pickup is unavailable or expired/);
  assert.equal(expired.endState.profession.conjureEquipped, null);
});

test('Weaver autoattack roots require the primary attunement, even when the off hand matches', () => {
  for (const skill of ['Seiche', 'Charged Strike', 'Fire Strike']) {
    const result = runNative({
      lines: [['Fire'], ['Air'], ['Weaver']],
      startAttunement: 'Fire',
      secondaryAttunement: 'Air',
      weapons: ['Sword', 'Dagger'],
      rotation: [skill]
    });
    const expected = skill === 'Fire Strike';
    assert.equal(
      result.events.some((event) => event.type === 'action' && event.skillName === skill),
      expected
    );
    if (expected) assert.deepEqual(result.warnings, []);
    else assert.match(result.warnings[0], /matching Weaver hand/);
  }
});

test('Weaver preserves the next autoattack link across completed and concurrent attunement swaps', () => {
  // Both swap paths must retain earned chain progress and clear it after the finisher.
  const airAttunement = elementalistCatalog.skillsByName.get('Air Attunement');
  const root = elementalistCatalog.skillsByName.get('Fire Strike').id;
  for (const swap of ['Air Attunement', { type: 'cast', skillId: airAttunement.id, concurrentOffsetMs: 100 }]) {
    const result = runNative({
      lines: [['Fire'], ['Air'], ['Weaver']],
      startAttunement: 'Fire',
      secondaryAttunement: 'Air',
      weapons: ['Sword', 'Dagger'],
      rotation: ['Fire Strike', swap, 'Fire Swipe', 'Searing Slash']
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'action' && event.skillName === 'Searing Slash'),
      true
    );
    assert.equal(result.endState.profession.autoattackCarryover, null);
    assert.equal(result.endState.profession.autoattackChains[root], undefined);
  }
});
