import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { HERALD_ELEVATED_COMPASSION_PROFILE_ID as COMPASSION } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { CONDUIT_BALANCE_PROFILE_IDS as CONDUIT } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const conduitConfig = {
  specialization: 'Conduit',
  selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
  startingLegend: LEGEND.DEMON,
  initialEnergy: 100
};

// Removed output must not schedule zero-time or backdated recurrence, even after leaving the upkeep threshold.
test('removed Elevated Compassion ends its cadence at zero and positive times', () => {
  for (const delay of [0, 7000]) {
    const result = runRevenant(
      [
        wait(delay),
        'Facet of Chaos',
        'Facet of Strength',
        wait(1000),
        'Burst of Strength',
        wait(1000),
        { type: 'cooldown-reset' },
        'Facet of Strength',
        wait(4000)
      ],
      {
        specialization: 'Herald',
        selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
        startingLegend: LEGEND.DRAGON,
        selectedTraitIds: [TRAIT.ELEVATED_COMPASSION],
        initialEnergy: 100
      },
      {
        catalog: (catalog) =>
          applyBalanceProfilePatch(catalog, {
            balanceProfiles: { [COMPASSION]: { removeEffects: [{ type: 'boon', name: 'quickness' }] } }
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      observedRuntime(result).profession.core.activeUpkeeps.reduce((total, upkeep) => total + upkeep.upkeepCost, 0),
      6
    );
    assert.equal(observedRuntime(result).profession.specialization.state.elevatedCompassionPulseAt, null);
    assert.equal(observedRuntime(result).procs.deadline('revenant.herald.elevatedCompassion'), 0);
    assert.equal(
      result.events.some((event) => event.sourceId === TRAIT.ELEVATED_COMPASSION),
      false
    );
  }
});

// Removed windows restore native costs immediately; authored zero-duration buffs are rejected by validation.
test('removed Cosmic Wisdom leaves no Mesmer discount and zero-duration patches are rejected', () => {
  const edit = { removeEffects: [{ type: 'buff', name: 'cosmic-wisdom' }] };
  const result = runRevenant([wait(1000), 'Cosmic Wisdom'], conduitConfig, {
    catalog: (catalog) => applySkillPatch(catalog, { skills: { [ID.COSMIC_WISDOM]: edit } })
  });
  const runtime = observedRuntime(result);
  const state = runtime.profession.specialization.state;
  assert.deepEqual(result.warnings, []);
  assert.equal(state.conduitForm, '');
  assert.equal(state.cosmicWisdomUntil, 0);
  assert.deepEqual(state.energyCostOverrides, {});
  const skill = runtime.helpers.skillsById.get(ID.EMPOWERING_MISERY);
  assert.equal(revenantEnergyCost(runtime, skill), skill.energyCost);
  assert.throws(
    () =>
      applySkillPatch(revenantCatalog, {
        skills: {
          [ID.COSMIC_WISDOM]: {
            effects: [{ type: 'buff', name: 'cosmic-wisdom', duration: 0 }]
          }
        }
      }),
    /positive duration/
  );
});

// Public planning state must carry patched discounts and stop exposing them at the form boundary.
test('Mesmer planning costs match runtime before and at expiry', () => {
  const catalog = (catalog) =>
    applyBalanceProfilePatch(
      applySkillPatch(catalog, {
        skills: { [ID.COSMIC_WISDOM]: { effects: [{ type: 'buff', name: 'cosmic-wisdom', duration: 2 }] } }
      }),
      { balanceProfiles: { [CONDUIT.mesmerEmpoweringMisery]: { fields: { energyCost: 2 } } } }
    );
  const active = runRevenant(['Cosmic Wisdom'], conduitConfig, { catalog });
  const expired = runRevenant(['Cosmic Wisdom', wait(2000)], conduitConfig, { catalog });
  for (const [result, expected] of [
    [active, 2],
    [expired, 5]
  ]) {
    const runtime = observedRuntime(result);
    const skill = runtime.helpers.skillsById.get(ID.EMPOWERING_MISERY);
    assert.deepEqual(result.warnings, []);
    assert.equal(revenantEnergyCost(runtime, skill), expected);
  }

  assert.deepEqual(expired.planningState.profession.energyCostOverrides, {});
});

// An old expiry cannot clear a form extended by a legend swap, and each legend selects its own cost policy.
test('legend swaps preserve extended Cosmic Wisdom and refresh Mesmer overrides', () => {
  const result = runRevenant(
    ['__combat_start', 'Cosmic Wisdom', 'Swap Legends', wait(10000), 'Swap Legends'],
    { ...conduitConfig, selectedTraitIds: [TRAIT.ENHANCED_EMBODIMENT] },
    {
      catalog: (catalog) =>
        applyBalanceProfilePatch(
          applySkillPatch(catalog, {
            skills: { [ID.COSMIC_WISDOM]: { effects: [{ type: 'buff', name: 'cosmic-wisdom', duration: 2 }] } }
          }),
          {
            balanceProfiles: {
              [CONDUIT.enhancedEmbodiment]: {
                effects: [{ type: 'buff', name: 'cosmic-wisdom-extension', duration: 20 }]
              }
            }
          }
        )
    }
  );
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.equal(runtime.profession.specialization.state.conduitForm, 'Mesmer');
  assert.ok(runtime.profession.specialization.state.cosmicWisdomUntil > runtime.time);
  assert.equal(revenantEnergyCost(runtime, runtime.helpers.skillsById.get(ID.EMPOWERING_MISERY)), 1);
});

// The fallback adds the patched bonus once; build-derived attributes already include it.
test('Empire Divided runtime fallback reads its attribute profile', () => {
  const catalog = applyBalanceProfilePatch(revenantCatalog, {
    balanceProfiles: { [TRAIT.EMPIRE_DIVIDED]: { fields: { attributeBonus: 321 } } }
  });
  for (const applied of [false, true]) {
    const config = {
      specialization: 'Vindicator',
      selectedTraitIds: [TRAIT.EMPIRE_DIVIDED],
      attributeProvenance: { professionStaticRulesApplied: applied }
    };
    const stats = revenantProfession
      .resolveProfession(config)
      .modifyAttributes({ catalog, config, time: 0 }, { power: 1000 });
    assert.equal(stats.power, applied ? 1000 : 1321);
  }
});

// Patching the catalog call must change ordinary invocation, retaining Song of the Mists as its source.
test('Core and Entity invocation consume the patched call skill', () => {
  for (const specialization of ['Core', 'Conduit']) {
    for (const removed of [false, true]) {
      const destination = specialization === 'Core' ? LEGEND.ASSASSIN : LEGEND.ENTITY;
      const starting = specialization === 'Core' ? LEGEND.DEMON : LEGEND.ASSASSIN;
      const config = {
        specialization,
        selectedLegends: [starting, destination],
        startingLegend: starting,
        selectedTraitIds: [TRAIT.SONG_OF_THE_MISTS]
      };
      const baseline = runRevenant(['__combat_start', 'Swap Legends'], config);
      const nativeBoon = baseline.events.find(
        (event) => event.sourceId === TRAIT.SONG_OF_THE_MISTS && event.type === 'buff'
      );
      const result = runRevenant(['__combat_start', 'Swap Legends'], config, {
        catalog: (catalog) =>
          applySkillPatch(catalog, {
            skills: {
              [ID.CALL_OF_THE_ASSASSIN]: removed
                ? { removeEffects: [{ type: 'boon', name: 'Call of the Assassin' }] }
                : { effects: [{ type: 'boon', name: 'Call of the Assassin', duration: 4 }] }
            }
          })
      });
      assert.deepEqual(result.warnings, []);
      const boons = result.events.filter(
        (event) => event.sourceId === TRAIT.SONG_OF_THE_MISTS && event.type === 'buff'
      );
      assert.deepEqual(
        boons.map((event) => event.duration),
        removed ? [] : [nativeBoon.duration * 2]
      );
      assert.ok(boons.every((event) => event.skillId === ID.CALL_OF_THE_ASSASSIN));
    }
  }
});

// Snapshot and effect display caps come from the selected patch and Lasting Legacy variant.
test('Revenant stack displays use patched skill and selected trait caps', () => {
  const catalog = applyBalanceProfilePatch(withSkill(revenantCatalog, ID.ABYSSAL_RAZE, { maximumStacks: 7 }), {
    balanceProfiles: {
      [RENEGADE.kallasFervor]: { fields: { maximumStacks: 2 } },
      [RENEGADE.kallasFervorLastingLegacy]: { fields: { maximumStacks: 8 } }
    }
  });
  for (const selected of [false, true]) {
    for (const selection of [
      { traits: new Set(selected ? [TRAIT.LASTING_LEGACY] : []) },
      { build: { specializations: [{ name: 'Renegade', traits: selected ? '1-1-2' : '1-1-1' }] } }
    ]) {
      const context = {
        catalog,
        balanceContext: { catalog, modifierRulesById: new Map() },
        specialization: 'Renegade',
        ...selection,
        atSeconds: 1,
        professionState: { crushingAbyss: Array(9).fill(10), kallasFervor: Array(9).fill({ at: 0, expiresAt: 10 }) }
      };
      const values = Object.fromEntries(
        revenantProfession.ui.rotationStateSnapshot(context).map((item) => [item.id, item.value])
      );
      assert.equal(values['revenant-crushing-abyss'], '7/7 · 9.0s');
      assert.equal(values['renegade-kallas-fervor'], selected ? '8/8 · 9.0s' : '2/2 · 9.0s');
      assert.equal(
        revenantProfession.ui.effectPresentations(context).find((effect) => effect.kind === 'kallas-fervor')
          .maximumStacks,
        selected ? 8 : 2
      );
    }
  }
});
