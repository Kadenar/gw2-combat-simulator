import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { revenantTooltips } from '#gw2/professions/revenant/app/tooltips.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const conduitConfig = {
  specialization: 'Conduit',
  selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
  startingLegend: LEGEND.DEMON,
  initialEnergy: 100
};

// The stance owns the shared enhancement window; ordinary warband casts deliver its selected duration.
test('Band Together uses the stance skill window and retires its former profile target', () => {
  const result = runRevenant(
    [ID.ICERAZORS_IRE, wait(1000)],
    {
      specialization: 'Renegade',
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    },
    {
      catalog: (catalog) =>
        applySkillPatch(catalog, {
          skills: {
            [ID.LEGENDARY_RENEGADE_STANCE]: {
              sideEffects: { 'band-together': { effects: [{ type: 'buff', name: 'band-together', duration: 0.5 }] } }
            }
          }
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  const grant = result.events.find((event) => event.type === 'buff' && event.kind === 'band-together');
  assert.equal(grant.duration, 0.5);
  assert.equal(grant.sourceId, ID.LEGENDARY_RENEGADE_STANCE);
  const runtime = observedRuntime(result);
  assert.equal(runtime.combat.activeBuffStacks('band-together', runtime.time, 1), 0);
  for (const id of [
    'revenant.renegade.band-together',
    'revenant.renegade.bold-reversal-righteous-rebel',
    'revenant.renegade.vindication'
  ])
    assert.throws(
      () => applyBalanceProfilePatch(revenantCatalog, { balanceProfiles: { [id]: { fields: {} } } }),
      /unknown balance profile/
    );
});

// Trait-owned tuning accepts only the canonical identity, and patching never mutates the base catalog.
test('Revenant specialization patches use canonical trait IDs and reject obsolete profile IDs', () => {
  for (const [trait, obsolete, field] of [
    [TRAIT.ELEVATED_COMPASSION, 'revenant.elevated-compassion', 'threshold'],
    [TRAIT.SHARED_EMPOWERMENT, 'revenant.shared-empowerment', 'internalCooldown'],
    [TRAIT.DRACONIC_ECHO, 'revenant.draconic-echo', 'duration'],
    [TRAIT.LINGERING_DETERMINATION, 'revenant.conduit.lingering-determination', 'resourceGain'],
    [TRAIT.ENHANCED_EMBODIMENT, 'revenant.conduit.enhanced-embodiment', 'rechargeMultiplier'],
    [TRAIT.EXPANDED_CONSCIOUSNESS, 'revenant.conduit.expanded-consciousness', 'resourceGain'],
    [TRAIT.SHARED_WISDOM, 'revenant.conduit.shared-wisdom', null],
    [TRAIT.NUMINOUS_GIFT, 'revenant.conduit.numinous-gift', 'damageIncrease'],
    [TRAIT.MISTFIRE, 'revenant.conduit.mistfire', 'internalCooldown'],
    [TRAIT.AMBUSH_COMMANDER, 'revenant.renegade.kallas-fervor', 'maximumStacks'],
    [TRAIT.LASTING_LEGACY, 'revenant.renegade.kallas-fervor-lasting-legacy', 'damageIncreasePerStack'],
    [TRAIT.ALL_FOR_ONE, 'revenant.renegade.all-for-one', 'resourceGain'],
    [TRAIT.ASHEN_DEMEANOR, 'revenant.renegade.ashen-demeanor', 'cooldown'],
    [TRAIT.BLOOD_FURY, 'revenant.renegade.blood-fury', 'conditionDurationBonus'],
    [TRAIT.BRUTAL_MOMENTUM, 'revenant.renegade.brutal-momentum', 'criticalChance'],
    [TRAIT.ENDLESS_ENMITY, 'revenant.renegade.endless-enmity', 'internalCooldown']
  ]) {
    const original = revenantCatalog.balanceProfilesById.get(trait);
    assert.equal(revenantCatalog.balanceProfilesById.has(obsolete), false);
    assert.throws(
      () => applyBalanceProfilePatch(revenantCatalog, { balanceProfiles: { [obsolete]: { fields: {} } } }),
      /unknown balance profile/
    );

    const patched = applyBalanceProfilePatch(revenantCatalog, {
      balanceProfiles: {
        [trait]: field
          ? { fields: { [field]: original[field] * 2 } }
          : { removeEffects: [{ type: 'boon', name: 'beguiling-haze' }] }
      }
    });
    const selected = patched.balanceProfilesById.get(trait);

    if (field) assert.equal(selected[field], original[field] * 2);
    else {
      assert.ok(original.effects.some((effect) => effect.name === 'beguiling-haze'));
      assert.equal(
        selected.effects.some((effect) => effect.name === 'beguiling-haze'),
        false
      );
    }

    assert.equal(revenantCatalog.balanceProfilesById.get(trait), original);
  }
});

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
            balanceProfiles: { [TRAIT.ELEVATED_COMPASSION]: { removeEffects: [{ type: 'boon', name: 'quickness' }] } }
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

// The live cost owner applies patched discounts and restores native costs at the form boundary.
test('Mesmer runtime costs restore native values at form expiry', () => {
  const catalog = (catalog) =>
    applySkillPatch(
      applySkillPatch(catalog, {
        skills: { [ID.COSMIC_WISDOM]: { effects: [{ type: 'buff', name: 'cosmic-wisdom', duration: 2 }] } }
      }),
      { skills: { [ID.EMPOWERING_MISERY]: { fields: { mesmerEnergyCost: 2 } } } }
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

  assert.equal(observedRuntime(expired).profession.specialization.state.conduitForm, '');
  assert.equal(observedRuntime(expired).profession.specialization.state.cosmicWisdomUntil, 0);
});

// Form entry validates even unused costs in score output, and errors identify the selected patch rather than a fallback.
test('Mesmer entry and legend reselection reject missing or invalid selected skill costs', () => {
  const balanceDataContext = { professionId: 'revenant', patchId: 'invalid-conduit-cost' };
  for (const output of ['score', 'detailed']) {
    for (const startingLegend of [LEGEND.DEMON, LEGEND.ENTITY]) {
      for (const profileId of [ID.EMPOWERING_MISERY, ID.EMBRACE_THE_DARKNESS]) {
        for (const fault of ['missing', 'invalid']) {
          const catalog = (base) => {
            const skillsById = new Map(base.skillsById);

            if (fault === 'missing') skillsById.delete(profileId);
            else
              skillsById.set(profileId, {
                ...skillsById.get(profileId),
                balanceDataContext,
                mesmerEnergyCost: NaN
              });

            return { ...base, balanceDataContext, skillsById };
          };

          const rotation = startingLegend === LEGEND.DEMON ? ['Cosmic Wisdom'] : ['Cosmic Wisdom', 'Swap Legends'];

          assert.throws(
            () => runRevenant(rotation, { ...conduitConfig, startingLegend }, { catalog, output }),
            (error) => {
              assert.ok(error.message.includes(`profession=revenant patch=invalid-conduit-cost skill=${profileId}`));
              assert.match(error.message, fault === 'missing' ? /missing required skill/ : /expected=finite number/);
              return true;
            },
            `${output}/${startingLegend}/${profileId}/${fault}`
          );
        }
      }
    }
  }
});

// An old expiry cannot clear a form extended by a legend swap, and each legend selects its own cost policy.
test('legend swaps preserve extended Cosmic Wisdom and select Mesmer costs', () => {
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
              [TRAIT.ENHANCED_EMBODIMENT]: {
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

// Ordinary declarations consume the patched profile once per query.
test('Empire Divided shared declaration reads its attribute profile', () => {
  const catalog = applyBalanceProfilePatch(revenantCatalog, {
    balanceProfiles: { [TRAIT.EMPIRE_DIVIDED]: { fields: { 'attributeBonuses.power': 321 } } }
  });
  {
    const config = {
      specialization: 'Vindicator',
      selectedTraitIds: [TRAIT.EMPIRE_DIVIDED]
    };
    const stats = revenantProfession
      .resolveProfession(config)
      .modifyAttributes({ catalog, config, time: 0 }, { power: 1000 });
    assert.equal(stats.power, 1321);
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
      [TRAIT.AMBUSH_COMMANDER]: { fields: { maximumStacks: 2 } },
      [TRAIT.LASTING_LEGACY]: { fields: { maximumStacks: 8 } }
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
        professionState: {
          [STATE.CRUSHING_ABYSS]: Array(9).fill(10),
          [STATE.KALLAS_FERVOR]: Array(9).fill({ at: 0, expiresAt: 10 })
        }
      };
      const values = Object.fromEntries(
        revenantProfession.ui.rotationStateSnapshot(context).map((item) => [item.id, item.value])
      );
      assert.equal(values['revenant-crushing-abyss'], '7/7 · 9.0s');
      assert.equal(values['renegade-kallas-fervor'], selected ? '8/8 · 9.0s' : '2/2 · 9.0s');
      assert.equal(
        Object.hasOwn(
          revenantProfession.ui.effectPresentations(context).find((effect) => effect.kind === 'kallas-fervor'),
          'maximumStacks'
        ),
        false
      );
    }
  }
});

// The stance carries a helper window for warband completion, never an automatic stance reward.
test('Renegade stance does not advertise or grant Band Together on entry', () => {
  const context = { catalog: revenantCatalog };
  const tooltip = describeSimulationSkill(
    context,
    revenantCatalog.skillsById.get(ID.LEGENDARY_RENEGADE_STANCE),
    revenantTooltips
  );
  assert.equal(
    tooltip.facts.some((fact) => /band.together/i.test(fact.name)),
    false
  );
  const warband = describeSimulationSkill(context, revenantCatalog.skillsById.get(ID.ICERAZORS_IRE), revenantTooltips);
  assert.ok(
    warband.factTabs.find((tab) => tab.label === 'Base effects').facts.some((fact) => /band.together/i.test(fact.name))
  );
  const result = runRevenant([ID.SWAP_LEGENDS], {
    specialization: 'Renegade',
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.RENEGADE],
    startingLegend: LEGEND.ASSASSIN
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.kind === 'band-together'),
    false
  );
});
