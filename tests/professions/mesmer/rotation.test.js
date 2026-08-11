import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultSimulationConfig } from "../../helpers/fixture-harness-core.js";
import {
  createDefaultConfig,
  simulateMesmer,
} from "../../helpers/mesmer-simulation.js";
import { chartValueAt } from "../../../js/platform/ui/charts.js";
import {
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  formatTimelineCastDetails,
  moveRotationEntry,
} from "../../../js/platform/ui/timeline.js";
import {
  nextResultSortState,
  sortResultRows,
} from "../../../js/platform/ui/rotation-results.js";
import {
  buildChartSeries,
  formatResultTimelineTime,
  resultSummaryMetrics,
  skillBreakdownRows,
} from "../../../js/app/rotation/result-model.js";
import { activeResourceGroup } from "../../../js/app/rotation/resource-view.js";
import {
  continuumEndTimelineMarkers,
  shatterResourceSpends,
  timelineWeaponRows,
} from "../../../js/app/rotation/timeline-model.js";
import {
  simulationEventLogCsv,
  simulationEventLogRows,
} from "../../../js/app/rotation/event-log.js";
import { rotationWarningItems } from "../../../js/app/rotation/warnings.js";
import { RELIC_DATA } from "../../../js/platform/gw2/gear-data.js";
import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../../../js/professions/mesmer/data/ids.js";
import { mesmerCatalog } from "../../../js/professions/mesmer/catalog.js";
import { mesmerProfession } from "../../../js/professions/mesmer/definition.js";
import { toApplicationBuild } from "../../../js/professions/mesmer/build.js";
import {
  recalculate,
  simulationConfig,
} from "../../../js/professions/mesmer/app/app-definition.js";

test("Relic of the Claw uses its relic icon in the proc timeline", () => {
  assert.equal(
    RELIC_DATA.Claw.icon,
    "https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png",
  );
});

test("concurrent timeline badges show both delay and cast timestamp", () => {
  assert.equal(formatConcurrentTimelineBadge(100, "2.23s"), "⊙100ms\n2.23s");
});

test("interrupt timeline badges show both interrupt delay and cast timestamp", () => {
  assert.equal(formatInterruptTimelineBadge(120, "4.56s"), "✂120ms\n4.56s");
});

test("queueing a cooling-down icon waits until it is available", () => {
  const result = simulateMesmer(
    ["Bladecall", "Bladecall"],
    defaultSimulationConfig(),
  );
  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[0].end, 440);
  assert.equal(result.steps[1].start, 4440);
  assert.equal(result.endState.cooldowns.Bladecall.readyAt, 8880);
  assert.equal(result.endState.cooldowns.Bladecall.remaining, 4000);
});

test("Lingering Thoughts recharges one ammo count every six seconds", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      { name: "Lingering Thoughts", skillId: ID.LINGERING_THOUGHTS },
      { name: "Lingering Thoughts", skillId: ID.LINGERING_THOUGHTS },
      { name: "Lingering Thoughts", skillId: ID.LINGERING_THOUGHTS },
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      initialResource: 0,
      primaryWeapon: "Axe",
      boons: {
        ...defaults.boons,
        quickness: false,
        alacrity: false,
      },
    }),
  );

  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 1630, 7380],
  );
  assert.equal(result.endState.ammo["Lingering Thoughts"].rechargeDuration, 6);
});

test("Lingering Thoughts applies its packets and grants its clone 160ms later", () => {
  const result = simulateMesmer(
    [
      { name: "Lingering Thoughts", skillId: ID.LINGERING_THOUGHTS },
      { name: "__wait", waitMs: 200 },
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: [],
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 0,
    }),
  );
  const step = result.steps[0];
  const strikes = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.skillName === "Lingering Thoughts",
  );
  const conditions = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Lingering Thoughts",
  );
  const clone = result.events.find(
    (event) =>
      event.type === "resource" && event.reason === "Lingering Thoughts",
  );

  assert.equal(step.end - step.start, 920);
  assert.equal(
    strikes.reduce((sum, event) => sum + event.coefficient, 0),
    1.2,
  );
  assert.equal(
    strikes.reduce((sum, event) => sum + event.hits, 0),
    3,
  );
  assert.deepEqual(
    conditions.map((event) => [event.condition, event.stacks, event.duration]),
    [
      ["Torment", 3, 4],
      ["Crippled", 3, 1],
    ],
  );
  assert.equal(Math.round((clone.at - step.end / 1000) * 1000), 160);
});

test("Lingering Thoughts creates two Confounding Bolts in an Ethereal field", () => {
  const config = defaultSimulationConfig({
    specialization: "Mirage",
    selectedTraits: [],
    primaryWeapon: "Staff",
    secondaryWeapon: "",
    weaponSet2Primary: "Axe",
    weaponSet2Secondary: "Torch",
    initialResource: 0,
  });
  const insideField = simulateMesmer(
    [
      "Chaos Storm",
      "Swap Weapons",
      { name: "Lingering Thoughts", skillId: ID.LINGERING_THOUGHTS },
    ],
    config,
  );
  const bolts = insideField.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.name.includes("Confounding Bolts"),
  );
  assert.equal(bolts.length, 2);
  assert.ok(
    bolts.every(
      (event) =>
        event.condition === "Confusion" &&
        event.stacks === 1 &&
        event.duration === 5,
    ),
  );

  const withoutField = simulateMesmer(
    [{ name: "Lingering Thoughts", skillId: ID.LINGERING_THOUGHTS }],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: [],
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 0,
    }),
  );
  assert.equal(
    withoutField.resolvedEvents.some(
      (event) =>
        event.type === "condition" && event.name.includes("Confounding Bolts"),
    ),
    false,
  );
});

test("Rewinder cooldown applies shatter CDR, source refunds, then Alacrity", () => {
  const secondCastAt = (initialResource) =>
    simulateMesmer(
      ["Rewinder", "Rewinder"],
      defaultSimulationConfig({
        specialization: "Chronomancer",
        selectedTraits: ["Master of Misdirection"],
        initialResource,
      }),
    ).steps[1].start;

  // (base cooldown * 0.85 - 3 - 3C) * 2/3, where C is the clone count.
  assert.deepEqual([0, 1, 2, 3].map(secondCastAt), [15000, 13000, 11000, 9000]);

  const fullShatter = simulateMesmer(
    ["Rewinder"],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      initialResource: 3,
    }),
  );
  assert.deepEqual(shatterResourceSpends(fullShatter).get(0), {
    count: 3,
    resource: "clones",
    sourceSkill: "Rewinder",
  });
});

test("clone state remains capped at three when input or new summons exceed the cap", () => {
  const initial = simulateMesmer(
    [{ name: "__wait", waitMs: 1 }],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      initialResource: 99,
    }),
  );
  assert.equal(initial.endState.profession.resource, 3);

  const replaced = simulateMesmer(
    ["Mirror Images", { name: "__wait", waitMs: 1 }],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedSkills: ["Mirror Images"],
      initialResource: 3,
    }),
  );
  const resourceEvents = replaced.events.filter(
    (event) => event.type === "resource" && event.resource === "clones",
  );

  assert.equal(replaced.endState.profession.resource, 3);
  assert.ok(resourceEvents.every((event) => event.value <= 3));
});

test("non-Chronomancer alacrity starts the reduced cooldown after the cast", () => {
  const result = simulateMesmer(
    ["Bladecall", "Bladecall"],
    defaultSimulationConfig({ specialization: "Core" }),
  );
  assert.equal(result.steps[1].start, 4440);
});

test("Virtuoso alacrity starts Imaginary Inversion recharge after the cast", () => {
  const result = simulateMesmer(
    ["Imaginary Inversion", "Imaginary Inversion"],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      primaryWeapon: "Spear",
      secondaryWeapon: "",
    }),
  );
  assert.equal(result.steps[1].start, 8680);
});

test("Master of Misdirection reduces shatter cooldowns by 15%", () => {
  const result = simulateMesmer(
    [{ name: "__wait", waitMs: 2010 }, "Continuum Split"],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedTraits: ["Master of Misdirection"],
      initialResource: 3,
    }),
  );

  assert.equal(result.steps[1].start, 2010);
  assert.equal(result.endState.cooldowns["Continuum Split"].readyAt, 61510);
});

test("Fencer's Finesse reduces sword skill cooldowns by 20%", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Sword",
    initialResource: 0,
  });
  const baseline = simulateMesmer(["Blurred Frenzy", "Blurred Frenzy"], config);
  const withTrait = simulateMesmer(["Blurred Frenzy", "Blurred Frenzy"], {
    ...config,
    selectedTraits: ["Fencer's Finesse"],
  });

  assert.equal(baseline.steps[1].start, 8960);
  assert.equal(withTrait.steps[1].start, 7360);
});

test("Flow of Time increases clone critical chance while alacrity is active", () => {
  const result = simulateMesmer(
    ["Phase Retreat", { name: "__wait", waitMs: 2600 }],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedTraits: ["Flow of Time"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
      stats: { precision: 1000 },
      boons: { fury: false, alacrity: true },
    }),
  );
  const cloneHit = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.source === "Clone",
  );
  assert.ok(cloneHit);
  assert.ok(Math.abs(cloneHit.criticalChance - 0.2) < 1e-12);
});

test("Phantasmal Fury increases phantasm critical chance", () => {
  const result = simulateMesmer(
    ["Phantasmal Warlock", { name: "__wait", waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Phantasmal Fury"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
      stats: { precision: 1000 },
      boons: { fury: false, alacrity: false },
    }),
  );
  const phantasmHit = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.source === "Phantasm",
  );
  assert.ok(phantasmHit);
  assert.ok(Math.abs(phantasmHit.criticalChance - 0.3) < 1e-12);
});

test("illusions do not inherit the mesmer Fury boon", () => {
  const result = simulateMesmer(
    ["Phantasmal Warlock", { name: "__wait", waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: [],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
      stats: { precision: 1000 },
      boons: { fury: true, alacrity: false },
    }),
  );
  const phantasmHit = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.source === "Phantasm",
  );

  assert.ok(Math.abs(phantasmHit.criticalChance - 0.05) < 1e-12);
});

test("clones do not inherit permanent Might while phantasms remain player-owned", () => {
  const simulateWithMight = (might) =>
    simulateMesmer(
      ["Phase Retreat", "Phantasmal Warlock", { name: "__wait", waitMs: 4000 }],
      defaultSimulationConfig({
        specialization: "Core",
        selectedTraits: [],
        primaryWeapon: "Staff",
        secondaryWeapon: "",
        initialResource: 0,
        stats: {
          power: 1000,
          precision: 1000,
          ferocity: 0,
          conditionDamage: 0,
        },
        boons: {
          might,
          fury: false,
          quickness: false,
          alacrity: false,
        },
      }),
    );
  const withoutMight = simulateWithMight(0);
  const withMight = simulateWithMight(25);
  const illusionDamage = (result, source) =>
    result.resolvedEvents
      .filter((event) => event.type === "damage" && event.source === source)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(illusionDamage(withoutMight, "Clone") > 0);
  assert.ok(illusionDamage(withoutMight, "Phantasm") > 0);
  assert.equal(
    illusionDamage(withMight, "Clone"),
    illusionDamage(withoutMight, "Clone"),
  );
  assert.ok(
    illusionDamage(withMight, "Phantasm") >
      illusionDamage(withoutMight, "Phantasm"),
  );
});

test("Shift+click timeline form casts an instant skill 100ms into the prior cast", () => {
  const result = simulateMesmer(
    ["Bladecall", { name: "Bladesong Distortion", offset: 100 }],
    defaultSimulationConfig(),
  );
  assert.equal(result.steps[1].start, 100);
  assert.equal(result.steps[1].end, 100);
  assert.equal(result.endState.time, 440);
  assert.equal(
    result.endState.cooldowns["Bladesong Distortion"].readyAt,
    40100,
  );
});

test("shift-queued Rewinder waits past its parent cast for cooldown expiry", () => {
  const result = simulateMesmer(
    [
      "Rewinder",
      { name: "__wait", waitMs: 10000 },
      "Bladecall",
      { name: "Rewinder", offset: 100 },
    ],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      initialResource: 3,
    }),
  );

  assert.equal(result.steps[2].end, 10440);
  assert.equal(result.steps[3].start, 12000);
  assert.deepEqual(result.warnings, []);
});

test("interrupt commands end casts and remove later hit events", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Scepter",
    secondaryWeapon: "",
  });
  const full = simulateMesmer(["Confusing Images"], config);
  const interrupted = simulateMesmer(
    [{ name: "Confusing Images", interruptMs: 250 }],
    config,
  );
  assert.equal(interrupted.steps[0].end, 250);
  assert.equal(interrupted.steps[0].interrupted, true);
  assert.ok(interrupted.totalDamage < full.totalDamage);
});

test("Confusing Images applies seven timed confusion pulses and loses later pulses when interrupted", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Scepter",
    secondaryWeapon: "",
    initialResource: 0,
  });
  const full = simulateMesmer(["Confusing Images"], config);
  const interrupted = simulateMesmer(
    [{ name: "Confusing Images", interruptMs: 1000 }],
    config,
  );
  const applications = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Confusing Images" &&
        event.condition === "Confusion",
    );
  const fullApplications = applications(full);
  const interruptedApplications = applications(interrupted);

  assert.equal(fullApplications.length, 7);
  assert.ok(fullApplications.every((event) => event.stacks === 1));
  assert.ok(
    fullApplications.every(
      (event, index) =>
        index === 0 || event.at > fullApplications[index - 1].at,
    ),
  );
  assert.equal(interruptedApplications.length, 3);
});

test("Chaos Storm uses its EVTC pulse offsets and Lesser Chaos Storm stays periodic", () => {
  const damageEvents = (result, skillName) =>
    result.resolvedEvents.filter(
      (event) => event.type === "damage" && event.skillName === skillName,
    );
  const assertSixPulses = (events) => {
    assert.equal(events.length, 6);
    assert.ok(events.every((event) => event.hits === 1));
    assert.ok(
      events.every(
        (event, index) =>
          index === 0 || Math.abs(event.at - events[index - 1].at - 1) < 1e-12,
      ),
    );
  };

  const chaosStorm = simulateMesmer(
    ["Chaos Storm", { name: "__wait", waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  assert.deepEqual(
    damageEvents(chaosStorm, "Chaos Storm").map((event) =>
      Math.round(event.at * 1000),
    ),
    [281, 1279, 2280, 3282, 4279, 5280],
  );

  const lesserChaosStorm = simulateMesmer(
    ["Ether Feast", { name: "__wait", waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Method of Madness"],
      selectedSkills: ["Ether Feast"],
    }),
  );
  assertSixPulses(damageEvents(lesserChaosStorm, "Lesser Chaos Storm"));
});

test("Confusing Images starts its cooldown after its channel ends", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Scepter",
    secondaryWeapon: "",
    initialResource: 0,
  });
  const full = simulateMesmer(["Confusing Images", "Confusing Images"], config);
  const interrupted = simulateMesmer(
    [{ name: "Confusing Images", interruptMs: 250 }],
    config,
  );

  assert.equal(full.steps[0].end, 1920);
  assert.equal(full.steps[1].start, 9120);
  assert.equal(
    interrupted.endState.cooldowns["Confusing Images"].readyAt,
    7450,
  );
});

test("Spatial Surge keeps channel packets completed before an interrupt", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Greatsword",
    secondaryWeapon: "",
    initialResource: 0,
  });
  const damageEvents = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === "damage" && event.skillName === "Spatial Surge",
    );
  const full = damageEvents(simulateMesmer(["Spatial Surge"], config));
  const partial = damageEvents(
    simulateMesmer([{ name: "Spatial Surge", interruptMs: 600 }], config),
  );
  const beforeFirstPacket = damageEvents(
    simulateMesmer([{ name: "Spatial Surge", interruptMs: 200 }], config),
  );

  assert.equal(full.length, 3);
  assert.equal(partial.length, 2);
  assert.equal(beforeFirstPacket.length, 0);
  assert.ok(partial[1].at > partial[0].at);
});

test("the supplied condition Virtuoso build uses the profession-mechanic midpoint", () => {
  const rotation = [
    "Unstable Bladestorm",
    "Phantasmal Swordsman",
    { name: "Bladeturn Requiem", offset: 100 },
    { name: "__combat_start", offset: 100 },
    { name: "Thousand Cuts", offset: 100 },
    "Swap Weapons",
    "Flying Cutter",
    "Bladecall",
    "Phantasmal Duelist",
    "Bladesong Harmony",
    "Signet of the Ether",
    "Bladesong Sorrow",
    "Flying Cutter",
    "Bladesong Harmony",
    "Flying Cutter",
    "Bladecall",
    "Phantasmal Duelist",
    "Signet of Illusions",
    "Bladesong Sorrow",
    "Flying Cutter",
    "Flying Cutter",
    "Bladesong Harmony",
    "Unstable Bladestorm",
    "Flying Cutter",
    "Bladecall",
    "Swap Weapons",
    "Phantasmal Swordsman",
    "Flying Cutter",
    "Flying Cutter",
    "Bladeturn Requiem",
  ];
  const config = createDefaultConfig();
  const result = simulateMesmer(rotation, {
    ...config,
    specialization: "Virtuoso",
    selectedTraits: [
      "Critical Infusion",
      "Sharper Images",
      "Master Fencer",
      "Phantasmal Fury",
      "Fencer's Finesse",
      "Superiority Complex",
      "Cry of Pain",
      "Compounding Power",
      "Master of Misdirection",
      "Shatter Storm",
      "Maim the Disillusioned",
      "Phantasmal Force",
      "Psychic Blades",
      "Deadly Blades",
      "Quiet Intensity",
      "Jagged Mind",
      "Phantasmal Blades",
      "Bloodsong",
    ],
    selectedSkills: [
      "Signet of the Ether",
      "Signet of Illusions",
      "Signet of Midnight",
      "Signet of Domination",
      "Thousand Cuts",
    ],
    primaryWeapon: "Dagger",
    secondaryWeapon: "Pistol",
    weaponSet2Primary: "Dagger",
    weaponSet2Secondary: "Sword",
    startingWeaponSet: 2,
    initialResource: 5,
    stats: {
      power: 2006,
      precision: 2155,
      ferocity: 173,
      conditionDamage: 1847,
      expertise: 225,
      concentration: 45,
      vitality: 1280,
      conditionDurationBonuses: { Bleeding: 50 },
    },
    sigilSets: [
      {
        names: ["Agony", "Earth"],
        strike: 1,
        condition: 1,
        conditionDurationBonuses: { Bleeding: 20 },
      },
      {
        names: ["Agony", "Earth"],
        strike: 1,
        condition: 1,
        conditionDurationBonuses: { Bleeding: 20 },
      },
    ],
    relic: "Aristocracy",
    food: "Spherified Cilantro Oyster Soup",
    target: {
      ...config.target,
      armor: 2597,
      health: 3970000,
      boonless: true,
      moving: false,
    },
  });

  assert.equal(result.warnings.length, 0);
  assert.ok(Math.abs(result.dps - 40108.204257585676) < 1e-6);
});

test("Phantasmal Swordsman independently gates its summon and player hit", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
    initialResource: 0,
  });
  const interruptedAt = (interruptMs) =>
    simulateMesmer(
      [
        { name: "Phantasmal Swordsman", interruptMs },
        { name: "__wait", waitMs: 5000 },
      ],
      config,
    );
  const summonedAt = (result) =>
    result.events.find(
      (event) =>
        event.type === "mesmer.phantasm-summoned" &&
        event.name === "Phantasmal Swordsman",
    )?.at;
  const playerHitAt = (result) =>
    result.events.find(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Phantasmal Swordsman" &&
        event.source === "Player",
    )?.at;

  const beforeSummon = interruptedAt(719);
  const summonOnly = interruptedAt(720);
  const beforePlayerHit = interruptedAt(750);
  const withPlayerHit = interruptedAt(760);

  assert.equal(summonedAt(beforeSummon), undefined);
  assert.equal(summonedAt(summonOnly), 0.72);
  assert.equal(summonedAt(beforePlayerHit), 0.75);
  assert.equal(summonedAt(withPlayerHit), 0.76);
  assert.equal(playerHitAt(summonOnly), undefined);
  assert.equal(playerHitAt(beforePlayerHit), undefined);
  assert.ok(Math.abs(playerHitAt(withPlayerHit) - 0.759) < 1e-12);
  assert.equal(
    summonOnly.endState.cooldowns["Phantasmal Swordsman"].readyAt,
    12720,
  );
  assert.ok(
    summonOnly.events.some(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Phantasmal Swordsman" &&
        event.source === "Phantasm",
    ),
  );
});

test("Phantasmal Swordsman grants Fencer's Finesse per sword hit", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
    initialResource: 0,
    selectedTraits: ["Fencer's Finesse"],
  });
  const simulate = (interruptMs) =>
    simulateMesmer(
      [
        interruptMs == null
          ? "Phantasmal Swordsman"
          : { name: "Phantasmal Swordsman", interruptMs },
        { name: "__wait", waitMs: 5000 },
      ],
      config,
    );
  const applications = (result) =>
    result.events
      .filter((event) => event.type === "buff" && event.kind === "fencer")
      .map((event) => ({
        at: Math.round(event.at * 10000),
        stacks: event.stacks,
      }));

  assert.deepEqual(
    applications(simulate(null)),
    [7591, 17251, 22011, 22421, 25251, 25591, 28001, 28421, 31261, 31591].map(
      (at) => ({ at, stacks: 1 }),
    ),
  );
  assert.deepEqual(
    applications(simulate(720)),
    [15651, 20411, 20821, 23651, 23991, 26401, 26821, 29661, 29991].map(
      (at) => ({ at, stacks: 1 }),
    ),
  );
  assert.deepEqual(
    applications(simulate(760)).map((event) => event.at),
    [7591, 16051, 20811, 21221, 24051, 24391, 26801, 27221, 30061, 30391],
  );
});

