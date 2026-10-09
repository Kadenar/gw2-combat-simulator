import assert from 'node:assert/strict';
import test from 'node:test';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import { engineerTooltips } from '#gw2/professions/engineer/app/tooltips.js';
import { grenadier } from '#gw2/professions/engineer/core/traits/explosives/index.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const barrageId = ID.LESSER_GRENADE_BARRAGE;
const heal = engineerProfession.catalog.skillsById.get(ID.HEALING_TURRET);
const config = {
  specialization: 'Core',
  selectedTraitIds: [TRAIT.GRENADIER],
  boons: { alacrity: true }
};

// Use the skill controller so direct casts, trait triggers, and resets share one recharge owner.
test('Grenadier respects the barrage skill recharge and shared cooldown resets', () => {
  const native = engineerProfession.runtimeFor(config);
  const catalog = withSkill(native.catalog, barrageId, { cooldown: 8 });
  const result = observeGw2Runtime({ profession: { ...native, catalog }, config, rotation: [] });
  const runtime = observedRuntime(result);
  runtime.effects = captureEffectEmissions({ now: () => runtime.time }).effects;
  const skill = catalog.skillsById.get(barrageId);

  runtime.time = 1;
  runtime.cooldownController.startRecharge(skill, runtime.time);
  assert.equal(runtime.cooldownController.readyAt(barrageId), 7.4);
  runtime.time = 2;
  grenadier.hooks.onCastCommit(runtime, { skill: heal });
  assert.equal(runtime.cooldownController.readyAt(barrageId), 7.4);

  runtime.time = 7.4;
  grenadier.hooks.onCastCommit(runtime, { skill: heal });
  assert.equal(runtime.cooldownController.readyAt(barrageId), 13.8);
  assert.equal(runtime.cooldownController.isOnCooldown(barrageId), true);

  runtime.cooldownController.resetAll();
  runtime.time = 8;
  grenadier.hooks.onCastCommit(runtime, { skill: heal });
  assert.equal(runtime.cooldownController.readyAt(barrageId), 14.4);
});

// Patch only the skill: the proc, breakdown identity, icon, and trait description must all follow it.
test('Lesser Grenade Barrage owns proc balance and damage breakdown identity', () => {
  let catalog;
  const result = runEngineer(
    ['Healing Turret', { type: 'wait', durationMs: 1500 }],
    { ...config, selectedTraitIds: [TRAIT.GRENADIER, TRAIT.EXPLOSIVE_TEMPER] },
    {
      catalog: (original) => {
        const skill = original.skillsById.get(barrageId);
        catalog = withSkill(original, barrageId, {
          cooldown: 8,
          icon: 'barrage-owned-icon.png',
          effects: skill.effects.map((effect) => ({ ...effect, coefficient: 4.5 }))
        });
        return catalog;
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(catalog.balanceProfilesById.has(TRAIT.GRENADIER), false);
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === barrageId);
  assert.equal(
    hits.reduce((sum, event) => sum + event.coefficient, 0),
    4.5
  );
  assert.ok(
    hits.every(
      (event) =>
        event.skillId === barrageId &&
        event.triggeredBy === heal.name &&
        event.actorType === 'effect' &&
        event.ownerActorType === 'player' &&
        event.damageKind === 'explosion'
    )
  );
  assert.equal(
    result.events
      .filter((event) => event.type === 'buff' && event.kind === 'explosive-temper')
      .reduce((sum, event) => sum + event.stacks, 0),
    3
  );
  const row = skillBreakdownRows(result).find((entry) => entry.skillId === barrageId);
  assert.ok(row);
  assert.equal(row.sourceId, barrageId);
  assert.equal(row.icon, catalog.skillsById.get(barrageId).icon);
  assert.equal(resultSkillIcon({}, row), 'barrage-owned-icon.png');

  const context = { ...withPatchPreview(engineerProfession, null).balanceContextFor(), catalog };
  const trait = catalog.traits.find((entry) => entry.id === TRAIT.GRENADIER);
  const tooltip = describeSimulationTrait(context, trait, engineerTooltips);
  assert.equal(tooltip.facts.find((fact) => fact.name === 'Base skill recharge').detail, '8s');
});

// Explosion modifiers must apply to the canonical barrage in combat and in its isolated damage preview.
test('barrage skill patches and explosion modifiers reach both damage paths', () => {
  const profession = withPatchPreview(engineerProfession, {
    id: 'barrage-ownership',
    label: 'Barrage ownership',
    professions: {
      engineer: {
        skills: { [barrageId]: { effects: [{ type: 'strike', coefficient: 3 }] } },
        modifierRules: { 'engineer.grenadier-explosion-damage': { factor: { from: 1, to: 2 } } }
      }
    }
  });
  const results = ['current', 'barrage-ownership'].map((patchId) => {
    const selected = { ...config, patchId };
    const combat = runEngineer(['Healing Turret', { type: 'wait', durationMs: 1500 }], selected, { profession });
    assert.deepEqual(combat.warnings, []);
    const occurrence = damageOccurrences(profession.runtimeFor(selected), selected).find(
      (entry) => entry.name === 'Lesser Grenade Barrage'
    );
    assert.ok(occurrence);
    const preview = executeDamageOccurrence(profession, selected, occurrence);
    return [combat.resolvedEvents, preview.events].map((events) =>
      events.filter((event) => event.type === 'damage' && event.sourceId === barrageId)
    );
  });
  for (const path of [0, 1]) {
    const baseline = results[0][path];
    const patched = results[1][path];
    assert.equal(
      patched.reduce((sum, event) => sum + event.coefficient, 0),
      3
    );
    assertFlooredDamageMultiplier(
      patched.reduce((sum, event) => sum + event.damage, 0),
      baseline.reduce((sum, event) => sum + event.damage, 0),
      4,
      patched.length
    );
  }
});

// A removed skill payload must not be reconstructed from a stale trait profile or consume recharge.
test('removing barrage effects suppresses the trait proc without starting recharge', () => {
  const result = runEngineer(['Healing Turret', { type: 'wait', durationMs: 1500 }], config, {
    catalog: (catalog) => withSkill(catalog, barrageId, { effects: [] })
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === barrageId),
    false
  );
  assert.equal(observedRuntime(result).cooldownController.hasCooldown(barrageId), false);
});

// Only a selected Grenadier trait reacting to a healing skill may request the barrage.
test('Grenadier gates the barrage by trait selection and healing skill', () => {
  const result = runEngineer(['Healing Turret', { type: 'wait', durationMs: 1500 }], {
    ...config,
    selectedTraitIds: []
  });
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === barrageId),
    false
  );

  const native = engineerProfession.runtimeFor(config);
  const runtime = observedRuntime(observeGw2Runtime({ profession: native, config, rotation: [] }));
  grenadier.hooks.onCastCommit(runtime, { skill: native.catalog.skillsById.get(ID.GRENADE) });
  assert.equal(runtime.cooldownController.hasCooldown(barrageId), false);
});
