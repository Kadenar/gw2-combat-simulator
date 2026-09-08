import assert from 'node:assert/strict';
import test from 'node:test';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { recordPassiveRelicTimeline, relicStrikeMultiplier } from '#gw2/platform/equipment/relics/query.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { migrateGuardianBuild, validateGuardianBuild } from '#gw2/professions/guardian/build/build.js';

// Saved preparation is opt-in, survives JSON persistence, and rejects unsupported or duplicate selections.
test('precast relic selections migrate and validate independently of the combat relic', () => {
  assert.deepEqual(migrateGuardianBuild({}).precastRelics, []);
  const build = migrateGuardianBuild({
    relic: 'Thief',
    precastRelics: ['Mount Balrior', 'Director', 'Director', 'Thief']
  });
  assert.deepEqual(build.precastRelics, ['Director', 'Mount Balrior']);
  const restored = migrateGuardianBuild(JSON.parse(JSON.stringify(build)));
  assert.equal(restored.relic, 'Thief');
  assert.deepEqual(restored.precastRelics, build.precastRelics);
  assert.equal(validateGuardianBuild(restored).valid, true);
  for (const precastRelics of [null, 'Director', ['Thief'], ['Director', 'Director']]) {
    assert.match(validateGuardianBuild({ ...build, precastRelics }).errors.join(' '), /precastRelics/);
  }
});

test('both preparation buffs combine with the combat relic and stop triggering at Combat Start', () => {
  const procs = [];
  const ctx = {
    config: {
      relic: 'Claw',
      precastRelics: ['Director', 'Mount Balrior'],
      target: { conditions: { Vulnerability: 25 } }
    },
    relic: createRelicRuntime('Claw'),
    combatStartTime: 2,
    queue: [],
    recordProc: (...args) => procs.push(args)
  };
  ctx.relic.state.buffUntil = 10;
  const action = (at, skillType) => ({ type: 'action', at, endsAt: at, skillType, actorType: 'player' });
  recordPassiveRelicTimeline(
    ctx,
    [action(0, 'Elite'), action(0.5, 'Heal'), action(40, 'Elite'), action(41, 'Heal')],
    45
  );
  assert.equal(procs.length, 2);
  assert.ok(Math.abs(relicStrikeMultiplier(ctx, { at: 2, actorType: 'player' }) - 1.07 * 1.1 * 1.15) < 1e-10);
  assert.equal(relicStrikeMultiplier(ctx, { at: 8, actorType: 'player' }), 1.07);
  assert.equal(relicStrikeMultiplier(ctx, { at: 42, actorType: 'player' }), 1);
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
    assert.deepEqual(prepared.endState.cooldowns, ordinary.endState.cooldowns);

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
  const procs = [];
  const ctx = {
    config: { relic: '', precastRelics: ['Director'] },
    relic: createRelicRuntime(''),
    combatStartTime: 0,
    queue: [],
    recordProc: (...args) => procs.push(args)
  };
  const action = (eventOrder) => ({
    type: 'action',
    skillType: 'Heal',
    at: 0,
    endsAt: 0,
    actorType: 'player',
    eventOrder
  });
  const marker = { type: 'combat_start', at: 0, eventOrder: 1 };
  recordPassiveRelicTimeline(ctx, [marker, action(2)], 1);
  assert.equal(procs.length, 0);
  recordPassiveRelicTimeline(ctx, [action(0), marker], 1);
  assert.equal(procs.length, 1);
});

// Minimal completed casts isolate trigger eligibility, cooldown boundaries and half-open buff windows.
for (const [relic, skillType, cooldown, delay, multiplier] of [
  ['Director', 'Heal', 15, 0, 1.1],
  ['Mount Balrior', 'Elite', 30, 1, 1.15]
]) {
  test(`${relic} uses completed player casts and preserves precombat cooldowns`, () => {
    const procs = [];
    const ctx = {
      relic: createRelicRuntime(relic),
      config: { relic, precastRelics: [relic], target: { conditions: { Vulnerability: 1 } } },
      combatStartTime: 4,
      queue: [],
      recordProc: (...args) => procs.push(args)
    };
    const cast = (endsAt, overrides = {}) => ({
      type: 'action',
      at: endsAt - 0.5,
      endsAt,
      skillType,
      skillName: 'Trigger',
      actorType: 'player',
      ...overrides
    });
    recordPassiveRelicTimeline(
      ctx,
      [
        cast(0.5, { cancelled: true }),
        cast(0.6, { actorType: 'summon' }),
        cast(0.7, { skillType: 'Utility' }),
        cast(1),
        cast(2),
        cast(1 + cooldown),
        cast(1.001 + cooldown)
      ].reverse(),
      40
    );
    assert.deepEqual(
      procs.map((proc) => proc[2]),
      [1 + delay, 1.001 + cooldown + delay]
    );
    assert.equal(procs[0][7], 7 + delay);
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
      assert.ok(
        ctx.queue.every((event) => event.condition === 'Vulnerability' && event.stacks === 8 && event.duration === 8)
      );
      ctx.config.target.conditions = {};
      assert.equal(strike(4), 1);
    }
  });
}

// Real scheduler casts must carry their slot type and aim into relic effects without moving the DPS start.
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
    assert.ok(Math.abs(actual[0].damage / expected[0].damage - bonus) < 1e-10);
    assert.equal(actual.at(-1).damage, expected.at(-1).damage);
    const cast = result.events.find((event) => event.type === 'action' && event.skillName === skill);
    const proc = result.procSteps.find((step) => step.type === 'relic_proc');
    assert.equal(proc.start, Math.round((cast.endsAt + delay) * 1000));
    assert.equal(proc.expiresAt, proc.start + 6000);
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
  assert.ok(Math.abs(onTarget.strikeDamage / baseline.strikeDamage - 1.08 * 1.1) < 1e-10);
  assert.equal(offTarget.procSteps.filter((step) => step.type === 'relic_proc').length, 1);
});
