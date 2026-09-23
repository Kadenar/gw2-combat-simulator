import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_SKILL_IDS as SKILL, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { lethalTempoParameters } from '#gw2/professions/guardian/specializations/willbender/mechanics/lethal-tempo.js';
import { willbenderUi } from '#gw2/professions/guardian/specializations/willbender/presentation.js';
import { firebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { applyProtectorsRestoration } from '#gw2/professions/guardian/core/traits/honor.js';
import { applyMasterOfConsecrations } from '#gw2/professions/guardian/core/traits/virtues.js';
import { createGuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { handleEffulgentDetonate } from '#gw2/professions/guardian/specializations/luminary/mechanics/stances.js';
import { createLuminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';

// Small rotations isolate deletion, surviving edits, and owned state without benchmark-shaped assertions.
function run(balanceProfiles, specialization, rotation, selectedTraitIds = [], extra = {}) {
  const profession = withPatchPreview(guardianProfession, {
    id: 'guardian-removal',
    label: 'Guardian removal',
    professions: { guardian: { balanceProfiles } }
  });
  const result = simulateGw2({
    profession,
    config: { specialization, selectedTraitIds, patchId: 'guardian-removal', ...extra },
    rotation
  });
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
  assert.equal(result.combatState.profession.justiceUntil, 0);
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
  for (const state of [result.planningState.profession, result.combatState.profession]) {
    assert.equal(state.lethalTempoStacks, 0);
    assert.equal(state.lethalTempoUntil, 0);
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
    {
      [TRAIT.PROTECTORS_RESTORATION]: {
        ...remove('strike', 'Strike'),
        effects: [{ type: 'boon', name: 'protection', duration: { from: 1, to: 3 } }]
      }
    },
    'Core',
    ['Shelter', { type: 'wait', durationMs: 3000 }],
    [TRAIT.PROTECTORS_RESTORATION]
  );
  assert.equal(has(result, 'damage', 'skillName', 'Lesser Symbol of Protection'), false);
  assert.ok(
    result.events.some((event) => event.type === 'buff' && event.kind === 'protection' && event.duration === 3)
  );
});

test('an empty Protector proc owns neither cooldown nor a proc row', () => {
  const result = run(
    {
      [TRAIT.PROTECTORS_RESTORATION]: {
        removeEffects: [
          { type: 'strike', name: 'Strike' },
          { type: 'boon', name: 'protection' }
        ]
      }
    },
    'Core',
    ['Shelter'],
    [TRAIT.PROTECTORS_RESTORATION]
  );
  const core = createGuardianCoreState();
  const catalog = applyBalanceProfilePatch(guardianCatalog, {
    balanceProfiles: {
      [TRAIT.PROTECTORS_RESTORATION]: {
        removeEffects: [
          { type: 'strike', name: 'Strike' },
          { type: 'boon', name: 'protection' }
        ]
      }
    }
  });
  applyProtectorsRestoration(
    { catalog, config: { selectedTraitIds: [TRAIT.PROTECTORS_RESTORATION] }, state: { profession: { core } } },
    { type: 'Heal' },
    1
  );
  assert.equal(core.protectorsRestorationReadyAt, 0);
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
    const result = run({ 'guardian.firebrand.ashes-of-the-just': remove(type, name) }, 'Firebrand', [
      'Tome of Justice',
      'Epilogue: Ashes of the Just'
    ]);
    assert.equal(has(result, 'guardian.ashes-granted', 'skillName', 'Epilogue: Ashes of the Just'), false);
    assert.equal(result.planningState.profession.ashes.charges, 0);
    assert.equal(result.planningState.profession.tomePages, 4);
    assert.ok(has(result, 'buff', 'kind', 'might'));
  });
}

test('Weighty Terms keeps its page refund when Slow is removed', () => {
  const result = run(
    { [TRAIT.WEIGHTY_TERMS]: remove('condition', 'Slow') },
    'Firebrand',
    ['Flame Rush', 'Flame Rush', 'Flame Surge'],
    [TRAIT.WEIGHTY_TERMS],
    { initialTomePages: 1, selectedSkills: ['Mantra of Flame'] }
  );
  assert.equal(has(result, 'condition', 'condition', 'Slow'), false);
  assert.equal(result.planningState.profession.tomePages, 3);
});

test('Radiant Forge removal leaves no active form, expiry, or exit flip', () => {
  const result = run({ 'guardian.luminary.radiant-forge': remove('buff', 'radiant-forge') }, 'Luminary', [
    'Enter Radiant Forge'
  ]);
  for (const state of [result.planningState.profession, result.combatState.profession]) {
    assert.equal(state.radiantForge, false);
    assert.equal(state.radiantForgeEndsAt, 0);
  }
  assert.equal(has(result, 'guardian.radiant-forge-entered', 'radiantForge', true), false);
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
  assert.equal(result.planningState.profession.maximumTomePages, 2);
  assert.equal(result.planningState.profession.tomePages, 1);
  assert.equal(result.planningState.profession.nextTomePageAt, Infinity);
  const catalog = applyBalanceProfilePatch(guardianCatalog, { balanceProfiles: edits });
  assert.equal(firebrandUi.resourceViews({ catalog, config: {} })[0].maximum, 2);
  const tempoCatalog = applyBalanceProfilePatch(guardianCatalog, {
    balanceProfiles: { [TRAIT.LETHAL_TEMPO]: { fields: { maximumStacks: { from: 5, to: 2 } } } }
  });
  assert.equal(willbenderUi.effectPresentations({ catalog: tempoCatalog }).at(-1).maximumStacks, 2);
  assert.equal(guardianCatalog.balanceProfilesById.get(TRAIT.LETHAL_TEMPO).maximumStacks, 5);
});

test('Master of Consecrations schedules independently patched effect ticks from cast start', () => {
  const catalog = applyBalanceProfilePatch(guardianCatalog, {
    balanceProfiles: {
      [TRAIT.MASTER_OF_CONSECRATIONS]: {
        removeEffects: [
          { type: 'strike', name: 'Strike' },
          { type: 'condition', name: 'Burning' }
        ],
        addEffects: [
          {
            type: 'strike',
            name: 'Strike',
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            ticks: [{ atMs: 4400, coefficient: 0.3 }]
          },
          {
            type: 'condition',
            name: 'Burning',
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            ticks: [{ atMs: 5200, condition: 'Burning', stacks: 2, duration: 3 }]
          }
        ]
      }
    }
  });
  const events = [];
  applyMasterOfConsecrations(
    {
      catalog,
      config: { selectedTraitIds: [TRAIT.MASTER_OF_CONSECRATIONS] },
      profession: { id: 'guardian' },
      start: 10,
      fullEnd: 10.32,
      emit: (event) => events.push(event)
    },
    catalog.skillsById.get(SKILL.PURGING_FLAMES)
  );
  const strike = events.find((event) => event.type === 'damage');
  const burning = events.find((event) => event.type === 'condition');
  assert.equal(strike.at, 14.4);
  assert.equal(strike.coefficient, 0.3);
  assert.equal(burning.at, 15.2);
  assert.equal(burning.condition, 'Burning');
  assert.equal(burning.stacks, 2);
  assert.equal(burning.duration, 3);
});

test('Master of Consecrations keeps Burning when its extension strike is removed', () => {
  const result = run(
    { [TRAIT.MASTER_OF_CONSECRATIONS]: remove('strike', 'Strike') },
    'Core',
    ['Purging Flames', { type: 'wait', durationMs: 8000 }],
    [TRAIT.MASTER_OF_CONSECRATIONS]
  );
  assert.ok(
    result.events.some((event) => event.type === 'condition' && event.skillName === 'Purging Flames' && event.at > 6)
  );
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillName === 'Purging Flames' && event.at > 6),
    false
  );
});

