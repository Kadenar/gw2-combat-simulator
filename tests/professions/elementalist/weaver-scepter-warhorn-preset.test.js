import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";

const rotationUrl = new URL(
  "../../../Rotations/elementalist/r-condi-weaver-scepter.json",
  import.meta.url,
);
const buildUrl = new URL(
  "../../../Builds/elementalist/b-condi-weaver-scepter.json",
  import.meta.url,
);

const entryName = (entry) => (typeof entry === "string" ? entry : entry.name);

test("condition Weaver scepter/warhorn reconstructs the benchmark rotation", async () => {
  const preset = JSON.parse(await readFile(rotationUrl, "utf8"));
  const names = preset.rotation.map(entryName);
  const counts = Object.fromEntries(
    [...new Set(names)].map((name) => [
      name,
      names.filter((candidate) => candidate === name).length,
    ]),
  );

  assert.deepEqual(preset.metadata, {
    report: "https://dps.report/qcqm-20260813-042826_golem",
    benchmarkDurationSeconds: 90.535,
    benchmarkDamage: 3977301,
    benchmarkDps: 43931.08742475286,
    timingSource: "Elite Insights activation timings",
    note: "The hidden opener starts from Earth/Air and precasts Rock Barrier before Fire and Air attunements establish Air/Fire for Wildfire and Weave Self. The following Fire attunement establishes Fire/Air for Lightning Orb and Dragon's Tooth before the opening signets. Unravel activations occur at 17.965s, 47.921s, and 88.723s; Elite Insights' simultaneous Dual attunement records are the resulting fully attuned state changes, not duplicate rotation commands.",
  });
  assert.deepEqual(names.slice(0, 13), [
    "Rock Barrier",
    "Fire Attunement",
    "Air Attunement",
    "Wildfire",
    "Weave Self",
    "Fire Attunement",
    "Lightning Orb",
    "Dragon's Tooth",
    "Signet of Fire",
    "__combat_start",
    "Signet of Earth",
    "Fire Attunement",
    "Phoenix",
  ]);
  assert.deepEqual(preset.rotation[9], {
    name: "__combat_start",
    offset: 438,
  });
  assert.deepEqual(
    Object.fromEntries(
      [
        "Flamestrike",
        "Dragon's Tooth",
        "Phoenix",
        "Hurl",
        "Rock Barrier",
        "Stone Shards",
        "Signet of Fire",
        "Signet of Earth",
        "Fracturing Strike",
        "Dust Storm",
        "Wildfire",
        "Lightning Orb",
        "Air Attunement",
        "Primordial Stance (Fire)",
        "Primordial Stance (Earth)",
        "Water Attunement",
        "Unravel",
        "Weave Self",
      ].map((name) => [name, counts[name]]),
    ),
    {
      Flamestrike: 52,
      "Dragon's Tooth": 17,
      Phoenix: 11,
      Hurl: 11,
      "Rock Barrier": 11,
      "Stone Shards": 19,
      "Signet of Fire": 9,
      "Signet of Earth": 7,
      "Fracturing Strike": 7,
      "Dust Storm": 5,
      Wildfire: 5,
      "Lightning Orb": 1,
      "Air Attunement": 2,
      "Primordial Stance (Fire)": 3,
      "Primordial Stance (Earth)": 3,
      "Water Attunement": 3,
      Unravel: 3,
      "Weave Self": 2,
    },
  );
  assert.deepEqual(
    preset.rotation
      .filter(
        (entry) =>
          entryName(entry) === "Stone Shards" && entry.interruptMs != null,
      )
      .map((entry) => entry.interruptMs),
    [40, 160, 38, 403, 121, 159, 201, 79],
  );
  assert.deepEqual(
    preset.rotation
      .filter(
        (entry) =>
          entryName(entry) === "Flamestrike" && entry.interruptMs != null,
      )
      .map((entry) => entry.interruptMs),
    [81, 37, 34, 82, 40],
  );

  const [savedBuild, adapter] = await Promise.all([
    readFile(buildUrl, "utf8").then(JSON.parse),
    loadProfessionAppAdapter("elementalist"),
  ]);
  assert.equal(savedBuild.schemaVersion, 3);
  assert.equal(savedBuild.profession, "elementalist");
  assert.deepEqual(savedBuild.weaponSigils, [
    ["Malice", "Earth"],
    ["Malice", "Earth"],
  ]);
  assert.equal(savedBuild.food, "Salsa-Topped Veggie Flatbread");
  assert.deepEqual(savedBuild.infusions[0], {
    stat: "Expertise",
    count: 18,
  });
  assert.equal(savedBuild.gear.Back, "Viper's");
  assert.equal(savedBuild.startAttunement, "Earth");
  assert.equal(savedBuild.secondaryAttunement, "Air");
  const build = {
    ...adapter.toApplicationBuild({
      ...savedBuild,
      rotation: preset.rotation,
    }),
    rotation: preset.rotation,
  };
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1,
  };

  adapter.recalculate(app);
  const result = adapter.simulateBuild(
    build.rotation,
    adapter.simulationConfig(app),
  );

  assert.deepEqual(result.warnings, []);
  assert.ok(result.totalDamage > 0);
  assert.equal(Math.round(result.dps), 42830);

  const assertStoneShardPackets = (simulation, expectedActionCount) => {
    const actions = simulation.events.filter(
      (event) => event.type === "action" && event.skillName === "Stone Shards",
    );
    assert.equal(actions.length, expectedActionCount);
    for (const action of actions) {
      const effectiveCastMs = Math.round((action.endsAt - action.at) * 1000);
      const expectedOffsets = [720, 1000, 1240].filter(
        (offset) => offset <= effectiveCastMs,
      );
      const packets = (type) =>
        simulation.resolvedEvents.filter(
          (event) =>
            event.activationId === action.activationId &&
            event.skillName === "Stone Shards" &&
            event.type === type &&
            (type !== "condition" || event.condition === "Bleeding"),
        );
      const strikePackets = packets("damage");
      const bleedingPackets = packets("condition");
      const packetOffsets = (packetList) =>
        packetList.map((event) => Math.round((event.at - action.at) * 1000));

      assert.deepEqual(packetOffsets(strikePackets), expectedOffsets);
      assert.deepEqual(packetOffsets(bleedingPackets), expectedOffsets);
      assert.ok(strikePackets.every((packet) => packet.coefficient === 0.5));
      for (const packet of strikePackets) {
        assert.deepEqual(
          packet.comboFinishers.map(
            ({ ownerId, finisherType, chance, ambiguousFieldSelection }) => ({
              ownerId,
              finisherType,
              chance,
              ambiguousFieldSelection,
            }),
          ),
          [
            {
              ownerId: "elementalist",
              finisherType: "Projectile",
              chance: 0.2,
              ambiguousFieldSelection: "oldest",
            },
          ],
        );
      }
      assert.ok(
        bleedingPackets.every(
          (packet) => packet.stacks === 1 && packet.duration === 6,
        ),
      );
    }
  };

  assertStoneShardPackets(result, 19);

  const packetProbeRotation = [719, 720, 999, 1000, 1239, 1240].map(
    (interruptMs) => ({ name: "Stone Shards", interruptMs }),
  );
  const packetProbeBuild = {
    ...adapter.toApplicationBuild({
      ...savedBuild,
      rotation: packetProbeRotation,
    }),
    targetHealth: Number.MAX_SAFE_INTEGER,
    rotation: packetProbeRotation,
  };
  const packetProbeApp = { ...app, build: packetProbeBuild };
  adapter.recalculate(packetProbeApp);
  const packetProbeResult = adapter.simulateBuild(
    packetProbeBuild.rotation,
    adapter.simulationConfig(packetProbeApp),
  );

  assert.deepEqual(packetProbeResult.warnings, []);
  assertStoneShardPackets(packetProbeResult, 6);
});
