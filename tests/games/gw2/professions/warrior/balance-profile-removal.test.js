import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { warriorProfession, warriorCatalog } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/warrior/core/profiles.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as BLADESWORN } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { BERSERKER_BALANCE_PROFILE_IDS as BERSERKER } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { PARAGON_BALANCE_PROFILE_IDS as PARAGON } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { applyMarchingOrders } from '#gw2/professions/warrior/core/traits/tactics.js';
import { applySunderingBurst } from '#gw2/professions/warrior/core/traits/arms.js';
import { applyGunsaberEntryTraits } from '#gw2/professions/warrior/specializations/bladesworn/traits/index.js';
import { handleKingOfFiresDetonationTask } from '#gw2/professions/warrior/specializations/berserker/traits/index.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';
import { useArtillerySlash } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger.js';
import { observeSpellbreakerEvent } from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });

// Small patched activations exercise removal and state ownership without benchmark-shaped expectations.
function run(balanceProfiles, specialization, rotation, config = {}, skills = {}) {
  const profession = withPatchPreview(warriorProfession, {
    id: 'warrior-removal',
    label: 'Warrior removal',
    professions: { warrior: { balanceProfiles, skills } }
  });
  const result = createProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000 },
    target: { armor: 2597, health: 1_000_000, defiant: true }
  })(specialization, rotation, { patchId: 'warrior-removal', ...config });
  assert.deepEqual(result.warnings, []);
  return result;
}

function contextFor(specialization, selectedTraitIds, balanceProfiles) {
  const config = { specialization, selectedTraitIds };
  const profession = warriorProfession.resolveRuntime(config);
  const events = [];
  return {
    config,
    profession,
    catalog: applyBalanceProfilePatch(profession.catalog, { balanceProfiles }),
    state: { profession: profession.createProfessionState(config), time: 0 },
    events,
    skill: profession.catalog.skillsById.get(ID.UNSHEATHE_GUNSABER),
    emit(event) {
      events.push(event);
      return event;
    },
    emitDerived(_cause, event) {
      return this.emit(event);
    }
  };
}

test('removed Marching Orders Might preserves Soldier Focus cooldown and sibling traits', () => {
  const context = contextFor('Core', [TRAIT.MARCHING_ORDERS], {
    [CORE.marchingOrders]: { ...remove('boon', 'might'), fields: { internalCooldown: { from: 10, to: 7 } } }
  });
  assert.equal(applyMarchingOrders(context, { at: 1 }), true);
  assert.equal(context.state.profession.core.soldierFocusReadyAt, 8);
  assert.deepEqual(context.events, []);
  const result = run({ [CORE.marchingOrders]: remove('boon', 'might') }, 'Core', [ID.EVISCERATE], {
    initialResource: 30,
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.MARCHING_ORDERS, TRAIT.SOLDIERS_COMFORT, TRAIT.MARTIAL_CADENCE]
  });
  assert.ok(result.events.some((e) => e.kind === 'protection'));
  assert.ok(result.events.some((e) => e.kind === 'stability'));
  assert.equal(
    result.events.some((e) => e.sourceId === TRAIT.MARCHING_ORDERS && e.type === 'buff'),
    false
  );
});

test('Sundering Burst removal cannot substitute its surviving critical variant', () => {
  const context = contextFor('Core', [TRAIT.SUNDERING_BURST], {
    [CORE.sunderingBurst]: {
      ...remove('condition', 'Burst'),
      effects: [{ type: 'condition', name: 'Critical burst', stacks: { from: 10, to: 13 } }]
    }
  });
  applySunderingBurst(context, { at: 1 }, true, 0);
  assert.deepEqual(context.events, []);
  assert.equal(context.state.profession.core.traitProcReadyAt.sunderingBurst, 6);
  applySunderingBurst(context, { at: 7 }, true, 1);
  assert.equal(context.events[0].stacks, 13);
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
  const context = contextFor('Berserker', [TRAIT.KING_OF_FIRES], {
    [BERSERKER.kingOfFires]: remove('strike', 'Strike')
  });
  context.state.profession.specialization.state.fireAuraUntil = 5;
  handleKingOfFiresDetonationTask(context, { at: 1, payload: { skillId: ID.BERSERK } });
  assert.equal(
    context.events.some((e) => e.type === 'damage'),
    false
  );
  assert.ok(context.events.some((e) => e.type === 'condition'));
  assert.equal(context.state.profession.specialization.state.fireAuraUntil, 0);
});

