import assert from 'node:assert/strict';
import test from 'node:test';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Both finishers grant exactly one live reduction after commitment, preserving other weapons and proc reporting.
test('Gleam Saber declarations reduce only other sword recharges after commitment', () => {
  for (const [specialization, first, second, finisher, target] of [
    [
      'Core',
      ID.SUN_EDGE_NON_HOLOSMITH,
      ID.SUN_RIPPER_NON_HOLOSMITH,
      ID.GLEAM_SABER_NON_HOLOSMITH,
      ID.REFRACTION_CUTTER_NON_HOLOSMITH
    ],
    ['Holosmith', ID.SUN_EDGE, ID.SUN_RIPPER, ID.GLEAM_SABER, ID.REFRACTION_CUTTER]
  ]) {
    for (const cancelled of [false, true]) {
      const result = runEngineer(
        [first, second, { type: 'cast', skillId: finisher, interruptAfterMs: cancelled ? 100 : 400 }],
        {
          specialization,
          primaryWeapon: 'Sword',
          secondaryWeapon: 'Pistol',
          boons: { quickness: true }
        },
        {
          extend: (native) => ({
            catalog: withSkill(native.catalog, finisher, {
              castTimeMs: 1000,
              interruptCommitMs: 200,
              retainsCastLockoutAfterInterrupt: false
            })
          }),
          initialize(runtime) {
            for (const skillId of [target, ID.POISON_DART_VOLLEY])
              runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(skillId), 0, 60);
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(runtime.cooldowns.get(target), cancelled ? 48 : 47.2);
      assert.equal(runtime.cooldowns.get(ID.POISON_DART_VOLLEY), 48);
      const procs = result.events.filter((event) => event.type === 'proc' && event.sourceId === finisher);
      assert.equal(procs.length, cancelled ? 0 : 1);
      if (!cancelled) assert.equal(procs[0].cooldownReduction, 0.8);
    }
  }
});