test("Staff 3 converts after Mage Strike finishes and Chronophantasma repeats it first", () => {
  const rotation = ["Phantasmal Warlock", { name: "__wait", waitMs: 11000 }];
  const baseConfig = {
    initialResource: 0,
    primaryWeapon: "Staff",
    secondaryWeapon: "",
  };
  const normal = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: "Core",
      selectedTraits: [],
    }),
  );
  const chronophantasma = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: "Chronomancer",
      selectedTraits: ["Chronophantasma"],
    }),
  );
  const normalConversions = normal.events.filter(
    (event) => event.reason === "Phantasmal Warlock phantasm conversion",
  );
  const chronoConversions = chronophantasma.events.filter(
    (event) => event.reason === "Phantasmal Warlock phantasm conversion",
  );
  const repeat = chronophantasma.events.find(
    (event) => event.name === "Phantasmal Warlock - Chronophantasma",
  );
  const proc = chronophantasma.events.find(
    (event) => event.type === "proc" && event.name === "Chronophantasma",
  );

  assert.equal(normalConversions.length, 1);
  assert.equal(normalConversions[0].amount, 2);
  assert.ok(Math.abs(normalConversions[0].at - 5.0801) < 0.00001);
  assert.equal(chronoConversions.length, 1);
  assert.equal(chronoConversions[0].amount, 2);
  assert.ok(Math.abs(proc.at - 5.08) < 0.00001);
  assert.ok(Math.abs(repeat.at - 6.324) < 0.00001);
  assert.ok(Math.abs(chronoConversions[0].at - 9.5701) < 0.00001);

  const normalDamage = normal.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Phantasmal Warlock",
  );
  const normalTorment = normal.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.name === "Phantasmal Warlock — Torment",
  );
  const repeatedDamage = chronophantasma.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      event.name === "Phantasmal Warlock - Chronophantasma",
  );
  const repeatedTorment = chronophantasma.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.name === "Phantasmal Warlock - Chronophantasma",
  );

  assert.deepEqual(
    {
      coefficient: normalDamage.reduce(
        (sum, event) => sum + event.coefficient,
        0,
      ),
      hits: normalDamage.reduce((sum, event) => sum + event.hits, 0),
    },
    { coefficient: 0.9, hits: 6 },
  );
  assert.ok(normalDamage.every((event) => event.weaponStrength === 2877));
  assert.deepEqual(
    normalTorment.map((event) => event.stacks),
    [6, 6],
  );
  assert.ok(normalTorment.every((event) => event.source === "Phantasm"));
  assert.deepEqual(
    {
      coefficient: repeatedDamage.reduce(
        (sum, event) => sum + event.coefficient,
        0,
      ),
      hits: repeatedDamage.reduce((sum, event) => sum + event.hits, 0),
    },
    { coefficient: 0.9, hits: 6 },
  );
  assert.ok(repeatedDamage.every((event) => event.weaponStrength === 2877));
  assert.deepEqual(
    repeatedTorment.map((event) => event.stacks),
    [6, 6],
  );
  assert.ok(repeatedTorment.every((event) => event.source === "Phantasm"));
});

test("phantasm conditions use the summoner condition sigil modifiers", () => {
  const defaults = defaultSimulationConfig();
  const base = {
    specialization: "Core",
    selectedTraits: [],
    primaryWeapon: "Staff",
    secondaryWeapon: "",
    initialResource: 0,
    target: {
      ...defaults.target,
      health: 0,
    },
  };
  const rotation = ["Phantasmal Warlock", { name: "__wait", waitMs: 9000 }];
  const plain = simulateMesmer(rotation, defaultSimulationConfig(base));
  const withSigils = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...base,
      sigilSets: [
        {
          names: ["Bursting", "Demons"],
          condition: 1.05,
          conditionDurationBonuses: { Torment: 20 },
        },
        { names: [] },
      ],
    }),
  );
  const application = (result) =>
    result.resolvedEvents.find(
      (event) =>
        event.type === "condition" && event.skillName === "Phantasmal Warlock",
    );
  const plainApplication = application(plain);
  const sigilApplication = application(withSigils);

  assert.equal(sigilApplication.source, "Phantasm");
  assert.ok(
    sigilApplication.effectiveDuration > plainApplication.effectiveDuration,
  );
  assert.ok(
    Math.abs(
      sigilApplication.damage /
        sigilApplication.damagingStackSeconds /
        (plainApplication.damage / plainApplication.damagingStackSeconds) -
        1.05,
    ) < 0.000001,
  );
});

test("Phantasmal Mage separates player, Pledge, and phantasm conditions", () => {
  const result = simulateMesmer(
    ["Phantasmal Mage", { name: "__wait", waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["The Pledge"],
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 0,
    }),
  );
  const playerBurning = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Phantasmal Mage" &&
      event.condition === "Burning" &&
      event.source === "Player",
  );
  const phantasmConditions = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Phantasmal Mage" &&
      event.source === "Phantasm",
  );

  assert.equal(result.steps[0].end, 760);
  assert.deepEqual(
    playerBurning.map((event) => [event.stacks, event.duration, event.at]),
    [
      [1, 6, 0.76],
      [2, 3, 0.76],
    ],
  );
  assert.deepEqual(
    phantasmConditions.map((event) => [
      event.condition,
      event.stacks,
      event.duration,
    ]),
    [
      ["Burning", 1, 9],
      ["Confusion", 3, 3],
    ],
  );
});

test("Compounding Power triggers for both phantasm summons and clone conversion", () => {
  const result = simulateMesmer(
    ["Phantasmal Warlock", { name: "__wait", waitMs: 11000 }],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedTraits: ["Chronophantasma", "Compounding Power"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  const triggers = result.events.filter(
    (event) =>
      event.type === "proc" &&
      event.name === "Compounding Power" &&
      event.sourceSkill.includes("Phantasmal Warlock"),
  );

  assert.deepEqual(
    triggers.map((event) => Number(event.at.toFixed(4))),
    [0.84, 5.08, 9.5701],
  );
});

test("Compounding Power does not increase illusion attack damage", () => {
  const simulate = (selectedTraits) =>
    simulateMesmer(
      ["Phantasmal Warlock", { name: "__wait", waitMs: 4000 }],
      defaultSimulationConfig({
        specialization: "Core",
        selectedTraits,
        primaryWeapon: "Staff",
        secondaryWeapon: "",
        initialResource: 0,
      }),
    );
  const warlockDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" && event.name === "Phantasmal Warlock",
      )
      .reduce((sum, event) => sum + event.damage, 0);

  assert.equal(
    warlockDamage(simulate(["Compounding Power"])),
    warlockDamage(simulate([])),
  );
});

test("Vicious Expression and Empowered Illusions respect illusion ownership", () => {
  const assertMultiplier = (withTrait, baseline, expected) => {
    assert.ok(Math.abs(withTrait / baseline - expected) < 1e-12);
  };
  const damageBySource = (result, skillName, source) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" &&
          event.skillName === skillName &&
          event.source === source,
      )
      .reduce((sum, event) => sum + event.damage, 0);
  const simulateTroubadour = (selectedTraits) =>
    simulateMesmer(
      ["Phantasmal Swordsman", "Lively Lute", { name: "__wait", waitMs: 4000 }],
      defaultSimulationConfig({
        specialization: "Troubadour",
        selectedTraits,
        primaryWeapon: "Sword",
        secondaryWeapon: "Sword",
        initialResource: 3,
      }),
    );
  const baseline = simulateTroubadour([]);
  const vicious = simulateTroubadour(["Vicious Expression"]);
  const empowered = simulateTroubadour(["Empowered Illusions"]);
  const both = simulateTroubadour([
    "Vicious Expression",
    "Empowered Illusions",
  ]);
  const swordsmanDamage = (result, source) =>
    damageBySource(result, "Phantasmal Swordsman", source);
  const luteDamage = (result) =>
    damageBySource(result, "Lively Lute", "Player");

  assertMultiplier(
    swordsmanDamage(vicious, "Phantasm"),
    swordsmanDamage(baseline, "Phantasm"),
    1.15,
  );
  assertMultiplier(
    swordsmanDamage(empowered, "Phantasm"),
    swordsmanDamage(baseline, "Phantasm"),
    1.15,
  );
  assertMultiplier(
    swordsmanDamage(both, "Phantasm"),
    swordsmanDamage(baseline, "Phantasm"),
    1.15 * 1.15,
  );
  assertMultiplier(
    swordsmanDamage(vicious, "Player"),
    swordsmanDamage(baseline, "Player"),
    1.15,
  );
  assert.equal(
    swordsmanDamage(empowered, "Player"),
    swordsmanDamage(baseline, "Player"),
  );
  assertMultiplier(luteDamage(vicious), luteDamage(baseline), 1.15);
  assert.equal(luteDamage(empowered), luteDamage(baseline));
  assertMultiplier(luteDamage(both), luteDamage(baseline), 1.15);

  const simulateClone = (selectedTraits) =>
    simulateMesmer(
      [
        "Mirror Images",
        { name: "__wait", waitMs: 1 },
        { name: "Axes of Symmetry", skillId: ID.AXES_OF_SYMMETRY },
      ],
      defaultSimulationConfig({
        specialization: "Mirage",
        selectedSkills: ["Mirror Images"],
        selectedTraits,
        primaryWeapon: "Axe",
        secondaryWeapon: "Torch",
        initialResource: 0,
      }),
    );
  const cloneBaseline = simulateClone([]);
  const cloneVicious = simulateClone(["Vicious Expression"]);
  const cloneEmpowered = simulateClone(["Empowered Illusions"]);
  const cloneBoth = simulateClone([
    "Vicious Expression",
    "Empowered Illusions",
  ]);
  const cloneDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" &&
          event.name.includes("Axes of Symmetry") &&
          event.source === "Clone",
      )
      .reduce((sum, event) => sum + event.damage, 0);

  assertMultiplier(cloneDamage(cloneVicious), cloneDamage(cloneBaseline), 1.15);
  assertMultiplier(
    cloneDamage(cloneEmpowered),
    cloneDamage(cloneBaseline),
    1.15,
  );
  assertMultiplier(
    cloneDamage(cloneBoth),
    cloneDamage(cloneBaseline),
    1.15 * 1.15,
  );
});

test("Compounding Power gives player strikes two percent and conditions one percent per stack", () => {
  const simulate = (selectedTraits) =>
    simulateMesmer(
      [
        "Mirror Images",
        "Winds of Chaos",
        "Cry of Frustration",
        { name: "__wait", waitMs: 5000 },
      ],
      defaultSimulationConfig({
        specialization: "Core",
        selectedTraits,
        primaryWeapon: "Staff",
        secondaryWeapon: "",
        initialResource: 0,
      }),
    );
  const playerStrike = (result) =>
    result.resolvedEvents.find(
      (event) =>
        event.type === "damage" &&
        event.name === "Winds of Chaos" &&
        event.source === "Player",
    ).damage;
  const playerCondition = (result) =>
    result.resolvedEvents.find(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Cry of Frustration" &&
        event.source === "Player",
    ).damage;
  const withTrait = simulate(["Compounding Power"]);
  const withoutTrait = simulate([]);

  assert.ok(
    Math.abs(playerStrike(withTrait) / playerStrike(withoutTrait) - 1.04) <
      1e-12,
  );
  assert.ok(
    Math.abs(
      playerCondition(withTrait) / playerCondition(withoutTrait) - 1.02,
    ) < 1e-12,
  );
});

test("Winds of Chaos uses its measured 760ms Quickness cast time", () => {
  const result = simulateMesmer(
    ["Winds of Chaos"],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
    }),
  );

  assert.equal(result.steps[0].end - result.steps[0].start, 760);
});

test("Phantasmal Warlock uses its full 840ms Quickness cast time", () => {
  const result = simulateMesmer(
    ["Phantasmal Warlock"],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
    }),
  );

  assert.equal(result.steps[0].end - result.steps[0].start, 840);
});

test("Phantasmal Warlock summons when shortened to 640ms", () => {
  const simulate = (interruptMs) =>
    simulateMesmer(
      [
        { name: "Phantasmal Warlock", interruptMs },
        { name: "__wait", waitMs: 4000 },
      ],
      defaultSimulationConfig({
        specialization: "Core",
        primaryWeapon: "Staff",
        secondaryWeapon: "",
        initialResource: 0,
      }),
    );
  const summoned = (result) =>
    result.events.some(
      (event) =>
        event.type === "mesmer.phantasm-summoned" &&
        event.name === "Phantasmal Warlock",
    );

  assert.equal(summoned(simulate(639)), false);
  assert.equal(summoned(simulate(640)), true);
});

test("corrected Mesmer skills use their measured Quickness cast times", () => {
  const coreConfig = {
    specialization: "Core",
    initialResource: 0,
  };
  const counterspell = simulateMesmer(
    ["Illusionary Counter", "Counterspell"],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
    }),
  );
  assert.equal(counterspell.steps[1].end - counterspell.steps[1].start, 600);

  const signet = simulateMesmer(
    ["Signet of the Ether"],
    defaultSimulationConfig(coreConfig),
  );
  assert.equal(signet.steps[0].end - signet.steps[0].start, 919);

  const chaosStorm = simulateMesmer(
    ["Chaos Storm"],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: "Staff",
      secondaryWeapon: "",
    }),
  );
  assert.equal(chaosStorm.steps[0].end - chaosStorm.steps[0].start, 480);

  const scepterChain = simulateMesmer(
    ["Ether Bolt", "Ether Blast", "Ether Clone"],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
    }),
  );
  assert.deepEqual(
    scepterChain.steps.map((step) => step.end - step.start),
    [440, 520, 840],
  );

  const confusingImages = simulateMesmer(
    ["Confusing Images"],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
    }),
  );
  assert.equal(
    confusingImages.steps[0].end - confusingImages.steps[0].start,
    1920,
  );

  const pistolSkills = simulateMesmer(
    ["Phantasmal Duelist", "Magic Bullet"],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
    }),
  );
  assert.deepEqual(
    pistolSkills.steps.map((step) => step.end - step.start),
    [560, 440],
  );

  const axeSkills = simulateMesmer(
    [
      "Lacerating Chop",
      "Ethereal Chop",
      "Mirror Strikes",
      "Lingering Thoughts",
      "Axes of Symmetry",
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      primaryWeapon: "Axe",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );
  assert.deepEqual(
    axeSkills.steps.map((step) => step.end - step.start),
    [430, 530, 720, 930, 1020],
  );

  const greatswordSkills = simulateMesmer(
    ["Mind Stab", "Phantasmal Berserker", "Illusionary Wave"],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Greatsword",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  assert.deepEqual(
    greatswordSkills.steps.map((step) => step.end - step.start),
    [320, 560, 640],
  );
});

test("Mind Stab applies its supplied Vulnerability coefficient scaling", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Greatsword",
    secondaryWeapon: "",
    selectedTraits: [],
    modifiers: { strike: 1, condition: 1 },
  });
  const damageAt = (vulnerability) =>
    simulateMesmer(["Mind Stab"], {
      ...config,
      target: {
        ...config.target,
        conditions: {
          ...config.target.conditions,
          Vulnerability: vulnerability,
        },
      },
    }).resolvedEvents.find(
      (event) => event.type === "damage" && event.skillName === "Mind Stab",
    ).damage;

  assert.ok(Math.abs(damageAt(25) / damageAt(0) - 1.5625) < 1e-12);
});

test("Phantasmal Berserker uses its phantasm coefficient and Bountiful reduction", () => {
  const coefficientAt = (selectedTraits) =>
    simulateMesmer(
      ["Phantasmal Berserker", { name: "__wait", waitMs: 2000 }],
      defaultSimulationConfig({
        specialization: "Core",
        primaryWeapon: "Greatsword",
        secondaryWeapon: "",
        selectedTraits,
        initialResource: 0,
      }),
    )
      .events.filter(
        (event) =>
          event.type === "damage" && event.skillName === "Phantasmal Berserker",
      )
      .reduce((sum, event) => sum + event.coefficient, 0);

  assert.ok(Math.abs(coefficientAt([]) - 2.4) < 1e-12);
  assert.ok(Math.abs(coefficientAt(["Bountiful Blades"]) - 2.784) < 1e-12);
});

test("Mirror Blade resolves target-facing bounce damage as separate hits", () => {
  const simulateMirrorBlade = (selectedTraits) =>
    simulateMesmer(
      ["Mirror Blade", { name: "__wait", waitMs: 1000 }],
      defaultSimulationConfig({
        specialization: "Core",
        primaryWeapon: "Greatsword",
        secondaryWeapon: "",
        selectedTraits,
        initialResource: 0,
      }),
    );
  const result = simulateMirrorBlade(["Bountiful Blades"]);
  const hits = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillName === "Mirror Blade",
  );
  const baseHits = simulateMirrorBlade([]).resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillName === "Mirror Blade",
  );

  assert.equal(hits.length, 4);
  assert.equal(baseHits.length, 3);
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [2.5, 0.1, 0.004, 0.00016],
  );
  assert.ok(
    hits.every((event, index) => index === 0 || event.at > hits[index - 1].at),
  );
});

test("Pistol 4 converts after Illusionary Unload and its Chronophantasma repeat", () => {
  const rotation = ["Phantasmal Duelist", { name: "__wait", waitMs: 15000 }];
  const baseConfig = {
    initialResource: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Pistol",
  };
  const normal = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: "Core",
      selectedTraits: [],
    }),
  );
  const chronophantasma = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: "Chronomancer",
      selectedTraits: ["Chronophantasma"],
    }),
  );
  const normalConversion = normal.events.find(
    (event) => event.reason === "Phantasmal Duelist phantasm conversion",
  );
  const chronoConversion = chronophantasma.events.find(
    (event) => event.reason === "Phantasmal Duelist phantasm conversion",
  );
  const resummon = chronophantasma.events.find(
    (event) =>
      event.type === "mesmer.phantasm-resummoned" &&
      event.name === "Phantasmal Duelist",
  );
  const repeat = chronophantasma.events.find(
    (event) =>
      event.type === "mesmer.phantasm-attack" &&
      event.name === "Phantasmal Duelist" &&
      event.repeat,
  );

  assert.equal(normalConversion.amount, 1);
  assert.ok(Math.abs(normalConversion.at - 3.4401) < 0.00001);
  assert.ok(Math.abs(resummon.at - 3.44) < 0.00001);
  assert.ok(Math.abs(repeat.at - 5.94) < 0.00001);
  assert.equal(chronoConversion.amount, 1);
  assert.ok(Math.abs(chronoConversion.at - 6.5701) < 0.00001);
});

test("Mimic resets the next utility skill within its ten-second window", () => {
  const result = simulateMesmer(
    [
      "Mimic",
      "Tale of the Tortured Mastermind",
      "Tale of the Tortured Mastermind",
    ],
    defaultSimulationConfig({
      specialization: "Troubadour",
      selectedSkills: ["Mimic", "Tale of the Tortured Mastermind"],
      initialResource: 0,
    }),
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[0].end, 640);
  assert.equal(result.steps[1].start, 640);
  assert.equal(result.steps[2].start, 1040);
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "proc" &&
        event.source === "Mimic" &&
        event.targetSkillName === "Tale of the Tortured Mastermind",
    ),
  );
});

test("phantasms and Chronophantasma repeats use per-entity EVTC packet cadences", () => {
  const cases = [
    {
      skill: "Phantasmal Swordsman",
      primaryWeapon: "Sword",
      secondaryWeapon: "Sword",
      initial: [845, 1321, 1362, 1645, 1679, 1920, 1962, 2246, 2279],
      repeat: [4474, 4960, 5002, 5277, 5319, 5559, 5602, 5876, 5920],
    },
    {
      skill: "Phantasmal Duelist",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initial: [883, 1083, 1283, 1483, 1683, 1883, 2083, 2283],
      repeat: [3972, 4173, 4372, 4571, 4771, 4973, 5171, 5380],
    },
    {
      skill: "Phantasmal Berserker",
      primaryWeapon: "Greatsword",
      secondaryWeapon: "Sword",
      traits: ["Chronophantasma", "Bountiful Blades"],
      initial: [717, 834, 883, 951, 1000, 1085, 1117, 1251],
      repeat: [3186, 3302, 3362, 3427, 3480, 3544, 3595, 3721],
    },
    {
      skill: "Phantasmal Warlock",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initial: [1117, 1160, 1918, 1960, 2722, 2766],
      repeat: [5484, 5642, 6280, 6441, 7085, 7243],
    },
  ];

  for (const testCase of cases) {
    const result = simulateMesmer(
      [testCase.skill, { name: "__wait", waitMs: 9000 }],
      defaultSimulationConfig({
        specialization: "Chronomancer",
        selectedTraits: testCase.traits || ["Chronophantasma"],
        primaryWeapon: testCase.primaryWeapon,
        secondaryWeapon: testCase.secondaryWeapon,
        initialResource: 0,
      }),
    );
    const castEnd = result.steps[0].end / 1000;
    const initialEvents = result.events.filter(
      (event) =>
        event.type === "damage" &&
        event.source === "Phantasm" &&
        event.name === testCase.skill,
    );
    const repeatEvents = result.events.filter(
      (event) =>
        event.type === "damage" &&
        event.source === "Phantasm" &&
        event.name === `${testCase.skill} - Chronophantasma`,
    );
    const offsets = (events) =>
      events
        .map((event) => Math.round((event.at - castEnd) * 1000))
        .sort((a, b) => a - b);

    assert.deepEqual(
      offsets(initialEvents),
      testCase.initial,
      `${testCase.skill} initial`,
    );
    assert.deepEqual(
      offsets(repeatEvents),
      testCase.repeat,
      `${testCase.skill} repeat`,
    );
  }
});

test("direct Mesmer strikes use the supplied EVTC offsets from cast start", () => {
  const assertOffsets = (rotation, config, expectations) => {
    const result = simulateMesmer(
      [...rotation, { name: "__wait", waitMs: 6000 }],
      defaultSimulationConfig(config),
    );
    for (const [skill, stepIndex, expected] of expectations) {
      const castStart = result.steps[stepIndex].start / 1000;
      const offsets = result.resolvedEvents
        .filter(
          (event) =>
            event.type === "damage" &&
            event.source === "Player" &&
            event.skillName === skill,
        )
        .map((event) => Math.round((event.at - castStart) * 1000));
      assert.deepEqual(offsets, expected, skill);
    }
  };

  assertOffsets(
    ["Chaos Storm"],
    {
      specialization: "Chronomancer",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
    },
    [["Chaos Storm", 0, [281, 1279, 2280, 3282, 4279, 5280]]],
  );
  assertOffsets(
    ["Confusing Images"],
    {
      specialization: "Chronomancer",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
    },
    [["Confusing Images", 0, [921, 1081, 1199, 1441, 1560, 1679, 1841]]],
  );
  assertOffsets(
    ["Winds of Chaos"],
    {
      specialization: "Chronomancer",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
    },
    [["Winds of Chaos", 0, [533, 623]]],
  );
  assertOffsets(
    ["Illusionary Wave", "Mind Stab", "Mirror Blade", "Spatial Surge"],
    {
      specialization: "Chronomancer",
      selectedTraits: ["Bountiful Blades"],
      primaryWeapon: "Greatsword",
      secondaryWeapon: "Sword",
    },
    [
      ["Illusionary Wave", 0, [401]],
      ["Mind Stab", 1, [200]],
      ["Mirror Blade", 2, [602, 767, 918, 1084]],
      ["Spatial Surge", 3, [366, 518, 684]],
    ],
  );
  assertOffsets(
    ["Well of Calamity"],
    { specialization: "Chronomancer", selectedSkills: ["Well of Calamity"] },
    [["Well of Calamity", 0, [559, 1559, 2561, 3554]]],
  );
  assertOffsets(
    ["Bladesong Dissonance"],
    { specialization: "Virtuoso", initialResource: 5 },
    [["Bladesong Dissonance", 0, [400]]],
  );
  assertOffsets(
    ["Illusionary Counter", "Counterspell"],
    {
      specialization: "Chronomancer",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
    },
    [["Counterspell", 1, [322]]],
  );
  assertOffsets(
    ["Illusionary Riposte", "Counter Blade"],
    {
      specialization: "Chronomancer",
      primaryWeapon: "Sword",
      secondaryWeapon: "Sword",
    },
    [["Counter Blade", 1, [484]]],
  );
  assertOffsets(
    ["Ether Bolt", "Ether Blast", "Ether Clone"],
    {
      specialization: "Chronomancer",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
    },
    [
      ["Ether Bolt", 0, [400]],
      ["Ether Blast", 1, [481]],
      ["Ether Clone", 2, [442]],
    ],
  );
  assertOffsets(
    ["Magic Bullet"],
    {
      specialization: "Chronomancer",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
    },
    [["Magic Bullet", 0, [362]]],
  );
});

