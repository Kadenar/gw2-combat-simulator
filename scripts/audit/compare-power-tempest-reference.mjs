import { readFile } from "node:fs/promises";

import {
  loadSkillHits as loadReferenceSkillHits,
  loadSkills as loadReferenceSkills,
} from "../../reference-repos/Elementalist-Simulator/js/data/csv-loader.js";
import {
  calcBuildAttributes as calculateReferenceAttributes,
  createSimulationEngine as createReferenceEngine,
} from "../../reference-repos/Elementalist-Simulator/js/sim/run/sim-runner.js";
import {
  loadSkillHits as loadLegacySkillHits,
  loadSkills as loadLegacySkills,
} from "../../js/professions/elementalist/legacy/data/csv-loader.js";
import {
  calcBuildAttributes as calculateLegacyAttributes,
  createSimulationEngine as createLegacyEngine,
} from "../../js/professions/elementalist/legacy/sim/run/sim-runner.js";
import {
  elementalistAppAdapter,
  recalculate,
  runSimulation,
} from "../../js/professions/elementalist/app/app-definition.js";

const repositoryRoot = new URL("../../", import.meta.url);
const referenceRoot = new URL(
  "reference-repos/Elementalist-Simulator/",
  repositoryRoot,
);
const availableVariants = [
  "cele-alac-tempest",
  "condi-alac-tempest-pistol",
  "condi-alac-tempest-scepter",
  "condi-tempest-pistol-warhorn",
  "condi-tempest-scepter",
  "inferno-alac-tempest",
  "inferno-tempest",
  "power-alac-tempest-hammer",
  "power-alac-tempest-sword",
  "power-tempest-hammer",
  "power-tempest-scepter",
  "power-tempest-spear",
  "power-tempest-sword",
];
const requestedVariant = process.argv
  .find((argument) => argument.startsWith("--variant="))
  ?.slice("--variant=".length);
if (requestedVariant && !availableVariants.includes(requestedVariant)) {
  throw new Error(`Unknown Tempest variant: ${requestedVariant}`);
}
const variants = requestedVariant ? [requestedVariant] : availableVariants;
const requestedSkill = process.argv
  .find((argument) => argument.startsWith("--skill="))
  ?.slice("--skill=".length);
const summaryOnly = process.argv.includes("--summary");
const check = process.argv.includes("--check");

async function readText(root, path) {
  return readFile(new URL(path, root), "utf8");
}

async function readJson(root, path) {
  return JSON.parse(await readText(root, path));
}

async function loadData(root, directory, loadSkills, loadSkillHits) {
  const [skillsText, hitsText] = await Promise.all([
    readText(root, `${directory}/Tool_Elementalist - Skills_data.csv`),
    readText(root, `${directory}/Tool_Elementalist - Skill_hits_data.csv`),
  ]);
  return {
    skills: loadSkills(skillsText),
    skillHits: loadSkillHits(hitsText),
  };
}

function selectedSkills(snapshot, skills) {
  return Object.fromEntries(
    Object.entries(snapshot.selectedSkills || {}).map(([slot, name]) => [
      slot,
      skills.find((skill) => skill.name === name),
    ]),
  );
}

function runStandalone(
  snapshot,
  rotation,
  data,
  calculateAttributes,
  createEngine,
) {
  const attributes = calculateAttributes(
    snapshot.build,
    selectedSkills(snapshot, data.skills),
  );
  const engine = createEngine(data, attributes, {
    hitboxSize: snapshot.hitboxSize,
    glyphBoonedElementals: snapshot.glyphBoonedElementals,
    thornsBossAuraOnly: snapshot.thornsBossAuraOnly,
  });
  engine.rotation = rotation;
  return engine.run(
    snapshot.activeAttunement,
    snapshot.secondaryAttunement || null,
    snapshot.evokerElement || null,
    snapshot.permaBoons || {},
    null,
    0,
    null,
    null,
    snapshot.evokerStartCharges ?? 6,
    snapshot.evokerStartEmpowered ?? 0,
  );
}

