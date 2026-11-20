import assert from 'node:assert/strict';
import test from 'node:test';

import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
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

test('Purity of Word displays the projected countdown and full-pool label', () => {
  // Supply a projected clock directly so presentation checks do not repeat page-generation behavior.
  const pages = { value: 7, maximum: 8, interval: 10, nextAt: 7 };
  const result = {
    warnings: [],
    planningState: { atSeconds: 2, profession: { [STATE.TOME_PAGES]: pages } }
  };
  const item = activeState(result)['firebrand-purity-of-word'];
  assert.equal(item.value, '5.0s');
  pages.value = pages.maximum;
  assert.equal(activeState(result)['firebrand-purity-of-word'].value, '5.0s · Full');
  pages.nextAt = Infinity;
  assert.equal(activeState(result)['firebrand-purity-of-word'], undefined);
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
  assert.equal(refunded.planningState.profession[STATE.TOME_PAGES].value, 6);
  const stowed = simulate(undefined, [...prefix, 'Stow Tome'], config);
  assert.equal(stowed.planningState.profession[STATE.SWIFT_SCHOLAR_COUNT], 0);
  assert.equal(activeState(stowed)['firebrand-swift-scholar'], undefined);
  for (const tome of ['Tome of Justice', 'Tome of Resolve']) {
    assert.equal(
      activeState(simulate(undefined, [...prefix, 'Stow Tome', tome], config))['firebrand-swift-scholar'].value,
      '0/3'
    );
  }
});
