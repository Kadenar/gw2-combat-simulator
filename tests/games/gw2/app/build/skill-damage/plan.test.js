import assert from 'node:assert/strict';
import test from 'node:test';

import { attributePreviewContext, attributePreviewControls } from '#gw2/app/build/attribute-preview-controls.js';
import { calculateSkillDamageAttributes } from '#gw2/app/build/skill-damage/attributes.js';
import {
  clearedValues,
  createSkillDamagePlan,
  simulationConfigValues,
  skillDamageControls
} from '#gw2/app/build/skill-damage/plan.js';
import { createSkillDamagePreview } from '#gw2/app/build/skill-damage/preview.js';
import { createSkillDamageViewModel } from '#gw2/app/build/skill-damage/view-model.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { firstPresetBuildPath, headlessApp } from '#tests/helpers/skill-damage.js';

const BLADESWORN = 'data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json';
const HARBINGER = 'data/gw2/builds/necromancer/b-condi-harbinger.json';

/** Refresh selected traits through the same build context used by the editor. */
function refreshAttributes(app) {
  app.attributeData = app.adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: app.adapter.profession.resolvePatch({ id: app.patch.id })
    })
    .attributes(1);
}

function healthPlan(app) {
  const controls = skillDamageControls(app);
  return createSkillDamagePlan(app, controls, clearedValues(controls));
}

// The browser app exposes the selected patch catalog through a prototype getter, not an enumerable field.
test('skill damage preparation uses the selected catalog without reading results or cursor state', async () => {
  class PreviewApp {
    get activeCatalog() {
      return this.patch.catalog;
    }
  }
  const { activeCatalog, ...state } = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const app = Object.assign(new PreviewApp(), state);
  assert.equal(app.activeCatalog, activeCatalog);
  // Reading either field would couple isolated enumeration to a previous simulation or trigger prefix work.
  for (const key of ['results', 'rotationInsertionIndex']) {
    Object.defineProperty(app, key, {
      get() {
        throw new Error(`Isolated preview read ${key}`);
      }
    });
  }

  const plan = healthPlan(app);
  assert.ok(plan.rows.size > 0);
  assert.ok(plan.groups.some((group) => group.id.startsWith('weapon-')));
});

// Selected traits own visibility by canonical identity, independently of their current display labels.
test('target-health visibility follows selected damage traits without leaking damage-only attribute controls', async () => {
  for (const [profession, weapons, names, attributeNames = []] of [
    ['elementalist', ['Scepter', 'Focus'], ['Bolt to the Heart']],
    ['engineer', ['Rifle', ''], ['Big Boomer', 'Heavy Metal'], ['Heavy Metal']],
    ['mesmer', ['Greatsword', ''], ['Egotism', 'Superiority Complex'], ['Superiority Complex']],
    ['necromancer', ['Dagger', 'Focus'], ['Close to Death']],
    ['revenant', ['Staff', ''], ['Swift Termination', 'Unsuspecting Strikes']],
    ['thief', ['Pistol', 'Pistol'], ['Executioner', 'Ferocious Strikes'], ['Ferocious Strikes']],
    ['warrior', ['Sword', 'Sword'], ["Warrior's Cunning"]]
  ]) {
    const app = await headlessApp(profession, await firstPresetBuildPath(profession));
    app.build.weapons = weapons;
    app.build.alternateWeapons = ['', ''];
    app.build.relic = 'Claw';
    for (const name of names) {
      const trait = app.activeCatalog.traits.find((entry) => entry.name === name);
      assert.ok(trait, name);
      const choices = [0, 0, 0];

      // Derive the saved choice from the active layout, including patch moves.
      const line = app.activeCatalog.specializations.find((line) =>
        [...line.minorTraits, ...line.majorTraits.flat()].some((entry) => entry.id === trait.id)
      );

      const tier = line.majorTraits.findIndex((choices) => choices.some((entry) => entry.id === trait.id));

      if (tier >= 0) choices[tier] = line.majorTraits[tier].findIndex((entry) => entry.id === trait.id) + 1;

      app.build.specializations = [
        {
          name: line.name,
          traits: choices.join('-'),
          disabledMinorTraits: [0, 1, 2].filter((tier) => line.minorTraits[tier]?.id !== trait.id)
        }
      ];
      refreshAttributes(app);
      assert.ok(
        app.attributeData.activeTraits.some((entry) => entry.id === trait.id),
        name
      );
      app.attributeData.activeTraits = app.attributeData.activeTraits.map((entry) => ({
        ...entry,
        name: `Renamed ${entry.id}`
      }));
      assert.equal(healthPlan(app).usesTargetHealth, true, name);
      assert.equal(
        attributePreviewControls(app).some((control) => control.key === 'targetHealth'),
        attributeNames.includes(name),
        name
      );
      assert.equal(skillDamageControls(app).filter((control) => control.key === 'targetHealth').length, 1);
    }

    app.build.specializations = [];
    refreshAttributes(app);
    assert.equal(healthPlan(app).usesTargetHealth, false, `${profession}: deselected`);
  }
});

