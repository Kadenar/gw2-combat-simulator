import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { createCanonicalCatalog } from '../../js/platform/engine/skills/catalog.js';
import { defineProfession } from '../../js/platform/engine/profession/contract.js';
import { defineProfessionFamily, resolveProfessionRuntime } from '../../js/platform/engine/profession/family.js';
import { defineProfessionModule } from '../../js/platform/engine/profession/module.js';
import { nativeSkillRuntimeOwner } from '../../js/platform/gw2/native-profession.js';
import { createResolverState } from '../../js/platform/engine/resolution/resolver.js';
import { createScheduler } from '../../js/platform/engine/execution/scheduler.js';
import { simulateGw2 } from '../../js/platform/gw2/simulate.js';
import { assertProfessionFamilyConformance } from '../helpers/profession-family-conformance.js';
import { composeSkillMechanics } from '../helpers/skill-mechanics.js';
import { ENGINEER_ELITE_SPECIALIZATIONS, engineerCatalog } from '../../js/professions/engineer/catalog.js';
import { engineerProfession } from '../../js/professions/engineer/definition.js';
import { engineerCoreModule } from '../../js/professions/engineer/core/module.js';
import { ENGINEER_CORE_SKILL_MECHANICS } from '../../js/professions/engineer/core/skills.js';
import { ENGINEER_SKILL_IDS as ENGINEER_ID } from '../../js/professions/engineer/data/ids.js';
import { amalgamModule } from '../../js/professions/engineer/specializations/amalgam/module.js';
import { AMALGAM_SKILL_MECHANICS } from '../../js/professions/engineer/specializations/amalgam/skills.js';
import { holosmithModule } from '../../js/professions/engineer/specializations/holosmith/module.js';
import { HOLOSMITH_SKILL_MECHANICS } from '../../js/professions/engineer/specializations/holosmith/skills.js';
import { mechanistModule } from '../../js/professions/engineer/specializations/mechanist/module.js';
import { MECHANIST_SKILL_MECHANICS } from '../../js/professions/engineer/specializations/mechanist/skills.js';
import { scrapperModule } from '../../js/professions/engineer/specializations/scrapper/module.js';
import { SCRAPPER_SKILL_MECHANICS } from '../../js/professions/engineer/specializations/scrapper/skills.js';
import { NECROMANCER_ELITE_SPECIALIZATIONS, necromancerCatalog } from '../../js/professions/necromancer/catalog.js';
import { necromancerProfession } from '../../js/professions/necromancer/definition.js';
import { necromancerCoreModule } from '../../js/professions/necromancer/core/module.js';
import { harbingerModule } from '../../js/professions/necromancer/specializations/harbinger/module.js';
import { reaperModule } from '../../js/professions/necromancer/specializations/reaper/module.js';
import { ritualistModule } from '../../js/professions/necromancer/specializations/ritualist/module.js';
import { scourgeModule } from '../../js/professions/necromancer/specializations/scourge/module.js';
import { GUARDIAN_ELITE_SPECIALIZATIONS, guardianCatalog } from '../../js/professions/guardian/catalog.js';
import { guardianProfession } from '../../js/professions/guardian/definition.js';
import { guardianCoreModule } from '../../js/professions/guardian/core/module.js';
import { dragonhunterModule } from '../../js/professions/guardian/specializations/dragonhunter/module.js';
import { firebrandModule } from '../../js/professions/guardian/specializations/firebrand/module.js';
import { luminaryModule } from '../../js/professions/guardian/specializations/luminary/module.js';
import { willbenderModule } from '../../js/professions/guardian/specializations/willbender/module.js';
import { MESMER_ELITE_SPECIALIZATIONS, mesmerCatalog } from '../../js/professions/mesmer/catalog.js';
import { mesmerProfession } from '../../js/professions/mesmer/definition.js';
import { mesmerCoreModule } from '../../js/professions/mesmer/core/module.js';
import { chronomancerModule } from '../../js/professions/mesmer/specializations/chronomancer/module.js';
import { mirageModule } from '../../js/professions/mesmer/specializations/mirage/module.js';
import { troubadourModule } from '../../js/professions/mesmer/specializations/troubadour/module.js';
import { virtuosoModule } from '../../js/professions/mesmer/specializations/virtuoso/module.js';
import { REVENANT_ELITE_SPECIALIZATIONS, revenantCatalog } from '../../js/professions/revenant/catalog.js';
import { revenantProfession } from '../../js/professions/revenant/definition.js';
import { revenantCoreModule } from '../../js/professions/revenant/core/module.js';
import { REVENANT_SKILL_IDS } from '../../js/professions/revenant/data/ids.js';
import { conduitModule } from '../../js/professions/revenant/specializations/conduit/module.js';
import { heraldModule } from '../../js/professions/revenant/specializations/herald/module.js';
import { renegadeModule } from '../../js/professions/revenant/specializations/renegade/module.js';
import { vindicatorModule } from '../../js/professions/revenant/specializations/vindicator/module.js';
import { thiefProfession } from '../../js/professions/thief/definition.js';
import { thiefCatalog } from '../../js/professions/thief/catalog.js';
import { thiefCoreModule } from '../../js/professions/thief/core/module.js';
import { antiquaryModule as thiefAntiquaryModule } from '../../js/professions/thief/specializations/antiquary/module.js';
import { daredevilModule as thiefDaredevilModule } from '../../js/professions/thief/specializations/daredevil/module.js';
import { deadeyeModule as thiefDeadeyeModule } from '../../js/professions/thief/specializations/deadeye/module.js';
import { specterModule as thiefSpecterModule } from '../../js/professions/thief/specializations/specter/module.js';
import { elementalistCatalog } from '../../js/professions/elementalist/catalog.js';
import { elementalistProfession } from '../../js/professions/elementalist/definition.js';
import { elementalistCoreModule } from '../../js/professions/elementalist/core/module.js';
import { tempestModule } from '../../js/professions/elementalist/specializations/tempest/module.js';
import { weaverModule } from '../../js/professions/elementalist/specializations/weaver/module.js';
import { catalystModule } from '../../js/professions/elementalist/specializations/catalyst/module.js';
import { evokerModule } from '../../js/professions/elementalist/specializations/evoker/module.js';

function nativeModifierRules(module) {
  const modifiers = module.mechanics?.modifiers;

  return Array.isArray(modifiers) ? modifiers : modifiers?.modifierRules || [];
}

function nativeSkillOwnerMap(slices, catalog) {
  const modules = slices.map(([, module]) => module);

  return new Map(catalog.skills.map((skill) => [skill.id, nativeSkillRuntimeOwner(modules, skill)]));
}

test('all migrated profession families share one conformance harness', () => {
  for (const fixture of [
    {
      family: elementalistProfession,
      core: elementalistCoreModule,
      specializations: {
        Tempest: tempestModule,
        Weaver: weaverModule,
        Catalyst: catalystModule,
        Evoker: evokerModule
      }
    },
    {
      family: engineerProfession,
      core: engineerCoreModule,
      specializations: {
        Scrapper: scrapperModule,
        Holosmith: holosmithModule,
        Mechanist: mechanistModule,
        Amalgam: amalgamModule
      }
    },
    {
      family: guardianProfession,
      core: guardianCoreModule,
      specializations: {
        Dragonhunter: dragonhunterModule,
        Firebrand: firebrandModule,
        Willbender: willbenderModule,
        Luminary: luminaryModule
      }
    },
    {
      family: mesmerProfession,
      core: mesmerCoreModule,
      specializations: {
        Chronomancer: chronomancerModule,
        Mirage: mirageModule,
        Virtuoso: virtuosoModule,
        Troubadour: troubadourModule
      }
    },
    {
      family: necromancerProfession,
      core: necromancerCoreModule,
      specializations: {
        Reaper: reaperModule,
        Scourge: scourgeModule,
        Harbinger: harbingerModule,
        Ritualist: ritualistModule
      }
    },
    {
      family: revenantProfession,
      core: revenantCoreModule,
      specializations: {
        Herald: heraldModule,
        Renegade: renegadeModule,
        Vindicator: vindicatorModule,
        Conduit: conduitModule
      }
    },
    {
      family: thiefProfession,
      core: thiefCoreModule,
      specializations: {
        Daredevil: thiefDaredevilModule,
        Deadeye: thiefDeadeyeModule,
        Specter: thiefSpecterModule,
        Antiquary: thiefAntiquaryModule
      }
    }
  ]) {
    assertProfessionFamilyConformance(fixture);
  }
});