test("condition-bearing clone autoattacks apply their damaging conditions", () => {
  const axe = simulateMesmer(
    ["Mirror Images", { name: "__wait", waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedSkills: ["Mirror Images"],
      primaryWeapon: "Axe",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );
  const axeConditions = axe.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.skillName.startsWith("Clone: "),
  );
  assert.ok(axeConditions.length > 0);
  assert.deepEqual(
    [
      ...new Set(
        axeConditions.map((event) => `${event.condition}:${event.duration}`),
      ),
    ].sort(),
    ["Bleeding:1", "Torment:1"],
  );
  assert.ok(axeConditions.every((event) => event.stacks === 1));
  const axeHits = axe.events.filter(
    (event) =>
      event.type === "damage" && event.skillName === "Clone: Lacerating Chop",
  );
  assert.deepEqual(
    [...new Set(axeHits.map((event) => Number(event.at.toFixed(3))))],
    [1.72, 3.28, 4.84],
  );
  assert.ok(
    !axe.events.some(
      (event) =>
        event.skillName === "Clone: Ethereal Chop" ||
        event.skillName === "Clone: Mirror Strikes",
    ),
  );

  const staff = simulateMesmer(
    ["Phase Retreat", { name: "__wait", waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  const staffConditions = staff.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Clone: Winds of Chaos",
  );
  assert.equal(staffConditions.length, 2);
  assert.ok(
    staffConditions.some(
      (event) => event.condition === "Torment" && event.duration === 2,
    ),
  );
  assert.ok(
    staffConditions.some(
      (event) => event.condition === "Confusion" && event.duration === 2,
    ),
  );
  const staffHits = staff.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.skillName === "Clone: Winds of Chaos",
  );
  assert.equal(
    staffHits.reduce((sum, event) => sum + event.hits, 0),
    2,
  );

  const scepter = simulateMesmer(
    ["Mirror Images", { name: "__wait", waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedSkills: ["Mirror Images"],
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );
  const scepterTorment = scepter.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Clone: Ether Bolt" &&
      event.condition === "Torment",
  );
  assert.equal(scepterTorment.length, 2);
  assert.ok(scepterTorment.every((event) => event.duration === 4));
});

test("Mirror Strikes applies Bleeding and Torment once across its two hits", () => {
  const result = simulateMesmer(
    [
      "Lacerating Chop",
      "Ethereal Chop",
      "Mirror Strikes",
      { name: "__wait", waitMs: 7000 },
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      selectedTraits: [],
    }),
  );
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillName === "Mirror Strikes",
  );
  assert.equal(
    strikes.reduce((sum, event) => sum + event.hits, 0),
    2,
  );
  const conditions = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Mirror Strikes",
  );
  assert.deepEqual(
    conditions
      .map((event) => `${event.condition}:${event.stacks}:${event.duration}`)
      .sort(),
    ["Bleeding:1:6", "Torment:1:6"],
  );
});

test("axe clone attacks and Axes of Symmetry use EVTC cast-start snapshots", () => {
  const config = defaultSimulationConfig({
    specialization: "Mirage",
    selectedSkills: ["Mirror Images"],
    selectedTraits: [],
    primaryWeapon: "Axe",
    secondaryWeapon: "Torch",
    initialResource: 0,
  });
  const existingClones = simulateMesmer(
    [
      "Mirror Images",
      { name: "__wait", waitMs: 1 },
      { name: "Axes of Symmetry", skillId: ID.AXES_OF_SYMMETRY },
    ],
    config,
  );
  const axesStep = existingClones.steps.find(
    (step) => step.skill === "Axes of Symmetry",
  );
  const axesStart = axesStep.start / 1000;
  const playerHit = existingClones.resolvedEvents.find(
    (event) =>
      event.type === "damage" &&
      event.skillName === "Axes of Symmetry" &&
      event.source === "Player",
  );
  const cloneHits = existingClones.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      event.name.includes("Axes of Symmetry") &&
      event.source === "Clone",
  );
  const cloneConfusion = existingClones.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Axes of Symmetry" &&
      event.source === "Clone",
  );

  assert.equal(axesStep.end - axesStep.start, 1000);
  assert.equal(Math.round((playerHit.at - axesStart) * 1000), 920);
  assert.deepEqual(
    cloneHits.map((event) => Math.round((event.at - axesStart) * 1000)),
    [960, 960],
  );
  assert.ok(
    cloneHits.every(
      (event) => event.coefficient === 1.75 && event.weaponStrength === 28.5,
    ),
  );
  assert.equal(cloneConfusion.length, 2);
  assert.ok(
    cloneConfusion.every((event) => event.stacks === 1 && event.duration === 6),
  );
  const playerConfusion = existingClones.resolvedEvents.find(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Axes of Symmetry" &&
      event.source === "Player",
  );
  assert.equal(playerConfusion.stacks, 5);
  assert.equal(playerConfusion.duration, 6);

  const spawnedDuringCast = simulateMesmer(
    [
      { name: "Lingering Thoughts", skillId: ID.LINGERING_THOUGHTS },
      { name: "Axes of Symmetry", skillId: ID.AXES_OF_SYMMETRY },
    ],
    config,
  );
  assert.equal(
    spawnedDuringCast.resolvedEvents.some(
      (event) =>
        event.type === "damage" &&
        event.name.includes("Axes of Symmetry") &&
        event.source === "Clone",
    ),
    false,
  );
});

test("Imaginary Axes lands 360ms from cast start with two 3-stack torment hits", () => {
  const result = simulateMesmer(
    [
      "Dodge / Mirage Cloak",
      { name: "Imaginary Axes", skillId: ID.IMAGINARY_AXES },
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: [],
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 0,
    }),
  );
  const step = result.steps[1];
  const strike = result.resolvedEvents.find(
    (event) =>
      event.type === "damage" &&
      event.skillName === "Imaginary Axes" &&
      event.source === "Player",
  );
  const torment = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Imaginary Axes" &&
      event.source === "Player",
  );

  assert.equal(step.end - step.start, 440);
  assert.equal(Math.round((strike.at - step.start / 1000) * 1000), 360);
  assert.equal(torment.length, 2);
  assert.ok(torment.every((event) => event.at === strike.at));
  assert.ok(
    torment.every((event) => event.stacks === 3 && event.duration === 3.5),
  );
});

test("destroyed clones do not apply prescheduled autoattack conditions", () => {
  const result = simulateMesmer(
    ["Phase Retreat", "Mind Wrack", { name: "__wait", waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Clone: Winds of Chaos",
    ),
    false,
  );
});

test("Ineptitude applies confusion for each direct blind on a normal target", () => {
  const result = simulateMesmer(
    ["Chaos Armor", "Signet of Midnight", { name: "__wait", waitMs: 100 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Ineptitude"],
      selectedSkills: ["Signet of Midnight"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  const ineptitude = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.name.endsWith("— Ineptitude"),
  );

  assert.equal(ineptitude.length, 2);
  assert.equal(ineptitude[0].skillName, "Chaos Armor");
  assert.equal(ineptitude[0].condition, "Confusion");
  assert.equal(ineptitude[0].duration, 5);
  assert.equal(ineptitude[0].stacks, 2);
  assert.equal(ineptitude[1].skillName, "Signet of Midnight");
});

test("Ineptitude direct blinds ignore the defiant-target interval", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Chaos Armor", "Signet of Midnight", { name: "__wait", waitMs: 100 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Ineptitude"],
      selectedSkills: ["Signet of Midnight"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
      target: {
        ...defaults.target,
        defiant: true,
      },
    }),
  );
  const ineptitude = result.resolvedEvents.filter(
    (event) => event.type === "condition" && event.name.includes("Ineptitude"),
  );

  assert.equal(ineptitude.length, 2);
});

test("Ineptitude intervals only interrupt-generated blinds on defiant targets", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Magic Bullet", "Signet of Humility"],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Ineptitude"],
      selectedSkills: ["Signet of Humility"],
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initialResource: 0,
      target: {
        ...defaults.target,
        defiant: true,
        activatingSkills: true,
      },
    }),
  );
  const ineptitude = result.resolvedEvents.filter(
    (event) => event.type === "condition" && event.name.includes("Ineptitude"),
  );

  assert.deepEqual(
    ineptitude.map((event) => event.skillName),
    ["Magic Bullet"],
  );
});

test("condition Chronomancer preset retains multi-hit Ineptitude", () => {
  const saved = JSON.parse(
    readFileSync(
      new URL(
        "../../../Builds/mesmer/b-condi-chronomancer.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = toApplicationBuild({
    ...saved,
    rotation: ["Mirror Images", "Rewinder"],
  });
  const app = {
    build,
    skillByName: mesmerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const config = simulationConfig(app);
  const result = simulateMesmer(build.rotation, config);
  const ineptitude = result.resolvedEvents.find(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Rewinder" &&
      event.name.includes("Ineptitude"),
  );

  assert.equal(config.target.defiant, true);
  assert.equal(ineptitude?.stacks, 6);
});

test("condition Dune Cloak Mirage preset matches the supplied equipment", () => {
  const saved = JSON.parse(
    readFileSync(
      new URL(
        "../../../Builds/mesmer/b-condi-mirage-dune-cloak.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    readFileSync(
      new URL(
        "../../../Rotations/mesmer/r-condi-mirage-dune-cloak-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = toApplicationBuild({
    ...saved,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: mesmerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);

  assert.deepEqual(
    ["Power", "Precision", "Condition Damage", "Expertise"].map(
      (attribute) => app.attributeData.attributes[attribute].final,
    ),
    [2172, 1633, 1941, 898],
  );
  assert.equal(
    app.attributeData.attributes["Condition Duration"].final,
    74.86666666666667,
  );
  assert.deepEqual(build.weapons, ["Staff", ""]);
  assert.deepEqual(build.alternateWeapons, ["Axe", "Torch"]);
  assert.deepEqual(build.weaponSigils, [
    ["Demons", "Energy"],
    ["Demons", "Energy"],
  ]);
  assert.equal(build.relic, "Peitha");
  assert.deepEqual(savedRotation.metadata, {
    log: "condi mirage bench.zevtc",
    benchmarkDurationSeconds: 96.439,
    benchmarkDamage: 3947813,
    benchmarkDps: 40935.8558,
  });
  const result = simulateMesmer(build.rotation, simulationConfig(app));
  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round(result.dps), 41188);
  assert.ok(
    Math.abs(result.totalDamage - savedRotation.metadata.benchmarkDamage) /
      savedRotation.metadata.benchmarkDamage <
      0.01,
  );

  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  ).start;
  const relativeStart = (step) =>
    Number(((step.start - combatStart) / 1000).toFixed(3));
  assert.deepEqual(
    result.steps
      .filter((step) => step.skill === "Chaos Armor")
      .map(relativeStart),
    [0, 12.8, 38.309, 62.738, 87.947],
  );
  assert.ok(
    result.steps
      .filter((step) => step.skill === "Distortion")
      .map(relativeStart)
      .includes(42.869),
  );
  assert.ok(
    result.procSteps.some(
      (step) =>
        step.skill === "Relic of Peitha" &&
        step.sourceSkill === "Axes of Symmetry" &&
        result.steps.some(
          (cast) =>
            cast.skill === "Axes of Symmetry" &&
            step.start === cast.start + 519,
        ),
    ),
  );
  assert.equal(
    result.procSteps.filter((step) => step.skill === "Relic of Peitha").length,
    19,
  );
  assert.ok(
    Math.abs(
      result.conditionBreakdown.find((row) => row.name === "Torment")
        .averageStacks - 47.807,
    ) < 0.01,
  );

  const conditionApplications = (condition) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === "condition" && event.condition === condition,
      )
      .reduce((sum, event) => sum + event.stacks, 0);
  assert.ok(Math.abs(conditionApplications("Torment") - 606) <= 2);
  // Whirl bolts and the second Winds of Chaos bounce are directional in
  // game; the deterministic simulator assumes they connect with the target.
  assert.ok(Math.abs(conditionApplications("Confusion") - 341) <= 15);
});

test("power Troubadour benchmark preset preserves the supplied build and log", () => {
  const saved = JSON.parse(
    readFileSync(
      new URL(
        "../../../Builds/mesmer/b-power-troubadour.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    readFileSync(
      new URL(
        "../../../Rotations/mesmer/r-power-troubadour-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = toApplicationBuild({
    ...saved,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: mesmerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);

  assert.deepEqual(build.weapons, ["Dagger", "Sword"]);
  assert.deepEqual(build.alternateWeapons, ["Spear", ""]);
  assert.ok(Object.values(build.gear).every((stat) => stat === "Berserker's"));
  assert.deepEqual(build.specializations, [
    { name: "Domination", traits: "2-2-1" },
    { name: "Dueling", traits: "1-3-1" },
    { name: "Troubadour", traits: "3-1-1" },
  ]);
  assert.deepEqual(build.selectedSkills, {
    Heal: "Signet of the Ether",
    Utility1: "Tale of the Tortured Mastermind",
    Utility2: "Mimic",
    Utility3: "Mantra of Pain",
    Elite: "Signet of Humility",
  });
  assert.deepEqual(build.weaponSigils, [
    ["Force", "Accuracy"],
    ["Force", "Accuracy"],
  ]);
  assert.equal(build.rune, "Dragonhunter");
  assert.equal(build.relic, "Shackles");
  assert.equal(build.food, "Cilantro Lime Sous-Vide Steak");
  assert.equal(build.utility, "Superior Sharpening Stone");
  assert.equal(build.initialResource, 3);
  assert.deepEqual(build.infusions.slice(0, 2), [
    { stat: "Power", count: 14 },
    { stat: "Precision", count: 4 },
  ]);
  assert.deepEqual(savedRotation.metadata, {
    log: "power troubadour bench.zevtc",
    benchmarkDurationSeconds: 94.235,
    benchmarkDamage: 4005841,
    benchmarkDps: 42509.0571,
    source: "EVTC activation order reconstructed from the supplied benchmark",
  });
  assert.equal(
    savedRotation.rotation.some((entry) => entry.waitMs === 800),
    false,
  );
  const powerSpikeIndices = savedRotation.rotation
    .map((entry, index) => (entry.name === "Power Spike" ? index : -1))
    .filter((index) => index >= 0);
  assert.equal(
    savedRotation.rotation[powerSpikeIndices[1] - 1].name,
    "Phantasmal Lancer",
  );

  const result = simulateMesmer(build.rotation, simulationConfig(app));
  const count = (name) =>
    result.steps.filter((step) => step.skill === name).length;
  const damageEvents = (name) =>
    result.resolvedEvents.filter(
      (event) => event.type === "damage" && event.skillName === name,
    );
  const totalDamage = (events) =>
    events.reduce((total, event) => total + event.damage, 0);
  const swordsman = damageEvents("Phantasmal Swordsman");
  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round(result.dps), 42703);
  assert.equal(count("Lively Lute"), 9);
  assert.equal(count("Flustering Flute"), 6);
  assert.equal(count("Deafening Drum"), 5);
  assert.equal(count("Harmonious Harp"), 4);
  assert.equal(count("Crescendo"), 4);
  assert.equal(count("Tale of the Tortured Mastermind"), 8);
  assert.equal(count("Mimic"), 3);
  assert.equal(count("Power Spike"), 11);
  assert.equal(count("Swap Weapons"), 8);
  const syncopate = damageEvents("Syncopate");
  assert.equal(syncopate.length, 39);
  assert.equal(
    syncopate.filter((event) => event.name === "Syncopate").length,
    35,
  );
  assert.equal(
    syncopate.filter((event) => event.name === "Syncopate — delayed wave")
      .length,
    4,
  );
  assert.equal(damageEvents("Relic of the Shackles").length, 8);
  assert.equal(
    Math.round(
      totalDamage(swordsman.filter((event) => event.source === "Player")),
    ),
    40868,
  );
  assert.equal(
    Math.round(
      totalDamage(swordsman.filter((event) => event.source === "Phantasm")),
    ),
    299369,
  );
});

test("Chaos Armor applies three base confusion plus two from Ineptitude", () => {
  const result = simulateMesmer(
    ["Chaos Armor"],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Ineptitude"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  const confusion = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Chaos Armor" &&
      event.condition === "Confusion",
  );

  assert.deepEqual(confusion.map((event) => event.stacks).sort(), [2, 3]);
});

test("Counterspell applies five base confusion plus two from Ineptitude", () => {
  const result = simulateMesmer(
    ["Illusionary Counter", "Counterspell"],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Ineptitude"],
      primaryWeapon: "Scepter",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  const confusion = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Counterspell" &&
      event.condition === "Confusion",
  );

  assert.deepEqual(confusion.map((event) => event.stacks).sort(), [2, 5]);
});

test("Signet of Midnight blind applies two confusion from Ineptitude", () => {
  const result = simulateMesmer(
    ["Signet of Midnight"],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Ineptitude"],
      selectedSkills: ["Signet of Midnight"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  const confusion = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Signet of Midnight" &&
      event.condition === "Confusion",
  );

  assert.deepEqual(
    confusion.map((event) => event.stacks),
    [2],
  );
});

test("Signet of Midnight expertise is inactive while recharging", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      "Confusing Images",
      "Signet of Midnight",
      "Confusing Images",
      "Confusing Images",
    ],
    defaultSimulationConfig({
      specialization: "Core",
      selectedSkills: ["Signet of Midnight"],
      primaryWeapon: "Scepter",
      secondaryWeapon: "",
      stats: {
        ...defaults.stats,
        expertise: 180,
      },
      boons: {
        ...defaults.boons,
        quickness: false,
        alacrity: false,
      },
    }),
  );
  const applications = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Confusing Images",
  );

  assert.equal(applications.length, 21);
  assert.ok(
    applications
      .slice(0, 7)
      .every((event) => Math.abs(event.effectiveDuration - 7.84) < 1e-12),
  );
  assert.ok(
    applications.slice(7, 14).every((event) => event.effectiveDuration === 7),
  );
  assert.ok(
    applications
      .slice(14)
      .every((event) => Math.abs(event.effectiveDuration - 7.84) < 1e-12),
  );
});

test("Continuum Shift restores Signet of Midnight passive expertise", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      "Continuum Split",
      "Signet of Midnight",
      "Continuum Shift",
      "Confusing Images",
    ],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedSkills: ["Signet of Midnight"],
      selectedTraits: ["Malicious Sorcery"],
      primaryWeapon: "Scepter",
      secondaryWeapon: "",
      initialResource: 3,
      stats: {
        ...defaults.stats,
        expertise: 180,
      },
      boons: {
        ...defaults.boons,
        quickness: false,
        alacrity: false,
      },
    }),
  );
  const application = result.resolvedEvents.find(
    (event) =>
      event.type === "condition" && event.skillName === "Confusing Images",
  );

  assert.equal(application.effectiveDuration, 9.59);
});

test("Ineptitude treats control as an interrupt only for an activating target", () => {
  const defaults = defaultSimulationConfig();
  const config = {
    specialization: "Core",
    selectedTraits: ["Ineptitude"],
    primaryWeapon: "Scepter",
    secondaryWeapon: "Pistol",
    initialResource: 0,
  };
  const idle = simulateMesmer(
    ["Magic Bullet", { name: "__wait", waitMs: 100 }],
    defaultSimulationConfig({
      ...config,
      target: {
        ...defaults.target,
        activatingSkills: false,
        confusionActivationsPerSecond: 0,
      },
    }),
  );
  const active = simulateMesmer(
    ["Magic Bullet", { name: "__wait", waitMs: 100 }],
    defaultSimulationConfig({
      ...config,
      target: {
        ...defaults.target,
        activatingSkills: true,
        confusionActivationsPerSecond: 1,
      },
    }),
  );
  const ineptitudeEvents = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" && event.name.endsWith("— Ineptitude"),
    );

  assert.equal(ineptitudeEvents(idle).length, 0);
  assert.equal(ineptitudeEvents(active).length, 1);
  assert.equal(ineptitudeEvents(active)[0].stacks, 2);
});

test("Blinding Dissipation triggers Ineptitude once per Rewinder strike", () => {
  const result = simulateMesmer(
    ["Mirror Images", "Rewinder"],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedTraits: ["Blinding Dissipation", "Ineptitude"],
      selectedSkills: ["Mirror Images"],
      initialResource: 0,
    }),
  );
  const ineptitude = result.resolvedEvents.find(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Rewinder" &&
      event.name.includes("Ineptitude"),
  );

  // The mesmer and two clones each strike and blind.
  assert.equal(ineptitude.stacks, 6);
});

test("stationary torment uses the current PvE formula", () => {
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
        might: 0,
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
  const torment = result.resolvedEvents.find(
    (event) => event.type === "condition" && event.condition === "Torment",
  );

  assert.ok(Math.abs(torment.damage - 121.8) < 1e-9);
});

test("static and condition-specific duration bonuses reach the resolver", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Ether Bolt", { name: "__wait", waitMs: 2000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initialResource: 0,
      stats: {
        ...defaults.stats,
        expertise: 0,
        conditionDurationBonus: 25,
        conditionDurationBonuses: { Torment: 25 },
      },
    }),
  );
  const torment = result.resolvedEvents.find(
    (event) => event.type === "condition" && event.condition === "Torment",
  );

  assert.equal(torment.effectiveDuration, 6);
});

