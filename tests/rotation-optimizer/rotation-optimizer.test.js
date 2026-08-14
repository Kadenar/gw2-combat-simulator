import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDefaultBuild } from "../../js/app/build/persistence.js";
import {
  loadProfessionAppAdapter,
  nativeProfessionRegistry,
} from "../../js/app/profession/registry.js";
import {
  enumerateRotationOptimizerCandidates,
  skillHasDeclaredDamage,
} from "../../js/rotation-optimizer/candidates.js";
import { loadRotationOptimizerSimulation } from "../../js/rotation-optimizer/profession-loader.js";
import {
  normalizeFixedWindowRotation,
  splitRotationAtCombatStart,
} from "../../js/rotation-optimizer/normalization.js";
import { runRotationSearch } from "../../js/rotation-optimizer/search.js";

function fakeSimulation(rotation) {
  let timeMs = 0;
  let damage = 0;
  let empowered = false;
  let activeWeaponSet = 1;
  let combatStartMs = null;
  const cooldowns = new Map();
  const steps = [];
  rotation.forEach((entry, ri) => {
    const name = typeof entry === "string" ? entry : entry.name;
    let start = timeMs;
    let invalid = false;
    if (name === "__wait") {
      timeMs += Number(entry.waitMs || 0);
    } else if (name === "__combat_start") {
      combatStartMs = timeMs;
    } else if (name === "Swap Weapons") {
      activeWeaponSet = activeWeaponSet === 1 ? 2 : 1;
    } else if (name === "Set Two Strike") {
      invalid = activeWeaponSet !== 2;
      if (!invalid) {
        timeMs += 500;
        damage += 500;
      }
    } else if (name === "Set One Strike") {
      invalid = activeWeaponSet !== 1;
      if (!invalid) {
        timeMs += 500;
        damage += 100;
      }
    } else if (name === "Burst") {
      start = Math.max(timeMs, cooldowns.get(name) || 0);
      timeMs = start + 500;
      damage += 500;
      cooldowns.set(name, start + 3_000);
    } else if (name === "Filler") {
      timeMs += 500;
      damage += 100;
    } else if (name === "Empower") {
      timeMs += 200;
      empowered = true;
    } else if (name === "Strike") {
      timeMs += 1_000;
      damage += empowered ? 300 : 100;
    } else if (name === "Heal") {
      timeMs += 500;
    }
    steps.push({
      ri,
      skill: name === "__combat_start" ? "Combat Start" : name,
      start,
      actualStart: start,
      end: timeMs,
      invalid,
    });
  });
  const dpsStartMs = combatStartMs ?? 0;
  const dpsWindowSeconds = Math.max(0.001, (timeMs - dpsStartMs) / 1_000);
  return {
    duration: Math.max(0.001, timeMs / 1_000),
    combatStartTime:
      combatStartMs == null ? (damage ? 0 : null) : combatStartMs / 1_000,
    hasExplicitCombatStart: combatStartMs != null,
    dpsStartTime: dpsStartMs / 1_000,
    dpsWindow: dpsWindowSeconds,
    firstHitTime: damage ? dpsStartMs / 1_000 : null,
    lastHitTime: damage ? timeMs / 1_000 : null,
    deathTime: null,
    totalDamage: damage,
    dps: damage / dpsWindowSeconds,
    strikeDamage: damage,
    conditionDamage: 0,
    breakdown: [],
    conditionBreakdown: [],
    events:
      combatStartMs == null
        ? []
        : [{ type: "combat_start", at: combatStartMs / 1_000 }],
    resolvedEvents: [],
    procSteps: [],
    warnings: [],
    casts: [],
    randomness: { mode: "deterministic", seed: 0 },
    profession: { empowered },
    steps,
    endState: {
      time: timeMs,
      cooldowns: Object.fromEntries(cooldowns),
      ammo: {},
      activeWeaponSet,
      profession: { empowered },
    },
    schedulerState: {},
    snapshot: {},
  };
}

test("declared damage recognizes strike and condition effects", () => {
  assert.equal(
    skillHasDeclaredDamage({
      id: 1,
      name: "Strike",
      effects: [{ type: "strike", coefficient: 1 }],
    }),
    true,
  );
  assert.equal(
    skillHasDeclaredDamage({
      id: 2,
      name: "Bleed",
      effects: [
        { type: "condition", condition: "Bleeding", stacks: 1, duration: 4 },
      ],
    }),
    true,
  );
  assert.equal(
    skillHasDeclaredDamage({
      id: 3,
      name: "Utility",
      effects: [{ type: "boon", boon: "Might", duration: 5 }],
    }),
    false,
  );
});

