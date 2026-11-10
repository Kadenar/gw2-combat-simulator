import assert from 'node:assert/strict';
import test from 'node:test';

import { loadOptimizerContext } from '#gw2/app/optimizer/gear/context.js';
import { createOptimizerEvaluator, createOptimizerSpace } from '#gw2/app/optimizer/gear/search.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { loadBuildContext } from '#gw2/build-context/load.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import { remainingTargetHealthBelow, remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/professions/engineer/build/assumptions.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { REVENANT_ASSUMPTION_CONTROLS } from '#gw2/professions/revenant/build/assumptions.js';
import { resolveRevenantSkillLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as REVENANT } from '#gw2/professions/revenant/data/ids.js';
import { captureAnalysisFixture } from '#tests/helpers/analysis-requests.js';

const input = (profession, build, patchId = 'current') => ({
  build,
  patch: profession.resolvePatch({ id: patchId }),
  transitionDelays: normalizeTransitionDelays()
});

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
      const context = module.createBuildContext(input(module.profession, build, patchId));
      const configBeforePreview = context.simulationConfig();
      const first = context.attributes(1);
      assert.equal(context.attributes(1), first);
      const config = context.simulationConfig();
      assert.deepEqual(config, configBeforePreview);
      assert.deepEqual(
        config.selectedTraitIds,
        first.activeTraits.map((trait) => trait.id)
      );
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

    assert.throws(
      () => module.createBuildContext(input(module.profession, build, 'removed-preview')),
      /Unknown .*patch/
    );
    assert.throws(() => module.createBuildContext(input(module.profession, build)).attributes(0), /Weapon set/);
  });
}

// Unbounded targets hold the chosen percentage; finite targets still lose health to every damage owner.
test('target configuration preserves starting health for unbounded and finite targets', async () => {
  const module = await loadBuildContext('mesmer');
  const afterDamage = { totals: { strike: 100, condition: 50 }, environmentDamage: 100 };
  const configFor = (targetHealth, targetStartingHealthPercent) => {
    const build = module.toApplicationBuild({
      ...module.profession.createBuildDefaults(),
      targetHealth,
      targetStartingHealthPercent
    });
    return module.createBuildContext(input(module.profession, build)).simulationConfig();
  };

  for (const percent of [0, 40, 50, 100]) {
    const config = configFor(0, percent);
    assert.equal(remainingTargetHealthFraction(config), percent / 100);
    assert.equal(remainingTargetHealthFraction(config, afterDamage), percent / 100);
    assert.equal(remainingTargetHealthBelow(config, afterDamage, 0.5), percent < 50);
  }

  const defaultHealth = configFor(0, undefined);
  assert.equal(remainingTargetHealthFraction(defaultHealth, afterDamage), 1);
  const finite = configFor(1000, 50);
  assert.equal(remainingTargetHealthFraction(finite), 0.5);
  assert.equal(remainingTargetHealthBelow(finite, undefined, 0.5), false);
  assert.equal(remainingTargetHealthFraction(finite, afterDamage), 0.25);
  assert.equal(remainingTargetHealthBelow(finite, afterDamage, 0.5), true);
});

test('a selected preview supplies both the attribute catalog and balance context', async () => {
  const module = await loadBuildContext('mesmer');
  const build = module.toApplicationBuild(module.profession.createBuildDefaults());
  const profession = withPatchPreview(withoutPresentation(mesmerProfession), {
    id: 'context-preview',
    label: 'Context preview'
  });
  let seen;
  const factory = bindBuildContext(
    // Inherit the real profession without evaluating its lazy presentation getter while installing the spy.
    withoutPresentation(
      Object.create(profession, {
        attributeContributions: {
          value(facts) {
            seen = facts;
            return profession.attributeContributions(facts);
          }
        }
      })
    )
  )(() => ({}), { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout });
  const context = factory(input(profession, build, 'context-preview'));
  context.simulationConfig();
  assert.equal(seen, undefined);
  context.attributes(1);
  assert.equal(seen.balanceContext, profession.resolvePatch({ id: 'context-preview' }).balanceContext);
  assert.equal(seen.catalog, profession.resolvePatch({ id: 'context-preview' }).catalog);
  assert.deepEqual(seen.config.selectedSkillIds, context.selectedSkillIds);
  assert.equal(context.simulationConfig().patchId, 'context-preview');
});

