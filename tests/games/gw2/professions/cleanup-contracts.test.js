import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { guardianProfession, guardianCatalog } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS as G, GUARDIAN_TRAIT_IDS as GT } from '#gw2/professions/guardian/data/ids.js';
import { createFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as FB } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';
import { createRangerBuildDefaults } from '#gw2/professions/ranger/build/build.js';
import { applyRangerBuildAttributeRules } from '#gw2/professions/ranger/build/attributes.js';
import { soulbeastAttributeRules } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as SB } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { GALESHOT_BALANCE_PROFILE_IDS as GALE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { conduitModifierRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity-rules.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { REVENANT_SKILL_IDS as R, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as W, WARRIOR_TRAIT_IDS as WT } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { paragonAttributeRules } from '#gw2/professions/warrior/specializations/paragon/mechanics/chants-and-motivation.js';

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
    assert.equal(runtime.rechargeProgress.get(G.ENTER_RADIANT_FORGE).startedAt, exits[0].at);
    assert.equal(runtime.rechargeProgress.get(G.ENTER_RADIANT_FORGE).work, 5);
    assert.equal(state.radiantForge, false);
    assert.equal(state.radiantWeapon, '');
    assert.equal(state.glaringBurstSwordSlow, false);
    assert.deepEqual(runtime.profession.core.availableFlips, {});
    assert.deepEqual(runtime.profession.core.autoattackChains, {});
  }
});

// Default factories and profile initialization share normalization but never mutable state.
test('Firebrand page initialization preserves explicit pages, caps, trait defaults, and patched cadence', () => {
  for (const [initial, expected] of [
    [undefined, 8],
    [5, 8],
    [0, 0],
    [3, 3],
    [99, 9]
  ]) {
    const config = {
      specialization: 'Firebrand',
      selectedTraitIds: [GT.ARCHIVIST_OF_WHISPERS, GT.LOREMASTER],
      initialTomePages: initial,
      maximumTomePages: 9
    };
    const first = createFirebrandState(config);
    const second = observedRuntime(runGuardian([], config)).profession.specialization.state;
    assert.equal(second.tomePages.value, expected);
    assert.equal(second.tomePages.maximum, 9);
    assert.equal(second.tomePages.nextAt, expected < 9 ? 5 : Infinity);
    assert.deepEqual(first.tomePages, second.tomePages);
    assert.notEqual(first.tomeDormantReadyAt, second.tomeDormantReadyAt);
  }

  const patched = withPatchPreview(guardianProfession, {
    id: 'pages',
    label: 'Pages',
    professions: {
      guardian: {
        balanceProfiles: {
          [FB.resources]: { fields: { maximumStacks: 6, pulseInterval: 2 } },
          [FB.archivistOfWhispers]: { fields: { maximumStacks: 10 } }
        }
      }
    }
  });
  const result = runGuardian(
    [],
    {
      specialization: 'Firebrand',
      patchId: 'pages',
      selectedTraitIds: [GT.ARCHIVIST_OF_WHISPERS],
      initialTomePages: 6
    },
    () => {},
    patched
  );
  const pages = observedRuntime(result).profession.specialization.state.tomePages;
  assert.equal(pages.value, 10);
  assert.equal(pages.nextAt, Infinity);
  assert.equal(pages.interval, 2);
});

// Canonical normal charges never become final merely because ammo or descriptions say so.
test('Weighty Terms follows canonical mantra IDs and ignores names or final-charge descriptions', () => {
  const config = { specialization: 'Firebrand', selectedTraitIds: [GT.WEIGHTY_TERMS], initialTomePages: 0 };
  const native = guardianProfession.runtimeFor(config);
  for (const mantra of MANTRAS) {
    for (const id of [mantra.rootId, mantra.normalId, mantra.finalId, 999991]) {
      const result = runGuardian([], config, (runtime) => {
        const skill = {
          ...guardianCatalog.skillsById.get(id),
          id,
          name: 'Renamed mantra',
          description: id === mantra.finalId ? '' : 'Final Charge.',
          categories: ['Mantra']
        };
        native.onCastComplete(runtime, {
          skill,
          id: 'fixture-mantra',
          command: {},
          start: 0,
          fullEnd: 0,
          effectiveEnd: 0
        });
      });
      assert.equal(
        observedRuntime(result).profession.specialization.state.tomePages.value,
        id === mantra.finalId ? 2 : 0
      );
    }
  }
});

