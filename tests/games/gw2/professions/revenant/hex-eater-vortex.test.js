import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const config = {
  specialization: 'Conduit',
  selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
  startingLegend: LEGEND.ENTITY,
  initialEnergy: 100,
  selectedTraitIds: [TRAIT.SHARED_WISDOM]
};
const wait = { type: 'wait', durationMs: 1500 };
const selfCondition = (expiresAt = 10) => ({ expiresAt });

test('Hex-Eater cleanses its acceptance selection only when the cast commits', () => {
  // A two-projectile fixture reserves surviving applications; later arrivals and excess conditions must survive.
  for (const cancelled of [false, true]) {
    const initial = [selfCondition(0.1), ...Array.from({ length: 3 }, () => selfCondition())];
    const arriving = selfCondition();
    const result = runRevenant(
      [{ skillId: ID.HEX_EATER_VORTEX, ...(cancelled ? { interruptMs: 0 } : {}) }, wait],
      config,
      {
        catalog: (catalog) =>
          withSkill(catalog, ID.HEX_EATER_VORTEX, {
            effects: catalog.skillsById
              .get(ID.HEX_EATER_VORTEX)
              .effects.map((effect) => ({ ...effect, ticks: effect.ticks.slice(0, 2) }))
          }),
        initialize(runtime) {
          runtime.profession.core.selfConditions = [...initial];
          runtime.schedule('test.add-condition', 0.2);
        },
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'test.add-condition'(runtime) {
              assert.deepEqual(runtime.profession.core.selfConditions, initial);
              runtime.profession.core.selfConditions.push(arriving);
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const core = observedRuntime(result).profession.core;
    // Equal expiry values must not make later applications interchangeable with the selected objects.
    const expected = cancelled ? [...initial, arriving] : [...initial.slice(3), arriving];
    assert.equal(core.selfConditions.length, expected.length);
    expected.forEach((condition, index) => assert.equal(core.selfConditions[index], condition));
    const packets = result.events.filter((event) => event.skillId === ID.HEX_EATER_VORTEX);
    assert.equal(
      packets.some((event) => event.type === 'damage'),
      !cancelled
    );
    assert.equal(
      packets.some((event) => event.type === 'buff' && event.kind === 'resolution'),
      !cancelled
    );
  }
});

test('Hex-Eater zero-condition salvo and Shared Wisdom are independently gated', () => {
  // Demon supplies projectiles without a cleanse; Resolution depends on the trait and its live profile alone.
  for (const legend of [LEGEND.ASSASSIN, LEGEND.DEMON]) {
    for (const mode of ['selected', 'unselected', 'removed']) {
      const result = runRevenant(
        ['Hex-Eater Vortex', wait],
        {
          ...config,
          selectedLegends: [LEGEND.ENTITY, legend],
          selectedTraitIds: mode === 'unselected' ? [] : [TRAIT.SHARED_WISDOM]
        },
        {
          catalog: (catalog) =>
            applyBalanceProfilePatch(catalog, {
              balanceProfiles: {
                [TRAIT.SHARED_WISDOM]:
                  mode === 'removed'
                    ? { removeEffects: [{ type: 'boon', name: 'hex-eater-vortex' }] }
                    : { effects: [{ type: 'boon', name: 'hex-eater-vortex', stacks: 2 }] }
              }
            })
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.events.some((event) => event.type === 'damage'),
        legend === LEGEND.DEMON
      );
      assert.equal(
        result.events.some((event) => event.type === 'condition'),
        legend === LEGEND.DEMON
      );
      const resolution = result.events.find((event) => event.type === 'buff' && event.kind === 'resolution');
      assert.equal(Boolean(resolution), mode === 'selected');

      if (resolution) assert.equal(resolution.stacks, 2);

      assert.deepEqual(observedRuntime(result).profession.core.selfConditions, []);
    }
  }
});

test('Hex-Eater selects surviving strike and condition components independently', () => {
  // Remove components at construction; the surviving sibling still supplies the projectile capacity.
  for (const removed of ['strike', 'condition', 'both']) {
    const result = runRevenant(['Hex-Eater Vortex', wait], config, {
      initialize(runtime) {
        runtime.profession.core.selfConditions.push(selfCondition());
      },
      catalog: (catalog) =>
        withSkill(catalog, ID.HEX_EATER_VORTEX, {
          effects: catalog.skillsById
            .get(ID.HEX_EATER_VORTEX)
            .effects.filter((effect) => removed !== 'both' && effect.type !== removed)
        })
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'damage'),
      removed === 'condition'
    );
    assert.equal(
      result.events.some((event) => event.type === 'condition'),
      removed === 'strike'
    );
    assert.equal(observedRuntime(result).profession.core.selfConditions.length, removed === 'both' ? 1 : 0);
  }
});