test('Revenant starting legend determines skills regardless of displayed set or previous results', async () => {
  const module = await loadBuildContext('revenant');
  const build = module.toApplicationBuild({
    ...module.profession.createBuildDefaults(),
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DWARF],
    startingLegend: LEGEND.ASSASSIN
  });
  const context = module.createBuildContext(input(module.profession, build));
  const loadout = resolveRevenantSkillLoadout(build, context.specialization);
  const expected = loadout.bars.find((bar) => bar.id === LEGEND.ASSASSIN).skillIds;
  context.attributes(2);
  assert.deepEqual(context.selectedSkillIds, expected);
  assert.deepEqual(context.simulationConfig().selectedSkillIds, expected);
  const { revenantAppAdapter } = await import('#gw2/professions/revenant/app/app-definition.js');
  const app = {
    build,
    patch: module.profession.resolvePatch({ id: 'current' }),
    attributeWeaponSet: 2,
    attributeData: { activeTraits: [] },
    results: { planningState: { profession: { activeLegend: LEGEND.DWARF } } }
  };
  assert.deepEqual(
    captureAnalysisFixture(app, revenantAppAdapter).distribution().baseConfig.selectedSkillIds,
    expected
  );
});

test('headless fixed loadouts retain both bars while attribute skills follow the starting legend', async () => {
  const module = await loadBuildContext('revenant');
  const build = module.toApplicationBuild({
    ...module.profession.createBuildDefaults(),
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DWARF],
    startingLegend: LEGEND.DWARF
  });
  const factory = bindBuildContext(withoutPresentation(module.profession))(() => ({}), {
    assumptionControls: REVENANT_ASSUMPTION_CONTROLS,
    resolveSkillLoadout: resolveRevenantSkillLoadout
  });
  const context = factory(input(module.profession, build));
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
  const factory = bindBuildContext(withoutPresentation(module.profession))(() => ({}), {
    assumptionControls: ENGINEER_ASSUMPTION_CONTROLS,
    resolveSkillLoadout: resolveSelectedSkillLoadout
  });
  build.specializations = [{ name: 'Amalgam', traits: '1-1-1' }];
  const config = factory(input(module.profession, build)).simulationConfig();
  assert.deepEqual(config.selectedSkillIds, [utility]);
  assert.deepEqual(config.skillInputBars, [{ id: 'selected', slots: { 'slot-8': utility } }]);
  assert.equal(config.professionAssumptions.inDamagingField, false);
  build.assumptions.inDamagingField = true;
  assert.equal(factory(input(module.profession, build)).simulationConfig().professionAssumptions.inDamagingField, true);
  build.specializations = [];
  assert.equal(
    Object.hasOwn(factory(input(module.profession, build)).simulationConfig().professionAssumptions, 'inDamagingField'),
    false
  );
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
    const config = module.createBuildContext(input(module.profession, build)).simulationConfig();
    for (const name of names) assert.deepEqual(config[name], build[name], `${id}.${name}`);

    // Only professions whose resource policy consumes the generic field should publish it.
    if (['engineer', 'revenant', 'thief'].includes(id)) assert.equal(Object.hasOwn(config, 'initialResource'), false);
  }

  const mesmer = await loadBuildContext('mesmer');
  const build = mesmer.toApplicationBuild(mesmer.profession.createBuildDefaults());
  build.initialResource = 3;
  for (const name of ['Virtuoso', 'Troubadour', 'Chronomancer']) {
    build.specializations = [{ name, traits: '1-1-1' }];
    assert.equal(
      mesmer.createBuildContext(input(mesmer.profession, build)).simulationConfig().initialResource,
      name === 'Chronomancer' ? 0 : 3
    );
  }
});

test('optimizer requirements reuse cached sets, reject early, and keep each candidate independent', async () => {
  const module = await loadOptimizerContext('warrior');
  const build = module.toApplicationBuild(module.profession.createBuildDefaults());
  const calls = [];
  const factory = bindBuildContext({
    ...module.profession,
    attributeContributions: (facts) => {
      calls.push(facts.weaponSet);
      return module.profession.attributeContributions(facts);
    }
  })(() => ({}), { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout });
  const adapter = { ...module, createBuildContext: factory };
  const request = {
    gameId: 'gw2',
    contentId: 'warrior',
    revision: 0,
    build,
    patch: module.profession.resolvePatch({ id: 'current' }),
    observationPolicy: { kind: 'rotation' },
    selections: { minToughness: 99999 },
    limit: 20
  };
  // Configuration-only candidates never evaluate preview contributions.
  const unconstrained = createOptimizerEvaluator(
    createOptimizerSpace({ ...request, selections: {} }, adapter),
    adapter
  );
  assert.ok(unconstrained.prepare(build, true));
  assert.deepEqual(calls, []);
  const rejected = createOptimizerEvaluator(createOptimizerSpace(request, adapter), adapter);
  assert.equal(rejected.prepare(build, true), null);
  assert.deepEqual(calls, [1]);
  calls.length = 0;
  const accepted = createOptimizerEvaluator(
    createOptimizerSpace({ ...request, selections: { minToughness: 0 } }, adapter),
    adapter
  );
  assert.ok(accepted.prepare(build, true));
  assert.deepEqual(calls, [1, 2]);
  accepted.prepare(build, true);
  assert.deepEqual(calls, [1, 2, 1, 2]);
});
