import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

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
      sigilSets: [{ names: ['Force', 'Impact'], strikeAdd: 0.08 }],
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
  test(`${weapon} malicious attack spends malice once if it hits the mark and preserves it on other targets`, () => {
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

// Mercy and Backstab compete for the same malice. Whichever resolves first claims the stacks.
test('Mercy during Backstab trades its damage bonus for initiative', () => {
  const simulate = (offset) =>
    runThief(
      [ID.MALICIOUS_BACKSTAB, { type: 'cast', skillId: ID.MERCY, concurrentOffsetMs: offset }],
      { specialization: 'Deadeye', primaryWeapon: 'Dagger', initialInitiative: 0, selectedSkillIds: [ID.MERCY] },
      {
        initialize(runtime) {
          runtime.resourceController.replace('malice', 4);
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: 'primary-target',
            markExpiresAt: 30
          });
          runtime.profession.core.stealthUntil = 10;
        }
      }
    );
  const before = simulate(80);
  const after = simulate(320);
  const strike = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.MALICIOUS_BACKSTAB);
  assert.deepEqual(before.warnings, []);
  assert.deepEqual(after.warnings, []);
  assert.equal(strike(before).deadeyeMaliceSnapshot, 0);
  assert.equal(strike(after).deadeyeMaliceSnapshot, 4);
  assertFlooredDamageMultiplier(strike(after).damage, strike(before).damage, 1.4);
  const initiative = (result) => observedRuntime(result).resourceController.value('initiative');
  assert.ok(Math.abs(initiative(before) - initiative(after) - 4) < 1e-9);
});

test('pistol and spear Torment require marked malice and keep their own duration formulas', () => {
  for (const skillId of [ID.MALICIOUS_SNEAK_ATTACK, ID.MALICIOUS_ASHEN_ASSAULT]) {
    const torment = (result) =>
      result.resolvedEvents.find((event) => event.skillId === skillId && event.condition === 'Torment');
    for (const options of [{ marked: false }, { offTarget: true }]) {
      assert.equal(torment(maliciousAttack(5, { skillId, ...options })), undefined);
    }

    assert.equal(torment(maliciousAttack(0, { skillId })), undefined);
    assert.equal(
      torment(maliciousAttack(5, { skillId })).effectiveDuration,
      skillId === ID.MALICIOUS_SNEAK_ATTACK ? 10 : 2.5
    );
  }
});

// Mercy can claim the same stacks as the sword's endurance refund, even within a single animation.
test('Tactical Strike refunds endurance for the malice still held when the sword hits', () => {
  const skillId = ID.MALICIOUS_TACTICAL_STRIKE;
  const simulate = (offset) =>
    runThief(
      [skillId, { type: 'cast', skillId: ID.MERCY, concurrentOffsetMs: offset }],
      { specialization: 'Deadeye', primaryWeapon: 'Sword', initialEndurance: 0, selectedSkillIds: [ID.MERCY] },
      {
        initialize(runtime) {
          runtime.resourceController.replace('malice', 4);
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: 'primary-target',
            markExpiresAt: 30
          });
          runtime.profession.core.stealthUntil = 10;
        }
      }
    );
  const before = simulate(80);
  const after = simulate(320);
  assert.deepEqual(before.warnings, []);
  assert.deepEqual(after.warnings, []);
  const endurance = (result) => observedRuntime(result).profession.core.endurance.value;
  assert.ok(Math.abs(endurance(after) - endurance(before) - 40) < 1e-8);
});

test('spear scales only its final strike and only with marked malice', () => {
  const skillId = ID.MALICIOUS_ASHEN_ASSAULT;
  const final = (malice, marked) =>
    maliciousAttack(malice, { skillId, marked }).resolvedEvents.find(
      (event) => event.name === 'Malicious Ashen Assault - Final Strike'
    ).damage;
  assertFlooredDamageMultiplier(final(5, true), final(0, true), 1.1);
  assert.equal(final(5, false), final(0, false));
});

// Interleaved Mercy resolves against the resource held during a channel or projectile flight.
for (const [weapon, skillId, impactDelayMs, before, after] of [
  ['Spear', ID.MALICIOUS_ASHEN_ASSAULT, 0, 640, 1240],
  ['Shortbow', ID.MALICIOUS_SURPRISE_SHOT, 200, 320, 480],
  ['Staff', ID.MALICIOUS_HOOK_STRIKE, 0, 320, 600],
  ['Pistol', ID.MALICIOUS_SNEAK_ATTACK, 120, 400, 800]
]) {
  test(`${weapon} keeps malice available for Mercy until the attack spends it`, () => {
    const run = (offset) =>
      runThief(
        [
          { type: 'cast', skillId, impactDelayMs },
          { type: 'cast', skillId: ID.MERCY, concurrentOffsetMs: offset }
        ],
        { specialization: 'Deadeye', primaryWeapon: weapon, initialInitiative: 0, selectedSkillIds: [ID.MERCY] },
        {
          initialize(runtime) {
            runtime.resourceController.replace('malice', 3);
            Object.assign(runtime.profession.specialization.state, {
              markedTargetId: 'primary-target',
              markExpiresAt: 30
            });
            runtime.profession.core.stealthUntil = 10;
          }
        }
      );
    const early = run(before);
    const late = run(after);
    assert.deepEqual(early.warnings, []);
    assert.deepEqual(late.warnings, []);
    const initiativeGain = (r) => {
      const rt = observedRuntime(r);
      return rt.resourceController.value('initiative') - rt.time;
    };

    assert.ok(Math.abs(initiativeGain(early) - initiativeGain(late) - 3) < 1e-8);

    if (weapon === 'Spear') {
      const torment = (r) => r.resolvedEvents.find((e) => e.skillId === skillId && e.condition === 'Torment');
      assert.equal(torment(early), undefined);
      assert.equal(torment(late).effectiveDuration, 1.5);
      const final = (r) => r.resolvedEvents.find((e) => e.name === 'Malicious Ashen Assault - Final Strike');
      assertFlooredDamageMultiplier(final(late).damage, final(early).damage, 1.06);
    } else if (weapon === 'Pistol') {
      const torment = (r) => r.resolvedEvents.filter((e) => e.skillId === skillId && e.condition === 'Torment');
      assert.equal(torment(run(240)).length, 0);
      assert.deepEqual(
        torment(early).map((e) => e.effectiveDuration),
        [6]
      );
      assert.deepEqual(
        torment(late).map((e) => e.effectiveDuration),
        [6]
      );
    } else if (weapon === 'Staff') {
      const quickness = (r) => r.events.filter((e) => e.skillId === skillId && e.kind === 'quickness');
      assert.equal(quickness(early).length, 0);
      assert.deepEqual(
        quickness(late).map((e) => e.duration),
        [2.25]
      );
    } else {
      const hit = early.resolvedEvents.find((e) => e.skillId === skillId && e.type === 'damage');
      assert.ok(early.steps.find((step) => step.skillId === ID.MERCY).start < hit.at * 1000);
      assert.ok(hit.at * 1000 < early.steps[0].end);
    }
  });
}

