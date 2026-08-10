import { readFile } from "node:fs/promises";
import { migrateGuardianBuild } from "./js/professions/guardian/build.js";
import { guardianCatalog } from "./js/professions/guardian/catalog.js";
import {
  recalculate as recalculateGuardian,
  runSimulation as runGuardianSimulation,
} from "./js/professions/guardian/app/app-definition.js";

const savedBuild = JSON.parse(await readFile("./Builds/guardian/b-power-luminary.json", "utf8"));
const savedRotation = JSON.parse(await readFile("./Rotations/guardian/r-power-luminary-bench.json", "utf8"));
const build = migrateGuardianBuild({ ...savedBuild, rotation: savedRotation.rotation });
const app = { build, skillByName: guardianCatalog.skillsByName, attributeWeaponSet: 1 };
recalculateGuardian(app);
const result = runGuardianSimulation(app);

// Replicate criticalChanceAt: nearest resolved strike (prefer at/after, else before).
function critAt(seconds) {
  let after = null, afterAt = Infinity, before = null, beforeAt = -Infinity, afterEv = null, beforeEv = null;
  for (const e of result.resolvedEvents || []) {
    if (e.independentSummonStrike === true) continue;
    if (e.source === "Clone" || e.source === "Phantasm") continue;
    const c = Number(e.criticalChance);
    if (!Number.isFinite(c)) continue;
    const at = Number(e.at || 0);
    if (at >= seconds) { if (at < afterAt) { afterAt = at; after = c; afterEv = e; } }
    else if (at > beforeAt) { beforeAt = at; before = c; beforeEv = e; }
  }
  return { chance: after ?? before, ev: afterEv ?? beforeEv };
}

// Direct: list resolved events whose criticalChance is 0 (would show 0% in bar).
console.log("== zero-crit resolved events ==");
for (const e of result.resolvedEvents || []) {
  const c = Number(e.criticalChance);
  if (!Number.isFinite(c) || c > 0.001) continue;
  console.log(
    `  at=${Number(e.at).toFixed(3)} type=${e.type} name=${e.name||e.skillName} crit=${c} noCrit=${e.noCrit} canCrit=${e.canCrit} flat=${e.flatDamage ?? e.flatStrikeBase ?? e.flatStrikePowerCoeff} coef=${e.coefficient} src=${e.source}`,
  );
}
console.log("== end zero-crit ==\n");

const names = ["Whirling Wrath", "Leap of Faith", "Helio Rush"];
const steps = result.steps || [];
const sampleEnd = Number(steps.find((s) => s.skill)?.end ?? 0);
// end appears to be ms if large; resolvedEvents.at is seconds. Detect scale.
const endToSec = (v) => (Number(v) > 100 ? Number(v) / 1000 : Number(v));
for (const s of steps) {
  const nm = s.skill?.name;
  if (!names.includes(nm)) continue;
  const endSec = endToSec(s.end);
  const { chance, ev } = critAt(endSec);
  console.log(
    `after ${nm} @${endSec.toFixed(3)}s -> crit ${chance == null ? "null" : (chance*100).toFixed(0)+"%"}`,
    `| picked: at=${Number(ev?.at).toFixed(3)} name=${ev?.name||ev?.skillName} noCrit=${ev?.noCrit} canCrit=${ev?.canCrit} flat=${ev?.flatDamage ?? ev?.flatStrikeBase ?? ev?.flatStrikePowerCoeff} coef=${ev?.coefficient} src=${ev?.source}`,
  );
}
console.log("sampleEnd raw:", sampleEnd);
const names2 = new Set(steps.map((s) => s.skill?.name).filter(Boolean));
console.log("unique step skills:", [...names2].join(" | "));
console.log("sample step:", JSON.stringify({ ...steps[0], skill: steps[0]?.skill?.name }, null, 0).slice(0, 300));