test('elite event presentation is owned by the active specialization', () => {
  const cases = [
    [engineerProfession, 'Scrapper', { type: 'engineer.mass-momentum-pulse', at: 0 }],
    [engineerProfession, 'Holosmith', { type: 'engineer.prime-light-beam-field', at: 0 }],
    [
      engineerProfession,
      'Holosmith',
      {
        type: 'engineer.state',
        at: 0,
        reason: 'heat',
        state: { heat: 25 }
      }
    ],
    [
      mesmerProfession,
      'Chronomancer',
      {
        type: 'mesmer.phantasm-resummoned',
        at: 0,
        name: 'Phantasm',
        count: 1
      }
    ],
    [mesmerProfession, 'Troubadour', { type: 'mesmer.instrument', at: 0, instrument: 'Lute' }],
    [necromancerProfession, 'Ritualist', { type: 'necromancer.weapon-spell', at: 0 }]
  ];

  for (const [family, specialization, event] of cases) {
    const coreConfig = { specialization: 'Core' };
    const activeConfig = { specialization };
    const coreState = family.resolveRuntime(coreConfig).createProfessionState(coreConfig);
    const activeRuntime = family.resolveRuntime(activeConfig);
    const activeState = activeRuntime.createProfessionState(activeConfig);
    const coreRow = family
      .resolveRuntime(coreConfig)
      .ui.eventLogRow?.({ config: coreConfig, state: { profession: coreState } }, event);

    assert.equal(coreRow?.description, undefined, `${family.id}/Core must not present ${event.type}`);
    assert.notEqual(
      activeRuntime.ui.eventLogRow?.({ config: activeConfig, state: { profession: activeState } }, event),
      undefined,
      `${family.id}/${specialization} must present ${event.type}`
    );
  }
});

test('native module contributions assemble disjoint application and runtime catalogs', () => {
  const fixtures = [
    {
      name: 'Elementalist',
      family: elementalistProfession,
      catalog: elementalistCatalog,
      modules: [elementalistCoreModule, tempestModule, weaverModule, catalystModule, evokerModule]
    },
    {
      name: 'Engineer',
      family: engineerProfession,
      catalog: engineerCatalog,
      modules: [engineerCoreModule, scrapperModule, holosmithModule, mechanistModule, amalgamModule]
    },
    {
      name: 'Guardian',
      family: guardianProfession,
      catalog: guardianCatalog,
      modules: [guardianCoreModule, dragonhunterModule, firebrandModule, willbenderModule, luminaryModule]
    },
    {
      name: 'Mesmer',
      family: mesmerProfession,
      catalog: mesmerCatalog,
      modules: [mesmerCoreModule, chronomancerModule, mirageModule, virtuosoModule, troubadourModule]
    },
    {
      name: 'Necromancer',
      family: necromancerProfession,
      catalog: necromancerCatalog,
      modules: [necromancerCoreModule, reaperModule, scourgeModule, harbingerModule, ritualistModule]
    },
    {
      name: 'Revenant',
      family: revenantProfession,
      catalog: revenantCatalog,
      modules: [revenantCoreModule, heraldModule, renegadeModule, vindicatorModule, conduitModule]
    },
    {
      name: 'Thief',
      family: thiefProfession,
      catalog: thiefCatalog,
      modules: [thiefCoreModule, thiefDaredevilModule, thiefDeadeyeModule, thiefSpecterModule, thiefAntiquaryModule]
    }
  ];

  for (const { name, family, catalog, modules } of fixtures) {
    assert.equal(family.catalog, catalog, `${name}:application-catalog`);
    const contributed = {
      skills: new Map(),
      traits: new Map(),
      specializations: new Map(),
      handlers: new Map()
    };

    for (const module of modules) {
      assert.equal(module.kind, 'native-profession-module', `${name}:${module.id}`);
      assert.equal(typeof module.state.scheduler, 'function', `${name}:${module.id}`);
      assert.equal(Object.hasOwn(module, 'catalog'), false, `${name}:${module.id}`);
      for (const [kind, entries] of [
        ['skills', [...(module.data.generatedSkills || []), ...(module.data.extraSkills || [])]],
        ['traits', module.data.traits || []],
        ['specializations', module.data.specializations || []]
      ]) {
        for (const entry of entries) {
          assert.equal(contributed[kind].has(entry.id), false, `${name}:${kind}:${entry.id}`);
          contributed[kind].set(entry.id, module.id);
        }
      }

      const handlers =
        module.data.handlers instanceof Map
          ? module.data.handlers
          : new Map(Object.entries(module.data.handlers || {}));

      for (const handlerId of handlers.keys()) {
        assert.equal(contributed.handlers.has(handlerId), false, `${name}:handler:${handlerId}`);
        contributed.handlers.set(handlerId, module.id);
      }
    }

    for (const [kind, entries] of [
      ['skills', catalog.skills],
      ['traits', catalog.traits],
      ['specializations', catalog.specializations]
    ]) {
      assert.deepEqual(
        [...contributed[kind].keys()].sort((left, right) => String(left).localeCompare(String(right))),
        entries.map((entry) => entry.id).sort((left, right) => String(left).localeCompare(String(right))),
        `${name}:${kind}`
      );
    }

    assert.deepEqual(
      [...contributed.handlers.keys()].sort(),
      [...catalog.skillHandlers.keys()].sort(),
      `${name}:handlers`
    );
    for (const active of ['Core', ...family.specializationIds]) {
      const runtime = family.resolveRuntime({ specialization: active });
      const runtimeIds = new Set(runtime.catalog.skills.map((skill) => skill.id));

      for (const skill of catalog.skills) {
        const owner = nativeSkillRuntimeOwner(modules, skill);

        assert.equal(
          runtimeIds.has(skill.id),
          owner === 'Core' || owner === active,
          `${name}:${active}:${skill.id}:${owner}`
        );
      }
    }
  }
});

const coreSkill = Object.freeze({
  id: 1,
  name: 'Core Skill',
  castTimeMs: 0,
  effects: [],
  implemented: true
});
const eliteSkill = Object.freeze({
  id: 2,
  name: 'Elite Skill',
  castTimeMs: 0,
  effects: [],
  implemented: true,
  specialization: 'Elite'
});
const familyCatalog = createCanonicalCatalog({
  generated: [coreSkill, eliteSkill],
  specializations: [
    { id: 1, name: 'Core Line', elite: false },
    { id: 2, name: 'Elite', elite: true }
  ]
});

function testModule(id, options = {}) {
  return defineProfessionModule({
    id,
    catalog: options.catalog || {
      skills: id === 'Core' ? [coreSkill] : [eliteSkill],
      specializations:
        id === 'Core' ? [{ id: 1, name: 'Core Line', elite: false }] : [{ id: 2, name: 'Elite', elite: true }]
    },
    resources: options.resources || {
      createProfessionState: () => (id === 'Core' ? { coreReady: true } : { eliteReady: true })
    },
    schedulerHooks: options.schedulerHooks,
    resolverHooks: options.resolverHooks,
    ui: options.ui
  });
}

function testFamily(core = testModule('Core'), elite = testModule('Elite'), ui = undefined) {
  return defineProfessionFamily({
    id: 'family-test',
    name: 'Family Test',
    catalog: familyCatalog,
    core,
    specializations: { Elite: elite },
    ui
  });
}

