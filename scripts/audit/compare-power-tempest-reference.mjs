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
const damagingConditions = new Set([
  "Bleeding",
  "Burning",
  "Confusion",
  "Poisoned",
  "Torment",
]);

function matchesRequestedSkill(event) {
  if (!requestedSkill) return false;
  if (requestedSkill === "*") return true;
  const requested = requestedSkill.toLowerCase();
  return [
    event.skill,
    event.skillName,
    event.parentSkillName,
    event.cond,
    event.condition,
    event.source,
    event.trait,
    event.relic,
    event.name,
    event.kind,
  ].some((value) => String(value || "").toLowerCase() === requested);
}

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

function canonicalSkillName(name) {
  return name === "Relic of the Fractal" ? "Relic of Fractal" : name;
}

function addSkillDamage(damage, name, amount) {
  const canonicalName = canonicalSkillName(name);
  damage.set(canonicalName, (damage.get(canonicalName) || 0) + Number(amount));
}

function standaloneSkillDamage(result) {
  const damage = new Map();
  for (const [name, entry] of Object.entries(result.perSkill || {})) {
    addSkillDamage(
      damage,
      name,
      Number(entry.strike || 0) + Number(entry.condition || 0),
    );
  }
  return Object.fromEntries(
    [...damage].map(([name, total]) => [name, round(total)]),
  );
}

function nativeSkillDamage(result) {
  const damage = new Map();
  for (const entry of result.breakdown || []) {
    const name = entry.parentSkill || entry.sourceSkill || entry.name;
    addSkillDamage(damage, name, entry.damage || 0);
  }
  return Object.fromEntries(
    [...damage].map(([name, total]) => [name, round(total)]),
  );
}

function standaloneSkillMetrics(result) {
  const metrics = new Map();
  for (const [name, entry] of Object.entries(result.perSkill || {})) {
    const canonicalName = canonicalSkillName(name);
    const current = metrics.get(canonicalName) || {
      strike: 0,
      condition: 0,
      casts: 0,
      hits: 0,
      conditionApplications: 0,
      appliedConditionStackSeconds: 0,
    };
    current.strike += Number(entry.strike || 0);
    current.condition += Number(entry.condition || 0);
    current.casts = Math.max(current.casts, Number(entry.casts || 0));
    current.hits += Number(entry.hits || 0);
    metrics.set(canonicalName, current);
  }
  for (const event of result.log || []) {
    if (event.type !== "cond_apply" || !event.skill) continue;
    const name = canonicalSkillName(event.skill);
    const current = metrics.get(name) || {
      strike: 0,
      condition: 0,
      casts: 0,
      hits: 0,
      conditionApplications: 0,
      appliedConditionStackSeconds: 0,
    };
    current.conditionApplications += 1;
    current.appliedConditionStackSeconds +=
      Number(event.stacks || 0) * (Number(event.durMs || 0) / 1000);
    metrics.set(name, current);
  }
  return Object.fromEntries(metrics);
}

function nativeSkillMetrics(result) {
  const metrics = new Map();
  for (const entry of result.breakdown || []) {
    const name = canonicalSkillName(
      entry.parentSkill || entry.sourceSkill || entry.name,
    );
    const current = metrics.get(name) || {
      strike: 0,
      condition: 0,
      casts: 0,
      hits: 0,
      conditionApplications: 0,
      appliedConditionStackSeconds: 0,
    };
    current.strike += Number(entry.strikeDamage || 0);
    current.condition += Number(entry.conditionDamage || 0);
    current.casts = Math.max(current.casts, Number(entry.casts || 0));
    current.hits += Number(entry.hits || 0);
    metrics.set(name, current);
  }
  for (const event of result.resolvedEvents || []) {
    if (
      event.type !== "condition" ||
      event.effectiveDuration == null ||
      !damagingConditions.has(event.condition)
    ) {
      continue;
    }
    const name = canonicalSkillName(
      event.parentSkillName || event.skillName || event.name,
    );
    const current = metrics.get(name) || {
      strike: 0,
      condition: 0,
      casts: 0,
      hits: 0,
      conditionApplications: 0,
      appliedConditionStackSeconds: 0,
    };
    current.conditionApplications += 1;
    current.appliedConditionStackSeconds +=
      Number(event.stacks || 0) * Number(event.effectiveDuration || 0);
    metrics.set(name, current);
  }
  return Object.fromEntries(metrics);
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
      damageDeltaPercent: percentageDelta(
        candidate[name] || 0,
        baseline[name] || 0,
      ),
    }))
    .sort(
      (left, right) => Math.abs(right.damageDelta) - Math.abs(left.damageDelta),
    )
    .slice(0, limit);
}

