import assert from 'node:assert/strict';
import { nativeSkillRuntimeOwner } from '../../js/games/gw2/integrations/patches/authoring/catalog.js';
import { GW2_RESOLVER_STAGES } from '../../js/games/gw2/platform/resolver/reaction-registry.js';
import { simulateGw2 } from '../../js/games/gw2/platform/simulation/simulate.js';

const EXECUTABLE_FAMILY_KEYS = Object.freeze([
  'createProfessionState',
  'createResolverState',
  'taskHandlers',
  'eventHandlers',
  'eventReactions',
  'initialize',
  'availability',
  'scheduleSkill',
  'modifyAttributes',
  'modifyStrikeDamage'
]);

const UI_LIST_CALLBACKS = Object.freeze(['paletteGroups', 'resourceViews', 'skillBarGroups', 'targetHealthThresholds']);

const CANONICAL_REACTION_STAGES = new Set(GW2_RESOLVER_STAGES);

function sortedIds(entries) {
  return entries.map((entry) => String(entry.id)).sort();
}

function registryKeys(core, specialization, container, key) {
  return [
    ...Object.keys(core.mechanics?.[container]?.[key] || {}),
    ...Object.keys(specialization?.mechanics?.[container]?.[key] || {})
  ].sort();
}

function presentationFor(module, catalog) {
  const presentation = module?.presentation;

  return typeof presentation === 'function' ? presentation(catalog) : presentation || {};
}

function reactionKeys(...modules) {
  return [
    ...new Set(
      modules.flatMap((module) => [
        ...Object.keys(module?.mechanics?.resolverHooks?.eventReactions || {}),
        ...(module?.mechanics?.reactions || []).map((reaction) => reaction.stage)
      ])
    )
  ].sort();
}

function modifierRules(module) {
  const modifiers = module?.mechanics?.modifiers;

  return Array.isArray(modifiers) ? modifiers : modifiers?.modifierRules || [];
}

function assertUniqueOwners(modules, select, label) {
  const owners = new Map();

  for (const module of modules) {
    for (const id of select(module)) {
      assert.equal(owners.has(id), false, `${label} ${id} is owned by both ${owners.get(id)} and ${module.id}`);
      owners.set(id, module.id);
    }
  }
}

export function assertProfessionFamilyConformance({ family, core, specializations }) {
  assert.equal(typeof family.resolveRuntime, 'function');
  const modules = [core, ...Object.values(specializations)];

  assertUniqueOwners(
    modules,
    (module) => modifierRules(module).map((rule) => String(rule.id)),
    `${family.id} modifier`
  );
  assertUniqueOwners(
    modules,
    (module) => Object.keys(module.mechanics?.schedulerHooks?.taskHandlers || {}),
    `${family.id} task handler`
  );
  assertUniqueOwners(
    modules,
    (module) => Object.keys(module.mechanics?.resolverHooks?.eventHandlers || {}),
    `${family.id} event handler`
  );
  for (const key of EXECUTABLE_FAMILY_KEYS) {
    assert.equal(Object.hasOwn(family, key), false, `${family.id}.${key}`);
  }

  for (const [name, specialization] of [['Core', null], ...Object.entries(specializations)]) {
    const config = { specialization: name };
    const runtime = family.resolveRuntime(config);

    assert.equal(family.resolveRuntime(config), runtime, `${family.id}/${name}`);
    assert.equal(runtime.id, family.id);
    const state = runtime.createProfessionState(config);
    const expectedCoreState = core.state.scheduler(config);
    const expectedSpecializationState = specialization ? specialization.state.scheduler(config) : {};

    assert.deepEqual(Object.keys(state).sort(), ['core', 'specialization']);
    assert.deepEqual(state.core, expectedCoreState, `${family.id}/${name} core state`);
    assert.equal(state.specialization.kind, name);
    assert.deepEqual(
      state.specialization.state,
      expectedSpecializationState,
      `${family.id}/${name} specialization state`
    );
    assert.deepEqual(
      sortedIds(runtime.catalog.skills),
      sortedIds(
        family.catalog.skills.filter((skill) => {
          const owner = nativeSkillRuntimeOwner(modules, skill);

          return owner === 'Core' || owner === name;
        })
      ),
      `${family.id}/${name} skills`
    );
    assert.deepEqual(
      sortedIds(runtime.catalog.traits),
      sortedIds([...(core.data.traits || []), ...(specialization?.data.traits || [])]),
      `${family.id}/${name} traits`
    );
    assert.deepEqual(
      sortedIds(runtime.catalog.specializations),
      sortedIds([...(core.data.specializations || []), ...(specialization?.data.specializations || [])]),
      `${family.id}/${name} specializations`
    );
    assert.deepEqual(
      [...runtime.catalog.skillHandlers.keys()].sort(),
      [...new Set(runtime.catalog.skills.map((skill) => String(skill.handlerId || '')).filter(Boolean))].sort(),
      `${family.id}/${name} skill handlers`
    );
    assert.deepEqual(
      Object.keys(runtime.taskHandlers).sort(),
      registryKeys(core, specialization, 'schedulerHooks', 'taskHandlers'),
      `${family.id}/${name} task handlers`
    );
    assert.deepEqual(
      Object.keys(runtime.eventHandlers).sort(),
      registryKeys(core, specialization, 'resolverHooks', 'eventHandlers'),
      `${family.id}/${name} event handlers`
    );
    assert.deepEqual(
      Object.keys(runtime.eventReactions).sort(),
      reactionKeys(core, specialization),
      `${family.id}/${name} event reactions`
    );
    assert.equal(
      Object.keys(runtime.eventReactions).every((stage) => CANONICAL_REACTION_STAGES.has(stage)),
      true,
      `${family.id}/${name} canonical resolver stages`
    );

    const context = {
      config,
      build: { ...family.createBuildDefaults(), specialization: name },
      state: { profession: state },
      professionState: state,
      time: 0
    };
    const activePresentations = [
      presentationFor(core, family.catalog),
      ...(specialization ? [presentationFor(specialization, family.catalog)] : [])
    ];

    assert.deepEqual(
      runtime.ui.assumptionControls,
      activePresentations.flatMap((ui) => ui.assumptionControls || []),
      `${family.id}/${name} assumption controls`
    );
    for (const callback of UI_LIST_CALLBACKS) {
      const expected = activePresentations.flatMap((ui) =>
        typeof ui[callback] === 'function' ? ui[callback](context) : []
      );

      assert.deepEqual(runtime.ui[callback](context), expected, `${family.id}/${name} ui.${callback}`);
    }

    const projected = simulateGw2({
      profession: family,
      rotation: [],
      config
    }).endState.profession;

    assert.ok(projected && typeof projected === 'object');
    assert.equal(Object.hasOwn(projected, 'core'), false);
    assert.equal(Object.hasOwn(projected, 'specialization'), false);
    assert.doesNotThrow(() => JSON.stringify(projected));
  }

  assert.throws(
    () => family.resolveRuntime({ specialization: '__missing__' }),
    /Unknown .* elite specialization "__missing__"/
  );
}
