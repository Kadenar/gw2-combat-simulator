import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createLiveProfessionSimulator, observeGw2Runtime, runtimeFor } from '#tests/helpers/live-runtime.js';
import { warriorProfession, warriorCatalog } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/warrior/core/profiles.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as BLADESWORN } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { BERSERKER_BALANCE_PROFILE_IDS as BERSERKER } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { PARAGON_BALANCE_PROFILE_IDS as PARAGON } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });

// Small patched activations exercise removal and state ownership without benchmark-shaped expectations.
function run(balanceProfiles, specialization, rotation, config = {}, skills = {}) {
  const profession = withPatchPreview(warriorProfession, {
    id: 'warrior-removal',
    label: 'Warrior removal',
    professions: { warrior: { balanceProfiles, skills } }
  });
  const result = createLiveProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000 },
    target: { armor: 2597, health: 1_000_000, defiant: true }
  })(specialization, rotation, { patchId: 'warrior-removal', ...config });
  assert.deepEqual(result.warnings, []);
  return result;
}

test('removed Marching Orders Might preserves Soldier Focus cooldown and sibling traits', () => {
  // The accepted hit claims Focus even when its Might component is removed.
  const result = run(
    { [CORE.marchingOrders]: { ...remove('boon', 'might'), fields: { internalCooldown: { from: 10, to: 7 } } } },
    'Core',
    [ID.EVISCERATE],
    {
      initialResource: 30,
      primaryWeapon: 'Axe',
      selectedTraitIds: [TRAIT.MARCHING_ORDERS, TRAIT.SOLDIERS_COMFORT, TRAIT.MARTIAL_CADENCE]
    }
  );
  const hit = result.events.find((event) => event.type === 'damage' && event.skillId === ID.EVISCERATE);
  assert.equal(runtimeFor(result).profession.core.soldierFocusReadyAt, hit.at + 7);
  assert.ok(result.events.some((event) => event.kind === 'protection'));
  assert.ok(result.events.some((event) => event.kind === 'stability'));
  assert.equal(
    result.events.some((event) => event.sourceId === TRAIT.MARCHING_ORDERS && event.type === 'buff'),
    false
  );
});

test('Sundering Burst removal cannot substitute its surviving critical variant', () => {
  for (const precision of [0, 10000]) {
    const result = run(
      {
        [CORE.sunderingBurst]: {
          ...remove('condition', 'Burst'),
          effects: [{ type: 'condition', name: 'Critical burst', stacks: { from: 10, to: 13 } }]
        }
      },
      'Core',
      [ID.EVISCERATE],
      { initialResource: 30, primaryWeapon: 'Axe', selectedTraitIds: [TRAIT.SUNDERING_BURST], stats: { precision } }
    );
    const hit = result.events.find((event) => event.type === 'damage');
    const proc = result.events.find((event) => event.sourceId === TRAIT.SUNDERING_BURST);
    assert.equal(proc?.stacks, precision === 0 ? undefined : 13);
    assert.equal(runtimeFor(result).profession.core.traitProcReadyAt.sunderingBurst, hit.at + 5);
  }
});

for (const [profile, type, name, skill, weapon] of [
  [CORE.eviscerateTier3, 'strike', 'Strike', ID.EVISCERATE, 'Axe'],
  [CORE.bloodthirsterTiers, 'condition', 'Tier 3', ID.BLOODTHIRSTER, 'Sword']
])
  test(`removed ${profile} tier suppresses its packet and retains burst spending`, () => {
    const result = run({ [profile]: remove(type, name) }, 'Core', [skill], {
      initialResource: 30,
      primaryWeapon: weapon,
      selectedTraitIds: [TRAIT.BERSERKERS_POWER]
    });
    assert.equal(
      result.events.some((e) => e.skillId === skill && e.type === (type === 'strike' ? 'damage' : 'condition')),
      false
    );
    assert.ok(result.planningState.profession.adrenaline < 30);
    assert.ok(result.events.some((e) => e.type === 'action' && e.skillId === skill));
    if (type === 'strike')
      assert.equal(
        result.events.some((e) => e.kind === 'berserkers-power'),
        false
      );
  });

for (const [type, name, absent, present] of [
  ['strike', 'Strike', 'damage', 'condition'],
  ['condition', 'Burning', 'condition', 'damage']
])
  test(`Combustive Shot ${type} removal keeps the independent packet`, () => {
    const result = run({ [CORE.combustiveShot]: remove(type, name) }, 'Core', [ID.COMBUSTIVE_SHOT], {
      initialResource: 30,
      primaryWeapon: 'Longbow',
      selectedTraitIds: [TRAIT.BERSERKERS_POWER]
    });
    assert.equal(
      result.events.some((e) => e.skillId === ID.COMBUSTIVE_SHOT && e.type === absent),
      false
    );
    assert.ok(result.events.some((e) => e.skillId === ID.COMBUSTIVE_SHOT && e.type === present));
    if (type === 'strike')
      assert.equal(
        result.events.some((e) => e.kind === 'berserkers-power'),
        false
      );
  });

