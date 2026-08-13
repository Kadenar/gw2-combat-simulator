import {
  buildSnapshotFromState,
  cloneRotationItems,
  mergeSnapshotIntoState,
} from "./app-state.js";
import {
  rebuildSimulation,
  runSimulationContributions,
} from "../sim/run/sim-runner.js";
import { moveRotationEntry } from "../../../../platform/ui/timeline.js";

export const LEGACY_ELEMENTALIST_STORAGE_KEY =
  "gw2-elementalist-legacy-simulator-v3";

function normalizeConcurrentOffsetMs(offset) {
  if (offset === null || offset === undefined) return offset;
  return Math.max(1, offset);
}

function normalizeWaitMs(waitMs) {
  if (waitMs === null || waitMs === undefined) return waitMs;
  return Math.max(1, waitMs);
}

export function getStartPistolBullets(app) {
  if (app._presetPistolBullets) return { ...app._presetPistolBullets };
  return null;
}

export function serializeRotation(app) {
  if (!app.sim) return [];
  return cloneRotationItems(app.sim.rotation);
}

export function deserializeRotation(app, items) {
  if (!app.sim || !Array.isArray(items)) return;
  app.sim.clearRotation();
  for (const item of items) app.sim.addSkill(item);
}

/** Append items to the existing rotation without clearing it first. */
export function appendToRotation(app, items) {
  if (!app.sim || !Array.isArray(items)) return;
  for (const item of items) app.sim.addSkill(item);
}

export function buildSnapshot(app) {
  return buildSnapshotFromState({
    build: app.build,
    selectedSkills: app.selectedSkills,
    activeAttunement: app.activeAttunement,
    secondaryAttunement: app.secondaryAttunement,
    evokerElement: app.evokerElement,
    evokerStartCharges: app.evokerStartCharges,
    evokerStartEmpowered: app.evokerStartEmpowered,
    permaBoons: app.permaBoons,
    permaField: app.permaField,
    rotation: serializeRotation(app),
    hitboxSize: app.hitboxSize,
    glyphBoonedElementals: app.glyphBoonedElementals,
    thornsBossAuraOnly: app.thornsBossAuraOnly,
  });
}

export function applySnapshot(app, state) {
  const merged = mergeSnapshotIntoState(
    {
      build: app.build,
      activeAttunement: app.activeAttunement,
      secondaryAttunement: app.secondaryAttunement,
      evokerElement: app.evokerElement,
      evokerStartCharges: app.evokerStartCharges,
      evokerStartEmpowered: app.evokerStartEmpowered,
      permaBoons: app.permaBoons,
      permaField: app.permaField,
      selectedSkills: app.selectedSkills,
      hitboxSize: app.hitboxSize,
      glyphBoonedElementals: app.glyphBoonedElementals,
      thornsBossAuraOnly: app.thornsBossAuraOnly,
    },
    state,
    app.data?.skills,
  );

  app.build = merged.build;
  app.activeAttunement = merged.activeAttunement;
  app.secondaryAttunement = merged.secondaryAttunement;
  app.evokerElement = merged.evokerElement;
  app.evokerStartCharges = merged.evokerStartCharges;
  app.evokerStartEmpowered = merged.evokerStartEmpowered;
  app.permaBoons = merged.permaBoons;
  app.permaField = merged.permaField || "";
  app.selectedSkills = merged.selectedSkills;
  app.hitboxSize = merged.hitboxSize || "large";
  app.glyphBoonedElementals = !!merged.glyphBoonedElementals;
  app.thornsBossAuraOnly = !!merged.thornsBossAuraOnly;

  if (merged.rotation) {
    if (app.sim) deserializeRotation(app, merged.rotation);
    else app._pendingRotation = merged.rotation;
  }
}

export function persistBuild(app) {
  try {
    localStorage.setItem(
      LEGACY_ELEMENTALIST_STORAGE_KEY,
      JSON.stringify(buildSnapshot(app)),
    );
  } catch (_) {
    /* localStorage unavailable */
  }
}

export function restoreBuild(app) {
  try {
    const raw = localStorage.getItem(LEGACY_ELEMENTALIST_STORAGE_KEY);
    if (!raw) return;
    applySnapshot(app, JSON.parse(raw));
  } catch (_) {
    /* corrupt or missing */
  }
}

