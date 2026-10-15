import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

const config = {
  specialization: 'Soulbeast',
  selectedPet: 'Janthiri Bee',
  primaryWeapon: 'Shortbow',
  target: { armor: 2597, defiant: true, conditions: {} }
};

// The merged charge must publish a disable so the ordinary trait reaction can grant its damage buff.
test('Bumble activates Twice as Vicious through its knockdown', () => {
  const result = runRanger([ID.BUMBLE, ID.CROSSFIRE], {
    ...config,
    selectedTraitIds: [TRAIT.TWICE_AS_VICIOUS]
  });
  assert.deepEqual(result.warnings, []);
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.BUMBLE);
  assert.equal(control.controlKind, 'knockdown');
  const buff = result.events.find((event) => event.type === 'buff' && event.kind === 'twice-as-vicious');
  assert.equal(buff.triggeredBy, 'Bumble');
  assert.ok(buff.at >= control.at);
});

// Bumble retains this observed trait interaction without granting an evade or making other disables qualify.
test('Light on Your Feet handles Bumble separately from ordinary evades and disables', () => {
  const selectedTraitIds = [TRAIT.LIGHT_ON_YOUR_FEET];
  const run = (rotation, traits = selectedTraitIds) => runRanger(rotation, { ...config, selectedTraitIds: traits });
  const buffs = (result) =>
    result.events.filter((event) => event.type === 'buff' && event.kind === 'light-on-your-feet');
  assert.equal(buffs(run([ID.BUMBLE, ID.CROSSFIRE])).length, 1);
  assert.deepEqual(buffs(run([ID.BUMBLE, ID.CROSSFIRE], [])), []);
  assert.deepEqual(buffs(run([ID.CONCUSSION_SHOT, ID.CROSSFIRE])), []);
});

// Only the archetype Beast ability arms a single player-owned poison reward while merged.
test('merged Poison Master arms from F3 and consumes once on a player attack', () => {
  const result = runRanger([{ type: 'combat-start' }, ID.PRIMAL_CRY, ID.CROSSFIRE, ID.CROSSFIRE], {
    ...config,
    selectedTraitIds: [TRAIT.POISON_MASTER]
  });
  assert.deepEqual(result.warnings, []);
  const procs = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.POISON_MASTER
  );
  assert.equal(
    procs.reduce((total, event) => total + event.stacks, 0),
    2
  );
  for (const event of procs) {
    assert.equal(event.ownerActorType, 'player');
    assert.equal(event.summonBaseConditionDamage, undefined);
    assert.ok(event.damage > 0);
  }

  for (const skill of [ID.BUMBLE, ID.STINGING_SORROW]) {
    const family = runRanger([{ type: 'combat-start' }, skill, ID.CROSSFIRE], {
      ...config,
      selectedTraitIds: [TRAIT.POISON_MASTER]
    });
    assert.deepEqual(family.warnings, []);
    assert.ok(!family.resolvedEvents.some((event) => event.sourceId === TRAIT.POISON_MASTER));
  }
});

// Proc ownership must preserve player poison damage and duration bonuses even when an ally delivers the trigger.
for (const shared of [false, true]) {
  test(`Vulture Stance ${shared ? 'shared' : 'personal'} poison inherits player modifiers`, () => {
    const run = (selectedTraitIds) => {
      const result = runRanger(
        [{ type: 'combat-start' }, ID.BUMBLE, ID.VULTURE_STANCE, ID.CROSSFIRE, { type: 'wait', durationMs: 5000 }],
        {
          ...config,
          selectedTraitIds: [...selectedTraitIds, TRAIT.LEADER_OF_THE_PACK],
          allies: { count: shared ? 1 : 0, strikesPerSecond: 1000 / 520 }
        }
      );
      assert.deepEqual(result.warnings, []);
      return result.resolvedEvents.find(
        (event) =>
          event.type === 'condition' &&
          event.skillId === ID.VULTURE_STANCE &&
          Boolean(event.metadata?.triggeredByAlly) === shared
      );
    };

    const baseline = run([]);
    const poisonMaster = run([TRAIT.POISON_MASTER]);
    const lightOnYourFeet = run([TRAIT.LIGHT_ON_YOUR_FEET]);
    assert.equal(poisonMaster.ownerActorType, 'player');
    // Condition ticks round within a shared pool, so allow one point per settlement when comparing the multiplier.
    assert.ok(Math.abs(poisonMaster.damage - baseline.damage * 1.25) <= baseline.damageTicks.length);
    assert.equal(lightOnYourFeet.effectiveDuration, baseline.effectiveDuration * 1.1);
  });
}

// Merged Double Arc poison belongs to the player while retaining its separate effect identity.
test('merged Poisonous Strikes inherits player poison and duration modifiers', () => {
  const run = (selectedTraitIds) => {
    const result = runRanger([{ type: 'combat-start' }, ID.BUMBLE, ID.DOUBLE_ARC, { type: 'wait', durationMs: 5000 }], {
      ...config,
      primaryWeapon: 'Dagger',
      selectedTraitIds
    });
    assert.deepEqual(result.warnings, []);
    return result.resolvedEvents.find((event) => event.type === 'condition' && event.skillName === 'Poisonous Strikes');
  };

  const baseline = run([]);
  const poisonMaster = run([TRAIT.POISON_MASTER]);
  const lightOnYourFeet = run([TRAIT.LIGHT_ON_YOUR_FEET]);
  assert.equal(poisonMaster.ownerActorType, 'player');
  // Condition ticks round within a shared pool, so allow one point per settlement when comparing the multiplier.
  assert.ok(Math.abs(poisonMaster.damage - baseline.damage * 1.25) <= baseline.damageTicks.length);
  assert.ok(Math.abs(lightOnYourFeet.effectiveDuration - baseline.effectiveDuration * 1.1) < 0.001);
});