test('family UI uses active slices, Core-first event precedence, and family vetoes', () => {
  const descriptor = (description) => ({ type: 'test', description });
  const core = testModule('Core', {
    ui: {
      eventLogRow: (context, event) => {
        if (event.type === 'shared') return descriptor('core');

        if (event.type === 'context') {
          return descriptor(String(context.config?.specialization));
        }

        return undefined;
      }
    }
  });
  const elite = testModule('Elite', {
    ui: {
      eventLogRow: (_context, event) =>
        event.type === 'shared' || event.type === 'elite-only' ? descriptor('elite') : undefined
    }
  });
  const family = testFamily(core, elite, {
    paletteSkillAvailability: () => ({
      available: false,
      message: 'family veto'
    })
  });
  const shared = { type: 'shared', at: 0 };
  const eliteOnly = { type: 'elite-only', at: 0 };

  assert.equal(
    family.resolveRuntime({ specialization: 'Elite' }).ui.eventLogRow({ config: { specialization: 'Elite' } }, shared)
      .description,
    'core'
  );
  assert.equal(family.ui.eventLogRow({ specialization: 'Elite' }, shared).description, 'core');
  assert.equal(family.ui.eventLogRow({ specialization: 'Core' }, eliteOnly), undefined);
  assert.equal(family.ui.eventLogRow({ build: { specialization: 'Elite' } }, eliteOnly).description, 'elite');
  assert.equal(
    family.ui.eventLogRow({ config: { specialization: 'Core Line' } }, { type: 'context', at: 0 }).description,
    'Core'
  );
  assert.deepEqual(family.ui.paletteSkillAvailability({ specialization: 'Elite' }, eliteSkill), {
    available: false,
    message: 'family veto'
  });
});

test('legacy profession contracts pass through runtime resolution unchanged', () => {
  const legacy = defineProfession({
    id: 'legacy',
    name: 'Legacy',
    catalog: createCanonicalCatalog({ generated: [coreSkill] })
  });

  assert.equal(resolveProfessionRuntime(legacy, {}), legacy);
});

test('profession families resolve Core or one known elite and cache contracts', () => {
  const family = testFamily();
  const core = family.resolveRuntime({});
  const elite = family.resolveRuntime({ specialization: 'Elite' });

  assert.deepEqual(
    core.catalog.skills.map((skill) => skill.id),
    [1]
  );
  assert.deepEqual(
    elite.catalog.skills.map((skill) => skill.id),
    [1, 2]
  );
  assert.deepEqual(core.createProfessionState({}), {
    core: { coreReady: true },
    specialization: { kind: 'Core', state: {} }
  });
  assert.deepEqual(elite.createProfessionState({ specialization: 'Elite' }), {
    core: { coreReady: true },
    specialization: { kind: 'Elite', state: { eliteReady: true } }
  });
  assert.equal(family.resolveRuntime({ specialization: 'Elite' }), elite);
  assert.equal(family.catalog, familyCatalog);
  assert.throws(
    () => family.resolveRuntime({ specialization: 'Missing' }),
    /Unknown Family Test elite specialization "Missing"/
  );
});

test('family hook order is deterministic and duplicate hook ids fail', () => {
  const calls = [];
  const core = testModule('Core', {
    schedulerHooks: {
      initialize: {
        id: 'core.initialize',
        order: 20,
        handler: () => calls.push('core')
      }
    }
  });
  const elite = testModule('Elite', {
    schedulerHooks: {
      initialize: {
        id: 'elite.initialize',
        order: 10,
        handler: () => calls.push('elite')
      }
    }
  });

  testFamily(core, elite).resolveRuntime({ specialization: 'Elite' }).initialize({});
  assert.deepEqual(calls, ['elite', 'core']);

  const duplicate = {
    id: 'same.initialize',
    handler: () => undefined
  };

  assert.throws(
    () =>
      testFamily(
        testModule('Core', {
          schedulerHooks: { initialize: duplicate }
        }),
        testModule('Elite', {
          schedulerHooks: { initialize: duplicate }
        })
      ).resolveRuntime({ specialization: 'Elite' }),
    /Duplicate initialize hook id: same\.initialize/
  );
});

test('family attribute declarations compile after active module composition', () => {
  const compiledRuleIds = [];
  const compileModifierRules = (rules) => ({
    modifyStrikeDamage: (_context, value) => {
      compiledRuleIds.push(rules.map((rule) => rule.id));

      return value + rules.length;
    }
  });
  const core = defineProfessionModule({
    ...testModule('Core'),
    attributeRules: {
      modifierRules: [{ id: 'core.rule' }],
      compileModifierRules
    }
  });
  const elite = defineProfessionModule({
    ...testModule('Elite'),
    attributeRules: {
      modifierRules: [{ id: 'elite.rule' }]
    }
  });
  const family = testFamily(core, elite);

  assert.equal(family.resolveRuntime({}).modifyStrikeDamage({}, 10), 11);
  assert.equal(family.resolveRuntime({ specialization: 'Elite' }).modifyStrikeDamage({}, 10), 12);
  assert.deepEqual(compiledRuleIds, [['core.rule'], ['core.rule', 'elite.rule']]);
});

test('family composition rejects duplicate registries and catalog ids', () => {
  const handler = () => undefined;

  assert.throws(
    () =>
      testFamily(
        testModule('Core', {
          schedulerHooks: { skillMechanicHandlers: { 'test.mechanic': handler } }
        }),
        testModule('Elite', {
          schedulerHooks: { skillMechanicHandlers: { 'test.mechanic': handler } }
        })
      ).resolveRuntime({ specialization: 'Elite' }),
    /Duplicate skill mechanic handler test\.mechanic/
  );
  assert.throws(
    () =>
      testFamily(
        testModule('Core', {
          schedulerHooks: {
            taskHandlers: { 'test.collision': handler },
            skillMechanicHandlers: { 'test.collision': handler }
          }
        })
      ).resolveRuntime({ specialization: 'Core' }),
    /both a task and skill mechanic handler/
  );
  assert.throws(
    () =>
      testFamily(
        testModule('Core', {
          schedulerHooks: { taskHandlers: { 'test.task': handler } }
        }),
        testModule('Elite', {
          schedulerHooks: { taskHandlers: { 'test.task': handler } }
        })
      ).resolveRuntime({ specialization: 'Elite' }),
    /Duplicate task handler test\.task/
  );
  assert.throws(
    () =>
      testFamily(
        testModule('Core', {
          resolverHooks: { eventHandlers: { 'test.event': handler } }
        }),
        testModule('Elite', {
          resolverHooks: { eventHandlers: { 'test.event': handler } }
        })
      ).resolveRuntime({ specialization: 'Elite' }),
    /Duplicate event handler test\.event/
  );
  assert.throws(
    () =>
      testFamily(
        testModule('Core', {
          catalog: {
            skills: [coreSkill],
            skillHandlers: { shared: {} }
          }
        }),
        testModule('Elite', {
          catalog: {
            skills: [eliteSkill],
            skillHandlers: { shared: {} }
          }
        })
      ).resolveRuntime({ specialization: 'Elite' }),
    /Duplicate skill handler shared/
  );
  assert.throws(
    () =>
      testFamily(
        testModule('Core'),
        testModule('Elite', {
          catalog: { skills: [coreSkill] }
        })
      ).resolveRuntime({ specialization: 'Elite' }),
    /Duplicate skill id 1/
  );
});

test('family composition rejects skill mechanic triggers without an active handler', () => {
  const triggeredCoreSkill = {
    ...coreSkill,
    mechanicTriggers: [{ type: 'test.missing-mechanic', timingAnchor: 'castEnd' }]
  };
  const core = testModule('Core', {
    catalog: {
      skills: [triggeredCoreSkill],
      specializations: [{ id: 1, name: 'Core Line', elite: false }]
    }
  });

  assert.throws(
    () => testFamily(core).resolveRuntime({ specialization: 'Elite' }),
    /Core Skill references unknown mechanic trigger test\.missing-mechanic/
  );
});

test('scheduler, resolver, and canonical simulation normalize family sources', () => {
  const family = testFamily();
  const scheduled = createScheduler({
    profession: family,
    config: { specialization: 'Elite' }
  });

  assert.equal(scheduled.context.profession.catalog.skillsById.has(2), true);
  assert.deepEqual(
    createResolverState({
      profession: family,
      config: { specialization: 'Elite' }
    }).profession,
    {
      core: { coreReady: true },
      specialization: { kind: 'Elite', state: { eliteReady: true } }
    }
  );

  const runtime = defineProfession({
    id: 'counted-runtime',
    name: 'Counted Runtime',
    catalog: createCanonicalCatalog()
  });
  let resolutions = 0;
  const source = {
    ...runtime,
    resolveRuntime() {
      resolutions += 1;

      return runtime;
    }
  };

  simulateGw2({ profession: source, rotation: [], config: {} });
  assert.equal(resolutions, 1);
});