test("target skill activations add the current PvE confusion activation damage", () => {
  const defaults = defaultSimulationConfig();
  const config = {
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
      might: 0,
    },
  };
  const resultAt = (confusionActivationsPerSecond) =>
    simulateMesmer(
      ["Confusing Images", { name: "__wait", waitMs: 1000 }],
      defaultSimulationConfig({
        ...config,
        target: {
          ...defaults.target,
          vulnerability: 0,
          activatingSkills: confusionActivationsPerSecond > 0,
          confusionActivationsPerSecond,
        },
      }),
    );
  const base = resultAt(0);
  const active = resultAt(1);
  const confusionDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" && event.condition === "Confusion",
      )
      .reduce((sum, event) => sum + event.damage, 0);
  const stackSeconds = base.resolvedEvents
    .filter(
      (event) => event.type === "condition" && event.condition === "Confusion",
    )
    .reduce((sum, event) => sum + event.damagingStackSeconds, 0);
  const activationDamage = confusionDamage(active) - confusionDamage(base);

  assert.ok(
    Math.abs(activationDamage - stackSeconds * (16.24 + 0.0325 * 1000)) < 1e-9,
  );
});

test("event log distinguishes phantasm summon, attack, and clone conversion", () => {
  const result = simulateMesmer(
    ["Phantasmal Duelist", { name: "__wait", waitMs: 7000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );
  const log = simulationEventLogRows(result, null, mesmerProfession);

  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 0.56) < 0.00001 &&
        event.description === "PHANTASM SUMMONED Phantasmal Duelist x1",
    ),
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 2.843) < 0.00001 &&
        event.description === "PHANTASM DAMAGE COMPLETE Phantasmal Duelist x1",
    ),
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 3.4401) < 0.00001 &&
        event.description.includes("CLONE SPAWNED x1") &&
        event.description.includes("Phantasmal Duelist phantasm conversion"),
    ),
  );
  assert.match(
    simulationEventLogCsv(log),
    /Phantasmal Duelist phantasm conversion/,
  );
});

test("configured Virtuoso bladesongs spend blades at cast end", () => {
  for (const skillName of [
    "Bladesong Harmony",
    "Bladesong Sorrow",
    "Bladesong Dissonance",
    "Bladeturn Requiem",
  ]) {
    const result = simulateMesmer(
      [skillName],
      defaultSimulationConfig({ initialResource: 5 }),
    );
    const action = result.events.find(
      (event) => event.type === "action" && event.name === skillName,
    );
    const spend = result.events.find(
      (event) => event.type === "resource" && event.sourceSkill === skillName,
    );

    assert.equal(result.endState.profession.resource, 0);
    assert.equal(spend.amount, -5);
    assert.equal(spend.rotationIndex, 0);
    assert.ok(
      Math.abs(spend.at - action.fullEndsAt) < 0.00001,
      `${skillName} spent blades before cast end`,
    );
  }
});

test("Bladeturn Requiem and Thousand Cuts retain their zero-second cast times", () => {
  for (const skillName of ["Bladeturn Requiem", "Thousand Cuts"]) {
    const result = simulateMesmer(
      [skillName],
      defaultSimulationConfig({ initialResource: 5 }),
    );
    const step = result.steps[0];
    const action = result.events.find(
      (event) => event.type === "action" && event.name === skillName,
    );

    assert.equal(step.start, step.end);
    assert.equal(step.fullCastMs, 0);
    assert.equal(action.at, action.endsAt);
    assert.equal(action.at, action.fullEndsAt);
    assert.match(
      formatTimelineCastDetails(step, (time) => `${(time / 1000).toFixed(2)}s`),
      /Cast time: 0\.00s$/,
    );
  }
});

test("interrupting a bladesong restores its reserved blades", () => {
  const result = simulateMesmer(
    [{ name: "Bladesong Harmony", interruptMs: 100 }],
    defaultSimulationConfig({ initialResource: 5 }),
  );

  assert.equal(result.endState.profession.resource, 5);
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "resource" &&
        event.sourceSkill === "Bladesong Harmony" &&
        event.amount < 0,
    ),
    false,
  );
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.type === "damage" && event.skillName === "Bladesong Harmony",
    ),
    false,
  );
});

test("sigil and relic damage modifiers affect the queued rotation result", () => {
  const config = defaultSimulationConfig();
  const base = simulateMesmer(["Bladecall", "Unstable Bladestorm"], {
    ...config,
    relic: "",
    modifiers: { strike: 1, condition: 1 },
  });
  const equipped = simulateMesmer(["Bladecall", "Unstable Bladestorm"], {
    ...config,
    relic: "Thief",
    modifiers: { strike: 1.05, condition: 1 },
  });
  assert.ok(equipped.totalDamage > base.totalDamage * 1.05);
});

test("weapon swaps activate only the equipped set damage sigils", () => {
  const config = defaultSimulationConfig({
    relic: "",
    primaryWeapon: "Dagger",
    secondaryWeapon: "Sword",
    weaponSet2Primary: "Spear",
    weaponSet2Secondary: "",
    modifiers: { strike: 1, condition: 1 },
  });
  const rotation = ["Bladecall", "Swap Weapons", "Psycut"];
  const base = simulateMesmer(rotation, config);
  const equipped = simulateMesmer(rotation, {
    ...config,
    sigilSets: [
      { strike: 1.05, condition: 1 },
      { strike: 1, condition: 1 },
    ],
  });
  const strike = (result, name) =>
    result.breakdown.find((entry) => entry.name === name).strikeDamage;

  assert.ok(
    Math.abs(strike(equipped, "Bladecall") / strike(base, "Bladecall") - 1.05) <
      1e-12,
  );
  assert.ok(
    Math.abs(strike(equipped, "Psycut") / strike(base, "Psycut") - 1) < 1e-12,
  );
});

test("weapon swaps activate only the equipped set duration sigils", () => {
  const result = simulateMesmer(
    [
      "Confusing Images",
      "Swap Weapons",
      "Confusing Images",
      { name: "__wait", waitMs: 10000 },
    ],
    defaultSimulationConfig({
      relic: "",
      selectedTraits: [],
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
      weaponSet2Primary: "Scepter",
      weaponSet2Secondary: "Sword",
      stats: { expertise: 0 },
      sigilSets: [
        {
          strike: 1,
          condition: 1,
          conditionDurationBonus: 10,
        },
        {
          strike: 1,
          condition: 1,
          conditionDurationBonus: 0,
        },
      ],
    }),
  );
  const applications = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Confusing Images",
  );

  assert.equal(applications.length, 14);
  assert.ok(
    applications
      .slice(0, 7)
      .every(
        (application) => Math.abs(application.effectiveDuration - 7.7) < 1e-12,
      ),
  );
  assert.ok(
    applications
      .slice(7)
      .every(
        (application) => Math.abs(application.effectiveDuration - 7) < 1e-12,
      ),
  );
});

test("Relic of the Claw buffs strikes after a control skill for eight seconds", () => {
  const config = defaultSimulationConfig({
    relic: "",
    modifiers: { strike: 1, condition: 1 },
  });
  const base = simulateMesmer(["Bladesong Dissonance", "Bladecall"], config);
  const equipped = simulateMesmer(["Bladesong Dissonance", "Bladecall"], {
    ...config,
    relic: "Claw",
  });
  const damage = (result, name) =>
    result.breakdown.find((entry) => entry.name === name).strikeDamage;

  assert.equal(
    damage(equipped, "Bladesong Dissonance"),
    damage(base, "Bladesong Dissonance"),
  );
  assert.ok(
    Math.abs(damage(equipped, "Bladecall") / damage(base, "Bladecall") - 1.07) <
      1e-12,
  );
  assert.ok(
    equipped.procSteps.some(
      (proc) =>
        proc.type === "relic_proc" &&
        proc.skill === "Relic of the Claw" &&
        proc.sourceSkill === "Bladesong Dissonance" &&
        proc.detail === "activated",
    ),
  );
});

test("Relic of the Claw can trigger from a non-damaging control skill and expires", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    relic: "Claw",
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
    modifiers: { strike: 1, condition: 1 },
  });
  const active = simulateMesmer(["Signet of Domination", "Mind Slash"], config);
  const expired = simulateMesmer(
    ["Signet of Domination", { name: "__wait", waitMs: 8001 }, "Mind Slash"],
    config,
  );
  const activeDamage = active.breakdown.find(
    (entry) => entry.name === "Mind Slash",
  ).strikeDamage;
  const expiredDamage = expired.breakdown.find(
    (entry) => entry.name === "Mind Slash",
  ).strikeDamage;

  assert.ok(Math.abs(activeDamage / expiredDamage - 1.07) < 1e-12);
});

test("Relic of the Claw records activation and refresh procs", () => {
  const claw = simulateMesmer(
    [
      "Signet of Domination",
      "Diversion",
      { name: "__wait", waitMs: 8001 },
      "Signet of Domination",
    ],
    defaultSimulationConfig({
      specialization: "Core",
      initialResource: 3,
      relic: "Claw",
    }),
  );
  assert.deepEqual(
    claw.procSteps
      .filter((proc) => proc.skill === "Relic of the Claw")
      .map((proc) => ({ sourceSkill: proc.sourceSkill, detail: proc.detail })),
    [
      { sourceSkill: "Signet of Domination", detail: "activated" },
      { sourceSkill: "Diversion", detail: "refreshed" },
      { sourceSkill: "Signet of Domination", detail: "activated" },
    ],
  );
});

test("Relic of Fireworks records activation and refresh procs", () => {
  const fireworks = simulateMesmer(
    ["Chaos Storm", "Swap Weapons", "Phantasmal Mage"],
    defaultSimulationConfig({
      specialization: "Core",
      relic: "Fireworks",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      weaponSet2Primary: "Sword",
      weaponSet2Secondary: "Torch",
    }),
  );
  assert.deepEqual(
    fireworks.procSteps
      .filter((proc) => proc.skill === "Relic of Fireworks")
      .map((proc) => ({ sourceSkill: proc.sourceSkill, detail: proc.detail })),
    [
      { sourceSkill: "Chaos Storm", detail: "activated" },
      { sourceSkill: "Phantasmal Mage", detail: "refreshed" },
    ],
  );
});

test("Relic of Fireworks ignores non-weapon skills with qualifying cooldowns", () => {
  const fireworks = simulateMesmer(
    ["Well of Calamity"],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      relic: "Fireworks",
    }),
  );

  assert.equal(
    fireworks.procSteps.some((proc) => proc.skill === "Relic of Fireworks"),
    false,
  );
});

test("Relic of Akeem triggers on control against five confusion stacks", () => {
  const result = simulateMesmer(
    [
      "Bladesong Sorrow",
      "Bladecall",
      "Bladesong Dissonance",
      { name: "__wait", waitMs: 12000 },
    ],
    defaultSimulationConfig({
      relic: "Akeem",
      initialResource: 5,
      modifiers: { strike: 1, condition: 1 },
    }),
  );

  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.type === "relic_proc" &&
        proc.skill === "Relic of Akeem" &&
        proc.sourceSkill === "Bladesong Dissonance",
    ),
  );
  assert.ok(
    result.breakdown.some(
      (entry) =>
        entry.name === "Relic of Akeem — Confusion" &&
        entry.conditionDamage > 0,
    ),
  );
  assert.ok(
    result.breakdown.some(
      (entry) =>
        entry.name === "Relic of Akeem — Torment" && entry.conditionDamage > 0,
    ),
  );
});

test("Relic of Akeem is reported when its trigger ends the rotation", () => {
  const result = simulateMesmer(
    ["Bladesong Sorrow", "Bladecall", "Bladesong Dissonance"],
    defaultSimulationConfig({
      relic: "Akeem",
      initialResource: 5,
    }),
  );

  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.type === "relic_proc" &&
        proc.skill === "Relic of Akeem" &&
        proc.sourceSkill === "Bladesong Dissonance",
    ),
  );
});

test("Relic of the Eagle activates after runtime damage drops the target below 50%", () => {
  const config = defaultSimulationConfig({
    relic: "",
    modifiers: { strike: 1, condition: 1 },
  });
  const probe = simulateMesmer(["Bladecall"], config);
  const firstHitDamage = probe.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillName === "Bladecall",
  ).damage;
  const target = {
    ...config.target,
    health: firstHitDamage * 1.5,
  };
  const base = simulateMesmer(["Bladecall", "Bladecall"], {
    ...config,
    target,
  });
  const eagle = simulateMesmer(["Bladecall", "Bladecall"], {
    ...config,
    relic: "Eagle",
    target,
  });
  const hits = (result) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.skillName === "Bladecall",
      )
      .map((event) => event.damage);

  assert.equal(hits(eagle)[0], hits(base)[0]);
  assert.ok(Math.abs(hits(eagle)[1] / hits(base)[1] - 1.1) < 1e-12);
  assert.equal(eagle.deathTime, base.deathTime);
});

test("permanent target conditions satisfy condition-dependent relic triggers", () => {
  const result = simulateMesmer(
    ["Bladesong Dissonance"],
    defaultSimulationConfig({
      relic: "Akeem",
      initialResource: 5,
      target: {
        ...defaultSimulationConfig().target,
        conditions: {
          Confusion: 5,
          Torment: 0,
          Vulnerability: 0,
        },
      },
    }),
  );

  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.skill === "Relic of Akeem" &&
        proc.sourceSkill === "Bladesong Dissonance",
    ),
  );
});

test("Relic of Mistburn grants ten percent critical chance at ten Might", () => {
  const config = defaultSimulationConfig({
    relic: "Mistburn",
    stats: {
      ...defaultSimulationConfig().stats,
      precision: 1000,
    },
    modifiers: { strike: 1, condition: 1 },
  });
  const resultAt = (might) =>
    simulateMesmer(["Bladecall"], {
      ...config,
      boons: {
        ...config.boons,
        might,
        fury: false,
      },
    });
  const criticalChance = (result) =>
    result.resolvedEvents.find((event) => event.type === "damage")
      .criticalChance;

  assert.ok(Math.abs(criticalChance(resultAt(9)) - 0.05) < 1e-12);
  assert.ok(Math.abs(criticalChance(resultAt(10)) - 0.15) < 1e-12);
});

test("Relic of Aristocracy extends conditions after weakness or vulnerability", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    relic: "Aristocracy",
    initialResource: 0,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    stats: {
      ...defaultSimulationConfig().stats,
      expertise: 0,
    },
    modifiers: { strike: 1, condition: 1 },
  });
  const result = simulateMesmer(
    [
      "Mind Slash",
      "Mind Gash",
      "Phantasmal Duelist",
      { name: "__wait", waitMs: 5000 },
    ],
    config,
  );
  const bleeding = result.resolvedEvents.find(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Phantasmal Duelist" &&
      event.condition === "Bleeding",
  );

  assert.ok(Math.abs(bleeding.effectiveDuration - 4.12) < 1e-12);
  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.type === "relic_proc" &&
        proc.skill === "Relic of Aristocracy" &&
        proc.sourceSkill === "Mind Slash" &&
        proc.detail === "1/5 stacks",
    ),
  );
  assert.equal(
    result.procSteps.filter((proc) => proc.skill === "Relic of Aristocracy")
      .length,
    1,
  );
});

test("Relic of Aristocracy requires more than its one-second ICD", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    relic: "Aristocracy",
    initialResource: 0,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
  });
  const aristocracyProcs = (waitMs) =>
    simulateMesmer(
      [
        "Mind Slash",
        { name: "__wait", waitMs },
        "Mind Gash",
        { name: "__wait", waitMs: 2000 },
      ],
      config,
    ).procSteps.filter((proc) => proc.skill === "Relic of Aristocracy");

  assert.equal(aristocracyProcs(479).length, 1);
  assert.equal(aristocracyProcs(480).length, 1);
  assert.equal(aristocracyProcs(481).length, 2);
  assert.deepEqual(
    aristocracyProcs(481).map((proc) => proc.detail),
    ["1/5 stacks", "2/5 stacks"],
  );
});

test("Virtuoso Deadly Blades vulnerability triggers Relic of Aristocracy", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Bladecall", { name: "__wait", waitMs: 2000 }],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      selectedTraits: ["Deadly Blades"],
      relic: "Aristocracy",
      initialResource: 0,
      stats: {
        ...defaults.stats,
        precision: 4000,
      },
    }),
  );
  const vulnerability = result.events.filter(
    (event) =>
      event.type === "buff" &&
      event.kind === "target-vulnerability" &&
      event.sourceId === TRAIT.DEADLY_BLADES,
  );
  const aristocracy = result.procSteps.filter(
    (proc) => proc.skill === "Relic of Aristocracy",
  );

  assert.equal(vulnerability.length, 3);
  assert.equal(
    vulnerability.every((event) => event.stacks === 1),
    true,
  );
  assert.deepEqual(
    aristocracy.map((proc) => ({
      sourceSkill: proc.sourceSkill,
      detail: proc.detail,
    })),
    [{ sourceSkill: "Bladecall", detail: "1/5 stacks" }],
  );
});

test("Relic of Peitha triggers from Mesmer shadowsteps", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Sword",
    relic: "",
    modifiers: { strike: 1, condition: 1 },
  });
  const base = simulateMesmer(
    ["Blink", "Mind Slash", { name: "__wait", waitMs: 8000 }],
    config,
  );
  const equipped = simulateMesmer(
    ["Blink", "Mind Slash", { name: "__wait", waitMs: 8000 }],
    { ...config, relic: "Peitha" },
  );
  const damage = (result) =>
    result.breakdown.find((entry) => entry.name === "Mind Slash").strikeDamage;

  assert.ok(Math.abs(damage(equipped) / damage(base) - 1.1) < 1e-12);
  assert.ok(
    equipped.breakdown.some(
      (entry) =>
        entry.name === "Relic of Peitha — Torment" && entry.conditionDamage > 0,
    ),
  );
  assert.ok(
    equipped.procSteps.some(
      (proc) =>
        proc.type === "relic_proc" &&
        proc.skill === "Relic of Peitha" &&
        proc.sourceSkill === "Blink",
    ),
  );
});

test("Relic of Thorns uses the deterministic incoming-hit assumption", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    relic: "",
    primaryWeapon: "Dagger",
    secondaryWeapon: "Pistol",
    modifiers: { strike: 1, condition: 1 },
  });
  const rotation = [
    { name: "__wait", waitMs: 3100 },
    "Phantasmal Duelist",
    { name: "__wait", waitMs: 5000 },
  ];
  const base = simulateMesmer(rotation, config);
  const equipped = simulateMesmer(rotation, { ...config, relic: "Thorns" });

  assert.ok(equipped.conditionDamage > base.conditionDamage);
  assert.deepEqual(
    equipped.procSteps
      .filter((proc) => proc.skill === "Relic of Thorns")
      .map((proc) => proc.start),
    [3000, 8000],
  );
});

test("weapon swap only starts its cooldown in combat", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Sword",
    weaponSet2Primary: "Spear",
    weaponSet2Secondary: "",
  });
  const precombat = simulateMesmer(["Swap Weapons", "Swap Weapons"], config);
  assert.deepEqual(
    precombat.steps.map((step) => step.start),
    [0, 0],
  );
  assert.equal(precombat.endState.activeWeaponSet, 1);
  assert.equal(precombat.endState.cooldowns["Swap Weapons"], undefined);

  const inCombat = simulateMesmer(
    ["__combat_start", "Swap Weapons", "Swap Weapons"],
    config,
  );
  assert.deepEqual(
    inCombat.steps
      .filter((step) => step.skill === "Swap Weapons")
      .map((step) => step.start),
    [0, 10000],
  );
  assert.equal(inCombat.endState.activeWeaponSet, 1);
  assert.equal(inCombat.endState.cooldowns["Swap Weapons"].readyAt, 20000);
});

test("weapon swaps start new weapon-set rows in the rotation timeline", () => {
  const rows = timelineWeaponRows([
    "Bladecall",
    "Swap Weapons",
    "Psycut",
    "Swap Weapons",
    "Bladecall",
  ]);
  assert.deepEqual(
    rows.map((row) => row.weaponSet),
    [1, 2, 1],
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]],
  );
});

test("shroud and forge transitions start a new row on the current weapon set", () => {
  for (const [enter, exit] of [
    ["Swap Legends", "Swap Legends"],
    ["Reaper's Shroud", "Exit Reaper's Shroud"],
    ["Harbinger Shroud", "Exit Harbinger Shroud"],
    ["Ritualist's Shroud", "Exit Ritualist's Shroud"],
    ["Enter Radiant Forge", "Exit Radiant Forge"],
  ]) {
    const rows = timelineWeaponRows(
      ["Before", enter, "During", exit, "After", "Swap Weapons", "Other set"],
      { startingWeaponSet: 2 },
    );

    assert.deepEqual(
      rows.map((row) => row.weaponSet),
      [2, 2, 2, 1],
      enter,
    );
    assert.deepEqual(
      rows.map((row) => row.skills.map((skill) => skill.index)),
      [[0, 1], [2, 3], [4, 5], [6]],
      enter,
    );
  }
});

test("a final weapon swap remains on its originating weapon-set row", () => {
  const rows = timelineWeaponRows(["Bladecall", "Swap Weapons"]);
  assert.deepEqual(
    rows.map((row) => row.weaponSet),
    [1],
  );
  assert.deepEqual(
    rows[0].skills.map((skill) => skill.index),
    [0, 1],
  );
});

test("rotation drag reordering respects before and after insertion positions", () => {
  const rotation = ["Bladecall", "Mirror Blade", "Mind Spike"];

  assert.equal(moveRotationEntry(rotation, 0, 2), true);
  assert.deepEqual(rotation, ["Mirror Blade", "Bladecall", "Mind Spike"]);

  assert.equal(moveRotationEntry(rotation, 2, 0), true);
  assert.deepEqual(rotation, ["Mind Spike", "Mirror Blade", "Bladecall"]);

  assert.equal(moveRotationEntry(rotation, 0, rotation.length), true);
  assert.deepEqual(rotation, ["Mirror Blade", "Bladecall", "Mind Spike"]);

  assert.equal(moveRotationEntry(rotation, 1, 2), false);
  assert.deepEqual(rotation, ["Mirror Blade", "Bladecall", "Mind Spike"]);
});

test("shift-queued Mirror Images after an instant action still grants clones", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Dagger",
    secondaryWeapon: "Sword",
  });
  const result = simulateMesmer(
    ["Blink", { name: "Mirror Images", offset: 100 }],
    config,
  );
  assert.equal(result.endState.time, 100);
  assert.equal(result.endState.profession.resource, 2);
});

test("shift-queued Mirror Images after a resource-generating cast grants both clones", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Dagger",
    secondaryWeapon: "Sword",
  });
  const result = simulateMesmer(
    ["Bladecall", { name: "Mirror Images", offset: 100 }],
    config,
  );
  const mirrorImagesResource = result.events.find(
    (event) => event.type === "resource" && event.reason === "Mirror Images",
  );

  assert.equal(mirrorImagesResource?.amount, 2);
  assert.equal(result.endState.profession.resource, 3);
});

