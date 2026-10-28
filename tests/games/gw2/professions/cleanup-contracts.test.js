import { createProfessionBuildAttributeRules, createCalculateAttributes } from '#tests/helpers/build-attributes.js';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { soulbeastArchetypeAttributes } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/archetype-attributes.js';

import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { GUARDIAN_SKILL_IDS as G, GUARDIAN_TRAIT_IDS as GT } from '#gw2/professions/guardian/data/ids.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { firebrandModule } from '#gw2/professions/guardian/specializations/firebrand/module.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { createRangerBuildDefaults } from '#gw2/professions/ranger/build/build.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { RANGER_TRAIT_IDS as RANGER_TRAIT } from '#gw2/professions/ranger/data/ids.js';

import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as R } from '#gw2/professions/revenant/data/ids.js';
import { conduitModule } from '#gw2/professions/revenant/specializations/conduit/module.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { WARRIOR_SKILL_IDS as W, WARRIOR_TRAIT_IDS as WT } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { paragonModule } from '#gw2/professions/warrior/specializations/paragon/module.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise exits directly so a large time advance cannot silently move the cooldown's origin.
test('Forge exits finalize once at the actual transition and clear weapon state', () => {
  for (const automatic of [false, true]) {
    const result = runGuardian(
      [
        G.ENTER_RADIANT_FORGE,
        G.GLEAMING_BLADE,
        ...(automatic ? [] : [G.EXIT_RADIANT_FORGE]),
        { type: 'wait', durationMs: 40000 }
      ],
      { specialization: 'Luminary' }
    );
    const runtime = observedRuntime(result);
    const state = runtime.profession.specialization.state;
    const exits = result.events.filter(
      (event) => event.type === 'weapon_set' && event.skillId === G.EXIT_RADIANT_FORGE
    );
    assert.equal(exits.length, 1);
    assert.equal(exits[0].automatic, automatic);
    assert.equal(runtime.cooldownController.rechargeFor(G.ENTER_RADIANT_FORGE).startedAt, exits[0].at);
    assert.equal(runtime.cooldownController.rechargeFor(G.ENTER_RADIANT_FORGE).work, 5);
    assert.equal(state.radiantForge, false);
    assert.equal(state.radiantWeapon, '');
    assert.equal(state.glaringBurstSwordSlow, false);
    assert.deepEqual(runtime.profession.core.availableFlips, {});
    assert.deepEqual(runtime.profession.core.autoattackChains, {});
  }
});

// Default factories and profile initialization share normalization but never mutable state.
test('Firebrand page initialization preserves explicit pages, caps, trait defaults, and patched cadence', () => {
  // Capacity bonuses change the omitted default, never an explicit starting-page choice.
  for (const [initial, expected] of [
    [undefined, 8],
    [5, 5],
    [0, 0],
    [3, 3],
    [99, 8]
  ]) {
    const config = {
      specialization: 'Firebrand',
      selectedTraitIds: [GT.ARCHIVIST_OF_WHISPERS, GT.LOREMASTER],
      initialTomePages: initial
    };
    const first = firebrandState.create({
      config,
      balanceProfile: (id) => guardianCatalog.balanceProfilesById.get(id)
    });
    const second = observedRuntime(runGuardian([], config)).profession.specialization.state;
    assert.equal(second.tomePages.value, expected);
    assert.equal(second.tomePages.maximum, 8);
    assert.equal(second.tomePages.nextAt, expected < 8 ? 5 : Infinity);
    assert.deepEqual(first.tomePages, second.tomePages);
    assert.notEqual(first.tomePages, second.tomePages);
  }

  const patched = withPatchPreview(guardianProfession, {
    id: 'pages',
    label: 'Pages',
    professions: {
      guardian: {
        balanceProfiles: {
          [GT.PURITY_OF_WORD]: { fields: { maximumStacks: 6, pulseInterval: 2 } },
          [GT.ARCHIVIST_OF_WHISPERS]: { fields: { maximumStacks: 10 } }
        }
      }
    }
  });
  // Module creation must use the selected catalog before runtime resource initialization can adjust state.
  const balanceContext = patched.resolvePatch({ id: 'pages' }).balanceContext;
  for (const selectedTraitIds of [[], [GT.ARCHIVIST_OF_WHISPERS]]) {
    const maximum = selectedTraitIds.length ? 10 : 6;
    for (const initialTomePages of [undefined, 0]) {
      const state = firebrandModule.state.create({ selectedTraitIds, initialTomePages }, { balanceContext });
      assert.equal(state.tomePages.maximum, maximum);
      assert.equal(state.tomePages.value, initialTomePages ?? maximum);
      assert.equal(state.tomePages.interval, 2);
      assert.equal(state.tomePages.nextAt, initialTomePages === 0 ? 2 : Infinity);
    }
  }

  const result = runGuardian(
    [],
    {
      specialization: 'Firebrand',
      patchId: 'pages',
      selectedTraitIds: [GT.ARCHIVIST_OF_WHISPERS],
      initialTomePages: 6
    },
    { initialize: () => {}, profession: patched }
  );
  const pages = observedRuntime(result).profession.specialization.state.tomePages;
  assert.equal(pages.value, 6);
  assert.equal(pages.maximum, 10);
  assert.equal(pages.nextAt, 2);
  assert.equal(pages.interval, 2);
});