const inactiveStateKeys = Object.freeze({
  Reaper: ['chillingNovaProgress', 'chillingNovaReadyAt', 'chillingVictoryReadyAt'],
  Scourge: ['shades', 'demonicLoreReadyAt', 'nourishingAshesReadyAt'],
  Harbinger: ['blight', 'blightExpiries', 'nextBlightAt', 'cascadingCorruptionStacks', 'meltdownUntil'],
  Ritualist: [
    'activeSpirits',
    'spiritGenerations',
    'spiritInitialUntil',
    'spiritBusyUntil',
    'spiritAutoAnchorAt',
    'resummonedSpiritAutoCycle',
    'weaponSpells',
    'soulTwistingAvailable',
    'pendingSoulTwistSkill',
    'painfulBondUntil',
    'painfulBondPulseAnchorAt'
  ]
});

test('Necromancer modules contain complete vertical slices', () => {
  assert.equal(
    existsSync(new URL('../../js/professions/necromancer/mechanics/specific', import.meta.url)),
    false,
    'obsolete mechanics/specific ownership bucket'
  );
  assert.equal(
    existsSync(new URL('../../js/professions/necromancer/mechanics/handler-mechanics.ts', import.meta.url)),
    false,
    'obsolete aggregate handler-mechanics table'
  );
  for (const relative of [
    'specializations/reaper/combos.ts',
    'specializations/reaper/resolver.ts',
    'specializations/scourge/shades.ts',
    'specializations/scourge/resolver.ts',
    'specializations/harbinger/blight.ts',
    'specializations/harbinger/dark-barrage.ts',
    'specializations/harbinger/resolver.ts',
    'specializations/ritualist/spirits.ts',
    'specializations/ritualist/weapon-spells.ts',
    'specializations/ritualist/events.ts',
    'specializations/ritualist/resolver.ts'
  ]) {
    assert.equal(existsSync(new URL(`../../js/professions/necromancer/${relative}`, import.meta.url)), true, relative);
  }

  const slices = [
    ['core', necromancerCoreModule],
    ['specializations/reaper', reaperModule],
    ['specializations/scourge', scourgeModule],
    ['specializations/harbinger', harbingerModule],
    ['specializations/ritualist', ritualistModule]
  ];
  const modifierRuleOwners = new Map();

  for (const [directory, module] of slices) {
    for (const filename of ['module.ts', 'state.ts', 'skills.ts', 'handlers.ts', 'mechanics.ts', 'rules.ts', 'ui.ts']) {
      const url = new URL(`../../js/professions/necromancer/${directory}/${filename}`, import.meta.url);

      assert.equal(existsSync(url), true, `${directory}/${filename}`);

      if (directory.startsWith('specializations/')) {
        const source = readFileSync(url, 'utf8');

        assert.doesNotMatch(
          source,
          /specializations\/(?:reaper|scourge|harbinger|ritualist)\//,
          `${directory}/${filename} imports a sibling specialization`
        );

        if (filename === 'handlers.ts') {
          assert.doesNotMatch(
            source,
            /\.\.\/\.\.\/handlers\.js/,
            `${directory}/${filename} imports the application handler facade`
          );
        }
      }

      if (filename === 'skills.ts') {
        const source = readFileSync(url, 'utf8');

        assert.match(source, /_BASE_SKILL_MECHANICS\b/, `${directory}/${filename} owns no skill mechanics`);
        assert.doesNotMatch(
          source,
          /from\s+["'][^"']*catalog\.js["']/,
          `${directory}/${filename} forwards to the aggregate catalog`
        );
      }
    }

    assert.equal(typeof module.state?.scheduler, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    assert.equal(typeof module.data?.handlers, 'object');
    assert.ok(module.presentation);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  assert.ok(modifierRuleOwners.size > 0);
  assert.equal(modifierRuleOwners.get('necromancer.wicked-corruption-blight'), 'Harbinger');
  assert.equal(modifierRuleOwners.get('necromancer.demonic-lore'), 'Scourge');
  assert.equal(modifierRuleOwners.get('necromancer.soul-eater'), 'Reaper');
  assert.equal(modifierRuleOwners.get('necromancer.spirits-strength'), 'Ritualist');
  assert.match(
    readFileSync(new URL('../../js/professions/necromancer/specializations/reaper/rules.ts', import.meta.url), 'utf8'),
    /function modifyReaperCastDuration/
  );
  const coreSource = readdirSync(new URL('../../js/professions/necromancer/core/', import.meta.url))
    .filter((filename) => filename.endsWith('.ts'))
    .map((filename) =>
      readFileSync(new URL(`../../js/professions/necromancer/core/${filename}`, import.meta.url), 'utf8')
    )
    .join('\n');
  assert.doesNotMatch(
    coreSource,
    /TRAIT\.(?:ALCHEMIC_VIGOR|DEATHLY_CHILL|HERALD_OF_SORROW|LINGERING_SPIRITS|NOURISHING_ASHES|SAND_SAGE|SOUL_TWISTING|SPIRITS_STRENGTH)/,
    'Core contains active-specialization trait logic'
  );
});

test('Necromancer runtimes exclude sibling catalogs, handlers, and state', () => {
  assert.equal(necromancerProfession.catalog, necromancerCatalog);
  assert.equal(necromancerProfession.catalog.specializations.length, 9);

  for (const active of ['Core', ...NECROMANCER_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = necromancerProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const activeElite = active === 'Core' ? null : active;
    const runtimeEliteLines = runtime.catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name);

    assert.deepEqual(runtimeEliteLines, activeElite ? [activeElite] : [], active);
    assert.equal(state.specialization.kind, active, `${active}:state-kind`);
    assert.equal(typeof state.core, 'object', `${active}:core-state`);
    for (const key of Object.values(inactiveStateKeys).flat()) {
      assert.equal(Object.hasOwn(state.core, key), false, `${active}:core:${key}`);
    }

    assert.equal(
      runtime.catalog.skills.some(
        (skill) =>
          skill.type !== 'Weapon' &&
          NECROMANCER_ELITE_SPECIALIZATIONS.includes(skill.specialization) &&
          skill.specialization !== activeElite
      ),
      false,
      active
    );
    assert.deepEqual(
      [...runtime.catalog.skillHandlers.keys()].sort(),
      [...new Set(runtime.catalog.skills.map((skill) => String(skill.handlerId || '')).filter(Boolean))].sort(),
      `${active}:skill-handlers`
    );
    for (const [owner, keys] of Object.entries(inactiveStateKeys)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.specialization.state, key), owner === active, `${active}:slice:${key}`);
        assert.equal(Object.hasOwn(state, key), false, `${active}:no-flat-state:${key}`);
      }
    }

    assert.equal(Object.hasOwn(runtime.eventHandlers, 'necromancer.painful-bond'), active === 'Ritualist', active);
    assert.equal(Object.hasOwn(runtime.eventHandlers, 'necromancer.weapon-spell'), active === 'Ritualist', active);
    assert.equal(Object.hasOwn(runtime.eventHandlers, 'necromancer.spirit-attack'), active === 'Ritualist', active);
  }
});

