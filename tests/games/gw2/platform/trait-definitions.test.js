import { equipmentAttributeConversions } from '#gw2/platform/attributes/inputs.js';
import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createCalculateAttributes, resolveAttributeEffects } from '#gw2/platform/attributes/calculation.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  defineTrait,
  traitAttributeBonuses,
  traitAttributeEffects
} from '#gw2/platform/profession-definition/traits.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import { createProfessionTraitData } from '#gw2/professions/shared/trait-data.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const tuning = (context, field) => balanceNumberFromContext(context, 101, field);
const metadata = { id: 101, name: 'Fixture Trait' };

// Producer slots cannot be hidden among retained policies, even by JavaScript callers or object spreads.
test('trait authoring rejects obsolete producer hooks and unsupported lifetime registrations', () => {
  for (const key of [
    'onCombatStart',
    'onCastStart',
    'onCastCommit',
    'onCastCancel',
    'onCooldownReset',
    'onAutoattackChainTransition',
    'reactions',
    'tasks',
    'eventHandlers',
    'sideEffectHandlers',
    'rechargeWork',
    'rechargeStart',
    'castDetail'
  ]) {
    assert.throws(() => defineTrait({ ...metadata, hooks: { [key]: () => undefined } }), /Unsupported trait hook/);
  }

  for (const key of ['initialize', 'onCombatStart', 'onCastCancel', 'sideEffectHandlers', 'traitTriggers']) {
    assert.throws(
      () => defineTrait({ ...metadata, lifetime: { [key]: () => undefined } }),
      /Unsupported trait lifetime hook/
    );
  }

  for (const stage of [
    'condition.applied',
    'condition-tick.resolved',
    'control.resolved',
    'combo.resolved',
    'misspelled'
  ]) {
    assert.throws(
      () => defineTrait({ ...metadata, lifetime: { reactions: { [stage]: () => undefined } } }),
      /Unsupported trait lifetime reaction/
    );
  }

  assert.throws(() => defineTrait({ ...metadata, lifetime: [] }), /lifetime must be an object/);
  assert.throws(() => defineTrait({ ...metadata, lifetime: { tasks: { bad: 1 } } }), /must contain handlers/);
});

test('trait initialization imports supplied state without activation capabilities in either runtime mode', () => {
  const importer = defineTrait({
    ...metadata,
    hooks: {
      initialize(context) {
        assert.equal(context.effects, undefined);
        assert.equal(context.schedule, undefined);
        assert.equal(context.procs, undefined);
        assert.equal(context.fireTrigger, undefined);
        assert.equal(context.resourceController, undefined);
        context.profession.core.count = context.config.initialCount;
      }
    }
  });
  const family = familyWith(moduleWith([importer]));
  for (const traitTriggers of [true, false]) {
    const result = family.runtimeFor({}, { traitTriggers });
    const state = result.createState({});
    result.initialize({
      profession: state,
      config: { initialCount: 3 },
      time: 0,
      helpers: result.catalog,
      traits: new Set(),
      effects: {
        emit() {
          assert.fail('Producer capability leaked');
        }
      }
    });
    assert.equal(state.core.count, 3);
  }
});

test('trait value transforms receive query capabilities while profession hooks retain their mechanic context', () => {
  const queries = { time: 2 };
  const calls = [];
  const policy = defineTrait({
    ...metadata,
    hooks: {
      prepareEvent(context, event) {
        assert.equal(context, queries);
        calls.push('trait packet');
        return event;
      },
      modifyEffects(context, _cast, effects) {
        assert.equal(context, queries);
        calls.push('trait effects');
        return effects;
      }
    }
  });
  const context = { queries, effects: { emit() {} }, schedule() {} };
  const family = familyWith(
    moduleWith([policy], {
      hooks: {
        prepareEvent(runtime, event) {
          assert.equal(runtime, context);
          calls.push('mechanic packet');
          return event;
        },
        modifyEffects(runtime, _cast, effects) {
          assert.equal(runtime, context);
          calls.push('mechanic effects');
          return effects;
        }
      }
    })
  );
  for (const traitTriggers of [true, false]) {
    const runtime = family.runtimeFor({}, { traitTriggers });
    const event = { type: 'damage', at: 2 };
    assert.equal(runtime.prepareEvent(context, event), event);
    const effects = [];
    assert.equal(runtime.modifyEffects(context, {}, effects), effects);
  }

  assert.deepEqual(calls, [
    'trait packet',
    'mechanic packet',
    'trait effects',
    'mechanic effects',
    'trait packet',
    'mechanic packet',
    'trait effects',
    'mechanic effects'
  ]);
});
const skill = {
  id: 1,
  name: 'Strike',
  type: 'Weapon',
  weapon: 'Sword',
  castTimeMs: 0,
  cooldown: 10,
  effects: [{ type: 'strike', coefficient: 1 }]
};

