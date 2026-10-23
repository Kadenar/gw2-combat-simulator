import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { captureTriggerPoint } from '#tests/helpers/trigger-points.js';
import { willbenderVirtueTriggered } from '#gw2/professions/guardian/specializations/willbender/mechanics/trigger-points.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as DH_PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { willbenderBuffPolicies } from '#gw2/professions/guardian/specializations/willbender/effect-state.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_SKILL_IDS as SKILL, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { lethalTempoParameters } from '#gw2/professions/guardian/specializations/willbender/traits/behavior.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const firebrandUi = bindFirebrandUi(guardianCatalog);

// Small rotations isolate deletion, surviving edits, and owned state without benchmark-shaped assertions.
function run(balanceProfiles, specialization, rotation, selectedTraitIds = [], extra = {}, skills = {}) {
  const profession = withPatchPreview(guardianProfession, {
    id: 'guardian-removal',
    label: 'Guardian removal',
    professions: { guardian: { balanceProfiles, skills } }
  });
  const result = createObservedProfessionSimulator(profession, {
    specialization,
    selectedTraitIds,
    patchId: 'guardian-removal',
    ...extra
  })(undefined, rotation);
  assert.deepEqual(result.warnings, []);
  return result;
}

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const has = (result, type, field, value) =>
  result.events.some((event) => event.type === type && event[field] === value);

test('Willbender window removal preserves sibling durations, flames, and activation boons', () => {
  const result = run(
    {
      'guardian.willbender.virtue-windows': {
        ...remove('buff', 'justice'),
        effects: [{ type: 'buff', name: 'resolve', duration: { from: 6, to: 2 } }]
      }
    },
    'Willbender',
    ['Rushing Justice', 'Flowing Resolve', { type: 'wait', durationMs: 1500 }],
    [TRAIT.HOLY_RECKONING]
  );
  assert.equal(result.planningState.profession.justiceUntil, 0);
  assert.equal(has(result, 'buff', 'kind', 'willbender-justice'), false);
  assert.equal(result.events.find((event) => event.type === 'buff' && event.kind === 'willbender-resolve').duration, 2);
  assert.ok(has(result, 'buff', 'kind', 'fury'));
  assert.ok(has(result, 'damage', 'skillName', 'Willbender Flames'));
});

test('Tyrant window removal never restores the base Justice duration', () => {
  const result = run(
    { [TRAIT.TYRANTS_MOMENTUM]: remove('buff', 'justice') },
    'Willbender',
    ['Rushing Justice'],
    [TRAIT.TYRANTS_MOMENTUM]
  );
  assert.equal(result.planningState.profession.justiceUntil, 0);
  assert.ok(has(result, 'buff', 'kind', 'lethal-tempo'));
});

test('Lethal Tempo removal suppresses scheduler and resolver stacks without removing virtue windows', () => {
  const result = run({ [TRAIT.LETHAL_TEMPO]: remove('buff', 'lethal-tempo') }, 'Willbender', [
    'Rushing Justice',
    { type: 'wait', durationMs: 5000 }
  ]);
  for (const state of [result.planningState.profession, result.planningState.profession]) {
    assert.equal(state.lethalTempo.stacks, 0);
    assert.equal(state.lethalTempo.expiresAt, 0);
  }

  assert.equal(has(result, 'buff', 'kind', 'lethal-tempo'), false);
  assert.equal(has(result, 'proc', 'name', 'Lethal Tempo'), false);
  assert.ok(has(result, 'buff', 'kind', 'willbender-justice'));
});

test('Phoenix activation removal cannot select triggered Alacrity', () => {
  const result = run(
    { [TRAIT.PHOENIX_PROTOCOL]: remove('boon', 'alacrity') },
    'Willbender',
    ['Flowing Resolve', { type: 'wait', durationMs: 5100 }],
    [TRAIT.PHOENIX_PROTOCOL]
  );
  const boons = result.events.filter((event) => event.type === 'buff' && event.kind === 'alacrity');
  assert.ok(boons.length > 0);
  assert.ok(boons.every((event) => event.duration === 1));
});