test('Necromancer runtime UI exposes only active specialization resources', () => {
  for (const active of ['Core', ...NECROMANCER_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = necromancerProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const resourceIds = runtime.ui
      .resourceViews({
        config,
        state: { profession: state }
      })
      .map((resource) => resource.id);

    assert.equal(resourceIds.includes('blight'), active === 'Harbinger', active);
  }
});

test('Necromancer public projection keeps inactive compatibility fields', () => {
  const result = simulateGw2({
    profession: necromancerProfession,
    rotation: [],
    config: { specialization: 'Core' }
  });

  assert.equal(result.endState.profession.blight, 0);
  assert.deepEqual(result.endState.profession.blightExpiries, []);
  assert.deepEqual(result.endState.profession.shades, []);
  assert.deepEqual(result.endState.profession.activeSpirits, {});
  assert.equal(result.endState.profession.soulTwistingAvailable, false);
  assert.equal(result.endState.profession.meltdownUntil, 0);
});

const guardianInactiveStateKeys = Object.freeze({
  Dragonhunter: ['tetherUntil', 'nextShieldOfCourageAegisAt', 'heavyLightReadyAt'],
  Firebrand: [
    'activeTome',
    'tomePages',
    'maximumTomePages',
    'tomePageInterval',
    'nextTomePageAt',
    'ashesCharges',
    'ashesNextTriggerAt',
    'ashesExpiresAt',
    'nextCourageAegisAt',
    'tomeDormantReadyAt',
    'swiftScholarTome',
    'swiftScholarCount',
    'liberatorsVowReadyAt',
    'stalwartSpeedReadyAt',
    'quickfireReadyAt',
    'mantraRechargeReadyAt'
  ],
  Willbender: [
    'flameGeneration',
    'flameVirtue',
    'pendingWeaponCooldownReduction',
    'justiceUntil',
    'resolveUntil',
    'courageUntil',
    'virtueHitCounts',
    'lethalTempoStacks',
    'lethalTempoUntil',
    'triggeredVirtueEffects'
  ],
  Luminary: [
    'radiantForge',
    'radiantForgeEndsAt',
    'radiantForgeEnteredAt',
    'radiantWeapon',
    'radiantWeaponsUsed',
    'empoweredArmamentsUntil',
    'piercingStanceUntil',
    'lightAuraUntil',
    'lightFields',
    'radiantJusticeArmed',
    'radiantCourageSwordArmed',
    'radiantCourageShieldArmed',
    'effulgentActiveUntil',
    'effulgentStacks'
  ]
});

test('Guardian modules own disjoint vertical slices', () => {
  for (const obsolete of ['mechanics/specific', 'mechanics/handler-mechanics.ts', 'resolver/event-handlers.ts']) {
    assert.equal(existsSync(new URL(`../../js/professions/guardian/${obsolete}`, import.meta.url)), false, obsolete);
  }

  const slices = [
    ['core', guardianCoreModule],
    ['specializations/dragonhunter', dragonhunterModule],
    ['specializations/firebrand', firebrandModule],
    ['specializations/willbender', willbenderModule],
    ['specializations/luminary', luminaryModule]
  ];
  const modifierRuleOwners = new Map();

  for (const [directory, module] of slices) {
    const filenames = ['module.ts', 'state.ts', 'skills.ts', 'ui.ts'];

    if (module.data?.handlers) filenames.push('handlers.ts');
    for (const filename of filenames) {
      const url = new URL(`../../js/professions/guardian/${directory}/${filename}`, import.meta.url);

      assert.equal(existsSync(url), true, `${directory}/${filename}`);
      const source = readFileSync(url, 'utf8');

      if (directory.startsWith('specializations/')) {
        assert.doesNotMatch(
          source,
          /specializations\/(?:dragonhunter|firebrand|willbender|luminary)\//,
          `${directory}/${filename} imports a sibling specialization`
        );
      }

      if (filename === 'skills.ts') {
        assert.match(source, /_SKILL_MECHANICS\b/, `${directory}/${filename} owns no skill mechanics`);
        assert.doesNotMatch(source, /from\s+["'][^"']*catalog\.js["']/);
      }
    }

    assert.equal(typeof module.state?.scheduler, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  assert.equal(modifierRuleOwners.get('guardian.empowered-armaments'), 'Luminary');
  assert.equal(modifierRuleOwners.get('guardian.radiant-power-critical-chance'), 'Core');

  const coreDirectory = new URL('../../js/professions/guardian/core/', import.meta.url);
  const coreSource = readdirSync(coreDirectory)
    .filter((filename) => filename.endsWith('.ts'))
    .map((filename) => readFileSync(new URL(filename, coreDirectory), 'utf8'))
    .join('\n');

  assert.doesNotMatch(coreSource, /Dragonhunter|Firebrand|Willbender|Luminary/i);
  for (const key of Object.values(guardianInactiveStateKeys).flat()) {
    assert.doesNotMatch(coreSource, new RegExp(`['"]${key}['"]`), `Core owns elite state key ${key}`);
  }
});

test('Guardian runtimes exclude inactive elite catalogs, registries, and state', () => {
  assert.equal(guardianProfession.catalog, guardianCatalog);
  const skillOwners = nativeSkillOwnerMap(
    [
      ['core', guardianCoreModule],
      ['dragonhunter', dragonhunterModule],
      ['firebrand', firebrandModule],
      ['willbender', willbenderModule],
      ['luminary', luminaryModule]
    ],
    guardianCatalog
  );

  for (const active of ['Core', ...GUARDIAN_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = guardianProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const activeElite = active === 'Core' ? null : active;

    assert.deepEqual(
      runtime.catalog.specializations
        .filter((specialization) => specialization.elite)
        .map((specialization) => specialization.name),
      activeElite ? [activeElite] : [],
      active
    );
    assert.equal(state.specialization.kind, active, `${active}:state-kind`);
    for (const key of Object.values(guardianInactiveStateKeys).flat()) {
      assert.equal(Object.hasOwn(state.core, key), false, `${active}:core:${key}`);
    }

    assert.equal(
      runtime.catalog.skills.some(
        (skill) => skillOwners.get(skill.id) !== 'Core' && skillOwners.get(skill.id) !== activeElite
      ),
      false,
      active
    );
    assert.deepEqual(
      [...runtime.catalog.skillHandlers.keys()].sort(),
      [...new Set(runtime.catalog.skills.map((skill) => String(skill.handlerId || '')).filter(Boolean))].sort(),
      `${active}:skill-handlers`
    );
    for (const [owner, keys] of Object.entries(guardianInactiveStateKeys)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.specialization.state, key), owner === active, `${active}:slice:${key}`);
        assert.equal(Object.hasOwn(state, key), false, `${active}:no-flat-state:${key}`);
      }
    }

    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'guardian.tome-page-used'),
      active === 'Firebrand',
      `${active}:tome-handler`
    );
    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'guardian.radiant-forge-entered'),
      active === 'Luminary',
      `${active}:forge-handler`
    );
  }
});

test('Guardian runtime UI and public projection preserve their contracts', () => {
  for (const active of ['Core', ...GUARDIAN_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = guardianProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const resourceIds = runtime.ui
      .resourceViews({
        config,
        state: { profession: state }
      })
      .map((resource) => resource.id);

    assert.equal(resourceIds.includes('pages'), active === 'Firebrand', active);
    const paletteIds = runtime.ui
      .paletteGroups({
        config,
        state: { profession: state }
      })
      .map((group) => group.id);

    assert.equal(paletteIds.includes('radiant-forge'), active === 'Luminary');
    assert.equal(paletteIds.includes('tome-justice'), active === 'Firebrand');
  }

  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [],
    config: { specialization: 'Core' }
  });

  assert.equal(result.endState.profession.activeTome, '');
  assert.equal(result.endState.profession.tomePages, 5);
  assert.equal(result.endState.profession.radiantForge, false);
  assert.deepEqual(result.endState.profession.radiantWeaponsUsed, {});
});

const mesmerSlices = Object.freeze([
  ['core', mesmerCoreModule],
  ['specializations/chronomancer', chronomancerModule],
  ['specializations/mirage', mirageModule],
  ['specializations/virtuoso', virtuosoModule],
  ['specializations/troubadour', troubadourModule]
]);

const mesmerSpecializationStateKeys = Object.freeze({
  Chronomancer: ['continuum', 'timeBombUntil'],
  Mirage: ['ambushUntil', 'ambushSource', 'cloneAmbushUntil', 'riddleOfSandReady'],
  Virtuoso: ['numericResource', 'nextForgeAt', 'bloodsongProgress'],
  Troubadour: ['numericResource', 'instruments', 'lastInstrument']
});