function runNative(snapshot, rotation) {
  const build = {
    ...elementalistAppAdapter.toApplicationBuild({
      ...snapshot,
      rotation,
    }),
    // The reference uses an effectively unkillable target but stops scoring at
    // rotation end. A positive sentinel selects that existing native mode.
    targetHealth: Number.MAX_SAFE_INTEGER,
    rotation,
  };
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistAppAdapter.profession,
    skillByName: elementalistAppAdapter.profession.catalog.skillsByName,
    skillById: elementalistAppAdapter.profession.catalog.skillsById,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  return runSimulation(app);
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
}

function standaloneSkillDamage(result) {
  return Object.fromEntries(
    Object.entries(result.perSkill || {}).map(([name, entry]) => [
      name,
      round(Number(entry.strike || 0) + Number(entry.condition || 0)),
    ]),
  );
}

function nativeSkillDamage(result) {
  const damage = new Map();
  for (const entry of result.breakdown || []) {
    const name = entry.parentSkill || entry.sourceSkill || entry.name;
    damage.set(name, (damage.get(name) || 0) + Number(entry.damage || 0));
  }
  return Object.fromEntries(
    [...damage].map(([name, total]) => [name, round(total)]),
  );
}

function topSkills(skillDamage, limit = 15) {
  return Object.entries(skillDamage)
    .map(([name, damage]) => ({ name, damage }))
    .sort((left, right) => right.damage - left.damage)
    .slice(0, limit);
}

function rotationSteps(result) {
  return (result.steps || []).filter(
    (step) => Number.isInteger(step.ri) && step.ri >= 0,
  );
}

function compareTimelines(candidateResult, baselineResult) {
  const baselineSteps = rotationSteps(baselineResult);
  const candidateByIndex = new Map(
    rotationSteps(candidateResult).map((step) => [step.ri, step]),
  );
  let previousStartDelta = 0;
  const changes = [];
  for (const baseline of baselineSteps) {
    const candidate = candidateByIndex.get(baseline.ri);
    if (!candidate) {
      changes.push({
        rotationIndex: baseline.ri,
        skill: baseline.skill,
        missingFromCandidate: true,
      });
      continue;
    }
    const startDeltaMs = round(candidate.start - baseline.start);
    const durationDeltaMs = round(
      candidate.end - candidate.start - (baseline.end - baseline.start),
    );
    const driftChangeMs = round(startDeltaMs - previousStartDelta);
    previousStartDelta = startDeltaMs;
    if (Math.abs(durationDeltaMs) >= 1 || Math.abs(driftChangeMs) >= 1) {
      changes.push({
        rotationIndex: baseline.ri,
        skill: baseline.skill,
        candidateSkill: candidate.skill,
        baselineStartMs: round(baseline.start),
        candidateStartMs: round(candidate.start),
        startDeltaMs,
        driftChangeMs,
        durationDeltaMs,
      });
    }
  }
  return {
    baselineRotationSteps: baselineSteps.length,
    candidateRotationSteps: candidateByIndex.size,
    changes,
  };
}

function largestSkillDeltas(candidate, baseline, limit = 15) {
  return [...new Set([...Object.keys(candidate), ...Object.keys(baseline)])]
    .map((name) => ({
      name,
      baselineDamage: round(baseline[name]),
      candidateDamage: round(candidate[name]),
      damageDelta: round((candidate[name] || 0) - (baseline[name] || 0)),
    }))
    .sort(
      (left, right) => Math.abs(right.damageDelta) - Math.abs(left.damageDelta),
    )
    .slice(0, limit);
}

