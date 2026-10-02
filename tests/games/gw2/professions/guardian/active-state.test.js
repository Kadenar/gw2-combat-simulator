import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(guardianProfession, {
  specialization: 'Firebrand',
  target: { armor: 2597 }
});

// Read actual projected clocks and counters through the insertion strip's presentation contract.
function activeState(result) {
  assert.deepEqual(result.warnings, []);
  return Object.fromEntries(
    guardianProfession.ui
      .rotationStateSnapshot({
        balanceContext: { catalog: guardianProfession.catalog, modifierRulesById: new Map() },
        specialization: 'Firebrand',
        professionState: result.planningState.profession,
        atSeconds: result.planningState.atSeconds
      })
      .map((item) => [item.id, item])
  );
}

test('Purity of Word reads the live page deadline and Loremaster cadence at the cursor', () => {
  // The same clock supplies both countdowns, including ticks that continue while the page pool is full.
  for (const [selectedTraitIds, interval] of [
    [[], 8],
    [[TRAIT.LOREMASTER], 5]
  ]) {
    const config = { initialTomePages: 4, selectedTraitIds };
    const initial = activeState(simulate(undefined, [], config));
    assert.equal(initial['firebrand-purity-of-word'].value, `${interval.toFixed(1)}s`);
    const elapsed = activeState(simulate(undefined, [{ type: 'wait', durationMs: 1000 }], config));
    assert.equal(elapsed['firebrand-purity-of-word'].value, `${(interval - 1).toFixed(1)}s`);
    assert.match(elapsed['firebrand-purity-of-word'].title, new RegExp(`every ${interval}\\.0s`));
    const regenerated = simulate(undefined, [{ type: 'wait', durationMs: interval * 1000 }], config);
    assert.equal(regenerated.planningState.profession.tomePages.value, 5);
    assert.equal(activeState(regenerated)['firebrand-purity-of-word'].value, `${interval.toFixed(1)}s · Full`);
  }

  assert.equal(activeState(simulate(undefined, []))['firebrand-purity-of-word'], undefined);
});

test('Swift Scholar exposes current tome progress and clears it after a refund or stow', () => {
  // The strip follows successful tome actions rather than counting rotation inputs, including cancelled attempts.
  const config = { selectedTraitIds: [TRAIT.SWIFT_SCHOLAR] };
  const prefix = ['Tome of Justice'];
  assert.equal(activeState(simulate(undefined, prefix, config))['firebrand-swift-scholar'].value, '0/3');
  prefix.push('Chapter 1: Searing Spell');
  assert.equal(activeState(simulate(undefined, prefix, config))['firebrand-swift-scholar'].value, '1/3');
  prefix.push('Chapter 2: Igniting Burst');
  assert.equal(activeState(simulate(undefined, prefix, config))['firebrand-swift-scholar'].value, '2/3');
  const cancelled = simulate(
    undefined,
    [...prefix, { name: 'Chapter 4: Scorched Aftermath', interruptAfterMs: 1 }],
    config
  );
  assert.equal(activeState(cancelled)['firebrand-swift-scholar'].value, '2/3');
  const refunded = simulate(undefined, [...prefix, 'Chapter 4: Scorched Aftermath'], config);
  assert.equal(activeState(refunded)['firebrand-swift-scholar'].value, '0/3');
  assert.equal(refunded.planningState.profession.tomePages.value, 3);
  const stowed = simulate(undefined, [...prefix, 'Stow Tome'], config);
  assert.equal(stowed.planningState.profession.swiftScholarCount, 0);
  assert.equal(activeState(stowed)['firebrand-swift-scholar'], undefined);
  for (const tome of ['Tome of Justice', 'Tome of Resolve']) {
    assert.equal(
      activeState(simulate(undefined, [...prefix, 'Stow Tome', tome], config))['firebrand-swift-scholar'].value,
      '0/3'
    );
  }
});