test('removed Willbender Flames schedules no strike or Searing Pact reaction', () => {
  const result = run(
    { 'guardian.willbender.flames': remove('strike', 'Strike') },
    'Willbender',
    ['Rushing Justice', { type: 'wait', durationMs: 5000 }],
    [TRAIT.SEARING_PACT]
  );
  assert.equal(has(result, 'damage', 'skillName', 'Willbender Flames'), false);
  assert.equal(has(result, 'condition', 'skillName', 'Searing Pact'), false);
  assert.ok(has(result, 'buff', 'kind', 'willbender-justice'));
});

test('Inspired Virtue removal cannot substitute the next boon', () => {
  const result = run(
    { [TRAIT.INSPIRED_VIRTUE]: remove('boon', 'might') },
    'Core',
    ['Virtue of Justice'],
    [TRAIT.INSPIRED_VIRTUE]
  );
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.sourceId === TRAIT.INSPIRED_VIRTUE),
    false
  );
});

test('Protector strike removal preserves the independently patched protection cadence', () => {
  const result = run(
    {},
    'Core',
    ['Shelter', { type: 'wait', durationMs: 3000 }],
    [TRAIT.PROTECTORS_RESTORATION],
    {},
    {
      [SKILL.LESSER_SYMBOL_OF_PROTECTION]: {
        ...remove('strike', 'Strike'),
        effects: [{ type: 'boon', name: 'protection', duration: { from: 1, to: 3 } }]
      }
    }
  );
  assert.equal(has(result, 'damage', 'skillName', 'Lesser Symbol of Protection'), false);
  assert.ok(
    result.events.some((event) => event.type === 'buff' && event.kind === 'protection' && event.duration === 3)
  );
});

test('an empty Protector proc owns neither cooldown nor a proc row', () => {
  const result = run(
    {},
    'Core',
    ['Shelter'],
    [TRAIT.PROTECTORS_RESTORATION],
    {},
    {
      [SKILL.LESSER_SYMBOL_OF_PROTECTION]: {
        removeEffects: [
          { type: 'strike', name: 'Strike' },
          { type: 'boon', name: 'protection' }
        ]
      }
    }
  );
  assert.equal(observedRuntime(result).cooldownController.readyAt(SKILL.LESSER_SYMBOL_OF_PROTECTION), undefined);
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Lesser Symbol of Protection'),
    false
  );
  assert.equal(has(result, 'proc', 'name', 'Lesser Symbol of Protection'), false);
});

test('Soaring Devastation strike removal preserves immobilization', () => {
  const result = run(
    { [TRAIT.SOARING_DEVASTATION]: remove('strike', 'Strike') },
    'Dragonhunter',
    ['Wings of Resolve'],
    [TRAIT.SOARING_DEVASTATION]
  );
  assert.equal(has(result, 'damage', 'name', 'Wings of Resolve — Soaring Devastation'), false);
  assert.ok(has(result, 'condition', 'condition', 'Immobilized'));
});

for (const [type, name] of [
  ['buff', 'ashes-of-the-just'],
  ['condition', 'Burning']
]) {
  test(`Ashes ${type} removal preserves Might and page spending without granting charges`, () => {
    const result = run(
      {
        [type === 'condition' ? 'guardian.firebrand.ashes-of-the-just' : 'guardian.firebrand.epilogue-ashes-grant']:
          remove(type, name)
      },
      'Firebrand',
      ['Tome of Justice', 'Epilogue: Ashes of the Just']
    );
    assert.equal(has(result, 'buff', 'kind', 'ashes-of-the-just'), false);
    assert.equal(result.planningState.profession.ashes.charges, 0);
    assert.equal(result.planningState.profession.tomePages.value, 4);
    assert.ok(has(result, 'buff', 'kind', 'might'));
  });
}

test('Weighty Terms keeps its page refund when Slow is removed', () => {
  const result = run(
    { [TRAIT.WEIGHTY_TERMS]: remove('condition', 'Slow') },
    'Firebrand',
    ['Flame Rush', 'Flame Rush', 'Flame Surge'],
    [TRAIT.WEIGHTY_TERMS],
    { initialTomePages: 1, selectedSkillIds: [46148] }
  );
  assert.equal(has(result, 'condition', 'condition', 'Slow'), false);
  assert.equal(result.planningState.profession.tomePages.value, 3);
});