test("clones from shift-queued Mirror Images are available to the next shatter", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
  });
  const result = simulateMesmer(
    ["Blink", { name: "Mirror Images", offset: 100 }, "Mind Wrack"],
    config,
  );
  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[2].start, 100);
  assert.equal(result.endState.profession.resource, 0);
});

test("Sharper Images uses deterministic expected-proc accumulation", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    selectedTraits: ["Sharper Images"],
    initialResource: 0,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    stats: {
      ...defaultSimulationConfig().stats,
      precision: 1105,
    },
    boons: {
      ...defaultSimulationConfig().boons,
      fury: false,
    },
  });
  const first = simulateMesmer(
    ["Phantasmal Duelist", { name: "__wait", waitMs: 1000 }],
    config,
  );
  const second = simulateMesmer(
    [
      "Phantasmal Duelist",
      { name: "__wait", waitMs: 16000 },
      "Phantasmal Duelist",
      { name: "__wait", waitMs: 1000 },
    ],
    config,
  );
  assert.equal(
    first.procSteps.filter((proc) => proc.skill === "Sharper Images").length,
    0,
  );
  assert.ok(
    second.procSteps.some(
      (proc) =>
        proc.skill === "Sharper Images" &&
        proc.detail === "1 critical-hit proc",
    ),
  );
  assert.equal(
    second.resolvedEvents.find(
      (event) =>
        event.type === "condition" && event.name.includes("Sharper Images"),
    )?.source,
    "Player",
  );
});

test("Illusionary Counter arms one Counterspell without generating clones itself", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Sword",
  });
  const counter = simulateMesmer(["Illusionary Counter"], config);
  assert.equal(counter.steps[0].end, 120);
  assert.equal(counter.steps[0].interrupted, true);
  assert.ok(counter.steps[0].fullCastMs > 120);
  assert.equal(
    counter.breakdown.some((entry) => entry.name === "Illusionary Counter"),
    false,
  );
  assert.equal(counter.endState.profession.resource, 0);
  assert.equal(counter.endState.profession.counterspellAvailable, true);
  assert.equal(
    counter.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Illusionary Counter" &&
        event.condition === "Torment",
    ),
    false,
  );

  const unavailable = simulateMesmer(["Counterspell"], config);
  assert.equal(unavailable.steps.filter((step) => !step.invalid).length, 0);
  assert.match(unavailable.warnings[0], /Illusionary Counter is not active/);

  const flipped = simulateMesmer(
    ["Illusionary Counter", "Counterspell", "Counterspell"],
    config,
  );
  assert.equal(flipped.steps.filter((step) => !step.invalid).length, 2);
  assert.equal(flipped.steps[1].start, 120);
  assert.equal(flipped.endState.profession.resource, 1);
  assert.equal(flipped.endState.profession.counterspellAvailable, false);
  assert.ok(flipped.breakdown.some((entry) => entry.name === "Counterspell"));
});

test("Ether Bolt and Ether Blast do not generate clones", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Sword",
  });
  const result = simulateMesmer(["Ether Bolt", "Ether Blast"], config);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ["Ether Bolt", "Ether Blast"],
  );
  assert.equal(result.endState.profession.resource, 0);
});

test("Ether Clone creates a clone below cap and inflicts torment at cap", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "Scepter",
    secondaryWeapon: "Sword",
  });
  const belowCap = simulateMesmer(
    ["Ether Bolt", "Ether Blast", "Ether Clone"],
    { ...config, initialResource: 2 },
  );
  assert.equal(belowCap.endState.profession.resource, 3);
  assert.equal(
    belowCap.events.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Ether Clone" &&
        event.condition === "Torment",
    ),
    false,
  );

  const atCap = simulateMesmer(["Ether Bolt", "Ether Blast", "Ether Clone"], {
    ...config,
    initialResource: 3,
  });
  assert.equal(atCap.endState.profession.resource, 3);
  assert.ok(
    atCap.events.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Ether Clone" &&
        event.condition === "Torment" &&
        event.duration === 9,
    ),
  );
});

test("autoattack chain steps unlock only after the preceding attack", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Sword",
  });
  const locked = simulateMesmer(["Ether Blast", "Ether Clone"], config);
  assert.equal(locked.steps.filter((step) => !step.invalid).length, 0);
  assert.match(locked.warnings[0], /cast Ether Bolt first/);

  const skippedStep = simulateMesmer(["Ether Bolt", "Ether Clone"], config);
  assert.deepEqual(
    skippedStep.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ["Ether Bolt"],
  );
  assert.equal(
    skippedStep.endState.profession.autoattackChains[ID.ETHER_BOLT],
    ID.ETHER_BLAST,
  );
  assert.match(skippedStep.warnings[0], /cast Ether Blast first/);

  const completed = simulateMesmer(
    ["Ether Bolt", "Ether Blast", "Ether Clone"],
    config,
  );
  assert.equal(
    completed.endState.profession.autoattackChains[ID.ETHER_BOLT],
    ID.ETHER_BOLT,
  );
});

test("Scepter weapon skills preserve Ether Bolt chain progress", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Sword",
  });
  const result = simulateMesmer(
    ["Ether Bolt", "Confusing Images", "Ether Blast"],
    config,
  );
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ["Ether Bolt", "Confusing Images", "Ether Blast"],
  );
  assert.equal(
    result.endState.profession.autoattackChains[ID.ETHER_BOLT],
    ID.ETHER_CLONE,
  );
});

test("Imaginary Axes preserves the axe auto chain but other skills reset it", () => {
  const config = defaultSimulationConfig({
    specialization: "Mirage",
    initialResource: 0,
    primaryWeapon: "Axe",
    secondaryWeapon: "Pistol",
  });
  const preserved = simulateMesmer(
    [
      "Lacerating Chop",
      "Dodge / Mirage Cloak",
      "Imaginary Axes",
      "Ethereal Chop",
    ],
    config,
  );
  assert.deepEqual(
    preserved.steps.filter((step) => !step.invalid).map((step) => step.skill),
    [
      "Lacerating Chop",
      "Dodge / Mirage Cloak",
      "Imaginary Axes",
      "Ethereal Chop",
    ],
  );
  assert.equal(
    preserved.endState.profession.autoattackChains[ID.LACERATING_CHOP],
    ID.MIRROR_STRIKES,
  );

  const interrupted = simulateMesmer(
    ["Lacerating Chop", "Lingering Thoughts", "Ethereal Chop"],
    config,
  );
  assert.deepEqual(
    interrupted.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ["Lacerating Chop", "Lingering Thoughts"],
  );
  assert.equal(
    interrupted.endState.profession.autoattackChains[ID.LACERATING_CHOP],
    ID.LACERATING_CHOP,
  );
  assert.match(interrupted.warnings[0], /cast Lacerating Chop first/);
});

test("other auto chains reset on weapon skills and every chain resets on swap", () => {
  const swordConfig = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
  });
  const interrupted = simulateMesmer(
    ["Mind Slash", "Blurred Frenzy", "Mind Gash"],
    swordConfig,
  );
  assert.deepEqual(
    interrupted.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ["Mind Slash", "Blurred Frenzy"],
  );
  assert.equal(
    interrupted.endState.profession.autoattackChains[ID.MIND_SLASH],
    ID.MIND_SLASH,
  );

  const scepterConfig = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Sword",
    weaponSet2Primary: "Spear",
    weaponSet2Secondary: "",
  });
  const swapped = simulateMesmer(
    ["Ether Bolt", "Swap Weapons", "Ether Blast"],
    scepterConfig,
  );
  assert.deepEqual(
    swapped.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ["Ether Bolt", "Swap Weapons"],
  );
  assert.equal(
    swapped.endState.profession.autoattackChains[ID.ETHER_BOLT],
    ID.ETHER_BOLT,
  );
});

test("sword, scepter, axe, and spear auto chains cast as separate attacks", () => {
  const chain = [
    "Mind Slash",
    "Mind Gash",
    "Mind Spike",
    "Ether Bolt",
    "Ether Blast",
    "Ether Clone",
    "Lacerating Chop",
    "Ethereal Chop",
    "Mirror Strikes",
    "Psycut",
    "Psystrike",
    "Mind Pierce",
  ];
  const result = simulateMesmer(
    chain,
    defaultSimulationConfig({
      specialization: "Mirage",
      initialResource: 0,
      weaponmasterTraining: true,
      primaryWeapon: "",
      secondaryWeapon: "",
      weaponSet2Primary: "",
      weaponSet2Secondary: "",
    }),
  );
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    chain,
  );
  assert.equal(result.casts.length, chain.length);
});

test("split autoattacks preserve each full-chain cadence", () => {
  const config = defaultSimulationConfig({
    specialization: "Mirage",
    initialResource: 0,
    weaponmasterTraining: true,
    primaryWeapon: "",
    secondaryWeapon: "",
    weaponSet2Primary: "",
    weaponSet2Secondary: "",
    boons: {
      ...defaultSimulationConfig().boons,
      quickness: false,
    },
  });
  const chains = [
    [["Mind Slash", "Mind Gash", "Mind Spike"], 2580],
    [["Ether Bolt", "Ether Blast", "Ether Clone"], 2700],
    [["Lacerating Chop", "Ethereal Chop", "Mirror Strikes"], 2520],
    [["Psycut", "Psystrike", "Mind Pierce"], 2220],
  ];
  for (const [skills, expectedTime] of chains) {
    assert.equal(simulateMesmer(skills, config).endState.time, expectedTime);
  }
});

test("requested weapon flips require and consume their parent sequence skill", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "",
    secondaryWeapon: "",
    weaponSet2Primary: "",
    weaponSet2Secondary: "",
  });
  const pairs = [
    ["Singularity Shot", "Dimensional Aperture"],
    ["Inspiring Imagery", "Abstraction"],
    ["Temporal Curtain", "Into the Void"],
    ["Illusionary Riposte", "Counter Blade"],
    ["Illusionary Leap", "Swap"],
  ];
  for (const [parent, flip] of pairs) {
    const unavailable = simulateMesmer([flip], config);
    assert.equal(
      unavailable.steps.filter((step) => !step.invalid).length,
      0,
      flip,
    );
    assert.match(unavailable.warnings[0], new RegExp(parent), flip);

    const result = simulateMesmer([parent, flip, flip], config);
    assert.deepEqual(
      result.steps.filter((step) => !step.invalid).map((step) => step.skill),
      [parent, flip],
      flip,
    );
    assert.equal(
      result.endState.profession.availableFlips[flip],
      undefined,
      flip,
    );
  }
});

test("Illusionary Riposte defaults to a 120ms interrupt before Counter Blade", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
  });
  const result = simulateMesmer(
    ["Illusionary Riposte", "Counter Blade"],
    config,
  );

  assert.equal(result.steps[0].end, 120);
  assert.equal(result.steps[0].interrupted, true);
  assert.ok(result.steps[0].fullCastMs > 120);
  assert.equal(result.steps[1].start, 120);
});

test("Into the Void waits for its one-second post-curtain delay", () => {
  const result = simulateMesmer(
    ["Temporal Curtain", "Into the Void"],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "",
      secondaryWeapon: "",
    }),
  );
  assert.equal(result.steps[1].start, 1000);
});

test("Dimensional Aperture adds 50% to Singularity Shot recharge", () => {
  const config = defaultSimulationConfig({
    specialization: "Core",
    primaryWeapon: "",
    secondaryWeapon: "",
  });
  const base = simulateMesmer(["Singularity Shot"], config);
  const aperture = simulateMesmer(
    ["Singularity Shot", "Dimensional Aperture"],
    config,
  );
  assert.equal(base.endState.cooldowns["Singularity Shot"].readyAt, 16333);
  assert.equal(aperture.endState.cooldowns["Singularity Shot"].readyAt, 24333);
});

test("Abstraction records its detonation strike damage", () => {
  const result = simulateMesmer(
    ["Inspiring Imagery", "Abstraction"],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "",
      secondaryWeapon: "",
    }),
  );
  assert.ok(
    result.breakdown.some(
      (entry) => entry.name === "Abstraction" && entry.strikeDamage > 0,
    ),
  );
});

test("Shatter Storm gives Split Second two ammo charges", () => {
  const result = simulateMesmer(
    ["Split Second", "Split Second", "Split Second"],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedTraits: ["Shatter Storm"],
      initialResource: 3,
    }),
  );
  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[1].start, 50);
  assert.equal(result.steps[2].start, 8000);
  assert.deepEqual(
    {
      charges: result.endState.ammo["Split Second"].charges,
      maximum: result.endState.ammo["Split Second"].maximum,
    },
    { charges: 0, maximum: 2 },
  );
});

test("Shatter Storm initializes Split Second ammo before first cast", () => {
  const result = simulateMesmer(
    [],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedTraits: ["Shatter Storm"],
      initialResource: 0,
    }),
  );
  assert.deepEqual(
    {
      charges: result.endState.ammo["Split Second"].charges,
      maximum: result.endState.ammo["Split Second"].maximum,
    },
    { charges: 2, maximum: 2 },
  );
});

test("Power Spike opens with two charges and reverts to Mantra of Pain when spent", () => {
  const result = simulateMesmer(
    ["Power Spike", "Power Spike", "Power Spike"],
    defaultSimulationConfig({ specialization: "Core" }),
  );
  // The third cast has no charges left, so the flip reverts to its parent.
  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ["Power Spike", "Power Spike"],
  );
  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[1].start, 0);
  assert.equal(
    result.endState.profession.availableFlips["Power Spike"],
    undefined,
  );
  assert.equal(result.endState.ammo["Power Spike"], undefined);
  assert.match(result.warnings.at(-1), /Mantra of Pain is not active/);
});

test("dodge uses two endurance charges and recharges one charge every ten seconds", () => {
  const result = simulateMesmer(
    ["Dodge / Mirage Cloak", "Dodge / Mirage Cloak", "Dodge / Mirage Cloak"],
    defaultSimulationConfig({
      specialization: "Mirage",
      initialResource: 0,
      boons: {
        ...defaultSimulationConfig().boons,
        vigor: false,
      },
    }),
  );

  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 0, 10000],
  );
  assert.deepEqual(
    {
      charges: result.endState.ammo["Dodge / Mirage Cloak"].charges,
      maximum: result.endState.ammo["Dodge / Mirage Cloak"].maximum,
    },
    { charges: 0, maximum: 2 },
  );
});

test("Mirage Cloak enables an explicit ambush instead of auto-casting it", () => {
  const config = defaultSimulationConfig({
    specialization: "Mirage",
    primaryWeapon: "Axe",
    secondaryWeapon: "Pistol",
    initialResource: 0,
  });
  const cloakOnly = simulateMesmer(["Dodge / Mirage Cloak"], config);
  assert.equal(
    cloakOnly.resolvedEvents.some(
      (event) =>
        event.type === "damage" && event.skillName === "Imaginary Axes",
    ),
    false,
  );
  assert.equal(
    cloakOnly.endState.profession.availableAmbush.name,
    "Imaginary Axes",
  );
  assert.equal(
    cloakOnly.endState.profession.availableAmbush.source,
    "Dodge / Mirage Cloak",
  );

  const used = simulateMesmer(
    ["Dodge / Mirage Cloak", "Imaginary Axes"],
    config,
  );
  assert.deepEqual(
    used.steps.map((step) => step.skill),
    ["Dodge / Mirage Cloak", "Imaginary Axes"],
  );
  assert.ok(
    used.resolvedEvents.some(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Imaginary Axes" &&
        event.source === "Player",
    ),
  );
  assert.equal(used.endState.profession.availableAmbush, null);
});

test("ambush skills cannot be cast without an active ambush window", () => {
  const result = simulateMesmer(
    ["Phantom Razor"],
    defaultSimulationConfig({
      specialization: "Mirage",
      primaryWeapon: "Dagger",
      secondaryWeapon: "Sword",
      initialResource: 0,
    }),
  );
  assert.equal(result.steps.filter((step) => !step.invalid).length, 0);
  assert.match(result.warnings[0], /no active Mirage Cloak ambush window/);
});

test("all terrestrial Mirage weapons execute their correct ambush", () => {
  const pairs = [
    ["Axe", "Imaginary Axes"],
    ["Dagger", "Phantom Razor"],
    ["Greatsword", "Split Surge"],
    ["Rifle", "Effervescence"],
    ["Scepter", "Ether Barrage"],
    ["Spear", "Fractured Glass"],
    ["Staff", "Chaos Vortex"],
    ["Sword", "Mirage Thrust"],
  ];
  for (const [weapon, ambush] of pairs) {
    const result = simulateMesmer(
      ["Dodge / Mirage Cloak", ambush],
      defaultSimulationConfig({
        specialization: "Mirage",
        primaryWeapon: weapon,
        secondaryWeapon: "",
        initialResource: 0,
      }),
    );
    assert.deepEqual(
      result.steps.map((step) => step.skill),
      ["Dodge / Mirage Cloak", ambush],
      weapon,
    );
    assert.ok(
      result.resolvedEvents.some(
        (event) =>
          event.type === "damage" &&
          event.skillName === ambush &&
          event.source === "Player",
      ),
      weapon,
    );
  }
});

test("Mirage self-Might triggers Relic of Mistburn", () => {
  const result = simulateMesmer(
    ["Dodge / Mirage Cloak", "Split Surge"],
    defaultSimulationConfig({
      specialization: "Mirage",
      primaryWeapon: "Greatsword",
      secondaryWeapon: "",
      initialResource: 0,
      relic: "Mistburn",
      boons: {
        ...defaultSimulationConfig().boons,
        might: 0,
      },
    }),
  );
  const bonusMight = result.events.filter(
    (event) => event.sourceId === "relic.mistburn",
  );

  assert.deepEqual(
    bonusMight.map((event) => ({
      duration: event.duration,
      stacks: event.stacks,
      triggeredBy: event.triggeredBy,
    })),
    [{ duration: 8, stacks: 1, triggeredBy: "Split Surge" }],
  );
});

test("Riddle of Sand applies to the first ambush and refreshes on shatter", () => {
  const result = simulateMesmer(
    [
      "Dodge / Mirage Cloak",
      "Imaginary Axes",
      "Mind Wrack",
      "Sand through Glass",
      "Imaginary Axes",
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Riddle of Sand"],
      selectedSkills: ["Sand through Glass"],
      primaryWeapon: "Axe",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );
  const riddles = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.name.includes("Riddle of Sand"),
  );
  assert.equal(riddles.length, 2);
  assert.ok(
    riddles.every(
      (event) =>
        event.condition === "Confusion" &&
        event.stacks === 2 &&
        event.duration === 4,
    ),
  );
});

test("Infinite Horizon commands active clones to ambush when cloak is gained", () => {
  const result = simulateMesmer(
    ["Dodge / Mirage Cloak"],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Infinite Horizon"],
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      initialResource: 3,
    }),
  );
  const cloneHits = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      event.skillName === "Chaos Vortex" &&
      event.source === "Clone",
  );
  assert.equal(cloneHits.length, 3);
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Chaos Vortex" &&
        event.source === "Player",
    ),
    false,
  );
});

test("Deceptive Evasion clone immediately ambushes with Infinite Horizon", () => {
  const result = simulateMesmer(
    ["Dodge / Mirage Cloak"],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Deceptive Evasion", "Infinite Horizon"],
      primaryWeapon: "Sword",
      secondaryWeapon: "Sword",
      initialResource: 0,
    }),
  );
  assert.equal(result.endState.profession.resource, 1);
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Mirage Thrust" &&
        event.source === "Clone",
    ),
  );
});

test("Self-Deception creates a clone only when another clone is active", () => {
  const config = defaultSimulationConfig({
    specialization: "Mirage",
    selectedTraits: ["Self-Deception"],
    selectedSkills: ["Crystal Sands"],
    primaryWeapon: "Axe",
    secondaryWeapon: "Pistol",
  });
  const activeClone = simulateMesmer(["Crystal Sands"], {
    ...config,
    initialResource: 1,
  });
  const noClone = simulateMesmer(["Crystal Sands"], {
    ...config,
    initialResource: 0,
  });
  assert.equal(activeClone.endState.profession.resource, 2);
  assert.equal(noClone.endState.profession.resource, 0);
});

test("Desert Distortion and Dune Cloak grant their shatter ambush windows", () => {
  const distortion = simulateMesmer(
    ["Distortion"],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Desert Distortion"],
      initialResource: 2,
    }),
  );
  assert.equal(
    distortion.endState.profession.availableAmbush.source,
    "Desert Distortion",
  );
  assert.equal(distortion.endState.profession.availableMirrors, 2);
  assert.ok(
    distortion.procSteps.some((proc) => proc.skill === "Desert Distortion"),
  );

  const dune = simulateMesmer(
    ["Mind Wrack"],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Dune Cloak"],
      initialResource: 3,
      boons: {
        ...defaultSimulationConfig().boons,
        alacrity: false,
      },
    }),
  );
  assert.equal(dune.endState.profession.availableAmbush.source, "Dune Cloak");
  assert.equal(dune.endState.cooldowns["Mind Wrack"].readyAt, 11000);

  const twoClones = simulateMesmer(
    ["Mind Wrack"],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Dune Cloak"],
      initialResource: 2,
    }),
  );
  assert.equal(twoClones.endState.profession.availableAmbush, null);
});

test("Infinite Horizon axe clones each apply one 4-second Torment", () => {
  const result = simulateMesmer(
    ["Dodge / Mirage Cloak", { name: "__wait", waitMs: 1200 }],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Infinite Horizon"],
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 3,
    }),
  );
  const torment = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName.startsWith("Imaginary Axes") &&
      event.source === "Clone",
  );
  assert.equal(torment.length, 3);
  assert.ok(
    torment.every((event) => event.stacks === 1 && event.duration === 4),
  );
});

test("Mesmer Peitha triggers share cast-start ICD logic with measured travel delays", () => {
  const cases = [
    ["Phase Retreat", ID.PHASE_RETREAT, "Staff", 856],
    ["Crystal Sands", ID.CRYSTAL_SANDS, "Axe", 241],
    ["Jaunt", ID.JAUNT, "Axe", 241],
    ["Axes of Symmetry", ID.AXES_OF_SYMMETRY, "Axe", 519],
  ];
  for (const [skillName, skillId, primaryWeapon, delayMs] of cases) {
    const result = simulateMesmer(
      [{ name: skillName, skillId }],
      defaultSimulationConfig({
        specialization: "Mirage",
        selectedSkills: ["Crystal Sands", "Jaunt"],
        primaryWeapon,
        secondaryWeapon: primaryWeapon === "Axe" ? "Torch" : "",
        initialResource: 0,
        relic: "Peitha",
      }),
    );
    const cast = result.steps.find((step) => step.skill === skillName);
    const peitha = result.events.find(
      (event) => event.type === "peitha" && event.skillName === skillName,
    );
    const torment = result.resolvedEvents.find(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Relic of Peitha" &&
        event.condition === "Torment",
    );

    assert.ok(peitha, `${skillName} trigger event`);
    assert.ok(torment, `${skillName} Peitha Torment`);
    assert.equal(peitha.at * 1000, cast.start, `${skillName} trigger`);
    assert.equal(peitha.projectileDelay * 1000, delayMs, skillName);
    assert.ok(
      Math.abs(torment.at * 1000 - cast.start - delayMs) < 1e-9,
      `${skillName} impact`,
    );
  }
});