export function onBuildChange(app) {
  const rotation = app.sim ? cloneRotationItems(app.sim.rotation) : [];
  const rebuilt = rebuildSimulation({
    data: app.data,
    build: app.build,
    selectedSkills: app.selectedSkills,
    rotation,
    hitboxSize: app.hitboxSize,
    glyphBoonedElementals: app.glyphBoonedElementals,
    thornsBossAuraOnly: app.thornsBossAuraOnly,
  });
  app.data.attributes = rebuilt.attributes;
  app.sim = rebuilt.sim;

  const elite = app._getEliteSpec();
  if (elite === "Evoker" && !app.evokerElement) {
    app.evokerElement = "Fire";
  } else if (elite !== "Evoker") {
    app.evokerElement = null;
  }

  app.renderTraits();
  app.renderAttributes();
  app.renderConditions();
  app.renderAttunementBar();
  app.renderWeaponBar();
  app.renderSkillBar();
  app.renderSkillInfoTable();
  app._renderStartAttSelector();

  if (app.sim.rotation.length > 0) autoRun(app);
  else app._renderPalette();

  persistBuild(app);
}

function updateGlyphBoonedVisibility(app) {
  const wrap = document.getElementById("glyph-booned-wrap");
  if (!wrap) return;
  const hasGlyph = app.sim?.rotation.some(
    (item) =>
      (typeof item === "string" ? item : item?.name) === "Glyph of Elementals",
  );
  wrap.style.display = hasGlyph ? "" : "none";
}

function updateThornsOptionVisibility(app) {
  const wrap = document.getElementById("thorns-boss-aura-wrap");
  if (!wrap) return;
  wrap.style.display = app.build?.relic === "Thorns" ? "" : "none";
}

export function updateSpecialOptionVisibility(app) {
  updateGlyphBoonedVisibility(app);
  updateThornsOptionVisibility(app);
}

export function autoRun(app) {
  if (!app.sim || app.sim.rotation.length === 0) {
    app.sim.results = null;
    app._renderPalette();
    app._renderTimeline();
    document.getElementById("rotation-results").innerHTML = "";
    app._updateOptimizerVisibility(false);
    updateSpecialOptionVisibility(app);
    persistBuild(app);
    return;
  }

  runSimulationContributions({
    sim: app.sim,
    activeAttunement: app.activeAttunement,
    secondaryAttunement: app.secondaryAttunement,
    evokerElement: app.evokerElement,
    startEvokerCharges: app.evokerStartCharges,
    startEvokerEmpowered: app.evokerStartEmpowered,
    permaBoons: app.permaBoons,
    permaField: app.permaField,
    targetHP: app._getTargetHP(),
    startPistolBullets: getStartPistolBullets(app),
  });

  app._renderPalette();
  app._renderTimeline();
  app._renderResults();
  app._updateOptimizerVisibility(true);
  updateSpecialOptionVisibility(app);
  persistBuild(app);
}

function buildRotationItem(
  skillName,
  { offset = null, gapFill = false, interruptMs = null, waitMs = null } = {},
) {
  const item = { name: skillName };
  if (offset !== null) item.offset = normalizeConcurrentOffsetMs(offset);
  if (gapFill) item.gapFill = true;
  if (interruptMs !== null) item.interruptMs = interruptMs;
  if (waitMs !== null) item.waitMs = normalizeWaitMs(waitMs);
  return Object.keys(item).length === 1 ? skillName : item;
}

export function addToRotation(app, skillName, options = {}) {
  if (!app.sim) return;
  app.sim.addSkill(buildRotationItem(skillName, options));
  autoRun(app);
}

export function insertIntoRotation(app, idx, skillName, options = {}) {
  if (!app.sim) return;
  const insertAt = Math.max(0, Math.min(idx, app.sim.rotation.length));
  app.sim.rotation.splice(insertAt, 0, buildRotationItem(skillName, options));
  autoRun(app);
}

export function moveRotationItem(app, fromIdx, toIdx) {
  if (!app.sim) return;
  const rotation = app.sim.rotation;
  if (!moveRotationEntry(rotation, fromIdx, toIdx)) return;
  autoRun(app);
}

export function removeFromRotation(app, idx) {
  if (!app.sim) return;
  app.sim.removeSkill(idx);
  autoRun(app);
}

export function truncateRotationAfter(app, idx) {
  if (!app.sim) return;
  const rotation = app.sim.rotation;
  if (idx < -1 || idx >= rotation.length) return;
  const nextLength = idx + 1;
  if (rotation.length <= nextLength) return;
  rotation.splice(nextLength);
  autoRun(app);
}

export function clearRotation(app) {
  if (!app.sim) return;
  app.sim.clearRotation();
  app._renderPalette();
  app._renderTimeline();
  document.getElementById("rotation-results").innerHTML = "";
  updateSpecialOptionVisibility(app);
  persistBuild(app); // persist the empty rotation so a page refresh doesn't restore the old one
}

export function refreshAfterBuildStateChange(app) {
  onBuildChange(app);
  app.render();
}

export function applyLoadedBuildState(app, state, rotationItems = undefined) {
  applySnapshot(app, state);
  if (rotationItems !== undefined) deserializeRotation(app, rotationItems);
  refreshAfterBuildStateChange(app);
}
