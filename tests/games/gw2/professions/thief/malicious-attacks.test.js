import assert from 'node:assert/strict';
import test from 'node:test';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';

const weapons = new Map([
  [ID.MALICIOUS_DEATHS_JUDGMENT, 'Rifle'],
  [ID.MALICIOUS_BACKSTAB, 'Dagger'],
  [ID.MALICIOUS_SNEAK_ATTACK, 'Pistol'],
  [ID.MALICIOUS_SURPRISE_SHOT, 'Shortbow'],
  [ID.MALICIOUS_TACTICAL_STRIKE, 'Sword'],
  [ID.MALICIOUS_HOOK_STRIKE, 'Staff'],
  [ID.MALICIOUS_CUNNING_SALVO, 'Axe'],
  [ID.MALICIOUS_SHADOWSQUALL, 'Scepter'],
  [ID.MALICIOUS_ASHEN_ASSAULT, 'Spear']
]);

// Isolate each malicious attack's resource, damage, stealth, and combo contracts from saved rotations.
function maliciousAttack(
  malice,
  {
    marked = true,
    field = 'none',
    skillId = ID.MALICIOUS_DEATHS_JUDGMENT,
    trained = false,
    offTarget = false,
    intent = false
  } = {}
) {
  return runThief(
    [{ type: 'cast', skillId, offTarget }],
    {
      specialization: 'Deadeye',
      primaryWeapon: weapons.get(skillId),
      secondaryWeapon: '',
      selectedTraitIds: [
        TRAIT.MALEFICENT_SEVEN,
        ...(trained ? [TRAIT.REVEALED_TRAINING] : []),
        ...(intent ? [TRAIT.MALICIOUS_INTENT] : [])
      ],
      attributeInputs: baseAttributeInputs({ power: 2000, precision: 5000 }),
      // Force and Impact must compose independently of the attack's malice multiplier.
      sigilSets: [{ names: ['Force', 'Impact'], strike: 1.08, strikeAdd: 0.08 }],
      professionAssumptions: { permanentComboField: field }
    },
    {
      initialize(runtime) {
        runtime.resourceController.replace('malice', malice);
        Object.assign(runtime.profession.specialization.state, {
          markedTargetId: marked ? 'primary-target' : null,
          markExpiresAt: marked ? 30 : 0
        });
        Object.assign(runtime.profession.core, { stealthStartedAt: 0, stealthUntil: 10 });
      }
    }
  );
}

for (const [skillId, weapon] of weapons) {
  test(`${weapon} malicious attack spends malice once on a marked hit and preserves it on other targets`, () => {
    for (const [marked, offTarget] of [
      [true, false],
      [false, false],
      [true, true]
    ]) {
      const result = maliciousAttack(5, { skillId, marked, offTarget, intent: true });
      assert.deepEqual(result.warnings, []);
      // Malicious Intent's new two stacks must survive the remaining hits of the same activation.
      assert.equal(observedRuntime(result).resourceController.value('malice'), marked && !offTarget ? 2 : 5);
    }
  });
}

test('pistol and spear Torment require marked malice and keep their own duration formulas', () => {
  for (const skillId of [ID.MALICIOUS_SNEAK_ATTACK, ID.MALICIOUS_ASHEN_ASSAULT]) {
    const torment = (result) =>
      result.events.find((event) => event.skillId === skillId && event.condition === 'Torment');
    for (const options of [{ marked: false }, { offTarget: true }]) {
      assert.equal(torment(maliciousAttack(5, { skillId, ...options })), undefined);
    }

    assert.equal(torment(maliciousAttack(0, { skillId })), undefined);
    assert.equal(torment(maliciousAttack(5, { skillId })).duration, skillId === ID.MALICIOUS_SNEAK_ATTACK ? 10 : 3);
  }
});