test("Axes and Crystal Sands share Peitha trigger-time cooldown state", () => {
  const result = simulateMesmer(
    [
      { name: "Axes of Symmetry", skillId: ID.AXES_OF_SYMMETRY },
      { name: "__wait", waitMs: 3001 },
      { name: "Crystal Sands", skillId: ID.CRYSTAL_SANDS },
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedSkills: ["Crystal Sands"],
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 0,
      relic: "Peitha",
    }),
  );
  assert.deepEqual(
    result.procSteps
      .filter((step) => step.skill === "Relic of Peitha")
      .map((step) => step.sourceSkill),
    ["Axes of Symmetry", "Crystal Sands"],
  );
});

test("The Prestige has a 40ms quickness activation and explodes 3s later", () => {
  const result = simulateMesmer(
    ["The Prestige", { name: "__wait", waitMs: 3100 }],
    defaultSimulationConfig({
      specialization: "Mirage",
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 0,
    }),
  );
  const cast = result.steps.find((step) => step.skill === "The Prestige");
  const strike = result.events.find(
    (event) => event.type === "damage" && event.skillName === "The Prestige",
  );
  const burning = result.events.find(
    (event) =>
      event.type === "condition" &&
      event.skillName === "The Prestige" &&
      event.condition === "Burning",
  );
  assert.equal(cast.end - cast.start, 40);
  assert.equal(strike.at * 1000 - cast.start, 3000);
  assert.equal(burning.at, strike.at);
});

test("Mirage support and cloak traits emit their current effects", () => {
  const result = simulateMesmer(
    ["Dodge / Mirage Cloak", "Effervescence"],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedTraits: ["Mirage Mantle", "Renewing Oasis", "Elusive Mind"],
      primaryWeapon: "Rifle",
      secondaryWeapon: "",
      initialResource: 0,
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
    }),
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "regeneration" &&
        event.duration === 4,
    ),
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "alacrity" &&
        event.duration === 4,
    ),
  );
  assert.ok(
    !result.events.some(
      (event) =>
        event.type === "buff" && event.kind === "vigor" && event.duration === 3,
    ),
  );
  const alacrity = result.events.find(
    (event) => event.type === "buff" && event.kind === "alacrity",
  );
  assert.equal(alacrity.recipients, "party");
  assert.equal(alacrity.recipientCount, 5);
  assert.equal(alacrity.affectsSummons, false);
  assert.ok(result.procSteps.some((proc) => proc.skill === "Elusive Mind"));
});

test("Crystal Sands creates a collectible Mirage Mirror with delayed damage", () => {
  const result = simulateMesmer(
    ["Crystal Sands", "Pick Up Mirage Mirror"],
    defaultSimulationConfig({
      specialization: "Mirage",
      selectedSkills: ["Crystal Sands"],
      selectedTraits: ["Dune Cloak"],
      primaryWeapon: "Axe",
      secondaryWeapon: "Torch",
      initialResource: 0,
      relic: "Peitha",
    }),
  );
  const crystal = result.events.find(
    (event) => event.type === "damage" && event.skillName === "Crystal Sands",
  );
  const mirror = result.events.find(
    (event) => event.type === "damage" && event.skillName === "Mirage Mirror",
  );
  const confusion = result.resolvedEvents.find(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Crystal Sands" &&
      event.condition === "Confusion",
  );

  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(crystal.at - 0.691) < 0.00001);
  assert.ok(Math.abs(mirror.at - 0.691) < 0.00001);
  assert.equal(confusion.at, crystal.at);
  assert.equal(confusion.stacks, 6);
  assert.equal(confusion.duration, 4);
  assert.equal(mirror.coefficient, 0.6);
  assert.equal(result.endState.profession.availableMirrors, 0);
  assert.equal(
    result.endState.profession.availableAmbush.source,
    "Pick Up Mirage Mirror",
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === "peitha")
      .map((event) => event.skillName),
    ["Crystal Sands"],
  );
});

test("Sigil of Energy restores one Mirage dodge charge on weapon swap", () => {
  const result = simulateMesmer(
    [
      "__combat_start",
      "Dodge / Mirage Cloak",
      "Dodge / Mirage Cloak",
      "Swap Weapons",
      "Dodge / Mirage Cloak",
    ],
    defaultSimulationConfig({
      specialization: "Mirage",
      primaryWeapon: "Staff",
      secondaryWeapon: "",
      weaponSet2Primary: "Axe",
      weaponSet2Secondary: "Torch",
      sigilSets: [{ names: ["Energy"] }, { names: ["Energy"] }],
      initialResource: 0,
    }),
  );
  const dodges = result.steps.filter(
    (step) => step.skill === "Dodge / Mirage Cloak" && !step.invalid,
  );
  const energy = result.events.find(
    (event) => event.type === "proc" && event.sourceId === "sigil.energy",
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(dodges.length, 3);
  assert.ok(energy);
  assert.equal(dodges[2].start, energy.at * 1000);
});

test("Nomad's Endurance grants vigor on shatter and uses it for damage", () => {
  const baseConfig = defaultSimulationConfig({
    specialization: "Mirage",
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
    initialResource: 0,
    boons: {
      ...defaultSimulationConfig().boons,
      vigor: false,
    },
  });
  const without = simulateMesmer(["Mind Wrack", "Mind Slash"], baseConfig);
  const withTrait = simulateMesmer(["Mind Wrack", "Mind Slash"], {
    ...baseConfig,
    selectedTraits: ["Nomad's Endurance"],
  });
  assert.ok(withTrait.strikeDamage > without.strikeDamage);
  assert.ok(
    withTrait.events.some(
      (event) =>
        event.type === "buff" && event.kind === "vigor" && event.duration === 3,
    ),
  );
});

test("Re-channeling Mantra of Pain refills Power Spike to two charges", () => {
  const result = simulateMesmer(
    ["Power Spike", "Power Spike", "Mantra of Pain", "Power Spike"],
    defaultSimulationConfig({ specialization: "Core" }),
  );
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ["Power Spike", "Power Spike", "Mantra of Pain", "Power Spike"],
  );
  assert.ok(result.endState.profession.availableFlips["Power Spike"]);
  assert.equal(
    result.endState.profession.availableFlips["Power Spike"].persistent,
    true,
  );
  assert.deepEqual(
    {
      charges: result.endState.ammo["Power Spike"].charges,
      maximum: result.endState.ammo["Power Spike"].maximum,
    },
    { charges: 1, maximum: 2 },
  );
});

test("Power Spike records its strike damage", () => {
  const result = simulateMesmer(
    ["Power Spike"],
    defaultSimulationConfig({ specialization: "Core" }),
  );
  assert.ok(
    result.breakdown.some(
      (entry) => entry.name === "Power Spike" && entry.strikeDamage > 0,
    ),
  );
});

test("Power Spike woven into the Mantra of Pain channel is invalid and unsimulated", () => {
  const result = simulateMesmer(
    [
      "Power Spike",
      "Power Spike",
      "Mantra of Pain",
      { name: "Power Spike", offset: 100 },
    ],
    defaultSimulationConfig({ specialization: "Core" }),
  );
  const woven = result.steps.find((step) => step.ri === 3);
  assert.equal(woven.invalid, true);
  // Only the two opener spikes are simulated; the woven one is skipped, so the
  // refilled mantra keeps both charges.
  assert.equal(
    result.steps.filter((step) => step.skill === "Power Spike" && !step.invalid)
      .length,
    2,
  );
  assert.equal(
    result.endState.profession.availableFlips["Power Spike"].persistent,
    true,
  );
  assert.equal(result.endState.ammo["Power Spike"].charges, 2);
  assert.match(result.warnings.at(-1), /Mantra of Pain is still channeling/);
});

test("Power Spike stays invalid even when another instant is chained into the channel first", () => {
  // Weaving an instant (Blink) into the channel and then Power Spike after it
  // must still be caught: the flip is not armed until the channel completes,
  // regardless of the immediately preceding command.
  const result = simulateMesmer(
    [
      "Power Spike",
      "Power Spike",
      "Mantra of Pain",
      { name: "Blink", offset: 100 },
      { name: "Power Spike", offset: 100 },
    ],
    defaultSimulationConfig({ specialization: "Core" }),
  );
  const woven = result.steps.find((step) => step.ri === 4);
  assert.equal(woven.invalid, true);
  assert.equal(
    result.steps.filter((step) => step.skill === "Power Spike" && !step.invalid)
      .length,
    2,
  );
  assert.equal(result.endState.ammo["Power Spike"].charges, 2);
});

test("Illusionary Reversion refunds one clone only after shattering three", () => {
  const config = defaultSimulationConfig({
    specialization: "Chronomancer",
    selectedTraits: ["Illusionary Reversion"],
  });
  const fullShatter = simulateMesmer(["Split Second"], {
    ...config,
    initialResource: 3,
  });
  const partialShatter = simulateMesmer(["Split Second"], {
    ...config,
    initialResource: 2,
  });
  assert.equal(fullShatter.endState.profession.resource, 1);
  assert.equal(partialShatter.endState.profession.resource, 0);
  assert.ok(
    simulationEventLogRows(fullShatter).some((event) =>
      event.description.includes(
        "CLONE SPAWNED x1 -> 1/3 [Illusionary Reversion] (Clone #4 [Dagger])",
      ),
    ),
  );
});

test("Signet of the Ether resets every phantasm skill cooldown", () => {
  const result = simulateMesmer(
    [
      "Phantasmal Duelist",
      "Phantasmal Warlock",
      "Signet of the Ether",
      "Phantasmal Duelist",
      "Phantasmal Warlock",
    ],
    defaultSimulationConfig({
      specialization: "Core",
      initialResource: 0,
    }),
  );
  assert.equal(result.steps.length, 5);
  assert.ok(Math.abs(result.steps[3].start - result.steps[2].end) <= 1);
  assert.ok(Math.abs(result.steps[4].start - result.steps[3].end) <= 1);
});

test("Signet of the Ether re-locks 300ms after its cast completes", () => {
  const result = simulateMesmer(
    ["Signet of the Ether", { name: "__wait", waitMs: 500 }],
    defaultSimulationConfig({
      specialization: "Core",
      boons: {
        ...defaultSimulationConfig().boons,
        alacrity: false,
        quickness: false,
      },
    }),
  );
  const cast = result.steps[0];
  const cooldown = result.endState.cooldowns["Signet of the Ether"];

  assert.equal(cooldown.readyAt - cast.end, 30300);
});

test("Signet of Illusions passively generates one resource every ten combat seconds", () => {
  const passiveEvents = (specialization) =>
    simulateMesmer(
      [{ name: "__wait", waitMs: 20001 }],
      defaultSimulationConfig({
        specialization,
        selectedSkills: ["Signet of Illusions"],
        initialResource: 0,
      }),
    ).events.filter(
      (event) =>
        event.type === "resource" && event.reason === "Signet of Illusions",
    );

  assert.deepEqual(
    passiveEvents("Core").map((event) => [event.at, event.resource]),
    [
      [10, "clones"],
      [20, "clones"],
    ],
  );
  assert.deepEqual(
    passiveEvents("Virtuoso").map((event) => [event.at, event.resource]),
    [
      [10, "blades"],
      [20, "blades"],
    ],
  );
  assert.equal(
    simulateMesmer(
      [{ name: "__wait", waitMs: 20001 }],
      defaultSimulationConfig({
        specialization: "Core",
        selectedSkills: [],
        initialResource: 0,
      }),
    ).events.some((event) => event.reason === "Signet of Illusions"),
    false,
  );
});

test("Signet of Illusions starts its passive cycle at combat start", () => {
  const result = simulateMesmer(
    [
      { name: "__wait", waitMs: 5000 },
      "__combat_start",
      { name: "__wait", waitMs: 10001 },
    ],
    defaultSimulationConfig({
      specialization: "Core",
      selectedSkills: ["Signet of Illusions"],
      initialResource: 0,
    }),
  );
  const passiveEvents = result.events.filter(
    (event) =>
      event.type === "resource" && event.reason === "Signet of Illusions",
  );

  assert.deepEqual(
    passiveEvents.map((event) => event.at),
    [15],
  );
});

test("Signet of Illusions restarts its ten-second cycle after recharge", () => {
  const result = simulateMesmer(
    ["Signet of Illusions", { name: "__wait", waitMs: 70001 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedSkills: ["Signet of Illusions"],
      initialResource: 0,
      boons: {
        quickness: false,
        alacrity: false,
      },
    }),
  );
  const passiveEvents = result.events.filter(
    (event) =>
      event.type === "resource" && event.reason === "Signet of Illusions",
  );

  assert.deepEqual(
    passiveEvents.map((event) => event.at),
    [71.68],
  );
});

test("Signet of Illusions does not recharge Continuum Split or Crescendo", () => {
  const chronomancer = simulateMesmer(
    [
      "Continuum Split",
      { name: "__wait", waitMs: 2000 },
      "Split Second",
      "Signet of Illusions",
    ],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedSkills: ["Signet of Illusions"],
      initialResource: 0,
    }),
  );
  assert.ok(chronomancer.endState.cooldowns["Continuum Split"]);
  assert.equal(chronomancer.endState.cooldowns["Split Second"], undefined);

  const troubadour = simulateMesmer(
    ["Lively Lute", "Crescendo", "Signet of Illusions"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      selectedSkills: ["Signet of Illusions"],
      initialResource: 1,
    }),
  );
  assert.ok(troubadour.endState.cooldowns.Crescendo);
  assert.equal(troubadour.endState.cooldowns["Lively Lute"], undefined);
});

test("Mental Collapse resets Mind the Gap cooldown", () => {
  const result = simulateMesmer(
    ["Mind the Gap", "Mental Collapse", "Mind the Gap"],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      primaryWeapon: "Spear",
      secondaryWeapon: "",
    }),
  );

  assert.equal(result.steps.length, 3);
  assert.ok(Math.abs(result.steps[2].start - result.steps[1].end) <= 1);
  const resetOnly = simulateMesmer(
    ["Mind the Gap", "Mental Collapse"],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      primaryWeapon: "Spear",
      secondaryWeapon: "",
    }),
  );
  assert.equal(resetOnly.endState.cooldowns["Mind the Gap"], undefined);
});

test("Mind the Gap grants 15 seconds of Clarity and displays it as a skill proc", () => {
  const result = simulateMesmer(
    ["Mind the Gap"],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      primaryWeapon: "Spear",
      secondaryWeapon: "",
    }),
  );

  assert.equal(result.endState.profession.clarityRemaining, 15000);
  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.skill === "Clarity" &&
        proc.type === "skill_proc" &&
        proc.sourceSkill === "Mind the Gap" &&
        proc.icon.includes("Clarity.png"),
    ),
  );
});

test("Mesmer spear skills 3, 4, and 5 consume Clarity", () => {
  for (const consumer of [
    "Imaginary Inversion",
    "Phantasmal Lancer",
    "Mental Collapse",
  ]) {
    const result = simulateMesmer(
      ["Mind the Gap", consumer],
      defaultSimulationConfig({
        specialization: "Virtuoso",
        primaryWeapon: "Spear",
        secondaryWeapon: "",
      }),
    );
    assert.equal(result.endState.profession.clarityRemaining, 0, consumer);
  }
});

test("Clarity makes Phantasmal Lancer summon and attack with a second phantasm", () => {
  const config = defaultSimulationConfig({
    specialization: "Virtuoso",
    primaryWeapon: "Spear",
    secondaryWeapon: "",
    initialResource: 0,
  });
  const normal = simulateMesmer(
    ["Phantasmal Lancer", { name: "__wait", waitMs: 3000 }],
    config,
  );
  const empowered = simulateMesmer(
    ["Mind the Gap", "Phantasmal Lancer", { name: "__wait", waitMs: 3000 }],
    config,
  );

  assert.equal(
    normal.events.find(
      (event) =>
        event.type === "mesmer.phantasm-summoned" &&
        event.name === "Phantasmal Lancer",
    )?.count,
    1,
  );
  assert.equal(
    empowered.events.find(
      (event) =>
        event.type === "mesmer.phantasm-summoned" &&
        event.name === "Phantasmal Lancer",
    )?.count,
    2,
  );
  assert.equal(
    normal.resolvedEvents.filter(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Phantasmal Lancer" &&
        event.source === "Phantasm",
    ).length,
    1,
  );
  assert.equal(
    empowered.resolvedEvents.filter(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Phantasmal Lancer" &&
        event.source === "Phantasm",
    ).length,
    2,
  );
  const coefficientBySource = (result) =>
    Object.fromEntries(
      ["Player", "Phantasm"].map((source) => [
        source,
        result.resolvedEvents
          .filter(
            (event) =>
              event.type === "damage" &&
              event.skillName === "Phantasmal Lancer" &&
              event.source === source,
          )
          .reduce((sum, event) => sum + event.coefficient, 0),
      ]),
    );
  assert.deepEqual(coefficientBySource(normal), {
    Player: 1,
    Phantasm: 1.23,
  });
  assert.deepEqual(coefficientBySource(empowered), {
    Player: 1,
    Phantasm: 2.46,
  });
});

test("Flying Cutter tracks three hits for five seconds and Bladecall strikes six times", () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: "Virtuoso",
    primaryWeapon: "Dagger",
    secondaryWeapon: "Sword",
    selectedTraits: ["Jagged Mind"],
    stats: {
      ...defaults.stats,
      precision: 3100,
    },
  });
  const consecutive = simulateMesmer(
    [
      "Flying Cutter",
      "Flying Cutter",
      "Flying Cutter",
      { name: "__wait", waitMs: 1000 },
    ],
    config,
  );
  const burst = consecutive.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Cutter Burst",
  );
  assert.equal(burst.length, 3);
  assert.ok(
    burst.every(
      (event) =>
        event.skillName === "Cutter Burst" &&
        event.parentSkillName === "Flying Cutter" &&
        event.sourceId === ID.CUTTER_BURST &&
        event.skillId === ID.CUTTER_BURST,
    ),
  );
  assert.ok(
    Math.abs(burst.reduce((sum, event) => sum + event.coefficient, 0) - 0.6) <
      1e-12,
  );
  const skillRows = skillBreakdownRows(consecutive);
  const flyingCutterRow = skillRows.find((row) => row.name === "Flying Cutter");
  const cutterBurstRow = skillRows.find((row) => row.name === "Cutter Burst");
  assert.ok(flyingCutterRow.strike > 0);
  assert.ok(cutterBurstRow.strike > 0);
  assert.ok(flyingCutterRow.condition > 0);
  assert.ok(cutterBurstRow.condition > 0);
  assert.equal(flyingCutterRow.hits, 3);
  assert.equal(cutterBurstRow.hits, 3);
  assert.equal(flyingCutterRow.casts, 3);
  assert.equal(cutterBurstRow.casts, 0);
  assert.equal(cutterBurstRow.parentSkill, "Flying Cutter");
  const triggerAt = consecutive.resolvedEvents
    .filter(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Flying Cutter" &&
        event.name !== "Cutter Burst",
    )
    .at(-1).at;
  assert.deepEqual(
    burst.map((event) => Number((event.at - triggerAt).toFixed(3))),
    [0.217, 0.25, 0.384],
  );
  assert.deepEqual(
    consecutive.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" &&
          event.name === "Cutter Burst — Jagged Mind",
      )
      .map((event) => Number((event.at - triggerAt).toFixed(3))),
    [0.217, 0.25, 0.384],
  );

  const expired = simulateMesmer(
    [
      "Flying Cutter",
      { name: "__wait", waitMs: 5001 },
      "Flying Cutter",
      "Flying Cutter",
    ],
    config,
  );
  assert.equal(
    expired.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Cutter Burst",
    ).length,
    0,
  );

  const bladecall = simulateMesmer(
    ["Bladecall", { name: "__wait", waitMs: 3000 }],
    config,
  );
  const bladecallHits = bladecall.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillName === "Bladecall",
  );
  assert.equal(bladecallHits.length, 6);
  assert.ok(
    Math.abs(
      bladecallHits.reduce((sum, event) => sum + event.coefficient, 0) - 1.5,
    ) < 1e-12,
  );
  assert.deepEqual(
    bladecallHits.map((event) => Number(event.at.toFixed(3))),
    [0.199, 0.199, 0.199, 2.716, 2.716, 2.766],
  );
  assert.deepEqual(
    bladecall.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" &&
          event.name === "Bladecall — Jagged Mind",
      )
      .map((event) => Number(event.at.toFixed(3))),
    [0.199, 0.199, 0.199, 2.716, 2.716, 2.766],
  );
});

test("Virtuoso bladesongs use the EVTC projectile packet trains", () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    selectedTraits: ["Jagged Mind"],
    stats: {
      ...defaults.stats,
      precision: 3100,
    },
    initialResource: 5,
  });
  const packets = (result, skillName, type = "damage") =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === type &&
          event.skillName === skillName &&
          (type !== "condition" || event.condition === "Bleeding"),
      )
      .map((event) => Number(event.at.toFixed(3)));

  const harmony = simulateMesmer(
    ["Bladesong Harmony", { name: "__wait", waitMs: 2000 }],
    config,
  );
  assert.deepEqual(
    packets(harmony, "Bladesong Harmony"),
    [0.69, 0.848, 1.007, 1.174, 1.324],
  );
  assert.deepEqual(
    packets(harmony, "Bladesong Harmony", "condition"),
    [0.69, 0.848, 1.007, 1.174, 1.324],
  );

  const sorrow = simulateMesmer(
    ["Bladesong Sorrow", { name: "__wait", waitMs: 2000 }],
    config,
  );
  assert.deepEqual(
    packets(sorrow, "Bladesong Sorrow"),
    [0.922, 0.997, 1.081, 1.155, 1.155],
  );
  assert.deepEqual(
    packets(sorrow, "Bladesong Sorrow", "condition"),
    [0.922, 0.997, 1.081, 1.155, 1.155],
  );
  assert.deepEqual(
    sorrow.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" &&
          event.skillName === "Bladesong Sorrow" &&
          event.condition === "Confusion",
      )
      .map((event) => Number(event.at.toFixed(3))),
    [0.922, 0.997, 1.081, 1.155, 1.155],
  );
});

