import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { applyGuardianBuildAttributeRules } from '#gw2/professions/guardian/build/attributes.js';
import { createGuardianBuildDefaults } from '#gw2/professions/guardian/build/build.js';
import { guardianVirtueForSlot } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/core/profiles.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { LUMINARY_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { WILLBENDER_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Attribute assertions use the same calculator composed into the Guardian adapter.
const calculateGuardianAttributes = createCalculateAttributes(
  applyGuardianBuildAttributeRules,
  guardianProfession.attributeContributions
);

const config = {
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  }),
  target: { armor: 2597 }
};

// Pull expires with the tether, restoring the parent tile without resetting its cooldown.
test('Binding Blade flips back when its ten-second tether expires', () => {
  const parent = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.BINDING_BLADE);
  const settings = { ...config, primaryWeapon: 'Greatsword' };
  for (const durationMs of [9960, 10000, 10040]) {
    const expired = durationMs >= 10000;
    const rotation = ['Binding Blade', { type: 'wait', durationMs }];
    const result = createObservedProfessionSimulator(guardianProfession, settings)(undefined, rotation);
    assert.deepEqual(result.warnings, []);
    const tiles = displayedSkillTiles(
      { skills: guardianCatalog.skills, profession: guardianProfession, results: result },
      [parent]
    );
    assert.deepEqual(
      tiles.map((skill) => skill.id),
      [expired ? parent.id : GUARDIAN_SKILL_IDS.PULL]
    );
    assert.ok(result.planningState.cooldowns[parent.id].remaining > 0);

    const pull = createObservedProfessionSimulator(guardianProfession, settings)(undefined, [...rotation, 'Pull']);
    assert.equal(Boolean(pull.steps.at(-1).invalid), expired);
    if (expired) assert.match(pull.warnings.join(' '), /not currently armed/);
    else assert.deepEqual(pull.warnings, []);
    assert.equal(pull.planningState.cooldowns[parent.id].readyAt, result.planningState.cooldowns[parent.id].readyAt);
  }
});

// Slot decoding preserves trailing-digit compatibility and leaves skill eligibility to callers.
test('Guardian virtue slots decode consistently and reject unmapped slots', () => {
  for (const [slot, virtue] of [
    ['Profession_1', 'justice'],
    ['Profession_2', 'resolve'],
    ['Profession_3', 'courage'],
    ['custom_12', 'resolve'],
    ['Profession_0', null],
    ['Profession_4', null],
    ['Profession_1_extra', null],
    ['', null],
    [undefined, null]
  ]) {
    assert.equal(guardianVirtueForSlot(slot), virtue);
  }
});

const applyGuardianPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(guardianCatalog, patch), patch);

const authoringGuardianProfession = withActivePatchPreview(guardianProfession);

// Singleton impact migration keeps patch selectors independent and leaves the base catalog intact.
test('Guardian grouped impacts support payload patches without changing sibling effects', () => {
  const id = GUARDIAN_SKILL_IDS.JURISDICTION;
  const original = guardianCatalog.skillsById.get(id);
  const preview = applySkillPatch(guardianCatalog, {
    skills: {
      [id]: {
        coefficient: { from: 3, to: 4 },
        conditions: { Burning: { duration: { from: 6, to: 7 } } }
      }
    }
  });
  const patched = preview.skillsById.get(id);

  // A condition selector updates every independent burn without altering the sibling control effect.
  assert.deepEqual(
    patched.effects,
    original.effects.map((effect) =>
      effect.type === 'strike'
        ? { ...effect, coefficient: 4 }
        : effect.condition === 'Burning'
          ? { ...effect, duration: 7 }
          : effect
    )
  );
  assert.equal(original.effects[0].coefficient, 3);
  assert.equal(original.effects[1].duration, 6);
});

// These fields span the symbol's pulses, including when the opening offset changes.
test('Symbol of Blades and Symbol of Faith fields follow their pulse windows', () => {
  for (const id of [GUARDIAN_SKILL_IDS.SYMBOL_OF_BLADES, GUARDIAN_SKILL_IDS.SYMBOL_OF_FAITH]) {
    const skill = guardianCatalog.skillsById.get(id);
    const strike = skill.effects.find((effect) => effect.type === 'strike');
    const field = skill.comboFields[0];

    assert.equal(field.startAnchor, strike.timingAnchor);
    assert.equal(field.startMs, strike.ticks[0].atMs);
    assert.equal(field.startMs + field.duration * 1000, strike.ticks.at(-1).atMs);
  }
});

