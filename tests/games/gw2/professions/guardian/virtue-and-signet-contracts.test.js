import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';
import { createObservedProfessionSimulator, projectObservedState } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { patchTraitProfession } from '#tests/helpers/trait-patch.js';

const config = {
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  }),
  target: { armor: 2597 },
  primaryWeapon: 'Scepter'
};

test('Renewed Focus restores core activation traits and Flowing Resolve charges only on completion', () => {
  for (const interrupted of [false, true]) {
    const focus = interrupted
      ? { type: 'cast', skillId: GUARDIAN_SKILL_IDS.RENEWED_FOCUS, interruptAfterMs: 100 }
      : 'Renewed Focus';
    const core = createObservedProfessionSimulator(guardianProfession, {
      ...config,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE]
    })(undefined, ['Virtue of Justice', focus, ...(interrupted ? [] : ['Virtue of Justice'])]);
    assert.deepEqual(core.warnings, []);
    // A refreshed passive must enable the next activation's boon, without waiting for its old recharge.
    const activations = core.events.filter(
      (event) => event.type === 'action' && event.skillId === GUARDIAN_SKILL_IDS.JUSTICE
    );
    const boons = core.events.filter((event) => event.type === 'buff' && event.name === 'Inspired Virtue');
    assert.deepEqual(
      boons.map((event) => event.at),
      activations.map((event) => event.endsAt)
    );
    assert.equal(activations.length, interrupted ? 1 : 2);

    const willbender = createObservedProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Willbender'
    })(undefined, ['Flowing Resolve', 'Flowing Resolve', focus]);
    assert.deepEqual(willbender.warnings, []);
    const ammo = willbender.planningState.ammoBySkillId[GUARDIAN_SKILL_IDS.FLOWING_RESOLVE];
    assert.equal(ammo.charges, interrupted ? 0 : ammo.maximum);
    assert.equal(ammo.nextRechargeAt == null, !interrupted);
    assert.equal(
      Object.hasOwn(willbender.planningState.cooldownsBySkillId, GUARDIAN_SKILL_IDS.FLOWING_RESOLVE),
      interrupted
    );
  }
});

test('Firebrand owns dormancy and publishes a detached observation', () => {
  // Independent Firebrand instances and detached observations cannot change one another's dormancy.
  const config = { specialization: 'Firebrand' };
  const native = guardianProfession.runtimeFor(config);
  const profession = native.createState(config);
  const independent = native.createState(config);
  assert.deepEqual(profession.specialization.state.tomeDormantReadyAt, { justice: 0, resolve: 0, courage: 0 });
  assert.notEqual(
    profession.specialization.state.tomeDormantReadyAt,
    independent.specialization.state.tomeDormantReadyAt
  );
  profession.specialization.state.tomeDormantReadyAt.justice = 20;
  const projected = projectObservedState(guardianProfession, { profession, config, time: 5 });
  assert.deepEqual(projected[STATE.VIRTUE_READY_AT], { justice: 20, resolve: 0, courage: 0 });
  assert.equal(Object.hasOwn(profession.specialization.state, 'virtueReadyAt'), false);
  assert.equal(Object.hasOwn(profession.core, 'virtueReadyAt'), false);
  assert.equal(Object.hasOwn(profession.core, 'tomeDormantReadyAt'), false);

  projected[STATE.VIRTUE_READY_AT].justice = 0;
  assert.equal(profession.specialization.state.tomeDormantReadyAt.justice, 20);
  assert.equal(independent.specialization.state.tomeDormantReadyAt.justice, 0);
});

test('Renewed Focus restores Firebrand pages and dormancy only on completion', () => {
  // Both ordinary and trait-expanded pools retain their cap and recovery phase across the shared reset.
  for (const selectedTraitIds of [[], [GUARDIAN_TRAIT_IDS.BASTION]]) {
    for (const interrupted of [false, true]) {
      const result = createObservedProfessionSimulator(guardianProfession, {
        ...config,
        specialization: 'Firebrand',
        selectedTraitIds
      })(undefined, [
        'Tome of Justice',
        'Chapter 1: Searing Spell',
        'Stow Tome',
        interrupted
          ? { type: 'cast', skillId: GUARDIAN_SKILL_IDS.RENEWED_FOCUS, interruptAfterMs: 100 }
          : 'Renewed Focus'
      ]);
      assert.deepEqual(result.warnings, []);
      const state = result.planningState.profession;
      const focus = result.events.find((event) => event.type === 'action' && event.skillName === 'Renewed Focus');
      assert.equal(state[STATE.TOME_PAGES].value, state[STATE.TOME_PAGES].maximum - Number(interrupted));
      // Refilling pages must preserve the regeneration phase established by the earlier spend.
      const spent = result.events.find(
        (event) => event.type === 'action' && event.skillId === GUARDIAN_SKILL_IDS.SEARING_SPELL
      );
      assert.equal(state[STATE.TOME_PAGES].nextAt, spent.endsAt + state[STATE.TOME_PAGES].interval);
      assert.equal(state[STATE.VIRTUE_READY_AT].justice > focus.endsAt, interrupted);

      if (!interrupted) {
        for (const readyAt of Object.values(state[STATE.VIRTUE_READY_AT])) assert.equal(readyAt, focus.endsAt);
      }
    }
  }
});