function summarizeStandalone(result) {
  const skillDamage = standaloneSkillDamage(result);
  return {
    dps: round(result.dps),
    totalDamage: round(result.totalDamage),
    strikeDamage: round(result.totalStrike),
    conditionDamage: round(result.totalCondition),
    durationSeconds: round(Number(result.dpsWindowMs || 0) / 1000, 6),
    rotationSeconds: round(Number(result.rotationMs || 0) / 1000, 6),
    stepCount: rotationSteps(result).length,
    warningCount: result.warnings?.length || 0,
    conditionBreakdown: Object.fromEntries(
      Object.keys(result.condDamage || {}).map((condition) => [
        condition,
        {
          damage: round(result.condDamage[condition]),
          stackSeconds: round(result.condStackSeconds?.[condition]),
        },
      ]),
    ),
    skillDamage,
    skillDetails: result.perSkill || {},
    topSkills: topSkills(skillDamage),
  };
}

function summarizeNative(result) {
  const skillDamage = nativeSkillDamage(result);
  const postRotationDamage = (result.resolvedEvents || [])
    .filter(
      (event) =>
        Number(event.at) > Number(result.duration) && Number(event.damage) > 0,
    )
    .reduce((total, event) => total + Number(event.damage || 0), 0);
  const rotationWindowSeconds = Math.max(
    0,
    Number(result.duration) - Number(result.dpsStartTime || 0),
  );
  const rotationWindowDamage = Number(result.totalDamage);
  return {
    dps: round(result.dps),
    totalDamage: round(result.totalDamage),
    strikeDamage: round(result.strikeDamage),
    conditionDamage: round(result.conditionDamage),
    durationSeconds: round(result.dpsWindow, 6),
    rotationSeconds: round(result.duration, 6),
    dpsStartSeconds: round(result.dpsStartTime, 6),
    firstHitSeconds: round(result.firstHitTime, 6),
    lastHitSeconds: round(result.lastHitTime, 6),
    postRotationDamage: round(postRotationDamage),
    rotationWindowDamage: round(rotationWindowDamage),
    rotationWindowDps: round(
      rotationWindowDamage / Math.max(rotationWindowSeconds, 1),
    ),
    stepCount: rotationSteps(result).length,
    warningCount: result.warnings?.length || 0,
    warnings: result.warnings || [],
    conditionBreakdown: Object.fromEntries(
      (result.conditionBreakdown || []).map((entry) => [
        entry.name,
        {
          damage: round(entry.damage),
          stackSeconds: round(entry.averageStacks * result.dpsWindow),
        },
      ]),
    ),
    skillDamage,
    skillDetails: result.breakdown || [],
    topSkills: topSkills(skillDamage),
  };
}

function percentageDelta(actual, baseline) {
  return round(((actual - baseline) / Math.max(1, Math.abs(baseline))) * 100);
}

function compare(candidate, baseline) {
  return {
    dpsPercent: percentageDelta(candidate.dps, baseline.dps),
    totalDamagePercent: percentageDelta(
      candidate.totalDamage,
      baseline.totalDamage,
    ),
    strikeDamagePercent: percentageDelta(
      candidate.strikeDamage,
      baseline.strikeDamage,
    ),
    conditionDamagePercent: percentageDelta(
      candidate.conditionDamage,
      baseline.conditionDamage,
    ),
    durationPercent: percentageDelta(
      candidate.durationSeconds,
      baseline.durationSeconds,
    ),
  };
}

const [referenceData, legacyData] = await Promise.all([
  loadData(
    referenceRoot,
    "csv input",
    loadReferenceSkills,
    loadReferenceSkillHits,
  ),
  loadData(
    new URL("js/professions/elementalist/legacy/data/", repositoryRoot),
    "csv",
    loadLegacySkills,
    loadLegacySkillHits,
  ),
]);