test('Symbol of Luminance retains both strikes on the exact combat boundary', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Spear',
    boons: { quickness: true }
  })(undefined, ['Symbol of Luminance', { name: '__combat_start', offset: 360 }]);
  // Same-time damage is observable without moving combat one millisecond before the action tick.
  const openingHits = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' &&
      event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_LUMINANCE &&
      Math.abs(event.at - 0.36) < 1e-9
  );
  assert.equal(openingHits.length, 2);
  assert.ok(openingHits.every((event) => event.damage > 0));
});

test('Guardian slot skills require selection before casts can produce effects', () => {
  // A single cast checks loadout rejection, including Effulgent's delayed detonation.
  for (const name of ['Effulgent Stance', 'Shelter', 'Renewed Focus']) {
    for (const selectedSkillIds of [[], [9151]]) {
      const result = createObservedProfessionSimulator(guardianProfession, {
        ...config,
        specialization: 'Luminary',
        selectedSkillIds
      })(undefined, [name, { type: 'wait', durationMs: 5000 }]);
      assert.equal(result.steps[0].invalid, true, name);
      assert.match(result.warnings.join(' '), /is unavailable.*not equipped/);
      assert.equal(
        result.resolvedEvents.some((event) => event.skillName === name || event.name === name),
        false
      );
    }
  }

  for (const selectedSkillIds of [undefined, [76813]]) {
    const result = createObservedProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      selectedSkillIds
    })(undefined, ['Effulgent Stance', { type: 'wait', durationMs: 5000 }]);
    assert.deepEqual(result.warnings, []);
    assert.ok(result.resolvedEvents.some((event) => event.name === 'Effulgent Stance' && event.damage > 0));
  }
});

test('Guardian mantra flips inherit selection from the root slot skill', () => {
  for (const selectedSkillIds of [[], [46148]]) {
    const result = createObservedProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Firebrand',
      selectedSkillIds
    })(undefined, ['Flame Rush', 'Flame Rush', 'Flame Surge']);
    if (selectedSkillIds.length) {
      assert.deepEqual(result.warnings, []);
      assert.ok(result.resolvedEvents.some((event) => event.name === 'Flame Surge'));
    } else {
      assert.ok(result.steps.every((step) => step.invalid));
      assert.match(result.warnings.join(' '), /not equipped/);
      assert.equal(
        result.resolvedEvents.some((event) => ['Flame Rush', 'Flame Surge'].includes(event.name)),
        false
      );
    }
  }
});

test('Virtue of Resolution extends delivered boons once without creating extra symbol reactions', () => {
  // Compare identical symbol casts so only the selected duration modifier changes.
  for (const [specialization, rotation] of [
    ['Core', ['Symbol of Resolution']],
    ['Luminary', ['Enter Radiant Forge', 'Luminous Staff']],
    ['Luminary', ['Enter Radiant Forge', 'Radiant Bulwark', 'Glaring Burst']]
  ]) {
    const run = (selectedTraitIds) =>
      createObservedProfessionSimulator(guardianProfession, {
        ...config,
        primaryWeapon: 'Greatsword',
        selectedTraitIds
      })(specialization, [...rotation, { type: 'wait', durationMs: 6000 }]);
    const baseline = run([GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE]);
    const traited = run([GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE]);
    const resolution = (result) =>
      result.events.filter((event) => event.type === 'buff' && event.kind === 'resolution');
    assert.ok(resolution(baseline).length > 0);
    assert.deepEqual(
      resolution(traited).map((event) => event.duration),
      resolution(baseline).map((event) => event.duration * 1.25)
    );
    const exposure = (result) =>
      result.resolvedEvents.filter(
        (event) => event.type === 'condition' && event.sourceId === GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE
      );
    assert.equal(exposure(traited).length, exposure(baseline).length);
    assert.deepEqual(traited.warnings, []);
  }
});

