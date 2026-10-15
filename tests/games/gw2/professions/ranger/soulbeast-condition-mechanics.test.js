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
