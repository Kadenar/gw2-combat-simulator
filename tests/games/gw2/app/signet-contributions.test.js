import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { calculateContributionComparisons } from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { modifierComparisonRequest, modifierContributionRequest } from '#tests/helpers/modifier-contributions.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

const signets = {
  elementalist: [['Signet of Fire', 'precision']],
  guardian: [
    ['Bane Signet', 'power'],
    ['Signet of Wrath', 'conditionDamage']
  ],
  mesmer: [
    ['Signet of Domination', 'conditionDamage'],
    ['Signet of Midnight', 'expertise']
  ],
  necromancer: [['Signet of Spite', 'power']],
  ranger: [['Signet of the Wild', 'ferocity']],
  thief: [
    ["Assassin's Signet", 'power'],
    ['Signet of Agility', 'precision']
  ],
  warrior: [
    ['Signet of Might', 'power'],
    ['Signet of Fury', 'precision']
  ]
};
const adapters = {};

// Isolate signet ownership from presets while exercising the same request and config path as Analysis.
async function signetApp(name) {
  const adapter = (adapters[name] ??= (await import(`#gw2/professions/${name}/app/app-definition.js`))[
    `${name}AppAdapter`
  ]);
  const catalog = adapter.profession.catalog;
  const app = {
    adapter,
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    attributeWeaponSet: 1,
    activeCatalog: catalog,
    build: {
      ...createDefaultBuild(adapter),
      specializations: [],
      selectedSkillIds: Object.fromEntries(
        signets[name].map(([label], index) => [
          `Utility${index + 1}`,
          catalog.skills.find((candidate) => candidate.name === label).id
        ])
      ),
      relic: '',
      rotation: []
    }
  };
  app.attributeData = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  return app;
}

function stats(profession, config, cooldown = false) {
  return createGw2CombatQuery({
    profession: profession.runtimeFor(config),
    config,
    skillOnCooldown: () => cooldown
  }).statsAt(0);
}

// Skill removal edits only that comparison; ordinary modifiers and the original command stream remain intact.
test('skill comparisons omit every removed cast and preserve all other rotation commands', () => {
  const rotation = [
    { type: 'cast', skillId: 1 },
    { type: 'cast', skillId: 2 },
    { type: 'wait', durationMs: 1000 },
    { type: 'cast', skillId: 1 }
  ];
  const saved = structuredClone(rotation);
  const runs = [];
  calculateContributionComparisons(
    {
      rotation,
      baselineDps: 0,
      comparisons: [
        { modifier: { id: 'Skill:1', type: 'Skill', skillId: 1, name: 'Signet', label: 'Signet' }, config: {} },
        { modifier: { id: 'Trait:Example', type: 'Trait', name: 'Example', label: 'Example' }, config: {} }
      ]
    },
    (commands) => {
      runs.push(commands);
      return { dps: 0 };
    }
  );
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0], [
    { type: 'cast', skillId: 2 },
    { type: 'wait', durationMs: 1000 }
  ]);
  assert.deepEqual(runs[1], saved);
  assert.deepEqual(rotation, saved);
});

for (const [name, entries] of Object.entries(signets)) {
  test(`${name}: equipped attribute signets receive independent removal comparisons`, async () => {
    const app = await signetApp(name);
    const saved = structuredClone(app.build);
    const request = structuredClone(modifierComparisonRequest(app, app.adapter));
    const comparisons = request.comparisons.filter(({ modifier }) => modifier.type === 'Skill');
    assert.equal(comparisons.length, entries.length);
    const { baseConfig } = app.adapter.baselineSimulationRequest(app);
    const baseline = stats(app.adapter.profession, baseConfig);
    for (const [label, attribute] of entries) {
      const skill = app.activeCatalog.skills.find((candidate) => candidate.name === label);
      const comparison = comparisons.find(({ modifier }) => modifier.skillId === skill.id);
      assert.ok(comparison, label);
      assert.equal(comparison.modifier.label, label);
      assert.equal(resultSkillIcon(app, { id: comparison.modifier.id, name: comparison.modifier.label }), skill.icon);
      assert.deepEqual(comparison.config, {
        ...baseConfig,
        selectedSkillIds: baseConfig.selectedSkillIds.filter((id) => id !== skill.id)
      });
      const removed = stats(app.adapter.profession, comparison.config);
      assert.equal(baseline[attribute] - removed[attribute], 180, label);
      for (const [otherLabel, otherAttribute] of entries) {
        if (otherLabel !== label) assert.equal(removed[otherAttribute], baseline[otherAttribute]);
      }
    }

    assert.deepEqual(app.build, saved);
    app.build.selectedSkillIds = {};
    app.attributeData = app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
    assert.equal(
      modifierComparisonRequest(app, app.adapter).comparisons.some(({ modifier }) => modifier.type === 'Skill'),
      false
    );
  });
}