// A pet swap subtracts historical build stats, then adds the active pet's patched contribution.
test('Soulbeast reconciles raw and precomputed archetypes across merge state and pet changes', () => {
  const calculate = createCalculateAttributes(applyRangerBuildAttributeRules);
  const build = createRangerBuildDefaults();
  const pig = calculate({ ...build, selectedPet: 'Pig' }).attributes;
  const lynx = calculate({ ...build, selectedPet: 'Lynx' }).attributes;
  assert.equal(pig.Power.final - lynx.Power.final, 150);
  assert.equal(lynx['Condition Damage'].final - pig['Condition Damage'].final, 150);
  const profiles = new Map([
    [SB.deadlyArchetype, { attributeBonus: 175, weaponAttributeBonus: 125 }],
    [SB.ferociousArchetype, { attributeBonus: 999, weaponAttributeBonus: 999 }]
  ]);
  for (const precomputed of [false, true]) {
    for (const merged of [false, true]) {
      const input = {
        power: precomputed ? 1999 : 1000,
        ferocity: precomputed ? 999 : 0,
        conditionDamage: 0,
        precision: 1000
      };
      const actual = soulbeastAttributeRules.modifyAttributes(
        {
          config: { selectedPet: 'Pig', attributeProvenance: { professionStaticRulesApplied: precomputed } },
          catalog: { balanceProfilesById: profiles },
          runtime: {
            profession: {
              core: { activePet: 'Lynx' },
              specialization: { kind: 'Soulbeast', state: { beastmodeActive: merged } }
            }
          }
        },
        input
      );
      assert.deepEqual(actual, {
        power: 1000,
        ferocity: 0,
        conditionDamage: merged ? 175 : 0,
        precision: merged ? 1125 : 1000
      });
      assert.equal(input.power, precomputed ? 1999 : 1000);
    }
  }
});

test('Galeshot arrow restoration preserves fractional gains and uses the current cap', () => {
  const result = runRanger(
    [],
    { specialization: 'Galeshot' },
    {
      extend: (native) => ({
        catalog: withProfile(native.catalog, GALE.resources, { maximumStacks: 4.5, pulseInterval: 5 })
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
    kallasFervorMaximumStacks: 1,
    kallasFervor: Object.freeze([Object.freeze({ at: 1, expiresAt: 3 }), Object.freeze({ at: 2, expiresAt: 4 })])
  });
  assert.equal(activeKallasFervorStacks(state, 0), 0);
  assert.equal(activeKallasFervorStacks(state, 1), 1);
  assert.equal(activeKallasFervorStacks(state, 2), 1);
  assert.equal(activeKallasFervorStacks(state, 2, 2), 2);
  assert.equal(activeKallasFervorStacks(state, 3, 2), 1);
  assert.equal(activeKallasFervorStacks(state, 4), 0);
});

// Display labels cannot grant another skill's resonance or suppress a valid proc.
test('Conduit modifiers and Peitha follow all supported button IDs after renaming', () => {
  const context = {
    config: {},
    time: 0,
    runtime: {
      profession: { core: { selectedLegendIds: [LEGEND.ASSASSIN] }, specialization: { kind: 'Conduit', state: {} } }
    }
  };
  for (const [suffix, ids] of [
    ['release-dervish-assassin-affinity', [R.RELEASE_POTENTIAL_DERVISH, R.RELEASE_POTENTIAL_ASSASSIN]],
    ['release-warrior-affinity', [R.RELEASE_POTENTIAL_WARRIOR]],
    ['beguiling-haze-assassin-resonance', [R.BEGUILING_HAZE, R.BEGUILING_HAZE_ID_76805]],
    ['twin-moon-assassin-resonance', [R.TWIN_MOON_SWEEP, R.TWIN_MOON_SWEEP_ID_77001]]
  ]) {
    const rule = conduitModifierRules.find(({ id }) => id === 'revenant.' + suffix);
    for (const id of ids) assert.equal(rule.when({ ...context, event: { skillId: id, skillName: 'Renamed' } }), true);
    assert.equal(rule.when({ ...context, event: { skillId: 999999, skillName: 'Beguiling Haze' } }), false);
  }

  // Peitha eligibility is catalog skill data, so both Beguiling Haze button IDs trigger it and Twin Moon Sweep does not.
  for (const skillId of [R.BEGUILING_HAZE, R.BEGUILING_HAZE_ID_76805, R.TWIN_MOON_SWEEP]) {
    assert.equal(revenantCatalog.skillsById.get(skillId).shadowstepSkill === true, skillId !== R.TWIN_MOON_SWEEP);
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
        onCastComplete(runtime, cast) {
          profession.onCastComplete?.(runtime, cast);
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
  const rule = paragonAttributeRules.modifierRules.find(({ id }) => id === 'warrior.strengthening-stanzas');
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