test('Guardian modules expose isolated balance-profile authoring', () => {
  const modules = new Map(authoringGuardianProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) => {
    const module = modules.get(moduleId);

    return [...module.balanceProfiles, ...module.skillVariants].find((entry) => entry.id === profileId);
  };

  assert.equal(profile('Core', GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice).profile.threshold, 5);
  assert.equal(profile('Dragonhunter', DRAGONHUNTER_BALANCE_PROFILE_IDS.tether).profile.effects[0].duration, 2);
  assert.equal(profile('Firebrand', FIREBRAND_BALANCE_PROFILE_IDS.resources).patchableFields.maximumStacks, 5);
  assert.equal(
    profile('Willbender', WILLBENDER_BALANCE_PROFILE_IDS.flames).profile.effects[0].ticks[0].coefficient,
    0.22
  );
  assert.equal(profile('Luminary', LUMINARY_BALANCE_PROFILE_IDS.forge).patchableFields.rechargeReduction, 5);
  // Authoring must not advertise scalars that gameplay never reads.
  for (const [moduleId, profileId, fields] of [
    ['Willbender', WILLBENDER_BALANCE_PROFILE_IDS.flames, ['maximumStacks', 'pulseInterval']],
    ['Luminary', LUMINARY_BALANCE_PROFILE_IDS.forge, ['maximumStacks', 'threshold']]
  ]) {
    for (const field of fields) assert.equal(Object.hasOwn(profile(moduleId, profileId).patchableFields, field), false);
  }

  assert.equal(profile('Core', GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE).patchableFields.damagePerBoon, 0.005);
  assert.equal(profile('Firebrand', GUARDIAN_TRAIT_IDS.IMBUED_HASTE).patchableFields.attributeBonus, 250);

  const preview = applyGuardianPatch({
    skills: {
      [GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE]: {
        effects: [
          {
            effectIndex: 0,
            coefficient: { from: 0.8, to: 0.9 }
          }
        ]
      }
    },
    balanceProfiles: {
      [GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice]: {
        fields: { threshold: { from: 5, to: 4 } }
      },
      [DRAGONHUNTER_BALANCE_PROFILE_IDS.tether]: {
        effects: [
          {
            effectIndex: 0,
            duration: { from: 2, to: 3 }
          }
        ]
      },
      [FIREBRAND_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 5, to: 6 } }
      },
      [WILLBENDER_BALANCE_PROFILE_IDS.flames]: {
        effects: [
          {
            effectIndex: 0,
            tickIndex: 'all',
            coefficient: { from: 0.22, to: 0.3 }
          }
        ]
      },
      [LUMINARY_BALANCE_PROFILE_IDS.forge]: {
        fields: { rechargeReduction: { from: 5, to: 6 } }
      }
    }
  });

  assert.equal(preview.skillsById.get(GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE).effects[0].coefficient, 0.9);
  assert.equal(preview.balanceProfilesById.get(GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice).threshold, 4);
  assert.equal(preview.balanceProfilesById.get(DRAGONHUNTER_BALANCE_PROFILE_IDS.tether).effects[0].duration, 3);
  assert.equal(preview.balanceProfilesById.get(FIREBRAND_BALANCE_PROFILE_IDS.resources).maximumStacks, 6);
  assert.ok(
    preview.balanceProfilesById
      .get(WILLBENDER_BALANCE_PROFILE_IDS.flames)
      .effects[0].ticks.every((tick) => tick.coefficient === 0.3)
  );
  assert.equal(preview.balanceProfilesById.get(LUMINARY_BALANCE_PROFILE_IDS.forge).rechargeReduction, 6);

  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE).effects[0].coefficient, 0.8);
  assert.equal(guardianCatalog.balanceProfilesById.get(GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice).threshold, 5);
  assert.equal(guardianCatalog.balanceProfilesById.get(FIREBRAND_BALANCE_PROFILE_IDS.resources).maximumStacks, 5);
});

test('Masterful Writ utilities grant their flat attributes', () => {
  const baseline = createGuardianBuildDefaults();

  baseline.utility = '';
  const strength = structuredClone(baseline);

  strength.utility = 'Writ of Masterful Strength';
  const malice = structuredClone(baseline);

  malice.utility = 'Writ of Masterful Malice';

  const baselineAttributes = calculateGuardianAttributes(baseline, []).attributes;
  const strengthAttributes = calculateGuardianAttributes(strength, []).attributes;
  const maliceAttributes = calculateGuardianAttributes(malice, []).attributes;

  assert.equal(strengthAttributes.Power.utility, 200);
  assert.equal(strengthAttributes.Power.final - baselineAttributes.Power.final, 200);
  assert.equal(maliceAttributes['Condition Damage'].utility, 200);
  assert.equal(maliceAttributes['Condition Damage'].final - baselineAttributes['Condition Damage'].final, 200);
});