// A trait cannot retain or enhance the passive of an unequipped signet.
test('signet removal excludes trait-enhanced and recharge-retained attributes', async () => {
  for (const [name, label, traitName, attribute, bonus] of [
    ['elementalist', 'Signet of Fire', 'Written in Stone', 'precision', 180],
    ['guardian', 'Bane Signet', 'Perfect Inscriptions', 'power', 216],
    ['guardian', 'Signet of Wrath', 'Perfect Inscriptions', 'conditionDamage', 216]
  ]) {
    const app = await signetApp(name);
    const skillId = app.activeCatalog.skills.find((candidate) => candidate.name === label).id;
    const traitId = app.adapter.profession.catalog.traits.find((trait) => trait.name === traitName).id;
    const config = {
      specialization: 'Core',
      selectedSkillIds: [skillId],
      selectedTraitIds: [traitId],
      attributeInputs: baseAttributeInputs()
    };
    const baseline = stats(app.adapter.profession, config, true);
    const removed = stats(app.adapter.profession, { ...config, selectedSkillIds: [] }, true);
    assert.equal(baseline[attribute] - removed[attribute], bonus);
  }
});

// Removing a signet removes its active attributes and cast-triggered rewards as well as its passive.
for (const [name, label, traitName, buff, attribute, activeBonus] of [
  ['thief', "Assassin's Signet", 'Signets of Power', 'assassins-signet', 'power', 540],
  ['warrior', 'Signet of Fury', 'Signet Mastery', 'signet-of-fury-active', 'precision', 360]
]) {
  test(`${name}: whole-signet comparison removes active attributes and activation rewards`, async () => {
    const app = await signetApp(name);
    const family = app.adapter.profession;
    const skillId = app.activeCatalog.skills.find((candidate) => candidate.name === label).id;
    const trait = family.catalog.traits.find((trait) => trait.name === traitName);
    const choices = [0, 0, 0];
    const line = family.catalog.specializations.find((line) => line.name === trait.specialization);
    choices[trait.tier - 1] = line.majorTraits[trait.tier - 1].findIndex((entry) => entry.id === trait.id) + 1;
    app.build.specializations = [{ name: trait.specialization, traits: choices.join('-') }];
    app.build.selectedSkillIds = { Utility1: skillId };
    app.build.initialInitiative = 0;
    app.build.weapons = name === 'thief' ? ['Dagger', 'Dagger'] : ['Axe', 'Axe'];
    const attack = app.activeCatalog.skills.find(
      (candidate) => candidate.name === (name === 'thief' ? 'Double Strike' : 'Chop')
    );
    app.build.rotation = [
      { type: 'cast', skillId },
      { type: 'cast', skillId: attack.id },
      { type: 'wait', durationMs: 1000 }
    ];
    app.attributeData = app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
    const outputs = [];
    // Observe the baseline explicitly; contribution execution now owns only omission runs.
    const simulate = (rotation, config) => {
      const result = observeGw2Runtime({ profession: family.runtimeFor(config), config, rotation });
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      outputs.push({ result, attributes: runtime.query.statsAt(runtime.time, null, runtime) });
      return result;
    };

    const baselineInput = app.adapter.baselineSimulationRequest(app);
    const baseline = simulate(baselineInput.rotation, baselineInput.baseConfig);
    const request = app.adapter.modifierContributionRequest(app, baseline.dps);
    const comparison = request.comparisons.find(({ modifier }) => modifier.skillId === skillId);
    const contributions = calculateContributionComparisons({ ...request, comparisons: [comparison] }, simulate);
    assert.equal(contributions.length, 1);
    assert.ok(contributions[0].dpsIncrease > 0);
    assert.equal(outputs[0].attributes[attribute] - outputs[1].attributes[attribute], activeBonus);
    assert.ok(outputs[0].result.events.some((event) => event.kind === buff));
    assert.equal(
      outputs[1].result.events.some((event) => event.kind === buff),
      false
    );

    if (name === 'warrior') {
      assert.ok(outputs[0].result.events.some((event) => event.kind === 'signet-mastery'));
      assert.equal(
        outputs[1].result.events.some((event) => event.kind === 'signet-mastery'),
        false
      );
    } else {
      assert.ok(
        outputs[0].result.planningState.profession[STATE.INITIATIVE].value >
          outputs[1].result.planningState.profession[STATE.INITIATIVE].value
      );
    }
  });
}

// Unequipping the signet removes both player and independent pet grants in the real DPS comparison.
test('Signet of the Wild contribution includes player and pet passive removal', async () => {
  const app = await signetApp('ranger');
  const skillId = app.activeCatalog.skillsById.get(12491).id;
  app.build.weapons = ['Longbow', ''];
  app.build.rotation = [
    { type: 'cast', skillId: app.activeCatalog.skillsById.get(12510).id },
    { type: 'wait', durationMs: 1000 }
  ];
  app.attributeData = app.adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const request = modifierContributionRequest(app, app.adapter);
  const comparison = request.comparisons.find(({ modifier }) => modifier.skillId === skillId);
  const snapshots = [app.adapter.baselineSimulationRequest(app).baseConfig, comparison.config].map((config) => {
    let snapshot;
    observeGw2Runtime({
      profession: app.adapter.profession.runtimeFor(config),
      config,
      rotation: [],
      engineInitialize(runtime) {
        snapshot = rangerPetCombatMetadata(runtime.mechanics);
      }
    });
    return snapshot;
  });
  assert.equal(snapshots[0].summonBaseFerocity - snapshots[1].summonBaseFerocity, 180);
  const contributions = app.adapter.calculateModifierContributions({ ...request, comparisons: [comparison] });
  assert.equal(contributions.length, 1);
  assert.equal(contributions[0].name, 'Signet of the Wild');
  assert.ok(contributions[0].dpsIncrease > 0);
});