// A bullet already in flight can qualify an interrupted channel when it reaches the mark.
test('pistol interruption spends malice only if a released bullet hits', () => {
  const skillId = ID.MALICIOUS_SNEAK_ATTACK;
  for (const [interruptAfterMs, landed] of [
    [80, false],
    [200, true]
  ]) {
    const result = runThief(
      [
        { type: 'cast', skillId, interruptAfterMs, impactDelayMs: 400 },
        { type: 'wait', durationMs: 800 }
      ],
      { specialization: 'Deadeye', primaryWeapon: 'Pistol' },
      {
        initialize(runtime) {
          runtime.resourceController.replace('malice', 4);
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: 'primary-target',
            markExpiresAt: 30
          });
          runtime.profession.core.stealthUntil = 10;
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const torment = result.resolvedEvents.filter((e) => e.skillId === skillId && e.condition === 'Torment');
    assert.deepEqual(
      torment.map((e) => e.effectiveDuration),
      landed ? [8] : []
    );
    assert.equal(observedRuntime(result).resourceController.value('malice'), landed ? 0 : 4);
  }
});

test('pistol bleeding and scepter poison accompany landed channel strikes', () => {
  for (const [skillId, condition] of [
    [ID.MALICIOUS_SNEAK_ATTACK, 'Bleeding'],
    [ID.MALICIOUS_SHADOWSQUALL, 'Poisoned']
  ]) {
    const result = maliciousAttack(5, { skillId });
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);
    const applications = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skillId && event.condition === condition
    );
    // Assert causal coupling, not a calibrated packet count or hard-coded schedule.
    assert.deepEqual(
      applications.map((event) => event.at),
      hits.map((event) => event.at)
    );
    assert.ok(applications.every((event) => event.effectiveDuration === (condition === 'Poisoned' ? 12 : 5)));
  }
});

// Move Mercy around actual impacts to distinguish live reads, channel spending, and already-applied poison.
test('Shadowsquall keeps malice available to Mercy through the last hit', () => {
  const skillId = ID.MALICIOUS_SHADOWSQUALL;
  const run = ({ mercy, interruptAfterMs } = {}) =>
    runThief(
      [
        { type: 'cast', skillId, interruptAfterMs },
        ...(mercy == null ? [] : [{ type: 'cast', skillId: ID.MERCY, concurrentOffsetMs: mercy }])
      ],
      { specialization: 'Deadeye', primaryWeapon: 'Scepter', initialInitiative: 0, selectedSkillIds: [ID.MERCY] },
      {
        initialize(runtime) {
          runtime.resourceController.replace('malice', 5);
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: 'primary-target',
            markExpiresAt: 30
          });
          runtime.profession.core.stealthUntil = 10;
        }
      }
    );
  const poisons = (result) =>
    result.resolvedEvents.filter(
      (event) => event.skillId === skillId && event.type === 'condition' && event.condition === 'Poisoned'
    );
  const baseline = run();
  const hits = poisons(baseline);
  const end = baseline.steps[0].end / 1000;
  const between = (a, b) => Math.round(500 * (a + b));
  const middle = between(hits[3].at, hits[4].at);
  const late = between(hits.at(-1).at, end);
  assert.ok(hits.at(-1).at < late / 1000 && late / 1000 < end);
  for (const mercy of [middle, late]) {
    const result = run({ mercy });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      poisons(result).map((event) => event.effectiveDuration),
      hits.map((event) => (event.at < mercy / 1000 ? 12 : 6))
    );
    assert.equal(observedRuntime(result).resourceController.value('malice'), 0);
  }

  const after = run({ mercy: Math.round(end * 1000) });
  assert.deepEqual(after.warnings, []);
  const initiative = (result) => observedRuntime(result).resourceController.value('initiative');
  assert.ok(Math.abs(initiative(run({ mercy: late })) - initiative(after) - 5) < 1e-8);
  assert.equal(observedRuntime(run({ interruptAfterMs: middle })).resourceController.value('malice'), 0);
  assert.equal(
    observedRuntime(run({ interruptAfterMs: between(0, hits[0].at) })).resourceController.value('malice'),
    5
  );
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
    const comparison =
      skillId === ID.MALICIOUS_DEATHS_JUDGMENT
        ? maliciousAttack(5, { skillId })
        : maliciousAttack(0, { marked: false, skillId });
    assert.equal(damage(unmarked), damage(comparison));
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
