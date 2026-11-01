import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assembleNativeApplicationCatalog,
  assembleNativeRuntimeCatalog,
  createNativeModuleData,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';

const replaceHandler = Object.freeze({
  mode: 'replace',
  beforeEffects: () => undefined
});
const skill = (id, name, extra = {}) =>
  Object.freeze({
    id,
    name,
    description: `${name} fixture.`,
    icon: 'fixture.png',
    castTimeMs: 0,
    effects: [],
    ...extra
  });
const coreModule = () =>
  defineNativeModule({
    id: 'Core',
    data: {
      skills: [skill(1, 'Core Skill')],
      traits: [{ id: 10, name: 'Core Trait', specialization: 'Core Line' }],
      traitLines: [{ id: 20, name: 'Core Line', elite: false }],
      weapons: ['Sword'],
      weaponHands: { Sword: 'mh' }
    },
    state: { create: () => ({ coreValue: 1 }) },
    hooks: {}
  });
const eliteModule = () =>
  defineNativeModule({
    id: 'Elite',
    data: {
      skills: [
        skill(2, 'Elite Skill'),
        skill(3, 'Elite Mechanic Weapon', {
          type: 'Weapon'
        })
      ],
      traits: [{ id: 11, name: 'Elite Trait', specialization: 'Elite' }],
      traitLines: [{ id: 21, name: 'Elite', elite: true }]
    },
    state: { create: () => ({ eliteValue: 2 }) },
    hooks: {}
  });

test('native module data rejects missing owner presentation', () => {
  // Missing authoring data fails at composition instead of being supplied by another catalog.
  for (const field of ['name', 'description', 'icon']) {
    const declaration = { name: 'Fixture', description: 'Fixture action.', icon: 'fixture.png' };
    delete declaration[field];
    assert.throws(
      () => createNativeModuleData({ id: 'Core', skillMechanics: { 1: declaration } }),
      new RegExp(`Core skill 1 requires an authored ${field}`)
    );
  }
});

test('native module data materializes only complete owner declarations', () => {
  const declaration = Object.freeze({
    name: 'Authored',
    description: 'Fixture.',
    icon: 'fixture.png',
    cooldown: 0,
    effects: []
  });
  const data = createNativeModuleData({
    id: 'Core',
    skillMechanics: { 1: declaration },
    extraSkills: [skill(5, 'Explicit action')]
  });
  assert.deepEqual(
    data.skills.map(({ id }) => id),
    [1, 5]
  );
  assert.deepEqual(data.skills[0], { ...declaration, id: 1 });
  assert.equal(Object.hasOwn(declaration, 'id'), false);
});

// Ownership cannot be redirected by a label, even on a shared weapon or synthetic action.
test('assembly rejects authored specialization labels on every contribution path', () => {
  for (const id of ['Core', 'Elite']) {
    for (const type of ['Weapon', 'Action']) {
      const data = createNativeModuleData({
        id,
        extraSkills: [skill(7, 'Mislabeled', { type, specialization: 'Elite' })]
      });
      const module = defineNativeModule({ id, data, state: { create: () => ({}) } });
      assert.throws(
        () => assembleNativeApplicationCatalog(id === 'Core' ? [module] : [coreModule(), module]),
        /must not author specialization/
      );
    }
  }
});

// Empty text is intentional for internal Actions; selectable skills still require a useful description.
test('native module descriptions allow explicit empty text only for Actions', () => {
  const declaration = { name: 'Internal', description: '', icon: 'fixture.png', type: 'Action', effects: [] };
  assert.doesNotThrow(() => createNativeModuleData({ id: 'Core', skillMechanics: { 1: declaration } }));
  assert.throws(
    () => createNativeModuleData({ id: 'Core', skillMechanics: { 1: { ...declaration, type: 'Weapon' } } }),
    /requires an authored description/
  );
});

