import assert from 'node:assert/strict';
import test from 'node:test';

import { attributeEffectControls, attributePreviewContext } from '#gw2/app/build/attribute-effects.js';
import {
  clearedValues,
  createSkillDamagePlan,
  simulationConfigValues,
  skillDamageControls
} from '#gw2/app/build/skill-damage/plan.js';
import { createSkillDamageViewModel } from '#gw2/app/build/skill-damage/view-model.js';
import { firstPresetBuildPath, headlessApp } from '#tests/helpers/skill-damage.js';

const BLADESWORN = 'data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json';
const HARBINGER = 'data/gw2/builds/necromancer/b-condi-harbinger.json';

test('planning and measuring skill damage never changes the build, its assumptions, or its attributes', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const build = structuredClone(app.build);
  const attributeData = app.attributeData;
  const controls = skillDamageControls(app);
  const values = { ...clearedValues(controls), might: 7, fury: 1, fierceAsFire: 4 };
  const plan = createSkillDamagePlan(app, controls, values);
  app.adapter.calculateSkillDamage({ ...plan.request, probes: plan.request.probes.slice(0, 3) });
  assert.deepEqual(app.build, build);
  assert.equal(app.attributeData, attributeData);
});

test('control scope keeps damage-only inputs out of the Attribute Preview', async () => {
  const bladesworn = await headlessApp('warrior', BLADESWORN);
  const harbinger = await headlessApp('necromancer', HARBINGER);
  const keys = (controls) => controls.map((control) => control.key);
  assert.ok(keys(skillDamageControls(bladesworn)).includes('fierceAsFire'));
  assert.ok(!keys(attributeEffectControls(bladesworn)).includes('fierceAsFire'));
  // Guns and Glory changes Ferocity, so it remains in both panels.
  assert.ok(keys(skillDamageControls(bladesworn)).includes('gunsAndGlory'));
  assert.ok(keys(attributeEffectControls(bladesworn)).includes('gunsAndGlory'));
  assert.ok(keys(skillDamageControls(harbinger)).includes('blight'));
  assert.ok(!keys(attributeEffectControls(harbinger)).includes('blight'));
});

test('preview values become probe boons, target conditions, held buffs, and profession fields', async () => {
  const app = await headlessApp('necromancer', HARBINGER);
  const controls = skillDamageControls(app);
  const values = { ...clearedValues(controls), might: 12, fury: 0, 'condition:Vulnerability': 9, blight: 20 };
  const { config } = createSkillDamagePlan(app, controls, values).request;
  assert.equal(config.boons.might, 12);
  assert.equal(config.boons.fury, false);
  assert.equal(config.target.conditions.Vulnerability, 9);
  assert.equal(config.initialBlight, 20);
  assert.equal(config.criticalDamageMode, 'averaged');
  assert.equal(config.randomness.mode, 'deterministic');

  const bladesworn = await headlessApp('warrior', BLADESWORN);
  const bladeswornControls = skillDamageControls(bladesworn);
  const held = createSkillDamagePlan(bladesworn, bladeswornControls, {
    ...clearedValues(bladeswornControls),
    fierceAsFire: 3
  }).request.config;
  assert.deepEqual(
    held.initialBuffs.map(({ kind, stacks }) => ({ kind, stacks })),
    [{ kind: 'fierce-as-fire', stacks: 3 }]
  );
});

test('the saved simulation assumptions seed the panel without being written back', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const controls = skillDamageControls(app);
  const values = simulationConfigValues(app, controls);
  assert.equal(values.might, app.build.assumptions.might);
  assert.equal(values.fury, Number(app.build.assumptions.fury));
  assert.equal(values['condition:Vulnerability'], app.build.assumptions.targetConditions.Vulnerability);
});

test('unslotted skills are measured with their own slot selection; slotted skills keep the build loadout', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const controls = skillDamageControls(app);
  const plan = createSkillDamagePlan(app, controls, clearedValues(controls));
  const rows = [...plan.rows.values()];
  const unslotted = rows.find((row) => row.status === 'unslotted');
  const slotted = rows.find((row) => row.groupId === 'slot' && row.status === 'equipped');
  const probe = (row) => plan.request.probes.find((candidate) => candidate.id === row.id);
  assert.ok(probe(unslotted).config.selectedSkills.includes(unslotted.name));
  assert.equal(probe(slotted).config.selectedSkills, undefined);
});

