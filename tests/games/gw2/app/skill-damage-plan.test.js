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
import { calculateSkillDamageAttributes } from '#gw2/app/build/buffed-attributes.js';
import { createSkillDamagePreview } from '#gw2/app/build/skill-damage/preview.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { firstPresetBuildPath, headlessApp } from '#tests/helpers/skill-damage.js';

const BLADESWORN = 'data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json';
const HARBINGER = 'data/gw2/builds/necromancer/b-condi-harbinger.json';

// One ordinary strike shares panel state with the strip; a Beastmode-only strike retains its own form override.
test('Soulbeast damage attributes and occurrences share merge preparation without changing the saved build', async () => {
  const app = await headlessApp('ranger', 'data/gw2/builds/ranger/b-power-soulbeast-hammer-axe.json');
  const saved = structuredClone(app.build);
  const attributes = app.attributeData;
  const controls = skillDamageControls(app);
  const cache = new Map();
  const powers = [];
  let beast;
  for (const merged of [0, 1, 0]) {
    const values = { ...clearedValues(controls), merged };
    const { request } = createSkillDamagePlan(app, controls, values);
    const strike = request.occurrences.find((entry) => entry.name === 'Hammer Strike');
    beast = request.occurrences.find(
      (entry) =>
        app.skillById.get(entry.effect.id)?.beastmodeSkill &&
        app.skillById.get(entry.effect.id)?.effects?.some((effect) => effect.type === 'strike')
    );
    assert.ok(strike);
    assert.ok(beast);
    const strip = calculateSkillDamageAttributes(app, values, controls);
    const [measured] = evaluateSkillDamage({ ...request, occurrences: [strike] }, app.profession, cache).occurrences;
    assert.equal(measured.status, 'measured');
    assert.equal(measured.measurement.strikeBreakdown.power, strip.attributes.Power.final);
    powers.push(strip.attributes.Power.final);
    if (!merged) {
      const [beastResult] = evaluateSkillDamage({ ...request, occurrences: [beast] }, app.profession).occurrences;
      assert.equal(beastResult.status, 'measured');
      assert.ok(beastResult.measurement.strikeBreakdown.power > strip.attributes.Power.final);
    }
  }

  assert.ok(powers[1] > powers[0]);
  assert.equal(powers[0], powers[2]);
  assert.deepEqual(app.build, saved);
  assert.equal(app.attributeData, attributes);
});

// Every damage row keeps its required controls even when the other panel inspects another weapon set.
test('damage preview weapon scope is independent of Attribute Preview selection', async () => {
  const app = await headlessApp('thief', await firstPresetBuildPath('thief'));
  app.build.specializations = [{ name: 'Deadeye', traits: '1-1-1' }];
  app.build.weapons = ['Axe', 'Pistol'];
  app.build.alternateWeapons = ['Dagger', 'Pistol'];
  app.adapter.recalculate(app);
  for (const startingWeaponSet of [1, 2]) {
    app.build.startingWeaponSet = startingWeaponSet;
    app.adapter.recalculate(app);
    const plans = [];
    for (const attributeWeaponSet of [1, 2]) {
      app.attributeWeaponSet = attributeWeaponSet;
      const controls = skillDamageControls(app);
      assert.equal(controls.filter((control) => control.key === 'spinningAxes').length, 1);
      const values = clearedValues(controls);
      const isolated = createSkillDamagePreview(app, controls, values);
      assert.deepEqual(
        isolated.context.weapons,
        startingWeaponSet === 1 ? app.build.weapons : app.build.alternateWeapons
      );
      plans.push(createSkillDamagePlan(app, controls, values));
    }

    assert.equal(plans[0].signature, plans[1].signature);
    assert.ok(plans[0].groups.some((group) => group.kind === 'weapon' && group.title === 'Axe'));
  }
});

