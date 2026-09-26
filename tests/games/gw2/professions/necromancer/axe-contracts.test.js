import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { createLiveProfessionSimulator } from '#tests/helpers/live-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const baseConfig = {
  primaryWeapon: 'Axe',
  secondaryWeapon: 'Focus',
  selectedTraitIds: [],
  initialResource: 0,
  boons: { quickness: false, alacrity: false },
  stats: { power: 2000, precision: 1000, expertise: 0, vitality: 1000 },
  target: { armor: 2597, health: 1000000000, conditions: {} }
};
const simulate = createLiveProfessionSimulator(necromancerProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });

// Actual packets grant resources once; interruption cannot grant the skipped remainder of a channel.
test('Ghastly Claws grants life force on each landed packet and preserves partial-channel gains', () => {
  const ticks = necromancerCatalog.skillsById.get(ID.GHASTLY_CLAWS).effects[0].ticks;
  const interruptMs = (ticks[2].atMs + ticks[3].atMs) / 2;
  const interrupted = simulate('Core', [{ name: 'Ghastly Claws', interruptMs }, wait(3000)]);
  const completed = simulate('Core', ['Ghastly Claws']);
  const cancelled = simulate('Core', [{ name: 'Ghastly Claws', interruptMs: ticks[0].atMs / 2 }, wait(3000)]);

  assert.equal(interrupted.planningState.profession.lifeForce.value, 4.5);
  assert.equal(completed.planningState.profession.lifeForce.value, 12);
  assert.equal(cancelled.planningState.profession.lifeForce.value, 0);
  for (const result of [interrupted, completed, cancelled]) {
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.GHASTLY_CLAWS);
    assert.equal(result.planningState.profession.lifeForce.value, hits.length * 1.5);
    assert.deepEqual(result.warnings, []);
  }
});

// The next command spends the live pool instead of waiting for a replay of observed gains.
test('Ghastly Claws life force funds the next shroud entry in one execution', () => {
  const result = simulate('Core', ['Ghastly Claws', 'Death Shroud']);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.activeShroud, 'death');
  assert.equal(result.planningState.profession.lifeForce.value, 12);
  assert.equal(result.steps[1].start, result.steps[0].end);
});

// Compare one isolated packet so ordinary Vulnerability and the skill-specific bonus must multiply.
test('Ghastly Claws multiplies its Vulnerability bonus with normal target Vulnerability', () => {
  const damage = (stacks) =>
    simulate('Core', ['Ghastly Claws'], { target: { conditions: { Vulnerability: stacks } } }).resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillId === ID.GHASTLY_CLAWS
    ).damage;
  assertFlooredDamageMultiplier(damage(25), damage(0), 1.5625);
});

// One interrupted claw isolates the health gate without hard-coding a full attack's hit timeline.
test('Rending Claws doubles each hit vulnerability only below half health', () => {
  const ticks = necromancerCatalog.skillsById.get(ID.RENDING_CLAWS).effects[0].ticks;
  const interruptMs = (ticks[0].atMs + ticks[1].atMs) / 2;
  for (const [healthFraction, stacks] of [
    // The gate reads live health after the hit lands, so the non-qualifying start stays clear of half.
    [0.51, 1],
    [0.49, 2]
  ]) {
    const result = simulate('Core', [{ name: 'Rending Claws', interruptMs }, wait(1000)], {
      target: { startingHealthFraction: healthFraction }
    });
    const applications = result.resolvedEvents.filter((event) => event.condition === 'Vulnerability');
    const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.RENDING_CLAWS);
    assert.equal(
      applications.reduce((total, event) => total + event.stacks, 0),
      stacks
    );
    assert.ok(applications.every((event) => event.at === hit.at && event.duration === 7));
    assert.deepEqual(result.warnings, []);
  }
});

// A qualifying Feast impact owns the delayed proc, which remains pending after the player's cast has ended.
test('Unholy Feast gates its delayed burst below half health and clips it to the observation window', () => {
  for (const [healthFraction, expectedBurst] of [
    // The gate reads live health after the hit lands, so the non-qualifying start stays clear of half.
    [0.51, false],
    [0.49, true]
  ]) {
    const result = simulate('Core', ['Unholy Feast', wait(2000)], {
      target: { startingHealthFraction: healthFraction }
    });
    const feast = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.UNHOLY_FEAST);
    const cripple = result.resolvedEvents.find((event) => event.condition === 'Crippled');
    const burst = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.UNHOLY_BURST);
    assert.equal(cripple.at, feast.at);
    assert.equal(cripple.duration, 5);
    assert.equal(Boolean(burst), expectedBurst);
    if (burst) {
      assert.equal(burst.coefficient, 1.5);
      assert.ok(burst.at > result.steps[0].end / 1000);
      assert.equal(burst.triggeredBy, 'Unholy Feast');
    }

    assert.deepEqual(result.warnings, []);
  }

  const clipped = simulate('Core', ['Unholy Feast'], { target: { startingHealthFraction: 0.49 } });
  assert.equal(
    clipped.resolvedEvents.some((event) => event.skillId === ID.UNHOLY_BURST),
    false
  );
});

// Explicit weapon recharges remain fixed when Alacrity is absent.
test('axe weapon cooldowns begin at completed cast recharge anchors', () => {
  for (const [name, seconds] of [
    ['Ghastly Claws', 6],
    ['Unholy Feast', 10]
  ]) {
    const result = simulate('Core', [name]);
    assert.equal(result.planningState.cooldowns[name].readyAt - result.steps[0].end, seconds * 1000);
    assert.deepEqual(result.warnings, []);
  }
});