// Fixtures exercise shared contracts without migrating a profession or pinning a saved rotation's output.
function moduleWith(traits, options = {}) {
  return defineNativeModule({
    id: 'Core',
    data: { generatedSkills: [skill], traits: traits.map(({ id, name }) => ({ id, name })) },
    state: { create: () => ({ count: 0, readyAt: 0 }) },
    ...options,
    traitDefinitions: traits
  });
}

function familyWith(core, ...elites) {
  return defineNativeProfession({ id: 'fixture', name: 'Fixture', modules: [core, ...elites] });
}

// Ordered attribute phases share one observation, but a later query at the same time observes changed state.
test('attribute phases sample declarations once per query and refresh after a same-time state change', () => {
  let bonus = 20;
  let samples = 0;
  const family = familyWith(
    moduleWith([
      defineTrait({
        ...metadata,
        attributes() {
          samples++;
          return {
            attributeEffects: [{ kind: 'flat', to: 'Power', amount: bonus, feedsConversions: 'none' }],
            mightPerStack: { power: 2 },
            finalCondition: { condition: 'Burning', powerMultiplier: 0.1 }
          };
        }
      })
    ])
  );
  const config = { selectedTraitIds: [101], attributeInputs: baseAttributeInputs(), boons: { might: 25 } };
  const query = createGw2CombatQuery({ profession: family.runtimeFor(config), config });
  const event = { type: 'condition', condition: 'Burning', actorType: 'player', at: 5 };
  const first = query.statsAt(5, event);
  assert.equal(samples, 1);
  assert.equal(first.power, 1820);
  assert.equal(first.conditionDamage, 182);
  bonus = 40;
  const second = query.statsAt(5, event);
  assert.equal(samples, 2);
  assert.equal(second.power, 1840);
  assert.equal(second.conditionDamage, 184);
  assert.equal(first.power, 1820);
});

// Reusing a build's selection array across runs must not couple their compiled attribute contributors.
test('attribute selection is fixed per query and rebuilt for a new run', () => {
  const family = familyWith(
    moduleWith([
      defineTrait({
        ...metadata,
        attributes: (context) => ({
          attributeEffects: [
            { kind: 'flat', to: 'Power', amount: hasTrait(context, 101) ? 20 : 0, feedsConversions: 'none' }
          ]
        })
      })
    ])
  );
  const selectedTraitIds = [101];
  const config = { attributeInputs: baseAttributeInputs(), selectedTraitIds };
  const profession = family.runtimeFor(config);
  const first = createGw2CombatQuery({ profession, config });
  const notYetSampled = createGw2CombatQuery({ profession, config });
  assert.equal(first.statsAt(0).power, 1020);
  selectedTraitIds.length = 0;
  const second = createGw2CombatQuery({ profession, config });
  assert.equal(second.statsAt(0).power, 1000);
  assert.equal(first.statsAt(1).power, 1020);
  assert.equal(notYetSampled.statsAt(1).power, 1020);
});

