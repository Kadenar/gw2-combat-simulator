import assert from "node:assert/strict";
import test from "node:test";
import { defaultSimulationConfig } from "./helpers/fixture-harness-core.js";
import {
  simulateMesmer,
} from "./helpers/mesmer-simulation.js";
import {
  resolveTestGw2Stream,
} from "./helpers/gw2-resolver.js";
import { enqueueOrdered } from "../js/platform/engine/event-queue.js";
import {
  buildScheduledEventStream,
} from "../js/platform/engine/scheduled-event-stream.js";
import {
  createCloneAttackScheduler,
} from "../js/professions/mesmer/mechanics/illusions.js";

test("clone attacks are scheduled lazily as the timeline advances", () => {
  const state = { clones: [] };
  const damage = [];
  const conditions = [];
  const scheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: {
      Sword: {
        coefficient: 1,
        hits: 1,
        interval: 2,
        weaponStrength: 20,
        conditions: [{ name: "Bleeding", duration: 1, stacks: 1 }],
      },
    },
    epsilon: 0.0001,
    addDamage: (...args) => damage.push(args),
    addCondition: (...args) => conditions.push(args),
  });
  state.clones.push(scheduler.initializeClone({
    id: 1,
    createdAt: 1,
    weapon: "Sword",
  }));

  assert.equal(scheduler.nextAttackAt(), 3);
  assert.equal(damage.length, 0);
  scheduler.scheduleAt(2.9);
  assert.equal(damage.length, 0);
  scheduler.scheduleAt(3);
  assert.equal(damage.length, 1);
  assert.equal(conditions.length, 1);
  assert.equal(scheduler.nextAttackAt(), 5);
});

function tormentDamageAtMight(might) {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Ether Bolt", { name: "__wait", waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initialResource: 0,
      stats: {
        ...defaults.stats,
        conditionDamage: 1000,
        expertise: 0,
      },
      boons: {
        ...defaults.boons,
        might,
      },
      target: {
        ...defaults.target,
        vulnerability: 0,
        moving: false,
        activatingSkills: false,
        confusionActivationsPerSecond: 0,
      },
    }),
  );
  return result.resolvedEvents.find(event =>
    event.type === "condition" && event.condition === "Torment"
  ).damage;
}

test("Might increases condition damage as well as strike power", () => {
  assert.equal(tormentDamageAtMight(0), 121.8);
  assert.equal(tormentDamageAtMight(25), 189.3);
});

test("condition applications shorter than one second deal fractional damage", () => {
  const stream = buildScheduledEventStream({
    events: [{
      type: "condition",
      at: 0,
      name: "Short Bleed",
      skillName: "Short Bleed",
      condition: "Bleeding",
      duration: 0.5,
      stacks: 1,
      source: "Player",
      sourceId: "short-bleed",
    }],
    rotationEndTime: 2,
    resolverHandoff: {
      warnings: ["resolver handoff warning"],
    },
  });
  const result = resolveTestGw2Stream({
    stream,
    config: {
      target: {},
      sigilSets: [{ names: [] }],
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0,
      }),
      critical: () => ({ chance: 0.05, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1,
    },
    helpers: {
      conditionName: name => name,
      skillsByName: new Map(),
      weaponStrength: () => 1000,
    },
  });

  assert.ok(result.conditionDamage > 0);
  assert.equal(result.firstHitTime, 0);
  assert.equal(result.resolvedEvents[0].damageTicks.length, 1);
  assert.equal(result.resolvedEvents[0].damageTicks[0].fraction, 0.5);
  assert.deepEqual(result.warnings, ["resolver handoff warning"]);
});

test("permanent damaging target conditions are assumptions, not player damage", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [{ name: "__wait", waitMs: 2000 }],
    defaultSimulationConfig({
      target: {
        ...defaults.target,
        conditions: {
          Bleeding: 25,
          Burning: true,
        },
      },
    }),
  );

  assert.equal(result.totalDamage, 0);
  assert.deepEqual(result.conditionBreakdown, []);
});

