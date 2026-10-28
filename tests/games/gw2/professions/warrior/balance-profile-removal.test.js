import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';
import { WARRIOR_MAXIMUM_ADRENALINE } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import {
  createObservedProfessionSimulator,
  observedRuntime,
  observeGw2Runtime
} from '#tests/helpers/observed-runtime.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });

// Small patched activations exercise removal and state ownership without benchmark-shaped expectations.
function run(balanceProfiles, specialization, rotation, config = {}, skills = {}) {
  const profession = withPatchPreview(warriorProfession, {
    id: 'warrior-removal',
    label: 'Warrior removal',
    professions: { warrior: { balanceProfiles, skills } }
  });
  const result = createObservedProfessionSimulator(profession, {
    attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000 }),
    target: { armor: 2597, health: 1_000_000, defiant: true }
  })(specialization, rotation, { patchId: 'warrior-removal', ...config });
  assert.deepEqual(result.warnings, []);
  return result;
}

// Skill components use canonical skill patches while traits retain their own balance owners.
function runSkills(skills, specialization, rotation, config = {}) {
  return run({}, specialization, rotation, config, skills);
}

test('removed Marching Orders Might preserves Soldier Focus cooldown and sibling traits', () => {
  // The accepted hit claims Focus even when its Might component is removed.
  const result = run(
    { [TRAIT.MARCHING_ORDERS]: { ...remove('boon', 'might'), fields: { internalCooldown: { from: 10, to: 7 } } } },
    'Core',
    [ID.EVISCERATE],
    {
      initialResource: 30,
      primaryWeapon: 'Axe',
      selectedTraitIds: [TRAIT.MARCHING_ORDERS, TRAIT.SOLDIERS_COMFORT, TRAIT.MARTIAL_CADENCE]
    }
  );
  const hit = result.events.find((event) => event.type === 'damage' && event.skillId === ID.EVISCERATE);
  assert.equal(observedRuntime(result).procs.deadline('warrior.core.soldierFocus'), hit.at + 7);
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
        [TRAIT.SUNDERING_BURST]: {
          ...remove('condition', 'Burst'),
          effects: [{ type: 'condition', name: 'Critical burst', stacks: { from: 10, to: 13 } }]
        }
      },
      'Core',
      [ID.EVISCERATE],
      {
        initialResource: 30,
        primaryWeapon: 'Axe',
        selectedTraitIds: [TRAIT.SUNDERING_BURST],
        attributeInputs: baseAttributeInputs({ precision })
      }
    );
    const hit = result.events.find((event) => event.type === 'damage');
    const proc = result.events.find((event) => event.sourceId === TRAIT.SUNDERING_BURST);
    assert.equal(proc?.stacks, precision === 0 ? undefined : 13);
    assert.equal(observedRuntime(result).procs.deadline(TRAIT.SUNDERING_BURST), hit.at + 5);
  }
});