test('Radiant Forge removal leaves no active form, expiry, or exit flip', () => {
  const result = run({ 'guardian.luminary.radiant-forge': remove('buff', 'radiant-forge') }, 'Luminary', [
    'Enter Radiant Forge'
  ]);
  for (const state of [result.planningState.profession, result.planningState.profession]) {
    assert.equal(state.radiantForge, false);
    assert.equal(state.radiantForgeEndsAt, 0);
  }

  assert.equal(result.planningState.profession.availableFlips[SKILL.EXIT_RADIANT_FORGE], undefined);
});

test('Radiant Justice strike removal preserves delayed Vulnerability', () => {
  const result = run({ 'guardian.luminary.radiant-justice-impact': remove('strike', 'Strike') }, 'Luminary', [
    'Radiant Justice',
    'Enter Radiant Forge',
    'Dazzling Hammer',
    { type: 'wait', durationMs: 1200 }
  ]);
  assert.equal(has(result, 'damage', 'name', 'Dazzling Hammer — Radiant Justice Impact'), false);
  assert.ok(
    result.events.some(
      (event) => event.type === 'condition' && event.condition === 'Vulnerability' && event.stacks === 8
    )
  );
});

test('Glaring Burst support removal preserves shared Vulnerability', () => {
  const result = run({ 'guardian.luminary.glaring-burst.staff': remove('boon', 'regeneration') }, 'Luminary', [
    'Enter Radiant Forge',
    'Luminous Staff',
    'Glaring Burst'
  ]);
  assert.equal(
    result.events.some(
      (event) => event.type === 'buff' && event.skillName === 'Glaring Burst' && event.kind === 'regeneration'
    ),
    false
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'condition' && event.skillName === 'Glaring Burst' && event.condition === 'Vulnerability'
    )
  );
});

test('required profile fields fail contextually and selected catalogs cannot fall through', () => {
  const profile = guardianCatalog.balanceProfilesById.get(TRAIT.LETHAL_TEMPO);
  // Resolved profiles carry their own source, so diagnostics need no runtime context.
  const balanceDataContext = { professionId: 'guardian', patchId: 'malformed' };
  for (const maximumStacks of [undefined, null, '5', NaN]) {
    const catalog = {
      balanceProfilesById: new Map([[TRAIT.LETHAL_TEMPO, { ...profile, maximumStacks, balanceDataContext }]]),
      balanceDataContext
    };
    assert.throws(() => lethalTempoParameters({ catalog }), /profession=guardian patch=malformed.*maximumStacks/);
  }

  assert.throws(
    () =>
      lethalTempoParameters({ catalog: { balanceProfilesById: new Map() }, profession: { catalog: guardianCatalog } }),
    /missing required profile/
  );
});

test('patched resource caps and zero recurrence survive initialization and presentation', () => {
  const edits = {
    'guardian.firebrand.tome-pages': {
      fields: { maximumStacks: { from: 5, to: 2 }, pulseInterval: { from: 8, to: 0 } }
    }
  };
  const result = run(edits, 'Firebrand', [
    'Tome of Justice',
    'Chapter 1: Searing Spell',
    { type: 'wait', durationMs: 20000 }
  ]);
  assert.equal(result.planningState.profession.tomePages.maximum, 2);
  assert.equal(result.planningState.profession.tomePages.value, 1);
  assert.equal(result.planningState.profession.tomePages.nextAt, Infinity);
  const catalog = applyBalanceProfilePatch(guardianCatalog, { balanceProfiles: edits });
  assert.equal(firebrandUi.resourceViews({ catalog, config: {} })[0].maximum, 2);
  const tempoCatalog = applyBalanceProfilePatch(guardianCatalog, {
    balanceProfiles: { [TRAIT.LETHAL_TEMPO]: { fields: { maximumStacks: { from: 5, to: 2 } } } }
  });
  assert.equal(
    willbenderBuffPolicies({ catalog: tempoCatalog }).find((effect) => effect.kind === 'lethal-tempo').maximumStacks,
    2
  );
  assert.equal(guardianCatalog.balanceProfilesById.get(TRAIT.LETHAL_TEMPO).maximumStacks, 5);
});

