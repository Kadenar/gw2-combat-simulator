import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
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
const selfCondition = (name, expiresAt = 10) => ({
  condition: 'Torment',
  stacks: 1,
  at: 0,
  expiresAt,
  sourceId: 'fixture',
  skillName: name
});

test('Hex-Eater cleanses its acceptance selection only when the cast commits', () => {
  // Configured conditions consume capacity first; later arrivals and unselected conditions must survive.
  for (const cancelled of [false, true]) {
    const initial = [
      selfCondition('expiring', 0.1),
      ...Array.from({ length: 6 }, (_, i) => selfCondition(`initial-${i}`))
    ];
    const arriving = selfCondition('arriving');
    const result = runRevenant(
      [{ skillId: ID.HEX_EATER_VORTEX, ...(cancelled ? { interruptMs: 0 } : {}) }, wait],
      { ...config, selfConditionCount: 2 },
      {
        initialize(runtime) {
          runtime.profession.core.selfConditions = [...initial];
          runtime.schedule('test.add-condition', 0.2);
        },
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'test.add-condition'(runtime) {
              assert.equal(runtime.profession.core.selfConditionCount, 2);
              assert.deepEqual(runtime.profession.core.selfConditions, initial);
              runtime.profession.core.selfConditions.push(arriving);
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const core = observedRuntime(result).profession.core;
    assert.equal(core.selfConditionCount, cancelled ? 2 : 0);
    assert.deepEqual(core.selfConditions, cancelled ? [...initial, arriving] : [...initial.slice(5), arriving]);
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
                [PROFILE.sharedWisdom]:
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
      assert.equal(observedRuntime(result).profession.core.selfConditionCount, 0);
    }
  }
});

test('Hex-Eater selects surviving strike and condition components independently', () => {
  // Remove components at construction; the surviving sibling still supplies the projectile capacity.
  for (const removed of ['strike', 'condition', 'both']) {
    const result = runRevenant(
      ['Hex-Eater Vortex', wait],
      { ...config, selfConditionCount: 1 },
      {
        catalog: (catalog) =>
          withSkill(catalog, ID.HEX_EATER_VORTEX, {
            effects: catalog.skillsById
              .get(ID.HEX_EATER_VORTEX)
              .effects.filter((effect) => removed !== 'both' && effect.type !== removed)
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'damage'),
      removed === 'condition'
    );
    assert.equal(
      result.events.some((event) => event.type === 'condition'),
      removed === 'strike'
    );
    assert.equal(observedRuntime(result).profession.core.selfConditionCount, removed === 'both' ? 1 : 0);
  }
});
