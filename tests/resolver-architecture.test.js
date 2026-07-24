import assert from "node:assert/strict";
import test from "node:test";
import { defaultSimulationConfig } from "../js/fixtures/fixture-harness-core.js";
import { simulateSequence } from "../js/sim/sim-engine.js";
import { resolveScheduledStream } from "../js/sim/resolver/sim-resolver.js";
import { enqueueOrdered } from "../js/sim/shared/sim-event-queue.js";
import { buildScheduledEventStream } from "../js/sim/shared/sim-scheduled-event-stream.js";
import { createCloneAttackScheduler } from "../js/sim/mechanics/sim-illusion-actions.js";

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
  const result = simulateSequence(
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
    }],
    rotationEndTime: 2,
  });
  const result = resolveScheduledStream({
    stream,
    config: {
      target: {},
      sigilSets: [{ names: [] }],
    },
    traits: new Set(),
    scheduler: {
      warnings: [],
      cloneDeaths: new Map(),
    },
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
});

test("permanent damaging target conditions are assumptions, not player damage", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateSequence(
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
  const result = simulateSequence(
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
  const run = conditions => simulateSequence(
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
  const result = simulateSequence(
    ["Unstable Bladestorm"],
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

  assert.equal(hits.length, 7);
  assert.ok(hits[1].damage > hits[0].damage);
  assert.ok(hits[2].damage > hits[1].damage);
  assert.ok(hits[3].damage > hits[2].damage);
});

test("Bloodsong needs real bleeding and does not treat blade hits as bleeding", () => {
  const withoutJaggedMind = simulateSequence(
    ["Unstable Bladestorm", { name: "__wait", waitMs: 8000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraits: ["Bloodsong"],
    }),
  );
  const withJaggedMind = simulateSequence(
    ["Unstable Bladestorm", { name: "__wait", waitMs: 8000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraits: ["Bloodsong", "Jagged Mind"],
    }),
  );

  assert.equal(withoutJaggedMind.endState.resource, 0);
  assert.equal(withoutJaggedMind.conditionDamage, 0);
  assert.equal(withJaggedMind.endState.resource, 1);
  assert.ok(withJaggedMind.conditionDamage > 0);
});

test("target death resolves its timestamp and stops future events", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateSequence(
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

test("Egotism is applied once by the health-aware runtime", () => {
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
      health: 4000000,
    },
  });
  const base = simulateSequence(["Mind Slash"], config);
  const egotism = simulateSequence(["Mind Slash"], {
    ...config,
    selectedTraits: ["Egotism"],
  });

  assert.ok(Math.abs(egotism.strikeDamage / base.strikeDamage - 1.1) < 1e-12);
});

test("explicit combat start excludes completed precombat damage", () => {
  const result = simulateSequence(
    [
      "Bladecall",
      { name: "__wait", waitMs: 1000 },
      { name: "__combat_start" },
      "Unstable Bladestorm",
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

test("critical sigils enqueue and resolve their own proc event", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateSequence(
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

test("weapon-swap sigils resolve locally on the destination weapon set", () => {
  const result = simulateSequence(
    ["Swap Weapons", "Psycut", { name: "__wait", waitMs: 2000 }],
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
  const run = names => simulateSequence(
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
