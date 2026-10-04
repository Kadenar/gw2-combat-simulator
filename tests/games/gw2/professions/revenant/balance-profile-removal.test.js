import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/revenant/core/profiles.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as CONDUIT } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { HERALD_SHARED_EMPOWERMENT_PROFILE_ID } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { revenantLifeSiphonBonus } from '#gw2/professions/revenant/core/traits/behavior.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { effectiveConduitAffinity } from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const patched = (balanceProfiles) => (catalog) => applyBalanceProfilePatch(catalog, { balanceProfiles });
const RENEGADE_CONFIG = Object.freeze({
  specialization: 'Renegade',
  selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
  startingLegend: LEGEND.RENEGADE,
  initialEnergy: 100
});

// Migrated profiles expose one canonical ICD field and leave it unclaimed when their output is removed.
for (const [specialization, trait, profile, type, name] of [
  ['Herald', TRAIT.SHARED_EMPOWERMENT, HERALD_SHARED_EMPOWERMENT_PROFILE_ID, 'boon', 'might'],
  ['Renegade', TRAIT.BRUTAL_MOMENTUM, RENEGADE.brutalMomentum, 'boon', 'vigor'],
  ['Conduit', TRAIT.MISTFIRE, CONDUIT.mistfire, 'condition', 'Burning']
]) {
  test(`${specialization} declared proc honors effect removal and the patched internal cooldown`, () => {
    for (const removed of [false, true]) {
      const result = runRevenant(
        [{ type: 'wait', durationMs: 4000 }],
        { specialization, selectedTraitIds: [trait] },
        {
          catalog: patched({ [profile]: { fields: { internalCooldown: 2 }, ...(removed ? remove(type, name) : {}) } }),
          initialize(runtime) {
            for (const at of [1, 3, 3.001])
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  at,
                  source: 'fixture',
                  sourceId: 'trigger',
                  actorType: 'player',
                  skillName: 'Trigger',
                  ...(type === 'condition'
                    ? { type: 'control', controlKind: 'daze', duration: 1 }
                    : { type: 'buff', kind: 'fury', stacks: 1, duration: 1 })
                }
              });
          }
        }
      );
      const packets = result.events.filter((event) => event.sourceId === trait);
      assert.deepEqual(
        packets.map((event) => event.at),
        removed ? [] : [1, 3.001]
      );
      assert.equal(observedRuntime(result).procs.deadline(profile), removed ? 0 : 3.001 + 2);
      if (trait === TRAIT.BRUTAL_MOMENTUM) assert.ok(packets.every((event) => event.skillId === profile));
      assert.deepEqual(result.warnings, []);
    }
  });
}

test('removed Brutality quickness leaves the weapon-swap cooldown unclaimed', () => {
  // The live owner claims Brutality's cooldown only when it can deliver the Quickness.
  const result = runRevenant(
    ['Swap Weapons'],
    {
      ...RENEGADE_CONFIG,
      selectedTraitIds: [TRAIT.BRUTALITY],
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      weaponSet2Primary: 'Hammer'
    },
    { catalog: patched({ [TRAIT.BRUTALITY]: remove('boon', 'quickness') }) }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).procs.snapshot()['brutality'], undefined);
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.skillId === TRAIT.BRUTALITY),
    false
  );
});

test('removed Battle Scars siphon keeps the scars it would have spent', () => {
  // A landed player strike spends a scar only to deliver its siphon.
  const result = runRevenant([{ type: 'wait', durationMs: 3000 }], RENEGADE_CONFIG, {
    catalog: patched({ [CORE.battleScars]: remove('strike', 'Battle Scars — Life Siphon') }),
    initialize(runtime) {
      runtime.profession.core.battleScars = [30, 10];
      runtime.effects.emit({ kind: 'packet', event: revenantHit(2) });
    }
  });
  assert.deepEqual(observedRuntime(result).profession.core.battleScars, [30, 10]);
  assert.equal(
    result.events.some((event) => event.name === 'Battle Scars — Life Siphon'),
    false
  );
});

test('removed Band Together buff arms no enhancement while the unpatched window still does', () => {
  for (const [balanceProfiles, ready] of [
    [{ [RENEGADE.bandTogether]: remove('buff', 'band-together') }, false],
    [{}, true]
  ]) {
    const result = runRevenant(["Icerazor's Ire"], RENEGADE_CONFIG, { catalog: patched(balanceProfiles) });
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.specialization.state.bandTogetherReady, ready);
  }
});

test('Shared Wisdom boons stay bound to their triggering entity after a sibling removal', () => {
  // Removing Beguiling Haze's grant must not rebind the Entity-skill Swiftness or Gladiator's Defense Stability.
  const buffs = (selectedTraitIds, catalog) =>
    runRevenant(
      ["Gladiator's Defense"],
      {
        specialization: 'Conduit',
        selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
        startingLegend: LEGEND.ENTITY,
        selectedTraitIds,
        initialEnergy: 100
      },
      { catalog }
    )
      .events.filter((event) => event.type === 'buff' && event.skillId === ID.GLADIATORS_DEFENSE)
      .map((event) => event.kind)
      .sort();
  const native = buffs([]);
  assert.deepEqual(native, ['resistance', 'resolution']);
  assert.deepEqual(
    buffs([TRAIT.SHARED_WISDOM], patched({ [CONDUIT.sharedWisdom]: remove('boon', 'beguiling-haze') })).filter(
      (kind) => !native.includes(kind)
    ),
    ['stability', 'swiftness']
  );
  assert.deepEqual(
    buffs([TRAIT.SHARED_WISDOM], patched({ [CONDUIT.sharedWisdom]: remove('boon', 'gladiators-defense') })),
    ['resistance', 'resolution', 'swiftness']
  );
});