test('Justice active burning resolves through simulateGw2', () => {
  const withoutJustice = createObservedProfessionSimulator(guardianProfession, config)(undefined, ['True Strike']);
  const withJustice = createObservedProfessionSimulator(guardianProfession, config)(undefined, [
    'Virtue of Justice',
    'True Strike',
    { type: 'wait', durationMs: 2000 }
  ]);

  assert.equal(withoutJustice.conditionDamage, 0);
  assert.ok(withJustice.conditionDamage > 0);
  assert.equal(
    withJustice.planningState.profession.justiceActiveBurns + withJustice.planningState.profession.justicePassiveBurns,
    1
  );
  assert.equal(withJustice.planningState.profession.justiceActiveBurns, 1);
  assert.equal(withJustice.planningState.profession.justiceActiveArmed, false);
  assert.equal(
    withJustice.procSteps.find((step) => step.skill === 'Justice Active')?.icon,
    guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.JUSTICE).icon
  );
});

test('Justice passive counts individual hits and respects its active cooldown', () => {
  const passive = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Greatsword' })(
    undefined,
    ['Whirling Wrath']
  );
  const activated = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Greatsword' })(
    undefined,
    ['Virtue of Justice', 'Whirling Wrath']
  );
  const permeating = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Greatsword',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH]
  })(undefined, ['Whirling Wrath']);
  const radiantPassive = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword'
  })(undefined, ['Whirling Wrath']);
  const radiantPermeating = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH]
  })(undefined, ['Whirling Wrath']);
  const radiantActivated = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword'
  })(undefined, ['Radiant Justice', 'Whirling Wrath']);

  assert.equal(passive.planningState.profession.justicePassiveBurns, 2);
  assert.equal(observedRuntime(passive).profession.core.justiceHitCount, 4);
  assert.equal(activated.planningState.profession.justiceActiveBurns, 1);
  assert.equal(activated.planningState.profession.justicePassiveBurns, 0);
  assert.equal(observedRuntime(activated).profession.core.virtueReadyAt.justice, 16);
  assert.equal(permeating.planningState.profession.justicePassiveBurns, 4);
  assert.equal(observedRuntime(permeating).profession.core.justiceHitCount, 2);
  assert.equal(radiantPassive.planningState.profession.justicePassiveBurns, 2);
  assert.equal(observedRuntime(radiantPassive).profession.core.justiceHitCount, 4);
  assert.equal(radiantPermeating.planningState.profession.justicePassiveBurns, 4);
  assert.equal(observedRuntime(radiantPermeating).profession.core.justiceHitCount, 2);
  assert.equal(radiantActivated.planningState.profession.justicePassiveBurns, 0);
});

test('Justice counts symbol packets and applies the measured two-second passive burn', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword'
  })(undefined, ['Symbol of Resolution', { type: 'wait', durationMs: 6000 }]);
  const burn = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.justice-passive'
  );
  const proc = result.procSteps.find((step) => step.skill === 'Justice Passive');

  assert.equal(result.planningState.profession.justicePassiveBurns, 1);
  assert.equal(burn.duration, 2);
  assert.equal(proc.sourceSkill, 'Symbol of Resolution');
});

// Tether damage is a non-critical flat strike and must remain attributed to its own breakdown row.
test('Binding Blade tether resolves flat non-critical strike damage', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Greatsword' })(
    undefined,
    ['Binding Blade', { type: 'wait', durationMs: 15000 }]
  );
  const tether = result.resolvedEvents.filter((event) => event.sourceId === GUARDIAN_SKILL_IDS.BINDING_BLADE_TETHER);
  assert.deepEqual(result.warnings, []);
  assert.ok(tether.length > 0);
  assert.ok(tether.every((event) => event.canCrit === false));
  assert.ok(tether.every((event) => event.flatStrikeBase === 160 && event.flatStrikePowerCoeff === 0.3));
  const breakdown = result.breakdown.find((entry) => entry.sourceId === GUARDIAN_SKILL_IDS.BINDING_BLADE_TETHER);
  assert.equal(
    breakdown.strikeDamage,
    tether.reduce((damage, event) => damage + event.damage, 0)
  );
  assert.equal(breakdown.conditionDamage, 0);
  assert.equal(breakdown.hits, tether.length);
});