// Weapon selection includes alternate sets and transformed skills, but not irrelevant catalog entries.
test('target-health visibility covers intrinsic skills and procedural exceptions in either weapon set', async () => {
  for (const [profession, specialization, weapon, expected] of [
    ['thief', 'Core', 'Dagger', true],
    ['thief', 'Deadeye', 'Spear', true],
    ['warrior', 'Core', 'Rifle', true],
    ['warrior', 'Spellbreaker', 'Rifle', true],
    ['warrior', 'Berserker', 'Rifle', false],
    ['warrior', 'Bladesworn', 'Rifle', false],
    ['necromancer', 'Core', 'Sword', true],
    ['necromancer', 'Reaper', 'Staff', true],
    ['necromancer', 'Core', 'Greatsword', false],
    ['ranger', 'Untamed', 'Spear', true]
  ]) {
    const app = await headlessApp(profession, await firstPresetBuildPath(profession));
    app.build.specializations = specialization === 'Core' ? [] : [{ name: specialization, traits: '0-0-0' }];
    app.build.relic = 'Claw';
    refreshAttributes(app);
    for (const set of [1, 2]) {
      app.build.weapons = set === 1 ? [weapon, ''] : ['', ''];
      app.build.alternateWeapons = set === 2 ? [weapon, ''] : ['', ''];
      assert.equal(healthPlan(app).usesTargetHealth, expected, `${profession} ${specialization} ${weapon} set ${set}`);
    }
  }
});

// Each isolated spear cast gets its own illumination charge, with no saved-state or cross-weapon changes.
test('Guardian spear illumination is damage-only, works in either set, and resets when cleared', async () => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  app.build.specializations = [];
  app.build.weapons = ['Greatsword', ''];
  app.build.alternateWeapons = ['', ''];
  assert.ok(!skillDamageControls(app).some((control) => control.key === 'illuminated'));

  for (const spearSet of [1, 2]) {
    app.build.weapons = spearSet === 1 ? ['Spear', ''] : ['Greatsword', ''];
    app.build.alternateWeapons = spearSet === 2 ? ['Spear', ''] : ['Greatsword', ''];
    const saved = structuredClone(app.build);
    const controls = skillDamageControls(app);
    assert.equal(controls.filter((control) => control.key === 'illuminated').length, 1);
    assert.ok(!attributePreviewControls(app).some((control) => control.key === 'illuminated'));
    assert.equal(simulationConfigValues(app, controls).illuminated, 0);
    const cache = new Map();
    const measurements = [0, 1, 0].map((illuminated) => {
      const { request } = createSkillDamagePlan(app, controls, { ...clearedValues(controls), illuminated });
      const occurrences = request.occurrences.filter((entry) => ['Helio Rush', 'Whirling Wrath'].includes(entry.name));
      assert.equal(occurrences.length, 2);
      return evaluateSkillDamage({ ...request, occurrences }, app.profession, cache).occurrences;
    });
    for (const [index, base] of measurements[0].entries()) {
      assert.equal(base.status, 'measured');
      const boosted = measurements[1][index];
      assert.equal(boosted.status, 'measured');
      const name = app.activeCatalog.skillsById.get(Number(base.id.split(':').at(-1))).name;

      if (name === 'Helio Rush') assert.ok(boosted.measurement.total > base.measurement.total, name);
      else assert.equal(boosted.measurement.total, base.measurement.total, name);

      assert.equal(measurements[2][index].measurement.total, base.measurement.total, name);
    }

    assert.deepEqual(app.build, saved);
  }
});