// Exercise declarative effects through the same selection, preview, and provenance pipeline as custom contributions.
const fixtureAttributeEffects = traitAttributeEffects(101, [
  { kind: 'flat', to: 'Power', field: 'attributeBonus', feedsConversions: 'all' },
  {
    kind: 'conversion',
    from: 'Power',
    to: 'Ferocity',
    field: 'attributeConversion',
    rounding: 'round',
    input: 'eligible'
  }
]);

const trait = defineTrait({
  ...metadata,
  balance: {
    rechargeMultiplier: 0.5,
    attributeBonus: 20,
    attributeConversion: 0.1,
    effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2 }]
  },
  profiles: [{ id: 'fixture.extra', name: 'Separate proc', profileKind: 'trait', effects: [] }],
  modifierRules: [
    {
      id: 'fixture.damage',
      target: 'strikeDamage',
      operation: 'multiply',
      parameters: { bonus: 1 },
      factor: (_context, _target, parameters) => 1 + parameters.bonus
    }
  ],
  triggers: [{ on: 'castCommit', emit: 101, when: () => true }],
  rechargeRules: [{ when: () => true, multiplier: { profile: 101, field: 'rechargeMultiplier' } }],
  attributes: (context) => ({
    ...fixtureAttributeEffects(context),
    traitCriticalChance: context.balanceContext.modifierRulesById.get('fixture.damage').parameters.bonus
  })
});

function previewFamily(core = moduleWith([trait])) {
  return withPatchPreview(familyWith(core), {
    id: 'preview',
    label: 'Preview',
    professions: {
      fixture: {
        balanceProfiles: {
          101: {
            fields: { attributeBonus: 40, rechargeMultiplier: 0.25 },
            removeEffects: [{ effectIndex: 0, type: 'condition', condition: 'Bleeding' }]
          }
        },
        modifierRules: { 'fixture.damage': { parameters: { bonus: 2 } } }
      }
    }
  });
}

// Every registered module exposes one modifier shape, including trait-free modules and preview clones.
test('module registration normalizes modifiers and rejects invalid rule collections', () => {
  const rules = [trait.modifierRules[0]];
  const modifyCriticalChance = (_context, chance) => chance + 0.1;
  assert.deepEqual(moduleWith([]).modifiers, {});
  const core = moduleWith([], { modifiers: rules });
  assert.deepEqual(core.modifiers, { modifierRules: rules });
  const imperative = moduleWith([], { modifiers: { modifierRules: rules, modifyCriticalChance } });
  assert.equal(imperative.modifiers.modifyCriticalChance, modifyCriticalChance);
  assert.equal(familyWith(imperative).runtimeFor({}).modifyCriticalChance({}, 0), 0.1);
  assert.equal(familyWith(imperative).runtimeFor({}).modifyStrikeDamage({}, 10), 20);
  assert.throws(() => moduleWith([], { modifiers: { modifierRules: {} } }), /modifierRules must be an array/);
  assert.throws(() => moduleWith([], { modifiers: 1 }), /modifiers must be an object/);
  assert.throws(() => familyWith({ ...core, modifiers: rules }), /modifiers must be an object/);
  assert.throws(() => familyWith({ ...core, modifiers: { modifierRules: {} } }), /modifierRules must be an array/);
});

// Registration and reconstruction both reject unsupported fields, including on an inactive elite module.
test('native modules reject unsupported modifier declarations before composition', () => {
  const core = moduleWith([]);
  const elite = defineNativeModule({ id: 'Elite', data: {}, state: { create: () => ({}) } });
  for (const key of ['modifyStrikeDamage', 'modifyConditionDamage', 'compileModifierRules', 'unknownModifier']) {
    const modifiers = { [key]: () => 99 };
    assert.throws(() => moduleWith([], { modifiers }), {
      name: 'TypeError',
      message: `Unsupported Core.modifiers field: ${key}.`
    });
    assert.throws(() => familyWith({ ...core, modifiers }), {
      name: 'TypeError',
      message: `Unsupported Core.modifiers field: ${key}.`
    });
    assert.throws(() => familyWith(core, { ...elite, modifiers }), {
      name: 'TypeError',
      message: `Unsupported Elite.modifiers field: ${key}.`
    });
  }
});

