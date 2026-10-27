import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { guardianPassiveAttributes } from '#gw2/professions/guardian/core/skills/attribute-passives.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Selected patches own intrinsic values without leaving obsolete profile aliases behind.
function preview(skills = {}, balanceProfiles = {}) {
  return withPatchPreview(guardianProfession, {
    id: 'guardian-ownership',
    label: 'Guardian ownership',
    professions: { guardian: { skills, balanceProfiles } }
  });
}

test('Guardian keeps Justice and Ashes tuning on skills', () => {
  for (const id of [
    'guardian.core.justice',
    'guardian.firebrand.ashes-of-the-just',
    'guardian.core.bane-signet-passive',
    'guardian.core.signet-of-wrath-passive',
    ...['helio-rush-illuminated', 'gleaming-disc-illuminated', 'solar-storm-illuminated', 'symbol-of-luminance'].map(
      (name) => `guardian.core.spear.${name}`
    ),
    'guardian.core.symbol-of-ignition-field',
    'guardian.dragonhunter.spear-of-justice-tether',
    'guardian.dragonhunter.passive-courage',
    ...['tome-pages', 'tome-justice', 'tome-resolve', 'tome-courage', 'passive-courage', 'epilogue-ashes-grant'].map(
      (name) => `guardian.firebrand.${name}`
    ),
    ...['flames', 'virtue-windows', 'courage-trigger'].map((name) => `guardian.willbender.${name}`)
  ]) {
    assert.equal(guardianProfession.catalog.balanceProfilesById.has(id), false);
    assert.throws(
      () => preview({}, { [id]: { fields: { duration: 1 } } }).resolvePatch({ id: 'guardian-ownership' }),
      /unknown balance profile/
    );
  }
});

test('selected signet grants preserve independent tuning, readiness, and Perfect Inscriptions', () => {
  const profession = preview({
    [ID.BANE_SIGNET]: { fields: { 'attributeBonuses.power': 250 } },
    [ID.SIGNET_OF_WRATH]: { fields: { 'attributeBonuses.conditionDamage': 300 } }
  });
  for (const patchId of ['current', 'guardian-ownership', 'current']) {
    const selected = profession.resolvePatch({ id: patchId }).balanceContext;
    for (const traited of [false, true]) {
      const context = {
        ...selected,
        balanceContext: selected,
        time: 0,
        config: {
          selectedSkillIds: [ID.BANE_SIGNET, ID.SIGNET_OF_WRATH],
          selectedTraitIds: traited ? [TRAIT.PERFECT_INSCRIPTIONS] : []
        },
        timeline: { skillOnCooldownAt: (id) => id === ID.BANE_SIGNET }
      };
      const effects = guardianPassiveAttributes(context).flatMap((contribution) => contribution.attributeEffects);
      const power = effects.find((effect) => effect.to === 'Power');
      const condition = effects.find((effect) => effect.to === 'Condition Damage');
      assert.equal(power.amount, (patchId === 'current' ? 180 : 250) * (traited ? 1.2 : 1));
      assert.equal(condition.amount, (patchId === 'current' ? 180 : 300) * (traited ? 1.2 : 1));
      assert.equal(power.enabled, traited);
      assert.equal(condition.enabled, true);
    }

    assert.throws(
      () =>
        skillNumberFromContext(
          { catalog: { skillsById: new Map() }, helpers: selected.catalog },
          ID.BANE_SIGNET,
          'attributeBonuses.power'
        ),
      /missing required skill/
    );
  }
});

