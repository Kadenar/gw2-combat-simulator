import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assembleNativeApplicationCatalog,
  createNativeModuleData,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { onResolvedCriticalHit, onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createProfessionModuleDataFactory } from '#gw2/professions/shared/catalog-data.js';

const replaceHandler = Object.freeze({
  mode: 'replace',
  beforeEffects: () => undefined
});
const skill = (id, name, extra = {}) =>
  Object.freeze({
    id,
    name,
    castTimeMs: 0,
    effects: [],
    ...extra
  });
const coreModule = () =>
  defineNativeModule({
    id: 'Core',
    data: {
      generatedSkills: [skill(1, 'Core Skill', { handlerId: 'test.core' })],
      traits: [{ id: 10, name: 'Core Trait', specialization: 'Core Line' }],
      specializations: [{ id: 20, name: 'Core Line', elite: false }],
      weapons: ['Sword'],
      weaponHands: { Sword: 'mh' }
    },
    state: { scheduler: () => ({ coreValue: 1 }) },
    mechanics: { execution: { skillHandlers: { 'test.core': replaceHandler } } }
  });
const eliteModule = () =>
  defineNativeModule({
    id: 'Elite',
    data: {
      generatedSkills: [
        skill(2, 'Elite Skill', {
          specialization: 'Elite',
          handlerId: 'test.elite'
        }),
        skill(3, 'Elite Mechanic Weapon', {
          type: 'Weapon',
          specialization: 'Elite'
        })
      ],
      traits: [{ id: 11, name: 'Elite Trait', specialization: 'Elite' }],
      specializations: [{ id: 21, name: 'Elite', elite: true }]
    },
    state: { scheduler: () => ({ eliteValue: 2 }) },
    mechanics: { execution: { skillHandlers: { 'test.elite': replaceHandler } } }
  });

test('native module data admits only mechanics-backed metadata and explicit extra skills', () => {
  const data = createNativeModuleData({
    id: 'Core',
    generatedSkills: [skill(1, 'Authored'), skill(2, 'Metadata only')],
    sharedExtraSkills: [skill(3, 'Authored supplemental'), skill(4, 'Metadata-only supplemental')],
    skillMechanics: {
      1: { effects: [] },
      3: { effects: [] }
    },
    extraSkills: [skill(5, 'Explicit extra')]
  });

  assert.deepEqual(
    data.generatedSkills.map(({ id }) => id),
    [1]
  );
  assert.deepEqual(
    data.extraSkills.map(({ id }) => id),
    [3, 5]
  );
});

// Exercise binding with real defaults so omitted options cannot silently erase Core-owned declarations.
test('profession catalog binding scopes Core defaults and replaces explicit module options without leaking them', () => {
  const core = Object.freeze({
    weapons: Object.freeze(['Sword']),
    weaponHands: Object.freeze({ Sword: 'mh' }),
    autoattackChains: Object.freeze({
      additional: Object.freeze([Object.freeze([1, 2])]),
      excludeSkillIds: Object.freeze([3])
    }),
    skillNameOverrides: Object.freeze({ Strike: 1, Slash: 2 })
  });
  const family = Object.freeze({ core });
  const createData = createProfessionModuleDataFactory(family);
  const options = Object.freeze({ skillMechanics: Object.freeze({}) });
  const defaults = createData('Core', options);
  const omitted = createData('Core', { ...options, autoattackChains: undefined, skillNameOverrides: undefined });
  assert.deepEqual(omitted, defaults);
  assert.deepEqual(defaults.weapons, ['Sword']);
  assert.deepEqual(defaults.weaponHands, { Sword: 'mh' });
  assert.deepEqual(defaults.autoattackChains, core.autoattackChains);
  assert.deepEqual(defaults.skillNameOverrides, core.skillNameOverrides);

  const overrides = Object.freeze({
    ...options,
    autoattackChains: Object.freeze({ additional: Object.freeze([Object.freeze([4, 5])]) }),
    skillNameOverrides: Object.freeze({ Strike: 4 })
  });
  for (const id of ['Core', 'Elite']) {
    const data = createData(id, overrides);
    assert.deepEqual(data.autoattackChains, overrides.autoattackChains);
    assert.deepEqual(data.skillNameOverrides, overrides.skillNameOverrides);
  }

  const cleared = createData('Core', { ...options, autoattackChains: {}, skillNameOverrides: {} });
  assert.deepEqual(cleared.autoattackChains, {});
  assert.deepEqual(cleared.skillNameOverrides, {});
  assert.deepEqual(createData('Core', options), defaults);
  const elite = createData('Elite', options);
  for (const field of ['weapons', 'weaponHands', 'autoattackChains', 'skillNameOverrides']) {
    assert.equal(Object.hasOwn(elite, field), false);
  }

  assert.equal(Object.isFrozen(defaults), true);
  assert.deepEqual(options, { skillMechanics: {} });
});

