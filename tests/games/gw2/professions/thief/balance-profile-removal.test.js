import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { describeSimulationSkill, describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import {
  createObservedProfessionSimulator,
  observeGw2Runtime,
  observedRuntime
} from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Small rotations exercise patched scheduler/resolver contracts without benchmark snapshots.
function run(balanceProfiles, specialization, rotation, config = {}, skills = {}) {
  const profession = withPatchPreview(thiefProfession, {
    id: 'thief-removal',
    label: 'Thief removal',
    professions: { thief: { balanceProfiles, skills } }
  });
  const simulate = createObservedProfessionSimulator(profession, {
    patchId: 'thief-removal',
    selectedTraitIds: [],
    selectedSkillIds: [],
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    attributeInputs: baseAttributeInputs({ power: 2000, precision: 4000, conditionDamage: 1000, expertise: 0 }),
    target: { armor: 2597, defiant: true, conditions: {} }
  });
  const result = simulate(specialization, rotation, config, { kind: 'tail', durationMs: 1500 });
  assert.deepEqual(result.warnings, []);
  return result;
}

// Skill fixtures patch their canonical owner; trait fixtures retain generated profile targets.
const runSkills = (skills, specialization, rotation, config = {}) => run({}, specialization, rotation, config, skills);

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const packet = (result, type, sourceId) =>
  result.events.filter((event) => event.type === type && event.sourceId === sourceId);

test('Shade Step tooltips omit a removed boon without relabeling a surviving one', () => {
  const profession = withPatchPreview(thiefProfession, {
    id: 'thief-tooltip-removal',
    label: 'Thief tooltip removal',
    professions: { thief: { balanceProfiles: { [TRAIT.SHADESTEP]: remove('boon', 'alacrity') } } }
  });
  const context = profession.resolvePatch({ id: 'thief-tooltip-removal' }).balanceContext;
  const describe = (id) => describeSimulationSkill(context, context.catalog.skillsById.get(id), thiefTooltips);
  const grasping = JSON.stringify(describe(ID.GRASPING_SHADOWS));
  assert.doesNotMatch(grasping, /Alacrity|Protection|Aegis/i);
  assert.match(JSON.stringify(describe(ID.DAWNS_REPOSE)), /protection/i);
});

test('Shade Step retains skill identities and surviving edits after removing its first boon', () => {
  const result = run(
    {
      [TRAIT.SHADESTEP]: {
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

for (const id of [ID.ENTER_SHADOW_SHROUD, ID.DAWNS_REPOSE]) {
  test(`${id} removal suppresses barrier reactions while shroud remains active`, () => {
    const result = runSkills(
      {
        [ID.ENTER_SHADOW_SHROUD]: { sideEffects: { barrier: remove('buff', 'barrier') } },
        ...(id === ID.DAWNS_REPOSE ? { [id]: { sideEffects: { barrier: remove('buff', 'barrier') } } } : {})
      },
      'Specter',
      ['Enter Shadow Shroud', ...(id === ID.DAWNS_REPOSE ? ["Dawn's Repose"] : [])],
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

    if (id === ID.DAWNS_REPOSE) assert.ok(packet(result, 'buff', TRAIT.SHADESTEP).length);
  });
}

for (const [type, name] of [
  ['buff', 'rot-wallow-venom'],
  ['condition', 'Torment']
]) {
  test(`Dark Sentry ${type} removal respects venom ownership`, () => {
    const result = run({ [TRAIT.DARK_SENTRY]: remove(type, name) }, 'Specter', ['Enter Shadow Shroud'], {
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
    assert.equal(observedRuntime(result).procs.deadline('thief.specter.darkSentry:1') > 0, type !== 'buff');
  });
}

test('removed Larcenous Torment strike preserves its independent shadow-force gain', () => {
  const result = run(
    { [TRAIT.LARCENOUS_TORMENT]: remove('strike', 'Larcenous Torment') },
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
      [TRAIT.HIDDEN_THIEF]: remove('condition', 'Blindness'),
      [TRAIT.BOUNTIFUL_THEFT]: remove('boon', 'Vigor'),
      [TRAIT.MUG]: remove('strike', 'Mug'),
      [TRAIT.SLEIGHT_OF_HAND]: remove('control', 'daze')
    },
    'Core',
    [{ type: 'cast', skillId: 13014 }],
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
    result.events.some((event) => event.kind === 'vigor'),
    false
  );
  assert.ok(result.events.some((event) => event.kind === 'might'));
  assert.equal(packet(result, 'damage', TRAIT.MUG).length, 0);
  assert.equal(packet(result, 'control', TRAIT.SLEIGHT_OF_HAND).length, 0);
  assert.ok(result.planningState.profession.initiative.value >= 2);
});

test('Uncatchable conditions own independent pulses and dodge still spends endurance', () => {
  const result = runThief(
    ['Dodge'],
    { selectedTraitIds: [TRAIT.UNCATCHABLE] },
    {
      observation: { kind: 'tail', durationMs: 1500 },
      catalog: (catalog) =>
        applySkillPatch(catalog, { skills: { [ID.LESSER_CALTROPS]: remove('condition', 'Bleeding') } })
    }
  );
  assert.deepEqual(result.warnings, []);
  const conditions = packet(result, 'condition', TRAIT.UNCATCHABLE);
  assert.equal(
    conditions.some((event) => event.condition === 'Bleeding'),
    false
  );
  assert.ok(conditions.some((event) => event.condition === 'Crippled'));
  assert.ok(result.planningState.profession.endurance.value < 100);
});

test('removed Weakening Strikes does not arm its grant or expiry', () => {
  const result = run({ [TRAIT.WEAKENING_STRIKES]: remove('condition', 'Weakness') }, 'Daredevil', ['Dodge'], {
    selectedTraitIds: [TRAIT.WEAKENING_STRIKES]
  });
  assert.equal(result.planningState.profession.weakeningStrikeReady, false);
  assert.equal(result.planningState.profession.weakeningStrikeExpiresAt, 0);
});

test('removed critical Fury leaves its cooldown unclaimed', () => {
  const result = run({ [TRAIT.UNRELENTING_STRIKES]: remove('boon', 'Fury') }, 'Core', ['Double Strike'], {
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES]
  });
  assert.equal(packet(result, 'buff', TRAIT.UNRELENTING_STRIKES).length, 0);
  assert.equal(observedRuntime(result).procs.deadline(TRAIT.UNRELENTING_STRIKES), 0);
});

test('Malicious Sneak Attack removal preserves Bleeding and malice spending', () => {
  const result = runSkills(
    { [ID.MALICIOUS_SNEAK_ATTACK]: { sideEffects: { malice: remove('condition', 'Torment') } } },
    'Deadeye',
    ["Deadeye's Mark", 'Hide in Shadows', 'Malicious Sneak Attack'],
    {
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Pistol',
      selectedSkillIds: [13027],
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
  assert.equal(result.planningState.profession.malice.value, 0);
});

for (const enhanced of [false, true]) {
  test(`${enhanced} keeps Bomb edits when Dash is removed`, () => {
    const base = !enhanced ? 1.2 : 1.4;
    const result = runSkills(
      {
        [ID.FORGED_SURFER_DASH]: {
          sideEffects: {
            surfer: {
              ...remove('strike', enhanced ? 'Meticulous Dash' : 'Dash'),
              effects: [
                { type: 'strike', name: enhanced ? 'Meticulous Bomb' : 'Bomb', coefficient: { from: base, to: 2 } }
              ]
            }
          }
        }
      },
      'Antiquary',
      ['Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 5000 }],
      {
        selectedTraitIds: !enhanced ? [] : [TRAIT.METICULOUS_CUSTODIAN]
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
    const result = runSkills(
      { [ID.STONE_SUMMIT_CANNON]: remove(type, type === 'strike' ? 'Stone Summit Cannon - Success' : 'Burning') },
      'Antiquary',
      [{ type: 'cast', skillId: 76725 }],
      {
        selectedSkillIds: [76725]
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
    { [TRAIT.POSSESSIVE_HOARDER]: remove('boon', 'might') },
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
  const result = runSkills(
    { [ID.MISTBURN_MORTAR]: { sideEffects: { charged: remove('condition', 'Burning') } } },
    'Antiquary',
    ['Skritt Swipe', 'Mistburn Mortar']
  );
  assert.equal(result.planningState.profession.mistburn.charges, 0);
  assert.equal(result.planningState.profession.artifactUsesRemaining, 0);
});

test('invalid Mug tuning fails with the selected patch context', () => {
  const balanceDataContext = { professionId: 'thief', patchId: 'invalid-thief' };
  for (const value of [undefined, null, '1', NaN, Infinity]) {
    // Invalid Mug packets fail at the override boundary before a live steal can consume them.
    assert.throws(
      () =>
        runThief(
          [{ type: 'cast', skillId: 13014 }],
          { selectedTraitIds: [TRAIT.MUG] },
          {
            catalog: (live) =>
              withProfile(live, TRAIT.MUG, {
                effects: [{ type: 'strike', name: 'Mug', coefficient: value, hits: 1 }],
                balanceDataContext
              })
          }
        ),
      /profession=thief patch=invalid-thief balance-profile=.*effect=strike\/Mug/
    );
  }
});

// Each selected trait owns its capacity; untraited initiative uses the fixed base maximum.
test('patched Preparedness and Maleficent Seven capacities initialize before resource use', () => {
  for (const selectedTraitIds of [[], [TRAIT.PREPAREDNESS, TRAIT.MALEFICENT_SEVEN]]) {
    const result = run(
      {
        [TRAIT.PREPAREDNESS]: { fields: { maximumStacks: 21 } },
        [TRAIT.DEADEYES_GAZE]: { fields: { maximumStacks: 9 } },
        [TRAIT.MALEFICENT_SEVEN]: { fields: { maximumStacks: 11 } }
      },
      'Deadeye',
      [],
      { selectedTraitIds, initialInitiative: 20 }
    );
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.core.initiative.maximum, selectedTraitIds.length ? 21 : 12);
    assert.equal(runtime.profession.core.initiative.value, selectedTraitIds.length ? 21 : 12);
    assert.equal(runtime.profession.specialization.state.malice.maximum, selectedTraitIds.length ? 11 : 9);
  }
});

// Construction, resource admission, and presentation must agree before regeneration can hide a stale starting cap.
test('Preparedness owns patched initiative capacity in initial state, live resources, and tooltips', () => {
  const family = withPatchPreview(thiefProfession, {
    id: 'preparedness-capacity',
    label: 'Preparedness capacity',
    professions: {
      thief: {
        balanceProfiles: {
          [TRAIT.PREPAREDNESS]: { fields: { maximumStacks: 21 } }
        }
      }
    }
  });
  for (const [patchId, untraited, traited] of [
    ['current', 12, 15],
    ['preparedness-capacity', 12, 21]
  ]) {
    const balanceContext = family.resolvePatch({ id: patchId }).balanceContext;
    const { facts } = describeSimulationTrait(balanceContext, { id: TRAIT.PREPAREDNESS }, thiefTooltips);
    assert.equal(facts.find(({ name }) => name === 'Maximum initiative with Preparedness').detail, String(traited));
    assert.equal(
      facts.find(({ name }) => name === 'Maximum initiative without Preparedness').detail,
      String(untraited)
    );
    for (const selected of [false, true]) {
      const maximum = selected ? traited : untraited;
      for (const initialInitiative of [4, 100]) {
        const config = {
          specialization: 'Core',
          patchId,
          selectedTraitIds: selected ? [TRAIT.PREPAREDNESS] : [],
          initialInitiative
        };
        const profession = family.runtimeFor(config);
        const state = profession.createState(config);
        assert.equal(state.core.initiative.maximum, maximum);
        assert.equal(state.core.initiative.value, Math.min(initialInitiative, maximum));
        const result = observeGw2Runtime({ profession, config, rotation: [] });
        const initiative = observedRuntime(result).profession.core.initiative;
        assert.equal(initiative.maximum, maximum);
        assert.equal(initiative.value, Math.min(initialInitiative, maximum));
        assert.deepEqual(result.warnings, []);
      }
    }
  }
});
