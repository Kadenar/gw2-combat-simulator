import assert from 'node:assert/strict';
import test from 'node:test';

import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';

// Health tiers apply at impact and only to the strike that owns the rule.
test('Heartseeker selects a single health tier for its own strike', () => {
  const runtime = thiefProfession.runtimeFor({ specialization: 'Core' });
  const ruleId = 'thief.heartseeker-target-health';
  const damage = (health, skillId = THIEF.HEARTSEEKER, effectModifierIds = [ruleId]) =>
    runtime.calculations.modifyStrikeDamage(
      {
        catalog: runtime.catalog,
        config: { selectedTraitIds: [], target: { fixedHealthFraction: health } },
        time: 0,
        event: { actorType: 'player', skillId, effectModifierIds }
      },
      1
    );
  const base = damage(1);
  const middle = damage(0.499);
  assert.equal(damage(0.5), base);
  assert.ok(middle > base);
  assert.equal(damage(0.25), middle);
  assert.ok(damage(0.249) > middle);
  assert.equal(damage(0.1, THIEF.HEARTSEEKER, []), base);
  assert.equal(damage(0.1, THIEF.STEAL), base);
});

// Judgment uses malice captured at cast time after the target's mark expires.
test('Deadeye mark expiry distinguishes Judgment from Shadow Flare', () => {
  const config = { specialization: 'Deadeye', selectedTraitIds: [] };
  const runtime = thiefProfession.runtimeFor(config);
  const state = { markedTargetId: 'target', markExpiresAt: 10, malice: { value: 0 } };
  function damage(skillId, time, deadeyeMaliceSnapshot) {
    return runtime.calculations.modifyStrikeDamage(
      {
        catalog: runtime.catalog,
        config,
        time,
        runtime: { profession: { core: {}, specialization: { kind: 'Deadeye', state } } },
        event: { skillId, actorType: 'player', deadeyeMaliceSnapshot }
      },
      1
    );
  }

  const judgment = THIEF.MALICIOUS_DEATHS_JUDGMENT;
  assert.ok(damage(judgment, 11, 3) > damage(judgment, 11, 0));
  assert.equal(damage(judgment, 1, 3), damage(judgment, 11, 3));
  assert.ok(damage(THIEF.SHADOW_FLARE, 1, 3) > damage(THIEF.SHADOW_FLARE, 11, 3));
});

// Defiance and immobilize qualify independently for Falcon's Stoop. Pounce requires defiance.
test('Ranger attacks distinguish immobilized targets from defiant targets', () => {
  const runtime = rangerProfession.runtimeFor({ specialization: 'Core' });
  const damage = (skillId, defiant, immobilized) =>
    runtime.calculations.modifyStrikeDamage(
      {
        catalog: runtime.catalog,
        time: 0,
        config: { selectedTraitIds: [], target: { defiant } },
        event: { skillId },
        query: { targetHasCondition: (condition) => immobilized && condition === 'Immobilized' }
      },
      1
    );
  for (const [skillId, admitsImmobilized] of [
    [RANGER.FALCONS_STOOP, true],
    [RANGER.POUNCE, false]
  ]) {
    const base = damage(skillId, false, false);
    const defiant = damage(skillId, true, false);
    assert.ok(defiant > base);
    assert.equal(damage(skillId, false, true), admitsImmobilized ? defiant : base);
    assert.equal(damage(skillId, true, true), defiant);
  }
});
