import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist, runNative } from '#tests/helpers/elementalist-simulation.js';
import { runtimeFor } from '#tests/helpers/live-runtime.js';
import { emitElementalistDamage } from '#gw2/professions/elementalist/core/live-events.js';
import { evokerLive } from '#gw2/professions/elementalist/specializations/evoker/live.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';

// Queuing a hostile packet cannot fund a sphere; only the accepted impact earns energy.
test('Catalyst energy ignores missed packets and arrives at the accepted impact', () => {
  const result = runElementalist({
    config: { specialization: 'Catalyst', initialCatalystEnergy: 0, autoSummonElemental: false },
    rotation: [{ type: 'wait', durationMs: 2000 }],
    initialize(runtime) {
      for (const [at, offTarget] of [
        [0.5, true],
        [1, false]
      ])
        emitElementalistDamage(runtime, {
          at,
          offTarget,
          coefficient: 1,
          actorType: 'player',
          skillId: 42,
          skillName: 'Fixture',
          skillWeapon: 'Unequipped'
        });
    },
    timeline: [{ at: 0.75, run: (runtime) => assert.equal(runtime.profession.specialization.state.energy, 0) }]
  });
  assert.equal(runtimeFor(result).profession.specialization.state.energy, 1);
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

// A cancelled familiar cannot strand completed weapon grants behind its abandoned charge reset.
test('interrupting a familiar releases deferred weapon charges once', () => {
  const result = runElementalist({
    config: { specialization: 'Evoker', initialEvokerCharges: 0 },
    rotation: [],
    initialize(runtime) {
      const state = runtime.profession.specialization.state;
      state.activeFamiliarCast = { reservationId: 'familiar', endsAt: 1, resetsCharges: true };
      state.pendingWeaponChargeGains = [{ activationId: 'weapon', at: 0, source: 'Weapon', sourceId: 42, gain: 2 }];
      const cast = {
        id: 'familiar',
        skill: elementalistCatalog.skillsByName.get('Ignite'),
        start: 0,
        fullEnd: 1,
        effectiveEnd: 0,
        command: {}
      };
      evokerLive.onCastComplete(runtime, cast);
      evokerLive.onCastComplete(runtime, cast);
      assert.equal(state.activeFamiliarCast, null);
      assert.deepEqual(state.pendingWeaponChargeGains, []);
    }
  });
  assert.equal(runtimeFor(result).profession.specialization.state.charges, 2);
});

// Output retention must not change live reaction state or total damage.
test('Elementalist score output agrees with detailed execution', () => {
  const options = {
    config: {
      specialization: 'Weaver',
      primaryWeapon: 'Sword',
      startAttunement: 'Fire',
      secondaryAttunement: 'Air',
      autoSummonElemental: false
    },
    rotation: ['Pyro Vortex', { type: 'wait', durationMs: 3000 }]
  };
  const detailed = runElementalist(options),
    score = runElementalist({ ...options, output: 'score' });
  assert.deepEqual(detailed.warnings, []);
  assert.ok(detailed.totalDamage > 0);
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.deepEqual(runtimeFor(score).profession, runtimeFor(detailed).profession);
});