// Trait expansion preserves non-damage hooks and evaluates trait selection on each query.
test('trait expansion preserves scalar hooks, damage policies, and cached runtime selection isolation', () => {
  const family = familyWith(
    moduleWith([trait], {
      modifiers: {
        modifyCriticalChance: (_context, chance) => chance + 0.1,
        damageBuckets: { strikeDamage: { includeSigil: false } }
      }
    }),
    defineNativeModule({ id: 'Elite', data: {}, state: { create: () => ({}) } })
  );
  const selected = family.runtimeFor({ specialization: 'Elite', selectedTraitIds: [101] });
  const unselected = family.runtimeFor({ specialization: 'Elite', selectedTraitIds: [] });
  assert.equal(selected, unselected);
  const damageInputs = { strikeSigilBonus: 0.5 };
  assert.equal(selected.modifyStrikeDamage({ selectedTraitIds: [101], damageInputs }, 10), 20);
  assert.equal(unselected.modifyStrikeDamage({ selectedTraitIds: [], damageInputs }, 10), 10);
  assert.equal(selected.modifyCriticalChance({}, 0), 0.1);
  assert.equal(selected.rechargeWork({ config: { selectedTraitIds: [101] }, helpers: selected.catalog }, skill, 10), 5);
  assert.equal(unselected.rechargeWork({ config: { selectedTraitIds: [] }, helpers: selected.catalog }, skill, 10), 10);
  assert.equal(family.catalog.balanceProfilesById.has('fixture.extra'), true);
  const behaviorOnly = familyWith(moduleWith([defineTrait({ id: 102, name: 'No balance' })]));
  assert.equal(behaviorOnly.catalog.balanceProfiles.length, 0);
  const named = familyWith(
    moduleWith([defineTrait({ id: 103, name: 'Named proc', balance: { id: 'fixture.named', effects: [] } })])
  );
  assert.equal(named.catalog.balanceProfilesById.has('fixture.named'), true);
  assert.equal(named.catalog.balanceProfilesById.has(103), false);
});

test('preview rules, active profiles, removed effects, and tooltip values share one expanded source', () => {
  const family = previewFamily();
  const live = family.runtimeFor({});
  const patched = family.runtimeFor({ patchId: 'preview' });
  const context = (runtime) => ({ helpers: runtime.catalog, config: { selectedTraitIds: [101] } });
  assert.equal(live.modifyStrikeDamage(context(live), 10), 20);
  assert.equal(patched.modifyStrikeDamage(context(patched), 10), 30);
  assert.equal(patched.rechargeWork(context(patched), skill, 10), 2.5);
  assert.equal(live.rechargeWork(context(live), skill, 10), 5);
  assert.equal(
    family.patchAuthoring.modules[0].balanceProfiles.some(({ id }) => id === 101),
    true
  );
  const presentation = {
    traits: {
      101: (balance) => ({
        description: 'Shared values',
        facts: [
          { name: 'Power', value: String(tuning(balance, 'attributeBonus')) },
          { name: 'Damage', value: String(balance.modifierRulesById.get('fixture.damage').parameters.bonus) }
        ]
      })
    }
  };
  assert.deepEqual(
    describeSimulationTrait(family.balanceContextFor('preview'), metadata, presentation).facts.map(
      ({ value }) => value
    ),
    ['40', '2']
  );
  assert.deepEqual(
    describeSimulationTrait(family.balanceContextFor('current'), metadata, presentation).facts.map(
      ({ value }) => value
    ),
    ['20', '1']
  );
  for (const [patchId, selectedTraitIds, expected] of [
    ['current', [101], true],
    ['preview', [101], false],
    ['current', [], false]
  ]) {
    const result = simulateGw2({ profession: family, rotation: [1], config: { patchId, selectedTraitIds } });
    assert.equal(
      result.events.some((event) => event.type === 'condition' && event.sourceId === 101),
      expected
    );
  }

  assert.equal(live.catalog.balanceProfilesById.get(101).effects.length, 1);
  assert.equal(patched.catalog.balanceProfilesById.get(101).effects.length, 0);
});

