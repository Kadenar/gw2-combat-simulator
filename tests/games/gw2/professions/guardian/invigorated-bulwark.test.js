import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(guardianProfession, {
  primaryWeapon: 'Mace',
  stats: { power: 2000, precision: 1000, concentration: 0 },
  boons: { alacrity: false, quickness: false },
  target: { armor: 2597, conditions: {} }
});

// Base-duration scaling must remain multiplicative even after concentration reaches or exceeds the 100% bonus cap.
test('Invigorated Bulwark extends mace boons before the boon-duration cap, including extended symbol pulses', () => {
  for (const concentration of [0, 1500, 2250]) {
    for (const selected of [false, true]) {
      const result = simulate('Core', ['Symbol of Faith', "Protector's Strike", { type: 'wait', durationMs: 7500 }], {
        stats: { concentration },
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

// Recharge reduction applies only to mace and composes with the existing Alacrity rate.
test('Invigorated Bulwark reduces mace recharge by twenty percent without extending other boons', () => {
  for (const skill of ['Symbol of Faith', "Protector's Strike", 'Symbol of Blades']) {
    for (const alacrity of [false, true]) {
      const run = (selected) =>
        simulate('Core', [skill, { type: 'wait', durationMs: 1000 }], {
          primaryWeapon: skill === 'Symbol of Blades' ? 'Sword' : 'Mace',
          boons: { alacrity },
          selectedTraitIds: selected ? [TRAIT.INVIGORATED_BULWARK] : []
        });
      const baseline = run(false);
      const traited = run(true);
      for (const result of [baseline, traited]) assert.deepEqual(result.warnings, []);
      const recharge = (result) => {
        const runtime = observedRuntime(result);
        return (
          runtime.cooldownController.readyAt(runtime.helpers.skillsByName.get(skill).id) - result.steps[0].end / 1000
        );
      };

      assert.ok(
        Math.abs(recharge(traited) - recharge(baseline) * (skill === 'Symbol of Blades' ? 1 : 0.8)) < 1e-9,
        skill
      );
      if (skill === 'Symbol of Blades') {
        const durations = (result) =>
          result.resolvedEvents.filter((event) => event.type === 'buff').map((event) => event.duration);
        assert.deepEqual(durations(traited), durations(baseline));
      }
    }
  }
});
