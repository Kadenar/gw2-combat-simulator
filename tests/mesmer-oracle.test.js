import test from "node:test";

import {
  assertMesmerResultParity,
} from "./helpers/mesmer-simulation-oracle.js";
import {
  defaultSimulationConfig,
} from "./helpers/fixture-harness-core.js";
import {
  simulateMesmer,
} from "./helpers/mesmer-simulation.js";

const fixtures = [
  {
    name: "simple strike and condition",
    rotation: ["Bladecall", { name: "__wait", waitMs: 1000 }],
    config: {},
  },
  {
    name: "serial and concurrent cooldown wait",
    rotation: ["Bladecall", { name: "Bladecall", offset: 100 }, "Bladecall"],
    config: {},
  },
  {
    name: "wait combat start interrupt and instant",
    rotation: [
      "Confusing Images",
      { name: "Blink", offset: 100 },
      { name: "__combat_start" },
      { name: "__wait", waitMs: 250 },
    ],
    config: { specialization: "Core", primaryWeapon: "Scepter" },
  },
  {
    name: "weapon swap and autoattack chain",
    rotation: ["Ether Bolt", "Ether Blast", "Swap Weapons"],
    config: {
      specialization: "Core",
      primaryWeapon: "Scepter",
      weaponSet2Primary: "Sword",
      initialResource: 0,
    },
  },
  {
    name: "flip and ammo mantra",
    rotation: ["Temporal Curtain", "Into the Void", "Power Spike"],
    config: {
      specialization: "Core",
      primaryWeapon: "",
      secondaryWeapon: "",
    },
  },
  {
    name: "clone creation attacks and shatter",
    rotation: ["Mirror Images", { name: "__wait", waitMs: 3000 }, "Mind Wrack"],
    config: { specialization: "Core", initialResource: 0 },
  },
  {
    name: "phantasm repeat and conversion",
    rotation: ["Phantasmal Warlock", { name: "__wait", waitMs: 5000 }],
    config: {
      specialization: "Chronomancer",
      selectedTraits: ["Chronophantasma"],
      primaryWeapon: "Staff",
      initialResource: 0,
    },
  },
  {
    name: "virtuoso expected blade generation",
    rotation: ["Phantasmal Duelist", { name: "__wait", waitMs: 5000 }],
    config: {
      specialization: "Virtuoso",
      selectedTraits: ["Bloodsong", "Sharper Images"],
      secondaryWeapon: "Pistol",
      initialResource: 0,
    },
  },
  {
    name: "mirage cloak and ambush",
    rotation: ["Dodge / Mirage Cloak", "Imaginary Axes"],
    config: {
      specialization: "Mirage",
      primaryWeapon: "Axe",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    },
  },
  {
    name: "troubadour instruments",
    rotation: ["Lute", "Crescendo"],
    config: { specialization: "Troubadour", initialResource: 0 },
  },
  {
    name: "continuum manual restore",
    rotation: ["Continuum Split", "Chaos Storm", "Continuum Shift"],
    config: {
      specialization: "Chronomancer",
      primaryWeapon: "Staff",
      initialResource: 3,
    },
  },
  {
    name: "relic target and public state",
    rotation: ["Blurred Frenzy", { name: "__wait", waitMs: 1000 }],
    config: {
      specialization: "Core",
      primaryWeapon: "Sword",
      relic: "Thief",
      initialResource: 0,
    },
  },
];

test("Mesmer migration fixture matrix stays deterministic", async t => {
  for (const fixture of fixtures) {
    await t.test(fixture.name, () => {
      const config = defaultSimulationConfig(fixture.config);
      const expected = simulateMesmer(fixture.rotation, config);
      const actual = simulateMesmer(fixture.rotation, config);
      assertMesmerResultParity(fixture.name, expected, actual);
    });
  }
});
