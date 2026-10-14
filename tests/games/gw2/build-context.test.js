import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBuildContext } from '#gw2/build-context/load.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { getActiveTraits } from '#gw2/professions/mesmer/data/traits-data.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as REVENANT } from '#gw2/professions/revenant/data/ids.js';
import { resolveRevenantSkillLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { REVENANT_ASSUMPTION_CONTROLS } from '#gw2/professions/revenant/build/assumptions.js';
import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/professions/engineer/build/assumptions.js';
import { loadOptimizerContext } from '#gw2/app/optimizer/gear/context.js';
import { createOptimizerEvaluator } from '#gw2/app/optimizer/gear/search.js';

const input = (build, patchId = 'current') => ({ build, patchId, transitionDelays: normalizeTransitionDelays() });

// Fail at the dependency boundary even if a prior test has already initialized the real lazy UI.
const withoutPresentation = (profession) =>
  new Proxy(profession, {
    get(target, key, receiver) {
      if (key === 'ui') throw new Error('Headless build calculation accessed presentation');
      return Reflect.get(target, key, receiver);
    }
  });

// Every bound module owns its codec and patch selection without loading a browser adapter.
for (const { id } of professionRegistry) {
  test(`${id} context calculates both sets and owns every mutable config branch`, async () => {
    const module = await loadBuildContext(id);
    assert.equal(await loadBuildContext(id), module);
    const build = module.toApplicationBuild(module.profession.createBuildDefaults());
    const original = structuredClone(build);
    for (const patchId of ['current', ...(module.profession.preview ? [module.profession.preview.id] : [])]) {
      const context = module.createBuildContext(input(build, patchId));
      const first = context.attributes(1);
      assert.equal(context.attributes(1), first);
      const config = context.simulationConfig();
      assert.equal(config.patchId, patchId);
      assert.deepEqual(config.attributeInputs.weaponSets[0], first.attributeSeed);
      assert.notEqual(config.attributeInputs.weaponSets[0], first.attributeSeed);
      assert.deepEqual(config.attributeInputs.weaponSets[1], context.attributes(2).attributeSeed);
      const expected = structuredClone(config);
      // Mutating every nested collection catches ownership leaks in profession-specific arrays as well as seeds.
      const corrupt = (value) => {
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) {
          if (value[key] && typeof value[key] === 'object') corrupt(value[key]);
          else value[key] = null;
        }
      };

      corrupt(config);
      assert.deepEqual(context.simulationConfig(), expected);
      assert.deepEqual(build, original);
    }

    assert.throws(() => module.createBuildContext(input(build, 'removed-preview')), /Unknown patch/);
    assert.throws(() => module.createBuildContext(input(build)).attributes(0), /Weapon set/);
  });
}

test('a selected preview supplies both the attribute catalog and balance context', async () => {
  const module = await loadBuildContext('mesmer');
  const build = module.toApplicationBuild(module.profession.createBuildDefaults());
  const profession = withPatchPreview(withoutPresentation(mesmerProfession), {
    id: 'context-preview',
    label: 'Context preview'
  });
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(profession.catalog, getActiveTraits),
    profession.attributeContributions
  );
  let seen;
  const factory = bindBuildContext(
    withoutPresentation(profession),
    (...args) => {
      seen = args;
      return calculate(...args);
    },
    () => ({}),
    { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
  );
  const context = factory(input(build, 'context-preview'));
  context.attributes(1);
  assert.equal(seen[5], profession.balanceContextFor('context-preview'));
  assert.ok(seen[1].every((skill) => profession.catalogFor('context-preview').skillsById.get(skill.id) === skill));
  assert.equal(context.simulationConfig().patchId, 'context-preview');
});

test('Revenant starting legend determines skills regardless of displayed set or previous results', async () => {
  const module = await loadBuildContext('revenant');
  const build = module.toApplicationBuild({
    ...module.profession.createBuildDefaults(),
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DWARF],
    startingLegend: LEGEND.ASSASSIN
  });
  const context = module.createBuildContext(input(build));
  const loadout = resolveRevenantSkillLoadout(build, context.specialization);
  const expected = loadout.bars.find((bar) => bar.id === LEGEND.ASSASSIN).skillIds;
  context.attributes(2);
  assert.deepEqual(context.selectedSkillIds, expected);
  assert.deepEqual(context.simulationConfig().selectedSkillIds, expected);
  const { revenantAppAdapter } = await import('#gw2/professions/revenant/app/app-definition.js');
  const app = {
    build,
    patchId: 'current',
    attributeWeaponSet: 2,
    attributeData: { activeTraits: [] },
    results: { planningState: { profession: { activeLegend: LEGEND.DWARF } } }
  };
  assert.deepEqual(revenantAppAdapter.randomDistributionRequest(app).baseConfig.selectedSkillIds, expected);
});