// Interleaved source metadata verifies admission, ownership, and ordering through the existing assembler.
test('profession catalog binding preserves authored admission, specialization selection, and source order', () => {
  const createData = createProfessionModuleDataFactory({
    generatedSkills: [skill(2, 'Elite skill'), skill(9, 'Unsupported'), skill(1, 'Core skill')],
    sharedExtraSkills: [
      skill(4, 'Elite supplemental'),
      skill(8, 'Unsupported supplemental'),
      skill(3, 'Core supplemental')
    ],
    traits: [
      { id: 10, name: 'Core trait', specialization: 'Core Line' },
      { id: 11, name: 'Elite trait', specialization: 'Elite' },
      { id: 12, name: 'Other trait', specialization: 'Other' }
    ],
    specializations: [
      { id: 20, name: 'Core Line', elite: false },
      { id: 21, name: 'Elite', elite: true },
      { id: 22, name: 'Other', elite: true }
    ],
    specializationOnlySkills: { Elite: [2] }
  });
  const core = createData('Core', {
    skillMechanics: { 1: {}, 3: {} },
    skillOverrides: { 1: { cooldown: 5 }, 2: { cooldown: 10 } },
    extraSkills: [skill(5, 'Explicit extra')],
    balanceProfiles: [{ id: 'fixture.profile', name: 'Fixture profile', profileKind: 'mechanic' }]
  });
  const elite = createData('Elite', { skillMechanics: { 2: {}, 4: {} } });
  assert.deepEqual(
    core.generatedSkills.map(({ id }) => id),
    [1]
  );
  assert.deepEqual(
    core.extraSkills.map(({ id }) => id),
    [3, 5]
  );
  assert.deepEqual(core.skillOverrides, { 1: { cooldown: 5 } });
  assert.deepEqual(core.balanceProfiles, [{ id: 'fixture.profile', name: 'Fixture profile', profileKind: 'mechanic' }]);
  assert.deepEqual(elite.balanceProfiles, []);
  assert.deepEqual(
    elite.extraSkills.map(({ id }) => id),
    [4]
  );
  assert.deepEqual(
    core.traits.map(({ id }) => id),
    [10]
  );
  assert.deepEqual(
    core.specializations.map(({ id }) => id),
    [20]
  );
  assert.deepEqual(
    elite.traits.map(({ id }) => id),
    [11]
  );
  assert.deepEqual(
    elite.specializations.map(({ id }) => id),
    [21]
  );
  assert.deepEqual(elite.specializationOnlySkillIds, [2]);
  assert.deepEqual([...core.generatedSkillOrder], [[1, 2]]);
  assert.deepEqual([...elite.generatedSkillOrder], [[2, 0]]);
  assert.deepEqual([...core.sharedExtraSkillOrder], [[3, 2]]);
  assert.deepEqual([...elite.sharedExtraSkillOrder], [[4, 0]]);
  assert.equal(core.specializationOnlySkillIds, undefined);
  assert.deepEqual(
    createData('Elite', { skillMechanics: {}, specializationOnlySkillIds: [4] }).specializationOnlySkillIds,
    [4]
  );
  assert.equal(
    createData('Elite', { skillMechanics: {}, specializationOnlySkillIds: [] }).specializationOnlySkillIds,
    undefined
  );

  const modules = [core, elite].map((data, index) =>
    defineNativeModule({
      id: index === 0 ? 'Core' : 'Elite',
      data,
      state: { scheduler: () => ({}) }
    })
  );
  const assembly = getNativeCatalogAssembly(modules, undefined);
  assert.deepEqual(
    assembly.catalog.skills.map(({ id }) => id),
    [2, 1, 3, 4, 5]
  );
  assert.equal(assembly.skillOwners.get(2), 'Elite');
});