test("search retains a useful zero-damage enabler and removes useless actions", () => {
  const result = runRotationSearch(
    {
      professionId: "fixture",
      config: {},
      horizonMs: 3_000,
      beamWidth: 4,
      branchLimit: 4,
      enablerReserve: 2,
      maxActions: 5,
      timeBudgetMs: 5_000,
      candidates: [
        {
          skillId: 1,
          name: "Strike",
          declaredDamage: true,
          potentialEnabler: false,
        },
        {
          skillId: 2,
          name: "Empower",
          declaredDamage: false,
          potentialEnabler: true,
        },
        {
          skillId: 3,
          name: "Heal",
          declaredDamage: false,
          potentialEnabler: true,
        },
      ],
    },
    fakeSimulation,
  );

  assert.equal(
    result.rotation.some((entry) => entry.name === "Empower"),
    true,
  );
  assert.equal(
    result.rotation.some((entry) => entry.name === "Heal"),
    false,
  );
  assert.ok(result.totalDamage >= 600);
});

test("search fills cooldown gaps instead of fast-forwarding to repeated skills", () => {
  const progressUpdates = [];
  const result = runRotationSearch(
    {
      professionId: "fixture",
      config: {},
      horizonMs: 4_000,
      beamWidth: 4,
      branchLimit: 4,
      enablerReserve: 0,
      maxActions: 10,
      timeBudgetMs: 5_000,
      candidates: [
        {
          skillId: 1,
          name: "Burst",
          declaredDamage: true,
          potentialEnabler: false,
        },
        {
          skillId: 2,
          name: "Filler",
          declaredDamage: true,
          potentialEnabler: false,
        },
      ],
    },
    fakeSimulation,
    (progress) => progressUpdates.push(progress),
  );

  const replay = fakeSimulation(result.rotation);
  assert.equal(replay.duration, 4);
  assert.equal(result.dps, replay.dps);
  for (let index = 1; index < replay.steps.length; index += 1) {
    assert.ok(
      replay.steps[index].actualStart <= replay.steps[index - 1].end + 0.5,
      `preventable cooldown gap before ${replay.steps[index].skill}`,
    );
  }
  assert.ok(result.rotation.some((entry) => entry.name === "Filler"));
  assert.equal(progressUpdates.at(-1).simulatedTimeMs, 4_000);
});

test("search preserves precasts and measures its horizon from Combat Start", () => {
  const progressUpdates = [];
  const result = runRotationSearch(
    {
      professionId: "fixture",
      config: {},
      setupRotation: ["Empower", { name: "__combat_start" }],
      horizonMs: 2_000,
      beamWidth: 2,
      branchLimit: 2,
      enablerReserve: 0,
      maxActions: 3,
      timeBudgetMs: 5_000,
      candidates: [
        {
          skillId: 1,
          name: "Strike",
          declaredDamage: true,
          potentialEnabler: false,
        },
      ],
    },
    fakeSimulation,
    (progress) => progressUpdates.push(progress),
  );

  assert.deepEqual(result.rotation.slice(0, 2), [
    "Empower",
    { name: "__combat_start" },
  ]);
  assert.equal(result.combatStartTimeMs, 200);
  assert.equal(result.precastActions, 1);
  assert.equal(result.activeDurationMs, 2_000);
  assert.equal(result.actions, 2);
  assert.equal(progressUpdates.at(-1).simulatedTimeMs, 2_000);
  assert.equal(progressUpdates.at(-1).precastDurationMs, 200);
  assert.equal(fakeSimulation(result.rotation).dps, result.dps);
});

