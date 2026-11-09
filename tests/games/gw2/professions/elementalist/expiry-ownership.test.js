import assert from 'node:assert/strict';
import test from 'node:test';

import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { openElementalistEtching } from '#gw2/professions/elementalist/core/mechanics/spear.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { commitHammerOrbFixture } from '#tests/helpers/elementalist-hammer-orbs.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

// Aura expiry leaves orb cleanup to its owner; a new grant cannot refresh an orb already at its deadline.
test('coincident aura expiry preserves hammer orb ownership until its own task', () => {
  for (const refresh of [false, true]) {
    const result = runElementalist(
      [{ type: 'wait', durationMs: 4000 }],
      { specialization: 'Core', primaryWeapon: 'Hammer', selectedTraitIds: [] },
      {
        catalog: (catalog) =>
          withSkill(withSkill(catalog, ID.FLAME_WHEEL, { orbDuration: 2 }), ID.ICY_COIL, { orbDuration: 2 }),
        initialize(runtime) {
          commitHammerOrbFixture(runtime, ID.FLAME_WHEEL, 'first-orb');
          applyElementalistAura(runtime.mechanics, {
            at: 0,
            duration: 2,
            aura: 'Fire Aura',
            skillName: 'Fixture Aura',
            sourceId: 1
          });
        },
        timeline: [
          {
            at: 2,
            priority: 25,
            run(runtime) {
              const state = runtime.profession.core;
              assert.deepEqual(state.activeAuras, []);
              assert.equal(state.hammerOrbs.Fire, runtime.time);
              assert.equal(state.hammerOrbActivationIds.Fire, 'first-orb');

              if (refresh) commitHammerOrbFixture(runtime, ID.ICY_COIL, 'second-orb');
            }
          }
        ],
        probes: [
          [
            2,
            (runtime) => {
              const state = runtime.profession.core;
              assert.equal(state.hammerOrbs.Fire, null);
              assert.equal(state.hammerOrbActivationIds.Fire, null);
              assert.equal(state.hammerOrbActivationIds.Water, refresh ? 'second-orb' : null);
            }
          ],
          [
            4,
            (runtime) => {
              for (const element of ['Fire', 'Water']) {
                assert.equal(runtime.profession.core.hammerOrbs[element], null);
                assert.equal(runtime.profession.core.hammerOrbActivationIds[element], null);
              }
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
  }
});

// Exercise the scheduled owner so a reopened field survives its old deadline and retires at its new one.
test('etching refresh survives its old deadline and retires at its replacement deadline', () => {
  const result = runElementalist(
    [{ type: 'wait', durationMs: 4000 }],
    { specialization: 'Core', primaryWeapon: 'Spear', selectedTraitIds: [] },
    {
      catalog: (catalog) =>
        withSkill(catalog, ID.ETCHING_VOLCANO, {
          comboFields: catalog.skillsById
            .get(ID.ETCHING_VOLCANO)
            .comboFields.map((field) => ({ ...field, duration: 2 }))
        }),
      initialize(runtime) {
        openElementalistEtching(runtime.mechanics, runtime.helpers.skillsById.get(ID.ETCHING_VOLCANO));
      },
      timeline: [
        {
          at: 1,
          run(runtime) {
            openElementalistEtching(runtime.mechanics, runtime.helpers.skillsById.get(ID.ETCHING_VOLCANO));
          }
        }
      ],
      probes: [
        [
          2,
          (runtime) => {
            const skill = runtime.helpers.skillsById.get(ID.ETCHING_VOLCANO);
            assert.equal(runtime.profession.core.etchings[skill.name].expiresAt, 3);
          }
        ],
        [
          3,
          (runtime) => {
            const skill = runtime.helpers.skillsById.get(ID.ETCHING_VOLCANO);
            assert.equal(runtime.profession.core.etchings[skill.name], null);
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
});
