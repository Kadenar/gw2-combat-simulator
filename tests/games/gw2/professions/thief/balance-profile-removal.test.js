import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { thiefProfession, thiefCatalog } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import { SPECTER_BALANCE_PROFILE_IDS as SPECTER } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as ANTIQUARY } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS as DEADEYE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { createLiveProfessionSimulator, runtimeFor } from '#tests/helpers/live-runtime.js';
import { thiefInitiativeRegenerationRate } from '#gw2/professions/thief/core/live-resources.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';

// Small rotations exercise patched scheduler/resolver contracts without benchmark snapshots.
function run(balanceProfiles, specialization, rotation, config = {}) {
  const profession = withPatchPreview(thiefProfession, {
    id: 'thief-removal',
    label: 'Thief removal',
    professions: { thief: { balanceProfiles } }
  });
  const simulate = createLiveProfessionSimulator(profession, {
    patchId: 'thief-removal',
    selectedTraitIds: [],
    selectedSkills: [],
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    stats: { power: 2000, precision: 4000, conditionDamage: 1000, expertise: 0 },
    target: { armor: 2597, defiant: true, conditions: {} }
  });
  const result = simulate(specialization, rotation, config, { kind: 'tail', durationMs: 1500 });
  assert.deepEqual(result.warnings, []);
  return result;
}

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const packet = (result, type, sourceId) =>
  result.events.filter((event) => event.type === type && event.sourceId === sourceId);

test('Shade Step tooltips omit a removed boon without relabeling a surviving one', () => {
  const profession = withPatchPreview(thiefProfession, {
    id: 'thief-tooltip-removal',
    label: 'Thief tooltip removal',
    professions: { thief: { balanceProfiles: { [SPECTER.shadeStep]: remove('boon', 'alacrity') } } }
  });
  const context = profession.balanceContextFor('thief-tooltip-removal');
  const describe = (id) => describeSimulationSkill(context, context.catalog.skillsById.get(id), thiefTooltips);
  const grasping = JSON.stringify(describe(ID.GRASPING_SHADOWS));
  assert.doesNotMatch(grasping, /Alacrity|Protection|Aegis/i);
  assert.match(JSON.stringify(describe(ID.DAWNS_REPOSE)), /protection/i);
});

test('Shade Step retains skill identities and surviving edits after removing its first boon', () => {
  const result = run(
    {
      [SPECTER.shadeStep]: {
        ...remove('boon', 'alacrity'),
        effects: [{ type: 'boon', name: 'protection', duration: { from: 5, to: 7 } }]
      }
    },
    'Specter',
    ['Enter Shadow Shroud', 'Grasping Shadows', "Dawn's Repose", 'Mind Shock'],
    {
      initialShadowForce: 100,
      selectedTraitIds: [TRAIT.SHADESTEP]
    }
  );
  const boons = packet(result, 'buff', TRAIT.SHADESTEP);
  assert.equal(
    boons.some((event) => event.skillId === ID.GRASPING_SHADOWS),
    false
  );
  assert.equal(boons.find((event) => event.skillId === ID.DAWNS_REPOSE).kind, 'protection');
  assert.equal(boons.find((event) => event.skillId === ID.DAWNS_REPOSE).duration, 7);
  assert.equal(boons.find((event) => event.skillId === ID.MIND_SHOCK).kind, 'aegis');
});

for (const id of [SPECTER.enterShadowShroud, SPECTER.dawnsReposeBarrier]) {
  test(`${id} removal suppresses barrier reactions while shroud remains active`, () => {
    const result = run(
      {
        [SPECTER.enterShadowShroud]: remove('buff', 'barrier'),
        ...(id === SPECTER.dawnsReposeBarrier ? { [id]: remove('buff', 'barrier') } : {})
      },
      'Specter',
      ['Enter Shadow Shroud', ...(id === SPECTER.dawnsReposeBarrier ? ["Dawn's Repose"] : [])],
      {
        initialShadowForce: 100,
        allies: { count: 4, strikesPerSecond: 2 },
        selectedTraitIds: [TRAIT.SHADESTEP]
      }
    );
    assert.equal(
      result.events.some((event) => event.kind === 'barrier'),
      false
    );
    assert.equal(
      result.events.some((event) => event.skillId === TRAIT.DARK_SENTRY),
      false
    );
    assert.equal(result.planningState.profession.shadowShroudActive, true);
    assert.ok(result.planningState.profession.shadowClock.value < 100);
    if (id === SPECTER.dawnsReposeBarrier) assert.ok(packet(result, 'buff', TRAIT.SHADESTEP).length);
  });
}