// Each variant's weapon input must reach Glaring Burst's runtime state, and the row must show the chosen primary.
test('Glaring Burst previews each equipped radiant weapon in isolation', async () => {
  const app = await headlessApp('guardian', 'data/gw2/builds/guardian/b-power-luminary.json');
  const { request } = healthPlan(app);
  const burst = request.occurrences.find((entry) => entry.name === 'Glaring Burst');
  assert.ok(burst);
  const [row] = evaluateSkillDamage({ ...request, occurrences: [burst] }, app.profession).occurrences;
  assert.ok(row.variants.length > 1);
  assert.ok(row.variants.every((variant) => variant.measurement));
  assert.ok(new Set(row.variants.map((variant) => variant.measurement.total)).size > 1);
  const primary = row.variants.find((variant) => variant.id === burst.primaryVariantId);
  assert.equal(row.primaryVariantId, burst.primaryVariantId);
  assert.deepEqual(row.measurement, primary.measurement);
});

// A misspelled weapon must fail its own variant instead of measuring a weaponless burst.
test('Glaring Burst reports an unknown radiant weapon as a failed variant', async () => {
  const app = await headlessApp('guardian', 'data/gw2/builds/guardian/b-power-luminary.json');
  const { request } = healthPlan(app);
  const burst = request.occurrences.find((entry) => entry.name === 'Glaring Burst');
  const occurrence = { ...burst, variants: [{ id: 'unknown', label: 'Unknown', inputs: { radiantWeapon: 'sword' } }] };
  const [row] = evaluateSkillDamage({ ...request, occurrences: [occurrence] }, app.profession).occurrences;
  assert.equal(row.variants[0].measurement, null);
  assert.equal(row.variants[0].status, 'failed');
});

// Held Amalgam bonuses must reach both the displayed stats and measured packets without prerequisite casts.
test('Amalgam damage previews apply Willing Host, Evolve and Titanic Strain independently', async () => {
  const app = await headlessApp('engineer', 'data/gw2/builds/engineer/b-power-amalgam-hammer-double-helix.json');
  app.build.specializations = app.build.specializations.filter((entry) => entry.name === 'Amalgam');
  app.attributeData = app.adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const saved = structuredClone({ build: app.build, attributes: app.attributeData });
  const controls = skillDamageControls(app);
  for (const key of ['willingHost', 'evolved', 'titanic'])
    assert.equal(controls.filter((control) => control.key === key).length, 1);
  assert.ok(!attributePreviewControls(app).some((control) => control.key === 'willingHost'));
  const baseValues = { ...clearedValues(controls), might: 25 };
  const base = calculateSkillDamageAttributes(app, baseValues, controls).attributes;
  const cache = new Map();
  for (const bonuses of [
    { willingHost: 1 },
    { evolved: 1 },
    { titanic: 1 },
    { willingHost: 1, evolved: 1, titanic: 1 },
    {}
  ]) {
    const values = { ...baseValues, ...bonuses };
    const { request } = createSkillDamagePlan(app, controls, values);
    const strip = calculateSkillDamageAttributes(app, values, controls).attributes;

    if (bonuses.evolved || bonuses.titanic) assert.ok(strip.Power.final > base.Power.final);
    else assert.equal(strip.Power.final, base.Power.final);

    if (bonuses.titanic) assert.ok(strip['Condition Damage'].final > base['Condition Damage'].final);

    for (const name of ['Strike Multiplier', 'Condition Multiplier']) {
      if (bonuses.willingHost) assert.ok(strip[name].final > base[name].final, name);
      else assert.equal(strip[name].final, base[name].final, name);
    }

    const strike = request.occurrences.find((entry) => entry.name === 'Positive Strike');
    assert.ok(strike);
    const [measured] = evaluateSkillDamage({ ...request, occurrences: [strike] }, app.profession, cache).occurrences;
    assert.equal(measured.status, 'measured');
    assert.equal(measured.measurement.strikeBreakdown.power, strip.Power.final);
  }

  assert.deepEqual({ build: app.build, attributes: app.attributeData }, saved);
});

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
        app.activeCatalog.skillsById.get(entry.effect.id)?.beastmodeSkill &&
        app.activeCatalog.skillsById.get(entry.effect.id)?.effects?.some((effect) => effect.type === 'strike')
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
  app.attributeData = app.adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  for (const startingWeaponSet of [1, 2]) {
    app.build.startingWeaponSet = startingWeaponSet;
    app.attributeData = app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
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
    assert.ok(plans[0].groups.some((group) => group.id.startsWith('weapon-') && group.title === 'Axe'));
  }
});

