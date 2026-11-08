import assert from 'node:assert/strict';
import test from 'node:test';

import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { wait } from '#tests/helpers/commands.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

// Use the same effects to test delivery through player casts, pet commands, and Unleashed commands.
const routes = [
  ['player', ID.LONG_RANGE_SHOT, { primaryWeapon: 'Longbow' }],
  ['pet command', ID.FANG_GRAPPLE, { selectedPet: 'Fanged Iboga' }],
  ['Unleashed command', ID.VENOMOUS_OUTBURST, { specialization: 'Untamed', initialUntamedState: 'Pet' }]
];

function deliver(skillId, config, command = {}, { eligible = true, waitMs = 1000 } = {}) {
  const result = runRanger([{ type: 'cast', skillId, ...command }, wait(waitMs)], config, {
    catalog: (catalog) =>
      withSkill(catalog, skillId, {
        effects: [
          { type: 'boon', boon: 'fury', stacks: 1, duration: 10 },
          { type: 'strike', coefficient: 1, when: () => eligible }
        ]
      })
  });
  assert.deepEqual(result.warnings, []);
  const activationId = result.steps.find((step) => step.skillId === skillId).activationId;
  const packets = result.resolvedEvents.filter((event) => event.activationId === activationId);
  return {
    reward: packets.find((event) => event.type === 'buff' && event.kind === 'fury'),
    strike: packets.find((event) => event.type === 'damage')
  };
}

for (const [name, skillId, config] of routes) {
  // Rejecting the strike must still allow the same cast to grant Fury.
  test(`${name} delivery honors effect eligibility without dropping sibling rewards`, () => {
    for (const eligible of [false, true]) {
      const { reward, strike } = deliver(skillId, config, {}, { eligible });
      assert.ok(reward);
      assert.equal(Boolean(strike), eligible);
    }
  });

  // Apply travel delay once to the strike. Fury must arrive at the same time with or without the delay.
  test(`${name} delivery preserves local rewards while delaying or missing hostile effects`, () => {
    const baseline = deliver(skillId, config);
    assert.ok(baseline.strike);
    assert.ok(baseline.reward);
    const pending = deliver(skillId, config, { impactDelayMs: 5000 });
    assert.ok(pending.reward);
    assert.equal(pending.reward.at, baseline.reward.at);
    assert.equal(pending.strike, undefined);
    const arrived = deliver(skillId, config, { impactDelayMs: 5000 }, { waitMs: 10000 });
    assert.ok(arrived.strike);
    assert.equal(arrived.strike.at, baseline.strike.at + 5);
    assert.equal(arrived.strike.activationId, baseline.strike.activationId);
    const missed = deliver(skillId, config, { offTarget: true });
    assert.ok(missed.reward);
    assert.equal(missed.strike, undefined);
  });
}
