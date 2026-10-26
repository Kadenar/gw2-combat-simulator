import { planningBuffStacks } from '#gw2/platform/results/result-queries.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { applySkillPatch, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const core = (result) => observedRuntime(result).profession.core;

// One Core-owned input acquires a landing only through the active Vindicator module.
test('shared Dodge retains its identity and cost while Vindicator owns its landing', () => {
  for (const specialization of ['Core', 'Herald', 'Renegade', 'Vindicator', 'Conduit']) {
    const config = { specialization };
    const catalog = revenantProfession.runtimeFor(config).catalog;
    assert.deepEqual(
      catalog.skills.filter((skill) => skill.inputControl === 'dodge').map((skill) => skill.id),
      [SHARED_SKILL_IDS.DODGE]
    );
    const result = runRevenant([SHARED_SKILL_IDS.DODGE], config);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[0].skillId, SHARED_SKILL_IDS.DODGE);
    assert.equal(core(result).endurance.value, 50 + result.rotationEndTime * 5);
    assert.equal(
      result.events.some((event) => event.skillName === 'Death Drop'),
      specialization === 'Vindicator'
    );
  }
});

// Both ways of ending Dodge must retire a chain that advanced during its airborne phase.
test('shared Dodge completion and cancellation reset airborne autoattack chains', () => {
  for (const interruptAfterMs of [undefined, 200]) {
    const result = runRevenant(
      [
        ID.PREPARATION_THRUST,
        { skillId: SHARED_SKILL_IDS.DODGE, interruptAfterMs },
        { skillId: ID.BRUTAL_BLADE, concurrentOffsetMs: 0 },
        ID.PREPARATION_THRUST
      ],
      { specialization: 'Vindicator', primaryWeapon: 'Sword', secondaryWeapon: 'Sword' },
      {
        // Finish the overlapping auto before either endpoint so the reset observes an advanced chain.
        catalog: (catalog) => withSkill(catalog, ID.BRUTAL_BLADE, { castTimeMs: 100 })
      }
    );
    assert.deepEqual(result.warnings, []);
    const dodge = result.steps.find((step) => step.skillId === SHARED_SKILL_IDS.DODGE);
    const auto = result.steps.find((step) => step.skillId === ID.BRUTAL_BLADE);
    assert.ok(auto.start >= dodge.start && auto.end < dodge.end);
    assert.equal(core(result).autoattackChains[ID.PREPARATION_THRUST], ID.BRUTAL_BLADE);
    assert.equal(
      result.events.some((event) => event.skillName === 'Death Drop'),
      interruptAfterMs == null
    );
  }
});

