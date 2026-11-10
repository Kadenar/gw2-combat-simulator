import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createModifierHooks } from '#gw2/platform/combat/modifiers.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { mesmerCoreModule } from '#gw2/professions/mesmer/core/module.js';
import { cryOfPainConfusion } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { chronomancerModule } from '#gw2/professions/mesmer/specializations/chronomancer/module.js';
import { mesmerSelectedAmbush } from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush.js';
import { mesmerSelectedInstrument } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-projection.js';
import { troubadourModule } from '#gw2/professions/mesmer/specializations/troubadour/module.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Intrinsic skills have one patch owner; fixed clone capacity needs no balance profile.
test('Mesmer catalog removes skill profiles and assigns intrinsic specialization policy to traits', () => {
  for (const id of [TRAIT.PSYCHIC_BLADES, TRAIT.WANDERING_MINSTREL, TRAIT.MIRAGE_CLOAK])
    assert.ok(mesmerCatalog.balanceProfilesById.has(id));
  for (const id of [
    'mesmer.core.resources',
    'mesmer.core.mimic',
    'mesmer.virtuoso.bladesong-sorrow',
    'mesmer.troubadour.crescendo'
  ])
    assert.throws(
      () => applyBalanceProfilePatch(mesmerCatalog, { balanceProfiles: { [id]: { fields: { duration: 1 } } } }),
      /unknown balance profile/
    );
});

// Removing a component cannot make a different authored attack become the instrument's afterimage payload.
test('instrument projection retains named strike ownership while Harp intentionally owns no strike', () => {
  const catalog = applySkillPatch(mesmerCatalog, {
    skills: {
      [ID.FLUSTERING_FLUTE]: {
        removeEffects: [{ type: 'strike', name: 'Strike' }],
        addEffects: [{ type: 'strike', name: 'Separate attack', coefficient: 9, hits: 1 }]
      }
    }
  });
  const flute = mesmerSelectedInstrument(catalog, ID.FLUSTERING_FLUTE);
  assert.equal(flute.type, undefined);
  assert.ok(flute.conditions.some(({ condition }) => condition === 'Confusion'));
  assert.equal(mesmerSelectedInstrument(catalog, ID.HARMONIOUS_HARP).type, undefined);
});

// Selected strike and status components remain independently removable for player and clone consumers.
test('ambush projection does not restore removed Vulnerability or replace its named player strike', () => {
  const catalog = applySkillPatch(mesmerCatalog, {
    skills: {
      [ID.SPLIT_SURGE]: {
        removeEffects: [
          { type: 'strike', name: 'Player attack' },
          { type: 'condition', name: 'Vulnerability' }
        ],
        addEffects: [{ type: 'strike', name: 'Separate attack', coefficient: 9, hits: 1 }]
      }
    }
  });
  const ambush = mesmerSelectedAmbush(catalog, ID.SPLIT_SURGE);
  assert.equal(ambush.player.type, undefined);
  assert.equal(ambush.clone.type, 'strike');
  assert.equal(ambush.vulnerability, undefined);
  assert.ok(ambush.player.boons.length > 0);
});

// Ordinary skill additions default to the player and must not disappear while filtering clone templates.
test('Mirage player ambush retains ordinary added effects without an explicit source', () => {
  const profession = withPatchPreview(mesmerProfession, {
    id: 'ambush-owner',
    label: 'Ambush owner',
    professions: {
      mesmer: {
        skills: { [ID.SPLIT_SURGE]: { addEffects: [{ type: 'boon', boon: 'protection', duration: 4, stacks: 1 }] } }
      }
    }
  });
  const result = runMesmer(
    ['Dodge / Mirage Cloak', 'Split Surge'],
    {
      ...createDefaultConfig(),
      patchId: 'ambush-owner',
      specialization: 'Mirage',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 0,
      selectedTraitIds: []
    },
    { profession }
  );
  const context = profession.resolvePatch({ id: 'ambush-owner' }).balanceContext;
  const protection = mesmerTooltips.skills[ID.SPLIT_SURGE](
    context,
    context.catalog.skillsById.get(ID.SPLIT_SURGE)
  ).facts.find(({ name }) => name === 'Protection');
  assert.equal(protection.applications, 1);
  assert.deepEqual(result.warnings, []);
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.kind === 'protection' && event.skillId === ID.SPLIT_SURGE
    )
  );
});

// Flute's specialization override changes only its player's Confusion; ordinary Cry of Pain stays trait-owned.
test('Flute Cry of Pain fields preserve separate trait and skill tuning', () => {
  const catalog = applySkillPatch(mesmerCatalog, {
    skills: {
      [ID.FLUSTERING_FLUTE]: {
        fields: { cryOfPainAdditionalStacks: 4, cryOfPainDurationMultiplier: 1 }
      }
    }
  });
  const context = { catalog, traits: new Set([TRAIT.CRY_OF_PAIN]) };
  const condition = { type: 'condition', condition: 'Confusion', stacks: 3, duration: 6 };
  const flute = catalog.skillsById.get(ID.FLUSTERING_FLUTE);
  assert.deepEqual(cryOfPainConfusion(context.catalog, context, condition, flute), {
    ...condition,
    stacks: 7,
    duration: 12
  });
  assert.deepEqual(cryOfPainConfusion(context.catalog, context, condition), { ...condition, stacks: 4, duration: 8 });
});