const results = {};
for (const variant of variants) {
  const [snapshot, savedRotation, localSnapshot, localSavedRotation] =
    await Promise.all([
      readJson(referenceRoot, `Builds/b-${variant}.json`),
      readJson(referenceRoot, `Rotations/r-${variant}.json`),
      readJson(repositoryRoot, `Builds/elementalist/b-${variant}.json`),
      readJson(repositoryRoot, `Rotations/elementalist/r-${variant}.json`),
    ]);
  const rotation = savedRotation.rotation;
  const referenceResult = runStandalone(
    snapshot,
    rotation,
    referenceData,
    calculateReferenceAttributes,
    createReferenceEngine,
  );
  const legacyResult = runStandalone(
    snapshot,
    rotation,
    legacyData,
    calculateLegacyAttributes,
    createLegacyEngine,
  );
  const nativeResult = runNative(snapshot, rotation);
  const reference = summarizeStandalone(referenceResult);
  const legacy = summarizeStandalone(legacyResult);
  const native = summarizeNative(nativeResult);
  results[variant] = {
    localFixtureDrift: {
      buildDiffers: JSON.stringify(localSnapshot) !== JSON.stringify(snapshot),
      rotationDiffers:
        JSON.stringify(localSavedRotation.rotation) !==
        JSON.stringify(rotation),
    },
    reference,
    legacy,
    native,
    deltaFromReference: {
      legacy: compare(legacy, reference),
      native: compare(native, reference),
    },
    largestDamageDeltasFromReference: {
      legacy: largestSkillDeltas(legacy.skillDamage, reference.skillDamage),
      native: largestSkillDeltas(native.skillDamage, reference.skillDamage),
    },
    timelineDeltaFromReference: {
      legacy: compareTimelines(legacyResult, referenceResult),
      native: compareTimelines(nativeResult, referenceResult),
    },
    ...(requestedSkill
      ? {
          skillEventDiagnostics: {
            reference: (referenceResult.log || []).filter(
              (event) =>
                event.skill === requestedSkill ||
                event.cond === requestedSkill ||
                event.source === requestedSkill ||
                event.trait === requestedSkill ||
                event.relic === requestedSkill,
            ),
            legacy: (legacyResult.log || []).filter(
              (event) =>
                event.skill === requestedSkill ||
                event.cond === requestedSkill ||
                event.source === requestedSkill ||
                event.trait === requestedSkill ||
                event.relic === requestedSkill,
            ),
            native: [
              ...(nativeResult.events || []),
              ...(nativeResult.resolvedEvents || []),
            ].filter(
              (event) =>
                event.skillName === requestedSkill ||
                event.parentSkillName === requestedSkill ||
                event.name === requestedSkill ||
                event.source === requestedSkill ||
                event.kind === requestedSkill ||
                event.condition === requestedSkill,
            ),
          },
        }
      : {}),
  };
}

const summary = Object.fromEntries(
  variants.map((variant) => {
    const result = results[variant];
    return [
      variant,
      {
        referenceDps: result.reference.dps,
        legacyDps: result.legacy.dps,
        nativeDps: result.native.dps,
        legacyDpsDeltaPercent: result.deltaFromReference.legacy.dpsPercent,
        nativeDpsDeltaPercent: result.deltaFromReference.native.dpsPercent,
        nativeDurationDeltaPercent:
          result.deltaFromReference.native.durationPercent,
        nativeTimelineChanges:
          result.timelineDeltaFromReference.native.changes.length,
        nativeWarnings: result.native.warningCount,
      },
    ];
  }),
);

if (check) {
  const failures = Object.entries(summary).flatMap(([variant, result]) => {
    const reasons = [];
    if (Math.abs(result.nativeDpsDeltaPercent) > 1.2) {
      reasons.push(`DPS delta ${result.nativeDpsDeltaPercent}% exceeds 1.2%`);
    }
    if (Math.abs(result.nativeDurationDeltaPercent) > 0.15) {
      reasons.push(
        `duration delta ${result.nativeDurationDeltaPercent}% exceeds 0.15%`,
      );
    }
    if (result.nativeTimelineChanges > 3) {
      reasons.push(
        `${result.nativeTimelineChanges} timeline changes exceeds 3`,
      );
    }
    if (result.nativeWarnings > 0) {
      reasons.push(`${result.nativeWarnings} native warnings`);
    }
    return reasons.map((reason) => `${variant}: ${reason}`);
  });
  if (failures.length) {
    process.stderr.write(`${failures.join("\n")}\n`);
    process.exitCode = 1;
  }
}

process.stdout.write(
  `${JSON.stringify(summaryOnly || check ? summary : results, null, 2)}\n`,
);
