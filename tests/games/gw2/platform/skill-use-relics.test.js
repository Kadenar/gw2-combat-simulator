import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { relicStrikeMultiplier } from '#gw2/platform/equipment/relics/query.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { migrateGuardianBuild, validateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Minimal slot casts exercise live completion and activation timing without profession mechanics.
const slotProfession = defineProfession({
  id: 'slot-relic-fixture',
  name: 'Slot Relic Fixture',
  catalog: createCanonicalCatalog({
    generated: [
      ...['Heal', 'Elite', 'Utility'].flatMap((type, index) => [
        { id: 940000 + index * 2, name: type, type, castTimeMs: 500, effects: [] },
        { id: 940001 + index * 2, name: 'Instant ' + type, type, castTimeMs: 0, effects: [] }
      ]),
      {
        id: 940010,
        name: 'Strike',
        type: 'Weapon',
        weapon: 'Sword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      },
      { id: 940011, name: 'Control', type: 'Utility', castTimeMs: 0, effects: [{ type: 'control' }] }
    ]
  })
});

// Saved preparation is opt-in, survives JSON persistence, and rejects unsupported or duplicate selections.
test('precast relic selections migrate and validate independently of the combat relic', () => {
  assert.deepEqual(migrateGuardianBuild({}).precastRelics, []);
  const build = migrateGuardianBuild({
    relic: 'Thief',
    precastRelics: ['Mount Balrior', 'Brawler', 'Director', 'Director', 'Thief']
  });
  assert.deepEqual(build.precastRelics, ['Brawler', 'Director', 'Mount Balrior']);
  const restored = migrateGuardianBuild(JSON.parse(JSON.stringify(build)));
  assert.equal(restored.relic, 'Thief');
  assert.deepEqual(restored.precastRelics, build.precastRelics);
  assert.equal(validateGuardianBuild(restored).valid, true);
  for (const precastRelics of [null, 'Director', ['Thief'], ['Director', 'Director']]) {
    assert.match(validateGuardianBuild({ ...build, precastRelics }).errors.join(' '), /precastRelics/);
  }
});

// Real boon delivery must preserve preparation ordering, expiry, and a single runtime when Brawler stays equipped.
test('Brawler precasts carry their remaining buff into combat without reactivating after unequipping', () => {
  const profession = defineProfession({
    id: 'brawler-precast-fixture',
    name: 'Brawler Precast Fixture',
    catalog: createCanonicalCatalog({
      generated: [
        ...['Protection', 'Resolution'].map((boon, index) => ({
          id: 930100 + index,
          name: `Grant ${boon}`,
          type: 'Utility',
          castTimeMs: 0,
          effects: [{ type: 'boon', boon, duration: 2, stacks: 1 }]
        })),
        {
          id: 930102,
          name: 'Strike',
          type: 'Weapon',
          weapon: 'Sword',
          castTimeMs: 0,
          effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
        }
      ]
    })
  });
  const run = (rotation, relic = '', precastRelics = ['Brawler']) =>
    simulateGw2({ profession, rotation, config: { relic, precastRelics } });
  const procs = (result) => result.procSteps.filter((step) => step.skill === 'Relic of the Brawler');
  const hits = (result) => result.resolvedEvents.filter((event) => event.type === 'damage');
  for (const boon of ['Protection', 'Resolution']) {
    const rotation = [
      `Grant ${boon}`,
      '__combat_start',
      'Strike',
      { type: 'wait', durationMs: 4000 },
      'Strike',
      { type: 'wait', durationMs: 4001 },
      `Grant ${boon}`,
      'Strike'
    ];
    const baseline = hits(run(rotation, '', []));
    for (const relic of ['', 'Brawler']) {
      const result = run(rotation, relic);
      assert.deepEqual(result.warnings, []);
      assert.equal(procs(result).length, relic ? 2 : 1);
      assert.equal(procs(result)[0].expiresAt, 4000);
      const actual = hits(result);
      assertFlooredDamageMultiplier(actual[0].damage, baseline[0].damage, 1.1);
      assert.equal(actual[1].damage, baseline[1].damage);
      assertFlooredDamageMultiplier(actual[2].damage, baseline[2].damage, relic ? 1.1 : 1);
    }

    assert.equal(procs(run(rotation, 'Brawler', [])).length, 1);
    assert.equal(procs(run(['__combat_start', `Grant ${boon}`, 'Strike'])).length, 0);
    assert.equal(procs(run([`Grant ${boon}`, 'Strike'])).length, 0);
    const elapsed = run([`Grant ${boon}`, { type: 'wait', durationMs: 4000 }, '__combat_start', 'Strike']);
    assert.equal(hits(elapsed)[0].damage, baseline[0].damage);
  }
});

test('both preparation buffs combine with the combat relic and stop triggering at Combat Start', () => {
  const config = {
    relic: 'Claw',
    precastRelics: ['Director', 'Mount Balrior'],
    target: { conditions: { Vulnerability: 25 } }
  };
  const rotation = [
    'Elite',
    'Heal',
    { type: 'wait', durationMs: 1000 },
    '__combat_start',
    'Control',
    'Strike',
    { type: 'wait', durationMs: 6000 },
    'Strike',
    { type: 'wait', durationMs: 32000 },
    'Elite',
    'Heal',
    { type: 'wait', durationMs: 1000 },
    'Strike'
  ];
  const result = simulateGw2({ profession: slotProfession, config, rotation });
  const baseline = simulateGw2({
    profession: slotProfession,
    config: { ...config, relic: '', precastRelics: [] },
    rotation
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(baseline.warnings, []);
  const hits = (simulation) => simulation.resolvedEvents.filter((event) => event.type === 'damage');
  for (const [index, multiplier] of [1.07 * 1.1 * 1.15, 1.07, 1].entries())
    assertFlooredDamageMultiplier(hits(result)[index].damage, hits(baseline)[index].damage, multiplier);
  assert.equal(
    result.procSteps.filter((step) => ['Relic of the Director', 'Relic of Mount Balrior'].includes(step.skill)).length,
    2
  );
});

for (const [relic, skill] of [
  ['Director', 'Ether Feast'],
  ['Mount Balrior', 'Mass Invisibility']
]) {
  test(`${relic} requires explicit preparation selection and still triggers normally in combat`, () => {
    const config = { relic, target: { health: 0, conditions: { Vulnerability: 25 } } };
    const rotation = [
      skill,
      '__combat_start',
      'Flying Cutter',
      { type: 'wait', durationMs: 40000 },
      skill,
      { type: 'wait', durationMs: 2000 },
      'Flying Cutter'
    ];
    const ordinary = simulateMesmer(rotation, config);
    const prepared = simulateMesmer(rotation, { ...config, precastRelics: [relic] });
    const procs = (result) => result.procSteps.filter((step) => step.type === 'relic_proc');
    assert.equal(procs(ordinary).length, 1);
    assert.ok(procs(ordinary)[0].start >= ordinary.combatStartTime * 1000);
    assert.equal(procs(prepared).length, 2);
    assert.deepEqual(prepared.planningState.cooldowns, ordinary.planningState.cooldowns);

    const noMarker = simulateMesmer([skill, { type: 'wait', durationMs: 2000 }, 'Flying Cutter'], {
      ...config,
      relic: '',
      precastRelics: [relic]
    });
    assert.equal(procs(noMarker).length, 0);
    const noAction = simulateMesmer(['__combat_start', 'Flying Cutter'], { ...config, precastRelics: [relic] });
    assert.equal(procs(noAction).length, 0);
  });
}

test('instant preparation at the combat timestamp respects marker ordering', () => {
  for (const [rotation, expected] of [
    [['__combat_start', 'Instant Heal'], 0],
    [['Instant Heal', '__combat_start'], 1]
  ]) {
    const result = simulateGw2({ profession: slotProfession, config: { precastRelics: ['Director'] }, rotation });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.procSteps.filter((step) => step.skill === 'Relic of the Director').length, expected);
  }
});

// Minimal completed casts isolate trigger eligibility, cooldown boundaries and half-open buff windows.
for (const [relic, skillType, cooldown, delay, multiplier] of [
  ['Director', 'Heal', 15, 0, 1.1],
  ['Mount Balrior', 'Elite', 30, 1, 1.15]
]) {
  test(`${relic} uses completed player casts and preserves precombat cooldowns`, () => {
    const config = { relic, precastRelics: [relic], target: { conditions: { Vulnerability: 1 } } };
    const result = observeGw2Runtime({
      profession: slotProfession.runtimeFor(config),
      config,
      rotation: [
        { type: 'cast', skillId: slotProfession.catalog.skillsByName.get(skillType).id, interruptAfterMs: 0 },
        'Instant Utility',
        { type: 'wait', durationMs: 500 },
        skillType,
        'Instant ' + skillType,
        { type: 'wait', durationMs: 3000 },
        '__combat_start',
        { type: 'wait', durationMs: (cooldown - 3) * 1000 },
        'Instant ' + skillType,
        { type: 'wait', durationMs: 1 },
        'Instant ' + skillType,
        { type: 'wait', durationMs: 2000 }
      ]
    });
    assert.deepEqual(result.warnings, []);
    const ctx = observedRuntime(result);
    const procs = result.procSteps.filter(
      (step) => step.skill === 'Relic of the ' + relic || step.skill === 'Relic of ' + relic
    );
    // A summon completion cannot claim a player relic even once its cooldown is ready.
    const readyAt = ctx.relic.state.readyAt;
    invokeRelicHook(ctx, 'completed', { type: 'action', at: 100, skillType, actorType: 'summon' });
    assert.equal(ctx.relic.state.readyAt, readyAt);

    assert.deepEqual(
      procs.map((proc) => proc.start),
      [(1 + delay) * 1000, (1 + cooldown + delay) * 1000 + 1]
    );
    assert.equal(procs[0].expiresAt / 1000, 7 + delay);
    const strike = (at, overrides = {}) =>
      relicStrikeMultiplier(ctx, {
        type: 'damage',
        at,
        actorType: 'player',
        ...overrides
      });
    assert.equal(strike(1 + delay - 0.001), 1);
    assert.equal(strike(1 + delay), multiplier);
    assert.equal(strike(4), multiplier);
    assert.equal(strike(7 + delay), 1);
    assert.equal(strike(4, { actorType: 'summon' }), 1);
    assert.equal(strike(4, { actorType: 'effect', ownerActorType: 'player' }), multiplier);
    if (relic === 'Director') {
      const applications = result.resolvedEvents.filter(
        (event) => event.type === 'condition' && event.sourceId === 'relic.director'
      );
      assert.ok(applications.length > 0);
      assert.ok(
        applications.every((event) => event.condition === 'Vulnerability' && event.stacks === 8 && event.duration === 8)
      );
      assert.equal(
        relicStrikeMultiplier(
          { relic: ctx.relic, config: { target: { conditions: {} } } },
          { at: 4, actorType: 'player' }
        ),
        1
      );
    }
  });
}

// Real runtime casts must carry their slot type and aim into relic effects without moving the DPS start.
for (const [relic, skill, delay, bonus] of [
  ['Director', 'Ether Feast', 0, 1.1],
  ['Mount Balrior', 'Mass Invisibility', 1, 1.15]
]) {
  test(`${relic} precasts retain only the remaining six-second buff`, () => {
    const config = { relic: '', precastRelics: [relic], target: { health: 0, conditions: { Vulnerability: 25 } } };
    const rotation = [
      skill,
      { type: 'wait', durationMs: 2000 },
      '__combat_start',
      'Flying Cutter',
      { type: 'wait', durationMs: 7000 },
      'Flying Cutter'
    ];
    const result = simulateMesmer(rotation, config);
    const baseline = simulateMesmer(rotation, { ...config, precastRelics: [] });
    assert.deepEqual(result.warnings, []);
    const hits = (simulation) => simulation.resolvedEvents.filter((event) => event.type === 'damage');
    const actual = hits(result);
    const expected = hits(baseline);
    assertFlooredDamageMultiplier(actual[0].damage, expected[0].damage, bonus);
    assert.equal(actual.at(-1).damage, expected.at(-1).damage);
    const cast = result.events.find((event) => event.type === 'action' && event.skillName === skill);
    const proc = result.procSteps.find((step) => step.type === 'relic_proc');
    assert.equal(proc.start, Math.round((cast.endsAt + delay) * 1000));
    assert.equal(proc.expiresAt % 40, 0);
    assert.ok(proc.expiresAt - proc.start >= 6000 && proc.expiresAt - proc.start < 6040);
    assert.ok(proc.start < result.combatStartTime * 1000);
    assert.equal(result.dpsStartTime, baseline.dpsStartTime);
  });
}

test('Director off-target precasts grant the buff without preloading vulnerability', () => {
  const rotation = (offTarget) => [
    { name: 'Ether Feast', offTarget },
    '__combat_start',
    'Flying Cutter',
    { type: 'wait', durationMs: 9000 }
  ];
  const config = {
    relic: '',
    precastRelics: ['Director'],
    stats: { expertise: 0 },
    target: { health: 0, conditions: {} }
  };
  const onTarget = simulateMesmer(rotation(false), config);
  const offTarget = simulateMesmer(rotation(true), config);
  const baseline = simulateMesmer(rotation(true), { ...config, precastRelics: [] });
  const applications = onTarget.resolvedEvents.filter((event) => event.sourceId === 'relic.director');
  assert.equal(applications.length, 1);
  assert.equal(applications[0].stacks, 8);
  assert.equal(applications[0].effectiveDuration, 8);
  assert.equal(
    offTarget.resolvedEvents.some((event) => event.sourceId === 'relic.director'),
    false
  );
  assert.equal(offTarget.strikeDamage, baseline.strikeDamage);
  assertFlooredDamageMultiplier(onTarget.strikeDamage, baseline.strikeDamage, 1.08 * 1.1);
  assert.equal(offTarget.procSteps.filter((step) => step.type === 'relic_proc').length, 1);
});