test('Bane Signet Power follows recharge and Perfect Inscriptions from canonical attribute seeds', () => {
  for (const traited of [false, true]) {
    const bonus = 180 * (traited ? 1.2 : 1);
    const result = createObservedProfessionSimulator(guardianProfession, {
      ...config,
      attributeInputs: baseAttributeInputs({ ...config.attributeInputs?.weaponSets[0].commonTotals, power: 2000 }),
      selectedSkillIds: [9093],
      selectedTraitIds: traited ? [GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS] : []
    })(undefined, ['Orb of Wrath', 'Bane Signet', 'Orb of Wrath', { type: 'wait', durationMs: 40000 }, 'Orb of Wrath']);
    assert.deepEqual(result.warnings, []);
    const [before, during, after] = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Orb of Wrath'
    );
    // Identical attacks isolate the passive Power contribution from all other damage factors.
    assert.equal(before.damage, after.damage);
    assertFlooredDamageMultiplier(during.damage, before.damage, traited ? 1 : 2000 / (2000 + bonus));
  }
});

test('Willbender misses cannot complete a virtue hit cycle', () => {
  for (const offTarget of [false, true]) {
    const result = createObservedProfessionSimulator(guardianProfession, { ...config, specialization: 'Willbender' })(
      undefined,
      [
        'Rushing Justice',
        ...Array.from({ length: 4 }, () => ({ type: 'cast', skillId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH, offTarget })),
        { type: 'wait', durationMs: 1000 }
      ]
    );
    assert.deepEqual(result.warnings, []);
    // Only a completed Justice cycle emits this condition; activation grants cannot satisfy the assertion.
    assert.equal(
      result.resolvedEvents.some(
        (event) => event.type === 'condition' && event.skillId === GUARDIAN_SKILL_IDS.WILLBENDER_JUSTICE
      ),
      !offTarget
    );
  }
});

test('Guardian Virtues share patched conversion and recharge without reapplying build attributes', () => {
  // The same owner supplies the panel conversion and live virtue recharge for each current build.
  const family = patchTraitProfession(guardianProfession, {
    balanceProfiles: {
      [GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS]: { fields: { attributeConversion: 0.11, rechargeMultiplier: 0.5 } }
    }
  });
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(guardianCatalog),
    family.attributeContributions
  );
  const build = { specializations: [{ name: 'Virtues', traits: '1-1-1' }] };
  for (const [patchId, bonus, recharge] of [
    ['current', 70, 25.5],
    ['s4-preview', 110, 15]
  ]) {
    const balance = family.resolvePatch({ id: patchId }).balanceContext;
    assert.equal(calculate(build, [], 1, null, null, balance).attributes['Condition Damage'].traits, bonus);
    assert.equal(
      calculate(build, [], 1, 'Power of the Virtuous', null, balance).attributes['Condition Damage'].traits,
      0
    );
    const runtime = family.runtimeFor({ patchId });
    const context = {
      catalog: runtime.catalog,
      time: 0,
      config: {
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS],
        attributeInputs: baseAttributeInputs({ vitality: 1000 })
      }
    };
    const justice = runtime.catalog.skillsById.get(GUARDIAN_SKILL_IDS.JUSTICE);
    const rechargeContext = { helpers: runtime.catalog, time: context.time, config: context.config };
    assert.equal(runtime.rechargeWork(rechargeContext, justice, 30), recharge);
    assert.equal(runtime.calculations.modifyAttributes(context, { conditionDamage: 100 }).conditionDamage, 100 + bonus);
    assert.equal(runtime.calculations.modifyAttributes(context, { conditionDamage: 100 }).conditionDamage, 100 + bonus);
    context.config.selectedTraitIds = [];
    assert.equal(runtime.rechargeWork(rechargeContext, justice, 30), 30);
  }
});