// Authored declarations retain availability and trait ownership through assembly.
test('profession catalog binding preserves authored admission and trait-line selection', () => {
  const traitLines = [
    { id: 20, name: 'Core Line', elite: false, minorTraits: [{ id: 10, name: 'Core trait' }], majorTraits: [] },
    { id: 21, name: 'Elite', elite: true, minorTraits: [], majorTraits: [[{ id: 11, name: 'Elite trait' }]] },
    { id: 22, name: 'Other', elite: true, minorTraits: [{ id: 12, name: 'Other trait' }], majorTraits: [] }
  ];
  const createData = (id, options) => createNativeModuleData({ id, traitLines, ...options });
  const core = createData('Core', {
    skillMechanics: { 1: skill(1, 'Core skill', { cooldown: 5 }), 3: skill(3, 'Core action') },
    extraSkills: [skill(5, 'Explicit extra')]
  });
  const elite = createData('Elite', { skillMechanics: { 2: skill(2, 'Elite skill'), 4: skill(4, 'Elite action') } });
  assert.deepEqual(
    core.skills.map(({ id }) => id),
    [1, 3, 5]
  );
  assert.equal(core.skills[0].cooldown, 5);
  assert.equal(Object.hasOwn(core, 'balanceProfiles'), false);
  assert.equal(Object.hasOwn(elite, 'balanceProfiles'), false);
  assert.deepEqual(
    elite.skills.map(({ id }) => id),
    [2, 4]
  );
  assert.deepEqual(
    core.traits.map(({ id }) => id),
    [10]
  );
  assert.deepEqual(
    core.traitLines.map(({ id }) => id),
    [20]
  );
  assert.deepEqual(
    elite.traits.map(({ id }) => id),
    [11]
  );
  assert.deepEqual(
    elite.traitLines.map(({ id }) => id),
    [21]
  );
  const modules = [core, elite].map((data, index) =>
    defineNativeModule({
      id: index === 0 ? 'Core' : 'Elite',
      data,
      traitDefinitions: [{ id: index === 0 ? 10 : 11, name: 'Tuning', balance: { duration: 5 } }],
      state: { create: () => ({}) }
    })
  );
  const assembly = getNativeCatalogAssembly(modules, undefined);
  // Trait tuning is derived at assembly and retains the declaring module's ownership.
  assert.ok(modules.every((module) => !Object.hasOwn(module.data, 'balanceProfiles')));
  assert.equal(assembly.catalog.balanceProfilesById.get(10).duration, 5);
  assert.deepEqual(
    assembly.fragments.get('Core').balanceProfiles.map(({ id }) => id),
    [10]
  );
  assert.deepEqual(
    assembly.fragments.get('Elite').balanceProfiles.map(({ id }) => id),
    [11]
  );
  assert.deepEqual(
    assembly.catalog.skills.map(({ id }) => id),
    [1, 3, 5, 2, 4]
  );
  assert.equal(
    new Map(
      [...assembly.fragments].flatMap(([owner, fragment]) => fragment.skills.map((skill) => [skill.id, owner]))
    ).get(2),
    'Elite'
  );
});

test('module-first assembly derives application and active runtime catalogs', () => {
  const modules = [coreModule(), eliteModule()];
  const catalog = assembleNativeApplicationCatalog(modules);
  const skillOwners = new Map(
    [...getNativeCatalogAssembly(modules, undefined).fragments].flatMap(([owner, fragment]) =>
      fragment.skills.map((skill) => [skill.id, owner])
    )
  );
  const family = defineNativeProfession({
    id: 'fixture',
    name: 'Fixture',
    modules
  });

  assert.equal(family.catalog, catalog);
  assert.deepEqual(catalog.skills.map(({ id }) => id).sort(), [1, 2, 3]);
  assert.equal(skillOwners.get(3), 'Elite');
  assert.equal(catalog.skillsById.get(3).specialization, 'Elite');
  assert.equal(Object.hasOwn(catalog.skillsById.get(1), 'specialization'), false);
  assert.deepEqual(
    family.resolveProfession({ specialization: 'Core' }).catalog.skills.map(({ id }) => id),
    [1]
  );
  assert.deepEqual(
    family
      .resolveProfession({ specialization: 'Elite' })
      .catalog.skills.map(({ id }) => id)
      .sort(),
    [1, 2, 3]
  );
  assert.deepEqual(
    family.nativeDefinition.modules.slice(1).map((module) => module.id),
    ['Elite']
  );
});

// Selected catalogs must keep the validated sequence even if a caller later edits its input declarations.
test('runtime chain fragments detach authored arrays and preserve canonical IDs', () => {
  const chain = [1, 2];
  const module = defineNativeModule({
    id: 'Core',
    data: {
      skills: [skill(1, 'First'), skill(2, 'Second')],
      autoattackChains: [chain]
    },
    state: { create: () => ({}) }
  });
  const assembly = getNativeCatalogAssembly([module]);
  chain.reverse();
  const fragment = assembly.fragments.get('Core');
  assert.deepEqual(fragment.autoattackChains, [[1, 2]]);
  assert.equal(Object.isFrozen(fragment.autoattackChains[0]), true);
  assert.deepEqual(assembleNativeRuntimeCatalog([fragment]).autoattackChains, [[1, 2]]);
});