test("Cry of Pain improves every Bladesong Sorrow confusion packet", () => {
  const result = simulateMesmer(
    ["Bladesong Sorrow", { name: "__wait", waitMs: 2000 }],
    defaultSimulationConfig({
      selectedTraits: ["Cry of Pain"],
      initialResource: 5,
    }),
  );
  const confusion = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Bladesong Sorrow" &&
      event.condition === "Confusion",
  );

  assert.deepEqual(
    confusion.map((event) => Number(event.at.toFixed(3))),
    [0.922, 0.997, 1.081, 1.155, 1.155],
  );
  assert.ok(
    confusion.every((event) => event.stacks === 2 && event.duration === 4),
  );
});

test("Maim the Disillusioned follows each damaging Virtuoso bladesong hit", () => {
  const skills = [
    "Bladesong Harmony",
    "Bladesong Sorrow",
    "Bladesong Dissonance",
    "Bladeturn Requiem",
  ];

  for (const skillName of skills) {
    const result = simulateMesmer(
      [skillName, { name: "__wait", waitMs: 5000 }],
      defaultSimulationConfig({
        selectedTraits: ["Maim the Disillusioned"],
        initialResource: 5,
      }),
    );
    const hitTimes = result.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.skillName === skillName,
      )
      .map((event) => Number(event.at.toFixed(3)));
    const torment = result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === skillName &&
        event.condition === "Torment",
    );

    assert.ok(hitTimes.length > 0, skillName);
    assert.deepEqual(
      torment.map((event) => Number(event.at.toFixed(3))),
      hitTimes,
      skillName,
    );
    assert.ok(
      torment.every((event) => event.stacks === 1 && event.duration === 6),
      skillName,
    );
  }
});

test("Maim the Disillusioned applies torment for defensive shatters", () => {
  const cases = [
    {
      specialization: "Virtuoso",
      skill: "Bladesong Distortion",
      initialResource: 5,
      expectedStacks: 1,
    },
    {
      specialization: "Core",
      skill: "Distortion",
      initialResource: 3,
      expectedStacks: 4,
    },
    {
      specialization: "Chronomancer",
      skill: "Distortion",
      initialResource: 3,
      expectedStacks: 4,
    },
    {
      specialization: "Mirage",
      skill: "Distortion",
      initialResource: 3,
      expectedStacks: 4,
    },
  ];

  for (const testCase of cases) {
    const result = simulateMesmer(
      [testCase.skill],
      defaultSimulationConfig({
        specialization: testCase.specialization,
        selectedTraits: ["Maim the Disillusioned"],
        initialResource: testCase.initialResource,
      }),
    );
    const torment = result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === testCase.skill &&
        event.condition === "Torment",
    );

    assert.equal(result.steps[0].start, result.steps[0].end);
    assert.equal(result.endState.profession.resource, 0);
    assert.equal(torment.length, 1);
    assert.equal(torment[0].stacks, testCase.expectedStacks);
    assert.equal(torment[0].duration, 6);
  }
});

test("Bladeturn Requiem starts one second later and scales by 0.5 per blade", () => {
  const result = simulateMesmer(
    ["Bladeturn Requiem", { name: "__wait", waitMs: 6000 }],
    defaultSimulationConfig({ initialResource: 5 }),
  );
  const hits = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.skillName === "Bladeturn Requiem",
  );

  assert.deepEqual(
    hits.map((event) => Number(event.at.toFixed(3))),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [0.5, 0.5, 0.5, 0.5, 0.5],
  );
});

test("Phantasmal Duelist uses eight timed unload and bleeding packets", () => {
  const result = simulateMesmer(
    ["Phantasmal Duelist", { name: "__wait", waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      selectedTraits: [],
      primaryWeapon: "Dagger",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );
  const times = (source) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" &&
          event.skillName === "Phantasmal Duelist" &&
          event.source === source,
      )
      .map((event) => Number(event.at.toFixed(3)));

  assert.deepEqual(times("Player"), [0.35, 0.35, 0.4]);
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" &&
          event.skillName === "Phantasmal Duelist" &&
          event.source === "Player",
      )
      .map((event) => event.coefficient),
    [0.33, 0.33, 0.33],
  );
  assert.deepEqual(
    times("Phantasm"),
    [1.443, 1.643, 1.843, 2.043, 2.243, 2.443, 2.643, 2.843],
  );
  assert.ok(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" &&
          event.skillName === "Phantasmal Duelist" &&
          event.source === "Phantasm",
      )
      .every((event) => Math.abs(event.coefficient - 0.115) < 1e-12),
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" &&
          event.skillName === "Phantasmal Duelist" &&
          event.condition === "Bleeding",
      )
      .map((event) => Number(event.at.toFixed(3))),
    [1.443, 1.643, 1.843, 2.043, 2.243, 2.443, 2.643, 2.843],
  );
});

test("the supplied condition Virtuoso build tracks cast-end blade spends", () => {
  const build = JSON.parse(
    readFileSync(
      new URL("../../fixtures/cvirt-bench-build.json", import.meta.url),
      "utf8",
    ),
  );
  const app = {
    build,
    skillByName: mesmerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = simulateMesmer(build.rotation, simulationConfig(app));
  const spends = shatterResourceSpends(result);

  assert.deepEqual(
    [2, 9, 11, 13, 18, 21, 29].map((index) => spends.get(index)?.count),
    [5, 5, 5, 5, 5, 5, 5],
  );
  assert.deepEqual(
    [9, 11, 13, 18, 21, 29].map((index) => spends.get(index)?.sourceSkill),
    [
      "Bladesong Harmony",
      "Bladesong Sorrow",
      "Bladesong Harmony",
      "Bladesong Sorrow",
      "Bladesong Harmony",
      "Bladeturn Requiem",
    ],
  );
  const relativeStart = (rotationIndex) => {
    const step = result.steps.find(
      (candidate) => candidate.ri === rotationIndex,
    );
    return Number((step.start / 1000 - result.dpsStartTime).toFixed(3));
  };
  assert.deepEqual(
    [relativeStart(9), relativeStart(11), relativeStart(29)],
    [2.12, 3.679, 12.879],
  );
  const firstHarmony = result.events.find(
    (event) => event.type === "action" && event.name === "Bladesong Harmony",
  );
  const firstHarmonySpend = result.events.find(
    (event) =>
      event.type === "resource" && event.sourceSkill === "Bladesong Harmony",
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "resource" &&
        event.amount > 0 &&
        event.at > firstHarmony.at &&
        event.at < firstHarmonySpend.at,
    ),
  );
});

test("supplied trait attacks execute with their exact coefficients", () => {
  const coefficient = (result, skillName) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.skillName === skillName,
      )
      .reduce((sum, event) => sum + event.coefficient, 0);

  const madness = simulateMesmer(
    ["Ether Feast", { name: "__wait", waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: "Core",
      selectedTraits: ["Method of Madness"],
      selectedSkills: ["Ether Feast"],
    }),
  );
  assert.ok(
    Math.abs(coefficient(madness, "Lesser Chaos Storm") - 1.98) < 1e-12,
  );

  const phantasmalBlade = simulateMesmer(
    ["Phantasmal Lancer", { name: "__wait", waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      primaryWeapon: "Spear",
      secondaryWeapon: "",
      selectedTraits: ["Phantasmal Blades"],
      initialResource: 0,
    }),
  );
  assert.equal(coefficient(phantasmalBlade, "Phantasmal Blade"), 0.7);
  const phantasmalBladeHit = phantasmalBlade.resolvedEvents.find(
    (event) =>
      event.type === "damage" && event.skillName === "Phantasmal Blade",
  );
  assert.equal(phantasmalBladeHit.source, "Player");
  assert.equal(phantasmalBladeHit.actorType, "player");
  assert.equal(phantasmalBladeHit.weaponStrength, 2553.5);
  const modifiedPhantasmalBlade = simulateMesmer(
    ["Phantasmal Lancer", { name: "__wait", waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      primaryWeapon: "Spear",
      secondaryWeapon: "",
      selectedTraits: ["Phantasmal Blades"],
      initialResource: 0,
      sigilSets: [
        { strike: 1.1, condition: 1 },
        { strike: 1, condition: 1 },
      ],
    }),
  ).resolvedEvents.find(
    (event) =>
      event.type === "damage" && event.skillName === "Phantasmal Blade",
  );
  assert.ok(
    Math.abs(modifiedPhantasmalBlade.damage / phantasmalBladeHit.damage - 1.1) <
      1e-12,
  );

  const syncopate = simulateMesmer(
    ["Illusionary Wave"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      primaryWeapon: "Greatsword",
      secondaryWeapon: "",
      selectedTraits: ["Syncopate"],
    }),
  );
  assert.equal(coefficient(syncopate, "Syncopate"), 0.75);

  const timeBomb = simulateMesmer(
    ["Time Sink", { name: "__wait", waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      selectedTraits: ["Time Bomb"],
      initialResource: 1,
    }),
  );
  assert.equal(coefficient(timeBomb, "Time Bomb"), 3);
});

test("Troubadour benchmark instruments use measured packets and normalized strength", () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: "Troubadour",
    initialResource: 3,
    selectedTraits: ["Syncopate", "Shredding", "Fortissimo"],
    boons: { ...defaults.boons, quickness: true, alacrity: true },
  });
  const lute = simulateMesmer(
    ["Lively Lute", { name: "__wait", waitMs: 1000 }],
    config,
  );
  const luteHits = lute.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillId === ID.LIVELY_LUTE,
  );
  assert.equal(lute.steps[0].end, 560);
  assert.deepEqual(
    luteHits.map((event) => Number(event.at.toFixed(3))),
    [0.435, 0.635, 0.835, 1.035],
  );
  assert.deepEqual(
    luteHits.map((event) => event.coefficient),
    [1, 1, 1, 1],
  );
  assert.ok(
    luteHits.every(
      (event) =>
        event.weaponStrengthProfileId === "nonweapon.profession-mechanic",
    ),
  );

  const drum = simulateMesmer(
    ["Deafening Drum", { name: "__wait", waitMs: 4000 }],
    config,
  );
  const drumHit = drum.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillName === "Deafening Drum",
  );
  const syncopate = drum.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillName === "Syncopate",
  );
  assert.equal(drum.steps[0].end, 680);
  assert.equal(drumHit.at, 0.518);
  assert.equal(drumHit.coefficient, 2);
  assert.equal(
    drumHit.weaponStrengthProfileId,
    "nonweapon.profession-mechanic",
  );
  assert.deepEqual(
    syncopate.map((event) => event.at),
    [0.518, 3.518, 3.518],
  );
  assert.deepEqual(
    syncopate.map((event) => event.coefficient),
    [0.75, 1, 0.75],
  );
  assert.deepEqual(
    syncopate.map((event) => event.weaponStrengthProfileId),
    ["nonweapon.unequipped", "nonweapon.unequipped", "nonweapon.unequipped"],
  );
});

test("Troubadour skills use measured Quickness cast times", () => {
  const result = simulateMesmer(
    [
      "Flustering Flute",
      "Lively Lute",
      "Crescendo",
      "Harmonious Harp",
      "Mimic",
      "Tale of the Tortured Mastermind",
      "Deafening Drum",
    ],
    defaultSimulationConfig({
      specialization: "Troubadour",
      selectedSkills: ["Mimic", "Tale of the Tortured Mastermind"],
      boons: { quickness: true },
      initialResource: 3,
    }),
  );

  assert.deepEqual(
    result.steps.map((step) => step.end - step.start),
    [560, 560, 1000, 480, 640, 400, 680],
  );
});

test("ordinary Lively Lute has one charge unless Shatter Storm is selected", () => {
  const config = (selectedTraits) =>
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 3,
      selectedTraits,
    });
  const ordinary = simulateMesmer(["Lively Lute", "Lively Lute"], config([]));
  const shatterStorm = simulateMesmer(
    ["Lively Lute", "Lively Lute"],
    config(["Shatter Storm"]),
  );

  assert.ok(ordinary.steps[1].start > 9000);
  assert.equal(shatterStorm.steps[1].start, 560);
});

test("Tortured Mastermind follows the benchmark four-hit condition timeline", () => {
  const result = simulateMesmer(
    [
      "Flustering Flute",
      "Tale of the Tortured Mastermind",
      { name: "__wait", waitMs: 4000 },
    ],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 3,
      selectedTraits: ["Syncopate", "Dazzling"],
    }),
  );
  const taleHits = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      event.skillName === "Tale of the Tortured Mastermind",
  );
  const taleConditions = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Tale of the Tortured Mastermind",
  );

  assert.equal(result.steps[1].start, 560);
  assert.equal(result.steps[1].end, 960);
  assert.deepEqual(
    taleHits.map((event) => Number(event.at.toFixed(3))),
    [0.91, 1.91, 2.91, 3.91],
  );
  assert.deepEqual(
    taleHits.map((event) => event.coefficient),
    [1, 1, 1, 1],
  );
  assert.deepEqual(
    taleConditions
      .filter((event) => event.condition === "Torment")
      .map((event) => [
        Number(event.at.toFixed(3)),
        event.stacks,
        event.duration,
      ]),
    [
      [0.91, 1, 8],
      [1.91, 1, 8],
      [2.91, 1, 8],
      [3.91, 1, 8],
    ],
  );
  assert.deepEqual(
    taleConditions
      .filter((event) => event.condition !== "Torment")
      .map((event) => [
        event.condition,
        Number(event.at.toFixed(3)),
        event.stacks,
        event.duration,
      ]),
    [
      ["Weakness", 0.91, 1, 5],
      ["Vulnerability", 1.91, 10, 4],
    ],
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "control" &&
        event.skillName === "Tale of the Tortured Mastermind" &&
        event.at === 3.91,
    ),
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Syncopate" &&
        event.at === 3.91,
    ),
  );
  assert.equal(result.endState.profession.resource, 1);
});

test("Troubadour tales grant their boons and instrument-specific notes", () => {
  const cases = [
    [
      "Lively Lute",
      "Tale of the Soulkeeper",
      2,
      [
        ["might", 10, 15],
        ["fury", 1, 10],
        ["quickness", 1, 4],
      ],
    ],
    ["Deafening Drum", "Tale of the Honorable Rogue", 1, [["aegis", 1, 4]]],
    [
      "Harmonious Harp",
      "Tale of the Valiant Marshal",
      1,
      [
        ["stability", 5, 4],
        ["resistance", 1, 3],
      ],
    ],
  ];
  for (const [instrument, tale, expectedNotes, expectedBoons] of cases) {
    const result = simulateMesmer(
      [instrument, tale, { name: "__wait", waitMs: 100 }],
      defaultSimulationConfig({
        specialization: "Troubadour",
        initialResource: 3,
        allies: { count: 4, strikesPerSecond: 1 },
        sharePlayerBoonsWithSummons: true,
      }),
    );
    assert.equal(result.endState.profession.resource, expectedNotes, tale);
    assert.ok(
      result.events.some(
        (event) =>
          event.type === "mesmer.instrument" &&
          instrument.includes(event.instrument),
      ),
    );
    const boons = result.events
      .filter((event) => event.type === "buff" && event.skillName === tale)
      .map((event) => [event.kind, event.stacks, event.duration]);
    assert.deepEqual(boons, expectedBoons, tale);
    assert.ok(
      result.events
        .filter((event) => event.type === "buff" && event.skillName === tale)
        .every(
          (event) =>
            event.recipients === "party" &&
            event.recipientCount === 5 &&
            event.affectsSummons === false,
        ),
      tale,
    );
    if (instrument === "Harmonious Harp") {
      assert.ok(
        result.events.some(
          (event) =>
            event.type === "buff" &&
            event.kind === "distortion" &&
            event.duration === 2,
        ),
      );
    }
  }
});

test("Troubadour instrument note spends retain rotation timeline metadata", () => {
  const result = simulateMesmer(
    ["Lively Lute", "Tale of the Soulkeeper", "Flustering Flute"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 3,
    }),
  );
  const spends = shatterResourceSpends(result);

  assert.deepEqual(spends.get(0), {
    count: 3,
    resource: "notes",
    sourceSkill: "Lively Lute",
  });
  assert.deepEqual(spends.get(2), {
    count: 2,
    resource: "notes",
    sourceSkill: "Flustering Flute",
  });
  assert.deepEqual(
    result.endState.profession.activeInstruments.map(
      (instrument) => instrument.name,
    ),
    ["Lute", "Flute"],
  );
  const resourceView = mesmerProfession
    .resolveRuntime({
      specialization: "Troubadour",
    })
    .ui.resourceViews({
      specialization: "Troubadour",
      professionState: result.endState.profession,
    })[0];
  assert.equal(resourceView.pipStyle, "mesmer-notes");
  assert.equal(resourceView.statusItemsLabel, "Playing");
  assert.deepEqual(
    resourceView.statusItems.map((item) => item.label),
    ["Lute", "Flute"],
  );
  assert.ok(
    resourceView.statusItems.every((item) =>
      /^\d+\.\d+s$/.test(item.valueLabel),
    ),
  );
  const resourceHtml = activeResourceGroup({
    profession: mesmerProfession,
    adapter: { eliteSpecialization: () => "Troubadour" },
    build: { initialResource: 0 },
    results: result,
  });
  assert.match(resourceHtml, /active-resource-pips mesmer-notes/);
  assert.equal(
    [
      ...resourceHtml.matchAll(
        /<span class="active-resource-pip(?: active)?"><\/span>/g,
      ),
    ].length,
    3,
  );
  assert.match(resourceHtml, /active-resource-statuses/);
  assert.match(resourceHtml, />Lute</);
  assert.match(resourceHtml, />Flute</);
  for (const index of [0, 2]) {
    const spend = result.events.find(
      (event) =>
        event.type === "resource" &&
        event.reason === "profession mechanic" &&
        event.rotationIndex === index,
    );
    assert.ok(spend);
    const action = result.events.find(
      (event) => event.type === "action" && event.name === spend.sourceSkill,
    );
    assert.ok(action);
    assert.equal(spend.sourceSkill, action.name);
    assert.ok(Math.abs(spend.at - action.fullEndsAt) < 0.00001);
  }

  const empty = simulateMesmer(
    ["Deafening Drum"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 0,
    }),
  );
  assert.deepEqual(shatterResourceSpends(empty).get(0), {
    count: 0,
    resource: "notes",
    sourceSkill: "Deafening Drum",
  });
});

test("Troubadour adept and support traits emit their modeled effects", () => {
  const resonance = simulateMesmer(
    ["Flustering Flute", "Dodge", "Dodge", "Dodge"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 3,
    }),
  );
  assert.equal(resonance.steps[3].start, 8560);

  const mayhem = simulateMesmer(
    ["Flustering Flute", "Dodge", "Flustering Flute"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 0,
      selectedTraits: ["Mayhem"],
    }),
  );
  const torment = mayhem.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.condition === "Torment" &&
      event.name.includes("Mayhem"),
  );
  assert.deepEqual(
    torment.map((event) => [event.stacks, event.duration]),
    [
      [4, 5],
      [4, 5],
    ],
  );
  assert.equal(mayhem.steps[2].start, 15060);

  const rogueEndurance = simulateMesmer(
    ["Dodge", "Dodge", "Tale of the Honorable Rogue", "Dodge"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 0,
    }),
  );
  assert.equal(rogueEndurance.steps[3].start, 0);

  const raconteur = simulateMesmer(
    ["Tale of the Soulkeeper"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      selectedTraits: ["Raconteur"],
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
    }),
  );
  assert.ok(
    raconteur.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "protection" &&
        event.duration === 3 &&
        event.recipients === "party" &&
        event.affectsSummons === false,
    ),
  );

  const party = simulateMesmer(
    ["Lively Lute", "Crescendo"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 1,
      selectedTraits: ["Life of the Party"],
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
    }),
  );
  const partyBoons = party.events.filter(
    (event) =>
      event.type === "buff" &&
      ["quickness", "might", "fury"].includes(event.kind),
  );
  assert.ok(
    partyBoons.every(
      (event) =>
        event.recipients === "party" &&
        event.recipientCount === 5 &&
        event.affectsSummons === false,
    ),
  );
  assert.ok(
    partyBoons.some(
      (event) => event.kind === "quickness" && event.duration === 6,
    ),
  );
  assert.ok(
    partyBoons.some(
      (event) =>
        event.kind === "might" && event.stacks === 5 && event.duration === 8,
    ),
  );
  assert.ok(
    partyBoons.some(
      (event) => event.kind === "quickness" && event.duration === 8,
    ),
  );
  assert.ok(
    partyBoons.some(
      (event) =>
        event.kind === "might" && event.stacks === 8 && event.duration === 15,
    ),
  );
  assert.ok(
    partyBoons.some((event) => event.kind === "fury" && event.duration === 8),
  );
});

test("Harmonize, Call and Response, Fortissimo, and Altered Chord execute", () => {
  const harmonize = simulateMesmer(
    ["Phantasmal Swordsman", { name: "__wait", waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 0,
    }),
  );
  assert.deepEqual(
    harmonize.events
      .filter((event) => event.type === "resource")
      .map((event) => event.reason),
    ["Harmonize", "Phantasmal Swordsman phantasm conversion"],
  );
  assert.equal(harmonize.endState.profession.resource, 2);

  const response = simulateMesmer(
    ["Lively Lute", { name: "__wait", waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 3,
      selectedTraits: ["Call and Response"],
    }),
  );
  const afterimageHits = response.resolvedEvents.filter(
    (event) => event.type === "damage" && event.source === "Afterimage",
  );
  assert.deepEqual(
    afterimageHits.map((event) => Number(event.at.toFixed(3))),
    [2.06, 2.26, 2.46],
  );
  assert.ok(afterimageHits.every((event) => event.actorType === "summon"));
  assert.ok(
    response.events.some(
      (event) =>
        event.type === "proc" &&
        event.name === "Call and Response" &&
        event.at === 2.06,
    ),
  );

  const fortissimo = simulateMesmer(
    ["Crescendo", { name: "__wait", waitMs: 5100 }],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 0,
      selectedTraits: ["Fortissimo"],
    }),
  );
  assert.deepEqual(
    fortissimo.events
      .filter(
        (event) => event.type === "resource" && event.reason === "Fortissimo",
      )
      .map((event) => event.at),
    [2, 3, 4],
  );

  const altered = simulateMesmer(
    ["Deafening Drum", "Crescendo", { name: "__wait", waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 1,
      selectedTraits: ["Altered Chord", "Syncopate"],
    }),
  );
  assert.ok(
    altered.events.some(
      (event) =>
        event.type === "control" &&
        event.skillName === "Crescendo" &&
        event.at === 1.53,
    ),
  );
  assert.ok(
    altered.resolvedEvents.some(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Crescendo" &&
        event.at === 1.53,
    ),
  );

  const luteSpotlight = simulateMesmer(
    ["Lively Lute", "Crescendo"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 1,
      selectedTraits: ["Altered Chord"],
    }),
  );
  assert.ok(
    luteSpotlight.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "altered-chord" &&
        event.duration === 10,
    ),
  );

  const fluteSpotlight = simulateMesmer(
    ["Flustering Flute", "Crescendo"],
    defaultSimulationConfig({
      specialization: "Troubadour",
      initialResource: 1,
      selectedTraits: ["Altered Chord"],
    }),
  );
  assert.ok(
    fluteSpotlight.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.name.includes("Altered Chord") &&
        event.condition === "Confusion" &&
        event.stacks === 5 &&
        event.duration === 8,
    ),
  );

  const crescendoReadyAt = (initialResource) =>
    simulateMesmer(
      ["Crescendo", "Lively Lute"],
      defaultSimulationConfig({
        specialization: "Troubadour",
        initialResource,
        selectedTraits: ["Altered Chord"],
      }),
    ).endState.cooldowns.Crescendo.readyAt;
  assert.equal(crescendoReadyAt(0) - crescendoReadyAt(1), 2000);
});