test('definition attributes use resolved minors, eligible conversions and patch context', () => {
  // The module grant feeds conversions in both build and live queries, even when the trait is disabled.
  const family = previewFamily(
    moduleWith([trait], {
      attributes: () => [{ attributeEffects: [{ kind: 'flat', to: 'Power', amount: 10, feedsConversions: 'all' }] }]
    })
  );
  const { getActiveTraits } = createProfessionTraitData([{ name: 'Line', minorTraits: [metadata], majorTraits: [] }]);
  const calculate = createCalculateAttributes((common, context) => {
    const { activeTraits } = createBuildAttributeContext(context, family.catalog, getActiveTraits);
    return finalizeProfessionBuildAttributes(
      common,
      {
        activeTraits,
        profileContext: context.balanceContext ?? family.balanceContextFor()
      },
      context
    );
  }, family.attributeContributions);
  const build = { specializations: [{ name: 'Line' }] };
  const current = calculate(build);
  const patched = calculate(build, [], 1, null, null, family.balanceContextFor('preview'));
  assert.equal(current.attributes.Power.traits, 30);
  assert.equal(patched.attributes.Power.traits, 50);
  assert.equal(patched.attributes['Critical Chance'].final - current.attributes['Critical Chance'].final, 1);
  assert.equal(current.attributes.Ferocity.traits, Math.round(current.attributes.Power.final * 0.1));
  assert.equal(patched.attributes.Ferocity.traits, Math.round(patched.attributes.Power.final * 0.1));
  assert.equal(calculate(build, [], 1, metadata.name).attributes.Power.traits, 10);
  assert.equal(calculate({ specializations: [] }).attributes.Power.traits, 10);
  assert.equal(
    calculate({ specializations: [{ name: 'Line', disabledMinorTraits: [0] }] }).attributes.Power.traits,
    10
  );
  const runtime = family.runtimeFor({ patchId: 'preview' });
  const context = { catalog: runtime.catalog, config: { selectedTraitIds: [101] } };
  const direct = runtime.modifyAttributes(context, { power: 1000 });
  const repeated = runtime.modifyAttributes(context, { power: 1000 });
  assert.equal(direct.power, repeated.power);
  assert.equal(direct.power, 1050);
});

// Explicit profile IDs and conversion policies must survive helper authoring and repeated patch switches.
test('trait attribute helpers resolve overridden profile IDs without changing conversion inputs or rounding', () => {
  const profileId = 'fixture.attributes';
  const family = withPatchPreview(
    familyWith(
      moduleWith([
        defineTrait({
          ...metadata,
          balance: { id: profileId, attributeBonus: 20, weaponAttributeBonus: 30, attributeConversion: 0.15 }
        })
      ])
    ),
    {
      id: 'preview',
      label: 'Preview',
      professions: {
        fixture: { balanceProfiles: { [profileId]: { fields: { attributeBonus: 40, attributeConversion: 0.25 } } } }
      }
    }
  );
  for (const [input, rounding, current, patched] of [
    ['common', 'none', 15.75, 26.25],
    ['common', 'floor', 15, 26],
    ['common', 'round', 16, 26],
    ['eligible', 'none', 18.75, 36.25],
    ['eligible', 'floor', 18, 36],
    ['eligible', 'round', 19, 36]
  ]) {
    const contribute = traitAttributeEffects(profileId, [
      { kind: 'flat', to: 'Power', field: 'attributeBonus', feedsConversions: 'all' },
      { kind: 'flat', to: 'Power', field: 'weaponAttributeBonus', feedsConversions: 'none' },
      { kind: 'conversion', from: 'Power', to: 'Ferocity', field: 'attributeConversion', input, rounding }
    ]);
    for (const [patchId, power, ferocity] of [
      ['current', 50, current],
      ['preview', 70, patched],
      ['current', 50, current]
    ]) {
      const { attributeEffects } = contribute({ balanceContext: family.balanceContextFor(patchId) });
      assert.deepEqual(
        resolveAttributeEffects(
          { conversionPool: { Power: 105 }, conversions: equipmentAttributeConversions() },
          attributeEffects
        ).attributes,
        {
          Power: power,
          Ferocity: ferocity
        }
      );
    }
  }
});