test('module-first assembly rejects duplicate and incomplete contributions', () => {
  const core = coreModule();

  assert.throws(
    () =>
      assembleNativeApplicationCatalog([
        core,
        defineNativeModule({
          id: 'Duplicate',
          data: { skills: [skill(1, 'Duplicate')] },
          state: { create: () => ({}) }
        })
      ]),
    /Duplicate skill id 1/
  );
  assert.throws(
    () =>
      assembleNativeApplicationCatalog([
        core,
        defineNativeModule({
          id: 'DuplicateHand',
          data: { weapons: ['Sword'], weaponHands: { Sword: 'oh' } },
          state: { create: () => ({}) }
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
          state: { create: () => ({}) },
          execution: { skillHandlers: { 'test.unused': replaceHandler } }
        })
      ]),
    /Unsupported native module field: execution/
  );
  assert.throws(
    () => defineNativeModule({ id: 'Broken', data: {}, state: {} }),
    /Broken\.state\.create must be a function/
  );
});

test('resolved critical-hit helper shares sampled outcomes and strict ICDs across modes', () => {
  assert.throws(() => criticalProcHandler({ id: '', handler() {} }), /Critical proc requires id and handler/);
  assert.throws(() => criticalProcHandler({ id: 'invalid' }), /Critical proc requires id and handler/);
  const state = { readyAt: 0, procs: 0, rolls: 0 };
  const context = {
    random: {
      mode: 'deterministic',
      roll: (chance, stream) => {
        state.rolls += 1;
        assert.equal(chance, 0.5);
        assert.equal(stream, 'fixture.critical');

        return true;
      }
    }
  };
  const reaction = criticalProcHandler({
    id: 'fixture.critical',
    chanceOnCriticalHit: 0.5,
    when: (_context, event) => event.sourceId === 7,
    internalCooldown: {
      duration: 1,
      readyAt: () => state.readyAt,
      setReadyAt: (_context, value) => {
        state.readyAt = value;
      }
    },
    handler: (_context, event, _details, application) => {
      // Claim the cooldown before emitting effects that could reenter this handler.
      assert.equal(state.readyAt, event.at + 1);
      // Discrete consumers apply every proc quantity returned by the shared kernel.
      state.procs += application.quantity;
    }
  });
  const event = { type: 'damage', at: 0, actorType: 'player', sourceId: 7 };
  const deterministic = { hitContext: { critical: { chance: 0.5, didCrit: true } } };

  for (let index = 0; index < 8; index += 1) {
    reaction(context, { ...event, at: index / 4 }, deterministic);
  }

  assert.equal(state.procs, 2);
  assert.equal(state.rolls, 2);

  context.random.mode = 'stochastic';
  reaction(
    context,
    { ...event, at: 3 },
    {
      hitContext: { critical: { chance: 0.5, didCrit: false } }
    }
  );
  reaction(
    context,
    { ...event, at: 3 },
    {
      hitContext: { critical: { chance: 0.5, didCrit: true } }
    }
  );
  assert.equal(state.procs, 3);
  assert.equal(state.rolls, 3);

  reaction(
    context,
    { ...event, at: 3, actorType: 'summon' },
    {
      hitContext: { critical: { chance: 1, didCrit: true } }
    }
  );
  reaction(
    context,
    { ...event, at: 3, sourceId: 8 },
    {
      hitContext: { critical: { chance: 1, didCrit: true } }
    }
  );
  assert.equal(state.procs, 3);
});

// Application catalogs can contain every elite action; only selected modules must supply their handlers.
test('selected runtime assembly binds profession side-effect handlers', () => {
  const elite = (hooks) =>
    defineNativeModule({
      id: 'Elite',
      data: {
        skills: [
          skill(2, 'Elite action', {
            sideEffects: [{ on: 'castCommit', do: { type: 'fixture.action' } }],
            effects: [
              {
                type: 'strike',
                coefficient: 1,
                reactions: [{ on: 'damage.resolved', actor: 'player', packets: 'each', do: { type: 'fixture.impact' } }]
              }
            ]
          })
        ]
      },
      state: { create: () => ({}) },
      hooks
    });
  const missing = defineNativeProfession({ id: 'fixture', name: 'Fixture', modules: [coreModule(), elite({})] });
  assert.doesNotThrow(() => missing.runtimeFor({ specialization: 'Core' }));
  assert.throws(() => missing.runtimeFor({ specialization: 'Elite' }), /Skill 2.*fixture.action/);
  const handler = () => {};

  const bound = defineNativeProfession({
    id: 'fixture',
    name: 'Fixture',
    modules: [coreModule(), elite({ sideEffectHandlers: { 'fixture.action': handler, 'fixture.impact': handler } })]
  });
  assert.equal(bound.runtimeFor({ specialization: 'Elite' }).sideEffectHandlers['fixture.action'], handler);
  assert.equal(bound.runtimeFor({ specialization: 'Elite' }).sideEffectHandlers['fixture.impact'], handler);
  const missingImpact = defineNativeProfession({
    id: 'fixture',
    name: 'Fixture',
    modules: [coreModule(), elite({ sideEffectHandlers: { 'fixture.action': handler } })]
  });
  assert.throws(() => missingImpact.runtimeFor({ specialization: 'Elite' }), /fixture.impact/);
});

