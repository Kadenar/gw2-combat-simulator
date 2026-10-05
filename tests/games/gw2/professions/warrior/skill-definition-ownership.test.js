import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';

// Removing a declaration must remove its intrinsic transition while leaving the real lifecycle running.
test('Warrior intrinsic transitions require their declared successful commitment', () => {
  const cases = [
    ['Core', ID.COUNTERBLOW, (runtime) => Boolean(runtime.profession.core.availableFlips[ID.TACTICAL_BLOW])],
    ['Berserker', ID.BERSERK, (runtime) => runtime.profession.specialization.state.berserkActive],
    ['Bladesworn', ID.UNSHEATHE_GUNSABER, (runtime) => runtime.profession.specialization.state.gunsaberActive],
    [
      'Bladesworn',
      ID.FLOW_STABILIZER,
      (runtime) => runtime.profession.specialization.state.flowStabilizerWindows.length > 0
    ],
    ['Bladesworn', ID.TACTICAL_RELOAD, (runtime) => runtime.profession.specialization.state.tacticalReloadUntil > 0],
    ['Paragon', ID.CHANT_OF_ACTION, (runtime) => runtime.profession.specialization.state.activeRefrainId != null],
    [
      'Paragon',
      ID.WE_WILL_NEVER_YIELD,
      (runtime) => Object.keys(runtime.profession.specialization.state.commandEchoes).length > 0
    ]
  ];
  for (const [specialization, id, active] of cases) {
    for (const mode of ['committed', 'cancelled', 'removed']) {
      const config = { specialization, primaryWeapon: 'Mace', initialResource: 30, selectedTraitIds: [] };
      const native = warriorProfession.runtimeFor(config);
      const result = observeGw2Runtime({
        config,
        profession: {
          ...native,
          catalog: withSkill(native.catalog, id, {
            castTimeMs: 1000,
            interruptCommitMs: 200,
            ...(mode === 'removed' ? { sideEffects: [] } : {})
          })
        },
        rotation: [{ skillId: id, offTarget: true, interruptAfterMs: mode === 'cancelled' ? 100 : 400 }]
      });
      assert.deepEqual(result.warnings, [], `${id}: ${mode}`);
      assert.equal(active(observedRuntime(result)), mode === 'committed', `${id}: ${mode}`);
    }
  }
});

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