// The symbol burns on its opening strike rather than reapplying Burning on every pulse.
test('Symbol of Energy applies Burning only with its opening strike', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Longbow' })(
    undefined,
    ['Symbol of Energy', { type: 'wait', durationMs: 6000 }]
  );
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Symbol of Energy'
  );
  const burning = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Symbol of Energy' && event.condition === 'Burning'
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(strikes.length > 1);
  assert.equal(burning.length, 1);
  assert.equal(burning[0].at, strikes[0].at);
});

// Exhausting the spirit weapon's charges must wait for recharge after the shorter between-use lockout.
test('Sword of Justice waits for ammo recharge after exhausting its charges', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, boons: { quickness: true } })(
    undefined,
    ['Sword of Justice', 'Sword of Justice', 'Sword of Justice', 'Sword of Justice']
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 1400, 2800, 12600]
  );
});

test('Delayed spear damage uses equipped-weapon trait stats while retaining spear weapon strength', () => {
  // Swapping during projectile travel changes Zealous Blade's power bonus, not the attack's weapon-strength roll.
  const simulate = (swap) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Spear',
      weaponSet2Primary: 'Greatsword',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE]
    })(undefined, ['Solar Storm', ...(swap ? ['Swap Weapons'] : []), { type: 'wait', durationMs: 2000 }]);
  const firstHit = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.SOLAR_STORM);
  const spear = firstHit(simulate(false));
  const greatsword = firstHit(simulate(true));

  assert.equal(Math.round(spear.at * 1000), 1120);
  assert.equal(greatsword.resolvedWeaponStrength, spear.resolvedWeaponStrength);
  assertFlooredDamageMultiplier(greatsword.damage, spear.damage, (2000 + 240) / (2000 + 120));
});

test('Spear Helio Rush arms Illuminated and enhances the next spear skill', () => {
  const spearConfig = { ...config, primaryWeapon: 'Spear' };

  const helioAlone = createObservedProfessionSimulator(guardianProfession, spearConfig)(undefined, ['Helio Rush']);
  const gleamingAlone = createObservedProfessionSimulator(guardianProfession, spearConfig)(undefined, [
    'Gleaming Disc',
    { type: 'wait', durationMs: 1000 }
  ]);
  const combo = createObservedProfessionSimulator(guardianProfession, spearConfig)(undefined, [
    'Helio Rush',
    'Gleaming Disc',
    { type: 'wait', durationMs: 1000 }
  ]);

  // Helio Rush is not illuminated itself but arms the buff for the next attack.
  assert.equal(helioAlone.planningState.profession.spearIlluminatedArmed, true);
  assert.equal(
    helioAlone.procSteps.some((step) => step.skill === 'Illuminated'),
    false
  );
  assert.equal(
    helioAlone.events.some((event) => event.type === 'buff' && event.kind === 'resolution' && event.duration === 4),
    true
  );
  assert.equal(
    gleamingAlone.procSteps.some((step) => step.skill === 'Illuminated'),
    false
  );

  // The armed buff makes Gleaming Disc illuminated: an "Illuminated" proc fires
  // and the combo out-damages the two skills cast in isolation.
  const illuminated = combo.procSteps.filter((step) => step.skill === 'Illuminated');

  assert.equal(illuminated.length, 1);
  assert.equal(illuminated[0].sourceSkill, 'Gleaming Disc');
  assert.ok(combo.strikeDamage > helioAlone.strikeDamage + gleamingAlone.strikeDamage + 1);

  const expired = createObservedProfessionSimulator(guardianProfession, spearConfig)(undefined, [
    'Helio Rush',
    { type: 'wait', durationMs: 5001 },
    'Gleaming Disc',
    { type: 'wait', durationMs: 1000 }
  ]);

  assert.deepEqual(
    expired.resolvedEvents
      .filter((event) => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map((event) => event.coefficient),
    [1.5, 1.5]
  );

  const preservedThroughFiller = createObservedProfessionSimulator(guardianProfession, spearConfig)(undefined, [
    'Helio Rush',
    'Daybreaking Slash',
    'Gleaming Disc',
    { type: 'wait', durationMs: 1000 }
  ]);

  assert.deepEqual(
    preservedThroughFiller.resolvedEvents
      .filter((event) => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map((event) => event.coefficient),
    [1.5, 2.25]
  );
});

test('Inspired Virtue emits its base boon through the shared boon-duration policy', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE],
    attributeInputs: baseAttributeInputs({ ...config.attributeInputs?.weaponSets[0].commonTotals, concentration: 750 })
  })(undefined, ['Virtue of Courage']);
  const protection = result.events.find(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE
  );

  assert.ok(protection);
  assert.equal(protection.kind, 'protection');
  assert.equal(protection.duration, 7.5);
});