test("DPS includes elapsed time before the first hit", () => {
  const result = simulateMesmer(
    [
      { name: "__wait", waitMs: 1000 },
      "Mind Slash",
    ],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Sword",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );

  assert.equal(result.firstHitTime, result.duration);
  assert.equal(result.dpsStartTime, 0);
  assert.equal(result.dpsWindow, result.duration);
  assert.equal(result.dps, result.totalDamage / result.duration);
});

test("an explicit empty target condition map does not restore default conditions", () => {
  const defaults = defaultSimulationConfig();
  const run = conditions => simulateMesmer(
    ["Bladecall"],
    defaultSimulationConfig({
      target: {
        ...defaults.target,
        conditions,
      },
    }),
  ).strikeDamage;

  const unconditioned = run({});
  const vulnerable = run({ Vulnerability: 25 });
  assert.ok(Math.abs(vulnerable / unconditioned - 1.25) < 1e-12);
});

test("same-time queued events retain stable insertion order", () => {
  const queue = [];
  enqueueOrdered(queue, { type: "damage", at: 1, name: "first" });
  enqueueOrdered(queue, { type: "damage", at: 1, name: "second" });
  enqueueOrdered(queue, {
    type: "damage",
    at: 1,
    priority: -1,
    name: "priority",
  });

  assert.deepEqual(queue.map(event => event.name), [
    "priority",
    "first",
    "second",
  ]);
});

test("Thief relic progresses on individual hits instead of an aggregate hit", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Unstable Bladestorm", { name: "__wait", waitMs: 4000 }],
    defaultSimulationConfig({
      relic: "Thief",
      stats: {
        ...defaults.stats,
        precision: 3100,
      },
      boons: {
        ...defaults.boons,
        fury: true,
      },
    }),
  );
  const hits = result.resolvedEvents.filter(event =>
    event.type === "damage"
    && event.skillName === "Unstable Bladestorm"
  );
  const stormPulses = hits.filter(event => event.coefficient === 0.25);

  assert.equal(hits.length, 8);
  assert.equal(stormPulses.length, 4);
  assert.ok(stormPulses[1].damage > stormPulses[0].damage);
  assert.ok(stormPulses[2].damage > stormPulses[1].damage);
  assert.ok(stormPulses[3].damage > stormPulses[2].damage);
});

test("Bloodsong needs real bleeding and does not treat blade hits as bleeding", () => {
  const withoutJaggedMind = simulateMesmer(
    ["Unstable Bladestorm", { name: "__wait", waitMs: 8000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraits: ["Bloodsong"],
    }),
  );
  const withJaggedMind = simulateMesmer(
    ["Unstable Bladestorm", { name: "__wait", waitMs: 8000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraits: ["Bloodsong", "Jagged Mind"],
    }),
  );

  assert.equal(withoutJaggedMind.endState.profession.resource, 0);
  assert.equal(withoutJaggedMind.conditionDamage, 0);
  assert.equal(withJaggedMind.endState.profession.resource, 1);
  assert.ok(withJaggedMind.conditionDamage > 0);
});

test("target death resolves its timestamp and stops future events", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      "Bladecall",
      { name: "__wait", waitMs: 5000 },
      "Unstable Bladestorm",
    ],
    defaultSimulationConfig({
      target: {
        ...defaults.target,
        health: 1,
      },
    }),
  );
  const damageEvents = result.resolvedEvents.filter(event =>
    event.type === "damage"
  );

  assert.equal(result.deathTime, damageEvents[0].at);
  assert.ok(damageEvents.every(event => event.at === result.deathTime));
  assert.equal(
    damageEvents.some(event => event.skillName === "Unstable Bladestorm"),
    false,
  );
  assert.ok(result.events.every(event => event.at <= result.deathTime + 0.0001));
});

