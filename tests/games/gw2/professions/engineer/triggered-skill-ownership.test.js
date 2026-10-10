import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import { engineerTooltips } from '#gw2/professions/engineer/app/tooltips.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { explosiveEntrance } from '#gw2/professions/engineer/core/traits/explosives/index.js';

// Explosive Entrance's compiled strike trigger, applied to an observed runtime's mechanic capabilities.
const explosiveEntranceStrike = (runtime, event) =>
  compileProfessionRules({
    traitTriggers: explosiveEntrance.triggers.map((rule) => ({ ...rule, trait: explosiveEntrance.id }))
  }).reactions['damage.resolved'](runtime, event, {});
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const cases = [
  {
    trait: TRAIT.EXPLOSIVE_ENTRANCE,
    skill: ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL,
    name: 'Explosive Entrance',
    rotation: ['Puncturing Jab']
  },
  {
    trait: TRAIT.STATIC_DISCHARGE,
    skill: ID.STATIC_DISCHARGE_TRAIT_SKILL,
    name: 'Static Discharge',
    rotation: ['Regenerating Mist']
  },
  {
    trait: TRAIT.AIM_ASSISTED_ROCKET,
    skill: ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL,
    name: 'Aim-Assisted Rocket',
    rotation: ['Grenade Kit', 'Grenade']
  },
  {
    trait: TRAIT.AIM_ASSISTED_ROCKET,
    skill: ID.ORBITAL_COMMAND_STRIKE,
    name: 'Orbital Command Strike',
    rotation: ['Grenade Kit', 'Grenade'],
    initialCount: 4
  }
];
const wait = { type: 'wait', durationMs: 3000 };
const configFor = (entry) => ({
  specialization: 'Core',
  primaryWeapon: 'Spear',
  selectedTraitIds: [entry.trait],
  selectedSkillIds: [ID.HEALING_TURRET, ID.GRENADE_KIT],
  stats: { power: 2000, precision: 4000, ferocity: 500 },
  target: { armor: 2597 }
});
const setup = (entry) => (runtime) => {
  runtime.profession.core.aimAssistedRocketCount = entry.initialCount ?? 0;
};

const strikes = (events, id) => events.filter((event) => event.type === 'damage' && event.sourceId === id);