test('module-first assembly derives application and active runtime catalogs', () => {
  const modules = [coreModule(), eliteModule()];
  const catalog = assembleNativeApplicationCatalog(modules);
  const skillOwners = getNativeCatalogAssembly(modules, undefined).skillOwners;
  const family = defineNativeProfession({
    id: 'fixture',
    name: 'Fixture',
    modules
  });

  assert.equal(family.catalog, catalog);
  assert.deepEqual(catalog.skills.map(({ id }) => id).sort(), [1, 2, 3]);
  assert.equal(skillOwners.get(3), 'Core');
  assert.deepEqual(
    family.resolveRuntime({ specialization: 'Core' }).catalog.skills.map(({ id }) => id),
    [1, 3]
  );
  assert.deepEqual(
    family
      .resolveRuntime({ specialization: 'Elite' })
      .catalog.skills.map(({ id }) => id)
      .sort(),
    [1, 2, 3]
  );
  assert.deepEqual(family.specializationIds, ['Elite']);
  assert.equal(family.resolveRuntime({ specialization: 'Core' }).catalog.skillHandlers.has('test.elite'), false);
  assert.equal(family.resolveRuntime({ specialization: 'Elite' }).catalog.skillHandlers.has('test.elite'), true);
});

test('module-first assembly rejects duplicate and incomplete contributions', () => {
  const core = coreModule();

  assert.throws(
    () =>
      assembleNativeApplicationCatalog([
        core,
        defineNativeModule({
          id: 'Duplicate',
          data: { generatedSkills: [skill(1, 'Duplicate')] },
          state: { scheduler: () => ({}) }
        })
      ]),
    /Duplicate generated skill id 1/
  );
  assert.throws(
    () =>
      assembleNativeApplicationCatalog([
        core,
        defineNativeModule({
          id: 'DuplicateHand',
          data: { weapons: ['Sword'], weaponHands: { Sword: 'oh' } },
          state: { scheduler: () => ({}) }
        })
      ]),
    /Duplicate weapon-hand entry Sword/
  );
  assert.throws(
    () =>
      assembleNativeApplicationCatalog([
        core,
        defineNativeModule({
          id: 'UnusedHandler',
          data: {},
          state: { scheduler: () => ({}) },
          mechanics: { execution: { skillHandlers: { 'test.unused': replaceHandler } } }
        })
      ]),
    /Skill handler test\.unused is unused/
  );
  assert.throws(
    () => defineNativeModule({ id: 'Broken', data: {}, state: {} }),
    /Broken\.state\.scheduler must be a function/
  );
});

test('phase-explicit reactions retain stable order', () => {
  const calls = [];
  const core = defineNativeModule({
    id: 'Core',
    data: {},
    state: { scheduler: () => ({}) },
    mechanics: {
      resolution: {
        reactions: [
          onResolvedDamage({
            id: 'later',
            order: 20,
            handler: () => calls.push('later')
          }),
          onResolvedDamage({
            id: 'first',
            order: -10,
            handler: () => calls.push('first')
          }),
          onResolvedDamage({
            id: 'middle',
            order: 0,
            handler: () => calls.push('middle')
          })
        ]
      }
    }
  });
  const runtime = defineNativeProfession({
    id: 'ordered',
    name: 'Ordered',
    modules: [core]
  }).resolveRuntime({ specialization: 'Core' });

  runtime.eventReactions['damage.resolved']({}, { type: 'damage', at: 0 }, {});
  assert.deepEqual(calls, ['first', 'middle', 'later']);
});