test("search explores weapon swaps without revisiting zero-time states", () => {
  const result = runRotationSearch(
    {
      professionId: "fixture",
      config: {},
      horizonMs: 2_000,
      beamWidth: 3,
      branchLimit: 3,
      enablerReserve: 1,
      maxActions: 12,
      timeBudgetMs: 5_000,
      candidates: [
        {
          skillId: -3,
          name: "Swap Weapons",
          declaredDamage: false,
          potentialEnabler: true,
          priorityEnabler: true,
        },
        {
          skillId: 1,
          name: "Set One Strike",
          declaredDamage: true,
          potentialEnabler: false,
          weaponSets: [1],
        },
        {
          skillId: 2,
          name: "Set Two Strike",
          declaredDamage: true,
          potentialEnabler: false,
          weaponSets: [2],
        },
      ],
    },
    fakeSimulation,
  );

  const names = result.rotation.map((entry) => entry.name);
  assert.ok(names.includes("Swap Weapons"));
  assert.ok(names.includes("Set Two Strike"));
  assert.ok(names.filter((name) => name === "Swap Weapons").length <= 2);
  assert.equal(fakeSimulation(result.rotation).dps, result.dps);
});

test("fixed-window normalization crops a long incumbent at the horizon", () => {
  const normalized = normalizeFixedWindowRotation({
    setupRotation: [{ name: "__combat_start" }],
    combatRotation: ["Filler", "Filler", "Filler", "Filler"],
    horizonMs: 1_500,
    config: {},
    simulate: fakeSimulation,
  });

  assert.deepEqual(normalized.combatRotation, [
    "Filler",
    "Filler",
    "Filler",
  ]);
  assert.equal(normalized.terminalWaitMs, 0);
  assert.equal(normalized.result.duration, 1.5);
});

test("fixed-window normalization pads a short incumbent", () => {
  const normalized = normalizeFixedWindowRotation({
    setupRotation: [{ name: "__combat_start" }],
    combatRotation: ["Filler"],
    horizonMs: 2_000,
    config: {},
    simulate: fakeSimulation,
  });

  assert.deepEqual(normalized.rotation, [
    { name: "__combat_start" },
    "Filler",
    { name: "__wait", waitMs: 1_500 },
  ]);
  assert.equal(normalized.result.duration, 2);
  assert.equal(normalized.result.dps, 50);
});

test("fixed-window normalization preserves precasts and Combat Start", () => {
  const setup = ["Empower", { name: "__combat_start" }];
  const normalized = normalizeFixedWindowRotation({
    setupRotation: setup,
    combatRotation: ["Strike"],
    horizonMs: 2_000,
    config: {},
    simulate: fakeSimulation,
  });

  assert.deepEqual(normalized.rotation.slice(0, setup.length), setup);
  assert.equal(normalized.combatStartTimeMs, 200);
  assert.equal(normalized.precastActions, 1);
  assert.deepEqual(splitRotationAtCombatStart(normalized.rotation), {
    setupRotation: setup,
    combatRotation: ["Strike", { name: "__wait", waitMs: 1_000 }],
  });
});

test("search scores and returns the same normalized incumbent when it cannot improve", () => {
  const request = {
    professionId: "fixture",
    config: {},
    setupRotation: ["Empower", { name: "__combat_start" }],
    incumbentRotation: ["Strike", "Strike"],
    horizonMs: 2_000,
    evaluationBudget: 40,
    wallClockLimitMs: 5_000,
    candidates: [
      {
        skillId: 3,
        name: "Heal",
        declaredDamage: false,
        potentialEnabler: true,
      },
    ],
  };
  const expected = normalizeFixedWindowRotation({
    setupRotation: request.setupRotation,
    combatRotation: request.incumbentRotation,
    horizonMs: request.horizonMs,
    config: {
      randomness: { mode: "deterministic", seed: 1 },
    },
    simulate: fakeSimulation,
  });
  const result = runRotationSearch(request, fakeSimulation);

  assert.equal(result.improved, false);
  assert.deepEqual(result.rotation, expected.rotation);
  assert.equal(result.baselineDamage, expected.result.totalDamage);
  assert.equal(result.totalDamage, result.baselineDamage);
  assert.equal(result.dps, fakeSimulation(result.rotation).dps);
});