// One patched multiplier must lengthen the consecration field and both of its repeated payloads together.
test('Master of Consecrations duration patches extend the field and its pulses together', () => {
  const simulate = (balanceProfiles, traits) =>
    run(balanceProfiles, 'Core', ['Purging Flames', { type: 'wait', durationMs: 9000 }], traits);
  const baseline = simulate({}, []);
  const patched = simulate(
    { [TRAIT.MASTER_OF_CONSECRATIONS]: { fields: { durationMultiplier: { from: 1.4, to: 1.2 } } } },
    [TRAIT.MASTER_OF_CONSECRATIONS]
  );
  const action = (simulation) => simulation.events.find((event) => event.type === 'action').comboFields[0].duration;
  const packets = (simulation, type) =>
    simulation.events.filter((event) => event.type === type && event.skillId === SKILL.PURGING_FLAMES);
  assert.equal(action(patched), action(baseline) * 1.2);
  // A fifth of the five-second field adds one more one-second strike and Burning pulse.
  for (const type of ['damage', 'condition'])
    assert.equal(packets(patched, type).length, packets(baseline, type).length + 1);
});

// One patched Writ value must lengthen the field and every periodic payload together, never either one alone.
test('Writ duration patches extend the symbol field and its periodic pulses together', () => {
  const simulate = (balanceProfiles, traits) =>
    run(balanceProfiles, 'Core', ['Symbol of Faith', { type: 'wait', durationMs: 8000 }], traits, {
      primaryWeapon: 'Mace'
    });
  const baseline = simulate({}, []);
  const patched = simulate({ [TRAIT.WRIT_OF_PERSISTENCE]: { fields: { durationExtension: { from: 2, to: 1 } } } }, [
    TRAIT.WRIT_OF_PERSISTENCE
  ]);
  const lifetime = (simulation) => {
    const field = simulation.events.find((event) => event.type === 'combo_field');
    return field.expiresAt - field.at;
  };

  const packets = (simulation, type) =>
    simulation.events.filter((event) => event.type === type && event.skillId === SKILL.SYMBOL_OF_FAITH);
  assert.equal(lifetime(patched), lifetime(baseline) + 1);
  // One added second holds one more one-second pulse of both the strike and its Regeneration.
  for (const type of ['damage', 'buff'])
    assert.equal(packets(patched, type).length, packets(baseline, type).length + 1);
});

test('deleted Justice Burning preserves the Willbender cycle trigger and its surviving rewards', () => {
  // A single initialized cycle proves that deleting Burning does not suppress the trigger that precedes it.
  const { triggers, extend } = captureTriggerPoint(willbenderVirtueTriggered);
  const profession = withPatchPreview(guardianProfession, {
    id: 'justice-removal',
    label: 'Justice removal',
    professions: {
      guardian: {
        balanceProfiles: {
          [CORE_PROFILE.justice]: remove('condition', 'Burning (active)')
        }
      }
    }
  });
  const result = runGuardian(
    [{ type: 'wait', durationMs: 2000 }],
    {
      specialization: 'Willbender',
      patchId: 'justice-removal'
    },
    {
      profession,
      extend,
      initialize(runtime) {
        const state = runtime.profession.specialization.state;
        state.justiceUntil = 2;
        state.virtueHitCounts.justice = 4;
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            at: 1,
            actorType: 'player',
            source: 'guardian',
            sourceId: SKILL.ORB_OF_WRATH,
            skillId: SKILL.ORB_OF_WRATH,
            skillName: 'Orb of Wrath',
            activationId: 'justice-hit',
            coefficient: 1,
            weaponStrengthProfileId: 'weapon.scepter'
          }
        });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    triggers.map(({ virtue, cause }) => [virtue, cause.activationId]),
    [['justice', 'justice-hit']]
  );
  assert.equal(observedRuntime(result).profession.specialization.state.virtueHitCounts.justice, 0);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'condition' && event.skillId === SKILL.WILLBENDER_JUSTICE),
    false
  );
  assert.deepEqual(
    result.resolvedEvents.filter((event) => event.kind === 'lethal-tempo').map((event) => event.activationId),
    ['justice-hit']
  );
});

