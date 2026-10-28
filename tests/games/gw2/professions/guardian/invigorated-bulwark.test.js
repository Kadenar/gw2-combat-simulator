import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(guardianProfession, {
  primaryWeapon: 'Mace',
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, concentration: 0 }),
  boons: { alacrity: false, quickness: false },
  target: { armor: 2597, conditions: {} }
});

// Base-duration scaling must remain multiplicative even after concentration reaches or exceeds the 100% bonus cap.
test('Invigorated Bulwark extends mace boons before the boon-duration cap, including extended symbol pulses', () => {
  for (const concentration of [0, 1500, 2250]) {
    for (const selected of [false, true]) {
      const result = simulate('Core', ['Symbol of Faith', "Protector's Strike", { type: 'wait', durationMs: 7500 }], {
        attributeInputs: baseAttributeInputs({ concentration }),
        selectedTraitIds: [TRAIT.WRIT_OF_PERSISTENCE, ...(selected ? [TRAIT.INVIGORATED_BULWARK] : [])]
      });
      assert.deepEqual(result.warnings, []);
      const boons = result.resolvedEvents.filter((event) => event.type === 'buff');
      const multiplier = (selected ? 1.33 : 1) * (1 + Math.min(1, concentration / 1500));
      for (const [kind, base] of [
        ['regeneration', 1],
        ['protection', 3],
        ['aegis', 6]
      ]) {
        const applications = boons.filter((event) => event.kind === kind);
        assert.ok(applications.length > 0, kind);
        assert.ok(
          applications.every((event) => Math.abs(event.duration - base * multiplier) < 1e-9),
          kind
        );
      }

      const regeneration = boons.filter((event) => event.kind === 'regeneration');
      const lastPulse = result.events
        .filter((event) => event.type === 'damage' && event.skillName === 'Symbol of Faith')
        .at(-1);
      assert.equal(regeneration.at(-1).at, lastPulse.at);
    }
  }
});