test('Writ window removal preserves independently authored Symbol of Punishment packets', () => {
  const result = run(
    { [TRAIT.WRIT_OF_PERSISTENCE]: remove('buff', 'symbol-duration-extension') },
    'Core',
    ['Symbol of Punishment', { type: 'wait', durationMs: 7000 }],
    [TRAIT.WRIT_OF_PERSISTENCE],
    { primaryWeapon: 'Scepter' }
  );
  assert.equal(
    result.events.some((event) => event.type === 'combo_field' && event.triggeredBy === 'Writ of Persistence'),
    false
  );
  assert.ok(result.events.some((event) => event.type === 'damage' && event.triggeredBy === 'Writ of Persistence'));
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.kind === 'might' && event.triggeredBy === 'Writ of Persistence'
    )
  );
});

test('deleted Justice Burning does not increment burn counters or recreate packets', () => {
  const result = run({ 'guardian.core.justice': remove('condition', 'Burning (active)') }, 'Willbender', [
    'Rushing Justice',
    { type: 'wait', durationMs: 5000 }
  ]);
  assert.ok(result.planningState.profession.triggeredVirtueEffects > 0);
  assert.equal(result.combatState.profession.justiceActiveBurns, 0);
  assert.equal(
    result.events.some((event) => event.type === 'condition' && event.skillName === 'Justice'),
    false
  );
});

test('Quickfire window removal leaves its cooldown and charge reactions inactive', () => {
  const result = run(
    { [TRAIT.QUICKFIRE]: remove('buff', 'ashes-of-the-just') },
    'Firebrand',
    ['Tome of Justice'],
    [TRAIT.QUICKFIRE]
  );
  assert.equal(result.combatState.profession.quickfireReadyAt, 0);
  assert.equal(result.combatState.profession.ashes.charges, 0);
  assert.equal(has(result, 'proc', 'name', 'Quickfire'), false);
});

test('Light Aura removal prevents its window and Sovereign detonation', () => {
  const result = run(
    { 'guardian.luminary.light-aura': remove('buff', 'light-aura') },
    'Luminary',
    ['Enter Radiant Forge', 'Radiant Resolve'],
    [TRAIT.SOVEREIGN_OF_LIGHT]
  );
  assert.equal(result.combatState.profession.lightAuraUntil, 0);
  assert.equal(has(result, 'damage', 'skillName', 'Sovereign of Light'), false);
});

test('Effulgent strike and control deletions preserve the other packet and consume the window', () => {
  for (const [type, name, survivor] of [
    ['strike', 'Strike', 'control'],
    ['control', 'Control', 'damage']
  ]) {
    const catalog = applyBalanceProfilePatch(guardianCatalog, {
      balanceProfiles: { 'guardian.luminary.effulgent-stance-detonation': remove(type, name) }
    });
    const state = createLuminaryState();
    state.effulgentStacks = 10;
    state.effulgentActiveUntil = 4;
    const events = [];
    handleEffulgentDetonate(
      {
        catalog,
        profession: { specialization: { kind: 'Luminary', state } },
        queue: { enqueue: (event) => events.push(event) },
        recordProc() {}
      },
      { at: 4 }
    );
    assert.deepEqual(
      events.map((event) => event.type),
      [survivor]
    );
    assert.equal(state.effulgentStacks, 0);
    assert.equal(state.effulgentActiveUntil, 0);
  }
});