// Weapon-swap traits must observe the spear owner's consumed pool and already-emitted Raze payload.
test('Crushing Abyss resolves before Brutality observes the committed weapon swap', () => {
  const observations = [];
  let razeEmitted = false;
  const result = runRevenant(
    ['__combat_start', 'Swap Weapons'],
    {
      primaryWeapon: 'Spear',
      weaponSet2Primary: 'Sword',
      weaponSet2Secondary: 'Sword',
      selectedTraitIds: [TRAIT.BRUTALITY],
      initialBuffs: [{ kind: 'crushing-abyss', stacks: 3, duration: 10 }]
    },
    {
      initialize(runtime) {
        const effects = runtime.effects;
        runtime.effects = {
          emit(request) {
            const event = request.kind === 'packet' ? request.event : request.attribution;

            if (event?.type === 'damage' && event.sourceId === ID.ABYSSAL_RAZE) razeEmitted = true;

            if (event?.sourceId === TRAIT.BRUTALITY)
              observations.push({ remaining: runtime.profession.core.crushingAbyss.length, razeEmitted });

            return effects.emit(request);
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(observations, [{ remaining: 0, razeEmitted: true }]);
});

// Removing an intrinsic declaration must remove its transition, rather than leave a second hook dispatcher active.
for (const [skillId, specialization, legend, active] of [
  [ID.IMPERIAL_GUARD, 'Core', LEGEND.ASSASSIN, (result) => Boolean(core(result).availableFlips[ID.TRUE_STRIKE])],
  [ID.ENCHANTED_DAGGERS, 'Core', LEGEND.ASSASSIN, (result) => core(result).enchantedDaggers.charges > 0],
  [
    ID.BLOSSOMING_AURA,
    'Core',
    LEGEND.ASSASSIN,
    (result) => Boolean(core(result).availableFlips[ID.DETONATE_BLOSSOMING_AURA])
  ],
  [ID.ABYSSAL_RAZE, 'Core', LEGEND.ASSASSIN, (result) => core(result).crushingAbyss.length > 0],
  [ID.IMPOSSIBLE_ODDS, 'Core', LEGEND.ASSASSIN, (result) => core(result).activeUpkeeps.length > 0],
  [ID.SWAP_LEGENDS, 'Core', LEGEND.ASSASSIN, (result) => core(result).activeLegendId === LEGEND.DEMON],
  [
    ID.FACET_OF_NATURE,
    'Herald',
    LEGEND.ASSASSIN,
    (result) => Boolean(core(result).availableFlips[ID.TRUE_NATURE_ASSASSIN])
  ],
  [
    ID.RAZORCLAWS_RAGE,
    'Renegade',
    LEGEND.RENEGADE,
    (result) => renegadeState.from(observedRuntime(result)).razorclawsRage.charges > 0
  ],
  [
    ID.BREAKRAZORS_BASTION,
    'Renegade',
    LEGEND.RENEGADE,
    (result) => planningBuffStacks(result.planningState, 'band-together') > 0
  ],
  [
    ID.BEGUILING_HAZE,
    'Conduit',
    LEGEND.ENTITY,
    (result) => conduitState.from(observedRuntime(result)).beguilingHazeCharges > 0
  ],
  [
    ID.COSMIC_WISDOM,
    'Conduit',
    LEGEND.DEMON,
    (result) => conduitState.from(observedRuntime(result)).cosmicWisdomUntil > 0
  ]
]) {
  test(`skill ${skillId} owns its intrinsic transition`, () => {
    for (const removed of [false, true]) {
      const result = runRevenant(
        [{ skillId }, wait(1000)],
        {
          specialization,
          selectedLegends: [legend, legend === LEGEND.ASSASSIN ? LEGEND.DEMON : LEGEND.ASSASSIN],
          startingLegend: legend,
          initialEnergy: 100
        },
        {
          catalog: (catalog) => (removed ? withSkill(catalog, skillId, { sideEffects: [] }) : catalog)
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(active(result), !removed);
    }
  });
}

test('cancelled True Strike consumes the window opened by a shortened blocking channel', () => {
  const result = runRevenant([
    { skillId: ID.IMPERIAL_GUARD, interruptMs: 100 },
    { skillId: ID.TRUE_STRIKE, interruptMs: 0 }
  ]);
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).availableFlips[ID.TRUE_STRIKE], undefined);
  const blocking = result.events.find((event) => event.kind === 'blocking');
  const guard = result.steps.find((step) => step.skillId === ID.IMPERIAL_GUARD);
  assert.equal(blocking.duration, (guard.end - guard.start) / 1000);
  assert.equal(
    result.events.some((event) => event.type === 'damage'),
    false
  );
});

test('Requiem target-size eligibility is fixed at acceptance', () => {
  // A changed target assumption after acceptance cannot add or remove the conditional component.
  for (const initial of ['small', 'large']) {
    const result = runRevenant(
      [{ skillId: ID.ETERNITYS_REQUIEM }, wait(2500)],
      {
        professionAssumptions: { hitboxSize: initial }
      },
      {
        initialize(runtime) {
          runtime.schedule('test.change-hitbox', 0.1);
        },
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'test.change-hitbox'(runtime) {
              runtime.config.professionAssumptions.hitboxSize = initial === 'small' ? 'large' : 'small';
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const conditional = result.events.find((event) => event.type === 'damage' && event.at > 1.8);
    assert.equal(Boolean(conditional), initial === 'large');
  }
});

test('Heroic Command refreshes only live Fervor at commitment, including when Might is removed', () => {
  for (const removed of [false, true]) {
    const result = runRevenant(
      [{ skillId: ID.HEROIC_COMMAND }],
      {
        specialization: 'Renegade',
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE
      },
      {
        catalog: (catalog) =>
          withSkill(
            removed
              ? applySkillPatch(catalog, {
                  skills: { [ID.HEROIC_COMMAND]: { removeEffects: [{ type: 'boon', name: 'might' }] } }
                })
              : catalog,
            ID.HEROIC_COMMAND,
            { castTimeMs: 1000 }
          ),
        initialize(runtime) {
          renegadeState.from(runtime).kallasFervor = [
            { at: 0, expiresAt: 0.5 },
            { at: 0, expiresAt: 2 }
          ];
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const fervor = renegadeState.from(observedRuntime(result)).kallasFervor;
    assert.equal(fervor.length, 1);
    assert.ok(fervor[0].expiresAt > 2);
    // Only the Fervor-scaled grant may emit; the authored payload never applies as an ordinary cast effect.
    const might = result.events.filter((event) => event.type === 'buff' && event.kind === 'might');
    assert.deepEqual(
      might.map((event) => event.stacks),
      removed ? [] : [2]
    );
  }
});

// Without live Fervor the deferred payload has nothing to scale, so the cast grants no Might at all.
test('Heroic Command without Fervor grants no Might', () => {
  const result = runRevenant([{ skillId: ID.HEROIC_COMMAND }], {
    specialization: 'Renegade',
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(renegadeState.from(observedRuntime(result)).kallasFervor.length, 0);
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'might'),
    false
  );
});

test('Cosmic Wisdom grants Core traits once before form activation', () => {
  const order = [];
  const result = runRevenant(
    ['__combat_start', { skillId: ID.COSMIC_WISDOM }],
    {
      specialization: 'Conduit',
      selectedTraitIds: [TRAIT.NOTORIETY],
      selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
      startingLegend: LEGEND.DEMON
    },
    {
      initialize(runtime) {
        // Observe the real emission service without replacing capabilities inside an author callback.
        const effects = runtime.effects;
        runtime.effects = {
          emit(request) {
            const event = request.kind === 'packet' ? request.event : request.attribution;

            if (event?.sourceId === TRAIT.NOTORIETY) order.push(conduitState.from(runtime).conduitForm);

            return effects.emit(request);
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(order, ['']);
  assert.equal(result.events.filter((event) => event.sourceId === TRAIT.NOTORIETY).length, 1);
  assert.equal(conduitState.from(observedRuntime(result)).conduitForm, 'Mesmer');
});

test('Herald consume publishes Core rewards before establishing Echo retention', () => {
  const retainedDuringReward = [];
  const result = runRevenant(
    ['__combat_start', 'Facet of Nature', { skillId: ID.TRUE_NATURE_DRAGON }],
    {
      specialization: 'Herald',
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      selectedTraitIds: [TRAIT.NOTORIETY, TRAIT.DRACONIC_ECHO]
    },
    {
      initialize(runtime) {
        // Retaining Dragon Nature too early would change the duration of the consume's own Core reward.
        const effects = runtime.effects;
        runtime.effects = {
          emit(request) {
            const event = request.kind === 'packet' ? request.event : request.attribution;

            if (event?.sourceId === TRAIT.NOTORIETY && event.skillId === ID.TRUE_NATURE_DRAGON)
              retainedDuringReward.push(Boolean(heraldState.from(runtime).lingeringFacets[ID.FACET_OF_NATURE]));

            return effects.emit(request);
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(retainedDuringReward, [false]);
  assert.ok(heraldState.from(observedRuntime(result)).lingeringFacets[ID.FACET_OF_NATURE]);
});

test('Twin Moon affinity belongs to each resolved player packet, independently of fragments', () => {
  for (const offTarget of [false, true]) {
    for (const removed of [false, true]) {
      const result = runRevenant(
        ['__combat_start', { skillId: ID.TWIN_MOON_SWEEP, offTarget }],
        {
          specialization: 'Conduit',
          selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
          startingLegend: LEGEND.ENTITY
        },
        {
          catalog: (catalog) =>
            withSkill(catalog, ID.TWIN_MOON_SWEEP, {
              effects: catalog.skillsById.get(ID.TWIN_MOON_SWEEP).effects.map((effect) =>
                effect.reactions
                  ? {
                      ...effect,
                      ticks: [
                        { atMs: 400, coefficient: 1 },
                        { atMs: 800, coefficient: 1 }
                      ],
                      ...(removed ? { reactions: [] } : {})
                    }
                  : effect
              )
            })
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(conduitState.from(observedRuntime(result)).affinity.value, removed || offTarget ? 0 : 4);
    }
  }
});

// Removed profile targets reject edits; specialization minors retain intrinsic capacity without explicit selection.
test('Revenant intrinsic profiles have one canonical owner', () => {
  const catalog = revenantProfession.catalog;
  assert.equal(catalog.balanceProfiles.filter((profile) => profile.profileKind === 'skill-variant').length, 0);
  for (const id of [
    'revenant.nature-assassin',
    'revenant.conduit.affinity',
    'revenant.conduit.beguiling-haze-follow-up',
    'revenant.renegade.heroic-command-lasting-legacy',
    'revenant.renegade.orders-from-above-righteous-rebel'
  ]) {
    assert.throws(
      () => applyBalanceProfilePatch(catalog, { balanceProfiles: { [id]: { fields: { maximumStacks: 4 } } } }),
      /unknown balance profile/i
    );
  }
});

// The skill owns both Might templates; trait selection and effect removal never borrow a sibling's output.
test('Heroic Command selects independent skill-owned Might and still refreshes Fervor after removal', () => {
  for (const legacy of [false, true]) {
    for (const removed of [false, true]) {
      const name = legacy ? 'lasting-legacy-might' : 'might';
      const result = runRevenant(
        ['Heroic Command'],
        {
          specialization: 'Renegade',
          initialEnergy: 100,
          selectedTraitIds: legacy ? [TRAIT.LASTING_LEGACY] : []
        },
        {
          catalog: (catalog) =>
            applySkillPatch(catalog, {
              skills: {
                [ID.HEROIC_COMMAND]: removed
                  ? { removeEffects: [{ type: 'boon', name }] }
                  : { effects: [{ type: 'boon', name, stacks: 4 }] }
              }
            }),
          initialize(runtime) {
            renegadeState.from(runtime).kallasFervor = [{ at: 0, expiresAt: 1 }];
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const might = result.events.find(
        (event) => event.type === 'buff' && event.kind === 'might' && event.skillId === ID.HEROIC_COMMAND
      );
      assert.equal(might?.stacks ?? 0, removed ? 0 : 4);
      assert.ok(renegadeState.from(observedRuntime(result)).kallasFervor[0].expiresAt > 1);
    }
  }
});

// Righteous Rebel replaces the base component; removing either branch must not synthesize the other branch.
test('Orders from Above isolates base and Righteous Rebel component removal', () => {
  for (const rebel of [false, true]) {
    const result = runRevenant(
      ['Orders from Above', wait(1000)],
      {
        specialization: 'Renegade',
        initialEnergy: 100,
        selectedTraitIds: rebel ? [TRAIT.RIGHTEOUS_REBEL] : []
      },
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, {
            skills: {
              [ID.ORDERS_FROM_ABOVE]: {
                removeEffects: [{ type: 'boon', name: rebel ? 'righteous-rebel-alacrity' : 'base-alacrity' }]
              }
            }
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'buff' && event.kind === 'alacrity'),
      false
    );
  }
});

// A removed siphon must not claim its cooldown; the facet lifecycle and Energy upkeep still activate.
test('Facet of Nature owns its Assassin payload and independent proc cooldown', () => {
  for (const removed of [false, true]) {
    const result = runRevenant(
      ['Facet of Nature', 'Preparation Thrust'],
      {
        specialization: 'Herald',
        initialEnergy: 100,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
        selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
        startingLegend: LEGEND.ASSASSIN
      },
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, {
            skills: {
              [ID.FACET_OF_NATURE]: {
                fields: { internalCooldown: 3 },
                sideEffects: {
                  'assassin-siphon': removed
                    ? { removeEffects: [{ type: 'strike', name: 'Life Siphon' }] }
                    : {
                        effects: [{ type: 'strike', name: 'Life Siphon', flatStrikeBase: 777, flatStrikePowerCoeff: 0 }]
                      }
                }
              }
            }
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    const siphon = result.events.find((event) => event.type === 'damage' && event.skillId === ID.FACET_OF_NATURE);
    assert.equal(Boolean(siphon), !removed);
    assert.equal(runtime.procs.deadline('revenant.herald.natureSiphon'), removed ? 0 : siphon.at + 3);
    assert.ok(core(result).activeUpkeeps.some((upkeep) => upkeep.skillId === ID.FACET_OF_NATURE));
  }
});

// Dervish's all-legend threshold is independent of the shared Affinity cap and works without explicit minor selection.
test('Dervish release reads its selected all-legend Affinity threshold', () => {
  for (const threshold of [2, 4]) {
    const result = runRevenant(
      ['Release Potential: Dervish'],
      {
        specialization: 'Conduit',
        initialEnergy: 100,
        selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
        startingLegend: LEGEND.ENTITY,
        selectedTraitIds: []
      },
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, {
            skills: { [ID.RELEASE_POTENTIAL_DERVISH]: { fields: { allLegendAffinityThreshold: threshold } } }
          }),
        initialize(runtime) {
          runtime.resourceController.replace('affinity', 3);
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some(
        (event) => event.type === 'buff' && event.kind === 'might' && event.skillId === ID.RELEASE_POTENTIAL_DERVISH
      ),
      threshold === 2
    );
    assert.equal(conduitState.from(observedRuntime(result)).affinity.maximum, 5);
  }
});
