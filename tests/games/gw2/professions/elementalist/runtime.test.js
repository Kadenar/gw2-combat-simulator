import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { evokerFamiliarLifecycle } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { runElementalist, runNative } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Queuing a hostile packet cannot fund a sphere; only the accepted impact earns energy.
test('Catalyst energy ignores missed packets and arrives at the accepted impact', () => {
  const result = runElementalist(
    [{ type: 'wait', durationMs: 2000 }],
    { specialization: 'Catalyst', initialCatalystEnergy: 0 },
    {
      initialize(runtime) {
        for (const [at, offTarget] of [
          [0.5, true],
          [1, false]
        ])
          runtime.effects.emit(
            elementalistStrikeRequest(runtime, {
              at,
              offTarget,
              coefficient: 1,
              actorType: 'player',
              skillId: 42,
              skillName: 'Fixture',
              skillWeapon: 'Unequipped'
            })
          );
      },
      timeline: [
        { at: 0.75, run: (runtime) => assert.equal(runtime.profession.specialization.state.catalystEnergy.value, 0) }
      ]
    }
  );
  assert.equal(observedRuntime(result).profession.specialization.state.catalystEnergy.value, 1);
  assert.equal(result.events.find((event) => event.kind === 'catalyst-energy').at, 1);
});

// Grand Finale retires the shared activation of both dual orbs, including their condition packets.
test('Grand Finale cancels pending Weaver dual-orb contacts', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    weapons: ['Hammer', ''],
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    rotation: ['Dual Orbits: Fire and Air', 2000, 'Grand Finale', 6000]
  });
  assert.deepEqual(result.warnings, []);
  const orb = result.events.find((event) => event.type === 'action' && event.skillName === 'Dual Orbits: Fire and Air');
  const finale = result.events.find((event) => event.type === 'action' && event.skillName === 'Grand Finale');
  const contacts = result.events.filter(
    (event) => ['damage', 'condition'].includes(event.type) && event.activationId === orb.activationId
  );
  assert.ok(contacts.length > 0);
  assert.ok(contacts.every((event) => event.at <= finale.at));
});

// Eligibility is captured before orb consumption, while later orb changes cannot add projectiles to the cast.
test('Grand Finale snapshots active orbs and resolves each condition stack separately', () => {
  const result = runElementalist(
    ['Grand Finale', { type: 'wait', durationMs: 2000 }],
    {
      specialization: 'Core',
      primaryWeapon: 'Hammer',
      startAttunement: 'Fire',
      selectedTraitIds: []
    },
    {
      initialize(runtime) {
        Object.assign(runtime.profession.core.hammerOrbs, { Fire: 10, Water: -1, Air: null, Earth: 10 });
      },
      timeline: [
        {
          at: 1,
          run(runtime) {
            assert.equal(runtime.profession.core.hammerOrbs.Fire, null);
            assert.equal(runtime.profession.core.hammerOrbs.Earth, null);
            runtime.profession.core.hammerOrbs.Water = 10;
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter((event) => event.skillId === ID.GRAND_FINALE);
  assert.deepEqual(
    packets.filter((event) => event.type === 'damage').map((event) => event.name),
    ['Fire', 'Earth']
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.skillId === ID.GRAND_FINALE && event.type === 'condition')
      .map((event) => [event.condition, event.stacks]),
    [['Burning', 1], ['Burning', 1], ...Array.from({ length: 4 }, () => ['Bleeding', 1])]
  );
  const finishers = packets.filter((event) => event.type === 'combo_finisher');
  assert.equal(new Set(finishers.map((event) => event.attemptId)).size, 2);
});

// Cancelling the spender must retain its orbs and their pending contacts without firing any finale effects.
test('cancelled Grand Finale preserves the active orb and its attacks', () => {
  const result = runElementalist(
    [
      'Flame Wheel',
      { type: 'cast', skillId: ID.GRAND_FINALE, interruptAfterMs: 0 },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      specialization: 'Core',
      primaryWeapon: 'Hammer',
      startAttunement: 'Fire',
      selectedTraitIds: []
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(observedRuntime(result).profession.core.hammerOrbs.Fire > 0);
  assert.ok(result.events.some((event) => event.skillId === ID.FLAME_WHEEL && event.type === 'damage'));
  assert.equal(
    result.events.some((event) => event.skillId === ID.GRAND_FINALE && ['damage', 'condition'].includes(event.type)),
    false
  );
});

// Real lifecycle admission and weapon completion create the deferred grant before cancellation.
test('interrupting a familiar releases deferred weapon charges once', () => {
  const result = runElementalist(
    [],
    { specialization: 'Evoker', initialEvokerCharges: 0, evokerElement: 'Fire', selectedTraitIds: [] },
    {
      initialize(runtime) {
        const skill = elementalistCatalog.skillsById.get(ID.IGNITE);
        const cast = { id: 'familiar', skill, start: 0, fullEnd: 1, effectiveEnd: 1, command: {} };
        evokerFamiliarLifecycle.sideEffectHandlers['elementalist.evoker.begin-familiar'](runtime, {
          kind: 'cast',
          cast,
          skill
        });
        evokerFamiliarLifecycle.onCastCommit(runtime, {
          id: 'weapon',
          skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE),
          start: 0,
          fullEnd: 0,
          effectiveEnd: 0,
          command: {}
        });
        assert.equal(runtime.resourceController.value('familiarCharges'), 0);
        evokerFamiliarLifecycle.onCastCancel(runtime, cast);
        evokerFamiliarLifecycle.onCastCancel(runtime, cast);
        assert.equal(evokerFamiliarLifecycle.availability(runtime, skill).retryAt, null);
      }
    }
  );
  assert.equal(observedRuntime(result).profession.specialization.state.familiarCharges.value, 2);
  assert.equal(
    result.events.filter((event) => event.kind === 'evoker-charges' && event.activationId === 'weapon').length,
    1
  );
});

// The declared reset precedes the grant, whose event retains its original weapon attribution.
test('deferred weapon charges report the actual flush time once', () => {
  const skill = elementalistCatalog.skillsById.get(ID.IGNITE);
  const cast = { id: 'familiar', skill, start: 0, fullEnd: 2, effectiveEnd: 2, command: {} };
  const result = runElementalist(
    [{ type: 'wait', durationMs: 3000 }],
    { specialization: 'Evoker', initialEvokerCharges: 0, evokerElement: 'Fire', selectedTraitIds: [] },
    {
      initialize(runtime) {
        evokerFamiliarLifecycle.sideEffectHandlers['elementalist.evoker.begin-familiar'](runtime, {
          kind: 'cast',
          cast,
          skill
        });
        evokerFamiliarLifecycle.onCastCommit(runtime, {
          id: 'weapon',
          skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE),
          start: 0,
          fullEnd: 0,
          effectiveEnd: 0,
          command: {}
        });
        assert.equal(runtime.resourceController.value('familiarCharges'), 0);
      },
      timeline: [
        {
          at: 2,
          run(runtime) {
            const type = 'elementalist.evoker.settle-basic-familiar';
            evokerFamiliarLifecycle.sideEffectHandlers[type](runtime, { kind: 'cast', cast, skill }, { type });
            evokerFamiliarLifecycle.onCastCommit(runtime, cast);
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const grants = result.events.filter((event) => event.type === 'resource' && event.activationId === 'weapon');
  assert.equal(grants.length, 1);
  assert.equal(grants[0].at, 2);
  assert.equal(grants[0].sourceId, ID.BLAZING_BARRAGE);
  assert.equal(grants[0].change, 2);
});