test('Mesmer modules are vertical slices with disjoint catalog ownership', () => {
  for (const obsolete of ['mechanics/specific', 'resolver/event-handlers.ts']) {
    assert.equal(existsSync(new URL(`../../js/professions/mesmer/${obsolete}`, import.meta.url)), false, obsolete);
  }

  const modifierRuleOwners = new Map();

  for (const [directory, module] of mesmerSlices) {
    for (const filename of ['module.ts', 'state.ts', 'skills.ts', 'handlers.ts', 'mechanics.ts', 'rules.ts', 'ui.ts']) {
      const url = new URL(`../../js/professions/mesmer/${directory}/${filename}`, import.meta.url);

      assert.equal(existsSync(url), true, `${directory}/${filename}`);
      const source = readFileSync(url, 'utf8');

      if (directory.startsWith('specializations/')) {
        assert.doesNotMatch(
          source,
          /specializations\/(?:chronomancer|mirage|virtuoso|troubadour)\//,
          `${directory}/${filename} imports a sibling specialization`
        );
      }

      if (filename === 'skills.ts') {
        assert.match(source, /MESMER_SKILL_IDS\s+as\s+ID/, `${directory}/${filename} must use the shared skill ID map`);
        assert.match(source, /_SKILL_MECHANICS\b/, `${directory}/${filename} owns no skill mechanics`);
        assert.doesNotMatch(source, /from\s+["'][^"']*catalog\.js["']/);
        assert.doesNotMatch(
          source,
          /^\s*["']?-?\d+["']?\s*:/m,
          `${directory}/${filename} has a hardcoded skill ID key`
        );
        assert.doesNotMatch(
          source,
          /\b(?:id|skillId|nextChainId|flipParentId|flipChildId)\s*:\s*-?\d+/,
          `${directory}/${filename} has a hardcoded skill ID reference`
        );
      }
    }

    assert.equal(typeof module.state?.scheduler, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  const coreSources = ['module.ts', 'state.ts', 'skills.ts', 'handlers.ts', 'rules.ts', 'ui.ts']
    .map((filename) => readFileSync(new URL(`../../js/professions/mesmer/core/${filename}`, import.meta.url), 'utf8'))
    .join('\n');

  assert.doesNotMatch(coreSources, /specializations\//);
});

test('Mesmer specialization mechanics contribute only registries they own', () => {
  const mechanicsSources = Object.fromEntries(
    ['chronomancer', 'mirage', 'virtuoso', 'troubadour'].map((specialization) => [
      specialization,
      readFileSync(
        new URL(`../../js/professions/mesmer/specializations/${specialization}/mechanics.ts`, import.meta.url),
        'utf8'
      )
    ])
  );

  for (const [specialization, source] of Object.entries(mechanicsSources)) {
    assert.doesNotMatch(
      source,
      /=\s*(?:Object\.freeze\(\{\}\)|new Set<number>\(\[\]\))\s*;/,
      `${specialization}/mechanics.ts declares an empty manifest placeholder`
    );
  }

  for (const specialization of Object.keys(mechanicsSources)) {
    const skills = readFileSync(
      new URL(`../../js/professions/mesmer/specializations/${specialization}/skills.ts`, import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(
      skills,
      /_SUPPLEMENTAL_SKILL_MECHANICS[^=]*=\s*Object\.freeze\(\{\}\)|_EXTRA_SKILLS[^=]*=\s*Object\.freeze\(\[\]/,
      `${specialization}/skills.ts declares an empty module placeholder`
    );
  }

  assert.deepEqual(
    Object.entries(mechanicsSources)
      .filter(([, source]) => /export const MESMER_[A-Z]+_INSTRUMENTS\b/.test(source))
      .map(([specialization]) => specialization),
    ['troubadour']
  );

  const coreState = readFileSync(new URL('../../js/professions/mesmer/core/state.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(
    coreState,
    /numericResource|instruments|lastInstrument|mirrors|riddleOfSand|continuum|timeBomb|bloodsong|nextForge/
  );

  const coreProfiles = readFileSync(new URL('../../js/professions/mesmer/core/profiles.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(coreProfiles, /mesmerProfiledAmbush|mesmerProfiledInstrument/);

  const coreBehavior = ['expected-procs.ts', 'resources.ts', 'rules.ts']
    .map((filename) => readFileSync(new URL(`../../js/professions/mesmer/core/${filename}`, import.meta.url), 'utf8'))
    .join('\n');
  assert.doesNotMatch(
    coreBehavior,
    /Infinite Horizon|Riddle of Sand|Sigil of Energy|Danger Time|Harmonize|Syncopate|Jagged Mind|Bloodsong/
  );
});

test('Mesmer runtimes exclude inactive elite catalogs, registries, and state', () => {
  const skillOwner = nativeSkillOwnerMap(mesmerSlices, mesmerCatalog);

  assert.equal(mesmerProfession.catalog, mesmerCatalog);
  for (const active of ['Core', ...MESMER_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = mesmerProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const activeElite = active === 'Core' ? null : active;

    assert.equal(runtime, mesmerProfession.resolveRuntime(config), active);
    assert.deepEqual(
      runtime.catalog.specializations
        .filter((specialization) => specialization.elite)
        .map((specialization) => specialization.name),
      activeElite ? [activeElite] : [],
      active
    );
    assert.equal(state.specialization.kind, active, `${active}:state-kind`);
    for (const key of Object.values(mesmerSpecializationStateKeys).flat()) {
      assert.equal(Object.hasOwn(state.core, key), false, `${active}:core:${key}`);
    }

    assert.equal(
      runtime.catalog.skills.some(
        (skill) => skillOwner.get(skill.id) !== 'Core' && skillOwner.get(skill.id) !== activeElite
      ),
      false,
      `${active}:skills`
    );
    for (const [owner, keys] of Object.entries(mesmerSpecializationStateKeys)) {
      for (const key of keys) {
        const expected =
          key === 'numericResource' ? active === 'Virtuoso' || active === 'Troubadour' : owner === active;

        assert.equal(Object.hasOwn(state.specialization.state, key), expected, `${active}:slice:${owner}:${key}`);
      }
    }

    assert.equal(
      Object.hasOwn(runtime.taskHandlers, 'mesmer.continuum-expire'),
      active === 'Chronomancer',
      `${active}:continuum-task`
    );
    assert.equal(
      Object.hasOwn(runtime.taskHandlers, 'mesmer.blade-spend'),
      active === 'Virtuoso',
      `${active}:blade-task`
    );
    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'mesmer.instrument'),
      active === 'Troubadour',
      `${active}:instrument-handler`
    );
  }

  assert.throws(
    () => mesmerProfession.resolveRuntime({ specialization: 'Missing' }),
    /Unknown Mesmer elite specialization "Missing"/
  );
});

test('Mesmer runtime UI exposes only the active specialization resource', () => {
  for (const active of ['Core', ...MESMER_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = mesmerProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const resources = runtime.ui.resourceViews({
      config,
      state: { profession: state }
    });

    assert.deepEqual(
      resources.map((resource) => resource.id),
      [active === 'Virtuoso' ? 'blades' : active === 'Troubadour' ? 'notes' : 'clones'],
      active
    );
    assert.equal(runtime.ui.skillBarGroups({ config }).length, 1, active);
  }
});

const revenantSlices = Object.freeze([
  ['core', revenantCoreModule],
  ['specializations/herald', heraldModule],
  ['specializations/renegade', renegadeModule],
  ['specializations/vindicator', vindicatorModule],
  ['specializations/conduit', conduitModule]
]);

const revenantSpecializationStateKeys = Object.freeze({
  Renegade: [
    'bandTogetherReady',
    'bandTogetherExpiresAt',
    'kallasFervor',
    'renegadeCriticalProgress',
    'razorclawsRage',
    'soulcleaveNextAlliedProcAt',
    'endlessEnmityReadyAt',
    'bloodFuryReadyAt',
    'soulcleaveReadyAt'
  ],
  Vindicator: ['allianceSide', 'selectedDodge', 'reaversCurseUntil', 'forerunnerOfDeathUntil'],
  Conduit: [
    'affinity',
    'cosmicWisdomUntil',
    'conduitForm',
    'beguilingHazeCharges',
    'beguilingHazeReadyAt',
    'beguilingHazeMainReservations',
    'energyCostOverrides',
    'upkeepAffinityNextAt',
    'impossibleOddsLesserDaggersNextAt',
    'mistfireReadyAt'
  ]
});

test('Revenant modules are vertical slices with disjoint ownership', () => {
  for (const obsolete of [
    'mechanics/specific',
    'mechanics/handler-mechanics.ts',
    'resolver/event-handlers.ts',
    'resolver/event-reactions.ts'
  ]) {
    assert.equal(existsSync(new URL(`../../js/professions/revenant/${obsolete}`, import.meta.url)), false, obsolete);
  }

  const modifierRuleOwners = new Map();

  for (const [directory, module] of revenantSlices) {
    for (const filename of ['module.ts', 'state.ts', 'skills.ts', 'handlers.ts', 'rules.ts', 'ui.ts']) {
      const url = new URL(`../../js/professions/revenant/${directory}/${filename}`, import.meta.url);

      assert.equal(existsSync(url), true, `${directory}/${filename}`);
      const source = readFileSync(url, 'utf8');

      if (directory.startsWith('specializations/')) {
        assert.doesNotMatch(
          source,
          /specializations\/(?:herald|renegade|vindicator|conduit)\//,
          `${directory}/${filename} imports a sibling specialization`
        );

        if (filename === 'handlers.ts') {
          assert.doesNotMatch(source, /\.\.\/\.\.\/handlers\.js/);
        }
      }

      if (filename === 'skills.ts') {
        assert.match(source, /_BASE_SKILL_MECHANICS\b/, `${directory}/${filename} owns no skill mechanics`);
        assert.doesNotMatch(
          source,
          /from\s+["'][^"']*catalog\.js["']/,
          `${directory}/${filename} forwards to the aggregate catalog`
        );
      }
    }

    const mechanicsUrl = new URL(`../../js/professions/revenant/${directory}/mechanics.ts`, import.meta.url);

    assert.equal(existsSync(mechanicsUrl), directory === 'specializations/herald', `${directory}/mechanics.ts`);
    assert.equal(typeof module.state?.scheduler, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    assert.equal(typeof module.data?.handlers, 'object');
    assert.ok(module.presentation);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  assert.equal(modifierRuleOwners.get('revenant.reinforced-potency'), 'Herald');
  assert.equal(modifierRuleOwners.get('revenant.heartpiercer-strike'), 'Renegade');
  assert.equal(modifierRuleOwners.get('revenant.leviathan-strength'), 'Vindicator');
  assert.equal(modifierRuleOwners.get('revenant.release-warrior-affinity'), 'Conduit');

  const coreSources = [
    'availability.ts',
    'energy.ts',
    'events.ts',
    'handlers.ts',
    'legend-traits.ts',
    'module.ts',
    'rules.ts',
    'skills.ts',
    'state.ts',
    'ui.ts',
    'upkeep.ts',
    'weapon-state.ts'
  ]
    .map((filename) => readFileSync(new URL(`../../js/professions/revenant/core/${filename}`, import.meta.url), 'utf8'))
    .join('\n');

  assert.doesNotMatch(coreSources, /specializations\//);
  assert.doesNotMatch(
    coreSources,
    /CITADEL_BOMBARDMENT|beguiling-haze|\bfacet\b|upkeepPulse|energyCostOverrides|LEGEND\.ENTITY/
  );
});

test('Revenant runtimes exclude inactive elite catalogs, hooks, and state', () => {
  const skillOwner = nativeSkillOwnerMap(revenantSlices, revenantCatalog);

  for (const [owner, skillIds] of [
    ['Herald', [REVENANT_SKILL_IDS.LEGENDARY_DRAGON_STANCE, REVENANT_SKILL_IDS.CALL_OF_THE_DRAGON]],
    [
      'Renegade',
      [
        REVENANT_SKILL_IDS.LEGENDARY_RENEGADE_STANCE,
        REVENANT_SKILL_IDS.LEGENDARY_RENEGADE_STANCE_ID_46409,
        REVENANT_SKILL_IDS.CALL_OF_THE_RENEGADE
      ]
    ],
    ['Vindicator', [REVENANT_SKILL_IDS.LEGENDARY_ALLIANCE_STANCE, REVENANT_SKILL_IDS.CALL_OF_THE_ALLIANCE]],
    [
      'Conduit',
      [
        REVENANT_SKILL_IDS.LEGENDARY_ENTITY_STANCE,
        REVENANT_SKILL_IDS.PAIN_ABSORPTION_ID_78505,
        REVENANT_SKILL_IDS.BANISH_ENCHANTMENT_ID_78587,
        REVENANT_SKILL_IDS.EMPOWERING_MISERY_ID_78681
      ]
    ]
  ]) {
    for (const skillId of skillIds) assert.equal(skillOwner.get(skillId), owner, String(skillId));
  }

  assert.equal(revenantProfession.catalog, revenantCatalog);
  for (const active of ['Core', ...REVENANT_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = revenantProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const activeElite = active === 'Core' ? null : active;

    assert.deepEqual(
      runtime.catalog.specializations
        .filter((specialization) => specialization.elite)
        .map((specialization) => specialization.name),
      activeElite ? [activeElite] : [],
      active
    );
    assert.equal(state.specialization.kind, active, `${active}:state-kind`);
    for (const key of Object.values(revenantSpecializationStateKeys).flat()) {
      assert.equal(Object.hasOwn(state.core, key), false, `${active}:core:${key}`);
    }

    assert.equal(
      runtime.catalog.skills.some(
        (skill) => skillOwner.get(skill.id) !== 'Core' && skillOwner.get(skill.id) !== activeElite
      ),
      false,
      `${active}:skills`
    );
    for (const [owner, keys] of Object.entries(revenantSpecializationStateKeys)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.specialization.state, key), owner === active, `${active}:slice:${key}`);
      }
    }

    assert.equal(
      Object.hasOwn(runtime.taskHandlers, 'revenant.affinity-hit'),
      active === 'Conduit',
      `${active}:affinity-task`
    );
    assert.equal(
      Object.hasOwn(runtime.taskHandlers, 'revenant.herald-facet-pulse'),
      active === 'Herald',
      `${active}:facet-task`
    );
    assert.equal(
      Object.hasOwn(runtime.eventReactions, 'damage.resolved'),
      active === 'Renegade',
      `${active}:damage-reaction`
    );
  }
});

test('Revenant runtime UI and public projection preserve their contracts', () => {
  for (const active of ['Core', ...REVENANT_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = revenantProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const resourceIds = runtime.ui
      .resourceViews({
        config,
        state: { profession: state }
      })
      .map((resource) => resource.id);

    assert.equal(resourceIds.includes('endurance'), active === 'Vindicator', active);
    assert.equal(resourceIds.includes('affinity'), active === 'Conduit', active);
  }

  const result = simulateGw2({
    profession: revenantProfession,
    rotation: [],
    config: { specialization: 'Core' }
  });

  assert.equal(result.endState.profession.affinity, 0);
  assert.equal(result.endState.profession.allianceSide, 'luxon');
  assert.equal(result.endState.profession.bandTogetherReady, false);
  assert.deepEqual(result.endState.profession.kallasFervor, []);
});

const engineerSlices = Object.freeze([
  ['core', engineerCoreModule],
  ['specializations/scrapper', scrapperModule],
  ['specializations/holosmith', holosmithModule],
  ['specializations/mechanist', mechanistModule],
  ['specializations/amalgam', amalgamModule]
]);

const engineerSpecializationStateKeys = Object.freeze({
  Holosmith: ['heat', 'maximumHeat', 'photonForgeActive', 'overheated', 'solarFocusingLensStacks'],
  Mechanist: ['mech'],
  Amalgam: ['selectedMorphSkillIds', 'evolvedUntil', 'plasmaticStateUntil', 'activeStances']
});

test('Engineer modules are vertical slices with disjoint ownership', () => {
  for (const obsolete of ['mechanics/specific', 'resolver/event-handlers.ts']) {
    assert.equal(existsSync(new URL(`../../js/professions/engineer/${obsolete}`, import.meta.url)), false, obsolete);
  }

  const modifierRuleOwners = new Map();

  for (const [directory, module] of engineerSlices) {
    const filenames = ['module.ts', 'state.ts', 'skills.ts', 'mechanics.ts', 'rules.ts', 'ui.ts'];

    if (module.data?.handlers) filenames.push('handlers.ts');
    for (const filename of filenames) {
      const url = new URL(`../../js/professions/engineer/${directory}/${filename}`, import.meta.url);

      assert.equal(existsSync(url), true, `${directory}/${filename}`);
      const source = readFileSync(url, 'utf8');

      if (directory.startsWith('specializations/')) {
        assert.doesNotMatch(
          source,
          /specializations\/(?:scrapper|holosmith|mechanist|amalgam)\//,
          `${directory}/${filename} imports a sibling specialization`
        );
      }

      if (filename === 'skills.ts') {
        assert.match(source, /SKILL_MECHANICS\b/, `${directory}/${filename} owns no skill mechanics`);
        assert.doesNotMatch(
          source,
          /from\s+["'][^"']*catalog\.js["']/,
          `${directory}/${filename} forwards to the aggregate catalog`
        );
      }
    }

    assert.equal(typeof module.state?.scheduler, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);

    if (module.data?.handlers) {
      assert.equal(typeof module.data.handlers, 'object');
    }

    assert.ok(module.presentation);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  assert.equal(modifierRuleOwners.get('engineer.object-in-motion'), 'Scrapper');
  assert.equal(modifierRuleOwners.get('engineer.lasers-edge'), 'Holosmith');
  assert.equal(modifierRuleOwners.get('engineer.force-signet'), 'Mechanist');
  assert.equal(modifierRuleOwners.get('engineer.willing-host'), 'Amalgam');

  const coreSources = ['module.ts', 'state.ts', 'skills.ts', 'handlers.ts', 'mechanics.ts', 'rules.ts', 'ui.ts']
    .map((filename) => readFileSync(new URL(`../../js/professions/engineer/core/${filename}`, import.meta.url), 'utf8'))
    .join('\n');

  assert.doesNotMatch(coreSources, /specializations\//);

  const coreSkillSource = readFileSync(
    new URL('../../js/professions/engineer/core/skills.ts', import.meta.url),
    'utf8'
  );
  const coreTraitSource = readFileSync(
    new URL('../../js/professions/engineer/core/traits.ts', import.meta.url),
    'utf8'
  );
  const coreAvailabilitySource = readFileSync(
    new URL('../../js/professions/engineer/core/availability.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(coreSkillSource, /\[ID\.(?:RADIANT_ARC|SUN_EDGE|SUN_RIPPER|GLEAM_SABER|REFRACTION_CUTTER)\]:/);
  assert.doesNotMatch(coreTraitSource, /Function Gyro|engineerMech/);
  assert.doesNotMatch(coreAvailabilitySource, /Photon Forge/);
  const familyStateSource = readFileSync(new URL('../../js/professions/engineer/state.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(familyStateSource, /['"](?:photonForgeActive|mech|selectedMorphSkillIds)['"]/);
  assert.match(familyStateSource, /HOLOSMITH_PUBLIC_END_STATE_KEYS/);
  assert.match(familyStateSource, /MECHANIST_PUBLIC_END_STATE_KEYS/);
  assert.match(familyStateSource, /AMALGAM_PUBLIC_END_STATE_KEYS/);
});

test('Engineer raw skill mechanics retain a disjoint no-loss union', () => {
  const fragments = [
    ENGINEER_CORE_SKILL_MECHANICS,
    SCRAPPER_SKILL_MECHANICS,
    HOLOSMITH_SKILL_MECHANICS,
    MECHANIST_SKILL_MECHANICS,
    AMALGAM_SKILL_MECHANICS
  ];
  const aggregate = composeSkillMechanics('Engineer', fragments);
  const owners = new Map();

  for (const [fragmentIndex, fragment] of fragments.entries()) {
    for (const skillId of Object.keys(fragment)) {
      assert.equal(
        owners.has(skillId),
        false,
        `skill mechanics ${skillId} owned by fragments ` + `${owners.get(skillId)} and ${fragmentIndex}`
      );
      owners.set(skillId, fragmentIndex);
    }
  }

  assert.deepEqual(
    [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
    Object.keys(aggregate).sort((left, right) => Number(left) - Number(right))
  );
});

test('Engineer runtimes exclude inactive elite catalogs, hooks, and state', () => {
  const skillOwner = nativeSkillOwnerMap(engineerSlices, engineerCatalog);
  const holosmithSwordIds = [
    ENGINEER_ID.RADIANT_ARC,
    ENGINEER_ID.SUN_EDGE,
    ENGINEER_ID.SUN_RIPPER,
    ENGINEER_ID.GLEAM_SABER,
    ENGINEER_ID.REFRACTION_CUTTER,
    ENGINEER_ID.REFRACTION_CUTTER_BLADE
  ];
  const sharedSwordIds = [
    ENGINEER_ID.RADIANT_ARC_ID_69565,
    ENGINEER_ID.SUN_EDGE_ID_70514,
    ENGINEER_ID.SUN_RIPPER_ID_69906,
    ENGINEER_ID.GLEAM_SABER_ID_70771,
    ENGINEER_ID.REFRACTION_CUTTER_ID_71121
  ];

  assert.ok(holosmithSwordIds.every((skillId) => skillOwner.get(skillId) === 'Holosmith'));
  assert.ok(sharedSwordIds.every((skillId) => skillOwner.get(skillId) === 'Core'));

  assert.equal(engineerProfession.catalog, engineerCatalog);
  for (const active of ['Core', ...ENGINEER_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = engineerProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const activeElite = active === 'Core' ? null : active;

    assert.deepEqual(
      runtime.catalog.specializations
        .filter((specialization) => specialization.elite)
        .map((specialization) => specialization.name),
      activeElite ? [activeElite] : [],
      active
    );
    assert.equal(state.specialization.kind, active, `${active}:state-kind`);
    for (const key of Object.values(engineerSpecializationStateKeys).flat()) {
      assert.equal(Object.hasOwn(state.core, key), false, `${active}:core:${key}`);
    }

    assert.equal(
      runtime.catalog.skills.some(
        (skill) => skillOwner.get(skill.id) !== 'Core' && skillOwner.get(skill.id) !== activeElite
      ),
      false,
      `${active}:skills`
    );
    for (const [owner, keys] of Object.entries(engineerSpecializationStateKeys)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.specialization.state, key), owner === active, `${active}:slice:${key}`);
      }
    }

    assert.equal(
      Object.hasOwn(runtime.taskHandlers, 'engineer.photon-forge-heat'),
      active === 'Holosmith',
      `${active}:heat-task`
    );
    assert.equal(
      Object.hasOwn(runtime.taskHandlers, 'engineer.mech-attack'),
      active === 'Mechanist',
      `${active}:mech-task`
    );
    assert.equal(
      Object.hasOwn(runtime.taskHandlers, 'engineer.mercurial-tendencies'),
      active === 'Amalgam',
      `${active}:amalgam-task`
    );
    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'engineer.mass-momentum-pulse'),
      active === 'Scrapper',
      `${active}:scrapper-handler`
    );
    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'engineer.prime-light-beam-field'),
      active === 'Holosmith',
      `${active}:holosmith-handler`
    );
    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'engineer.radiant-arc-quickness'),
      active === 'Holosmith',
      `${active}:radiant-arc-handler`
    );
    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'engineer.refraction-cutter-extra-blades'),
      active === 'Holosmith',
      `${active}:refraction-cutter-handler`
    );
  }

  assert.throws(
    () => engineerProfession.resolveRuntime({ specialization: 'Unknown' }),
    /Unknown Engineer elite specialization "Unknown"/
  );
});

test('Engineer runtime UI and public projection preserve their contracts', () => {
  for (const active of ['Core', ...ENGINEER_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = engineerProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const resourceIds = runtime.ui
      .resourceViews({
        config,
        state: { profession: state }
      })
      .map((resource) => resource.id);
    const uiContext = {
      config,
      specialization: active,
      professionState: state,
      state: { profession: state }
    };

    assert.equal(resourceIds.includes('heat'), active === 'Holosmith', active);
    assert.equal(
      runtime.ui.skillBarGroups(uiContext).some((group) => group.label === 'Photon Forge'),
      active === 'Holosmith',
      active
    );
    assert.equal(
      runtime.ui.paletteGroups(uiContext).some((group) => group.id === 'engineer-forge'),
      active === 'Holosmith',
      active
    );
    assert.equal(
      runtime.ui.assumptionControls.some((control) => control.key === 'inDamagingField'),
      active === 'Amalgam',
      active
    );
  }

  const result = simulateGw2({
    profession: engineerProfession,
    rotation: [],
    config: { specialization: 'Core' }
  });

  assert.equal(result.endState.profession.heat, 0);
  assert.equal(result.endState.profession.photonForgeActive, false);
  assert.equal(result.endState.profession.mech.enabled, false);
  assert.deepEqual(result.endState.profession.selectedMorphSkillIds, []);
});