test('Helio Rush reads its selected illumination multiplier without changing ordinary impacts', () => {
  const profession = preview({ [ID.HELIO_RUSH]: { fields: { illuminatedDamageMultiplier: 2 } } });
  for (const patchId of ['current', 'guardian-ownership', 'current']) {
    const results = [false, true].map((illuminated) => {
      const result = runGuardian(
        [ID.HELIO_RUSH],
        { primaryWeapon: 'Spear', patchId },
        {
          profession,
          initialize: (runtime) => {
            if (illuminated) runtime.profession.core.spearIlluminated = grantCharges(1, 5);
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      return result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.HELIO_RUSH);
    });
    assertFlooredDamageMultiplier(results[1].damage, results[0].damage, patchId === 'current' ? 1.5 : 2);
  }
});

// Reject manual flame commands while retaining the virtue controller's authority to emit the same payloads.
test('Willbender flames reject direct casts but remain available to their owning virtues', () => {
  for (const [virtue, flame] of [
    [ID.RUSHING_JUSTICE, ID.WILLBENDER_FLAMES_ID_62618],
    [ID.FLOWING_RESOLVE, ID.WILLBENDER_FLAMES],
    [ID.CRASHING_COURAGE, ID.WILLBENDER_FLAMES_COURAGE]
  ]) {
    const direct = runGuardian([flame, { type: 'wait', durationMs: 6000 }], { specialization: 'Willbender' });
    assert.equal(direct.warnings.length, 1);
    assert.match(direct.warnings[0].message, /flames are created automatically by virtues/);
    assert.equal(
      direct.resolvedEvents.some((event) => event.type === 'damage'),
      false
    );

    const triggered = runGuardian([virtue, { type: 'wait', durationMs: 6000 }], { specialization: 'Willbender' });
    assert.deepEqual(triggered.warnings, []);
    assert.ok(triggered.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === flame));
  }
});

test('each Willbender flame identity consumes its own selected payload', () => {
  const profession = preview({
    [ID.WILLBENDER_FLAMES_ID_62618]: { removeEffects: [{ type: 'strike', name: 'Strike' }] }
  });
  for (const [virtue, flame] of [
    [ID.RUSHING_JUSTICE, ID.WILLBENDER_FLAMES_ID_62618],
    [ID.FLOWING_RESOLVE, ID.WILLBENDER_FLAMES],
    [ID.CRASHING_COURAGE, ID.WILLBENDER_FLAMES_COURAGE]
  ]) {
    const result = runGuardian(
      [virtue, { type: 'wait', durationMs: 2000 }],
      {
        specialization: 'Willbender',
        patchId: 'guardian-ownership'
      },
      { profession }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === flame),
      virtue !== ID.RUSHING_JUSTICE
    );
  }
});

// Justice burns are deferred hit rewards: presentation must not count them as cast damage or repeat their facts.
test('Justice exposes each helper burn once and has no damaging cast occurrence', () => {
  const family = preview();
  const context = family.resolvePatch().balanceContext;
  const justice = context.catalog.skillsById.get(ID.JUSTICE);
  const tooltip = describeSimulationSkill(context, justice, guardianTooltips);
  assert.equal(tooltip.facts.filter((fact) => fact.name === 'Burning').length, 2);
  const occurrence = executeDamageOccurrence(
    family,
    { specialization: 'Core', selectedTraitIds: [] },
    {
      id: 'justice',
      name: 'Justice',
      effect: { kind: 'skill', id: ID.JUSTICE }
    }
  );
  assert.equal(occurrence.damaging, false);
});

// Elite virtues consume the core recipes even when neither selected nor observed skills contain core Justice.
test('every Guardian elite keeps Justice patch notes without including unrelated skills', () => {
  const family = preview({
    [ID.JUSTICE]: {
      sideEffects: { justice: { effects: [{ type: 'condition', name: 'Burning (active)', duration: 3 }] } }
    },
    [ID.BANE_SIGNET]: { fields: { 'attributeBonuses.power': 1 } }
  });
  for (const specialization of ['Core', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary']) {
    const notes = family.patchOverviewFor({ specialization, selectedSkillIds: [], selectedTraitIds: [] }, []);
    assert.ok(
      notes.some((note) => note.subject === family.catalog.skillsById.get(ID.JUSTICE).name),
      specialization
    );
    assert.equal(
      notes.some((note) => note.subject === family.catalog.skillsById.get(ID.BANE_SIGNET).name),
      false
    );
  }
});
