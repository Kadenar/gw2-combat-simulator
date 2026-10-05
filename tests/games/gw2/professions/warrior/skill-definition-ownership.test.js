import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

// Change the live pool after the shared reservation but before variant selection to expose accidental resampling.
test('tier variants use the captured spend after the live adrenaline pool changes', () => {
  for (const [id, primaryWeapon] of [
    [ID.ARCING_SLICE, 'Greatsword'],
    [ID.KILL_SHOT, 'Rifle'],
    [ID.BLOODTHIRSTER, 'Sword'],
    [ID.COMBUSTIVE_SHOT, 'Longbow']
  ]) {
    for (const initialResource of [10, 20, 30]) {
      const payloads = [];
      for (const replacePool of [false, true]) {
        const config = { specialization: 'Core', primaryWeapon, initialResource, selectedTraitIds: [] };
        const native = warriorProfession.runtimeFor(config);
        const result = observeGw2Runtime({
          config,
          profession: {
            ...native,
            onCastStart(runtime, cast) {
              native.onCastStart(runtime, cast);
              if (replacePool) runtime.resourceController.replace('adrenaline', initialResource === 30 ? 0 : 30);
            },
            modifyEffects(runtime, cast, effects) {
              payloads.push(effects);
              return native.modifyEffects(runtime, cast, effects);
            }
          },
          rotation: [id]
        });
        assert.deepEqual(result.warnings, []);
      }

      assert.ok(payloads[0].length > 0);
      assert.deepEqual(payloads[1], payloads[0], `${id}: ${initialResource}`);
    }
  }
});