test('planning and measuring skill damage never changes the build, its assumptions, or its attributes', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const build = structuredClone(app.build);
  const attributeData = app.attributeData;
  const controls = skillDamageControls(app);
  const values = { ...clearedValues(controls), might: 7, fury: 1, fierceAsFire: 4 };
  const plan = createSkillDamagePlan(app, controls, values);
  evaluateSkillDamage({ ...plan.request, occurrences: plan.request.occurrences.slice(0, 3) }, app.profession);
  assert.deepEqual(app.build, build);
  assert.equal(app.attributeData, attributeData);
});

test('control scope keeps damage-only inputs out of the Attribute Preview', async () => {
  const bladesworn = await headlessApp('warrior', BLADESWORN);
  const harbinger = await headlessApp('necromancer', HARBINGER);
  const keys = (controls) => controls.map((control) => control.key);
  assert.ok(keys(skillDamageControls(bladesworn)).includes('fierceAsFire'));
  assert.ok(!keys(attributePreviewControls(bladesworn)).includes('fierceAsFire'));
  // Guns and Glory changes Ferocity, so it remains in both panels.
  assert.ok(keys(skillDamageControls(bladesworn)).includes('gunsAndGlory'));
  assert.ok(keys(attributePreviewControls(bladesworn)).includes('gunsAndGlory'));
  assert.ok(keys(skillDamageControls(harbinger)).includes('blight'));
  assert.ok(!keys(attributePreviewControls(harbinger)).includes('blight'));
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
  app.attributeData = app.adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const saved = structuredClone(app.build);
  const controls = skillDamageControls(app);
  assert.equal(controls.filter((control) => control.key === 'targetMoving').length, 1);
  const values = clearedValues(controls);
  const measure = (moving) => {
    const { request } = createSkillDamagePlan(app, controls, { ...values, targetMoving: moving });
    assert.equal(request.config.target.moving, Boolean(moving));
    const occurrence = request.occurrences.find((entry) => entry.name === 'Relic of Akeem');
    assert.ok(occurrence);
    const [result] = evaluateSkillDamage({ ...request, occurrences: [occurrence] }, app.profession).occurrences;
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
  assert.deepEqual(
    plan.request.config.selectedSkillIds,
    app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig().selectedSkillIds
  );
});

test('zero-damage calculations remain visible while calculation failures have a separate explanation', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  const plan = createSkillDamagePlan(app, [], {});
  const [first, second] = plan.groups.find((group) => group.id.startsWith('weapon-')).rowIds;
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

test('standalone declarations retain equipment payloads without manufacturing trait occurrences', async () => {
  const app = await headlessApp('necromancer', HARBINGER);
  const { occurrences } = createSkillDamagePlan(app, [], {}).request;
  assert.ok(occurrences.every((entry) => entry.source !== 'Trait'));
  assert.ok(occurrences.some((entry) => entry.source === 'Relic'));
  assert.ok(occurrences.some((entry) => entry.source === 'Sigil'));
  assert.ok(occurrences.every((entry) => !Object.hasOwn(entry, 'setup')));
});

// The opt-in follows native trait eligibility per isolated skill and adds each earned proc to that skill.
test('trait proc preview toggles Dhuumfire and Sadistic Searing on their qualifying Scourge skills', async () => {
  const app = await headlessApp('necromancer', HARBINGER);
  app.build.specializations = [
    { name: 'Soul Reaping', traits: '0-0-3' },
    { name: 'Scourge', traits: '0-2-0' }
  ];
  refreshAttributes(app);
  const saved = structuredClone(app.build);
  const controls = skillDamageControls(app);
  assert.equal(simulationConfigValues(app, controls).includeTraitProcs, 0);
  assert.equal(clearedValues(controls).includeTraitProcs, 0);
  assert.ok(!attributePreviewControls(app).some((control) => control.key === 'includeTraitProcs'));
  const cache = new Map();
  const measurements = [];
  for (const includeTraitProcs of [0, 1, 0]) {
    const plan = createSkillDamagePlan(app, controls, { ...clearedValues(controls), includeTraitProcs });
    assert.equal(plan.request.config.includeTraitProcs, undefined);
    const occurrences = plan.request.occurrences.filter((entry) =>
      ['Nefarious Favor', 'Weeping Shots'].includes(entry.name)
    );
    assert.deepEqual(new Set(occurrences.map((entry) => entry.name)), new Set(['Nefarious Favor', 'Weeping Shots']));
    const results = evaluateSkillDamage({ ...plan.request, occurrences }, app.profession, cache).occurrences;
    assert.ok(results.every((entry) => entry.status === 'measured'));
    measurements.push(new Map(results.map((entry, index) => [occurrences[index].name, entry.measurement])));
  }

  const [off, on, reset] = measurements;
  const burning = (measurement) => measurement.conditions.filter((entry) => entry.condition === 'Burning');
  assert.deepEqual(
    burning(on.get('Nefarious Favor'))
      .map((entry) => entry.attribution)
      .sort(),
    ['Dhuumfire', 'Sadistic Searing']
  );
  assert.equal(burning(off.get('Nefarious Favor')).length, 0);
  assert.ok(on.get('Nefarious Favor').total > off.get('Nefarious Favor').total);
  assert.deepEqual(on.get('Weeping Shots'), off.get('Weeping Shots'));
  assert.deepEqual(reset, off);
  assert.deepEqual(app.build, saved);
});

// Holding Sand Sage must preserve shade previews after their newly created finite shade expires.
test('Sand Sage preserves Alacrity Scourge shade previews and optional Dhuumfire attribution', async () => {
  const app = await headlessApp('necromancer', 'data/gw2/builds/necromancer/b-condi-alac-scourge.json');
  const controls = skillDamageControls(app);
  const saved = structuredClone(app.build);
  for (const includeTraitProcs of [0, 1]) {
    const { request } = createSkillDamagePlan(app, controls, {
      ...clearedValues(controls),
      shade: 1,
      includeTraitProcs
    });
    const occurrence = request.occurrences.find((entry) => entry.name === 'Sandstorm Shroud');
    assert.ok(occurrence);
    const [result] = evaluateSkillDamage({ ...request, occurrences: [occurrence] }, app.profession).occurrences;
    assert.equal(result.status, 'measured', result.reason);
    const sources = result.measurement.conditions.filter((entry) => entry.damage > 0).map((entry) => entry.attribution);
    assert.ok(sources.includes('Manifest Sand Shade'));
    assert.equal(sources.includes('Dhuumfire'), Boolean(includeTraitProcs));
  }

  assert.deepEqual(app.build, saved);
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
    const evaluation = evaluateSkillDamage(plan.request, app.profession);
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
      if (!group.id.startsWith('weapon-') && !declared.has(group.id)) continue;

      assert.ok(
        group.rowIds.some((rowId) => measured.has(rowId)),
        `${professionId} ${group.title} has no measured damage`
      );
    }
  });
}