// Canonical normal charges never become final merely because ammo or descriptions say so.
test('Weighty Terms follows canonical mantra IDs and ignores names or final-charge descriptions', () => {
  const config = { specialization: 'Firebrand', selectedTraitIds: [GT.WEIGHTY_TERMS], initialTomePages: 0 };
  const native = guardianProfession.runtimeFor(config);
  for (const mantra of MANTRAS) {
    for (const id of [mantra.rootId, mantra.normalId, mantra.finalId, 999991]) {
      const result = runGuardian([], config, {
        initialize: (runtime) => {
          const skill = {
            ...guardianCatalog.skillsById.get(id),
            id,
            name: 'Renamed mantra',
            description: id === mantra.finalId ? '' : 'Final Charge.',
            categories: ['Mantra']
          };
          const cast = {
            skill,
            id: 'fixture-mantra',
            command: {},
            start: 0,
            fullEnd: 0,
            effectiveEnd: 0
          };
          // Match runtime dispatch so named mantra actions run before the remaining trait effects.
          applySkillSideEffects(runtime.mechanics, cast, 'castCommit', native.sideEffectHandlers);
          native.onCastCommit(runtime.mechanics, cast);
        }
      });
      assert.equal(
        observedRuntime(result).profession.specialization.state.tomePages.value,
        id === mantra.finalId ? 2 : 0
      );
    }
  }
});

// Fixed archetypes expose their named attributes and cannot be edited as balance profiles.
test('Soulbeast archetypes use fixed merge bonuses and reject removed profile targets', () => {
  for (const [archetype, attributes] of [
    ['Stout', { toughness: 200, vitality: 100 }],
    ['Deadly', { conditionDamage: 150, precision: 100 }],
    ['Versatile', { vitality: 200, concentration: 225 }],
    ['Ferocious', { power: 150, ferocity: 100 }],
    ['Supportive', { vitality: 100 }]
  ]) {
    assert.deepEqual(soulbeastArchetypeAttributes(archetype), attributes);
    const id = `ranger.soulbeast.archetype.${archetype.toLowerCase()}`;
    assert.equal(rangerCatalog.balanceProfilesById.has(id), false);
    assert.throws(
      () => applyBalanceProfilePatch(rangerCatalog, { balanceProfiles: { [id]: { fields: { attributeBonus: 1 } } } }),
      /unknown balance profile/
    );
  }

  assert.deepEqual(soulbeastArchetypeAttributes('unknown'), {});
});

// Merge state and the current pet select intrinsic attributes from the same common seed.
test('Soulbeast evaluates archetypes across merge state and pet changes', () => {
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(rangerCatalog),
    rangerProfession.attributeContributions
  );
  const build = createRangerBuildDefaults();
  const pig = calculate({ ...build, selectedPet: 'Pig' }).attributes;
  const lynx = calculate({ ...build, selectedPet: 'Lynx' }).attributes;
  assert.equal(pig.Power.final - lynx.Power.final, 150);
  assert.equal(lynx['Condition Damage'].final - pig['Condition Damage'].final, 150);

  for (const merged of [false, true]) {
    const input = {
      power: 1000,
      ferocity: 0,
      conditionDamage: 0,
      precision: 1000,
      vitality: 1000
    };
    const actual = rangerProfession.runtimeFor({ specialization: 'Soulbeast' }).modifyAttributes(
      {
        config: { specialization: 'Soulbeast', selectedPet: 'Pig' },
        catalog: rangerCatalog,
        runtime: {
          profession: {
            core: { petNames: ['Pig', 'Lynx'], activePetSlot: 2, pet: null },
            specialization: { kind: 'Soulbeast', state: { beastmodeActive: merged } }
          }
        }
      },
      input
    );
    assert.deepEqual(actual, {
      power: 1000,
      ferocity: 0,
      conditionDamage: merged ? 150 : 0,
      precision: merged ? 1100 : 1000,
      vitality: 1050
    });
    assert.equal(input.power, 1000);
  }
});

