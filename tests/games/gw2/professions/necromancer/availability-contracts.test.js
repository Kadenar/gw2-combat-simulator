import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { necromancerAvailability } from '#gw2/professions/necromancer/core/mechanics/availability.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

/** Exercise real catalog and resource queries while varying only the availability state under test. */
function fixture(overrides = {}) {
  const config = {
    specialization: 'Core',
    initialResource: 0,
    attributeInputs: baseAttributeInputs({ vitality: 1000 }),
    target: { armor: 2597, conditions: {} },
    ...overrides
  };
  const result = observeGw2Runtime({ profession: necromancerProfession.runtimeFor(config), config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  return {
    runtime,
    core: runtime.profession.core,
    check(id, patch = {}) {
      const skill = runtime.helpers.skillsById.get(id);
      assert.ok(skill, `Missing skill ${id}`);
      return necromancerAvailability(runtime.mechanics.queries, { ...skill, ...patch });
    }
  };
}

test('Lingering Curse replacement takes precedence over form restrictions', () => {
  const normal = fixture();
  normal.core.activeShroud = 'death';
  assert.equal(normal.check(ID.DEVOURING_DARKNESS).code, 'necromancer.trait-locked');
  normal.core.activeShroud = null;
  assert.deepEqual(normal.check(ID.FEAST_OF_CORRUPTION), { ready: true });

  const trait = fixture({ selectedTraitIds: [TRAIT.LINGERING_CURSE] });
  trait.core.activeShroud = 'death';
  assert.equal(trait.check(ID.FEAST_OF_CORRUPTION).code, 'necromancer.trait-replacement');
  trait.core.activeShroud = null;
  assert.deepEqual(trait.check(ID.DEVOURING_DARKNESS), { ready: true });
});

test('minion ownership precedes generic flip and shroud denials', () => {
  const { runtime, core, check } = fixture();
  const command = runtime.helpers.skillsById.get(ID.PUTRID_EXPLOSION);
  core.activeShroud = 'death';
  assert.equal(check(command.id).code, 'necromancer.minion-inactive');
  core.activeMinions[command.minionKey] = 1;
  assert.equal(check(command.id).code, 'necromancer.flip-not-armed');
  armSkillFlip(core.availableFlips, command.id, runtime.time);
  assert.equal(check(command.id).code, 'necromancer.in-shroud');
  core.activeShroud = null;
  assert.deepEqual(check(command.id), { ready: true });
});

test('Lich replacement skills bypass ordinary shroud restrictions only inside Lich', () => {
  const { core, check } = fixture();
  assert.equal(check(ID.DEATHLY_CLAWS).code, 'necromancer.not-in-lich');
  core.activeShroud = 'death';
  assert.equal(check(ID.DEATHLY_CLAWS).code, 'necromancer.not-in-lich');
  core.activeShroud = 'lich';
  assert.deepEqual(check(ID.DEATHLY_CLAWS), { ready: true });
  assert.equal(check(ID.FEAST_OF_CORRUPTION).code, 'necromancer.in-shroud');
});

test('shroud entry checks active form before specialization and life-force readiness', () => {
  const { core, check } = fixture();
  core.activeShroud = 'lich';
  assert.equal(check(ID.DEATH_SHROUD, { specialization: 'Harbinger' }).code, 'necromancer.in-shroud');
  core.activeShroud = null;
  assert.equal(check(ID.DEATH_SHROUD, { specialization: 'Harbinger' }).code, 'necromancer.wrong-specialization');
  const denied = check(ID.DEATH_SHROUD);
  assert.equal(denied.code, 'necromancer.insufficient-life-force');
  assert.equal(denied.retryAt, null);

  const ready = fixture({ initialResource: 10 });
  assert.deepEqual(ready.check(ID.DEATH_SHROUD), { ready: true });
});

test('insufficient life force preserves the resource controller retry deadline', () => {
  const { runtime } = fixture();
  const skill = runtime.helpers.skillsById.get(ID.DEATH_SHROUD);
  const minimum = (runtime.profession.core.lifeForce.maximum * 10) / 100;
  const queries = {
    profession: runtime.profession,
    helpers: runtime.helpers,
    config: runtime.config,
    traits: runtime.mechanics.queries.traits,
    time: runtime.time,
    resourceController: {
      value: () => 0,
      readyAt(resource, amount) {
        assert.equal(resource, 'lifeForce');
        assert.equal(amount, minimum);
        return 3;
      }
    }
  };
  const denied = necromancerAvailability(queries, skill);
  assert.equal(denied.code, 'necromancer.insufficient-life-force');
  assert.equal(denied.retryAt, 3);
});

test('shroud exits and attacks require the matching form while allowed skills remain usable', () => {
  const { runtime, core, check } = fixture();
  const exit = runtime.helpers.skills.find((skill) => skill.shroudExit === 'death');
  const attack = runtime.helpers.skills.find((skill) => skill.shroud === 'death' && !skill.flipParentId);
  assert.ok(exit);
  assert.ok(attack);
  assert.equal(check(exit.id).code, 'necromancer.not-in-shroud');
  assert.equal(check(attack.id).code, 'necromancer.wrong-shroud');
  core.activeShroud = 'death';
  assert.deepEqual(check(exit.id), { ready: true });
  assert.deepEqual(check(attack.id), { ready: true });
  assert.deepEqual(check(ID.FEAST_OF_CORRUPTION, { usableInShroud: true }), { ready: true });
  core.activeShroud = 'harbinger';
  assert.equal(check(exit.id).code, 'necromancer.not-in-shroud');
  assert.equal(check(attack.id).code, 'necromancer.wrong-shroud');
});