test('Conduit measures one Release Potential per equipped legend when the second slot changes', async () => {
  const app = await headlessApp('revenant', 'data/gw2/builds/revenant/b-power-conduit.json');
  app.build.startingLegend = LEGEND.ASSASSIN;
  const releases = Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND);
  for (const second of [LEGEND.ENTITY, LEGEND.DEMON]) {
    const legends = [LEGEND.ASSASSIN, second];
    app.build.selectedLegends = legends;
    const plan = healthPlan(app);
    const occurrences = plan.request.occurrences.filter(
      ({ effect }) => effect.kind === 'skill' && releases.includes(effect.id)
    );
    assert.equal(occurrences.length, legends.length);
    for (const legend of legends) {
      const release = occurrences.find(
        ({ effect }) => effect.id === REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[legend]
      );
      assert.equal(release?.config.profession?.startingLegend, legend);
    }

    const result = evaluateSkillDamage({ ...plan.request, occurrences }, app.profession);
    assert.ok(result.occurrences.every(({ measurement }) => measurement?.total > 0));
    assert.equal(app.build.startingLegend, LEGEND.ASSASSIN);
  }
});

test('Conduit preview Affinity scales Release Potential damage and resets to the baseline', async () => {
  const app = await headlessApp('revenant', 'data/gw2/builds/revenant/b-power-conduit.json');
  const saved = structuredClone(app.build);
  const controls = skillDamageControls(app);
  const control = controls.find(({ key }) => key === 'affinity');
  const baseline = clearedValues(controls);
  const totals = [];
  for (const affinity of [baseline.affinity, control.max, baseline.affinity]) {
    const plan = createSkillDamagePlan(app, controls, { ...baseline, affinity });
    const dervish = REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[LEGEND.ENTITY];
    const occurrences = plan.request.occurrences.filter(
      ({ effect }) => effect.kind === 'skill' && effect.id === dervish
    );
    const [result] = evaluateSkillDamage({ ...plan.request, occurrences }, app.profession).occurrences;
    totals.push(result.measurement.total);
  }

  assert.ok(totals[1] > totals[0]);
  assert.equal(totals[2], totals[0]);
  assert.deepEqual(app.build, saved);
});

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
    app.attributeData = app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
    const saved = structuredClone(app.build);
    const controls = skillDamageControls(app);
    const plan = createSkillDamagePlan(app, controls, simulationConfigValues(app, controls));
    const ids = plan.groups.find((group) => group.id === 'mechanic-familiar').rowIds;
    const occurrences = plan.request.occurrences.filter((occurrence) => ids.includes(occurrence.id));
    const result = evaluateSkillDamage({ ...plan.request, occurrences }, app.profession);
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