test('Spear Symbol of Luminance keeps all spear skills illuminated while active', () => {
  const spearConfig = { ...config, primaryWeapon: 'Spear' };

  const symbolThenHelio = createObservedProfessionSimulator(guardianProfession, {
    ...spearConfig,
    boons: { quickness: true }
  })(undefined, ['Symbol of Luminance', 'Helio Rush']);
  // The window empowers Helio Rush even though nothing armed it beforehand.
  assert.ok(symbolThenHelio.planningState.profession.spearLuminanceUntil > 0);
  // Both spear proc notifications declare effect ownership before reaching timeline consumers.
  for (const name of ['Symbol of Luminance', 'Illuminated']) {
    const proc = symbolThenHelio.events.find((event) => event.type === 'proc' && event.name === name);
    assert.ok(proc, `${name} proc must be emitted`);
    assert.equal(proc.actorType, 'effect');
  }

  assert.equal(
    symbolThenHelio.procSteps.some((step) => step.skill === 'Illuminated' && step.sourceSkill === 'Helio Rush'),
    true
  );
  assert.deepEqual(
    symbolThenHelio.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.HELIO_RUSH)
      .map((event) => event.coefficient),
    [2.25]
  );
});

test('Spear Symbol of Luminance knocks back on its initial hit', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Spear' })(
    undefined,
    ['Symbol of Luminance']
  );
  const initialHit = result.events.find(
    (event) => event.type === 'damage' && event.name === 'Symbol of Luminance — Initial'
  );
  const controls = result.events.filter(
    (event) => event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_LUMINANCE
  );

  assert.ok(initialHit);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].controlKind, 'knockback');
  assert.equal(controls[0].at, initialHit.at);
});

test('Guardian swaps weapons and exposes profession palette groups', () => {
  // A real destination is required before a weapon swap can change sets.
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Sword',
    weaponSet2Primary: 'Scepter'
  })(undefined, ['Swap Weapons']);

  assert.equal(result.planningState.activeWeaponSet, 2);
  assert.deepEqual(guardianProfession.ui.resourceViews({}), []);
  assert.deepEqual(guardianProfession.ui.paletteGroups({})[0].skillIds, [
    GUARDIAN_SKILL_IDS.JUSTICE,
    GUARDIAN_SKILL_IDS.RESOLVE,
    GUARDIAN_SKILL_IDS.COURAGE
  ]);
});

test('weapon swap ignores Alacrity and Relic of the Warrior reduces its recharge to 7.5 seconds', () => {
  const swapStarts = (extraConfig) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Sword',
      weaponSet2Primary: 'Scepter',
      ...extraConfig
    })(undefined, ['__combat_start', 'Swap Weapons', 'Swap Weapons'])
      .steps.filter((step) => step.skill === 'Swap Weapons')
      .map((step) => step.start);

  assert.deepEqual(swapStarts({ boons: { alacrity: true } }), [0, 10000]);
  assert.deepEqual(swapStarts({ boons: { alacrity: true }, relic: 'Warrior' }), [0, 7520]);
});

