import { escapeHtml as esc } from "../../platform/ui/html.js";
import {
  fetchJsonAsset,
  getRotationItems,
  loadPresetBundle,
} from "./files.js";
import { replaceBuildConfiguration } from "./persistence.js";

function normalizeTemplateSections(manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) return [];
  return manifest[0]?.presets !== undefined
    ? manifest
    : [{ section: null, presets: manifest }];
}

function templateSummary(preset) {
  const details = [preset.rotation ? "Build + rotation" : "Build only"];
  const benchmarkDps = Number(preset.benchmarkDps);
  if (Number.isFinite(benchmarkDps) && benchmarkDps > 0) {
    details.push(`${Math.round(benchmarkDps).toLocaleString("en-US")} DPS`);
  }
  return details.join(" · ");
}

function templateButtonHtml(app, preset, section) {
  const index = app.templatePresets.push({ ...preset, section }) - 1;
  const label = esc(preset.label);
  const rotationAction = preset.rotation
    ? `<button type="button" role="menuitem" data-template-action="rotation" data-template-index="${index}">Load rotation only</button>`
    : "";
  return `<div class="template-preset" data-template-index="${index}">
      <button type="button" class="btn template-load-btn" data-template-action="template" data-template-index="${index}" aria-pressed="false">
        <span class="template-preset-name">${label}</span>
        <span class="template-preset-summary">${esc(templateSummary(preset))}</span>
      </button>
      <details class="template-actions">
        <summary aria-label="More options for ${label}" title="More loading options">•••</summary>
        <div class="template-actions-menu" role="menu">
          <button type="button" role="menuitem" data-template-action="build" data-template-index="${index}">Load build only</button>
          ${rotationAction}
        </div>
      </details>
    </div>`;
}

function templateGroupsHtml(app, manifest) {
  app.templatePresets = [];
  return normalizeTemplateSections(manifest)
    .map((section) => {
      const templates = (section.presets || [])
        .map((preset) =>
          templateButtonHtml(app, preset, section.section || null),
        )
        .join("");
      if (!templates) return "";
      const label = section.section
        ? `<span class="presets-group-label">${esc(section.section)}</span>`
        : "";
      return `<div class="presets-group">${label}<div class="presets-group-btns template-preset-list">${templates}</div></div>`;
    })
    .join("");
}

function buildSignature(build) {
  return JSON.stringify(build);
}

function validateBuildProfession(app, buildData) {
  if (buildData?.profession && buildData.profession !== app.adapter.id) {
    throw new Error(`This is a ${buildData.profession} build.`);
  }
}

function actionLabel(action) {
  if (action === "build") return "build";
  if (action === "rotation") return "rotation";
  return "template";
}

function loadedMessage(preset, action) {
  const name = preset.section
    ? `${preset.section} ${preset.label}`
    : preset.label;
  if (action === "build") return `Loaded the ${name} build only.`;
  if (action === "rotation") return `Loaded the ${name} rotation only.`;
  return `Loaded the ${name} template.`;
}

function showTemplateUndo(app, message, previousBuild) {
  app.templateUndoBuild = previousBuild;
  const toast = app.templateContainer?.querySelector(".template-toast");
  if (!toast) return;
  toast.hidden = false;
  toast.querySelector(".template-toast-message").textContent = message;
}

function closeTemplateMenus(container) {
  container
    ?.querySelectorAll(".template-actions[open]")
    .forEach((details) => details.removeAttribute("open"));
}

export async function initBuildTemplates(app) {
  try {
    const manifest = await fetchJsonAsset(
      `Builds/${app.adapter.id}-manifest.json`,
      { optional: true },
    );
    if (!Array.isArray(manifest) || manifest.length === 0) return;
    const groups = templateGroupsHtml(app, manifest);
    if (!groups) return;

    const container = document.createElement("section");
    container.className = "build-templates";
    container.setAttribute("aria-labelledby", "build-templates-title");
    container.innerHTML = `
      <div class="panel build-templates-panel">
        <div class="build-templates-header">
          <div>
            <h3 id="build-templates-title">Build templates</h3>
            <span>Load a complete build and its matching rotation</span>
          </div>
          <span class="template-actions-hint">••• for partial loading</span>
        </div>
        <div class="default-build-groups">${groups}</div>
        <div class="template-toast" role="status" hidden>
          <span class="template-toast-message"></span>
          <button type="button" data-template-action="undo">Undo</button>
        </div>
      </div>`;
    app.templateContainer = container;
    document.querySelector(".build-section")?.before(container);
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-template-action]");
      if (!button) return;
      const action = button.dataset.templateAction;
      if (action === "undo") {
        undoTemplateLoad(app);
        return;
      }
      const preset = app.templatePresets[Number(button.dataset.templateIndex)];
      if (!preset) return;
      closeTemplateMenus(container);
      loadTemplateAction(app, preset, action, button);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".template-actions")) {
        closeTemplateMenus(container);
      }
    });
    updateTemplateSelection(app);
  } catch {
    // Build templates are optional; import/export remains available without them.
  }
}

export async function loadTemplateAction(app, preset, action, button) {
  const originalContent = button.innerHTML;
  const previousBuild = structuredClone(app.build);
  button.disabled = true;
  button.textContent = "Loading…";
  try {
    if (action === "rotation") {
      const rotationData = await fetchJsonAsset(preset.rotation);
      const rotationItems = getRotationItems(rotationData);
      if (!Array.isArray(rotationItems)) {
        throw new Error("Rotation array missing.");
      }
      app.build.rotation = rotationItems;
      app.currentTemplate = null;
      app.changed(false);
    } else if (action === "build") {
      const buildData = await fetchJsonAsset(preset.build);
      validateBuildProfession(app, buildData);
      app.build = replaceBuildConfiguration(
        buildData,
        app.build,
        app.adapter,
      );
      app.currentTemplate = null;
      app.changed();
    } else {
      const { buildData, rotationItems } = await loadPresetBundle(preset);
      validateBuildProfession(app, buildData);
      if (preset.rotation && !Array.isArray(rotationItems)) {
        throw new Error("Rotation array missing.");
      }
      app.build = replaceBuildConfiguration(
        buildData,
        app.build,
        app.adapter,
      );
      app.build.rotation = Array.isArray(rotationItems) ? rotationItems : [];
      app.changed();
      app.currentTemplate = {
        build: preset.build,
        signature: buildSignature(app.build),
      };
      updateTemplateSelection(app);
    }
    showTemplateUndo(app, loadedMessage(preset, action), previousBuild);
  } catch (error) {
    alert(`Failed to load ${actionLabel(action)}: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

export function updateTemplateSelection(app) {
  const container = app.templateContainer;
  if (!container) return;
  const current = app.currentTemplate;
  const modified =
    current && current.signature !== buildSignature(app.build);
  container
    .querySelectorAll(".template-load-btn")
    .forEach((button) => {
      const preset =
        app.templatePresets[Number(button.dataset.templateIndex)];
      const selected = Boolean(current && preset?.build === current.build);
      button.classList.toggle("template-load-btn--current", selected);
      button.classList.toggle(
        "template-load-btn--modified",
        selected && modified,
      );
      button.setAttribute("aria-pressed", String(selected));
    });
}

export function undoTemplateLoad(app) {
  if (!app.templateUndoBuild) return;
  app.build = app.templateUndoBuild;
  app.templateUndoBuild = null;
  app.currentTemplate = null;
  app.changed();
  const toast = app.templateContainer?.querySelector(".template-toast");
  if (toast) toast.hidden = true;
}
