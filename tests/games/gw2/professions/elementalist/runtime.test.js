import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { evokerFamiliarLifecycle } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
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

// Finale must cancel pending contacts, including both conditions of a shared dual activation.
for (const [specialization, skillId] of [
  ['Core', ID.FLAME_WHEEL],
  ['Weaver', ID.DUAL_ORBITS_FIRE_AND_AIR]
]) {
  test(`Grand Finale cancels pending ${specialization} orb damage and conditions`, () => {
    const config = {
      specialization,
      primaryWeapon: 'Hammer',
      startAttunement: 'Fire',
      secondaryAttunement: 'Air',
      selectedTraitIds: []
    };
    const opening = { type: 'cast', skillId, impactDelayMs: 3000 };
    const baseline = runElementalist([opening, { type: 'wait', durationMs: 6000 }], config);
    const result = runElementalist(
      [
        opening,
        { type: 'wait', durationMs: 500 },
        { type: 'cast', skillId: ID.GRAND_FINALE },
        { type: 'wait', durationMs: 6000 }
      ],
      config
    );
    assert.deepEqual(baseline.warnings, []);
    assert.deepEqual(result.warnings, []);
    for (const type of ['damage', 'condition']) {
      const contacts = (run) => run.events.filter((event) => event.skillId === skillId && event.type === type);
      assert.ok(contacts(baseline).length > 0);
      assert.deepEqual(contacts(result), []);
    }
  });
}

// Finale retains accepted buffs across their original expiry, then retires them at its own deadline.
for (const expiryPhase of ['during cast', 'after commit']) {
  test(`Grand Finale refreshes orb buffs expiring ${expiryPhase}`, () => {
    const rotation = [
      { type: 'cast', skillId: ID.DUAL_ORBITS_FIRE_AND_AIR },
      { type: 'cast', skillId: ID.GRAND_FINALE },
      { type: 'wait', durationMs: 2000 }
    ];
    const config = {
      specialization: 'Weaver',
      primaryWeapon: 'Hammer',
      startAttunement: 'Fire',
      secondaryAttunement: 'Air',
      selectedTraitIds: []
    };
    const baseline = runElementalist(rotation, config);
    assert.deepEqual(baseline.warnings, []);
    const finale = baseline.steps.find((step) => step.skillId === ID.GRAND_FINALE);
    const opening = baseline.steps.find((step) => step.skillId === ID.DUAL_ORBITS_FIRE_AND_AIR);
    const impact = baseline.events.find((event) => event.type === 'damage' && event.skillId === ID.GRAND_FINALE);
    assert.ok(impact);
    const committedAt = finale.end / 1000;
    const originalExpiry = canonicalTime(
      expiryPhase === 'during cast' ? (finale.start / 1000 + committedAt) / 2 : (committedAt + impact.at) / 2
    );
    const expiresAt = canonicalTime(committedAt + 1);
    assert.ok(originalExpiry < impact.at);
    const sampledAt = canonicalTime((originalExpiry + (expiryPhase === 'during cast' ? committedAt : impact.at)) / 2);
    const timeline = [
      {
        at: sampledAt,
        run(runtime) {
          runtime.effects.emit(
            elementalistStrikeRequest(runtime.mechanics, {
              at: runtime.time,
              sourceId: ID.SINGEING_STRIKE,
              skillId: ID.SINGEING_STRIKE,
              skillName: 'Buff probe',
              actorType: 'player',
              coefficient: 1,
              canCrit: false,
              skillWeapon: 'Hammer',
              activationId: 'buff-probe'
            })
          );
        }
      }
    ];
    const control = runElementalist(rotation, config, { timeline });
    const seen = [];
    const result = runElementalist(rotation, config, {
      timeline,
      catalog: (catalog) =>
        applySkillPatch(catalog, {
          skills: {
            [ID.DUAL_ORBITS_FIRE_AND_AIR]: { fields: { orbDuration: originalExpiry - opening.end / 1000 } }
          }
        }),
      probes: [
        [
          canonicalTime((finale.start / 1000 + committedAt) / 2),
          (runtime) => {
            seen.push('prepared');
            for (const element of ['Fire', 'Air'])
              assert.ok(
                runtime.buffs.get(`hammer ${element.toLowerCase()} orb`).some((buff) => buff.expiresAt === expiresAt)
              );
          }
        ],
        [
          sampledAt,
          (runtime) => {
            seen.push('reserved');
            for (const element of ['Fire', 'Air'])
              assert.ok(
                runtime.buffs
                  .get(`hammer ${element.toLowerCase()} orb`)
                  .some((buff) => buff.at <= runtime.time && buff.expiresAt > runtime.time)
              );
          }
        ],
        [
          impact.at,
          (runtime) => {
            seen.push('impact');
            for (const element of ['Fire', 'Air']) {
              assert.equal(runtime.profession.core.hammerOrbs[element], null);
              const buffs = runtime.buffs.get(`hammer ${element.toLowerCase()} orb`);
              assert.ok(buffs.some((buff) => buff.at <= runtime.time && buff.expiresAt === expiresAt));
            }
          }
        ],
        [
          canonicalTime(expiresAt + 0.001),
          (runtime) => {
            seen.push('expired');
            for (const element of ['Fire', 'Air'])
              assert.equal(
                runtime.buffs
                  .get(`hammer ${element.toLowerCase()} orb`)
                  .some((buff) => buff.at <= runtime.time && buff.expiresAt > runtime.time),
                false
              );
          }
        ]
      ]
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(seen, ['prepared', 'reserved', 'impact', 'expired']);
    const projectiles = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.GRAND_FINALE);
    assert.deepEqual(
      projectiles.map((event) => event.name),
      ['Fire', 'Air']
    );
    const sampleDamage = (run) =>
      run.resolvedEvents.find((event) => event.type === 'damage' && event.activationId === 'buff-probe')?.damage;
    assert.ok(sampleDamage(control) > 0);
    assert.equal(sampleDamage(result), sampleDamage(control));
  });
}

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
