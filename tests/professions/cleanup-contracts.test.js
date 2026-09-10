import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { GUARDIAN_SKILL_IDS as G, GUARDIAN_TRAIT_IDS as GT } from '#gw2/professions/guardian/data/ids.js';
import {
  createFirebrandState,
  initializeFirebrandBalanceState
} from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as FB } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { MANTRAS } from '#gw2/professions/guardian/specializations/firebrand/mantras.js';
import { updateFirebrandCastState } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import {
  advanceRadiantForgeState,
  guardianRadiantForgeSkillHandlers
} from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { createRangerBuildDefaults } from '#gw2/professions/ranger/build/build.js';
import { applyRangerBuildAttributeRules } from '#gw2/professions/ranger/build/attributes.js';
import { soulbeastAttributeRules } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as SB } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { restoreArrow } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { GALESHOT_BALANCE_PROFILE_IDS as GALE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { conduitModifierRules } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity-rules.js';
import { observeConduitTraits } from '#gw2/professions/revenant/specializations/conduit/traits/index.js';
import { REVENANT_SKILL_IDS as R, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';
import { WARRIOR_SKILL_IDS as W, WARRIOR_TRAIT_IDS as WT } from '#gw2/professions/warrior/data/ids.js';
import { configuredTargetBoonCount } from '#gw2/professions/warrior/core/mechanics/resolution-helpers.js';
import {
  activateChant,
  advanceParagon,
  observeParagonEvent
} from '#gw2/professions/warrior/specializations/paragon/traits/index.js';
import { paragonAttributeRules } from '#gw2/professions/warrior/specializations/paragon/mechanics/chants-and-motivation.js';
import { projectWarriorEndState, snapshotWarriorState } from '#gw2/professions/warrior/state.js';

// Exercise exits directly so a large time advance cannot silently move the cooldown's origin.
test('Forge exits finalize once at the exit time and clear weapon state even without an exit catalog entry', () => {
  for (const mode of ['manual', 'automatic', 'missing-skill']) {
    const { context } = createScheduler({ profession: guardianProfession, config: { specialization: 'Luminary' } });
    const state = context.state.profession.specialization.state;
    const core = context.state.profession.core;
    Object.assign(state, {
      radiantForge: true,
      radiantForgeEndsAt: 20,
      radiantWeapon: 'blade',
      glaringBurstSwordSlow: true
    });
    core.availableFlips = { [G.EXIT_RADIANT_FORGE]: Infinity };
    core.autoattackChains = { 1: 2 };
    const events = [];
    let finalizations = 0;
    const skillsById = new Map(context.catalog.skillsById);
    if (mode === 'missing-skill') skillsById.delete(G.EXIT_RADIANT_FORGE);
    const exitContext = {
      ...context,
      catalog: { ...context.catalog, skillsById },
      effectiveEnd: 20,
      emit: (event) => events.push({ event, activeAtEmission: state.radiantForge }),
      rechargeDurationFor: () => {
        finalizations++;
        return 10;
      }
    };
    if (mode === 'manual')
      guardianRadiantForgeSkillHandlers['guardian.radiant-forge'](exitContext, skillsById.get(G.EXIT_RADIANT_FORGE));
    else advanceRadiantForgeState(exitContext, 40);
    advanceRadiantForgeState(exitContext, 50);
    assert.equal(finalizations, 1);
    assert.equal(context.state.cooldowns.get(G.ENTER_RADIANT_FORGE), 25);
    assert.equal(state.radiantForge, false);
    assert.equal(state.radiantWeapon, '');
    assert.equal(state.glaringBurstSwordSlow, false);
    assert.deepEqual(core.availableFlips, {});
    assert.deepEqual(core.autoattackChains, {});
    assert.deepEqual(
      events.map(({ event }) => event.type),
      mode === 'missing-skill' ? [] : ['guardian.radiant-forge-exited', 'weapon_set']
    );
    for (const { event, activeAtEmission } of events) {
      assert.equal(event.at, 20);
      assert.equal(event.automatic, mode === 'manual' ? undefined : true);
      assert.equal(activeAtEmission, mode === 'automatic');
    }
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
      selectedTraitIds: [GT.ARCHIVIST_OF_WHISPERS, GT.LOREMASTER],
      initialTomePages: initial,
      maximumTomePages: 9
    };
    const first = createFirebrandState(config);
    const second = createFirebrandState(config);
    const context = { config, state: { profession: { specialization: { kind: 'Firebrand', state: second } } } };
    initializeFirebrandBalanceState(context);
    assert.equal(second.tomePages, expected);
    assert.equal(second.maximumTomePages, 9);
    assert.equal(second.nextTomePageAt, expected < 9 ? 5 : Infinity);
    assert.deepEqual(first, second);
    assert.notEqual(first.tomeDormantReadyAt, second.tomeDormantReadyAt);
  }

  const config = { selectedTraitIds: [GT.ARCHIVIST_OF_WHISPERS], initialTomePages: 6 };
  const state = createFirebrandState(config);
  initializeFirebrandBalanceState({
    config,
    state: { profession: { specialization: { kind: 'Firebrand', state } } },
    catalog: {
      balanceProfilesById: new Map([
        [FB.resources, { maximumStacks: 6, pulseInterval: 2 }],
        [FB.archivistOfWhispers, { maximumStacks: 10 }]
      ])
    }
  });
  assert.equal(state.tomePages, 10);
  assert.equal(state.nextTomePageAt, Infinity);
  assert.equal(state.tomePageInterval, 2);
});

// Canonical normal charges never become final merely because ammo or descriptions say so.
test('Weighty Terms follows mantra IDs while preserving unfamiliar custom final-charge data', () => {
  const { context } = createScheduler({
    profession: guardianProfession,
    config: { specialization: 'Firebrand', selectedTraitIds: [GT.WEIGHTY_TERMS] }
  });
  const state = context.state.profession.specialization.state;
  for (const mantra of MANTRAS) {
    for (const id of [mantra.rootId, mantra.normalId, mantra.finalId]) {
      state.tomePages = 0;
      const skill = {
        ...context.catalog.skillsById.get(id),
        name: 'Renamed mantra',
        description: id === mantra.finalId ? '' : 'Final Charge.',
        categories: ['Mantra']
      };
      updateFirebrandCastState({ ...context, effectiveEnd: 1, ammo: { charges: 1 } }, skill);
      assert.equal(state.tomePages, id === mantra.finalId ? 2 : 0);
    }
  }

  for (const skill of [
    { id: 999991, name: 'Custom', description: 'Final Charge.' },
    { id: 999992, name: 'Custom', categories: ['Mantra'] }
  ]) {
    state.tomePages = 0;
    updateFirebrandCastState({ ...context, effectiveEnd: 1, ammo: { charges: 1 } }, skill);
    assert.equal(state.tomePages, 2);
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
        power: precomputed ? 1150 : 1000,
        ferocity: precomputed ? 100 : 0,
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
      assert.equal(input.power, precomputed ? 1150 : 1000);
    }
  }
});

