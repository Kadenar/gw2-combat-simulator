import assert from "node:assert/strict";
import { nativeSkillRuntimeOwner } from "../../js/platform/gw2/native-profession.js";

const EXECUTABLE_FAMILY_KEYS = Object.freeze([
  "createProfessionState",
  "createResolverState",
  "taskHandlers",
  "eventHandlers",
  "eventReactions",
  "initialize",
  "availability",
  "scheduleSkill",
  "modifyAttributes",
  "modifyStrikeDamage",
]);

function sortedIds(entries) {
  return entries.map(entry => String(entry.id)).sort();
}

function registryKeys(core, specialization, container, key) {
  return [
    ...Object.keys(core.mechanics?.[container]?.[key] || {}),
    ...Object.keys(specialization?.mechanics?.[container]?.[key] || {}),
  ].sort();
}

export function assertProfessionFamilyConformance({
  family,
  core,
  specializations,
}) {
  assert.equal(typeof family.resolveRuntime, "function");
  const modules = [core, ...Object.values(specializations)];
  for (const key of EXECUTABLE_FAMILY_KEYS) {
    assert.equal(Object.hasOwn(family, key), false, `${family.id}.${key}`);
  }

  for (const [name, specialization] of [
    ["Core", null],
    ...Object.entries(specializations),
  ]) {
    const config = { specialization: name };
    const runtime = family.resolveRuntime(config);
    assert.equal(family.resolveRuntime(config), runtime, `${family.id}/${name}`);
    assert.equal(runtime.id, family.id);
    assert.equal(runtime.createProfessionState(config).specialization.kind, name);
    assert.deepEqual(
      sortedIds(runtime.catalog.skills),
      sortedIds(family.catalog.skills.filter(skill => {
        const owner = nativeSkillRuntimeOwner(modules, skill);
        return owner === "Core" || owner === name;
      })),
      `${family.id}/${name} skills`,
    );
    assert.deepEqual(
      sortedIds(runtime.catalog.traits),
      sortedIds([
        ...(core.data.traits || []),
        ...(specialization?.data.traits || []),
      ]),
      `${family.id}/${name} traits`,
    );
    assert.deepEqual(
      Object.keys(runtime.taskHandlers).sort(),
      registryKeys(
        core,
        specialization,
        "schedulerHooks",
        "taskHandlers",
      ),
      `${family.id}/${name} task handlers`,
    );
    assert.deepEqual(
      Object.keys(runtime.eventHandlers).sort(),
      registryKeys(
        core,
        specialization,
        "resolverHooks",
        "eventHandlers",
      ),
      `${family.id}/${name} event handlers`,
    );
  }

  assert.throws(
    () => family.resolveRuntime({ specialization: "__missing__" }),
    /Unknown .* elite specialization "__missing__"/,
  );
}