test('headless fixed loadouts retain both bars while attribute skills follow the starting legend', async () => {
  const module = await loadBuildContext('revenant');
  const build = module.toApplicationBuild({
    ...module.profession.createBuildDefaults(),
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DWARF],
    startingLegend: LEGEND.DWARF
  });
  const factory = bindBuildContext(
    withoutPresentation(module.profession),
    (current, _skills, set) => module.createBuildContext(input(current)).attributes(set),
    () => ({}),
    { assumptionControls: REVENANT_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveRevenantSkillLoadout }
  );
  const context = factory(input(build));
  const config = context.simulationConfig();
  assert.ok(context.selectedSkillIds.includes(REVENANT.SOOTHING_STONE));
  assert.ok(!context.selectedSkillIds.includes(REVENANT.ENCHANTED_DAGGERS));
  assert.equal(
    config.skillInputBars.find((bar) => bar.id === LEGEND.ASSASSIN).slots['slot-6'],
    REVENANT.ENCHANTED_DAGGERS
  );
  assert.equal(config.skillInputBars.find((bar) => bar.id === LEGEND.DWARF).slots['slot-6'], REVENANT.SOOTHING_STONE);
  assert.equal(config.professionAssumptions.hitboxSize, 'small');
  config.skillInputBars[0].slots['slot-6'] = -1;
  assert.equal(context.simulationConfig().skillInputBars[0].slots['slot-6'], REVENANT.ENCHANTED_DAGGERS);
});

test('headless ordinary loadouts preserve empty slots and specialization-scoped assumption defaults', async () => {
  const module = await loadBuildContext('engineer');
  const build = module.toApplicationBuild(module.profession.createBuildDefaults());
  const utility = Object.values(build.selectedSkillIds).find((id) => id != null);
  assert.ok(utility != null);
  build.selectedSkillIds = { Heal: null, Utility1: null, Utility2: utility, Utility3: null, Elite: null };
  delete build.assumptions.inDamagingField;
  const factory = bindBuildContext(
    withoutPresentation(module.profession),
    (current, _skills, set) => module.createBuildContext(input(current)).attributes(set),
    () => ({}),
    { assumptionControls: ENGINEER_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveSelectedSkillLoadout }
  );
  build.specializations = [{ name: 'Amalgam', traits: '1-1-1' }];
  const config = factory(input(build)).simulationConfig();
  assert.deepEqual(config.selectedSkillIds, [utility]);
  assert.deepEqual(config.skillInputBars, [{ id: 'selected', slots: { 'slot-8': utility } }]);
  assert.equal(config.professionAssumptions.inDamagingField, false);
  build.assumptions.inDamagingField = true;
  assert.equal(factory(input(build)).simulationConfig().professionAssumptions.inDamagingField, true);
  build.specializations = [];
  assert.equal(Object.hasOwn(factory(input(build)).simulationConfig().professionAssumptions, 'inDamagingField'), false);
});

test('profession starting resources and selections survive headless composition', async () => {
  const fields = {
    elementalist: [
      'startAttunement',
      'secondaryAttunement',
      'initialCatalystEnergy',
      'evokerElement',
      'initialEvokerCharges',
      'initialEvokerEmpowered',
      'pistolBullets'
    ],
    engineer: ['initialHeat', 'selectedMorphSkillIds'],
    guardian: ['initialTomePages'],
    necromancer: ['initialResource', 'initialBlight', 'initialCascadingCorruptionStacks'],
    ranger: [
      'initialAstralForce',
      'initialArrows',
      'selectedPet',
      'selectedPet2',
      'selectedHammerSkillIds',
      'initialUntamedState'
    ],
    revenant: ['initialEnergy', 'selectedLegends', 'startingLegend'],
    thief: ['initialInitiative', 'initialSpinningAxes', 'initialPreSteal', 'initialShadowForce', 'selectedDodge'],
    warrior: ['initialResource']
  };
  for (const [id, names] of Object.entries(fields)) {
    const module = await loadBuildContext(id);
    const build = module.toApplicationBuild(module.profession.createBuildDefaults());
    const config = module.createBuildContext(input(build)).simulationConfig();
    for (const name of names) assert.deepEqual(config[name], build[name], `${id}.${name}`);
    const resource = { engineer: 'initialHeat', revenant: 'initialEnergy', thief: 'initialInitiative' }[id];
    if (resource) assert.equal(config.initialResource, build[resource]);
  }

  const mesmer = await loadBuildContext('mesmer');
  const build = mesmer.toApplicationBuild(mesmer.profession.createBuildDefaults());
  build.initialResource = 3;
  for (const name of ['Virtuoso', 'Troubadour', 'Chronomancer']) {
    build.specializations = [{ name, traits: '1-1-1' }];
    assert.equal(
      mesmer.createBuildContext(input(build)).simulationConfig().initialResource,
      name === 'Chronomancer' ? 0 : 3
    );
  }
});

test('optimizer requirements reuse cached sets, reject early, and keep each candidate independent', async () => {
  const module = await loadOptimizerContext('warrior');
  const build = module.toApplicationBuild(module.profession.createBuildDefaults());
  const calls = [];
  const factory = bindBuildContext(
    module.profession,
    (_build, _skills, set) => {
      calls.push(set);
      return module.createBuildContext(input(_build)).attributes(set);
    },
    () => ({}),
    { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
  );
  const adapter = { ...module, createBuildContext: factory };
  const request = {
    gameId: 'gw2',
    contentId: 'warrior',
    revision: 0,
    build,
    patchId: 'current',
    observationPolicy: { kind: 'rotation' },
    selections: { minToughness: 99999 },
    limit: 20
  };
  const rejected = createOptimizerEvaluator(request, adapter);
  assert.equal(rejected.prepare(build, true), null);
  assert.deepEqual(calls, [1]);
  calls.length = 0;
  const accepted = createOptimizerEvaluator({ ...request, selections: { minToughness: 0 } }, adapter);
  assert.ok(accepted.prepare(build, true));
  assert.deepEqual(calls, [1, 2]);
  accepted.prepare(build, true);
  assert.deepEqual(calls, [1, 2, 1, 2]);
});