test("a wall-clock timeout returns the exactly scored incumbent", () => {
  const slowSimulation = (rotation, config) => {
    const until = Date.now() + 2;
    while (Date.now() < until) {
      // Exercise the wall-clock fallback after mandatory baseline scoring.
    }
    return fakeSimulation(rotation, config);
  };
  const result = runRotationSearch(
    {
      professionId: "fixture",
      config: {},
      setupRotation: [{ name: "__combat_start" }],
      incumbentRotation: ["Filler"],
      horizonMs: 2_000,
      evaluationBudget: 100,
      wallClockLimitMs: 1,
      candidates: [
        {
          skillId: 1,
          name: "Burst",
          declaredDamage: true,
          potentialEnabler: false,
        },
      ],
    },
    slowSimulation,
  );

  assert.equal(result.timedOut, true);
  assert.equal(result.diagnostics.stopReason, "wall-clock-limit");
  assert.equal(result.improved, false);
  assert.equal(result.totalDamage, result.baselineDamage);
  assert.equal(result.exactEvaluations, 3);
});

test("an evaluation budget produces deterministic results", () => {
  const request = {
    professionId: "fixture",
    config: {},
    horizonMs: 4_000,
    evaluationBudget: 30,
    wallClockLimitMs: 5_000,
    seed: 73,
    candidates: [
      {
        skillId: 1,
        name: "Burst",
        declaredDamage: true,
        potentialEnabler: false,
      },
      {
        skillId: 2,
        name: "Filler",
        declaredDamage: true,
        potentialEnabler: false,
      },
    ],
  };
  const first = runRotationSearch(request, fakeSimulation);
  const second = runRotationSearch(request, fakeSimulation);

  assert.deepEqual(second.rotation, first.rotation);
  assert.equal(second.totalDamage, first.totalDamage);
  assert.equal(second.evaluated, first.evaluated);
  assert.equal(second.diagnostics.stopReason, first.diagnostics.stopReason);
  assert.ok(first.evaluated <= request.evaluationBudget);
});

test("every native profession exposes optimizer runtime hooks and candidates", async () => {
  for (const entry of nativeProfessionRegistry) {
    const adapter = await loadProfessionAppAdapter(entry.id);
    assert.ok(adapter, entry.id);
    assert.equal(typeof adapter.simulateBuild, "function", entry.id);
    assert.equal(typeof adapter.simulationConfig, "function", entry.id);

    const build = createDefaultBuild(adapter);
    const app = {
      build,
      adapter,
      profession: adapter.profession,
      skills: [...adapter.profession.catalog.skills],
      skillByName: adapter.profession.catalog.skillsByName,
      skillById: adapter.profession.catalog.skillsById,
      attributeWeaponSet: 1,
      rotationInsertionIndex: null,
      results: null,
    };
    adapter.recalculate(app);
    app.results = adapter.runSimulation(app);
    assert.ok(enumerateRotationOptimizerCandidates(app).length > 0, entry.id);
  }
});

test("the worker-facing loader simulates Luminary without its app adapter", async () => {
  const adapter = await loadProfessionAppAdapter("guardian");
  const saved = JSON.parse(
    await readFile(
      new URL("../../Builds/guardian/b-power-luminary.json", import.meta.url),
      "utf8",
    ),
  );
  const build = adapter.toApplicationBuild(saved);
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skills: [...adapter.profession.catalog.skills],
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1,
    rotationInsertionIndex: null,
    results: null,
  };
  adapter.recalculate(app);

  const simulate = await loadRotationOptimizerSimulation("guardian");
  assert.equal(typeof simulate, "function");
  const config = adapter.simulationConfig(app);
  assert.equal(config.specialization, "Luminary");
  const result = simulate([], config);
  assert.ok(result.endState.profession);
});

test("Spellbreaker optimizer candidates retain burst weapon requirements", async () => {
  const adapter = await loadProfessionAppAdapter("warrior");
  const saved = JSON.parse(
    await readFile(
      new URL(
        "../../Builds/warrior/b-power-spellbreaker-dagger-mace-sword-axe.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = adapter.toApplicationBuild(saved);
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skills: [...adapter.profession.catalog.skills],
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1,
    rotationInsertionIndex: null,
    results: null,
  };
  adapter.recalculate(app);

  const candidates = enumerateRotationOptimizerCandidates(app);
  assert.deepEqual(
    candidates.find((candidate) => candidate.name === "Breaching Strike")
      ?.weaponSets,
    [1],
  );
  assert.deepEqual(
    candidates.find((candidate) => candidate.name === "Bloodthirster")
      ?.weaponSets,
    [2],
  );
  assert.equal(
    candidates.some((candidate) => candidate.name === "Full Counter"),
    false,
  );
});