test('removed Berserk window retains resource spending and entry boons without activating mode', () => {
  const result = run({ [BERSERKER.resources]: remove('buff', 'berserk') }, 'Berserker', [ID.BERSERK], {
    initialResource: 30,
    selectedTraitIds: [TRAIT.BURST_OF_AGGRESSION]
  });
  assert.equal(result.planningState.profession.berserkActive, false);
  assert.equal(result.planningState.profession.berserkUntil, 0);
  assert.equal(result.planningState.profession.maximumAdrenaline, 30);
  assert.ok(result.planningState.profession.adrenaline < 30);
  assert.ok(result.events.some((e) => e.kind === 'quickness'));
  assert.equal(
    result.events.some((e) => e.kind === 'berserk'),
    false
  );
});

test('removed Heat the Soul Quickness preserves Fury and Might', () => {
  const result = run(
    { [BERSERKER.heatTheSoul]: remove('boon', 'quickness') },
    'Berserker',
    [ID.BERSERK, ID.DECAPITATE],
    {
      initialResource: 30,
      primaryWeapon: 'Axe',
      selectedTraitIds: [TRAIT.HEAT_THE_SOUL]
    }
  );
  const events = result.events.filter((e) => e.sourceId === TRAIT.HEAT_THE_SOUL);
  assert.equal(
    events.some((e) => e.kind === 'quickness'),
    false
  );
  assert.ok(events.some((e) => e.kind === 'fury'));
  assert.ok(events.some((e) => e.kind === 'might'));
});

test('removed King of Fires strike preserves Burning and consumes the aura', () => {
  const result = run({ [BERSERKER.kingOfFires]: remove('strike', 'Strike') }, 'Berserker', ['Chop', ID.BERSERK], {
    primaryWeapon: 'Axe',
    initialResource: 30,
    stats: { precision: 10000 },
    selectedTraitIds: [TRAIT.KING_OF_FIRES]
  });
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.sourceId === TRAIT.KING_OF_FIRES),
    false
  );
  assert.ok(result.events.some((event) => event.type === 'condition' && event.sourceId === TRAIT.KING_OF_FIRES));
  assert.equal(runtimeFor(result).profession.specialization.state.fireAuraUntil, 0);
});

for (const trait of [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND, TRAIT.RIVERS_FLOW]) {
  test('removed Positive Flow preserves its entry packet and cooldown: ' + trait, () => {
    const result = run(
      { [trait]: remove('buff', 'positive-flow') },
      'Bladesworn',
      ['__combat_start', { type: 'wait', durationMs: 1000 }, ID.UNSHEATHE_GUNSABER],
      { selectedTraitIds: [trait] }
    );
    const state = runtimeFor(result).profession.specialization.state;
    assert.equal(state.traitPositiveFlowUntil, 0);
    assert.equal(state.gunsaberSwapTraitReadyAt, 5);
    assert.ok(result.events.some((event) => event.sourceId === trait));
    assert.equal(
      result.events.some((event) => event.kind === 'positive-flow'),
      false
    );
  });
}

test('Flow Stabilizer removed window preserves its Fury packet', () => {
  const result = run(
    {},
    'Bladesworn',
    [ID.FLOW_STABILIZER],
    {},
    {
      [ID.FLOW_STABILIZER]: remove('buff', 'Positive Flow')
    }
  );
  assert.deepEqual(result.planningState.profession.flowStabilizerWindows, []);
  assert.ok(result.events.some((e) => e.kind === 'fury'));
});

test('removed Artillery Slash strike preserves Bleeding, control, and ammo spending', () => {
  const result = run(
    { [BLADESWORN.sharpArtillerySlash]: remove('strike', 'Strike') },
    'Bladesworn',
    [ID.UNSHEATHE_GUNSABER, ID.ARTILLERY_SLASH],
    { selectedTraitIds: [TRAIT.SHARP_AS_THE_WIND] }
  );
  assert.equal(
    result.events.some((e) => e.skillId === ID.SHARP_ARTILLERY_SLASH && e.type === 'damage'),
    false
  );
  assert.ok(result.events.some((e) => e.skillId === ID.SHARP_ARTILLERY_SLASH && e.type === 'condition'));
  assert.ok(result.events.some((e) => e.skillId === ID.SHARP_ARTILLERY_SLASH && e.type === 'control'));
  assert.ok(Object.keys(result.planningState.cooldowns).length > 0);
});

test('removed ordinary cartridge buff cannot substitute the supercharged window', () => {
  const result = run(
    { [BLADESWORN.overchargedCartridges]: remove('buff', 'overcharged-cartridges') },
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES],
    { selectedSkills: { utility1: 'Overcharged Cartridges' } }
  );
  assert.deepEqual(result.planningState.profession.overchargedCartridgeWindows, []);
  assert.equal(
    result.events.some((e) => e.kind === 'supercharged-cartridges'),
    false
  );
});