test('Galeshot arrow restoration preserves fractional gains and uses the current cap', () => {
  const result = runRanger(
    [],
    { specialization: 'Galeshot' },
    {
      extend: (native) => ({
        catalog: withProfile(native.catalog, RANGER_TRAIT.TEACHINGS_OF_THE_TENGU, {
          maximumStacks: 4.5,
          pulseInterval: 5
        })
      })
    }
  );
  const runtime = observedRuntime(result);
  const state = runtime.profession.specialization.state;
  state.arrows.value = 2.25;
  runtime.resourceController.grant('arrows', 0.5);
  assert.equal(state.arrows.value, 2.75);
  runtime.resourceController.grant('arrows', 10);
  assert.equal(state.arrows.value, 4.5);
  assert.equal(state.arrows.maximum, 4.5);
});

test('Fervor counting preserves start, expiry, and cap boundaries on readonly partial state', () => {
  const state = Object.freeze({
    kallasFervor: Object.freeze([Object.freeze({ at: 1, expiresAt: 3 }), Object.freeze({ at: 2, expiresAt: 4 })])
  });
  assert.equal(activeKallasFervorStacks(state, 0, 1), 0);
  assert.equal(activeKallasFervorStacks(state, 1, 1), 1);
  assert.equal(activeKallasFervorStacks(state, 2, 1), 1);
  assert.equal(activeKallasFervorStacks(state, 2, 2), 2);
  assert.equal(activeKallasFervorStacks(state, 3, 2), 1);
  assert.equal(activeKallasFervorStacks(state, 4, 1), 0);
});

// Display labels cannot grant another skill's resonance or suppress a valid proc.
test('Conduit modifiers follow all supported button IDs after renaming', () => {
  const context = {
    config: {},
    time: 0,
    runtime: {
      profession: { core: { selectedLegendIds: [LEGEND.ASSASSIN] }, specialization: { kind: 'Conduit', state: {} } }
    }
  };
  for (const [suffix, ids] of [
    ['release-dervish-affinity', [R.RELEASE_POTENTIAL_DERVISH]],
    ['release-assassin-affinity', [R.RELEASE_POTENTIAL_ASSASSIN]],
    ['release-warrior-affinity', [R.RELEASE_POTENTIAL_WARRIOR]],
    ['beguiling-haze-assassin-resonance', [R.BEGUILING_HAZE, R.BEGUILING_HAZE_ID_76805]],
    ['twin-moon-assassin-resonance', [R.TWIN_MOON_SWEEP, R.TWIN_MOON_SWEEP_ID_77001]]
  ]) {
    const rule = conduitModule.modifiers.modifierRules.find(({ id }) => id === 'revenant.' + suffix);
    for (const id of ids) assert.equal(rule.when({ ...context, event: { skillId: id, skillName: 'Renamed' } }), true);
    assert.equal(rule.when({ ...context, event: { skillId: 999999, skillName: 'Beguiling Haze' } }), false);
  }
});

// Refrain identity drives pulses and modifiers, while snapshots still expose a readable label.
test('Paragon renamed refrains replace, project, exhaust, and recover from missing skills', () => {
  // Renamed catalog entries and a removed pulse source exercise the actual refrain owner and public projection.
  const run = (rotation, missing = false) => {
    const config = {
      specialization: 'Paragon',
      initialResource: 30,
      selectedTraitIds: [WT.CALL_TO_ACTION, WT.STRENGTHENING_STANZAS]
    };
    const profession = warriorProfession.runtimeFor(config);
    const skillsById = new Map(profession.catalog.skillsById);
    for (const id of [W.CHANT_OF_ACTION, W.CHANT_OF_FREEDOM])
      skillsById.set(id, { ...skillsById.get(id), name: 'Renamed ' + id });
    const catalog = { ...profession.catalog, skillsById };
    return observeGw2Runtime({
      profession: {
        ...profession,
        catalog,
        onCastCommit(runtime, cast) {
          profession.onCastCommit?.(runtime, cast);

          if (missing && cast.skill.id === W.CHANT_OF_FREEDOM) skillsById.delete(W.CHANT_OF_FREEDOM);
        }
      },
      config,
      rotation
    });
  };

  const combat = { type: 'combat-start' };
  const action = run([combat]);
  const freedom = run([combat, W.CHANT_OF_FREEDOM]);
  const rule = paragonModule.modifiers.modifierRules.find(({ id }) => id === 'warrior.strengthening-stanzas');
  for (const [result, id, applies] of [
    [action, W.CHANT_OF_ACTION, true],
    [freedom, W.CHANT_OF_FREEDOM, false]
  ]) {
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.specialization.state.activeRefrainId, id);
    assert.equal(result.planningState.profession.activeRefrain, 'Renamed ' + id);
    assert.equal(rule.when({ config: runtime.config, runtime }), applies);
  }

  for (const missing of [false, true]) {
    const result = run([combat, W.CHANT_OF_FREEDOM, { type: 'wait', durationMs: 15000 }], missing);
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.specialization.state.activeRefrainId, null);
    assert.equal(result.planningState.profession.activeRefrain, '');
  }
});
