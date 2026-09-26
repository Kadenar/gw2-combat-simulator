import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ELEMENTALIST_TRAIT_IDS as ELE } from '#gw2/professions/elementalist/data/ids.js';
import { ENGINEER_TRAIT_IDS as ENG } from '#gw2/professions/engineer/data/ids.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/elementalist/core/profiles.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as HOLO } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { MECHANIST_BALANCE_PROFILE_IDS as MECH } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { EVOKER_BALANCE_PROFILE_IDS as EVOKER } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as CATALYST } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as ENGINEER } from '#gw2/professions/engineer/core/profiles.js';
import { procChanceFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';

// Minimal casts exercise the same patched catalog in scheduler and resolver paths.
function run(profession, balanceProfiles, specialization, rotation, config = {}, skills = {}) {
  const options = {
    profession: withPatchPreview(profession, {
      id: 'removal-contract',
      label: 'Removal contract',
      professions: { [profession.id]: { balanceProfiles, skills } }
    }),
    rotation: rotation.map((entry) =>
      typeof entry === 'string' ? { type: 'cast', skillId: profession.catalog.skillsByName.get(entry).id } : entry
    ),
    config: {
      patchId: 'removal-contract',
      specialization,
      selectedTraitIds: [],
      stats: { power: 2000, precision: 1000, conditionDamage: 1000, expertise: 0 },
      target: { armor: 2597, defiant: true, conditions: {} },
      ...config
    }
  };
  const result = runGw2Runtime({ ...options, profession: options.profession.liveRuntimeFor(options.config) });
  assert.deepEqual(result.warnings, []);
  return result;
}

for (const [type, name] of [
  ['strike', 'Sunspot'],
  ['buff', 'Sunspot Aura'],
  ['condition', 'Sunspot Burning']
]) {
  test(`Sunspot independently removes its ${type} and preserves siblings`, () => {
    const id = type === 'condition' ? CORE.burningRage : CORE.sunspot;
    const result = run(
      elementalistProfession,
      { [id]: { removeEffects: [{ type, name }] } },
      'Core',
      [{ type: 'combat-start' }, 'Fire Attunement', { type: 'wait', durationMs: 1000 }],
      { startAttunement: 'Air', selectedTraitIds: [ELE.SUNSPOT, ELE.BURNING_RAGE] }
    );
    const events = result.events.filter((event) => event.skillName === 'Sunspot');
    assert.equal(
      events.some((event) => event.type === 'damage'),
      type !== 'strike'
    );
    assert.equal(
      events.some((event) => event.type === 'elementalist.aura'),
      type !== 'buff'
    );
    assert.equal(
      events.some((event) => event.type === 'condition'),
      type !== 'condition'
    );
    if (type !== 'condition')
      assert.ok(events.filter((event) => event.type === 'condition').every((event) => event.stacks <= 1));
  });
}

test('removing the first HGH boon never substitutes the second boon', () => {
  const result = run(
    engineerProfession,
    { [ENG.HGH]: { removeEffects: [{ type: 'boon', name: 'might' }] } },
    'Core',
    ['Elixir Gun', 'Acid Bomb'],
    { selectedTraitIds: [ENG.HGH], selectedSkills: ['Elixir Gun'] }
  );
  const boons = result.events.filter((event) => event.type === 'buff' && event.sourceId === ENG.HGH);
  assert.equal(
    boons.some((event) => event.kind === 'might'),
    false
  );
  assert.equal(
    boons.some((event) => event.kind === 'fury'),
    true
  );
});

test('Holosmith heat follow-ups preserve conditions when the strike is removed', () => {
  const result = run(
    engineerProfession,
    {
      [HOLO.laserDiskHeatTier]: { removeEffects: [{ type: 'strike' }] }
    },
    'Holosmith',
    ['Laser Disk', { type: 'wait', durationMs: 1200 }],
    { initialHeat: 80, selectedSkills: ['Laser Disk'] }
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Laser Disk'),
    false
  );
  assert.ok(result.resolvedEvents.some((event) => event.type === 'condition' && event.condition === 'Bleeding'));
});

test('removing a mech chain entry keeps later attacks bound to their own names', () => {
  const result = run(
    engineerProfession,
    {
      [MECH.meleeChain]: { removeEffects: [{ type: 'strike', name: 'Hard Strike' }] }
    },
    'Mechanist',
    [{ type: 'wait', durationMs: 5000 }]
  );
  const attacks = result.events.filter((event) => event.type === 'damage' && event.actorType === 'summon');
  assert.equal(
    attacks.some((event) => event.name === 'Hard Strike'),
    false
  );
  assert.ok(attacks.some((event) => event.name === 'Heavy Smash (Mech)'));
  assert.ok(attacks.some((event) => event.name === 'Twin Strike (Mech)'));
});

test('removing Bountiful Power window preserves its independent Quickness', () => {
  const result = run(
    elementalistProfession,
    {
      [CORE.bountifulPower]: { fields: { threshold: 1 }, removeEffects: [{ type: 'buff', name: 'Damage Window' }] }
    },
    'Core',
    [{ type: 'combat-start' }, 'Air Attunement'],
    { selectedTraitIds: [ELE.BOUNTIFUL_POWER] }
  );
  assert.equal(
    result.events.some((event) => event.kind === 'bountiful power active'),
    false
  );
  assert.ok(result.events.some((event) => event.kind === 'quickness'));
});

test('proc overrides require a valid finite baseline and retain explicit zero', () => {
  const profile = { id: 1, procRate: { id: 'test.proc', field: 'procChance' }, procChance: 0.33 };
  const context = { balanceProfile: () => profile, config: { procRateOverrides: { 'test.proc': 0 } } };
  assert.equal(procChanceFromContext(context, 1), 0);
  for (const value of [undefined, null, '0.33', NaN, Infinity, -0.1, 1.1]) {
    profile.procChance = value;
    assert.throws(() => procChanceFromContext(context, 1), /Invalid balance data/);
  }
});

test('empty Sunspot effects emit neither an aura nor a proc marker', () => {
  const result = run(
    elementalistProfession,
    { [CORE.sunspot]: { removeEffects: [{ all: true }] } },
    'Core',
    [{ type: 'combat-start' }, 'Fire Attunement'],
    { startAttunement: 'Air', selectedTraitIds: [ELE.SUNSPOT] }
  );
  assert.equal(
    result.events.some((event) => event.skillName === 'Sunspot'),
    false
  );
  assert.deepEqual(result.planningState.profession.activeAuras, []);
});

test('removed Ignite tier stays empty while the next named tier retains its duration edit', () => {
  const result = run(
    elementalistProfession,
    {
      [EVOKER.ignite]: {
        removeEffects: [{ type: 'condition', name: 'Tier 1' }],
        effects: [{ type: 'condition', name: 'Tier 2', duration: { from: 0.5, to: 9 } }]
      }
    },
    'Evoker',
    ['Ignite', 'Rejuvenate', 'Ignite', { type: 'wait', durationMs: 1000 }],
    { selectedSkills: ['Rejuvenate'] }
  );
  const burns = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Ignite' && !event.cancelled
  );
  assert.ok(burns.length > 0);
  assert.ok(burns.every((event) => event.duration === 9));
});

