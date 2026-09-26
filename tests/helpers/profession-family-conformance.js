import assert from 'node:assert/strict';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { GW2_RESOLVER_STAGES } from '#gw2/platform/resolver/reaction-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

const EXECUTABLE_FAMILY_KEYS = Object.freeze([
  'createState',
  'taskHandlers',
  'eventHandlers',
  'eventReactions',
  'initialize',
  'availability',
  'modifyAttributes',
  'modifyStrikeDamage'
]);

const UI_LIST_CALLBACKS = Object.freeze(['paletteGroups', 'resourceViews', 'skillBarGroups', 'targetHealthThresholds']);

const CANONICAL_REACTION_STAGES = new Set(GW2_RESOLVER_STAGES);

function sortedIds(entries) {
  return entries.map((entry) => String(entry.id)).sort();
}

function registryKeys(core, specialization, container, key) {
  const hooks = (module) => module?.mechanics?.live;

  return [...Object.keys(hooks(core)?.[key] || {}), ...Object.keys(hooks(specialization)?.[key] || {})].sort();
}

function presentationFor(module, catalog) {
  const presentation = module?.presentation;

  return typeof presentation === 'function' ? presentation(catalog) : presentation || {};
}

function reactionKeys(...modules) {
  return [...new Set(modules.flatMap((module) => [...Object.keys(module?.mechanics?.live?.reactions || {})]))].sort();
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
  const skillOwners = getNativeCatalogAssembly(modules, undefined).skillOwners;

  assertUniqueOwners(
    modules,
    (module) => modifierRules(module).map((rule) => String(rule.id)),
    `${family.id} modifier`
  );
  assertUniqueOwners(
    modules,
    (module) => Object.keys(module.mechanics?.live?.tasks || {}),
    `${family.id} task handler`
  );
  assertUniqueOwners(
    modules,
    (module) => Object.keys(module.mechanics?.live?.eventHandlers || {}),
    `${family.id} event handler`
  );
  for (const key of EXECUTABLE_FAMILY_KEYS) {
    assert.equal(Object.hasOwn(family, key), false, `${family.id}.${key}`);
  }

  for (const [name, specialization] of [['Core', null], ...Object.entries(specializations)]) {
    const config = { specialization: name };
    const runtime = family.liveRuntimeFor(config);

    assert.equal(family.liveRuntimeFor(config), runtime, `${family.id}/${name}`);
    assert.equal(runtime.id, family.id);
    const state = runtime.createState(config);
    const expectedCoreState = core.state.create(config);
    const expectedSpecializationState = specialization ? specialization.state.create(config) : {};

    // Resource capacities are initialized by the runtime after the raw state factory.
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
          const owner = skillOwners.get(skill.id);

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
      Object.keys(runtime.tasks ?? {}).sort(),
      registryKeys(core, specialization, 'live', 'tasks'),
      `${family.id}/${name} task handlers`
    );
    assert.deepEqual(
      Object.keys(runtime.eventHandlers ?? {}).sort(),
      registryKeys(core, specialization, 'live', 'eventHandlers'),
      `${family.id}/${name} event handlers`
    );
    assert.deepEqual(
      Object.keys(runtime.reactions ?? {}).sort(),
      reactionKeys(core, specialization),
      `${family.id}/${name} event reactions`
    );
    assert.equal(
      Object.keys(runtime.reactions ?? {}).every((stage) => CANONICAL_REACTION_STAGES.has(stage)),
      true,
      `${family.id}/${name} canonical resolver stages`
    );

    // Live-owned families preview capacity from their live endurance policy, as the family presentation does.
    const live = core.mechanics?.live && (!specialization || specialization.mechanics?.live);
    const previewEndurance = live ? family.liveRuntimeFor(config).endurance : runtime.resources.endurance;
    const context = {
      catalog: family.catalog,
      resources: previewEndurance
        ? { endurance: { maximum: previewEndurance.maximum({ catalog: family.catalog, config }) } }
        : {},
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

    assert.equal(Object.hasOwn(runtime, 'ui'), false, 'runtime does not carry presentation');
    for (const control of activePresentations.flatMap((ui) => ui.assumptionControls || [])) {
      assert.ok(family.ui.assumptionControls.some((candidate) => candidate.id === control.id));
    }

    for (const callback of UI_LIST_CALLBACKS) {
      const expected = activePresentations.flatMap((ui) =>
        typeof ui[callback] === 'function' ? ui[callback](context) : []
      );

      const actual = family.ui[callback](context);
      if (callback === 'paletteGroups') {
        // The application sorts and combines anchored groups; every surviving group still needs an active owner.
        assert.ok(
          actual.every((group) => expected.some((candidate) => candidate.id === group.id)),
          `${family.id}/${name} palette owners`
        );
      } else {
        const byIdentity = (left, right) => String(left?.id ?? left).localeCompare(String(right?.id ?? right));
        assert.deepEqual(
          [...actual].sort(byIdentity),
          [...expected].sort(byIdentity),
          `${family.id}/${name} ui.${callback}`
        );
      }
    }

    // A migrated projection must reflect its registered live initializer, including native resource policies.
    const projected = simulateGw2({ profession: family, rotation: [], config }).planningState.profession;

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