function compareSkillMetrics(candidate, baseline, baselineTotalDamage) {
  const materialDamage = Math.max(1000, baselineTotalDamage * 0.001);
  return [...new Set([...Object.keys(candidate), ...Object.keys(baseline)])]
    .map((name) => {
      const baselineMetric = baseline[name] || {};
      const candidateMetric = candidate[name] || {};
      const baselineDamage =
        Number(baselineMetric.strike || 0) +
        Number(baselineMetric.condition || 0);
      const candidateDamage =
        Number(candidateMetric.strike || 0) +
        Number(candidateMetric.condition || 0);
      return {
        name,
        baselineStrike: round(baselineMetric.strike),
        candidateStrike: round(candidateMetric.strike),
        baselineCondition: round(baselineMetric.condition),
        candidateCondition: round(candidateMetric.condition),
        baselineDamage: round(baselineDamage),
        candidateDamage: round(candidateDamage),
        damageDelta: round(candidateDamage - baselineDamage),
        damageDeltaPercent: percentageDelta(candidateDamage, baselineDamage),
        strikeDelta: round(
          Number(candidateMetric.strike || 0) -
            Number(baselineMetric.strike || 0),
        ),
        strikeDeltaPercent: percentageDelta(
          candidateMetric.strike || 0,
          baselineMetric.strike || 0,
        ),
        conditionDelta: round(
          Number(candidateMetric.condition || 0) -
            Number(baselineMetric.condition || 0),
        ),
        conditionDeltaPercent: percentageDelta(
          candidateMetric.condition || 0,
          baselineMetric.condition || 0,
        ),
        baselineCasts: round(baselineMetric.casts),
        candidateCasts: round(candidateMetric.casts),
        baselineHits: round(baselineMetric.hits),
        candidateHits: round(candidateMetric.hits),
        baselineConditionApplications: round(
          baselineMetric.conditionApplications,
        ),
        candidateConditionApplications: round(
          candidateMetric.conditionApplications,
        ),
        baselineAppliedConditionStackSeconds: round(
          baselineMetric.appliedConditionStackSeconds,
        ),
        candidateAppliedConditionStackSeconds: round(
          candidateMetric.appliedConditionStackSeconds,
        ),
        material: Math.max(baselineDamage, candidateDamage) >= materialDamage,
      };
    })
    .sort(
      (left, right) => Math.abs(right.damageDelta) - Math.abs(left.damageDelta),
    );
}

function abilityDivergences(comparisons, baselineTotalDamage) {
  const absoluteTolerance = Math.max(5, baselineTotalDamage * 0.000001);
  return comparisons
    .map((comparison) => {
      const components = [
        {
          name: "total",
          baseline: comparison.baselineDamage,
          candidate: comparison.candidateDamage,
        },
        {
          name: "strike",
          baseline: comparison.baselineStrike,
          candidate: comparison.candidateStrike,
        },
        {
          name: "condition",
          baseline: comparison.baselineCondition,
          candidate: comparison.candidateCondition,
        },
      ];
      const divergentComponents = components
        .filter(
          ({ baseline, candidate }) =>
            Math.abs(candidate - baseline) > absoluteTolerance &&
            Math.abs(percentageDelta(candidate, baseline)) > 2,
        )
        .map(({ name }) => name);
      return { ...comparison, divergentComponents };
    })
    .filter(({ divergentComponents }) => divergentComponents.length > 0);
}