test('Rocket Punch keeps Burning and control when its strike is removed', () => {
  const result = run(engineerProfession, { [MECH.rocketPunch]: { removeEffects: [{ type: 'strike' }] } }, 'Mechanist', [
    'Lightning Rod',
    { type: 'wait', durationMs: 1000 }
  ]);
  const packets = result.events.filter((event) => event.skillName === 'Rocket Punch (Mech)');
  assert.equal(
    packets.some((event) => event.type === 'damage'),
    false
  );
  assert.ok(packets.some((event) => event.type === 'condition'));
  assert.ok(packets.some((event) => event.type === 'control'));
});

test('patched resource capacities seed simulation and presentation from the same catalog', () => {
  for (const [profession, specialization, profile, field] of [
    [elementalistProfession, 'Catalyst', CATALYST.resources, 'energy'],
    [elementalistProfession, 'Evoker', EVOKER.resources, 'charges'],
    [engineerProfession, 'Core', ENGINEER.resources, 'endurance']
  ]) {
    const balanceProfiles = { [profile]: { fields: { maximumStacks: 12 } } };
    const result = run(profession, balanceProfiles, specialization, []);
    assert.equal(result.planningState.profession[field], 12);
    const patched = withPatchPreview(profession, {
      id: 'capacity',
      label: 'Capacity',
      professions: { [profession.id]: { balanceProfiles } }
    });
    const views = patched.ui.resourceViews({
      specialization,
      catalog: patched.catalogFor('capacity'),
      build: { specializations: [{ name: 'Tools', traits: '1-1-1' }] }
    });
    const resource = views.find((view) => ['catalyst-energy', 'evoker-charges', 'endurance'].includes(view.id));
    assert.equal(resource.maximum, 12);
    assert.equal(resource.value, 12);
  }

  const balanceProfiles = { [EVOKER.specializedElements]: { fields: { maximumStacks: 8 } } };
  const specialized = run(elementalistProfession, balanceProfiles, 'Evoker', [], {
    selectedTraitIds: [ELE.SPECIALIZED_ELEMENTS]
  });
  assert.equal(specialized.planningState.profession.charges, 8);
  const patched = withPatchPreview(elementalistProfession, {
    id: 'specialized-capacity',
    label: 'Specialized capacity',
    professions: { elementalist: { balanceProfiles } }
  });
  const [charges] = patched.ui.resourceViews({
    specialization: 'Evoker',
    catalog: patched.catalogFor('specialized-capacity'),
    build: { specializations: [{ name: 'Evoker', traits: '1-1-3' }] }
  });
  assert.equal(charges.maximum, 8);
  assert.equal(charges.value, 8);
});

test('removing Cleansing Burst boons preserves its water field', () => {
  const id = engineerProfession.catalog.skillsByName.get('Cleansing Burst').id;
  const result = run(
    engineerProfession,
    {},
    'Core',
    ['Healing Turret', { type: 'wait', durationMs: 1000 }],
    { selectedSkills: ['Healing Turret'] },
    { [id]: { removeEffects: [{ type: 'boon' }] } }
  );
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.skillId === id),
    false
  );
  assert.ok(
    result.events.some((event) => event.type === 'combo_field' && event.skillId === id && event.fieldType === 'Water')
  );
});