test("Egotism starts after the target falls below the Mesmer's health percentage", () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Sword",
    secondaryWeapon: "",
    initialResource: 0,
    boons: {
      ...defaults.boons,
      might: 0,
    },
    target: {
      ...defaults.target,
      vulnerability: 0,
      health: 3970000,
    },
  });
  const rotation = ["Mind Slash", "Mind Gash"];
  const base = simulateMesmer(rotation, config);
  const egotism = simulateMesmer(rotation, {
    ...config,
    selectedTraits: ["Egotism"],
  });
  const strike = (result, name) => result.resolvedEvents.find(event =>
    event.type === "damage" && event.skillName === name
  ).damage;

  assert.equal(strike(egotism, "Mind Slash"), strike(base, "Mind Slash"));
  assert.ok(
    Math.abs(strike(egotism, "Mind Gash") / strike(base, "Mind Gash") - 1.1)
      < 1e-12,
  );
});

test("explicit combat start excludes completed precombat damage", () => {
  const result = simulateMesmer(
    [
      "Bladecall",
      { name: "__wait", waitMs: 1000 },
      { name: "__combat_start" },
      "Unstable Bladestorm",
      { name: "__wait", waitMs: 4000 },
    ],
    defaultSimulationConfig(),
  );
  const damageSkills = result.resolvedEvents
    .filter(event => event.type === "damage")
    .map(event => event.skillName);

  assert.equal(damageSkills.includes("Bladecall"), false);
  assert.ok(damageSkills.includes("Unstable Bladestorm"));
  assert.ok(result.dpsWindow < result.duration);
});

test("delayed combat start uses its offset instead of the preceding cast end", () => {
  const result = simulateMesmer(
    [
      "Mind Slash",
      { name: "__combat_start", offset: 100 },
      { name: "__wait", waitMs: 1000 },
    ],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Sword",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );

  assert.equal(result.steps[1].start, 100);
  assert.ok(Math.abs(result.firstHitTime - 0.36) < 1e-12);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.equal(result.dpsWindow, 1);
  assert.equal(result.dps, result.totalDamage / result.dpsWindow);
  assert.ok(result.dps < 100_000);
});

test("DPS duration starts at the first hit in the supplied delayed-start rotation", () => {
  const result = simulateMesmer(
    [
      "Phantasmal Swordsman",
      { name: "__combat_start", offset: 700 },
      "Bladecall",
    ],
    defaultSimulationConfig(),
  );

  assert.equal(result.steps[1].start, 700);
  assert.equal(result.firstHitTime, 0.86);
  assert.equal(result.duration, 1.3);
  assert.ok(Math.abs(result.dpsWindow - 0.44) < 1e-12);
  assert.equal(result.dps, result.totalDamage / result.dpsWindow);
});

test("standalone Combat Start uses the first subsequent hit like Elementalist", () => {
  const result = simulateMesmer(
    [
      "__combat_start",
      "Phantasmal Swordsman",
      "Bladecall",
    ],
    defaultSimulationConfig(),
  );

  assert.equal(result.steps[0].start, 0);
  assert.equal(result.firstHitTime, 0.86);
  assert.equal(result.duration, 1.3);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.ok(Math.abs(result.dpsWindow - 0.44) < 1e-12);
  assert.equal(result.dps, result.totalDamage / result.dpsWindow);
});

test("zero-length combat windows report zero DPS instead of epsilon DPS", () => {
  const result = simulateMesmer(
    [
      "Mind Slash",
      "__combat_start",
    ],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Sword",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );

  assert.equal(result.dpsStartTime, result.duration);
  assert.equal(result.dpsWindow, 0);
  assert.equal(result.dps, 0);
});

test("critical sigils enqueue and resolve their own proc event", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Bladecall"],
    defaultSimulationConfig({
      stats: {
        ...defaults.stats,
        precision: 3100,
      },
      boons: {
        ...defaults.boons,
        fury: true,
      },
      sigilSets: [
        { names: ["Air"], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 },
      ],
    }),
  );

  assert.ok(result.procSteps.some(proc => proc.skill === "Sigil of Air"));
  assert.ok(result.breakdown.some(entry =>
    entry.name === "Sigil of Air" && entry.strikeDamage > 0
  ));
});