for (const [type, name] of [
  ['buff', 'rot-wallow-venom'],
  ['condition', 'Torment']
]) {
  test(`Dark Sentry ${type} removal respects venom ownership`, () => {
    const result = run({ [SPECTER.darkSentry]: remove(type, name) }, 'Specter', ['Enter Shadow Shroud'], {
      initialShadowForce: 100,
      allies: { count: 1, strikesPerSecond: 2 }
    });
    assert.equal(
      result.events.some((event) => event.kind === 'rot-wallow-venom'),
      type !== 'buff'
    );
    assert.equal(
      result.events.some((event) => event.type === 'condition' && event.skillId === TRAIT.DARK_SENTRY),
      false
    );
    assert.equal(
      Object.keys(runtimeFor(result).profession.specialization.state.darkSentryReadyAtByAlly).length > 0,
      type !== 'buff'
    );
  });
}

test('removed Larcenous Torment strike preserves its independent shadow-force gain', () => {
  const result = run(
    { [SPECTER.larcenousTorment]: remove('strike', 'Larcenous Torment') },
    'Specter',
    ['Twilight Combo'],
    {
      primaryWeapon: 'Scepter',
      selectedTraitIds: [TRAIT.LARCENOUS_TORMENT],
      initialShadowForce: 0
    }
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.LARCENOUS_TORMENT),
    false
  );
  assert.ok(result.planningState.profession.shadowClock.value > 4);
});

test('core steal removals preserve sibling conditions, boons, and initiative', () => {
  const result = run(
    {
      [CORE.hiddenThief]: remove('condition', 'Blindness'),
      [CORE.bountifulTheft]: remove('boon', 'Vigor'),
      [CORE.mug]: remove('strike', 'Mug'),
      [CORE.sleightOfHand]: remove('control', 'daze')
    },
    'Core',
    ['Steal'],
    {
      initialInitiative: 0,
      selectedTraitIds: [
        TRAIT.HIDDEN_THIEF,
        TRAIT.BOUNTIFUL_THEFT,
        TRAIT.MUG,
        TRAIT.KLEPTOMANIAC,
        TRAIT.SLEIGHT_OF_HAND
      ]
    }
  );
  const conditions = packet(result, 'condition', TRAIT.HIDDEN_THIEF);
  assert.equal(
    conditions.some((event) => event.condition === 'Blindness'),
    false
  );
  assert.ok(conditions.some((event) => event.condition === 'Weakness'));
  assert.equal(
    result.events.some((event) => event.kind === 'Vigor'),
    false
  );
  assert.ok(result.events.some((event) => event.kind === 'Might'));
  assert.equal(packet(result, 'damage', TRAIT.MUG).length, 0);
  assert.equal(packet(result, 'control', TRAIT.SLEIGHT_OF_HAND).length, 0);
  assert.ok(result.planningState.profession.initiative.value >= 2);
});

test('Uncatchable conditions own independent pulses and dodge still spends endurance', () => {
  const result = run({ [CORE.uncatchable]: remove('condition', 'Bleeding') }, 'Core', ['Dodge'], {
    selectedTraitIds: [TRAIT.UNCATCHABLE]
  });
  const conditions = packet(result, 'condition', TRAIT.UNCATCHABLE);
  assert.equal(
    conditions.some((event) => event.condition === 'Bleeding'),
    false
  );
  assert.ok(conditions.some((event) => event.condition === 'Crippled'));
  assert.ok(result.planningState.profession.endurance < 100);
});

test('removed Weakening Strikes does not arm its grant or expiry', () => {
  const result = run({ [TRAIT.WEAKENING_STRIKES]: remove('condition', 'Weakness') }, 'Daredevil', ['Dodge'], {
    selectedTraitIds: [TRAIT.WEAKENING_STRIKES]
  });
  assert.equal(result.planningState.profession.weakeningStrikeReady, false);
  assert.equal(result.planningState.profession.weakeningStrikeExpiresAt, 0);
});

test('removed critical Fury leaves proc progress and cooldown unclaimed', () => {
  const result = run({ [CORE.unrelentingStrikes]: remove('boon', 'Fury') }, 'Core', ['Double Strike'], {
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES]
  });
  assert.equal(packet(result, 'buff', TRAIT.UNRELENTING_STRIKES).length, 0);
  assert.equal(runtimeFor(result).profession.core.traitProcReadyAt[TRAIT.UNRELENTING_STRIKES], undefined);
  assert.equal(runtimeFor(result).profession.core.traitProcProgress[TRAIT.UNRELENTING_STRIKES], undefined);
});

test('Malicious Sneak Attack removal preserves Bleeding and malice spending', () => {
  const result = run(
    { [DEADEYE.maliciousSneakAttack]: remove('condition', 'Torment') },
    'Deadeye',
    ["Deadeye's Mark", 'Hide in Shadows', 'Malicious Sneak Attack'],
    {
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Pistol',
      selectedSkills: ['Hide in Shadows'],
      initialMalice: 5
    }
  );
  const conditions = result.events.filter(
    (event) => event.type === 'condition' && event.skillId === ID.MALICIOUS_SNEAK_ATTACK
  );
  assert.equal(
    conditions.some((event) => event.condition === 'Torment'),
    false
  );
  assert.ok(conditions.some((event) => event.condition === 'Bleeding'));
  assert.equal(result.planningState.profession.malice, 0);
});