for (const trait of [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND, TRAIT.RIVERS_FLOW]) {
  test(`removed Positive Flow for ${trait} preserves its entry packet and cooldown`, () => {
    const context = contextFor('Bladesworn', [trait], { [trait]: remove('buff', 'positive-flow') });
    applyGunsaberEntryTraits(context, 1);
    const state = context.state.profession.specialization.state;
    assert.equal(state.traitPositiveFlowUntil, 0);
    assert.equal(state.gunsaberSwapTraitReadyAt, 5);
    assert.ok(context.events.length > 0);
    assert.equal(
      context.events.some((e) => e.kind === 'positive-flow'),
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
  assert.equal(refrain.events.filter((e) => e.type === 'warrior.paragon-state').length, 1);
});

test('Artillery Slash keeps ammo variant identity after first-strike removal and a surviving edit', () => {
  for (const charges of [1, 2]) {
    const context = contextFor('Bladesworn', [], {
      [BLADESWORN.artillerySlash]: {
        ...remove('strike', 'One round'),
        effects: [{ type: 'strike', name: 'Two rounds', coefficient: { from: 3, to: 4 } }]
      }
    });
    Object.assign(context, {
      ammo: { charges, maximum: 2 },
      effectiveEnd: 1,
      rechargeStart: 0,
      rechargeDuration: 1,
      ammoLockoutDuration: 1,
      reservationId: 'artillery',
      action: {},
      replaceEvent: (event, updates) => ({ ...event, ...updates })
    });
    useArtillerySlash(context, context.catalog.skillsById.get(ID.ARTILLERY_SLASH));
    const strike = context.events.find((e) => e.type === 'damage');
    assert.equal(strike?.coefficient, charges === 1 ? undefined : 4);
    assert.ok(context.events.some((e) => e.type === 'control'));
    assert.equal(context.state.profession.specialization.state.ammoRoundsSpentByActivation.artillery, charges);
  }
});

test('removed Spellbreaker buffs cannot retain Insight stacks or a tether window', () => {
  const context = contextFor('Spellbreaker', [TRAIT.ATTACKERS_INSIGHT, TRAIT.MAGEBANE_TETHER], {
    [TRAIT.ATTACKERS_INSIGHT]: remove('buff', 'attackers-insight'),
    [TRAIT.MAGEBANE_TETHER]: remove('buff', 'magebane-tether')
  });
  observeSpellbreakerEvent(context, { type: 'control', actorType: 'player', skillId: ID.KICK, at: 1 });
  observeSpellbreakerEvent(context, {
    type: 'damage',
    actorType: 'player',
    skillId: ID.BREACHING_STRIKE,
    coefficient: 1,
    at: 2
  });
  const state = context.state.profession.specialization.state;
  assert.deepEqual(state.attackerInsightExpiries, []);
  assert.equal(state.magebaneTetherUntil, 0);
});

test('Paragon opening Might removal preserves Fury, Motivation, and tooltip identity', () => {
  const profiles = { [PARAGON.chants]: remove('boon', 'might') };
  const result = run(profiles, 'Paragon', [ID.CHANT_OF_ACTION], { initialResource: 30 });
  const entry = result.events.find((e) => e.type === 'warrior.paragon-state' && e.state?.motivation > 0);
  assert.ok(entry);
  assert.ok(result.events.some((e) => e.kind === 'fury'));
  const catalog = applyBalanceProfilePatch(warriorCatalog, { balanceProfiles: profiles });
  const tooltip = warriorTooltips.handlers['warrior.chant']({ catalog }, catalog.skillsById.get(ID.CHANT_OF_ACTION));
  assert.equal(
    tooltip.facts.some((f) => /vigor/i.test(f.name)),
    false
  );
  assert.ok(tooltip.facts.some((f) => /fury/i.test(f.name)));
});

test('Warrior handlers reject missing profiles and invalid required scalars contextually', () => {
  const context = contextFor('Core', [TRAIT.MARCHING_ORDERS], {});
  const profiles = new Map(context.catalog.balanceProfilesById);
  const original = profiles.get(CORE.marchingOrders);
  context.catalog = {
    ...context.catalog,
    balanceProfilesById: profiles,
    balanceDataContext: { professionId: 'warrior', patchId: 'broken' }
  };
  profiles.delete(CORE.marchingOrders);
  assert.throws(
    () => applyMarchingOrders(context, { at: 1 }),
    /profession=warrior patch=broken.*missing required profile/
  );
  // Resolved profiles carry their own source, so diagnostics need no runtime context.
  const { balanceDataContext } = context.catalog;
  for (const value of [undefined, null, '10', NaN, Infinity]) {
    profiles.set(CORE.marchingOrders, { ...original, internalCooldown: value, balanceDataContext });
    assert.throws(
      () => applyMarchingOrders(context, { at: 1 }),
      /profession=warrior patch=broken.*field=internalCooldown/
    );
  }
  profiles.set(CORE.marchingOrders, { ...original, internalCooldown: 0 });
  assert.equal(applyMarchingOrders(context, { at: 1 }), true);
  assert.equal(context.state.profession.core.soldierFocusReadyAt, 1);
});