test("Gladiator's Defense uses live Stability tuning only for successful casts", () => {
  // The declaration selects one trait reward; cancellation suppresses it and the ordinary skill packets.
  for (const cancelled of [false, true]) {
    const result = runRevenant(
      [{ name: "Gladiator's Defense", ...(cancelled ? { interruptMs: 0 } : {}) }],
      {
        specialization: 'Conduit',
        selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
        startingLegend: LEGEND.ENTITY,
        selectedTraitIds: [TRAIT.SHARED_WISDOM],
        initialEnergy: 100
      },
      {
        catalog: patched({
          [CONDUIT.sharedWisdom]: { effects: [{ type: 'boon', name: 'gladiators-defense', stacks: 2 }] }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const packets = result.events.filter((event) => event.skillId === ID.GLADIATORS_DEFENSE);
    assert.deepEqual(
      packets.filter((event) => event.type === 'buff' && event.kind === 'stability').map((event) => event.stacks),
      cancelled ? [] : [2]
    );
    assert.equal(
      packets.some((event) => event.type === 'damage'),
      !cancelled
    );
    assert.equal(
      packets.some((event) => event.type === 'condition' && event.condition === 'Weakness'),
      !cancelled
    );
  }
});

test('Twin Moon Sweep selects patchable Shared Wisdom Might independently of target hits', () => {
  // Both identities share the variant; removed base strikes must not remove the independently authored trait boon.
  for (const skillId of [ID.TWIN_MOON_SWEEP, ID.TWIN_MOON_SWEEP_ID_77001]) {
    for (const mode of ['selected', 'unselected', 'removed', 'cancelled']) {
      const result = runRevenant(
        [
          { skillId, offTarget: true, ...(mode === 'cancelled' ? { interruptMs: 0 } : {}) },
          { type: 'wait', durationMs: 1000 }
        ],
        {
          specialization: 'Conduit',
          selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
          startingLegend: LEGEND.ENTITY,
          selectedTraitIds: mode === 'unselected' ? [] : [TRAIT.SHARED_WISDOM],
          initialEnergy: 100
        },
        {
          catalog: (catalog) =>
            withSkill(
              patched({
                [CONDUIT.sharedWisdom]:
                  mode === 'removed'
                    ? remove('boon', 'twin-moon-sweep')
                    : {
                        effects: [
                          {
                            type: 'boon',
                            name: 'twin-moon-sweep',
                            stacks: 7,
                            applications: 3,
                            intervalMs: 100
                          }
                        ]
                      }
              })(catalog),
              skillId,
              {
                effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 1, atMs: 300, timingAnchor: 'castStart' }]
              }
            )
        }
      );
      const might = result.events.filter(
        (event) => event.type === 'buff' && event.metadata?.trigger === 'twin-moon-sweep'
      );
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(
        might.map((event) => [event.at, event.stacks]),
        mode === 'selected'
          ? [
              [0.3, 7],
              [0.4, 7],
              [0.5, 7]
            ]
          : []
      );
      assert.equal(observedRuntime(result).profession.specialization.state.affinity, 0);
    }
  }
});

test('a missing required Revenant profile fails in the selected catalog', () => {
  assert.throws(
    () =>
      runRevenant(
        ['Swap Weapons'],
        { ...RENEGADE_CONFIG, selectedTraitIds: [TRAIT.INCENSED_RESPONSE] },
        {
          catalog: (catalog) => ({ ...catalog, balanceProfilesById: new Map() })
        }
      ),
    /Invalid balance data: .*missing required profile/
  );
});

// Flat siphons and ordinary damage share the trait profile even though they resolve through different paths.
test('Ferocious Aggression uses its patched value for life steal and ordinary damage', () => {
  const config = { selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION], boons: { fury: true } };
  const catalog = patched({ [TRAIT.FEROCIOUS_AGGRESSION]: { fields: { damageIncrease: 0.3 } } })(revenantCatalog);
  const context = { config, catalog, time: 0, event: { at: 0, actorType: 'player' } };
  assert.equal(revenantLifeSiphonBonus(context, { at: 0, flatStrikeBase: 100, damageKind: 'life-steal' }), 0.3);
  assert.equal(revenantProfession.resolveProfession(config).modifyStrikeDamage(context, 100), 130);
  assert.equal(revenantProfession.resolveProfession(config).modifyConditionDamage(context, 100), 130);
});

test('Kinetic Insight patches virtual affinity without changing stored affinity', () => {
  let affinity;
  const result = runRevenant(
    [],
    { specialization: 'Conduit', selectedTraitIds: [TRAIT.KINETIC_INSIGHT] },
    {
      catalog: patched({ [TRAIT.KINETIC_INSIGHT]: { fields: { resourceGain: 3 } } }),
      initialize(runtime) {
        runtime.profession.specialization.state.affinity = 1;
        affinity = effectiveConduitAffinity(runtime);
      }
    }
  );
  assert.equal(affinity, 4);
  assert.equal(observedRuntime(result).profession.specialization.state.affinity, 1);
});

test('Core Value adds its patched extension to Dragon True Nature', () => {
  const result = runRevenant(
    ['Facet of Nature', ID.TRUE_NATURE_DRAGON],
    {
      specialization: 'Herald',
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      selectedTraitIds: [TRAIT.CORE_VALUE]
    },
    { catalog: patched({ [TRAIT.CORE_VALUE]: { fields: { duration: 4 } } }) }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.find((event) => event.type === 'boon_extension').duration, 6);
});