// The selected signet's cadence and amount feed the existing ready-only resource scheduler.
test('Signet of Illusions skill fields control passive resource generation', () => {
  const profession = withPatchPreview(mesmerProfession, {
    id: 'signet-owner',
    label: 'Signet owner',
    professions: {
      mesmer: { skills: { [ID.SIGNET_OF_ILLUSIONS]: { fields: { pulseInterval: 1, resourceGain: 2 } } } }
    }
  });
  const result = runMesmer(
    ['Ether Bolt', { type: 'wait', durationMs: 700 }],
    {
      ...createDefaultConfig(),
      patchId: 'signet-owner',
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: '',
      initialResource: 0,
      selectedTraitIds: [],
      selectedSkillIds: [ID.SIGNET_OF_ILLUSIONS]
    },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.RESOURCE], 2);
});

// Both repeat builders must retain the accepted factor while ordinary attacks and non-phantasm actors stay neutral.
test('Chronophantasma owns captured repeat damage across phantasm packet builders', () => {
  const hooks = createModifierHooks({
    rules: chronomancerModule.modifiers.modifierRules.filter(({ id }) => id === 'mesmer.chronophantasma-repeat')
  });
  for (const [skill, primaryWeapon, secondaryWeapon] of [
    ['Phantasmal Swordsman', 'Sword', 'Sword'],
    ['Phantasmal Lancer', 'Spear', '']
  ]) {
    const run = (factor) => {
      const profession = withPatchPreview(mesmerProfession, {
        id: 'repeat-owner',
        label: 'Repeat owner',
        professions: {
          mesmer: {
            balanceProfiles: { [TRAIT.CHRONOPHANTASMA]: { fields: { damageMultiplier: factor } } }
          }
        }
      });
      return runMesmer(
        [skill, { type: 'wait', durationMs: 15000 }],
        {
          ...createDefaultConfig(),
          patchId: 'repeat-owner',
          specialization: 'Chronomancer',
          primaryWeapon,
          secondaryWeapon,
          selectedTraitIds: [TRAIT.CHRONOPHANTASMA],
          initialResource: 0
        },
        { profession }
      );
    };

    const baseline = run(1);
    const boosted = run(1.4);
    assert.deepEqual(baseline.warnings, []);
    assert.deepEqual(boosted.warnings, []);
    const strike = (result, repeated) =>
      result.resolvedEvents.find(
        (event) =>
          event.type === 'damage' &&
          event.summonKind === 'phantasm' &&
          (event.chronophantasmaDamageFactor != null) === repeated
      );
    assert.equal(strike(boosted, false).damage, strike(baseline, false).damage);
    const repeat = strike(boosted, true);
    assert.equal(repeat.coefficient, strike(baseline, true).coefficient);
    assert.equal(repeat.chronophantasmaDamageFactor, 1.4);
    assertFlooredDamageMultiplier(repeat.damage, strike(baseline, true).damage, 1.4);
    // Changing current selection or profile cannot rewrite a bonus already accepted by this repeat.
    const context = { event: repeat, config: { selectedTraitIds: [] }, catalog: mesmerCatalog, time: repeat.at };
    assert.equal(hooks.modifyStrikeDamage(context, 100), 140);
    for (const event of [
      strike(boosted, false),
      { ...repeat, actorType: 'player' },
      { ...repeat, summonKind: 'clone' }
    ])
      assert.equal(hooks.modifyStrikeDamage({ ...context, event }, 100), 100);
  }
});

