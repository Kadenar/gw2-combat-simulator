import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Catalog membership, rather than a copied primal-skill list, controls which recharges the completed heal clears.
test('Blood Reckoning resets live primal skills after its adrenaline grant and leaves other recharges intact', () => {
  const config = {
    specialization: 'Berserker',
    primaryWeapon: 'Greatsword',
    initialResource: 0,
    selectedTraitIds: [],
    selectedSkillIds: [30189]
  };
  const native = warriorProfession.runtimeFor(config);
  let adrenalineAtReset;
  const result = observeGw2Runtime({
    config,
    rotation: [ID.BLOOD_RECKONING],
    profession: {
      ...native,
      catalog: withSkill(native.catalog, ID.EVISCERATE, { primalBurst: true }),
      initialize(runtime) {
        native.initialize(runtime);
        for (const id of [ID.DECAPITATE, ID.EVISCERATE, ID.WHIRLWIND_ATTACK])
          runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(id), 0, 60);
      },
      sideEffectHandlers: {
        ...native.sideEffectHandlers,
        'warrior.reset-primal-bursts'(runtime, cast, action) {
          adrenalineAtReset = runtime.profession.core.adrenaline.value;
          native.sideEffectHandlers['warrior.reset-primal-bursts'](runtime, cast, action);
        }
      }
    }
  });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.equal(adrenalineAtReset, 10);
  assert.equal(runtime.cooldownController.hasCooldown(ID.DECAPITATE), false);
  assert.equal(runtime.cooldownController.hasCooldown(ID.EVISCERATE), false);
  assert.ok(runtime.cooldownController.readyAt(ID.WHIRLWIND_ATTACK) > runtime.time);
});
