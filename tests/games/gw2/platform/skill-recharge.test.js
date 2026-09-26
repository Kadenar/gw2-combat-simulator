import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';

// Minimal recharges isolate permanent Alacrity and tick detection from profession rotations.
test('cooldowns and serial ammo assume permanent Alacrity before checking the absolute tick', () => {
  const profession = defineProfession({
    id: 'alacrity-recharge',
    name: 'Alacrity recharge',
    catalog: createCanonicalCatalog({
      generated: [
        { id: 990001, name: 'Cooldown', castTimeMs: 0, cooldown: 10, effects: [] },
        {
          id: 990002,
          name: 'Alacrity',
          castTimeMs: 0,
          effects: [{ type: 'boon', boon: 'Alacrity', duration: 4, stacks: 1 }]
        },
        { id: 990003, name: 'Ammo', castTimeMs: 0, ammo: 2, ammoRecharge: 10, effects: [] }
      ]
    })
  });
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  for (const [rotation, boons, expected] of [
    [['Cooldown', 'Cooldown'], {}, 8],
    [['Cooldown', 'Cooldown'], { alacrity: false }, 8],
    [['Cooldown', 'Cooldown'], { alacrity: true }, 8],
    [['Cooldown', wait(2000), 'Alacrity', 'Cooldown'], {}, 8],
    [['Alacrity', 'Cooldown', 'Cooldown'], {}, 8],
    [['Cooldown', 'Alacrity', wait(6000), 'Alacrity', 'Cooldown'], {}, 8],
    [['Ammo', 'Ammo', wait(2000), 'Alacrity', 'Ammo'], {}, 8]
  ]) {
    const result = simulateGw2({ profession, rotation, config: { boons } });
    const action = result.events.findLast((event) => event.type === 'action');
    assert.equal(action.at, expected, JSON.stringify(rotation));
    assert.deepEqual(result.warnings, []);
  }
});

// Transient grants cannot change the permanent recharge rate or the independent ammo lockout.
test('Alacrity gained during a cast leaves reserved recharge and the independent ammo lockout unchanged', () => {
  for (const ammo of [false, true]) {
    const profession = defineProfession({
      id: 'reserved-recharge',
      name: 'Reserved Recharge',
      catalog: createCanonicalCatalog({
        generated: [
          {
            id: 990011,
            name: 'Reserved',
            castTimeMs: 2000,
            cooldown: 20,
            effects: [],
            ...(ammo ? { ammo: 2, ammoRecharge: 20, ammoCastLockout: 5 } : {})
          }
        ]
      })
    });
    const result = simulateGw2({
      profession: {
        runtimeFor(config) {
          return {
            ...profession.runtimeFor(config),
            initialize(runtime) {
              runtime.emit({
                type: 'buff',
                kind: 'alacrity',
                at: 1,
                duration: 4,
                stacks: 1,
                source: 'fixture',
                sourceId: 'fixture',
                actorType: 'player'
              });
            },
            onCastComplete(runtime, cast) {
              if (cast.start !== 0) return;
              if (ammo) {
                assert.equal(runtime.ammo.get(990011).nextRechargeAt, 18);
                assert.equal(runtime.ammo.get(990011).lockoutReadyAt, 6);
              } else assert.equal(runtime.cooldowns.get(990011), 18);
            }
          };
        }
      },
      rotation: ['Reserved', 'Reserved']
    });
    assert.equal(result.events.findLast((event) => event.type === 'action').at, ammo ? 6 : 18);
    assert.deepEqual(result.warnings, []);
  }
});

test('cooldown detection uses the exact next tick without an early-readiness epsilon', () => {
  for (const [raw, expected] of [
    [0.38, 0.4],
    [0.4, 0.4],
    [0.400001, 0.44],
    [-0.38, -0.36]
  ]) {
    assert.equal(gw2CooldownReadyAt(raw), expected);
  }
});

// Sub-tick completion never releases a cast early, and each serial charge starts at its detection tick.
test('ordinary and ammo cooldowns wait for their detection tick even one microsecond before it', () => {
  for (const ammo of [false, true]) {
    const skill = {
      id: 990010,
      name: 'Tick cooldown',
      castTimeMs: 0,
      cooldown: 0.475,
      ...(ammo ? { ammo: 2, ammoRecharge: 0.475, ammoCastLockout: 0 } : {}),
      effects: []
    };
    const profession = defineProfession({
      id: 'tick-cooldown',
      name: 'Tick cooldown',
      catalog: createCanonicalCatalog({ generated: [skill] })
    });
    const result = simulateGw2({
      profession,
      rotation: [
        skill.name,
        ...(ammo ? [skill.name] : []),
        { type: 'wait', durationMs: 399.999 },
        skill.name,
        skill.name
      ]
    });
    assert.deepEqual(
      result.events
        .filter((event) => event.type === 'action')
        .slice(-2)
        .map((event) => event.at),
      [0.4, 0.8]
    );
  }
});

test('GW2 base recharge selects positive ammo recharge before cooldown fields', () => {
  assert.equal(gw2BaseRecharge({ ammo: 2, ammoRecharge: 8, cooldown: 10 }), 8);
  assert.equal(gw2BaseRecharge({ ammo: 2, ammoRecharge: 0, cooldown: 10 }), 10);
  assert.equal(gw2BaseRecharge({ ammo: 2, ammoRecharge: -8, cooldown: 10 }), 10);
  assert.equal(gw2BaseRecharge({ ammo: 2, ammoRecharge: Number.POSITIVE_INFINITY, cooldown: 12 }), 12);
  assert.equal(gw2BaseRecharge({ ammo: 0, ammoRecharge: 8, cooldown: 10 }), 10);
});