// A single skill patch must govern combat, isolated damage, and trait facts, without a duplicate trait payload.
for (const entry of cases) {
  test(`${entry.name} uses its selected skill payload in combat, previews, and tooltips`, () => {
    const coefficient = engineerProfession.catalog.skillsById.get(entry.skill).effects[0].coefficient;
    const profession = withPatchPreview(engineerProfession, {
      id: 'triggered-skill-owner',
      label: 'Triggered skill owner',
      professions: {
        engineer: { skills: { [entry.skill]: { effects: [{ type: 'strike', coefficient: coefficient * 2 }] } } }
      }
    });
    const results = ['current', 'triggered-skill-owner'].map((patchId) => {
      const config = { ...configFor(entry), patchId };
      const combat = runEngineer([...entry.rotation, wait], config, { profession, initialize: setup(entry) });
      assert.deepEqual(combat.warnings, []);
      const occurrences = damageOccurrences(profession.runtimeFor(config), config).filter(
        (value) => value.name === entry.name
      );
      assert.equal(occurrences.length, 1);
      const preview = executeDamageOccurrence(profession, config, occurrences[0]);
      return [strikes(combat.resolvedEvents, entry.skill), strikes(preview.events, entry.skill)];
    });
    for (const path of [0, 1]) {
      const baseline = results[0][path];
      const patched = results[1][path];
      assert.ok(baseline.length > 0);
      assert.ok(patched.length > 0);
      assert.ok(
        patched.every(
          (event) => event.skillId === entry.skill && event.actorType === 'effect' && event.ownerActorType === 'player'
        )
      );
      assert.equal(
        patched.reduce((total, event) => total + event.coefficient, 0),
        coefficient * 2
      );
      assertFlooredDamageMultiplier(
        patched.reduce((total, event) => total + event.damage, 0),
        baseline.reduce((total, event) => total + event.damage, 0),
        2,
        patched.length
      );
    }

    const context = profession.balanceContextFor('triggered-skill-owner');
    const trait = context.catalog.traits.find((value) => value.id === entry.trait);
    const facts = describeSimulationTrait(context, trait, engineerTooltips).facts;
    assert.ok(
      facts.some((fact) => String(fact.detail).includes(`${coefficient * 2} coefficient`)),
      JSON.stringify(facts)
    );
    assert.equal(
      context.catalog.balanceProfilesById.get(entry.trait)?.effects?.some((effect) => effect.type === 'strike') ??
        false,
      false
    );
    // Static Discharge's critical bonus must agree between its live proc and isolated occurrence.
    assert.equal(results[0][0][0].criticalDamage, results[0][1][0].criticalDamage);
  });

  test(`removing ${entry.name} suppresses its payload without reconstructing a trait copy`, () => {
    const profession = withPatchPreview(engineerProfession, {
      id: 'removed-triggered-skill',
      label: 'Removed triggered skill',
      professions: { engineer: { skills: { [entry.skill]: { removeEffects: [{ type: 'strike', all: true }] } } } }
    });
    const config = { ...configFor(entry), patchId: 'removed-triggered-skill' };
    const result = runEngineer([...entry.rotation, wait], config, { profession, initialize: setup(entry) });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(strikes(result.resolvedEvents, entry.skill), []);
    assert.equal(
      result.procSteps.some((step) => step.skill === entry.name),
      false
    );
    const occurrence = damageOccurrences(profession.runtimeFor(config), config).find(
      (value) => value.name === entry.name
    );
    assert.deepEqual(strikes(executeDamageOccurrence(profession, config, occurrence).events, entry.skill), []);
    const runtime = observedRuntime(result);
    if (entry.trait === TRAIT.EXPLOSIVE_ENTRANCE) {
      assert.equal(runtime.profession.core.explosiveEntranceFired, false);
      assert.equal(runtime.cooldownController.hasCooldown(entry.skill), false);
    }

    if (entry.trait === TRAIT.AIM_ASSISTED_ROCKET) {
      assert.equal(runtime.profession.core.aimAssistedRocketCount, (entry.initialCount ?? 0) + 1);
      assert.ok(runtime.procs.deadline(TRAIT.AIM_ASSISTED_ROCKET) > 0);
    }
  });
}

// One skill timer mediates direct recharge, trait activation, dodge rearming, and authored cooldown resets.
test('Explosive Entrance reads patched skill recharge and reserves it before reentrant damage', () => {
  const config = configFor(cases[0]);
  const native = engineerProfession.runtimeFor(config);
  const skillId = ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL;
  const catalog = withSkill(native.catalog, skillId, { cooldown: 2 });
  const result = observeGw2Runtime({ profession: { ...native, catalog }, config, rotation: [] });
  const runtime = observedRuntime(result);
  const invoke = () =>
    explosiveEntranceStrike(runtime.mechanics, {
      type: 'damage',
      at: runtime.time,
      actorType: 'player',
      coefficient: 1,
      skillName: 'Trigger'
    });
  let emitted = 0;
  runtime.effects = captureEffectEmissions({
    now: () => runtime.time,
    submit(event) {
      assert.equal(runtime.profession.core.explosiveEntranceFired, true);
      assert.equal(runtime.cooldownController.readyAt(skillId), runtime.time + 2 / 1.25);
      emitted += 1;
      invoke();
      return event;
    }
  }).effects;
  runtime.cooldownController.startRecharge(catalog.skillsById.get(skillId), 1);
  for (const at of [1, 2.6]) {
    runtime.time = at;
    invoke();
    assert.equal(runtime.profession.core.explosiveEntranceFired, false);
    assert.equal(emitted, 0);
  }

  runtime.time = 2.600001;
  invoke();
  assert.equal(emitted, 1);
  explosiveEntrance.lifetime.eventHandlers['engineer.dodge'](runtime);
  invoke();
  assert.equal(emitted, 1);
  runtime.cooldownController.resetAll();
  runtime.time = 3;
  invoke();
  assert.equal(emitted, 2);
  assert.equal(runtime.procs.deadline(TRAIT.EXPLOSIVE_ENTRANCE), 0);
});