test('Guardian palettes keep inactive tome and forge skills visible', () => {
  const inactiveFirebrand = {
    specialization: 'Firebrand',
    professionState: {
      activeTome: '',
      tomePages: { value: 5, maximum: 5, updatedAt: 0, rate: 0, interval: 8, amount: 1, nextAt: Infinity },
      radiantForge: false
    }
  };
  const activeFirebrand = {
    ...inactiveFirebrand,
    professionState: {
      ...inactiveFirebrand.professionState,
      activeTome: 'justice'
    }
  };
  const inactiveFirebrandGroups = guardianProfession.ui.paletteGroups(inactiveFirebrand);
  const activeFirebrandGroups = guardianProfession.ui.paletteGroups(activeFirebrand);
  const dormantFirebrandGroup = guardianProfession.ui.paletteGroups({
    ...inactiveFirebrand,
    time: 10,
    professionState: {
      ...inactiveFirebrand.professionState,
      tomeDormantReadyAt: { justice: 20, resolve: 10, courage: 30 }
    }
  })[0];
  const groupIds = (groups) => groups.map((group) => group.id);

  assert.deepEqual(groupIds(inactiveFirebrandGroups), ['profession', 'tome-justice', 'tome-resolve', 'tome-courage']);
  assert.deepEqual(
    activeFirebrandGroups.map((group) => group.skillIds),
    inactiveFirebrandGroups.map((group) => group.skillIds)
  );
  assert.deepEqual(dormantFirebrandGroup.resourceIds, ['pages']);
  assert.equal(dormantFirebrandGroup.resourcePlacement, 'above');
  assert.match(dormantFirebrandGroup.className, /tome-justice-dormant/);
  assert.doesNotMatch(dormantFirebrandGroup.className, /tome-resolve-dormant/);
  assert.match(dormantFirebrandGroup.className, /tome-courage-dormant/);
  assert.equal(
    inactiveFirebrandGroups
      .find((group) => group.id === 'tome-justice')
      .skillIds.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL),
    true
  );
  assert.equal(
    inactiveFirebrandGroups
      .find((group) => group.id === 'tome-resolve')
      .skillIds.includes(GUARDIAN_SKILL_IDS.DESERT_BLOOM),
    true
  );
  assert.equal(
    inactiveFirebrandGroups
      .find((group) => group.id === 'tome-courage')
      .skillIds.includes(GUARDIAN_SKILL_IDS.UNFLINCHING_CHARGE),
    true
  );

  const inactiveForgeGroups = guardianProfession.ui.paletteGroups({
    specialization: 'Luminary',
    professionState: { radiantForge: false }
  });
  const activeForgeGroups = guardianProfession.ui.paletteGroups({
    specialization: 'Luminary',
    professionState: { radiantForge: true }
  });

  assert.deepEqual(
    inactiveForgeGroups.map((group) => group.stackId),
    ['luminary-profession', 'luminary-profession']
  );
  assert.deepEqual(
    activeForgeGroups.map((group) => group.skillIds),
    inactiveForgeGroups.map((group) => group.skillIds)
  );
  assert.equal(
    inactiveForgeGroups
      .find((group) => group.id === 'radiant-forge')
      .skillIds.includes(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER),
    true
  );
});

test('Guardian palette availability follows the active tome or forge', () => {
  for (const activeTome of ['', 'justice']) {
    const state = planningFixture(guardianProfession, { specialization: 'Firebrand' }, (runtime) => {
      runtime.profession.specialization.state.activeTome = activeTome;
    });
    assert.equal(state.availability[guardianCatalog.skillsByName.get('True Strike').id].ready, !activeTome);
    assert.equal(state.availability[GUARDIAN_SKILL_IDS.SEARING_SPELL].ready, Boolean(activeTome));
    assert.equal(state.availability[GUARDIAN_SKILL_IDS.DESERT_BLOOM].ready, false);
  }

  for (const radiantForge of [false, true]) {
    const state = planningFixture(guardianProfession, { specialization: 'Luminary' }, (runtime) => {
      runtime.profession.specialization.state.radiantForge = radiantForge;
    });
    assert.equal(state.availability[guardianCatalog.skillsByName.get('True Strike').id].ready, !radiantForge);
    assert.equal(state.availability[GUARDIAN_SKILL_IDS.DAZZLING_HAMMER].ready, radiantForge);
  }
});

test('Guardian only casts weapon skills equipped on the active set', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    weaponSet2Primary: 'Pistol',
    weaponSet2Secondary: 'Torch'
  })(undefined, ['Through the Heart', 'Swap Weapons', 'Through the Heart']);

  assert.equal(
    result.resolvedEvents.filter((event) => event.skillName === 'Through the Heart' && event.type === 'damage').length,
    1
  );
  assert.match(result.warnings.join(' '), /Through the Heart is unavailable/);
});

test('Guardian cannot cast weapon skills while a tome or forge is active', () => {
  const firebrand = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Firebrand',
    primaryWeapon: 'Mace'
  })(undefined, ['Tome of Justice', 'True Strike', 'Stow Tome', 'True Strike']);
  const luminary = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Mace'
  })(undefined, ['Enter Radiant Forge', 'True Strike', 'Exit Radiant Forge', 'True Strike']);

  assert.equal(firebrand.steps[1].invalid, true);
  assert.equal(Boolean(firebrand.steps[3].invalid), false);
  assert.equal(luminary.steps[1].invalid, true);
  assert.equal(Boolean(luminary.steps[3].invalid), false);
});