test('GW2 base recharge accepts finite cooldowns and defaults missing or invalid values to zero', () => {
  assert.equal(gw2BaseRecharge({ cooldown: 10 }), 10);
  assert.equal(gw2BaseRecharge({ cooldown: 0 }), 0);
  assert.equal(gw2BaseRecharge({ ammo: 2, ammoRecharge: 0, cooldown: 0 }), 0);
  assert.equal(gw2BaseRecharge({ cooldown: Number.NaN }), 0);
  assert.equal(gw2BaseRecharge({ cooldown: Number.POSITIVE_INFINITY }), 0);
  assert.equal(gw2BaseRecharge({}), 0);
});

// Each spent charge recovers independently of the between-cast lockout.
test('Warrior ammo preserves charge recovery and its independent cast lockout', () => {
  const config = { selectedSkills: ['Throw Bolas'] };
  const native = warriorProfession.runtimeFor(config);
  const skill = native.catalog.skillsByName.get('Throw Bolas');
  const seen = [];
  const result = simulateGw2({
    profession: {
      runtimeFor: () => ({
        ...native,
        onCastComplete(runtime, cast) {
          native.onCastComplete?.(runtime, cast);
          if (cast.skill.id === skill.id)
            seen.push({ start: cast.start, end: cast.effectiveEnd, ammo: { ...runtime.ammo.get(skill.id) } });
        }
      })
    },
    config,
    rotation: [skill.id, skill.id, skill.id]
  });
  assert.equal(seen[0].ammo.charges, 1);
  assert.equal(seen[0].ammo.nextRechargeAt, seen[0].end + 12.8);
  assert.equal(seen[1].start, gw2CooldownReadyAt(seen[0].end + 0.8));
  assert.equal(seen[1].ammo.charges, 0);
  assert.equal(seen[2].start, gw2CooldownReadyAt(seen[0].end + 12.8));
  assert.deepEqual(result.warnings, []);
});

test('declarative ammo consumes and recharges shared charges', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930001,
        name: 'Fixture Ammo',
        type: 'Utility',
        castTimeMs: 0,
        cooldown: 0.25,
        ammoCastLockout: 0.25,
        ammo: 2,
        ammoRecharge: 5,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'ammo-fixture',
    name: 'Ammo Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Ammo', 'Fixture Ammo', { type: 'wait', durationMs: 5000 }]
  });

  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 2);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.at),
    [0, 0.2]
  );
  assert.deepEqual(result.planningState.ammo['Fixture Ammo'], {
    charges: 1,
    maximum: 2,
    rechargeWork: 5,
    nextRechargeAt: 8,
    lockoutReadyAt: 0.4
  });
});

// End-state resources and cooldowns must use the same clock while tail damage remains observable.
test('end state projects ammo and cooldowns at the resolution boundary', () => {
  const skill = {
    id: 930003,
    name: 'Tail Ammo',
    type: 'Utility',
    castTimeMs: 0,
    cooldown: 30,
    ammoCastLockout: 30,
    ammo: 2,
    ammoRecharge: 20,
    effects: [0, 2000].map((atMs) => ({
      type: 'strike',
      coefficient: 0,
      flatDamage: 100,
      atMs,
      timingAnchor: 'castStart',
      timingScale: 'fixed'
    }))
  };
  const profession = defineProfession({
    id: 'tail-ammo-fixture',
    name: 'Tail Ammo Fixture',
    catalog: createCanonicalCatalog({ generated: [skill] })
  });
  let rotationDamage;
  for (const [observationPolicy, time, charges] of [
    [undefined, 1000, 1],
    [{ kind: 'tail', durationMs: 0 }, 1000, 1],
    [{ kind: 'tail', durationMs: 10000 }, 11000, 1],
    [{ kind: 'tail', durationMs: 20000 }, 21000, 2],
    [{ kind: 'absolute', endTimeMs: 21000 }, 21000, 2]
  ]) {
    const result = simulateGw2({
      profession,
      rotation: ['Tail Ammo', { type: 'wait', durationMs: 1000 }],
      observationPolicy
    });
    assert.equal(result.rotationEndTime, 1);
    assert.equal(result.planningState.atSeconds * 1000, time);
    assert.equal(result.planningState.ammo[skill.name].charges, charges);
    assert.equal(result.planningState.ammoBySkillId[skill.id].charges, charges);
    assert.deepEqual(result.planningState.cooldowns[skill.name], { readyAt: 24000, remaining: 24000 - time });
    rotationDamage ??= result.totalDamage;
    assert.ok(rotationDamage > 0);
    assert.equal(result.totalDamage, rotationDamage * (time > 1000 ? 2 : 1));
  }
});

// Deadlines retain exact wall time while the next activation waits for its detection tick.
test("shared scheduler detects a skill's cooldown expiry on the next action tick", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930002,
        name: 'Fixture Cooldown',
        type: 'Utility',
        castTimeMs: 0,
        cooldown: 0.375,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'cooldown-fixture',
    name: 'Cooldown Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Cooldown', 'Fixture Cooldown']
  });
  const actions = result.events.filter((event) => event.type === 'action');

  assert.deepEqual(
    actions.map((event) => event.at),
    [0, 0.32]
  );
  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 320]
  );
  assert.equal(result.planningState.atSeconds * 1000, 320);
  assert.equal(result.planningState.cooldowns['Fixture Cooldown'].readyAt, 640);
  assert.deepEqual(result.warnings, []);
});
