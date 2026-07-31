import { escapeHtml as esc } from "../../platform/ui/html.js";
import { fetchJsonAsset, getRotationItems, loadPresetBundle } from "./files.js";
import { replaceBuildConfiguration } from "./persistence.js";

import type { LegacyRotationItem } from "../../platform/engine/types.js";
import type {
  BuildTemplatePreset,
  BuildTemplateSection,
  ProfessionAppState,
  ProfessionApplicationBuild,
} from "../profession/types.js";

type TemplateLoadAction = "build" | "rotation" | "template";

function normalizeTemplateSections(manifest: unknown): BuildTemplateSection[] {
  if (!Array.isArray(manifest) || manifest.length === 0) return [];
  const sections = manifest as BuildTemplateSection[];
  return sections[0]?.presets !== undefined
    ? sections
    : [
        {
          section: null,
          presets: manifest as BuildTemplatePreset[],
        },
      ];
}

function templateSummary(preset: BuildTemplatePreset): string {
  const details = [preset.rotation ? "Build + rotation" : "Build only"];
  const benchmarkDps = Number(preset.benchmarkDps);
  if (Number.isFinite(benchmarkDps) && benchmarkDps > 0) {
    details.push(`${Math.round(benchmarkDps).toLocaleString("en-US")} DPS`);
  }
  return details.join(" · ");
}

/**
 * @param {ProfessionAppState} app
 * @param {BuildTemplatePreset} preset
 * @param {string | null} section
 * @returns {string}
 */
function templateButtonHtml(
  app: ProfessionAppState,
  preset: BuildTemplatePreset,
  section: string | null,
): string {
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

/**
 * @param {ProfessionAppState} app
 * @param {unknown} manifest
 * @returns {string}
 */
function templateGroupsHtml(
  app: ProfessionAppState,
  manifest: unknown,
): string {
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

/**
 * @param {ProfessionApplicationBuild} build
 * @returns {string}
 */
function buildSignature(build: ProfessionApplicationBuild): string {
  return JSON.stringify(build);
}

/**
 * @param {ProfessionAppState} app
 * @param {unknown} buildData
 * @returns {void}
 */
function validateBuildProfession(
  app: ProfessionAppState,
  buildData: unknown,
): void {
  if (!buildData || typeof buildData !== "object") return;
  const profession = (buildData as { profession?: unknown }).profession;
  if (profession && profession !== app.adapter.id) {
    throw new Error(`This is a ${String(profession)} build.`);
  }
}

/**
 * @param {TemplateLoadAction} action
 * @returns {string}
 */
function actionLabel(action: TemplateLoadAction): string {
  if (action === "build") return "build";
  if (action === "rotation") return "rotation";
  return "template";
}

/**
 * @param {BuildTemplatePreset} preset
 * @param {TemplateLoadAction} action
 * @returns {string}
 */
function loadedMessage(
  preset: BuildTemplatePreset,
  action: TemplateLoadAction,
): string {
  const name = preset.section
    ? `${preset.section} ${preset.label}`
    : preset.label;
  if (action === "build") return `Loaded the ${name} build only.`;
  if (action === "rotation") return `Loaded the ${name} rotation only.`;
  return `Loaded the ${name} template.`;
}

/**
 * @param {ProfessionAppState} app
 * @param {string} message
 * @param {ProfessionApplicationBuild} previousBuild
 * @returns {void}
 */
function showTemplateUndo(
  app: ProfessionAppState,
  message: string,
  previousBuild: ProfessionApplicationBuild,
): void {
  app.templateUndoBuild = previousBuild;
  const toast =
    app.templateContainer?.querySelector<HTMLElement>(".template-toast");
  if (!toast) return;
  toast.hidden = false;
  const messageElement = toast.querySelector(".template-toast-message");
  if (messageElement) messageElement.textContent = message;
}

/**
 * @param {ParentNode | null | undefined} container
 * @returns {void}
 */
function closeTemplateMenus(container: ParentNode | null | undefined): void {
  container
    ?.querySelectorAll(".template-actions[open]")
    .forEach((details) => details.removeAttribute("open"));
}

/**
 * @param {ProfessionAppState} app
 * @returns {Promise<void>}
 */
export async function initBuildTemplates(
  app: ProfessionAppState,
): Promise<void> {
  try {
    const manifest = await fetchJsonAsset(
      `Builds/${app.adapter.id}/manifest.json`,
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
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-template-action]");
      if (!(button instanceof HTMLButtonElement)) return;
      const action = button.dataset.templateAction;
      if (action === "undo") {
        undoTemplateLoad(app);
        return;
      }
      if (
        action !== "build" &&
        action !== "rotation" &&
        action !== "template"
      ) {
        return;
      }
      const preset = app.templatePresets[Number(button.dataset.templateIndex)];
      if (!preset) return;
      closeTemplateMenus(container);
      loadTemplateAction(app, preset, action, button);
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".template-actions")) {
        closeTemplateMenus(container);
      }
    });
    updateTemplateSelection(app);
  } catch {
    // Build templates are optional; import/export remains available without them.
  }
}