test('skills without damage and refused probes are left out of the table', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const controls = skillDamageControls(app);
  const plan = createSkillDamagePlan(app, controls, clearedValues(controls));
  const [first, second] = plan.groups.find((group) => group.kind === 'weapon').rowIds;
  const measurement = (total) => ({
    castSeconds: 1,
    hits: 1,
    coefficient: 1,
    strike: total,
    conditionDamage: 0,
    total,
    strikeBreakdown: null,
    conditions: []
  });
  const model = createSkillDamageViewModel(
    plan,
    {
      probes: [
        { id: first, measurement: measurement(0), variants: [] },
        { id: second, measurement: null, variants: [], rejected: 'Not now.' }
      ],
      procs: []
    },
    { filter: 'all', expanded: null, closedGroups: new Set(), targetArmor: 2597 }
  );
  assert.deepEqual(model.groups, []);
  assert.equal(model.counts.all, 0);
});

test('proc owners cover selected traits, the relic, sigils, and food, each with its icon', async () => {
  const app = await headlessApp('necromancer', HARBINGER);
  const controls = skillDamageControls(app);
  const { procOwners } = createSkillDamagePlan(app, controls, clearedValues(controls)).request;
  const sources = new Set(procOwners.map((owner) => owner.source));
  for (const source of ['Trait', 'Relic', 'Sigil', 'Food']) assert.ok(sources.has(source), source);
  assert.ok(
    procOwners.every((owner) => owner.icon),
    'every proc owner has an icon'
  );
  assert.ok(procOwners.some((owner) => owner.source === 'Trait' && owner.name === 'Dhuumfire'));
});

// Every profession family lists weapon and slot skills through the generic path; declared mechanic groups measure.
for (const [professionId, buildPath] of [
  ['elementalist'],
  ['engineer'],
  ['guardian'],
  ['mesmer'],
  ['necromancer'],
  ['necromancer', HARBINGER],
  ['ranger'],
  ['revenant'],
  ['thief'],
  ['warrior'],
  ['warrior', BLADESWORN]
]) {
  test(`${professionId} measures ${buildPath ?? "its first preset's"} skills`, async () => {
    const app = await headlessApp(professionId, buildPath ?? (await firstPresetBuildPath(professionId)));
    const controls = skillDamageControls(app);
    const plan = createSkillDamagePlan(app, controls, simulationConfigValues(app, controls));
    const evaluation = app.adapter.calculateSkillDamage(plan.request);
    const measured = new Map(
      evaluation.probes.filter((probe) => probe.measurement?.total > 0).map((probe) => [probe.id, probe])
    );
    const declared = new Set(
      app.profession.ui.skillDamageGroups(attributePreviewContext(app)).map((group) => `mechanic-${group.id}`)
    );
    for (const group of plan.groups) {
      if (group.kind !== 'weapon' && !declared.has(group.id)) continue;
      assert.ok(
        group.rowIds.some((rowId) => measured.has(rowId)),
        `${professionId} ${group.title} has no measured damage`
      );
    }
  });
}

// Each familiar row uses ordinary initial-state settings, independent of the saved charge pool.
test('Evoker measures both familiar forms using existing initial charge settings', async () => {
  const app = await headlessApp(
    'elementalist',
    'data/gw2/builds/elementalist/b-condi-alac-evoker-pistol-warhorn-elemental-balance.json'
  );
  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    app.build.evokerElement = element;
    app.build.initialEvokerCharges = 0;
    app.build.initialEvokerEmpowered = 3;
    app.adapter.recalculate(app);
    const saved = structuredClone(app.build);
    const controls = skillDamageControls(app);
    const plan = createSkillDamagePlan(app, controls, simulationConfigValues(app, controls));
    const ids = plan.groups.find((group) => group.id === 'mechanic-familiar').rowIds;
    const probes = plan.request.probes.filter((probe) => ids.includes(probe.id));
    const result = app.adapter.calculateSkillDamage({ ...plan.request, probes });
    assert.deepEqual(
      result.probes.map((probe) => probe.rejected),
      [undefined, undefined],
      element
    );
    assert.ok(
      result.probes.every((probe) => probe.measurement != null),
      element
    );
    assert.deepEqual(
      probes.map((probe) => probe.config.profession.initialEvokerEmpowered),
      [0, 3]
    );
    assert.deepEqual(app.build, saved);
  }
});

// Clear buffs must not inherit hidden boons or conditions from the simulation's saved assumptions.
test('cleared preview values remove saved assumptions without altering the build', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  app.build.assumptions.protection = true;
  app.build.assumptions.targetConditions.Weakness = 1;
  app.adapter.recalculate(app);
  const controls = skillDamageControls(app);
  const config = createSkillDamagePlan(app, controls, clearedValues(controls)).request.config;
  assert.equal(config.boons.protection, false);
  assert.equal(config.boons.might, 0);
  assert.equal(config.boons.fury, false);
  assert.deepEqual(config.target.conditions, {});
  assert.equal(app.build.assumptions.protection, true);
  assert.equal(app.build.assumptions.targetConditions.Weakness, 1);
});