test('spear scales only its final strike and only with marked malice', () => {
  const skillId = ID.MALICIOUS_ASHEN_ASSAULT;
  const final = (malice, marked) =>
    maliciousAttack(malice, { skillId, marked }).resolvedEvents.find(
      (event) => event.name === 'Malicious Ashen Assault — Final Strike'
    ).coefficient;
  assert.ok(Math.abs(final(5, true) / final(0, true) - 1.1) < 1e-9);
  assert.equal(final(5, false), final(0, false));
});

test('pistol bleeding and scepter poison accompany landed channel strikes', () => {
  for (const [skillId, condition] of [
    [ID.MALICIOUS_SNEAK_ATTACK, 'Bleeding'],
    [ID.MALICIOUS_SHADOWSQUALL, 'Poisoned']
  ]) {
    const result = maliciousAttack(5, { skillId });
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);
    const applications = result.events.filter(
      (event) => event.type === 'condition' && event.skillId === skillId && event.condition === condition
    );
    // Assert causal coupling, not a calibrated packet count or hard-coded schedule.
    assert.deepEqual(
      applications.map((event) => event.at),
      hits.map((event) => event.at)
    );
    assert.ok(applications.every((event) => event.duration === (condition === 'Poisoned' ? 6 : 5)));
  }
});

test('pistol and shortbow malicious attacks guarantee projectile finishers', () => {
  for (const skillId of [ID.MALICIOUS_SNEAK_ATTACK, ID.MALICIOUS_SURPRISE_SHOT]) {
    const result = maliciousAttack(5, { skillId, field: 'Fire' });
    assert.ok(result.resolvedEvents.some((event) => event.type === 'combo' && event.finisherType === 'Projectile'));
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);
    assert.ok(hits.every((event) => event.comboFinishers[0].chance === 1));
  }
});

for (const skillId of [ID.MALICIOUS_DEATHS_JUDGMENT, ID.MALICIOUS_BACKSTAB]) {
  test(`Malicious attack ${skillId} consumes all marked malice and scales independently of sigils`, () => {
    const base = maliciousAttack(0, { skillId });
    const damage = (result) =>
      result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === skillId).damage;
    for (const malice of [1, 3, 5, 7]) {
      const result = maliciousAttack(malice, { skillId });
      assert.deepEqual(result.warnings, []);
      assert.equal(observedRuntime(result).resourceController.value('malice'), 0);
      assert.ok(Math.abs(damage(result) - damage(base) * (1 + malice * 0.1)) < 2);
    }

    const unmarked = maliciousAttack(5, { marked: false, skillId });
    assert.equal(observedRuntime(unmarked).resourceController.value('malice'), 5);
    assert.equal(damage(unmarked), damage(maliciousAttack(0, { marked: false, skillId })));
  });
}

test('Judgment gains Revealed Training before impact while Backstab only gains its permanent power', () => {
  // Isolate the trait's different self-reveal and hit-reveal contracts with identical base attributes.
  for (const [skillId, multiplier] of [
    [ID.MALICIOUS_DEATHS_JUDGMENT, 1.1],
    [ID.MALICIOUS_BACKSTAB, 1.04]
  ]) {
    const damage = (trained) =>
      maliciousAttack(0, { skillId, trained }).resolvedEvents.find(
        (event) => event.type === 'damage' && event.skillId === skillId
      ).damage;
    assert.ok(Math.abs(damage(true) - damage(false) * multiplier) < 2);
  }
});

test('Judgment leaves stealth with three seconds of Revealed and guarantees a projectile combo', () => {
  const result = maliciousAttack(5, { field: 'Fire' });
  assert.deepEqual(result.warnings, []);
  const core = observedRuntime(result).profession.core;
  const action = result.events.find(
    (event) => event.type === 'action' && event.skillId === ID.MALICIOUS_DEATHS_JUDGMENT
  );
  assert.equal(core.stealthUntil, action.at);
  assert.equal(core.revealedUntil, action.at + 3);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo' && event.finisherType === 'Projectile');
  assert.ok(combo);
  assert.equal(combo.fieldType, 'Fire');
  const hit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.MALICIOUS_DEATHS_JUDGMENT
  );
  assert.equal(hit.comboFinishers[0].chance, 1);
});