/**
 * @param {ProfessionAppState} app
 * @param {BuildTemplatePreset} preset
 * @param {TemplateLoadAction} action
 * @param {HTMLButtonElement} button
 * @returns {Promise<void>}
 */
export async function loadTemplateAction(
  app: ProfessionAppState,
  preset: BuildTemplatePreset,
  action: TemplateLoadAction,
  button: HTMLButtonElement,
): Promise<void> {
  const originalContent = button.innerHTML;
  const previousBuild = structuredClone(app.build);
  button.disabled = true;
  button.textContent = "Loading…";
  try {
    if (action === "rotation") {
      if (!preset.rotation) {
        throw new Error("Rotation asset missing.");
      }
      const rotationData = await fetchJsonAsset(preset.rotation);
      const rotationItems = getRotationItems(rotationData);
      if (!Array.isArray(rotationItems)) {
        throw new Error("Rotation array missing.");
      }
      app.build.rotation = rotationItems as LegacyRotationItem[];
      app.currentTemplate = null;
      app.changed(false);
    } else if (action === "build") {
      const buildData = await fetchJsonAsset(preset.build);
      validateBuildProfession(app, buildData);
      app.build = replaceBuildConfiguration(buildData, app.build, app.adapter);
      app.currentTemplate = null;
      app.changed();
    } else {
      const { buildData, rotationItems } = await loadPresetBundle(preset);
      validateBuildProfession(app, buildData);
      if (preset.rotation && !Array.isArray(rotationItems)) {
        throw new Error("Rotation array missing.");
      }
      app.build = replaceBuildConfiguration(buildData, app.build, app.adapter);
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
    const message = error instanceof Error ? error.message : String(error);
    alert(`Failed to load ${actionLabel(action)}: ${message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function updateTemplateSelection(app: ProfessionAppState): void {
  const container = app.templateContainer;
  if (!container) return;
  const current = app.currentTemplate;
  const modified = Boolean(
    current && current.signature !== buildSignature(app.build),
  );
  container.querySelectorAll(".template-load-btn").forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    const preset = app.templatePresets[Number(button.dataset.templateIndex)];
    const selected = Boolean(current && preset?.build === current.build);
    button.classList.toggle("template-load-btn--current", selected);
    button.classList.toggle(
      "template-load-btn--modified",
      selected && modified,
    );
    button.setAttribute("aria-pressed", String(selected));
  });
}

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function undoTemplateLoad(app: ProfessionAppState): void {
  if (!app.templateUndoBuild) return;
  app.build = app.templateUndoBuild;
  app.templateUndoBuild = null;
  app.currentTemplate = null;
  app.changed();
  const toast =
    app.templateContainer?.querySelector<HTMLElement>(".template-toast");
  if (toast) toast.hidden = true;
}