for (const id of [ANTIQUARY.forgedSurfer, ANTIQUARY.forgedSurferMeticulous]) {
  test(`${id} keeps Bomb edits when Dash is removed`, () => {
    const base = id === ANTIQUARY.forgedSurfer ? 1.2 : 1.4;
    const result = run(
      {
        [id]: {
          ...remove('strike', 'Dash'),
          effects: [{ type: 'strike', name: 'Bomb', coefficient: { from: base, to: 2 } }]
        }
      },
      'Antiquary',
      ['Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 5000 }],
      {
        selectedTraitIds: id === ANTIQUARY.forgedSurfer ? [] : [TRAIT.METICULOUS_CUSTODIAN],
        deterministicChoices: { forgedSurferBombsHit: 1 }
      }
    );
    const strikes = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.FORGED_SURFER_DASH);
    assert.ok(strikes.length);
    assert.ok(strikes.every((event) => event.coefficient === 2));
    assert.ok(result.events.some((event) => event.type === 'condition' && event.skillId === ID.FORGED_SURFER_DASH));
    assert.equal(result.planningState.profession.artifactUsesRemaining, 0);
  });
}

for (const type of ['strike', 'condition']) {
  test(`Cannon success independently removes ${type}`, () => {
    const result = run(
      { [ANTIQUARY.cannonSuccess]: remove(type, type === 'strike' ? 'Stone Summit Cannon - Success' : 'Burning') },
      'Antiquary',
      ['Stone Summit Cannon'],
      {
        selectedSkills: ['Stone Summit Cannon']
      }
    );
    const events = result.events.filter((event) => event.skillId === ID.STONE_SUMMIT_CANNON);
    assert.equal(
      events.some((event) => event.type === 'damage'),
      type !== 'strike'
    );
    assert.equal(
      events.some((event) => event.type === 'condition'),
      type !== 'condition'
    );
  });
}

test('Possessive Hoarder removal preserves Alacrity without substituting Protection', () => {
  const result = run(
    { [ANTIQUARY.possessiveHoarder]: remove('boon', 'might') },
    'Antiquary',
    ['Skritt Swipe', 'Mistburn Mortar'],
    {
      selectedTraitIds: [TRAIT.POSSESSIVE_HOARDER]
    }
  );
  const boons = packet(result, 'buff', 'Possessive Hoarder');
  assert.ok(boons.some((event) => event.kind === 'alacrity'));
  assert.equal(
    boons.some((event) => ['might', 'protection'].includes(event.kind)),
    false
  );
});

test('Mistburn removal suppresses its charge grant while spending the artifact', () => {
  const result = run({ [ANTIQUARY.mistburnProc]: remove('condition', 'Burning') }, 'Antiquary', [
    'Skritt Swipe',
    'Mistburn Mortar'
  ]);
  assert.equal(result.planningState.profession.mistburn.charges, 0);
  assert.equal(result.planningState.profession.artifactUsesRemaining, 0);
});

test('required Thief tuning fails contextually and accepts a real zero', () => {
  const catalog = {
    ...thiefCatalog,
    balanceProfilesById: new Map(thiefCatalog.balanceProfilesById),
    balanceDataContext: { professionId: 'thief', patchId: 'invalid-thief' }
  };
  const context = { catalog, config: { selectedTraitIds: [TRAIT.MUG] } };
  // Resolved profiles carry their own source, so diagnostics need no runtime context.
  const { balanceDataContext } = catalog;
  for (const value of [undefined, null, '1', NaN, Infinity]) {
    catalog.balanceProfilesById.set(CORE.resources, {
      ...thiefCatalog.balanceProfilesById.get(CORE.resources),
      resourceGain: value,
      balanceDataContext
    });
    assert.throws(
      () => thiefInitiativeRegenerationRate({ kneeling: false }, context),
      /profession=thief patch=invalid-thief profile=thief.core.resources field=resourceGain/
    );
    // The live steal reads the selected Mug packet when the steal completes.
    assert.throws(
      () =>
        runThief(
          ['Steal'],
          { selectedTraitIds: [TRAIT.MUG] },
          {
            catalog: (live) =>
              withProfile(live, CORE.mug, {
                effects: [{ type: 'strike', name: 'Mug', coefficient: value, hits: 1 }],
                balanceDataContext
              })
          }
        ),
      /profession=thief patch=invalid-thief balance-profile=.*effect=strike\/Mug/
    );
  }

  catalog.balanceProfilesById.set(CORE.resources, {
    ...thiefCatalog.balanceProfilesById.get(CORE.resources),
    resourceGain: 0
  });
  assert.equal(thiefInitiativeRegenerationRate({ kneeling: false }, context), 0);
  catalog.balanceProfilesById.delete(CORE.resources);
  assert.throws(
    () => thiefInitiativeRegenerationRate({ kneeling: false }, context),
    /missing required profile\/catalog/
  );
});