test('Galeshot arrow restoration preserves fractional gains and uses the current cap', () => {
  const { context } = createScheduler({ profession: rangerProfession, config: { specialization: 'Galeshot' } });
  const state = context.state.profession.specialization.state;
  const patched = {
    ...context,
    catalog: { ...context.catalog, balanceProfilesById: new Map([[GALE.resources, { maximumStacks: 4.5 }]]) }
  };
  state.arrows = 2.25;
  restoreArrow(patched, 0.5);
  assert.equal(state.arrows, 2.75);
  restoreArrow(patched, 10);
  assert.equal(state.arrows, 4.5);
  assert.equal(state.maximumArrows, 4.5);
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
  const context = { config: {}, time: 0, runtime: { profession: { selectedLegendIds: [LEGEND.ASSASSIN] } } };
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

  for (const skillId of [R.BEGUILING_HAZE, R.BEGUILING_HAZE_ID_76805, R.TWIN_MOON_SWEEP]) {
    const events = [];
    observeConduitTraits(
      { config: { relic: 'Peitha' }, emitDerived: (_cause, event) => events.push(event) },
      { type: 'damage', at: 1, skillId, skillName: 'Renamed' }
    );
    assert.equal(events.length, skillId === R.TWIN_MOON_SWEEP ? 0 : 1);
  }
});

test('Warrior target boon configuration preserves precedence, uniqueness, and normalization', () => {
  for (const [target, expected] of [
    [undefined, 0],
    [{ boonless: true, boons: ['might'], boonCount: 3 }, 0],
    [{ boons: ['might', 'might', 1, '1'], boonCount: 9 }, 2],
    [{ boons: [], boonCount: 9 }, 0],
    [{ boonCount: 2.9 }, 2],
    [{ boonCount: -1 }, 0],
    [{ boonCount: 'bad' }, 0],
    [{ boonless: false }, 1]
  ]) {
    assert.equal(configuredTargetBoonCount(target), expected);
  }
});

// Refrain identity drives pulses and modifiers, while snapshots still expose a readable label.
test('Paragon renamed refrains replace, project, exhaust, and recover from missing skills', () => {
  const { context } = createScheduler({
    profession: warriorProfession,
    config: { specialization: 'Paragon', selectedTraitIds: [WT.CALL_TO_ACTION, WT.STRENGTHENING_STANZAS] }
  });
  const state = context.state.profession.specialization.state;
  const skillsById = new Map(context.catalog.skillsById);
  for (const id of [W.CHANT_OF_ACTION, W.CHANT_OF_FREEDOM])
    skillsById.set(id, { ...skillsById.get(id), name: 'Renamed ' + id });
  const renamed = { ...context, catalog: { ...context.catalog, skillsById }, effectiveEnd: 0 };
  observeParagonEvent(renamed, { type: 'combat_start', at: 0 });
  assert.equal(state.activeRefrainId, W.CHANT_OF_ACTION);
  const rule = paragonAttributeRules.modifierRules.find(({ id }) => id === 'warrior.strengthening-stanzas');
  assert.equal(rule.when({ config: renamed.config, runtime: { profession: renamed.state.profession } }), true);
  assert.equal(
    projectWarriorEndState({ schedulerState: renamed.state, schedulerContext: renamed }).activeRefrain,
    'Renamed ' + W.CHANT_OF_ACTION
  );
  activateChant(renamed, skillsById.get(W.CHANT_OF_FREEDOM));
  assert.equal(state.activeRefrainId, W.CHANT_OF_FREEDOM);
  assert.equal(rule.when({ config: renamed.config, runtime: { profession: renamed.state.profession } }), false);
  assert.equal(
    snapshotWarriorState(renamed.state.profession, skillsById).activeRefrain,
    'Renamed ' + W.CHANT_OF_FREEDOM
  );
  state.motivation = 1;
  advanceParagon(renamed, state.nextRefrainAt);
  assert.equal(state.activeRefrainId, null);
  assert.equal(snapshotWarriorState(renamed.state.profession, skillsById).activeRefrain, '');
  state.activeRefrainId = 999999;
  state.nextRefrainAt = 6;
  state.motivation = 1;
  advanceParagon(renamed, 10);
  assert.equal(state.activeRefrainId, null);
  assert.equal(state.nextRefrainAt, 0);
});