// A timeline attack delivered after instrument expiry uses the same selected snapshot as the ordinary scalar strike.
test('Crescendo owns instrument scaling and Fragmentation replacement for scalar and delayed strikes', () => {
  const hooks = createModifierHooks({
    rules: troubadourModule.modifiers.modifierRules.filter(({ id }) => id === 'mesmer.crescendo-instruments')
  });
  for (const delayed of [false, true]) {
    for (const fragmentation of [false, true]) {
      const run = (bonus) => {
        const profession = withPatchPreview(mesmerProfession, {
          id: 'crescendo-owner',
          label: 'Crescendo owner',
          professions: {
            mesmer: {
              skills: {
                [ID.CRESCENDO]: {
                  fields: { damageIncreasePerInstrument: bonus ? 0.4 : 0 },
                  ...(delayed
                    ? {
                        sideEffects: {
                          crescendo: {
                            removeEffects: [{ type: 'strike', name: 'Strike' }],
                            addEffects: [
                              {
                                type: 'strike',
                                name: 'Strike',
                                ticks: [{ atMs: 6000, coefficient: 2.25 }],
                                timingScale: 'fixed'
                              }
                            ]
                          }
                        }
                      }
                    : {})
                }
              },
              balanceProfiles: {
                [TRAIT.MASTER_OF_FRAGMENTATION]: { fields: { damageIncreasePerStack: bonus ? 0.6 : 0 } }
              }
            }
          }
        });
        return runMesmer(
          ['Flustering Flute', 'Crescendo', { type: 'wait', durationMs: 9000 }],
          {
            ...createDefaultConfig(),
            patchId: 'crescendo-owner',
            specialization: 'Troubadour',
            initialResource: 0,
            selectedTraitIds: fragmentation ? [TRAIT.MASTER_OF_FRAGMENTATION] : []
          },
          { profession }
        );
      };

      const baseline = run(false);
      const boosted = run(true);
      assert.deepEqual(baseline.warnings, []);
      assert.deepEqual(boosted.warnings, []);
      const strike = (result) =>
        result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.CRESCENDO);
      const event = strike(boosted);
      const instrument = boosted.events.find(
        (entry) => entry.type === 'mesmer.instrument' && entry.instrument === 'Flute'
      );
      assert.equal(event.at >= instrument.expiresAt, delayed);
      assert.equal(event.coefficient, 2.25);
      assert.equal(event.crescendoInstrumentCount, 1);
      assert.equal(event.crescendoEffectiveness, fragmentation ? 0.6 : 0.4);
      const factor = fragmentation ? 1.6 : 1.4;
      assertFlooredDamageMultiplier(event.damage, strike(baseline).damage, factor);
      const context = { event, config: { selectedTraitIds: [] }, time: event.at + 100, catalog: mesmerCatalog };
      assert.equal(hooks.modifyStrikeDamage(context, 100), 100 * factor);
      for (const other of [
        { ...event, skillId: ID.FLUSTERING_FLUTE },
        { ...event, actorType: 'summon', summonKind: 'afterimage' }
      ])
        assert.equal(hooks.modifyStrikeDamage({ ...context, event: other }, 100), 100);
    }
  }
});

// Spawn count is independent of damage tuning, and both cycles retain the same captured trait factor.
test('Bountiful Blades composes captured Berserker damage with Chronophantasma without scaling player hits', () => {
  const run = (factor) => {
    const profession = withPatchPreview(mesmerProfession, {
      id: 'bountiful-owner',
      label: 'Bountiful owner',
      professions: {
        mesmer: {
          balanceProfiles: { [TRAIT.BOUNTIFUL_BLADES]: { fields: { damageMultiplier: factor } } }
        }
      }
    });
    return runMesmer(
      ['Phantasmal Berserker', { type: 'wait', durationMs: 10000 }],
      {
        ...createDefaultConfig(),
        specialization: 'Chronomancer',
        patchId: 'bountiful-owner',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: '',
        initialResource: 0,
        selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES, TRAIT.CHRONOPHANTASMA]
      },
      { profession }
    );
  };

  const baseline = run(1);
  const reduced = run(0.5);
  const suppressed = run(0);
  assert.deepEqual(suppressed.warnings, []);
  const suppressedStrike = suppressed.resolvedEvents.find(
    (event) => event.type === 'damage' && event.summonKind === 'phantasm'
  );
  assert.ok(suppressedStrike.coefficient > 0);
  assert.equal(suppressedStrike.damage, 0);
  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(reduced.warnings, []);
  const hooks = createModifierHooks({
    rules: [
      ...mesmerCoreModule.modifiers.modifierRules.filter(({ id }) => id === 'mesmer.bountiful-blades-phantasm'),
      ...chronomancerModule.modifiers.modifierRules.filter(({ id }) => id === 'mesmer.chronophantasma-repeat')
    ]
  });
  for (const repeated of [false, true]) {
    const strike = (result) =>
      result.resolvedEvents.find(
        (event) =>
          event.type === 'damage' &&
          event.summonKind === 'phantasm' &&
          (event.chronophantasmaDamageFactor != null) === repeated
      );
    const event = strike(reduced);
    assert.equal(event.coefficient, strike(baseline).coefficient);
    assert.equal(event.bountifulBladesDamageFactor, 0.5);
    assertFlooredDamageMultiplier(event.damage, strike(baseline).damage, 0.5);
    const context = { event, config: { selectedTraitIds: [] }, catalog: mesmerCatalog, time: event.at + 100 };
    assert.equal(hooks.modifyStrikeDamage(context, 100), 50);
    assert.equal(hooks.modifyStrikeDamage({ ...context, event: { ...event, actorType: 'player' } }, 100), 100);
  }

  const player = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.actorType === 'player');
  assert.equal(player(reduced).damage, player(baseline).damage);
});
