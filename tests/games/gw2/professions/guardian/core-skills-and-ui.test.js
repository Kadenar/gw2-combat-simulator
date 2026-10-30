import assert from 'node:assert/strict';
import test from 'node:test';

import { displayedSkillTiles, paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { guardianAppAdapter } from '#gw2/professions/guardian/app/app-definition.js';
import { createGuardianBuildDefaults } from '#gw2/professions/guardian/build/build.js';
import { guardianVirtueForSlot } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import {
  createObservedProfessionSimulator,
  observedRuntime,
  planningFixture
} from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Attribute assertions use the same calculator composed into the Guardian adapter.
const calculateGuardianAttributes = createCalculateAttributes(
  createProfessionBuildAttributeRules(guardianCatalog),
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
      { activeCatalog: guardianCatalog, profession: guardianProfession, results: result },
      [parent]
    );
    assert.deepEqual(
      tiles.map((skill) => skill.id),
      [expired ? parent.id : GUARDIAN_SKILL_IDS.PULL]
    );
    assert.ok(result.planningState.cooldowns[parent.id].remaining > 0);

    const pull = createObservedProfessionSimulator(guardianProfession, settings)(undefined, [...rotation, 'Pull']);
    assert.equal(Boolean(pull.steps.at(-1).invalid), expired);

    if (expired) assert.match(pull.warnings.map(({ message }) => message).join(' '), /not currently armed/);
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
    assert.equal(field.startMs, strike.atMs);
    assert.equal(field.startMs + field.duration * 1000, strike.atMs + (strike.applications - 1) * strike.intervalMs);
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
      assert.match(result.warnings.map(({ message }) => message).join(' '), /is unavailable.*not equipped/);
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
      assert.match(result.warnings.map(({ message }) => message).join(' '), /not equipped/);
      assert.equal(
        result.resolvedEvents.some((event) => ['Flame Rush', 'Flame Surge'].includes(event.name)),
        false
      );
    }
  }
});

// The final face shares the normal face's pool, so its tile reports the last charge and when the normal face returns.
test('Firebrand final mantra face shows the shared charges and next charge timer until retirement', () => {
  const { FLAME_RUSH, FLAME_SURGE } = GUARDIAN_SKILL_IDS;
  const surge = guardianCatalog.skillsById.get(FLAME_SURGE);
  const view = (results) =>
    paletteSkillView(
      {
        patch: guardianAppAdapter.profession.resolvePatch(),
        adapter: guardianAppAdapter,
        build: { rotation: [] },
        results
      },
      surge
    );
  const final = runGuardian([FLAME_RUSH, FLAME_RUSH], { specialization: 'Firebrand' });
  const { ammoBySkillId, atSeconds } = final.planningState;
  assert.deepEqual(view(final).ammo, { current: 1, maximum: 3, pips: [true, false, false] });
  assert.match(
    view(final).castDetails,
    new RegExp(`Next charge in: ${(ammoBySkillId[FLAME_RUSH].nextRechargeAt - atSeconds).toFixed(3)}s`)
  );

  const retired = runGuardian([FLAME_RUSH, FLAME_RUSH, FLAME_SURGE], { specialization: 'Firebrand' });
  assert.equal(retired.planningState.ammoBySkillId[FLAME_SURGE], undefined);
  assert.equal(view(retired).ammo, null);
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
  // The armed hit delivers one active application and consumes its entitlement.
  assert.deepEqual(
    withJustice.resolvedEvents.filter((event) => event.type === 'condition').map((event) => event.sourceId),
    ['guardian.justice-active']
  );
  assert.equal(withJustice.planningState.profession[STATE.JUSTICE_ACTIVE_ARMED], false);
  assert.equal(
    withJustice.procSteps.find((step) => step.skill === 'Justice Active')?.icon,
    guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.JUSTICE).icon
  );
});