// Native assembly must normalize combo ownership and vocabulary before general catalog validation.
test('native assembly normalizes explicit combo descriptors and rejects invalid ownership', () => {
  const assemble = (ownerId) =>
    assembleNativeApplicationCatalog([
      defineNativeModule({
        id: 'Core',
        data: createNativeModuleData({
          id: 'Core',
          skillMechanics: {
            1: {
              name: 'Combo fixture',
              description: 'Declares a field and a finisher.',
              icon: 'fixture.png',
              comboFields: [{ ownerId, fieldType: 'fire', duration: 4 }],
              effects: [{ type: 'strike', coefficient: 1, comboFinishers: [{ ownerId, finisherType: 'blast' }] }]
            }
          }
        }),
        state: { create: () => ({}) }
      })
    ]);
  const skill = assemble('Core').skillsById.get(1);
  assert.equal(skill.comboFields[0].fieldType, 'Fire');
  const finisher = skill.effects[0].comboFinishers[0];
  assert.equal(finisher.finisherType, 'Blast');
  assert.equal(finisher.ownerId, 'Core');
  assert.equal(finisher.chance, 1);
  assert.equal(finisher.attemptGroup, 'effect:1');
  assert.throws(() => assemble(''), /Skill 1.*ownerId must be a non-empty string/);
});

// Family composition must fail before duplicate keys can disappear into a module's catalog input.
test('skill definition composition rejects repeated identities across families', () => {
  const first = { name: 'First', description: 'First skill.', icon: 'fixture.png' };
  const second = { name: 'Second', description: 'Second skill.', icon: 'fixture.png' };
  assert.deepEqual(Object.keys(composeSkillDefinitions({ 1: first }, { 2: second })), ['1', '2']);
  assert.throws(() => composeSkillDefinitions({ 1: first }, { 1: second }), /Duplicate skill definition ID 1/);
});

// Both authored paths reject links owned by assembly, including explicit null placeholders.
test('native assembly rejects authored derived chain and flip fields', () => {
  for (const field of ['chainRoot', 'chainStep', 'nextChainId', 'flipSkillId', 'flipParentId']) {
    assert.throws(
      () =>
        assembleNativeApplicationCatalog([
          defineNativeModule({
            id: 'Core',
            data: { skills: [skill(1, 'Fixture', { [field]: null })] },
            state: { create: () => ({}) }
          })
        ]),
      new RegExp('must not author ' + field)
    );
  }
});

// Presentation is stored as plain text so tooltip rendering does not need source-format cleanup.
test('catalog assembly rejects API and wiki markup in skill and trait presentation', () => {
  for (const text of ['<c=reminder>Text</c>', 'Line<br>break', '{{gray|Text}}']) {
    for (const field of ['name', 'description', 'icon']) {
      for (const entity of ['skills', 'traits']) {
        assert.throws(
          () =>
            assembleNativeApplicationCatalog([
              defineNativeModule({
                id: 'Core',
                data: { [entity]: [skill(1, 'Fixture', { [field]: text })] },
                state: { create: () => ({}) }
              })
            ]),
          /must use plain text/
        );
      }
    }
  }
});

// Trait records supply ordinary profile labels, while explicit proc names remain intentional overrides.
test('trait profiles inherit canonical names and preserve explicit proc labels', () => {
  const catalog = assembleNativeApplicationCatalog([
    defineNativeModule({
      id: 'Core',
      data: {
        traits: [
          { id: 301, name: 'Canonical trait' },
          { id: 302, name: 'Long trait name' }
        ]
      },
      traitDefinitions: [
        { id: 301, balance: {} },
        { id: 302, name: 'Short proc', balance: {} }
      ],
      state: { create: () => ({}) }
    })
  ]);
  assert.equal(catalog.balanceProfilesById.get(301).name, 'Canonical trait');
  assert.equal(catalog.balanceProfilesById.get(302).name, 'Short proc');
});