function abilityMechanicDivergences(comparisons) {
  return comparisons
    .map((comparison) => ({
      name: comparison.name,
      baselineConditionApplications: comparison.baselineConditionApplications,
      candidateConditionApplications: comparison.candidateConditionApplications,
      conditionApplicationDelta:
        comparison.candidateConditionApplications -
        comparison.baselineConditionApplications,
      baselineAppliedConditionStackSeconds:
        comparison.baselineAppliedConditionStackSeconds,
      candidateAppliedConditionStackSeconds:
        comparison.candidateAppliedConditionStackSeconds,
      appliedConditionStackSecondsDelta: round(
        comparison.candidateAppliedConditionStackSeconds -
          comparison.baselineAppliedConditionStackSeconds,
      ),
    }))
    .filter(
      (comparison) =>
        comparison.conditionApplicationDelta !== 0 ||
        Math.abs(comparison.appliedConditionStackSecondsDelta) >
          Math.max(
            0.05,
            Math.abs(comparison.baselineAppliedConditionStackSeconds) * 0.001,
          ),
    );
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
    skillMetrics: standaloneSkillMetrics(result),
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
    skillMetrics: nativeSkillMetrics(result),
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
  const referenceSkillMetrics = standaloneSkillMetrics(referenceResult);
  const localLegacySkillMetrics = standaloneSkillMetrics(legacyResult);
  const nativeSkillMetricsResult = nativeSkillMetrics(nativeResult);
  const legacySkillParity = compareSkillMetrics(
    localLegacySkillMetrics,
    referenceSkillMetrics,
    reference.totalDamage,
  );
  const nativeSkillParity = compareSkillMetrics(
    nativeSkillMetricsResult,
    referenceSkillMetrics,
    reference.totalDamage,
  );
  const nativeLegacySkillParity = compareSkillMetrics(
    nativeSkillMetricsResult,
    localLegacySkillMetrics,
    legacy.totalDamage,
  );
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
    deltaFromLegacy: compare(native, legacy),
    largestDamageDeltasFromReference: {
      legacy: largestSkillDeltas(legacy.skillDamage, reference.skillDamage),
      native: largestSkillDeltas(native.skillDamage, reference.skillDamage),
    },
    skillParityFromReference: {
      legacy: legacySkillParity,
      native: nativeSkillParity,
    },
    abilityDivergencesFromReference: {
      legacy: abilityDivergences(legacySkillParity, reference.totalDamage),
      native: abilityDivergences(nativeSkillParity, reference.totalDamage),
    },
    abilityMechanicDivergencesFromReference: {
      legacy: abilityMechanicDivergences(legacySkillParity),
      native: abilityMechanicDivergences(nativeSkillParity),
    },
    skillParityFromLegacy: nativeLegacySkillParity,
    abilityDivergencesFromLegacy: abilityDivergences(
      nativeLegacySkillParity,
      legacy.totalDamage,
    ),
    abilityMechanicDivergencesFromLegacy: abilityMechanicDivergences(
      nativeLegacySkillParity,
    ),
    timelineDeltaFromReference: {
      legacy: compareTimelines(legacyResult, referenceResult),
      native: compareTimelines(nativeResult, referenceResult),
    },
    timelineDeltaFromLegacy: compareTimelines(nativeResult, legacyResult),
    ...(requestedSkill
      ? {
          skillEventDiagnostics: {
            reference: (referenceResult.log || []).filter((event) =>
              matchesRequestedSkill(event),
            ),
            legacy: (legacyResult.log || []).filter((event) =>
              matchesRequestedSkill(event),
            ),
            native: [
              ...(nativeResult.events || []),
              ...(nativeResult.resolvedEvents || []),
            ].filter((event) => matchesRequestedSkill(event)),
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
        nativeDpsDeltaFromLegacyPercent: result.deltaFromLegacy.dpsPercent,
        nativeDurationDeltaPercent:
          result.deltaFromReference.native.durationPercent,
        nativeDurationDeltaFromLegacyPercent:
          result.deltaFromLegacy.durationPercent,
        nativeTimelineChanges:
          result.timelineDeltaFromReference.native.changes.length,
        nativeTimelineChangesFromLegacy:
          result.timelineDeltaFromLegacy.changes.length,
        nativeAbilityDivergences:
          result.abilityDivergencesFromReference.native.length,
        nativeAbilityMechanicDivergences:
          result.abilityMechanicDivergencesFromReference.native.length,
        nativeAbilityDivergencesFromLegacy:
          result.abilityDivergencesFromLegacy.length,
        nativeAbilityMechanicDivergencesFromLegacy:
          result.abilityMechanicDivergencesFromLegacy.length,
        nativeWarnings: result.native.warningCount,
      },
    ];
  }),
);

