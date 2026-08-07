import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { mesmerCatalog } from "../../js/professions/mesmer/catalog.js";
import { defaultSimulationConfig } from "../../tests/helpers/fixture-harness-core.js";
import { normalizeMesmerResult } from "../../tests/helpers/mesmer-simulation-oracle.js";
import { simulateMesmer } from "../../tests/helpers/mesmer-simulation.js";

const FIXTURE_DIRECTORY = path.resolve("tests", "fixtures", "mesmer-migration");
const requestedFiles = new Set(process.argv.slice(2));

const wait = (durationMs) => ({ type: "wait", durationMs });
const combatStart = () => ({ type: "combat-start" });
const cast = (name, options = {}) => {
  const skill = mesmerCatalog.skillsByName.get(name);
  if (!skill) throw new Error(`Unknown Mesmer fixture skill ${name}.`);
  return { type: "cast", skillId: skill.id, ...options };
};

const fixtures = [
  {
    file: "simple-strike-condition.json",
    name: "simple strike and condition",
    rotation: [cast("Bladecall"), wait(1000)],
    config: {},
  },
  {
    file: "concurrent-cooldown.json",
    name: "serial and concurrent cooldown wait",
    rotation: [
      cast("Bladecall"),
      cast("Bladecall", { concurrentOffsetMs: 100 }),
      cast("Bladecall"),
    ],
    config: {},
  },
  {
    file: "interrupt-and-instant.json",
    name: "wait combat start interrupt and instant",
    rotation: [
      cast("Confusing Images"),
      cast("Blink", { concurrentOffsetMs: 100 }),
      combatStart(),
      wait(250),
    ],
    config: { specialization: "Core", primaryWeapon: "Scepter" },
  },
  {
    file: "weapon-swap-chain.json",
    name: "weapon swap and autoattack chain",
    rotation: [cast("Ether Bolt"), cast("Ether Blast"), cast("Swap Weapons")],
    config: {
      specialization: "Core",
      primaryWeapon: "Scepter",
      weaponSet2Primary: "Sword",
      initialResource: 0,
    },
  },
  {
    file: "flip-and-ammo.json",
    name: "flip and ammo mantra",
    rotation: [
      cast("Temporal Curtain"),
      cast("Into the Void"),
      cast("Power Spike"),
    ],
    config: {
      specialization: "Core",
      primaryWeapon: "",
      secondaryWeapon: "",
    },
  },
  {
    file: "clone-shatter.json",
    name: "clone creation attacks and shatter",
    rotation: [cast("Mirror Images"), wait(3000), cast("Mind Wrack")],
    config: { specialization: "Core", initialResource: 0 },
  },
  {
    file: "chronophantasma.json",
    name: "phantasm repeat and conversion",
    rotation: [cast("Phantasmal Warlock"), wait(5000)],
    config: {
      specialization: "Chronomancer",
      selectedTraits: ["Chronophantasma"],
      primaryWeapon: "Staff",
      initialResource: 0,
    },
  },
  {
    file: "virtuoso-expected-procs.json",
    name: "virtuoso expected blade generation",
    rotation: [cast("Phantasmal Duelist"), wait(5000)],
    config: {
      specialization: "Virtuoso",
      selectedTraits: ["Bloodsong", "Sharper Images"],
      secondaryWeapon: "Pistol",
      initialResource: 0,
    },
  },
  {
    file: "mirage-ambush.json",
    name: "mirage cloak and ambush",
    rotation: [cast("Dodge / Mirage Cloak"), cast("Imaginary Axes")],
    config: {
      specialization: "Mirage",
      primaryWeapon: "Axe",
      secondaryWeapon: "Pistol",
      initialResource: 0,
    },
  },
  {
    file: "troubadour-instruments.json",
    name: "troubadour instruments",
    rotation: [cast("Lively Lute"), cast("Crescendo")],
    config: { specialization: "Troubadour", initialResource: 0 },
  },
  {
    file: "continuum.json",
    name: "continuum manual restore",
    rotation: [
      cast("Continuum Split"),
      cast("Chaos Storm"),
      cast("Continuum Shift"),
    ],
    config: {
      specialization: "Chronomancer",
      primaryWeapon: "Staff",
      initialResource: 3,
    },
  },
  {
    file: "relic-and-public-state.json",
    name: "relic target and public state",
    rotation: [cast("Blurred Frenzy"), wait(1000)],
    config: {
      specialization: "Core",
      primaryWeapon: "Sword",
      relic: "Thief",
      initialResource: 0,
    },
  },
];

await mkdir(FIXTURE_DIRECTORY, { recursive: true });
for (const fixture of fixtures) {
  if (requestedFiles.size && !requestedFiles.has(fixture.file)) continue;
  const config = defaultSimulationConfig(fixture.config);
  const expected = normalizeMesmerResult(
    simulateMesmer(fixture.rotation, config),
  );
  const document = {
    name: fixture.name,
    rotation: fixture.rotation,
    config: fixture.config,
    expected,
  };
  await writeFile(
    path.join(FIXTURE_DIRECTORY, fixture.file),
    `${JSON.stringify(document, null, 2)}\n`,
  );
}
