import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const config = {
  specialization: 'Conduit',
  selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
  startingLegend: LEGEND.ENTITY,
  initialEnergy: 100
};
const wait = { type: 'wait', durationMs: 1000 };

test('Beguiling selects its final follow-up before consuming the charge, even with a removed strike', () => {
  // A single patched follow-up exposes selection-after-consumption errors without a saved rotation.
  for (const skillId of [ID.BEGUILING_HAZE, ID.BEGUILING_HAZE_ID_76805]) {
    for (const removed of [false, true]) {
      const result = runRevenant(
        [{ skillId }, { skillId }],
        { ...config, selectedTraitIds: [TRAIT.SHARED_WISDOM] },
        {
          catalog: (catalog) =>
            applyBalanceProfilePatch(catalog, {
              balanceProfiles: {
                [PROFILE.beguilingHazeFollowUp]: {
                  fields: { maximumStacks: 1 },
                  ...(removed ? { removeEffects: [{ type: 'strike', name: 'Beguiling Haze — Follow-Up' }] } : {})
                },
                [PROFILE.sharedWisdom]: { effects: [{ type: 'boon', name: 'beguiling-haze', stacks: 2 }] }
              }
            })
        }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(conduitState.from(runtime).beguilingHazeCharges, 0);
      assert.equal(runtime.ammo.get(skillId).maximum, 1);
      assert.ok(runtime.ammo.get(skillId).nextRechargeAt > runtime.time);
      const followUp = result.events.find(
        (event) => event.type === 'damage' && event.name === 'Beguiling Haze — Follow-Up'
      );
      assert.equal(Boolean(followUp), !removed);
      // Fury is a committed-cast reward even when the selected variant contains no strike.
      const lastFury = result.events.findLast((event) => event.type === 'buff' && event.kind === 'fury');
      assert.equal(lastFury.activationId, result.steps.at(-1).activationId);
      assert.equal(lastFury.stacks, 2);
    }
  }
});

test('Assassin Release snapshots each authored condition tick duration before later affinity changes', () => {
  const result = runRevenant(
    ['Release Potential: Assassin', wait],
    { ...config, startingLegend: LEGEND.ASSASSIN },
    {
      catalog: (catalog) =>
        withSkill(catalog, ID.RELEASE_POTENTIAL_ASSASSIN, {
          effects: catalog.skillsById.get(ID.RELEASE_POTENTIAL_ASSASSIN).effects.map((effect) =>
            effect.type === 'condition' && effect.condition === 'Crippled'
              ? {
                  ...effect,
                  // A timeline replaces aggregate application fields at the construction boundary.
                  condition: undefined,
                  stacks: undefined,
                  duration: undefined,
                  atMs: undefined,
                  intervalMs: undefined,
                  ticks: [
                    { atMs: 300, condition: 'Crippled', stacks: 1, duration: 3 },
                    { atMs: 800, condition: 'Crippled', stacks: 1, duration: 4 }
                  ]
                }
              : effect
          )
        }),
      initialize(runtime) {
        conduitState.from(runtime).affinity = 1;
        runtime.schedule('test.affinity', 0.1);
      },
      extend: (native) => ({
        tasks: {
          ...native.tasks,
          'test.affinity'(runtime) {
            conduitState.from(runtime).affinity = 5;
          }
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  const cripple = result.events.filter((event) => event.type === 'condition' && event.condition === 'Crippled');
  assert.deepEqual(
    cripple.map((event) => event.at),
    [0.3, 0.8]
  );
  for (const event of cripple) assert.ok(Math.abs(event.duration - (event.at === 0.3 ? 3 : 4) * 1.2) < 1e-9);
});

test('Mesmer Release keeps impact-time conditions independent of its ordinary strike and cancellation', () => {
  for (const mode of ['normal', 'removed-strike', 'cancelled']) {
    const result = runRevenant(
      [{ skillId: ID.RELEASE_POTENTIAL_MESMER, ...(mode === 'cancelled' ? { interruptMs: 0 } : {}) }, wait],
      { ...config, selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON], startingLegend: LEGEND.DEMON },
      {
        catalog: (catalog) =>
          withSkill(catalog, ID.RELEASE_POTENTIAL_MESMER, {
            effects: catalog.skillsById
              .get(ID.RELEASE_POTENTIAL_MESMER)
              .effects.filter((effect) => mode !== 'removed-strike' || effect.type !== 'strike')
          }),
        initialize(runtime) {
          conduitState.from(runtime).affinity = 5;
          runtime.schedule('test.affinity', 0.2);
        },
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'test.affinity'(runtime) {
              conduitState.from(runtime).affinity = 2;
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const packets = result.events.filter((event) => event.skillId === ID.RELEASE_POTENTIAL_MESMER);
    assert.equal(
      packets.some((event) => event.type === 'damage'),
      mode === 'normal'
    );
    assert.equal(
      packets.some((event) => event.type === 'control'),
      mode !== 'cancelled'
    );
    const torment = packets.filter((event) => event.type === 'condition');
    const self = observedRuntime(result).profession.core.selfConditions;
    assert.equal(torment.length, mode === 'cancelled' ? 0 : 1);
    assert.equal(self.length, mode === 'cancelled' ? 0 : 1);
    if (mode !== 'cancelled') {
      assert.ok(Math.abs(torment[0].duration - 3 * 1.2) < 1e-9);
      assert.ok(Math.abs(self[0].expiresAt - self[0].at - 8 * 0.7) < 1e-9);
    }
  }
});