test('planning and measuring skill damage never changes the build, its assumptions, or its attributes', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const build = structuredClone(app.build);
  const attributeData = app.attributeData;
  const controls = skillDamageControls(app);
  const values = { ...clearedValues(controls), might: 7, fury: 1, fierceAsFire: 4 };
  const plan = createSkillDamagePlan(app, controls, values);
  app.adapter.calculateSkillDamage({ ...plan.request, occurrences: plan.request.occurrences.slice(0, 3) });
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

test('preview values become occurrence boons, target conditions, held buffs, and profession fields', async () => {
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

// Profession boons remain editable assumptions and cannot be overwritten by the normal simulation defaults.
test('profession boon controls seed from the build and update only the detached preview', async () => {
  for (const [build, boon] of [
    ['b-power-dragonhunter-spear-greatsword.json', 'resolution'],
    ['b-condi-firebrand.json', 'quickness']
  ]) {
    const app = await headlessApp('guardian', `data/gw2/builds/guardian/${build}`);
    app.build.assumptions[boon] = true;
    const saved = structuredClone(app.build);
    const controls = skillDamageControls(app);
    assert.equal(controls.filter((control) => control.key === boon).length, 1);
    assert.equal(controls.filter((control) => control.key === 'might').length, 1);
    const values = simulationConfigValues(app, controls);
    assert.equal(values[boon], 1);
    assert.equal(createSkillDamagePlan(app, controls, values).request.config.boons[boon], true);
    assert.equal(createSkillDamagePlan(app, controls, { ...values, [boon]: 0 }).request.config.boons[boon], false);
    assert.deepEqual(app.build, saved);
  }
});

// A procedural relic can apply Torment even when none of the profession's skill definitions do.
test('target movement controls equipment Torment independently of skill declarations', async () => {
  const app = await headlessApp('guardian', 'data/gw2/builds/guardian/b-condi-firebrand.json');
  app.build.relic = 'Akeem';
  app.adapter.recalculate(app);
  const saved = structuredClone(app.build);
  const controls = skillDamageControls(app);
  assert.equal(controls.filter((control) => control.key === 'targetMoving').length, 1);
  const values = clearedValues(controls);
  const measure = (moving) => {
    const { request } = createSkillDamagePlan(app, controls, { ...values, targetMoving: moving });
    assert.equal(request.config.target.moving, Boolean(moving));
    const occurrence = request.occurrences.find((entry) => entry.name === 'Relic of Akeem');
    assert.ok(occurrence);
    const [result] = app.adapter.calculateSkillDamage({ ...request, occurrences: [occurrence] }).occurrences;
    assert.equal(result.status, 'measured');
    return result.measurement.conditions.find((row) => row.condition === 'Torment').damage;
  };

  assert.ok(measure(0) > measure(1));
  assert.deepEqual(app.build, saved);
});

// Catalog scope is independent of runtime slot eligibility.
test('unslotted effects preserve the build loadout instead of manufacturing legal slot selections', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const plan = createSkillDamagePlan(app, skillDamageControls(app), {});
  const unslotted = [...plan.rows.values()].find((row) => row.status === 'unslotted');
  const entry = plan.request.occurrences.find((candidate) => candidate.id === unslotted.id);
  assert.ok(entry);
  assert.equal(entry.config.selectedSkillIds, undefined);
  assert.deepEqual(plan.request.config.selectedSkillIds, app.adapter.simulationConfig(app).selectedSkillIds);
});

test('zero-damage calculations remain visible while calculation failures have a separate explanation', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const plan = createSkillDamagePlan(app, [], {});
  const [first, second] = plan.groups.find((group) => group.kind === 'weapon').rowIds;
  const measurement = {
    castSeconds: 1,
    hits: 0,
    coefficient: 0,
    strike: 0,
    conditionDamage: 0,
    total: 0,
    strikeBreakdown: null,
    conditions: []
  };
  const model = createSkillDamageViewModel(
    plan,
    {
      occurrences: [
        { id: first, measurement, status: 'zero', damaging: true, assumptions: [], unit: 'activation', variants: [] },
        {
          id: second,
          measurement: null,
          status: 'unsupported',
          reason: 'Damage calculation not implemented.',
          variants: []
        }
      ]
    },
    { filter: 'all', expanded: null, closedGroups: new Set(), targetArmor: 2597 }
  );
  assert.equal(model.counts.all, 1);
  assert.equal(model.groups[0].rows[0].measurement.total, 0);
  assert.equal(model.unavailable[0].reason, 'Damage calculation not implemented.');
});

test('selected proc declarations enumerate damage independently of qualifying actions', async () => {
  const app = await headlessApp('necromancer', HARBINGER);
  const { occurrences } = createSkillDamagePlan(app, [], {}).request;
  assert.ok(occurrences.some((entry) => entry.source === 'Trait' && entry.name === 'Dhuumfire'));
  assert.ok(occurrences.some((entry) => entry.source === 'Relic'));
  assert.ok(occurrences.some((entry) => entry.source === 'Sigil'));
  assert.ok(occurrences.every((entry) => !Object.hasOwn(entry, 'setup')));
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
    const values = simulationConfigValues(app, controls);
    const plan = createSkillDamagePlan(app, controls, values);
    // Every family can query the shared initial state without selecting a skill-specific form.
    const strip = calculateSkillDamageAttributes(app, values, controls);
    assert.ok(Number.isFinite(strip.attributes.Power.final));
    assert.ok(Number.isFinite(strip.attributes['Strike Multiplier'].final));
    const evaluation = app.adapter.calculateSkillDamage(plan.request);
    const measured = new Map(
      evaluation.occurrences
        .filter((occurrence) => occurrence.measurement?.total > 0)
        .map((occurrence) => [occurrence.id, occurrence])
    );
    const declared = new Set(
      app.profession.ui
        .skillDamageGroups(attributePreviewContext(app, app.build.startingWeaponSet))
        .map((group) => `mechanic-${group.id}`)
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
    const occurrences = plan.request.occurrences.filter((occurrence) => ids.includes(occurrence.id));
    const result = app.adapter.calculateSkillDamage({ ...plan.request, occurrences });
    assert.deepEqual(
      result.occurrences.map((occurrence) => occurrence.reason),
      [undefined, undefined],
      element
    );
    assert.ok(
      result.occurrences.every((occurrence) => occurrence.measurement != null),
      element
    );
    assert.deepEqual(
      occurrences.map((occurrence) => occurrence.config.profession.initialEvokerEmpowered),
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
