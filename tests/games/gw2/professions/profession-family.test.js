import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { defineProfessionFamily } from '#gw2/platform/engine/profession/family.js';
import { defineProfessionModule } from '#gw2/platform/engine/profession/module.js';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { assertProfessionFamilyConformance } from '#tests/helpers/profession-family-conformance.js';
import { composeSkillMechanics } from '#tests/helpers/skill-mechanics.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import { ENGINEER_CORE_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/index.js';
import { ENGINEER_SKILL_IDS as ENGINEER_ID } from '#gw2/professions/engineer/data/ids.js';
import { amalgamModule } from '#gw2/professions/engineer/specializations/amalgam/module.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/index.js';
import { holosmithModule } from '#gw2/professions/engineer/specializations/holosmith/module.js';
import { HOLOSMITH_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/index.js';
import { mechanistModule } from '#gw2/professions/engineer/specializations/mechanist/module.js';
import { MECHANIST_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/index.js';
import { scrapperModule } from '#gw2/professions/engineer/specializations/scrapper/module.js';
import { SCRAPPER_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/scrapper/skills/index.js';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { necromancerCoreModule } from '#gw2/professions/necromancer/core/module.js';
import { harbingerModule } from '#gw2/professions/necromancer/specializations/harbinger/module.js';
import { reaperModule } from '#gw2/professions/necromancer/specializations/reaper/module.js';
import { ritualistModule } from '#gw2/professions/necromancer/specializations/ritualist/module.js';
import { scourgeModule } from '#gw2/professions/necromancer/specializations/scourge/module.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianCoreModule } from '#gw2/professions/guardian/core/module.js';
import { dragonhunterModule } from '#gw2/professions/guardian/specializations/dragonhunter/module.js';
import { firebrandModule } from '#gw2/professions/guardian/specializations/firebrand/module.js';
import { luminaryModule } from '#gw2/professions/guardian/specializations/luminary/module.js';
import { willbenderModule } from '#gw2/professions/guardian/specializations/willbender/module.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { mesmerCoreModule } from '#gw2/professions/mesmer/core/module.js';
import { chronomancerModule } from '#gw2/professions/mesmer/specializations/chronomancer/module.js';
import { mirageModule } from '#gw2/professions/mesmer/specializations/mirage/module.js';
import { troubadourModule } from '#gw2/professions/mesmer/specializations/troubadour/module.js';
import { virtuosoModule } from '#gw2/professions/mesmer/specializations/virtuoso/module.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
import { REVENANT_SKILL_IDS } from '#gw2/professions/revenant/data/ids.js';
import { conduitModule } from '#gw2/professions/revenant/specializations/conduit/module.js';
import { heraldModule } from '#gw2/professions/revenant/specializations/herald/module.js';
import { renegadeModule } from '#gw2/professions/revenant/specializations/renegade/module.js';
import { vindicatorModule } from '#gw2/professions/revenant/specializations/vindicator/module.js';
import { thiefProfession, thiefCatalog } from '#gw2/professions/thief/profession.js';
import { thiefCoreModule } from '#gw2/professions/thief/core/module.js';
import { antiquaryModule as thiefAntiquaryModule } from '#gw2/professions/thief/specializations/antiquary/module.js';
import { daredevilModule as thiefDaredevilModule } from '#gw2/professions/thief/specializations/daredevil/module.js';
import { deadeyeModule as thiefDeadeyeModule } from '#gw2/professions/thief/specializations/deadeye/module.js';
import { specterModule as thiefSpecterModule } from '#gw2/professions/thief/specializations/specter/module.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { tempestModule } from '#gw2/professions/elementalist/specializations/tempest/module.js';
import { weaverModule } from '#gw2/professions/elementalist/specializations/weaver/module.js';
import { catalystModule } from '#gw2/professions/elementalist/specializations/catalyst/module.js';
import { evokerModule } from '#gw2/professions/elementalist/specializations/evoker/module.js';

// Tests derive elite names from the same canonical catalog consumed by production.
function eliteSpecializationNames(catalog) {
  return catalog.specializations.filter((specialization) => specialization.elite).map(({ name }) => name);
}

function nativeModifierRules(module) {
  const modifiers = module.modifiers;

  return Array.isArray(modifiers) ? modifiers : modifiers?.modifierRules || [];
}

function nativeSkillOwnerMap(slices) {
  const modules = slices.map(([, module]) => module);

  return getNativeCatalogAssembly(modules, undefined).skillOwners;
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
    [engineerProfession, 'Holosmith', { type: 'engineer.prime-light-beam-field', at: 0 }],
    [
      engineerProfession,
      'Holosmith',
      {
        type: 'engineer.heat',
        at: 0,
        reason: 'heat',
        heat: 25
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
    [necromancerProfession, 'Ritualist', { type: 'necromancer.painful-bond', at: 0 }]
  ];

  for (const [family, specialization, event] of cases) {
    const coreConfig = { specialization: 'Core' };
    const activeConfig = { specialization };
    const coreState = family.resolveProfession(coreConfig).createState(coreConfig);
    const activeRuntime = family.resolveProfession(activeConfig);
    const activeState = activeRuntime.createState(activeConfig);
    const coreRow = family.ui.eventLogRow?.({ config: coreConfig, state: { profession: coreState } }, event);

    assert.equal(coreRow?.description, undefined, `${family.id}/Core must not present ${event.type}`);
    assert.notEqual(
      family.ui.eventLogRow?.({ config: activeConfig, state: { profession: activeState } }, event),
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
      specializations: new Map()
    };

    for (const module of modules) {
      assert.equal(module.kind, 'native-profession-module', `${name}:${module.id}`);
      assert.equal(typeof module.state.create, 'function', `${name}:${module.id}`);
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

    const skillOwners = getNativeCatalogAssembly(modules, undefined).skillOwners;
    for (const active of ['Core', ...family.specializationIds]) {
      const runtime = family.resolveProfession({ specialization: active });
      const runtimeIds = new Set(runtime.catalog.skills.map((skill) => skill.id));

      for (const skill of catalog.skills) {
        const owner = skillOwners.get(skill.id);

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
  effects: []
});
const eliteSkill = Object.freeze({
  id: 2,
  name: 'Elite Skill',
  castTimeMs: 0,
  effects: [],
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
      createState: () => (id === 'Core' ? { coreReady: true } : { eliteReady: true })
    },
    attributeRules: options.attributeRules,
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
      effectPresentations: () => [{ id: 'core-effect', kind: 'core-effect', name: 'Core Effect' }],
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
      effectPresentations: () => [{ id: 'elite-effect', kind: 'elite-effect', name: 'Elite Effect' }],
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

  assert.equal(family.ui.eventLogRow({ config: { specialization: 'Elite' } }, shared).description, 'core');
  assert.equal(family.ui.eventLogRow({ specialization: 'Elite' }, shared).description, 'core');
  assert.equal(family.ui.eventLogRow({ specialization: 'Core' }, eliteOnly), undefined);
  assert.equal(family.ui.eventLogRow({ build: { specialization: 'Elite' } }, eliteOnly).description, 'elite');
  assert.deepEqual(
    family.ui.effectPresentations({ specialization: 'Elite' }).map((effect) => effect.id),
    ['core-effect', 'elite-effect']
  );
  assert.deepEqual(
    family.ui.effectPresentations({ specialization: 'Core' }).map((effect) => effect.id),
    ['core-effect']
  );
  assert.equal(
    family.ui.eventLogRow({ config: { specialization: 'Core Line' } }, { type: 'context', at: 0 }).description,
    'Core'
  );
  assert.deepEqual(family.ui.paletteSkillAvailability({ specialization: 'Elite' }, eliteSkill), {
    available: false,
    message: 'family veto'
  });
});

test('profession families resolve Core or one known elite and cache contracts', () => {
  const family = testFamily();
  const core = family.resolveProfession({});
  const elite = family.resolveProfession({ specialization: 'Elite' });

  assert.deepEqual(
    core.catalog.skills.map((skill) => skill.id),
    [1]
  );
  assert.deepEqual(
    elite.catalog.skills.map((skill) => skill.id),
    [1, 2]
  );
  assert.deepEqual(core.createState({}), {
    core: { coreReady: true },
    specialization: { kind: 'Core', state: {} }
  });
  assert.deepEqual(elite.createState({ specialization: 'Elite' }), {
    core: { coreReady: true },
    specialization: { kind: 'Elite', state: { eliteReady: true } }
  });
  assert.equal(family.resolveProfession({ specialization: 'Elite' }), elite);
  assert.equal(family.catalog, familyCatalog);
  assert.throws(
    () => family.resolveProfession({ specialization: 'Missing' }),
    /Unknown Family Test elite specialization "Missing"/
  );
});

test('family hook order is deterministic and duplicate hook ids fail', () => {
  const calls = [];
  const core = testModule('Core', {
    attributeRules: {
      modifyAttributes: {
        id: 'core.initialize',
        order: 20,
        handler: () => calls.push('core')
      }
    }
  });
  const elite = testModule('Elite', {
    attributeRules: {
      modifyAttributes: {
        id: 'elite.initialize',
        order: 10,
        handler: () => calls.push('elite')
      }
    }
  });

  testFamily(core, elite).resolveProfession({ specialization: 'Elite' }).modifyAttributes({}, {});
  assert.deepEqual(calls, ['elite', 'core']);

  const duplicate = {
    id: 'same.initialize',
    handler: () => undefined
  };

  assert.throws(
    () =>
      testFamily(
        testModule('Core', {
          attributeRules: { modifyAttributes: duplicate }
        }),
        testModule('Elite', {
          attributeRules: { modifyAttributes: duplicate }
        })
      ).resolveProfession({ specialization: 'Elite' }),
    /Duplicate modifyAttributes hook id: same\.initialize/
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

  assert.equal(family.resolveProfession({}).modifyStrikeDamage({}, 10), 11);
  assert.equal(family.resolveProfession({ specialization: 'Elite' }).modifyStrikeDamage({}, 10), 12);
  assert.deepEqual(compiledRuleIds, [['core.rule'], ['core.rule', 'elite.rule']]);
});

test('family composition rejects duplicate registries and catalog ids', () => {
  assert.throws(
    () =>
      testFamily(
        testModule('Core'),
        testModule('Elite', {
          catalog: { skills: [coreSkill] }
        })
      ).resolveProfession({ specialization: 'Elite' }),
    /Duplicate skill id 1/
  );
});

test('canonical simulation resolves the selected live source once', () => {
  const runtime = defineProfession({
    id: 'counted-runtime',
    name: 'Counted Runtime',
    catalog: createCanonicalCatalog()
  });
  let resolutions = 0;
  const source = {
    ...runtime,
    runtimeFor(config) {
      resolutions += 1;
      return runtime.runtimeFor(config);
    }
  };

  simulateGw2({ profession: source, rotation: [], config: {} });
  assert.equal(resolutions, 1);
});

const inactiveStateKeys = Object.freeze({
  Reaper: ['chillingNovaReadyAt', 'chillingVictoryReadyAt'],
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

test('Necromancer modules contribute complete disjoint runtime slices', () => {
  const slices = [
    ['core', necromancerCoreModule],
    ['specializations/reaper', reaperModule],
    ['specializations/scourge', scourgeModule],
    ['specializations/harbinger', harbingerModule],
    ['specializations/ritualist', ritualistModule]
  ];
  const modifierRuleOwners = new Map();

  for (const [, module] of slices) {
    assert.equal(typeof module.state?.create, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    // Modules contain their runtime behavior in one hook table without a second scheduler or resolver registration.
    assert.ok(module.hooks);
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
});

test('Necromancer runtimes exclude sibling catalogs, handlers, and state', () => {
  assert.equal(necromancerProfession.catalog, necromancerCatalog);
  assert.equal(necromancerProfession.catalog.specializations.length, 9);

  for (const active of ['Core', ...eliteSpecializationNames(necromancerCatalog)]) {
    const config = { specialization: active };
    const runtime = necromancerProfession.resolveProfession(config);
    const state = runtime.createState(config);
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
          eliteSpecializationNames(necromancerCatalog).includes(skill.specialization) &&
          skill.specialization !== activeElite
      ),
      false,
      active
    );
    for (const [owner, keys] of Object.entries(inactiveStateKeys)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.specialization.state, key), owner === active, `${active}:slice:${key}`);
        assert.equal(Object.hasOwn(state, key), false, `${active}:no-flat-state:${key}`);
      }
    }

    const live = necromancerProfession.runtimeFor(config);
    assert.equal(Object.hasOwn(live.eventHandlers, 'necromancer.painful-bond'), active === 'Ritualist', active);
    assert.equal(Object.hasOwn(live.eventHandlers, 'necromancer.weapon-spell'), false, active);
    assert.equal(Object.hasOwn(live.eventHandlers, 'necromancer.spirit-attack'), false, active);
  }
});

test('Necromancer presentation exposes only active specialization resources', () => {
  for (const active of ['Core', ...eliteSpecializationNames(necromancerCatalog)]) {
    const config = { specialization: active };
    const runtime = necromancerProfession.resolveProfession(config);
    const state = runtime.createState(config);
    const resourceIds = necromancerProfession.ui
      .resourceViews({
        config,
        state: { profession: state }
      })
      .map((resource) => resource.id);

    assert.equal(resourceIds.includes('blight'), active === 'Harbinger', active);
  }
});

test('Necromancer public projection reports neutral inactive specialization resources', () => {
  const result = runGw2Runtime({
    profession: necromancerProfession.runtimeFor({ specialization: 'Core' }),
    rotation: [],
    config: { specialization: 'Core' }
  });

  assert.equal(result.planningState.profession.blight, 0);
  assert.deepEqual(result.planningState.profession.blightExpiries, []);
  assert.deepEqual(result.planningState.profession.shades, []);
  assert.deepEqual(result.planningState.profession.activeSpirits, {});
  assert.equal(result.planningState.profession.soulTwistingAvailable, false);
  assert.equal(result.planningState.profession.meltdownUntil, 0);
});

const guardianInactiveStateKeys = Object.freeze({
  Dragonhunter: ['tetherUntil', 'heavyLightReadyAt'],
  Firebrand: [
    'activeTome',
    'tomePages',
    'ashes',
    'tomeDormantReadyAt',
    'swiftScholarTome',
    'swiftScholarCount',
    'liberatorsVowReadyAt',
    'stalwartSpeedReadyAt',
    'quickfireReadyAt',
    'mantraRechargeReadyAt'
  ],
  Willbender: [
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
    'radiantJusticeArmed',
    'radiantCourageSwordArmed',
    'radiantCourageShieldArmed',
    'effulgentActiveUntil',
    'effulgentStacks'
  ]
});

test('Guardian modules contribute disjoint runtime slices', () => {
  const slices = [
    ['core', guardianCoreModule],
    ['specializations/dragonhunter', dragonhunterModule],
    ['specializations/firebrand', firebrandModule],
    ['specializations/willbender', willbenderModule],
    ['specializations/luminary', luminaryModule]
  ];
  const modifierRuleOwners = new Map();

  for (const [, module] of slices) {
    assert.equal(typeof module.state?.create, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  assert.equal(modifierRuleOwners.get('guardian.empowered-armaments'), 'Luminary');
  assert.equal(modifierRuleOwners.get('guardian.radiant-power-critical-chance'), 'Core');
});

test('Guardian runtimes exclude inactive elite catalogs, registries, and state', () => {
  assert.equal(guardianProfession.catalog, guardianCatalog);
  const skillOwners = nativeSkillOwnerMap([
    ['core', guardianCoreModule],
    ['dragonhunter', dragonhunterModule],
    ['firebrand', firebrandModule],
    ['willbender', willbenderModule],
    ['luminary', luminaryModule]
  ]);

  for (const active of ['Core', ...eliteSpecializationNames(guardianCatalog)]) {
    const config = { specialization: active };
    const runtime = guardianProfession.resolveProfession(config);
    const state = runtime.createState(config);
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
    for (const [owner, keys] of Object.entries(guardianInactiveStateKeys)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.specialization.state, key), owner === active, `${active}:slice:${key}`);
        assert.equal(Object.hasOwn(state, key), false, `${active}:no-flat-state:${key}`);
      }
    }

    const native = guardianProfession.runtimeFor(config);
    assert.equal(Object.hasOwn(native.resources, 'tomePages'), active === 'Firebrand', `${active}:pages`);
    assert.equal(
      Object.hasOwn(native.tasks, 'guardian.luminary.forge-expiry'),
      active === 'Luminary',
      `${active}:forge-expiry`
    );
    assert.equal('eventHandlers' in runtime, false);
  }
});

test('Guardian presentation and public projection preserve their contracts', () => {
  for (const active of ['Core', ...eliteSpecializationNames(guardianCatalog)]) {
    const config = { specialization: active };
    const runtime = guardianProfession.resolveProfession(config);
    const state = runtime.createState(config);
    const resourceIds = guardianProfession.ui
      .resourceViews({
        config,
        state: { profession: state }
      })
      .map((resource) => resource.id);

    assert.equal(resourceIds.includes('pages'), active === 'Firebrand', active);
    const paletteIds = guardianProfession.ui
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

  assert.equal(result.planningState.profession.activeTome, '');
  assert.equal(result.planningState.profession.tomePages.value, 5);
  assert.equal(result.planningState.profession.radiantForge, false);
  assert.deepEqual(result.planningState.profession.radiantWeaponsUsed, {});
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
  Virtuoso: ['numericResource', 'bloodsongProgress'],
  Troubadour: ['numericResource', 'instruments', 'lastInstrument']
});

test('Mesmer modules contribute disjoint runtime slices', () => {
  const modifierRuleOwners = new Map();

  for (const [, module] of mesmerSlices) {
    assert.equal(typeof module.state?.create, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }
});

test('Mesmer runtimes exclude inactive elite catalogs, registries, and state', () => {
  const skillOwner = nativeSkillOwnerMap(mesmerSlices);

  assert.equal(mesmerProfession.catalog, mesmerCatalog);
  for (const active of ['Core', ...eliteSpecializationNames(mesmerCatalog)]) {
    const config = { specialization: active };
    const runtime = mesmerProfession.runtimeFor(config);
    const state = runtime.createState(config);
    const activeElite = active === 'Core' ? null : active;

    assert.equal(runtime, mesmerProfession.runtimeFor(config), active);
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
      Object.hasOwn(runtime.tasks, 'mesmer.continuum-expire'),
      active === 'Chronomancer',
      `${active}:continuum-task`
    );
    assert.equal(Object.hasOwn(runtime.tasks, 'mesmer.blade-spend'), active === 'Virtuoso', `${active}:blade-task`);
    assert.equal(
      Object.hasOwn(runtime.eventHandlers, 'mesmer.instrument'),
      active === 'Troubadour',
      `${active}:instrument-handler`
    );
  }

  assert.throws(() => mesmerProfession.runtimeFor({ specialization: 'Missing' }), /Unknown specialization: Missing/);
});

test('Mesmer presentation and ammo output expose only the active specialization state', () => {
  for (const active of ['Core', ...eliteSpecializationNames(mesmerCatalog)]) {
    const config = { specialization: active };
    const runtime = mesmerProfession.resolveProfession(config);
    const state = runtime.createState(config);
    const resources = mesmerProfession.ui.resourceViews({
      catalog: runtime.catalog,
      config,
      state: { profession: state }
    });

    // Only Mirage and Troubadour expose dodge endurance alongside their primary resource.
    assert.deepEqual(
      resources.map((resource) => resource.id),
      [
        active === 'Virtuoso' ? 'blades' : active === 'Troubadour' ? 'notes' : 'clones',
        ...(['Mirage', 'Troubadour'].includes(active) ? ['endurance'] : [])
      ],
      active
    );

    // Name-keyed ammo aliases live scheduler entries; inactive skills receive no synthetic charges.
    const result = simulateGw2({ profession: mesmerProfession, config, rotation: [] });
    const liveAmmo = Object.entries(result.planningState.ammoBySkillId).map(([id, ammo]) => [Number(id), ammo]);
    assert.deepEqual(
      result.planningState.ammo,
      Object.fromEntries(liveAmmo.map(([id, ammo]) => [runtime.catalog.skillsById.get(id).name, ammo])),
      active
    );
    assert.deepEqual(result.planningState.ammoBySkillId, Object.fromEntries(liveAmmo), active);
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

    'razorclawsRage',
    'endlessEnmityReadyAt',
    'bloodFuryReadyAt',
    'soulcleaveReadyAt'
  ],
  Vindicator: ['reaversCurseUntil', 'forerunnerOfDeathUntil'],
  Conduit: [
    'affinity',
    'cosmicWisdomUntil',
    'conduitForm',
    'beguilingHazeCharges',
    'beguilingHazeReadyAt',
    'energyCostOverrides',
    'mistfireReadyAt'
  ]
});

test('Revenant modules contribute disjoint runtime slices', () => {
  const modifierRuleOwners = new Map();

  for (const [, module] of revenantSlices) {
    assert.equal(typeof module.state?.create, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
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
});

test('Revenant runtimes exclude inactive elite catalogs, hooks, and state', () => {
  const skillOwner = nativeSkillOwnerMap(revenantSlices);

  for (const [owner, skillIds] of [
    ['Herald', [REVENANT_SKILL_IDS.LEGENDARY_DRAGON_STANCE, REVENANT_SKILL_IDS.CALL_OF_THE_DRAGON]],
    ['Renegade', [REVENANT_SKILL_IDS.LEGENDARY_RENEGADE_STANCE, REVENANT_SKILL_IDS.CALL_OF_THE_RENEGADE]],
    ['Vindicator', [REVENANT_SKILL_IDS.LEGENDARY_ALLIANCE_STANCE, REVENANT_SKILL_IDS.CALL_OF_THE_ALLIANCE]],
    ['Conduit', [REVENANT_SKILL_IDS.LEGENDARY_ENTITY_STANCE, REVENANT_SKILL_IDS.COSMIC_WISDOM]]
  ]) {
    for (const skillId of skillIds) assert.equal(skillOwner.get(skillId), owner, String(skillId));
  }

  assert.equal(revenantProfession.catalog, revenantCatalog);
  for (const active of ['Core', ...eliteSpecializationNames(revenantCatalog)]) {
    const config = { specialization: active };
    const runtime = revenantProfession.resolveProfession(config);
    const state = runtime.createState(config);
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

    assert.equal('eventHandlers' in runtime, false);
    // Each elite's recurring live work is registered only while that elite is selected.
    const native = revenantProfession.runtimeFor(config);
    for (const [owner, task] of [
      ['Herald', 'revenant.herald-facet-pulse'],
      ['Renegade', 'revenant.soulcleave-allied-proc'],
      ['Vindicator', 'revenant.vindicator-landing'],
      ['Conduit', 'revenant.conduit-upkeep-affinity']
    ])
      assert.equal(Object.hasOwn(native.tasks, task), owner === active, `${active}:${task}`);
  }
});

test('Revenant presentation and public projection preserve their contracts', () => {
  for (const active of ['Core', ...eliteSpecializationNames(revenantCatalog)]) {
    const config = { specialization: active };
    const runtime = revenantProfession.resolveProfession(config);
    const state = runtime.createState(config);
    const resourceIds = revenantProfession.ui
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

  assert.equal(result.planningState.profession.affinity, 0);
  assert.equal(result.planningState.profession.bandTogetherReady, false);
  assert.deepEqual(result.planningState.profession.kallasFervor, []);
});

const engineerSlices = Object.freeze([
  ['core', engineerCoreModule],
  ['specializations/scrapper', scrapperModule],
  ['specializations/holosmith', holosmithModule],
  ['specializations/mechanist', mechanistModule],
  ['specializations/amalgam', amalgamModule]
]);

const engineerSpecializationStateKeys = Object.freeze({
  Holosmith: ['heat', 'maximumHeat', 'photonForgeActive', 'overheated', 'solarFocusingLens'],
  Mechanist: ['mech'],
  Amalgam: ['selectedMorphSkillIds', 'evolvedUntil', 'plasmaticStateUntil']
});

test('Engineer modules contribute disjoint runtime slices', () => {
  const modifierRuleOwners = new Map();

  for (const [, module] of engineerSlices) {
    assert.equal(typeof module.state?.create, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);

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
  const skillOwner = nativeSkillOwnerMap(engineerSlices);
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
    ENGINEER_ID.REFRACTION_CUTTER_NON_HOLOSMITH
  ];

  assert.ok(holosmithSwordIds.every((skillId) => skillOwner.get(skillId) === 'Holosmith'));
  assert.ok(sharedSwordIds.every((skillId) => skillOwner.get(skillId) === 'Core'));

  assert.equal(engineerProfession.catalog, engineerCatalog);
  for (const active of ['Core', ...eliteSpecializationNames(engineerCatalog)]) {
    const config = { specialization: active };
    const runtime = engineerProfession.runtimeFor(config);
    const state = runtime.createState(config);
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
      Object.hasOwn(runtime.tasks, 'engineer.photon-forge-heat'),
      active === 'Holosmith',
      `${active}:heat-task`
    );
    assert.equal(Object.hasOwn(runtime.tasks, 'engineer.mech-attack'), active === 'Mechanist', `${active}:mech-task`);
    assert.equal(Object.hasOwn(runtime.tasks, 'engineer.evolve'), active === 'Amalgam', `${active}:amalgam-task`);
    assert.equal(
      Object.hasOwn(runtime.tasks, 'engineer.mass-momentum'),
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
    () => engineerProfession.resolveProfession({ specialization: 'Unknown' }),
    /Unknown Engineer elite specialization "Unknown"/
  );
});

test('Engineer presentation and public projection preserve their contracts', () => {
  for (const active of ['Core', ...eliteSpecializationNames(engineerCatalog)]) {
    const config = { specialization: active };
    const runtime = engineerProfession.runtimeFor(config);
    const state = runtime.createState(config);
    const resourceIds = engineerProfession.ui
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
      engineerProfession.ui.paletteGroups(uiContext).some((group) => group.id === 'engineer-forge'),
      active === 'Holosmith',
      active
    );
    assert.equal(
      engineerProfession.ui.assumptionControls.some(
        (control) => control.key === 'inDamagingField' && control.specializations?.includes(active)
      ),
      active === 'Amalgam',
      active
    );
  }

  const result = runGw2Runtime({
    profession: engineerProfession.runtimeFor({ specialization: 'Core' }),
    rotation: [],
    config: { specialization: 'Core' }
  });

  assert.equal(result.planningState.profession.heat, 0);
  assert.equal(result.planningState.profession.photonForgeActive, false);
  assert.equal(result.planningState.profession.mech.enabled, false);
  assert.deepEqual(result.planningState.profession.selectedMorphSkillIds, []);
});