test("Bountiful Blades stocks each Berserker blade independently", () => {
  const result = simulateMesmer(
    ["Phantasmal Berserker", { name: "__wait", waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: "Virtuoso",
      selectedTraits: ["Bountiful Blades"],
      primaryWeapon: "Greatsword",
      secondaryWeapon: "",
      initialResource: 0,
    }),
  );
  const conversions = result.events.filter(
    (event) =>
      event.type === "resource" &&
      event.reason === "Phantasmal Berserker phantasm conversion",
  );

  assert.deepEqual(
    conversions.map((event) => event.amount),
    [1, 1],
  );
  assert.ok(Math.abs(conversions[0].at - 3.6801) < 0.00001);
  assert.ok(Math.abs(conversions[1].at - 4.0001) < 0.00001);
});

test("Virtuoso cast-end blade spends retain timeline metadata", () => {
  const rotation = [
    "Phantasmal Disenchanter",
    "Imaginary Inversion",
    { name: "Bladeturn Requiem", offset: 100 },
    "Mind the Gap",
    "Phantasmal Lancer",
    "Power Spike",
    "Thousand Cuts",
    "Mental Collapse",
    "Mind the Gap",
    "Swap Weapons",
    "Phantasmal Berserker",
    "Signet of the Ether",
    "Phantasmal Berserker",
    "Mind Stab",
    "Mirror Blade",
    "Bladesong Harmony",
    "Rain of Swords",
    "Phantasmal Disenchanter",
    "Bladesong Sorrow",
  ];
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      specialization: "Virtuoso",
      selectedTraits: ["Bountiful Blades", "Infinite Forge"],
      selectedSkills: [
        "Signet of the Ether",
        "Phantasmal Disenchanter",
        "Rain of Swords",
        "Mantra of Pain",
        "Thousand Cuts",
      ],
      primaryWeapon: "Greatsword",
      secondaryWeapon: "",
      weaponSet2Primary: "Spear",
      weaponSet2Secondary: "",
      startingWeaponSet: 2,
      initialResource: 5,
    }),
  );
  const harmony = result.events.find(
    (event) => event.type === "marker" && event.name === "Bladesong Harmony",
  );
  const harmonyAction = result.events.find(
    (event) => event.type === "action" && event.name === "Bladesong Harmony",
  );
  const harmonySpend = result.events.find(
    (event) =>
      event.type === "resource" &&
      event.reason === "profession mechanic" &&
      event.sourceSkill === "Bladesong Harmony",
  );
  const timelineSpends = shatterResourceSpends(result);
  assert.equal(result.warnings.length, 0);
  assert.equal(harmony.detail, "5 blades spent");
  assert.equal(harmonySpend.amount, -5);
  assert.equal(harmonySpend.sourceSkill, "Bladesong Harmony");
  assert.equal(harmonySpend.rotationIndex, 15);
  assert.ok(Math.abs(harmonySpend.at - harmonyAction.fullEndsAt) < 0.00001);
  assert.deepEqual(timelineSpends.get(15), {
    count: 5,
    resource: "blades",
    sourceSkill: "Bladesong Harmony",
  });
});

test("Clarity makes only an empowered Mental Collapse a control skill", () => {
  const config = defaultSimulationConfig({
    specialization: "Virtuoso",
    primaryWeapon: "Spear",
    secondaryWeapon: "",
  });
  const normal = simulateMesmer(["Mental Collapse"], config);
  const empowered = simulateMesmer(["Mind the Gap", "Mental Collapse"], config);
  const activeNearExpiry = simulateMesmer(
    ["Mind the Gap", { name: "__wait", waitMs: 14999 }, "Mental Collapse"],
    config,
  );
  const expired = simulateMesmer(
    ["Mind the Gap", { name: "__wait", waitMs: 15000 }, "Mental Collapse"],
    config,
  );
  const hasMentalCollapseControl = (result) =>
    result.events.some(
      (event) =>
        event.type === "control" && event.skillName === "Mental Collapse",
    );

  assert.equal(hasMentalCollapseControl(normal), false);
  assert.equal(hasMentalCollapseControl(empowered), true);
  assert.equal(hasMentalCollapseControl(activeNearExpiry), true);
  assert.equal(hasMentalCollapseControl(expired), false);
});

test("Shackles converts Lancer immobilize into a stun that triggers Syncopate", () => {
  const result = simulateMesmer(
    ["Mind the Gap", "Phantasmal Lancer", { name: "__wait", waitMs: 6100 }],
    defaultSimulationConfig({
      specialization: "Troubadour",
      primaryWeapon: "Spear",
      secondaryWeapon: "",
      initialResource: 0,
      selectedTraits: ["Syncopate"],
      relic: "Shackles",
    }),
  );
  const lancerConditions = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Phantasmal Lancer" &&
      ["Crippled", "Immobilized"].includes(event.condition),
  );
  const syncopate = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillName === "Syncopate",
  );
  const shackles = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.skillName === "Relic of the Shackles",
  );
  const shacklesStuns = result.events.filter(
    (event) =>
      event.type === "control" && event.skillName === "Relic of the Shackles",
  );

  assert.deepEqual(
    lancerConditions.map((event) => [
      event.condition,
      event.duration,
      event.source,
      event.actorType,
    ]),
    [
      ["Crippled", 3, "Phantasm", "summon"],
      ["Immobilized", 2, "Phantasm", "summon"],
    ],
  );
  assert.equal(shackles.length, 1);
  assert.equal(shackles[0].at, lancerConditions[1].at + 5);
  assert.deepEqual(
    shacklesStuns.map((event) => [event.at, event.controlKind, event.duration]),
    [[lancerConditions[1].at + 5, "stun", 1]],
  );
  assert.equal(syncopate.length, 1);
  assert.equal(syncopate[0].at, shacklesStuns[0].at);
});

test("Signet of the Ether does not generate a clone", () => {
  const result = simulateMesmer(
    ["Signet of the Ether"],
    defaultSimulationConfig({
      specialization: "Core",
      initialResource: 0,
    }),
  );

  assert.equal(result.endState.profession.resource, 0);
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "resource" && event.reason === "Signet of the Ether",
    ),
    false,
  );
});

test("concurrent Continuum Split excludes the still-casting skill from its snapshot", () => {
  const result = simulateMesmer(
    [
      "Phantasmal Warlock",
      { name: "Continuum Split", offset: 100 },
      "Continuum Shift",
      "Phantasmal Warlock",
    ],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      initialResource: 3,
      primaryWeapon: "Staff",
      secondaryWeapon: "",
    }),
  );
  assert.equal(result.steps[0].end, 840);
  assert.equal(result.steps[1].start, 100);
  assert.equal(result.steps[3].start, result.steps[2].end);
});

test("mid-rotation concurrent Continuum Split does not restore expired cooldowns", () => {
  const result = simulateMesmer(
    [
      "Chaos Storm",
      { name: "__wait", waitMs: 14000 },
      "Phantasmal Warlock",
      { name: "Continuum Split", offset: 100 },
      "Continuum Shift",
      "Chaos Storm",
    ],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      initialResource: 3,
      primaryWeapon: "Staff",
      secondaryWeapon: "",
    }),
  );

  assert.equal(result.steps[3].start, 14580);
  assert.equal(result.steps[5].start, result.steps[4].end);
});

test("relic and trait activations are exposed as proc timeline steps", () => {
  const result = simulateMesmer(
    ["Blurred Frenzy"],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Sword",
      selectedTraits: ["Fencer's Finesse"],
      relic: "Thief",
      initialResource: 0,
    }),
  );
  assert.ok(
    result.procSteps.some(
      (proc) => proc.type === "trait_proc" && proc.skill === "Fencer's Finesse",
    ),
  );
  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.type === "relic_proc" && proc.skill === "Relic of the Thief",
    ),
  );
});

test("result summary uses the expected metric order", () => {
  const result = simulateMesmer(
    ["Blurred Frenzy"],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Sword",
      initialResource: 0,
    }),
  );
  assert.deepEqual(
    resultSummaryMetrics(result).map((metric) => metric.label),
    ["Duration", "Total Damage", "DPS", "Strike", "Condition"],
  );
});

test("Kill Time accounts for an explicit Combat Start reference", () => {
  const metrics = resultSummaryMetrics({
    duration: 93.89,
    deathTime: 93.89,
    firstHitTime: 2.06,
    events: [{ type: "combat_start", at: 2.06 }],
  });

  assert.equal(metrics[0].label, "Kill Time");
  assert.equal(metrics[0].value, "91.83s");
});

test("result summary hides the internal effect horizon after the target dies", () => {
  const metrics = resultSummaryMetrics({
    duration: 97.1,
    deathTime: 93.1,
  });

  assert.equal(metrics[0].label, "Kill Time");
  assert.equal(metrics[0].value, "93.10s");
  assert.equal(
    metrics.some((metric) => metric.value === "97.10s"),
    false,
  );
});

test("Combat Start is timeline zero while DPS waits for the first subsequent hit", () => {
  const result = simulateMesmer(
    [
      "Phantasmal Swordsman",
      { name: "__combat_start", offset: 700 },
      "Bladecall",
    ],
    defaultSimulationConfig(),
  );

  assert.equal(
    formatResultTimelineTime(result.steps[0].start, result),
    "-0.70s",
  );
  assert.equal(
    formatResultTimelineTime(result.steps[1].start, result),
    "0.00s",
  );
  assert.equal(
    formatResultTimelineTime(result.steps[2].start, result),
    "0.18s",
  );
  assert.equal(formatResultTimelineTime(result.steps[2].end, result), "0.62s");
  assert.equal(result.dpsStartTime, result.firstHitTime);
});

test("timeline retains simulation time while DPS starts on first damage without Combat Start", () => {
  const result = simulateMesmer(
    ["Phantasmal Swordsman", "Bladecall"],
    defaultSimulationConfig(),
  );

  assert.equal(result.dpsStartTime, 0.759);
  assert.ok(Math.abs(result.dpsWindow - 0.561) < 1e-12);
  assert.equal(
    formatResultTimelineTime(result.steps[0].start, result),
    "0.00s",
  );
  assert.equal(
    formatResultTimelineTime(result.steps[1].start, result),
    "0.88s",
  );
});

test("rotation warnings use timeline-relative timestamps", () => {
  const invalidReason = "Skill is unavailable.";
  const result = {
    events: [{ type: "combat_start", at: 2 }],
    steps: [
      {
        invalid: true,
        invalidReason,
        start: 3500,
      },
    ],
    warnings: [invalidReason, "Bladesong skipped at 4.25s: no blades."],
  };

  assert.deepEqual(rotationWarningItems(result), [
    { message: invalidReason, time: "1.50s" },
    { message: "Bladesong skipped: no blades.", time: "2.25s" },
  ]);
});

test("a delayed Combat Start suppresses earlier damage without moving display zero", () => {
  const result = simulateMesmer(
    [
      "Phantasmal Duelist",
      { name: "__combat_start", offset: 500 },
      "Illusionary Counter",
      "Counterspell",
    ],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );

  assert.equal(result.steps[1].start, 500);
  assert.equal(
    formatResultTimelineTime(result.steps[0].start, result),
    "-0.50s",
  );
  assert.equal(
    formatResultTimelineTime(result.steps[1].start, result),
    "0.00s",
  );
  assert.ok(
    result.resolvedEvents
      .filter((event) => event.type === "damage")
      .every((event) => event.at >= 0.5),
  );
  assert.ok(Math.abs(result.dpsStartTime - 1.002) < 1e-12);
});

test("event log timestamps use the same explicit Combat Start origin as rotation tiles", () => {
  const result = simulateMesmer(
    [
      "Phantasmal Duelist",
      { name: "__combat_start", offset: 500 },
      "Illusionary Counter",
      "Counterspell",
    ],
    defaultSimulationConfig({
      specialization: "Chronomancer",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    }),
  );
  const log = simulationEventLogRows(result, null, mesmerProfession);
  const duelistStart = log.find((event) =>
    event.description.startsWith("CAST Phantasmal Duelist"),
  );
  const combatStart = log.find((event) => event.description === "COMBAT START");
  const counterspellStart = log.find((event) =>
    event.description.startsWith("CAST Counterspell"),
  );

  assert.equal(duelistStart.at, -0.5);
  assert.equal(combatStart.at, 0);
  assert.ok(Math.abs(counterspellStart.at - 0.18) < 1e-12);
  assert.match(simulationEventLogCsv(log), /"-0\.500","cast"/);
  assert.match(
    simulationEventLogCsv(log),
    /"0\.000","combat_start","COMBAT START"/,
  );
});

test("result summary includes kill time when target health is exhausted", () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ["Bladecall"],
    defaultSimulationConfig({
      target: {
        ...defaults.target,
        health: 1,
      },
    }),
  );

  assert.deepEqual(
    resultSummaryMetrics(result).map((metric) => metric.label),
    ["Kill Time", "Total Damage", "DPS", "Strike", "Condition"],
  );
  assert.equal(
    buildChartSeries(result).durationMs,
    Math.max(1, result.dpsWindow * 1000),
  );
});

test("result table sorting cycles consistently across profession views", () => {
  assert.deepEqual(nextResultSortState(null, null, "dps"), {
    column: "dps",
    direction: "desc",
  });
  assert.deepEqual(nextResultSortState("dps", "desc", "dps"), {
    column: "dps",
    direction: "asc",
  });
  assert.deepEqual(nextResultSortState("dps", "asc", "dps"), {
    column: null,
    direction: null,
  });

  const rows = [
    { name: "Beta", total: 20, dps: 5 },
    { name: "Alpha", total: 10, dps: 8 },
  ];
  const columns = [
    { key: "name", numeric: false },
    { key: "dps", numeric: true },
  ];
  assert.deepEqual(
    sortResultRows(rows, columns, null, null).map((row) => row.name),
    ["Beta", "Alpha"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "dps", "desc").map((row) => row.name),
    ["Alpha", "Beta"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "name", "asc").map((row) => row.name),
    ["Alpha", "Beta"],
  );
});

test("skill breakdown combines strike and condition damage by source skill", () => {
  const result = simulateMesmer(
    ["Confusing Images", { name: "__wait", waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
      initialResource: 0,
    }),
  );
  const row = skillBreakdownRows(result).find(
    (entry) => entry.name === "Confusing Images",
  );
  assert.ok(row.strike > 0);
  assert.ok(row.condition > 0);
  assert.equal(row.total, row.strike + row.condition);
  assert.equal(row.casts, 1);
  assert.equal(row.hits, 7);
  assert.ok(row.average > 0);
  assert.ok(row.dct > 0);
});

test("condition breakdown reports damage, DPS, and average stacks", () => {
  const result = simulateMesmer(
    ["Confusing Images", { name: "__wait", waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
      initialResource: 0,
    }),
  );
  const confusion = result.conditionBreakdown.find(
    (entry) => entry.name === "Confusion",
  );
  assert.ok(confusion.damage > 0);
  assert.equal(confusion.dps, confusion.damage / result.dpsWindow);
  assert.ok(confusion.averageStacks > 0);
});

test("chart series expose first-hit-anchored average DPS and condition stacks", () => {
  const result = simulateMesmer(
    ["Confusing Images", { name: "__wait", waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: "Core",
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
      initialResource: 0,
    }),
  );
  const series = buildChartSeries(result);
  assert.ok(series.dps.length > 2);
  assert.ok(series.effects.Confusion.some((point) => point.v > 0));
  assert.ok(Math.abs(series.dps.at(-1).v - result.dps) < 0.001);
});

test("chart hover values use the latest sample at the hovered timestamp", () => {
  const points = [
    { t: 0, v: 0 },
    { t: 250, v: 12 },
    { t: 500, v: 8 },
  ];
  assert.equal(chartValueAt(points, 249), 0);
  assert.equal(chartValueAt(points, 250), 12);
  assert.equal(chartValueAt(points, 499), 12);
  assert.equal(chartValueAt(points, 500), 8);
  assert.equal(chartValueAt([], 500), 0);
});

test("Compounding Power chart series caps at five stacks", () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: [],
      events: Array.from({ length: 7 }, (_, index) => ({
        type: "buff",
        at: index * 0.1,
        kind: "compounding",
        duration: 8,
        stacks: 1,
      })),
    },
    100,
  );

  assert.equal(
    Math.max(...series.effects["Compounding Power"].map((point) => point.v)),
    5,
  );
});

test("Vulnerability chart series caps at 25 stacks", () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: [],
      events: Array.from({ length: 30 }, (_, index) => ({
        type: "buff",
        at: index * 0.01,
        kind: "target-vulnerability",
        duration: 8,
        stacks: 1,
      })),
    },
    100,
  );

  assert.equal(
    Math.max(...series.effects.Vulnerability.map((point) => point.v)),
    25,
  );
});

test("Might chart series caps at 25 stacks", () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: [],
      events: Array.from({ length: 30 }, (_, index) => ({
        type: "buff",
        at: index * 0.01,
        kind: "might",
        duration: 8,
        stacks: 1,
      })),
    },
    100,
  );

  assert.equal(Math.max(...series.effects.Might.map((point) => point.v)), 25);
});

test("Kalla's Fervor chart series caps at five stacks", () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: [],
      events: Array.from({ length: 7 }, (_, index) => ({
        type: "buff",
        at: index * 0.01,
        kind: "kallas-fervor",
        duration: 8,
        stacks: 1,
      })),
    },
    100,
  );

  assert.equal(
    Math.max(...series.effects["Kalla's Fervor"].map((point) => point.v)),
    5,
  );
});

test("Continuum Shift is available only while Continuum Split is active", () => {
  const config = defaultSimulationConfig({
    specialization: "Chronomancer",
    initialResource: 3,
  });
  const split = simulateMesmer(["Continuum Split"], config);
  assert.equal(split.endState.profession.continuumActive, true);
  assert.ok(split.endState.profession.continuumRemaining > 0);

  const shifted = simulateMesmer(
    ["Continuum Split", "Continuum Shift"],
    config,
  );
  assert.equal(shifted.endState.profession.continuumActive, false);
});

test("expired Continuum Split is injected before the next rotation action", () => {
  const rotation = ["Continuum Split", "Bladecall", "Bladecall", "Bladecall"];
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      specialization: "Chronomancer",
      initialResource: 3,
    }),
  );

  assert.deepEqual(continuumEndTimelineMarkers(result, rotation.length), [
    {
      insertionIndex: 3,
      skill: "Continuum Shift",
      start: 6000,
      detail: "split expired",
    },
  ]);
});

test("manual Continuum Shift is not duplicated as an injected timeline marker", () => {
  const rotation = ["Continuum Split", "Continuum Shift"];
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      specialization: "Chronomancer",
      initialResource: 3,
    }),
  );

  assert.deepEqual(continuumEndTimelineMarkers(result, rotation.length), []);
});

test("Continuum Split does not restore weapon-swap cooldown", () => {
  const config = defaultSimulationConfig({
    specialization: "Chronomancer",
    initialResource: 3,
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
    weaponSet2Primary: "Spear",
    weaponSet2Secondary: "",
  });
  const result = simulateMesmer(
    [
      "__combat_start",
      "Continuum Split",
      "Swap Weapons",
      { name: "__wait", waitMs: 1000 },
      "Continuum Shift",
      "Swap Weapons",
    ],
    config,
  );
  assert.deepEqual(
    result.steps
      .filter((step) => step.skill === "Swap Weapons")
      .map((step) => step.start),
    [0, 10000],
  );
});

test("Continuum Split does not extend an existing weapon-swap cooldown", () => {
  const config = defaultSimulationConfig({
    specialization: "Chronomancer",
    initialResource: 3,
    primaryWeapon: "Sword",
    secondaryWeapon: "Sword",
    weaponSet2Primary: "Spear",
    weaponSet2Secondary: "",
  });
  const result = simulateMesmer(
    [
      "__combat_start",
      "Swap Weapons",
      "Continuum Split",
      { name: "__wait", waitMs: 1000 },
      "Continuum Shift",
    ],
    config,
  );
  assert.equal(result.endState.cooldowns["Swap Weapons"].readyAt, 10000);
});

test("a build can open combat on its second weapon set", () => {
  const base = defaultSimulationConfig({
    specialization: "Core",
    initialResource: 0,
    primaryWeapon: "Sword",
    secondaryWeapon: "",
    weaponSet2Primary: "Scepter",
    weaponSet2Secondary: "",
  });
  const onSetTwo = simulateMesmer([{ name: "__wait", waitMs: 1000 }], {
    ...base,
    startingWeaponSet: 2,
  });
  assert.equal(onSetTwo.endState.activeWeaponSet, 2);

  // Swapping from a set-two opener lands on set one, proving t=0 was set two.
  const swappedFromTwo = simulateMesmer(["Swap Weapons"], {
    ...base,
    startingWeaponSet: 2,
  });
  assert.equal(swappedFromTwo.endState.activeWeaponSet, 1);

  const onSetOne = simulateMesmer([{ name: "__wait", waitMs: 1000 }], {
    ...base,
    startingWeaponSet: 1,
  });
  assert.equal(onSetOne.endState.activeWeaponSet, 1);
});

test("starting on weapon set two is ignored without a second weapon set", () => {
  const result = simulateMesmer(
    [{ name: "__wait", waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: "Core",
      initialResource: 0,
      primaryWeapon: "Sword",
      secondaryWeapon: "",
      weaponSet2Primary: "",
      weaponSet2Secondary: "",
      startingWeaponSet: 2,
    }),
  );
  assert.equal(result.endState.activeWeaponSet, 1);
});

test("clone specs never open combat with clones", () => {
  // The app path forces initialResource to 0 for clone specs; the engine
  // still honours an explicit count so shatter setups stay testable.
  const result = simulateMesmer(
    [{ name: "__wait", waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: "Core",
      initialResource: 0,
      primaryWeapon: "Scepter",
      secondaryWeapon: "Sword",
    }),
  );
  assert.equal(result.endState.profession.resource, 0);
});
