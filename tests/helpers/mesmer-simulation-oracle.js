import assert from "node:assert/strict";

const DAMAGE_FIELDS = new Set([
  "damage",
  "strikeDamage",
  "conditionDamage",
  "totalDamage",
  "dps",
]);
const WEAPON_RANDOMNESS_FIELDS = new Set([
  "activationId",
  "weaponStrength",
  "weaponStrengthProfileId",
  "resolvedWeaponStrength",
  "weaponStrengthSampled",
]);

function withoutWeaponRandomnessFields(value) {
  if (Array.isArray(value)) return value.map(withoutWeaponRandomnessFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !WEAPON_RANDOMNESS_FIELDS.has(key))
        .map(([key, child]) => [
          key,
          withoutWeaponRandomnessFields(child),
        ]),
    );
  }
  return value;
}

function canonical(value) {
  if (Object.is(value, -0)) return 0;
  if (value instanceof Map) {
    return canonical(Object.fromEntries(value));
  }
  if (value instanceof Set) {
    return [...value].map(canonical).sort();
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

function splitDamage(value) {
  if (Array.isArray(value)) {
    const children = value.map(splitDamage);
    return {
      exact: children.map(child => child.exact),
      damage: children.map(child => child.damage),
    };
  }
  if (value && typeof value === "object") {
    const exact = {};
    const damage = {};
    for (const [key, child] of Object.entries(value)) {
      if (DAMAGE_FIELDS.has(key)) {
        damage[key] = child;
        continue;
      }
      const split = splitDamage(child);
      exact[key] = split.exact;
      if (
        split.damage
        && (
          typeof split.damage !== "object"
          || Object.keys(split.damage).length
        )
      ) {
        damage[key] = split.damage;
      }
    }
    return { exact, damage };
  }
  return { exact: value, damage: undefined };
}

export function normalizeMesmerResult(result) {
  const publicResult = {
    steps: result.steps,
    warnings: result.warnings,
    events: result.events,
    resolvedEvents: result.resolvedEvents,
    cooldowns: result.endState?.cooldowns,
    ammo: result.endState?.ammo,
    activeWeaponSet: result.endState?.activeWeaponSet,
    profession: result.endState?.profession,
    duration: result.duration,
    dpsWindow: result.dpsWindow,
    totalDamage: result.totalDamage,
    strikeDamage: result.strikeDamage,
    conditionDamage: result.conditionDamage,
    dps: result.dps,
  };
  return splitDamage(canonical(publicResult));
}

function assertDamageClose(name, expected, actual, tolerance, path = "damage") {
  if (expected == null || typeof expected !== "object") {
    if (typeof expected === "number" && typeof actual === "number") {
      const scale = Math.max(1, Math.abs(expected), Math.abs(actual));
      assert.ok(
        Math.abs(expected - actual) <= tolerance * scale,
        `${name}: ${path} differs (${expected} !== ${actual})`,
      );
      return;
    }
    assert.deepEqual(actual, expected, `${name}: ${path}`);
    return;
  }
  assert.deepEqual(
    Object.keys(actual || {}).sort(),
    Object.keys(expected).sort(),
    `${name}: ${path} keys`,
  );
  for (const key of Object.keys(expected)) {
    assertDamageClose(
      name,
      expected[key],
      actual[key],
      tolerance,
      `${path}.${key}`,
    );
  }
}

export function assertMesmerResultParity(
  name,
  expectedResult,
  actualResult,
  { damageTolerance = 1e-9 } = {},
) {
  const expected =
    expectedResult?.exact && expectedResult?.damage
      ? expectedResult
      : normalizeMesmerResult(expectedResult);
  const actual = normalizeMesmerResult(actualResult);
  assert.deepEqual(
    withoutWeaponRandomnessFields(actual.exact),
    withoutWeaponRandomnessFields(expected.exact),
    `${name}: exact result`,
  );
  assertDamageClose(
    name,
    expected.damage,
    actual.damage,
    damageTolerance,
  );
}
