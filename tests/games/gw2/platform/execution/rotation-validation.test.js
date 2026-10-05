import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { createWarriorBuildDefaults, validateWarriorBuild } from '#gw2/professions/warrior/build/build.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

const build = createWarriorBuildDefaults();
const slash = { type: 'cast', skillId: ID.DRAGON_SLASH_FORCE };
const ordinary = { type: 'cast', skillId: warriorCatalog.skillsByName.get('Chop').id };
const validate = (command) => validateWarriorBuild({ ...build, rotation: [command] });
const normalize = (command) => normalizeRotation([command], warriorCatalog, { strict: true });

// Build validation and execution must reject the same malformed intent before optional fields are discarded.
test('builds and execution reject nonboolean offTarget and non-Dragon Slash release delays', () => {
  for (const command of [
    ...['yes', 1, {}].map((offTarget) => ({ ...ordinary, offTarget })),
    ...[0, 80].map((releaseDelayMs) => ({ ...ordinary, releaseDelayMs })),
    { type: 'wait', durationMs: 100, releaseDelayMs: 80 }
  ]) {
    assert.equal(validate(command).valid, false, JSON.stringify(command));
    assert.throws(() => normalize(command), TypeError);
    assert.throws(() => simulateGw2({ profession: warriorProfession, rotation: [command] }), TypeError);
  }
});

// One rule set owns numeric constraints, command-specific fields, and contradictory targeting.
test('canonical command validation reports matching errors for builds and strict normalization', () => {
  const invalid = [
    null,
    [],
    { type: 'invalid' },
    { type: 'cast' },
    { ...ordinary, offTarget: 'yes' },
    { ...ordinary, offTarget: true, impactDelayMs: 100 },
    { ...ordinary, releaseAtCharges: 0 },
    { ...ordinary, releaseAtCharges: 1.5 },
    { ...ordinary, doubleEdgeOutcome: 'random' },
    { ...ordinary, releaseDelayMs: 0 },
    { type: 'wait' },
    { type: 'wait', durationMs: -1 },
    { type: 'wait', durationMs: 1, concurrentOffsetMs: 0 },
    { type: 'combat-start', concurrentOffsetMs: Infinity },
    ...['interruptAfterMs', 'initialStateDurationMs', 'impactDelayMs', 'releaseAtCharges', 'releaseDelayMs'].map(
      (field) => ({ type: 'wait', durationMs: 100, [field]: 1 })
    ),
    { type: 'combat-start', offTarget: true },
    { type: 'cooldown-reset', doubleEdgeOutcome: 'success' },
    ...['concurrentOffsetMs', 'interruptAfterMs', 'initialStateDurationMs', 'impactDelayMs', 'releaseDelayMs'].flatMap(
      (field) => [-1, Infinity, NaN].map((value) => ({ ...slash, [field]: value }))
    )
  ];
  for (const command of invalid) {
    const validation = validate(command);
    assert.equal(validation.valid, false, JSON.stringify(command));
    assert.throws(
      () => normalize(command),
      (error) => {
        assert.ok(validation.errors.includes(error.message), error.message);
        return true;
      }
    );
  }
});

// Valid controls and cast intent survive the same boundary; redundant zero/false fields are normalized away.
test('builds and normalization accept valid canonical controls and Dragon Slash holds', () => {
  for (const command of [
    { ...ordinary, offTarget: true },
    { ...ordinary, offTarget: false },
    { ...ordinary, impactDelayMs: 100 },
    { ...slash, releaseAtCharges: 3, releaseDelayMs: 80 },
    { ...slash, releaseDelayMs: 0 },
    { type: 'wait', durationMs: 0 },
    { type: 'combat-start', concurrentOffsetMs: -100 },
    { type: 'cooldown-reset' }
  ]) {
    assert.equal(validate(command).valid, true, JSON.stringify(command));
    const [normalized] = normalize(command);
    assert.equal(validate(normalized).valid, true);
    assert.deepEqual(normalize(normalized), [normalized]);
  }

  assert.deepEqual(normalize({ ...slash, releaseDelayMs: 0 }), [slash]);
  assert.deepEqual(normalize({ ...ordinary, offTarget: false }), [ordinary]);
});

// Name decoding supplies the capability lookup; best-effort migration drops only invalid entries.
test('shorthand release holds use the shared rules without displacing neighboring commands', () => {
  const namedSlash = { name: warriorCatalog.skillsById.get(slash.skillId).name, releaseDelayMs: 80 };
  const invalid = { name: warriorCatalog.skillsById.get(ordinary.skillId).name, releaseDelayMs: 0 };
  assert.deepEqual(normalizeRotation([ordinary, invalid, namedSlash], warriorCatalog), [
    ordinary,
    { ...slash, releaseDelayMs: 80 }
  ]);
  assert.throws(() => normalize(invalid), /only Dragon Slash/);
});
