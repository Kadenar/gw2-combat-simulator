import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfession, loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { availableProcRateProfiles, normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import { validateCommonAssumptions } from '#gw2/platform/builds/assumptions.js';
import { procChanceFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { simulateGw2 } from '#gw2/platform/index.js';
import { skillBreakdownRows } from '#gw2/app/results/result-tables.js';

// Exercise each execution path with minimal opportunities, including Core traits under elite specializations.
const cases = [
  ['necromancer', 'Harbinger', 'Barbed Precision', ['Blood Is Power'], { selectedSkills: ['Blood Is Power'] }],
  ['engineer', 'Mechanist', 'Serrated Steel', ['Fragmentation Shot'], { primaryWeapon: 'Pistol' }],
  ['engineer', 'Scrapper', 'Shrapnel', ['Grenade Kit', 'Grenade'], { selectedSkills: ['Grenade Kit'] }],
  ['warrior', 'Berserker', 'Bloodlust', ['Sever Artery'], { primaryWeapon: 'Sword' }],
  ['elementalist', 'Tempest', 'Burning Precision', ['Fireball'], { primaryWeapon: 'Staff', startingAttunement: 'Fire' }]
];

test('proc overrides control every opted-in trait without bypassing selection or trigger eligibility', async () => {
  for (const [id, specialization, name, rotation, extra] of cases) {
    const profession = await loadProfession(id);
    const profile = profession.catalog.balanceProfiles.find((entry) => entry.name === name);
    const { id: key, traitId } = profile.procRate;
    const run = (rate, selected = true, precision = 3000, mode = 'deterministic') =>
      simulateGw2({
        profession,
        rotation,
        config: {
          specialization,
          ...extra,
          stats: { power: 2000, precision, conditionDamage: 1200 },
          target: { armor: 2597 },
          selectedTraitIds: selected ? [traitId] : [],
          randomness: { mode, seed: 1 },
          procRateOverrides: { [key]: rate }
        },
        observationPolicy: { kind: 'tail', durationMs: 7000 }
      });
    const applications = (result) => {
      assert.deepEqual(result.warnings, [], name);
      return result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === profile.id);
    };

    for (const mode of ['deterministic', 'stochastic']) {
      assert.equal(applications(run(0, true, 3000, mode)).length, 0, name);
      const fullRate = run(1, true, 3000, mode);
      assert.ok(applications(fullRate).length > 0, name);
      // One minimal trigger produces one proc; Grenade's three explosions produce three, regardless of ticks.
      assert.equal(
        skillBreakdownRows(fullRate).find((row) => row.name === name)?.hits,
        name === 'Shrapnel' ? 3 : 1,
        name
      );
    }

    assert.equal(applications(run(1, false)).length, 0, name);
    assert.equal(applications(run(1, true, 0)).length > 0, name === 'Shrapnel', name);
    const runtime = profession.resolveRuntime({ specialization });
    assert.deepEqual(availableProcRateProfiles(runtime.catalog, []), []);
    assert.ok(availableProcRateProfiles(runtime.catalog, [traitId]).some((entry) => entry.procRate.id === key));
  }
});

test('Burning Precision override preserves its internal cooldown', async () => {
  const profession = await loadProfession('elementalist');
  const profile = profession.catalog.balanceProfiles.find((entry) => entry.name === 'Burning Precision');
  const result = simulateGw2({
    profession,
    rotation: Array(12).fill('Fireball'),
    config: {
      specialization: 'Core',
      primaryWeapon: 'Staff',
      startingAttunement: 'Fire',
      stats: { power: 2000, precision: 3000 },
      selectedTraitIds: [profile.procRate.traitId],
      procRateOverrides: { [profile.procRate.id]: 1 }
    }
  });
  assert.deepEqual(result.warnings, []);
  const procs = result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === profile.id);
  assert.ok(procs.length > 1);
  for (let i = 1; i < procs.length; i++) assert.ok(procs[i].at - procs[i - 1].at >= profile.internalCooldown);
});

test('proc rate input preserves explicit zero and rejects malformed saved or headless probabilities', async () => {
  const valid = { 'engineer.shrapnel': 0, 'engineer.serrated-steel': 1, 'future.specialization-proc': 0.5 };
  assert.deepEqual(normalizeProcRateOverrides(valid), valid);
  assert.notEqual(normalizeProcRateOverrides(valid), valid);
  const profession = await loadProfession('engineer');
  for (const invalid of [
    null,
    [],
    '33',
    { 'engineer.shrapnel': -0.1 },
    { 'engineer.shrapnel': 1.1 },
    { 'engineer.shrapnel': NaN },
    { 'engineer.shrapnel': Infinity },
    { 'engineer.shrapnel': '0.33' }
  ]) {
    assert.throws(() => normalizeProcRateOverrides(invalid), /procRateOverrides/);
    assert.ok(validateCommonAssumptions({ procRateOverrides: invalid }).length);
    assert.throws(
      () => simulateGw2({ profession, rotation: [], config: { procRateOverrides: invalid } }),
      /procRateOverrides/
    );
  }
});

test('unset overrides follow patched defaults without mutating balance data', () => {
  const profile = { id: 1, procChance: 0.42, procRate: { id: 'example.proc', field: 'procChance' } };
  const context = { catalog: { balanceProfilesById: new Map([[1, profile]]) }, config: { procRateOverrides: {} } };
  assert.equal(procChanceFromContext(context, 1), 0.42);
  context.config.procRateOverrides['example.proc'] = 0;
  assert.equal(procChanceFromContext(context, 1), 0);
  delete context.config.procRateOverrides['example.proc'];
  assert.equal(procChanceFromContext(context, 1), 0.42);
  assert.equal(profile.procChance, 0.42);
});

test('proc rates round-trip with builds and become detached worker configuration', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  const original = adapter.toApplicationBuild({});
  original.assumptions.procRateOverrides = { 'engineer.shrapnel': 0, 'engineer.serrated-steel': 0.5 };
  const build = adapter.toApplicationBuild(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(build.assumptions.procRateOverrides, original.assumptions.procRateOverrides);
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillById: adapter.profession.catalog.skillsById,
    skillByName: adapter.profession.catalog.skillsByName,
    attributeWeaponSet: 1
  };
  adapter.recalculate(app);
  const config = adapter.simulationConfig(app);
  assert.deepEqual(config.procRateOverrides, original.assumptions.procRateOverrides);
  build.assumptions.procRateOverrides['engineer.shrapnel'] = 1;
  assert.equal(config.procRateOverrides['engineer.shrapnel'], 0);
  assert.equal(adapter.toApplicationBuild({}).assumptions.procRateOverrides, undefined);
});