// A familiar's element identifies its payload, not the player's required casting attunement.
test('Evoker familiar damage follows the preview attunement independently of familiar element', async () => {
  const app = await headlessApp(
    'elementalist',
    'data/gw2/builds/elementalist/b-condi-alac-evoker-pistol-warhorn-elemental-balance.json'
  );
  app.build.specializations = [
    { name: 'Fire', traits: '0-0-0' },
    { name: 'Evoker', traits: '0-0-0' }
  ];
  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    app.build.evokerElement = element;
    app.attributeData = app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
    const saved = structuredClone(app.build);
    const controls = skillDamageControls(app);
    const measurements = [];
    for (const damageAttunement of ['Water', 'Fire', 'Water']) {
      const values = { ...clearedValues(controls), damageAttunement };
      const plan = createSkillDamagePlan(app, controls, values);
      const ids = new Set(plan.groups.find((group) => group.id === 'mechanic-familiar').rowIds);
      const occurrences = plan.request.occurrences.filter((occurrence) => ids.has(occurrence.id));
      const results = evaluateSkillDamage({ ...plan.request, occurrences }, app.profession).occurrences;
      assert.ok(
        results.every((result) => result.measurement != null),
        element
      );
      measurements.push(results.map((result) => result.measurement.strikeBreakdown?.power ?? null));
    }

    for (const index of [0, 1]) {
      // Water's familiar forms heal; only damaging familiar forms have a Power breakdown.
      if (element === 'Water') {
        assert.deepEqual(
          measurements.map((entry) => entry[index]),
          [null, null, null]
        );
        continue;
      }

      assert.ok(measurements[1][index] > measurements[0][index], element);
      assert.equal(measurements[2][index], measurements[0][index], element);
    }

    assert.deepEqual(app.build, saved);
  }
});

// Clear buffs must not inherit hidden boons or conditions from the simulation's saved assumptions.
test('cleared preview values remove saved assumptions without altering the build', async () => {
  const app = await headlessApp('warrior', BLADESWORN);
  app.build.assumptions.protection = true;
  app.build.assumptions.targetConditions.Weakness = 1;
  app.attributeData = app.adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const controls = skillDamageControls(app);
  const config = createSkillDamagePlan(app, controls, clearedValues(controls)).request.config;
  assert.equal(config.boons.protection, false);
  assert.equal(config.boons.might, 0);
  assert.equal(config.boons.fury, false);
  assert.deepEqual(config.target.conditions, {});
  assert.equal(app.build.assumptions.protection, true);
  assert.equal(app.build.assumptions.targetConditions.Weakness, 1);
});