// Required values fail in the supplied patch even when a different source contains a usable profile.
test('trait attribute helpers reject missing profiles and invalid balance fields in the active context', () => {
  const family = previewFamily();
  const current = family.balanceContextFor('current');
  const missing = {
    ...current,
    catalog: {
      ...current.catalog,
      balanceProfilesById: new Map(),
      balanceDataContext: { professionId: 'fixture', patchId: 'missing' }
    },
    balanceProfile: (id) => current.catalog.balanceProfilesById.get(id)
  };
  assert.throws(
    () => fixtureAttributeEffects({ balanceContext: missing }),
    /patch=missing profile=101.*missing required/
  );

  for (const value of [undefined, null, '20', NaN, Infinity]) {
    const profile = { ...current.catalog.balanceProfilesById.get(101), attributeBonus: value };
    const balanceContext = {
      ...current,
      catalog: { ...current.catalog, balanceProfilesById: new Map([[101, profile]]) }
    };
    assert.throws(() => fixtureAttributeEffects({ balanceContext }), /profile=101 field=attributeBonus/);
  }

  const missingField = traitAttributeEffects(101, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Ferocity',
      field: 'missingConversion',
      input: 'common',
      rounding: 'round'
    }
  ]);
  assert.throws(() => missingField({ balanceContext: current }), /profile=101 field=missingConversion/);
});

// Shared declarations must resist mutation and remain isolated between immutable patch profiles.
test('profile-only attribute bonuses are immutable and isolated between patches', () => {
  const family = previewFamily();
  let resolutions = 0;
  const contribute = traitAttributeBonuses(101, (profile) => {
    resolutions++;
    return {
      traitDurations: { 'Bleeding Duration': profile.attributeBonus },
      traitCriticalChance: profile.attributeBonus
    };
  });
  const current = { balanceContext: family.balanceContextFor('current') };
  const preview = { balanceContext: family.balanceContextFor('preview') };
  const bonuses = contribute(current);
  assert.equal(contribute(current), bonuses);
  assert.notEqual(contribute(preview), bonuses);
  assert.equal(resolutions, 2);
  assert.throws(() => {
    bonuses.traitDurations['Bleeding Duration'] = 999;
  }, TypeError);
  assert.throws(() => {
    bonuses.traitCriticalChance = 999;
  }, TypeError);
  const effects = fixtureAttributeEffects(current);
  assert.throws(() => {
    effects.attributeEffects[0].amount = 999;
  }, TypeError);
  assert.throws(() => {
    effects.attributeEffects.push({});
  }, TypeError);
});

// Preparing a fixed profile must not freeze live contributions or leak another simulation's patch.
test('prepared attribute declarations isolate patch profiles while live bonuses keep changing', () => {
  let liveBonus = 5;
  const family = withPatchPreview(
    familyWith(
      moduleWith([
        defineTrait({
          ...metadata,
          balance: { attributeBonus: 20 },
          attributes: traitAttributeEffects(101, [
            { kind: 'flat', to: 'Power', field: 'attributeBonus', feedsConversions: 'none' }
          ])
        }),
        defineTrait({
          id: 102,
          name: 'Live bonus',
          attributes: () => ({
            attributeEffects: [{ kind: 'flat', to: 'Power', amount: liveBonus, feedsConversions: 'none' }]
          })
        })
      ])
    ),
    {
      id: 'preview',
      label: 'Preview',
      professions: { fixture: { balanceProfiles: { 101: { fields: { attributeBonus: 40 } } } } }
    }
  );
  const makeQuery = (patchId) => {
    const config = { patchId, selectedTraitIds: [101, 102], attributeInputs: baseAttributeInputs() };
    return createGw2CombatQuery({ profession: family.runtimeFor(config), config });
  };

  const current = makeQuery('current');
  const preview = makeQuery('preview');
  assert.equal(current.statsAt(0).power, 1025);
  assert.equal(preview.statsAt(0).power, 1045);
  liveBonus = 15;
  assert.equal(current.statsAt(0).power, 1035);
  assert.equal(preview.statsAt(0).power, 1055);
  assert.equal(makeQuery('current').statsAt(0).power, 1035);
});