test('Artillery Slash control removal retains its strike', () => {
  const result = run({ [BLADESWORN.artillerySlash]: remove('control', 'Control') }, 'Bladesworn', [
    ID.UNSHEATHE_GUNSABER,
    ID.ARTILLERY_SLASH
  ]);
  assert.equal(
    result.events.some((e) => e.skillId === ID.ARTILLERY_SLASH && e.type === 'control'),
    false
  );
  assert.ok(result.events.some((e) => e.skillId === ID.ARTILLERY_SLASH && e.type === 'damage'));
});

test('zero Empower Allies and Paragon intervals disable queued recurrence', () => {
  const allies = run(
    { [CORE.empowerAllies]: { fields: { pulseInterval: 0 } } },
    'Core',
    [{ type: 'wait', durationMs: 5000 }],
    { selectedTraitIds: [TRAIT.EMPOWER_ALLIES] }
  );
  assert.equal(
    allies.events.some((e) => e.sourceId === TRAIT.EMPOWER_ALLIES),
    false
  );
  const refrain = run(
    { [PARAGON.resources]: { fields: { pulseInterval: 0 } } },
    'Paragon',
    [ID.CHANT_OF_ACTION, { type: 'wait', durationMs: 5000 }],
    { initialResource: 30 }
  );
  assert.equal(refrain.planningState.profession.motivation, 4);
  assert.equal(refrain.planningState.profession.activeRefrain, 'Chant of Action');
});

test('Artillery Slash keeps ammo variant identity after first-strike removal and a surviving edit', () => {
  for (const charges of [1, 2]) {
    const result = run(
      {
        [BLADESWORN.artillerySlash]: {
          ...remove('strike', 'One round'),
          effects: [{ type: 'strike', name: 'Two rounds', coefficient: { from: 3, to: 4 } }]
        }
      },
      'Bladesworn',
      [ID.UNSHEATHE_GUNSABER, ID.ARTILLERY_SLASH],
      {},
      { [ID.ARTILLERY_SLASH]: { fields: { ammo: { from: 2, to: charges } } } }
    );
    const strike = result.events.find((event) => event.type === 'damage');
    assert.equal(strike?.coefficient, charges === 1 ? undefined : 4);
    assert.ok(result.events.some((event) => event.type === 'control'));
    assert.equal(runtimeFor(result).ammo.get(ID.ARTILLERY_SLASH).charges, 0);
  }
});

test('removed Spellbreaker buffs cannot retain Insight stacks or a tether window', () => {
  const result = run(
    {
      [TRAIT.ATTACKERS_INSIGHT]: remove('buff', 'attackers-insight'),
      [TRAIT.MAGEBANE_TETHER]: remove('buff', 'magebane-tether')
    },
    'Spellbreaker',
    ['Kick', ID.BREACHING_STRIKE],
    { initialResource: 20, primaryWeapon: 'Dagger', selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT, TRAIT.MAGEBANE_TETHER] }
  );
  const state = runtimeFor(result).profession.specialization.state;
  assert.deepEqual(state.attackerInsightExpiries, []);
  assert.equal(state.magebaneTetherUntil, 0);
});

test('Paragon opening Might removal preserves Fury, Motivation, and tooltip identity', () => {
  const profiles = { [PARAGON.chants]: remove('boon', 'might') };
  const result = run(profiles, 'Paragon', [ID.CHANT_OF_ACTION], { initialResource: 30 });
  assert.equal(result.planningState.profession.motivation, 4);
  assert.ok(result.events.some((e) => e.kind === 'fury'));
  const catalog = applyBalanceProfilePatch(warriorCatalog, { balanceProfiles: profiles });
  const tooltip = warriorTooltips.skills[ID.CHANT_OF_ACTION]({ catalog }, catalog.skillsById.get(ID.CHANT_OF_ACTION));
  assert.equal(
    tooltip.facts.some((f) => /vigor/i.test(f.name)),
    false
  );
  assert.ok(tooltip.facts.some((f) => /fury/i.test(f.name)));
});

test('Warrior live owners reject missing profiles and invalid required scalars contextually', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Axe',
    initialResource: 30,
    selectedTraitIds: [TRAIT.MARCHING_ORDERS]
  };
  const profession = warriorProfession.liveRuntimeFor(config);
  const profiles = new Map(profession.catalog.balanceProfilesById);
  const original = profiles.get(CORE.marchingOrders);
  const balanceDataContext = { professionId: 'warrior', patchId: 'broken' };
  const catalog = { ...profession.catalog, balanceProfilesById: profiles, balanceDataContext };
  const simulate = () =>
    observeGw2Runtime({ profession: { ...profession, catalog }, config, rotation: ['Eviscerate'] });
  profiles.delete(CORE.marchingOrders);
  assert.throws(simulate, /profession=warrior patch=broken.*missing required profile/);
  for (const value of [undefined, null, '10', NaN, Infinity]) {
    profiles.set(CORE.marchingOrders, { ...original, internalCooldown: value, balanceDataContext });
    assert.throws(simulate, /profession=warrior patch=broken.*field=internalCooldown/);
  }

  profiles.set(CORE.marchingOrders, { ...original, internalCooldown: 0 });
  const result = simulate();
  assert.equal(
    runtimeFor(result).profession.core.soldierFocusReadyAt,
    result.events.find((event) => event.type === 'damage').at
  );
});