function summarizeAbilityDivergence(entry) {
  const details = entry.divergentComponents
    .map((component) => {
      const percent =
        component === "total"
          ? entry.damageDeltaPercent
          : entry[`${component}DeltaPercent`];
      return `${component} ${percent > 0 ? "+" : ""}${percent}%`;
    })
    .join("/");
  return `${entry.name} ${details}`;
}

if (check) {
  const failures = Object.entries(summary).flatMap(([variant, result]) => {
    const reasons = [];
    if (Math.abs(result.nativeDpsDeltaPercent) > 1.2) {
      reasons.push(
        `reference DPS delta ${result.nativeDpsDeltaPercent}% exceeds 1.2%`,
      );
    }
    if (Math.abs(result.nativeDpsDeltaFromLegacyPercent) > 1.2) {
      reasons.push(
        `legacy DPS delta ${result.nativeDpsDeltaFromLegacyPercent}% exceeds 1.2%`,
      );
    }
    if (Math.abs(result.nativeDurationDeltaPercent) > 0.15) {
      reasons.push(
        `reference duration delta ${result.nativeDurationDeltaPercent}% exceeds 0.15%`,
      );
    }
    if (Math.abs(result.nativeDurationDeltaFromLegacyPercent) > 0.15) {
      reasons.push(
        `legacy duration delta ${result.nativeDurationDeltaFromLegacyPercent}% exceeds 0.15%`,
      );
    }
    if (result.nativeTimelineChanges > 3) {
      reasons.push(
        `${result.nativeTimelineChanges} timeline changes exceeds 3`,
      );
    }
    if (result.nativeTimelineChangesFromLegacy > 3) {
      reasons.push(
        `${result.nativeTimelineChangesFromLegacy} legacy timeline changes exceeds 3`,
      );
    }
    const abilityDivergences =
      results[variant].abilityDivergencesFromReference.native;
    if (abilityDivergences.length) {
      reasons.push(
        `${abilityDivergences.length} ability damage component deltas exceed 2% (${abilityDivergences
          .slice(0, 5)
          .map(summarizeAbilityDivergence)
          .join(", ")})`,
      );
    }
    const legacyAbilityDivergences =
      results[variant].abilityDivergencesFromLegacy;
    if (legacyAbilityDivergences.length) {
      reasons.push(
        `${legacyAbilityDivergences.length} legacy ability damage component deltas exceed 2% (${legacyAbilityDivergences
          .slice(0, 5)
          .map(summarizeAbilityDivergence)
          .join(", ")})`,
      );
    }
    const legacyAbilityMechanicDivergences =
      results[variant].abilityMechanicDivergencesFromLegacy;
    if (legacyAbilityMechanicDivergences.length) {
      reasons.push(
        `${legacyAbilityMechanicDivergences.length} legacy ability condition application/stack-duration deltas (${legacyAbilityMechanicDivergences
          .slice(0, 5)
          .map((entry) => entry.name)
          .join(", ")})`,
      );
    }
    const abilityMechanicDivergences =
      results[variant].abilityMechanicDivergencesFromReference.native;
    if (abilityMechanicDivergences.length) {
      reasons.push(
        `${abilityMechanicDivergences.length} ability condition application/stack-duration deltas (${abilityMechanicDivergences
          .slice(0, 5)
          .map((entry) => entry.name)
          .join(", ")})`,
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