test('trigger order is stable within a module and preserves Core before elite emission', () => {
  const procTrait = (id, order) =>
    defineTrait({
      id,
      name: `Proc ${id}`,
      balance: { effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 1 }] },
      triggers: [{ on: 'castCommit', emit: id, order, when: () => true }]
    });
  const core = moduleWith([procTrait(101, 0), procTrait(102, -1)]);
  const elite = moduleWith([procTrait(103, -10)], {
    id: 'Elite',
    data: { traits: [{ id: 103, name: 'Proc 103' }] },
    state: { create: () => ({}) }
  });
  const result = simulateGw2({
    profession: familyWith(core, elite),
    rotation: [1],
    config: { specialization: 'Elite', selectedTraitIds: [101, 102, 103] }
  });
  assert.deepEqual(
    result.events.filter((event) => event.type === 'condition').map((event) => event.sourceId),
    [102, 101, 103]
  );
});

test('hook notifications, transforms, decisions, reactions, and lifetime retain their execution contracts', () => {
  const calls = [];
  const contribution = (label) => ({
    onCastCommit: () => calls.push(label),
    modifyEffects: (_runtime, _cast, effects) => [
      ...effects,
      { type: 'condition', condition: label, stacks: 1, duration: 1 }
    ],
    reactions: { 'damage.resolving': (_runtime, event) => ({ coefficient: (event.coefficient ?? 0) + 1 }) }
  });
  const first = defineTrait({
    id: 101,
    name: 'First',
    hooks: {
      modifyEffects: contribution('trait').modifyEffects,
      prepareEvent: (_runtime, event) => (event.cancelled ? null : { ...event, amount: 2 }),
      availability: () => ({ ready: false, retryAt: 2 })
    },
    lifetime: {
      onCastCommit: contribution('trait').onCastCommit,
      reactions: contribution('trait').reactions,
      tasks: {
        'trait.expire': (runtime) => {
          runtime.profession.core.count = 0;
        }
      }
    }
  });
  const family = familyWith(
    moduleWith([first], { hooks: { ...contribution('core'), availability: () => ({ ready: false, retryAt: 4 }) } }),
    defineNativeModule({
      id: 'Elite',
      data: {},
      state: { create: () => ({}) },
      hooks: { ...contribution('elite'), availability: () => ({ ready: false, retryAt: 3 }) }
    })
  );
  const runtime = family.runtimeFor({ specialization: 'Elite' });
  const context = {
    time: 0,
    config: { specialization: 'Elite', selectedTraitIds: [] },
    profession: runtime.createState({})
  };
  runtime.onCastCommit(context, {});
  assert.deepEqual(calls, ['trait', 'core', 'elite']);
  assert.deepEqual(
    runtime.modifyEffects(context, {}, []).map((effect) => effect.condition),
    calls
  );
  assert.equal(runtime.prepareEvent(context, { cancelled: true }), null);
  assert.equal(runtime.prepareEvent(context, {}).amount, 2);
  assert.equal(runtime.reactions['damage.resolving'](context, { coefficient: 0 }, {}).coefficient, 3);
  assert.equal(runtime.availability(context, skill, {}).retryAt, 4);
  context.profession.core.count = 5;
  runtime.tasks['trait.expire'](context);
  assert.equal(context.profession.core.count, 0);
});