test('phase-scoped module sections compile without duplicating their canonical content definition', () => {
  const calls = [];
  const handlers = Object.freeze({ 'test.phase-scoped': replaceHandler });
  const phaseScopedSkill = skill(101, 'Phase-scoped Skill', { handlerId: 'test.phase-scoped' });
  const core = defineNativeModule({
    id: 'Core',
    data: { generatedSkills: [phaseScopedSkill] },
    state: { scheduler: () => ({}) },
    mechanics: {
      execution: {
        skillHandlers: handlers,
        availability: {
          phase: 'scheduler',
          hook: 'availability',
          id: 'test.phase-scoped-availability',
          order: 0,
          handler: () => ({ ready: true })
        }
      },
      resolution: {
        reactions: [
          onResolvedDamage({
            id: 'test.phase-scoped-damage',
            handler: () => calls.push('resolved')
          })
        ]
      }
    }
  });
  const runtime = defineNativeProfession({
    id: 'phase-scoped',
    name: 'Phase scoped',
    modules: [core]
  }).resolveRuntime({ specialization: 'Core' });

  assert.equal(core.data.handlers, undefined);
  assert.equal(core.mechanics.execution.skillHandlers, handlers);
  assert.deepEqual(runtime.skillHandlerFor(runtime.catalog.skillsById.get(101)), replaceHandler);
  assert.equal(typeof runtime.availability, 'function');
  runtime.eventReactions['damage.resolved']({}, { type: 'damage', at: 0 }, {});
  assert.deepEqual(calls, ['resolved']);
});

test('resolved critical-hit helper shares sampled outcomes and strict ICDs across modes', () => {
  const state = { readyAt: 0, procs: 0, rolls: 0 };
  const context = {
    random: {
      stochastic: false,
      roll: (chance, stream) => {
        state.rolls += 1;
        assert.equal(chance, 0.5);
        assert.equal(stream, 'fixture.critical');

        return true;
      }
    }
  };
  const reaction = onResolvedCriticalHit({
    id: 'fixture.critical',
    chanceOnCriticalHit: 0.5,
    sourceIds: [7],
    internalCooldown: {
      duration: 1,
      readyAt: () => state.readyAt,
      setReadyAt: (_context, value) => {
        state.readyAt = value;
      }
    },
    attribution: { kind: 'trait', id: 99 },
    handler: (_context, _event, _details, application) => {
      // Discrete consumers apply every proc quantity returned by the shared kernel.
      state.procs += application.quantity;
    }
  });
  const event = { type: 'damage', at: 0, actorType: 'player', sourceId: 7 };
  const deterministic = { hitContext: { critical: { chance: 0.5, didCrit: true } } };

  for (let index = 0; index < 8; index += 1) {
    reaction.handler(context, { ...event, at: index / 4 }, deterministic);
  }

  assert.equal(state.procs, 2);
  assert.equal(state.rolls, 2);

  context.random.stochastic = true;
  reaction.handler(
    context,
    { ...event, at: 3 },
    {
      hitContext: { critical: { chance: 0.5, didCrit: false } }
    }
  );
  reaction.handler(
    context,
    { ...event, at: 3 },
    {
      hitContext: { critical: { chance: 0.5, didCrit: true } }
    }
  );
  assert.equal(state.procs, 3);
  assert.equal(state.rolls, 3);
  assert.deepEqual(reaction.attribution, { kind: 'trait', id: 99 });

  reaction.handler(
    context,
    { ...event, at: 3, actorType: 'summon' },
    {
      hitContext: { critical: { chance: 1, didCrit: true } }
    }
  );
  reaction.handler(
    context,
    { ...event, at: 3, sourceId: 8 },
    {
      hitContext: { critical: { chance: 1, didCrit: true } }
    }
  );
  assert.equal(state.procs, 3);
  assert.equal(reaction.requiresCriticalFacts, true);
});

test('critical-hit declarations automatically request canonical scheduler facts', () => {
  const core = defineNativeModule({
    id: 'Core',
    data: {},
    state: { scheduler: () => ({}) },
    mechanics: {
      resolution: {
        reactions: [
          onResolvedCriticalHit({
            id: 'fixture.critical-facts',
            attribution: { kind: 'trait', id: 99 },
            handler: () => undefined
          })
        ]
      }
    }
  });
  const runtime = defineNativeProfession({
    id: 'critical-facts',
    name: 'Critical Facts',
    modules: [core]
  }).resolveRuntime({ specialization: 'Core' });
  let requests = 0;

  runtime.initialize({
    schedulerPolicy: {
      requireCriticalFacts: () => {
        requests += 1;
      }
    }
  });

  assert.equal(requests, 1);
});