test('Dragonhunter passive Crippled depends on emitted Burning and each surviving payload retains hit attribution', () => {
  // Cross one passive threshold with a single accepted hit to isolate the dependency between the two payloads.
  for (const removed of ['none', 'burning', 'crippled']) {
    const balanceProfiles =
      removed === 'burning'
        ? { [CORE_PROFILE.justice]: remove('condition', 'Burning (passive)') }
        : removed === 'crippled'
          ? { [DH_PROFILE.tether]: remove('condition', 'Crippled (passive)') }
          : {};
    const profession = withPatchPreview(guardianProfession, {
      id: 'passive-removal',
      label: 'Passive removal',
      professions: { guardian: { balanceProfiles } }
    });
    const result = runGuardian(
      [{ type: 'wait', durationMs: 2000 }],
      {
        specialization: 'Dragonhunter',
        patchId: 'passive-removal'
      },
      {
        profession,
        initialize(runtime) {
          runtime.profession.core.justiceHitCount = 4;
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: 1,
              actorType: 'player',
              source: 'guardian',
              sourceId: SKILL.ORB_OF_WRATH,
              skillId: SKILL.ORB_OF_WRATH,
              skillName: 'Orb of Wrath',
              activationId: 'passive-hit',
              coefficient: 1,
              weaponStrengthProfileId: 'weapon.scepter'
            }
          });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const applications = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === SKILL.SPEAR_OF_JUSTICE
    );
    assert.deepEqual(
      applications.map((event) => event.condition),
      removed === 'burning' ? [] : removed === 'crippled' ? ['Burning'] : ['Burning', 'Crippled']
    );
    assert.ok(applications.every((event) => event.activationId === 'passive-hit'));
    assert.equal(observedRuntime(result).profession.core.justiceHitCount, removed === 'burning' ? 4 : 0);
  }
});

test('Quickfire window removal leaves its cooldown and charge reactions inactive', () => {
  const result = run(
    { [TRAIT.QUICKFIRE]: remove('buff', 'ashes-of-the-just') },
    'Firebrand',
    ['Tome of Justice'],
    [TRAIT.QUICKFIRE]
  );
  assert.equal(observedRuntime(result).procs.deadline('guardian.firebrand.quickfire'), 0);
  assert.equal(result.planningState.profession.ashes.charges, 0);
  assert.equal(has(result, 'proc', 'name', 'Quickfire'), false);
});

test('Light Aura removal prevents its window and Sovereign detonation', () => {
  const result = run(
    { 'guardian.luminary.light-aura': remove('buff', 'light-aura') },
    'Luminary',
    ['Enter Radiant Forge', 'Radiant Resolve'],
    [TRAIT.SOVEREIGN_OF_LIGHT]
  );
  assert.equal(result.planningState.profession.lightAuraUntil, 0);
  assert.equal(has(result, 'damage', 'skillName', 'Sovereign of Light'), false);
});

test('Effulgent strike and control deletions preserve the other packet and consume the window', () => {
  for (const [type, name, survivor] of [
    ['strike', 'Strike', 'control'],
    ['control', 'Control', 'damage']
  ]) {
    const result = run(
      { 'guardian.luminary.effulgent-stance-detonation': remove(type, name) },
      'Luminary',
      ['Effulgent Stance', 'Whirling Wrath', 'Strike', 'Vengeful Strike', { type: 'wait', durationMs: 5000 }],
      [],
      { primaryWeapon: 'Greatsword', boons: { quickness: true } }
    );
    const effects = result.events.filter(
      (event) => event.skillId === SKILL.EFFULGENT_STANCE_DAMAGE && ['damage', 'control'].includes(event.type)
    );
    assert.deepEqual(
      effects.map((event) => event.type),
      [survivor]
    );
    const state = observedRuntime(result).profession.specialization.state;
    assert.equal(state.effulgentStacks, 0);
    assert.equal(state.effulgentActiveUntil, 0);
  }
});