test('Core and Luminary Justice use the selected hit threshold and preserve progress during active cooldown', () => {
  // Two synthetic hits cross exactly one selected threshold without depending on a weapon's native packet schedule.
  for (const specialization of ['Core', 'Luminary']) {
    for (const permeating of [false, true]) {
      for (const active of [false, true]) {
        const threshold = permeating ? 3 : 5;
        const skillId = specialization === 'Core' ? GUARDIAN_SKILL_IDS.JUSTICE : GUARDIAN_SKILL_IDS.RADIANT_JUSTICE;
        const result = runGuardian(
          [{ type: 'wait', durationMs: 2000 }],
          {
            specialization,
            selectedTraitIds: permeating ? [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH] : []
          },
          {
            initialize(runtime) {
              runtime.profession.core.justiceHitCount = threshold - 2;
              runtime.profession.core.justiceActiveArmed = active;

              if (active) runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(skillId), 0, 10);

              for (const at of [1, 1.1])
                runtime.effects.emit({
                  kind: 'packet',
                  event: {
                    type: 'damage',
                    at,
                    actorType: 'player',
                    source: 'guardian',
                    sourceId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH,
                    skillId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH,
                    skillName: 'Orb of Wrath',
                    activationId: `threshold-${at}`,
                    coefficient: 1,
                    weaponStrengthProfileId: 'weapon.scepter'
                  }
                });
            }
          }
        );
        assert.deepEqual(result.warnings, []);
        const burns = result.resolvedEvents.filter(
          (event) => event.type === 'condition' && event.condition === 'Burning'
        );
        assert.deepEqual(
          burns.map((event) => [event.sourceId, event.skillId, event.activationId]),
          [[`guardian.justice-${active ? 'active' : 'passive'}`, skillId, `threshold-${active ? 1 : 1.1}`]]
        );
        const core = observedRuntime(result).profession.core;
        assert.equal(core.justiceHitCount, active ? threshold - 2 : 0);
        assert.equal(core.justiceActiveArmed, false);
      }
    }
  }
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
  assert.equal(helioAlone.planningState.profession[STATE.SPEAR_ILLUMINATED].charges, 1);
  assert.equal(
    helioAlone.procSteps.some((step) => step.skill === 'Illuminated'),
    false
  );
  assert.equal(
    helioAlone.events.some((event) => event.type === 'buff' && event.kind === 'resolution' && event.duration === 4),
    false
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
    // The shock wave's boons do not participate in the illumination damage contract.
    expired.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
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
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
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
  assert.ok(symbolThenHelio.planningState.profession[STATE.SPEAR_LUMINANCE_UNTIL] > 0);
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
      [STATE.ACTIVE_TOME]: '',
      [STATE.TOME_PAGES]: { value: 5, maximum: 5, updatedAt: 0, rate: 0, interval: 8, amount: 1, nextAt: Infinity },
      [STATE.RADIANT_FORGE]: false
    }
  };
  const activeFirebrand = {
    ...inactiveFirebrand,
    professionState: {
      ...inactiveFirebrand.professionState,
      [STATE.ACTIVE_TOME]: 'justice'
    }
  };
  const inactiveFirebrandGroups = guardianProfession.ui.paletteGroups(inactiveFirebrand);
  const activeFirebrandGroups = guardianProfession.ui.paletteGroups(activeFirebrand);
  const dormantFirebrandGroup = guardianProfession.ui.paletteGroups({
    ...inactiveFirebrand,
    time: 10,
    professionState: {
      ...inactiveFirebrand.professionState,
      [STATE.VIRTUE_READY_AT]: { justice: 20, resolve: 10, courage: 30 }
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
    professionState: { [STATE.RADIANT_FORGE]: false }
  });
  const activeForgeGroups = guardianProfession.ui.paletteGroups({
    specialization: 'Luminary',
    professionState: { [STATE.RADIANT_FORGE]: true }
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
    assert.equal(state.availability[guardianCatalog.skillsById.get(9109).id].ready, !activeTome);
    assert.equal(state.availability[GUARDIAN_SKILL_IDS.SEARING_SPELL].ready, Boolean(activeTome));
    assert.equal(state.availability[GUARDIAN_SKILL_IDS.DESERT_BLOOM].ready, false);
  }

  for (const radiantForge of [false, true]) {
    const state = planningFixture(guardianProfession, { specialization: 'Luminary' }, (runtime) => {
      runtime.profession.specialization.state.radiantForge = radiantForge;
    });
    assert.equal(state.availability[guardianCatalog.skillsById.get(9109).id].ready, !radiantForge);
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
  assert.match(result.warnings.map(({ message }) => message).join(' '), /Through the Heart is unavailable/);
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