test("critical-strike food procs resolve as unmodified flat damage", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Flying Cutter", { name: "__wait", waitMs: 2000 }, "Flying Cutter"],
    defaultSimulationConfig({
      food: "Cilantro Lime Sous-Vide Steak",
      stats: {
        ...defaults.stats,
        precision: 3100,
      },
    }),
  );
  const nourishment = result.resolvedEvents.filter(event =>
    event.type === "damage" && event.skillName === "Nourishment"
  );

  assert.equal(nourishment.length, 1);
  assert.equal(nourishment[0].damage, 325);
  const nourishmentProc = result.procSteps.find(proc =>
    proc.type === "food_proc" && proc.skill === "Nourishment"
  );
  assert.equal(
    nourishmentProc.icon,
    "https://wiki.guildwars2.com/images/c/ca/Nourishment_food.png",
  );
});

test("slot-skill strikes select utility weapon strength generically", () => {
  const result = simulateMesmer(
    ["Power Spike"],
    defaultSimulationConfig({ specialization: "Core" }),
  );
  const powerSpike = result.resolvedEvents.find(event =>
    event.type === "damage" && event.skillName === "Power Spike"
  );

  assert.equal(powerSpike.skillWeapon, "Utility");
});

test("Egotism does not increase condition damage", () => {
  const defaults = defaultSimulationConfig();
  const run = selectedTraits => simulateMesmer(
    ["Phantasmal Swordsman", { name: "__wait", waitMs: 6000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Sword",
      secondaryWeapon: "",
      initialResource: 0,
      selectedTraits: ["Sharper Images", ...selectedTraits],
      target: {
        ...defaults.target,
        health: 3970000,
      },
    }),
  );
  const bleeding = result => result.conditionBreakdown
    .find(entry => entry.name === "Bleeding")?.damage || 0;

  assert.equal(bleeding(run(["Egotism"])), bleeding(run([])));
});

test("weapon-swap sigils resolve locally on the destination weapon set", () => {
  const result = simulateMesmer(
    [
      "Bladecall",
      "Swap Weapons",
      "Psycut",
      { name: "__wait", waitMs: 2000 },
    ],
    defaultSimulationConfig({
      primaryWeapon: "Dagger",
      secondaryWeapon: "Sword",
      weaponSet2Primary: "Spear",
      weaponSet2Secondary: "",
      sigilSets: [
        { names: [], strike: 1, condition: 1 },
        { names: ["Doom", "Geomancy"], strike: 1, condition: 1 },
      ],
    }),
  );

  assert.ok(result.resolvedEvents.some(event =>
    event.skillName === "Sigil of Geomancy"
    && event.condition === "Bleeding"
    && event.damage > 0
  ));
  assert.ok(result.resolvedEvents.some(event =>
    event.skillName === "Sigil of Doom"
    && event.condition === "Poisoned"
    && event.damage > 0
  ));
});

test("Severance affects strikes after its control trigger", () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    initialResource: 0,
    stats: {
      ...defaults.stats,
      precision: 1000,
    },
    boons: {
      ...defaults.boons,
      fury: false,
    },
    target: {
      ...defaults.target,
      vulnerability: 0,
    },
  });
  const run = names => simulateMesmer(
    ["Magic Bullet", "Mind Slash"],
    {
      ...config,
      sigilSets: [
        { names, strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  );
  const base = run([]);
  const severance = run(["Severance"]);
  const mindSlashDamage = result =>
    result.breakdown.find(entry => entry.name === "Mind Slash").strikeDamage;

  assert.ok(mindSlashDamage(severance) > mindSlashDamage(base));
  assert.ok(severance.procSteps.some(proc =>
    proc.skill === "Sigil of Severance"
    && proc.sourceSkill === "Magic Bullet"
  ));
});
