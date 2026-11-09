import assert from 'node:assert/strict';
import test from 'node:test';

import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { createHammerOrbs } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { openElementalistEtching } from '#gw2/professions/elementalist/core/mechanics/spear.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

// An aura expiry must not retire an orb before the orb's own priority, including a refresh between those tasks.
test('coincident aura expiry preserves hammer orb ownership until its own task', () => {
  for (const refresh of [false, true]) {
    const grant = (runtime, element, id) => {
      const skill = runtime.helpers.skillsById.get(ID.FLAME_WHEEL);
      createHammerOrbs(runtime.mechanics, { id, effectiveEnd: runtime.time, skill, command: {} }, skill, [element]);
    };

    const result = runElementalist(
      [{ type: 'wait', durationMs: 4000 }],
      { specialization: 'Core', primaryWeapon: 'Hammer', selectedTraitIds: [] },
      {
        catalog: (catalog) => withSkill(catalog, ID.FLAME_WHEEL, { orbDuration: 2 }),
        initialize(runtime) {
          grant(runtime, 'Fire', 'first-orb');
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

              if (refresh) grant(runtime, 'Water', 'second-orb');
            }
          }
        ],
        probes: [
          [
            2,
            (runtime) => {
              const state = runtime.profession.core;
              assert.equal(state.hammerOrbs.Fire, refresh ? 4 : null);
              assert.equal(state.hammerOrbActivationIds.Fire, refresh ? 'first-orb' : null);
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
