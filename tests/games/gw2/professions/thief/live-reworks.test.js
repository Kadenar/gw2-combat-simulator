// Exercise live rework ownership and resource consumption with minimal combat scenarios.
import assert from 'node:assert/strict';
import test from 'node:test';

import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

test('Malicious Deaths Judgment retains full damage without spending malice on an unmarked target', () => {
  const results = [false, true].map((marked) =>
    runThief(
      [ID.MALICIOUS_DEATHS_JUDGMENT],
      { specialization: 'Deadeye', primaryWeapon: 'Rifle', secondaryWeapon: '' },
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
          runtime.resourceController.replace('malice', 5);
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: marked ? 'primary-target' : null,
            markExpiresAt: 30
          });
        }
      }
    )
  );
  for (const result of results) assert.deepEqual(result.warnings, []);
  assert.ok(results[0].totalDamage > 0);
  assert.equal(results[0].totalDamage, results[1].totalDamage);
  assert.equal(observedRuntime(results[0]).resourceController.value('malice'), 5);
  assert.equal(observedRuntime(results[1]).resourceController.value('malice'), 0);
});

test('Deft Initiation consumes its combat-entry reward once across multiple strikes', () => {
  const result = runThief(
    [ID.DOUBLE_STRIKE, ID.WILD_STRIKE],
    { selectedTraitIds: [TRAIT.DEFT_INITIATION] },
    {
      // Synthetic tuning verifies lifecycle ownership without asserting unknown live values.
      catalog: (catalog) =>
        withProfile(catalog, TRAIT.DEFT_INITIATION, {
          effects: [
            { type: 'boon', name: 'might', boon: 'might', stacks: 1, duration: 5, audience: { recipients: 'self' } }
          ]
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DEFT_INITIATION && event.kind === 'might').length,
    1
  );
  assert.equal(observedRuntime(result).profession.core.deftInitiationArmed, false);
});