test('compiled critical admission retains per-run state, actor gates, and the existing ICD boundary', () => {
  const proc = criticalProcHandler({
    id: 'fixture.critical',
    when: (runtime) => hasTrait(runtime, 101),
    internalCooldown: {
      duration: (runtime) => tuning(runtime, 'internalCooldown'),
      readyAt: (runtime) => runtime.profession.core.readyAt,
      setReadyAt: (runtime, value) => {
        runtime.profession.core.readyAt = value;
      }
    },
    handler: (runtime) => {
      runtime.profession.core.count += 1;
    }
  });
  const family = familyWith(
    moduleWith([
      defineTrait({
        ...metadata,
        balance: { internalCooldown: 2 },
        triggers: [{ on: 'damage.resolved', run: proc }]
      })
    ])
  );
  const runtime = family.runtimeFor({});
  const context = {
    helpers: runtime.catalog,
    config: { selectedTraitIds: [101] },
    profession: runtime.createState({})
  };
  const details = { hitContext: { critical: { chance: 1, didCrit: true } } };
  for (const [actorType, at] of [
    ['summon', 0],
    ['player', 0],
    ['player', 1],
    ['player', 2],
    ['player', 3]
  ])
    runtime.reactions['damage.resolved'](context, { actorType, at }, details);
  assert.equal(context.profession.core.count, 2);
  assert.equal(context.profession.core.readyAt, 5);
  assert.equal(runtime.createState({}).core.count, 0);
  context.config.selectedTraitIds = [];
  runtime.reactions['damage.resolved'](context, { actorType: 'player', at: 6 }, details);
  assert.equal(context.profession.core.count, 2);
});

test('composition rejects duplicate ownership and invalid declarative references', () => {
  const plain = defineTrait({ ...metadata });
  assert.throws(
    () => familyWith(moduleWith([plain, plain], { data: { traits: [metadata] } })),
    /Duplicate trait definition/
  );
  assert.throws(
    () =>
      familyWith(
        moduleWith([
          trait,
          defineTrait({
            id: 102,
            name: 'Duplicate profile',
            profiles: [{ id: 101, name: 'Duplicate', profileKind: 'trait' }]
          })
        ])
      ),
    /Duplicate balance profile/
  );
  assert.throws(() => familyWith(moduleWith([plain], { data: {} })), /no owned trait metadata/);
  assert.throws(
    () =>
      familyWith(
        moduleWith([defineTrait({ ...metadata, triggers: [{ on: 'castCommit', emit: 'missing', when: () => true }] })])
      ),
    /Unknown trait trigger profile/
  );
  assert.throws(
    () =>
      familyWith(
        moduleWith([
          defineTrait({
            ...metadata,
            rechargeRules: [{ when: () => true, multiplier: { profile: 'missing', field: 'factor' } }]
          })
        ])
      ),
    /Invalid recharge profile reference/
  );
  assert.throws(() => familyWith(moduleWith([trait], { modifiers: trait.modifierRules })), /Duplicate modifier rule/);
  const task = () => {};

  assert.throws(
    () =>
      moduleWith([defineTrait({ ...metadata, lifetime: { tasks: { same: task } } })], {
        hooks: { tasks: { same: task } }
      }),
    /Duplicate hook tasks/
  );
  assert.throws(
    () =>
      familyWith(
        moduleWith([defineTrait({ ...metadata, lifetime: { tasks: { same: task } } })]),
        defineNativeModule({ id: 'Elite', data: {}, state: { create: () => ({}) }, hooks: { tasks: { same: task } } })
      ).runtimeFor({ specialization: 'Elite' }),
    /Duplicate hook tasks/
  );
  assert.throws(
    () => defineTrait({ ...metadata, triggers: [{ trait: 102, on: 'castCommit', emit: 101, when: () => true }] }),
    /owns its rule selection/
  );
  assert.throws(() => defineTrait({ ...metadata, hook: {} }), /Unsupported trait definition field/);
  assert.throws(() => defineTrait({ ...metadata, hooks: { resources: {} } }), /Unsupported trait hook/);
  for (const requiresSelection of ['false', null]) {
    assert.throws(
      () => defineTrait({ ...metadata, modifierRules: [{ ...trait.modifierRules[0], requiresSelection }] }),
      /requiresSelection must be boolean/
    );
  }
});