for (const [type, name, skill, weapon] of [
  ['strike', 'Tier 3', ID.EVISCERATE, 'Axe'],
  ['condition', 'Tier 3', ID.BLOODTHIRSTER, 'Sword']
])
  test(`removed ${skill} tier suppresses its packet and retains burst spending`, () => {
    const result = runSkills({ [skill]: remove(type, name) }, 'Core', [skill], {
      initialResource: 30,
      primaryWeapon: weapon,
      selectedTraitIds: [TRAIT.BERSERKERS_POWER]
    });
    assert.equal(
      result.events.some((e) => e.skillId === skill && e.type === (type === 'strike' ? 'damage' : 'condition')),
      false
    );
    assert.ok(result.planningState.profession[STATE.ADRENALINE].value < 30);
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
    const result = runSkills({ [ID.COMBUSTIVE_SHOT]: remove(type, name) }, 'Core', [ID.COMBUSTIVE_SHOT], {
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
  const result = runSkills(
    { [ID.BERSERK]: { sideEffects: { berserk: remove('buff', 'berserk') } } },
    'Berserker',
    [ID.BERSERK],
    {
      initialResource: 30,
      selectedTraitIds: [TRAIT.BURST_OF_AGGRESSION]
    }
  );
  assert.equal(result.planningState.profession[STATE.BERSERK_UNTIL], null);
  assert.equal(result.planningState.profession[STATE.ADRENALINE].maximum, WARRIOR_MAXIMUM_ADRENALINE);
  assert.ok(result.planningState.profession[STATE.ADRENALINE].value < 30);
  assert.ok(result.events.some((e) => e.kind === 'quickness'));
  assert.equal(
    result.events.some((e) => e.kind === 'berserk'),
    false
  );
});

test('removed Heat the Soul Decapitate Quickness preserves Fury and Might', () => {
  // Remove the selected variant without touching the ordinary primal-burst packet.
  const result = run(
    { [TRAIT.HEAT_THE_SOUL]: remove('boon', 'Decapitate quickness') },
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
  const result = run({ [TRAIT.KING_OF_FIRES]: remove('strike', 'Strike') }, 'Berserker', ['Chop', ID.BERSERK], {
    primaryWeapon: 'Axe',
    initialResource: 30,
    attributeInputs: baseAttributeInputs({ precision: 10000 }),
    selectedTraitIds: [TRAIT.KING_OF_FIRES]
  });
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.sourceId === TRAIT.KING_OF_FIRES),
    false
  );
  assert.ok(result.events.some((event) => event.type === 'condition' && event.sourceId === TRAIT.KING_OF_FIRES));
  assert.equal(observedRuntime(result).profession.specialization.state.fireAuraUntil, 0);
});

for (const trait of [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND, TRAIT.RIVERS_FLOW]) {
  test('removed Positive Flow preserves its entry packet and cooldown: ' + trait, () => {
    const result = run(
      { [trait]: remove('buff', 'positive-flow') },
      'Bladesworn',
      ['__combat_start', { type: 'wait', durationMs: 1000 }, ID.UNSHEATHE_GUNSABER],
      { selectedTraitIds: [trait] }
    );
    const state = observedRuntime(result).profession.specialization.state;
    assert.equal(state.traitPositiveFlowUntil, 0);
    assert.equal(observedRuntime(result).procs.deadline('warrior.bladesworn.gunsaberSwapTrait'), 5);
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
  assert.deepEqual(result.planningState.profession[STATE.FLOW_STABILIZER_WINDOWS], []);
  assert.ok(result.events.some((e) => e.kind === 'fury'));
});

test('removed Artillery Slash strike preserves Bleeding, control, and ammo spending', () => {
  const result = runSkills(
    { [ID.SHARP_ARTILLERY_SLASH]: remove('strike', 'Strike') },
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
  const result = runSkills(
    { [ID.OVERCHARGED_CARTRIDGES]: { sideEffects: { cartridges: remove('buff', 'overcharged-cartridges') } } },
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES],
    { selectedSkillIds: [68085] }
  );
  assert.deepEqual(result.planningState.profession[STATE.OVERCHARGED_CARTRIDGE_WINDOWS], []);
  assert.equal(
    result.events.some((e) => e.kind === 'supercharged-cartridges'),
    false
  );
});

test('Artillery Slash control removal retains its strike', () => {
  const result = runSkills({ [ID.ARTILLERY_SLASH]: remove('control', 'Control') }, 'Bladesworn', [
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
    { [TRAIT.EMPOWER_ALLIES]: { fields: { pulseInterval: 0 } } },
    'Core',
    [{ type: 'wait', durationMs: 5000 }],
    { selectedTraitIds: [TRAIT.EMPOWER_ALLIES] }
  );
  assert.equal(
    allies.events.some((e) => e.sourceId === TRAIT.EMPOWER_ALLIES),
    false
  );
  const refrain = run(
    { [TRAIT.RALLY_THE_VALIANT]: { fields: { pulseInterval: 0 } } },
    'Paragon',
    [ID.CHANT_OF_ACTION, { type: 'wait', durationMs: 5000 }],
    { initialResource: 30 }
  );
  assert.equal(refrain.planningState.profession[STATE.MOTIVATION].value, 4);
  assert.equal(refrain.planningState.profession[STATE.ACTIVE_REFRAIN], 'Chant of Action');
});

test('Artillery Slash keeps ammo variant identity after first-strike removal and a surviving edit', () => {
  for (const charges of [1, 2]) {
    const result = runSkills(
      {
        [ID.ARTILLERY_SLASH]: {
          fields: { ammo: { from: 2, to: charges } },
          ...remove('strike', 'One round'),
          effects: [{ type: 'strike', name: 'Two rounds', coefficient: { from: 3, to: 4 } }]
        }
      },
      'Bladesworn',
      [ID.UNSHEATHE_GUNSABER, ID.ARTILLERY_SLASH],
      {}
    );
    const strike = result.events.find((event) => event.type === 'damage');
    assert.equal(strike?.coefficient, charges === 1 ? undefined : 4);
    assert.ok(result.events.some((event) => event.type === 'control'));
    assert.equal(observedRuntime(result).cooldownController.readAmmo(ID.ARTILLERY_SLASH).charges, 0);
  }
});

test('removed Spellbreaker buffs cannot retain Insight stacks or a tether window', () => {
  const result = run(
    { [TRAIT.ATTACKERS_INSIGHT]: remove('buff', 'attackers-insight') },
    'Spellbreaker',
    ['Kick', ID.BREACHING_STRIKE],
    {
      initialResource: 20,
      primaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT, TRAIT.MAGEBANE_TETHER]
    },
    { [ID.MAGEBANE_TETHER]: remove('buff', 'magebane-tether') }
  );
  const state = observedRuntime(result).profession.specialization.state;
  assert.deepEqual(state.attackerInsightExpiries, []);
  assert.equal(state.magebaneTetherUntil, 0);
});

test('Paragon opening Might removal preserves Fury, Motivation, and tooltip identity', () => {
  const skills = { [ID.CHANT_OF_ACTION]: { sideEffects: { chant: remove('boon', 'Entry Might') } } };
  const result = runSkills(skills, 'Paragon', [ID.CHANT_OF_ACTION], { initialResource: 30 });
  assert.equal(result.planningState.profession[STATE.MOTIVATION].value, 4);
  assert.ok(result.events.some((e) => e.kind === 'fury'));
  const catalog = applySkillPatch(warriorCatalog, { skills });
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
  const profession = warriorProfession.runtimeFor(config);
  const profiles = new Map(profession.catalog.balanceProfilesById);
  const original = profiles.get(TRAIT.MARCHING_ORDERS);
  const balanceDataContext = { professionId: 'warrior', patchId: 'broken' };
  const catalog = { ...profession.catalog, balanceProfilesById: profiles, balanceDataContext };
  const simulate = () =>
    observeGw2Runtime({ profession: { ...profession, catalog }, config, rotation: ['Eviscerate'] });
  profiles.delete(TRAIT.MARCHING_ORDERS);
  assert.throws(simulate, /profession=warrior patch=broken.*missing required profile/);
  for (const value of [undefined, null, '10', NaN, Infinity]) {
    profiles.set(TRAIT.MARCHING_ORDERS, { ...original, internalCooldown: value, balanceDataContext });
    assert.throws(simulate, /profession=warrior patch=broken.*field=internalCooldown/);
  }

  profiles.set(TRAIT.MARCHING_ORDERS, { ...original, internalCooldown: 0 });
  const result = simulate();
  assert.equal(
    observedRuntime(result).procs.deadline('warrior.core.soldierFocus'),
    result.events.find((event) => event.type === 'damage').at
  );
});

// Later resource mutations cannot change a burst's captured tier or discard its separate Might packet.
test('Eviscerate variants use captured adrenaline after the live pool changes', () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Axe',
    initialResource: 20,
    selectedTraitIds: [],
    attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000 }),
    target: { armor: 2597 }
  };
  const native = warriorProfession.runtimeFor(config);
  const result = observeGw2Runtime({
    profession: {
      ...native,
      onCastStart(runtime, cast) {
        native.onCastStart(runtime, cast);
        runtime.resourceController.replace('adrenaline', 30);
      }
    },
    config,
    rotation: [ID.EVISCERATE]
  });
  assert.deepEqual(result.warnings, []);
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === ID.EVISCERATE);
  assert.equal(strike.coefficient, 2.5);
  assert.equal(strike.metadata.warriorAdrenalineSpent, 20);
  assert.equal(strike.metadata.warriorBurstTier, 2);
  assert.ok(result.events.some((event) => event.kind === 'might' && event.skillId === ID.EVISCERATE));
});
