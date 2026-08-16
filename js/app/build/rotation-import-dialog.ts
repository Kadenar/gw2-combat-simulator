import { getRotationItems, readJsonFile } from "./files.js";
import {
  isJsonRotationFile,
  readEvtcRotationFile,
} from "./evtc-rotation-import.js";
import { errorMessage } from "../../platform/ui/dom.js";

import type { LegacyRotationItem } from "../../platform/engine/types.js";
import type { ProfessionAppState } from "../profession/types.js";

export const ROTATION_IMPORT_ACCEPT =
  ".json,.evtc,.evtc.zip,.zevtc,application/json,application/zip";

interface RotationImportSummary {
  readonly actionCount: number;
  readonly description: string;
  readonly warnings: readonly string[];
}

interface RotationImportDialogElements {
  readonly dialog: HTMLDialogElement;
  readonly dropZone: HTMLElement;
  readonly status: HTMLElement;
  readonly error: HTMLElement;
  readonly warnings: HTMLElement;
  readonly browseButton: HTMLButtonElement;
  readonly closeButton: HTMLButtonElement;
}

/** Imports either a saved JSON rotation or an ArcDPS EVTC combat log. */
export async function importRotationFile(
  file: File,
  app: ProfessionAppState,
): Promise<RotationImportSummary> {
  if (isJsonRotationFile(file)) {
    const imported = await readJsonFile(file);
    const rotation = getRotationItems(imported);
    if (!rotation) throw new Error("Rotation array missing.");
    app.build.rotation = rotation as LegacyRotationItem[];
    app.changed(false);
    return {
      actionCount: rotation.length,
      description: `Loaded ${file.name}`,
      warnings: [],
    };
  }

  const imported = await readEvtcRotationFile(file, app);
  app.build.rotation = [...imported.rotation];
  app.changed(false);
  return {
    actionCount: imported.actionCount,
    description: `Reconstructed ${imported.playerLabel}`,
    warnings: imported.warnings,
  };
}

function ensureStyles(document: Document): void {
  if (document.getElementById("rotation-import-styles")) return;
  const style = document.createElement("style");
  style.id = "rotation-import-styles";
  style.textContent = `
    .rotation-import-dialog { position:fixed; inset:0; width:min(560px, calc(100vw - 32px));
      max-height:calc(100vh - 32px); margin:auto; padding:0; overflow:auto;
      border:1px solid var(--border-light); border-radius:8px; background:var(--bg-panel);
      color:var(--text); box-shadow:0 18px 60px rgba(0,0,0,.65); }
    .rotation-import-dialog::backdrop { background:rgba(5,7,12,.78); }
    .rotation-import-form { padding:18px; }
    .rotation-import-form h3 { margin:0 0 6px; color:var(--text-bright); }
    .rotation-import-intro { margin:0 0 14px; color:var(--text-dim); font-size:12px; line-height:1.5; }
    .rotation-import-experimental { margin:0 0 14px; padding:8px 10px; border:1px solid #a67c22;
      border-radius:5px; background:rgba(166,124,34,.1); color:#e0bd68; font-size:11px; line-height:1.45; }
    .rotation-import-drop { display:flex; min-height:150px; padding:20px; align-items:center;
      justify-content:center; border:2px dashed var(--border-light); border-radius:8px;
      background:var(--bg-panel-alt); text-align:center; transition:border-color .15s, background .15s; }
    .rotation-import-drop.is-dragging { border-color:var(--accent); background:rgba(102,170,255,.08); }
    .rotation-import-drop strong { display:block; margin-bottom:5px; color:var(--text-bright); font-size:13px; }
    .rotation-import-drop small { display:block; margin:8px 0; color:var(--text-dim); font-size:10px; }
    .rotation-import-status { margin:12px 0 0; color:var(--text-dim); font-size:12px; }
    .rotation-import-status.is-success { color:var(--health); }
    .rotation-import-error { margin:12px 0 0; color:var(--condi); font-size:12px; white-space:pre-wrap; }
    .rotation-import-warnings { margin:8px 0 0; padding:8px 10px; border:1px solid var(--border);
      border-radius:5px; color:var(--text-dim); font-size:11px; line-height:1.45; white-space:pre-wrap; }
    .rotation-import-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:14px; }
  `;
  document.head.append(style);
}

function createDialog(document: Document): RotationImportDialogElements {
  ensureStyles(document);
  const dialog = document.createElement("dialog");
  dialog.className = "rotation-import-dialog";
  dialog.setAttribute("aria-labelledby", "rotation-import-title");
  dialog.innerHTML = `<form class="rotation-import-form" method="dialog">
    <h3 id="rotation-import-title">Load rotation</h3>
    <p class="rotation-import-intro">Load a saved rotation JSON, or reconstruct the current profession and specialization from an ArcDPS EVTC log.</p>
    <p class="rotation-import-experimental"><strong>Experimental:</strong> EVTC import is a work in progress and may produce incomplete, inaccurate, or otherwise undesirable rotation results. Review the imported rotation before relying on it.</p>
    <div class="rotation-import-drop" data-rotation-import-drop>
      <div>
        <strong>Drop a rotation or combat log here</strong>
        <small>.json · .evtc · .evtc.zip · .zevtc</small>
        <button type="button" class="btn btn-io" data-rotation-import-browse>Browse files</button>
      </div>
    </div>
    <p class="rotation-import-status" role="status" data-rotation-import-status>Select a file to begin.</p>
    <p class="rotation-import-error" role="alert" data-rotation-import-error hidden></p>
    <p class="rotation-import-warnings" data-rotation-import-warnings hidden></p>
    <div class="rotation-import-actions">
      <button type="button" class="btn" data-rotation-import-close>Close</button>
    </div>
  </form>`;
  document.body.append(dialog);

  const dropZone = dialog.querySelector<HTMLElement>(
    "[data-rotation-import-drop]",
  );
  const status = dialog.querySelector<HTMLElement>(
    "[data-rotation-import-status]",
  );
  const error = dialog.querySelector<HTMLElement>(
    "[data-rotation-import-error]",
  );
  const warnings = dialog.querySelector<HTMLElement>(
    "[data-rotation-import-warnings]",
  );
  const browseButton = dialog.querySelector<HTMLButtonElement>(
    "[data-rotation-import-browse]",
  );
  const closeButton = dialog.querySelector<HTMLButtonElement>(
    "[data-rotation-import-close]",
  );
  if (
    !dropZone ||
    !status ||
    !error ||
    !warnings ||
    !browseButton ||
    !closeButton
  ) {
    throw new Error("Rotation import dialog failed to initialize.");
  }
  return {
    dialog,
    dropZone,
    status,
    error,
    warnings,
    browseButton,
    closeButton,
  };
}

/** Connects the rotation load button to the in-app JSON/EVTC import flow. */
export function bindRotationImportDialog(
  app: ProfessionAppState,
  button: HTMLElement,
  fileInput: HTMLInputElement,
): void {
  fileInput.accept = ROTATION_IMPORT_ACCEPT;
  button.setAttribute("aria-haspopup", "dialog");
  button.title = "Load a rotation JSON or reconstruct one from an EVTC log";

  const elements = createDialog(button.ownerDocument);
  let importing = false;

  const resetMessages = (): void => {
    elements.status.classList.remove("is-success");
    elements.status.textContent = "Select a file to begin.";
    elements.error.hidden = true;
    elements.error.textContent = "";
    elements.warnings.hidden = true;
    elements.warnings.textContent = "";
  };

  const selectFile = async (file: File): Promise<void> => {
    if (importing) return;
    importing = true;
    elements.browseButton.disabled = true;
    elements.closeButton.disabled = true;
    elements.status.classList.remove("is-success");
    elements.status.textContent = `Reading ${file.name}…`;
    elements.error.hidden = true;
    elements.warnings.hidden = true;
    try {
      const imported = await importRotationFile(file, app);
      elements.status.classList.add("is-success");
      elements.status.textContent = `${imported.description}: imported ${imported.actionCount} action${imported.actionCount === 1 ? "" : "s"}.`;
      if (imported.warnings.length) {
        elements.warnings.hidden = false;
        elements.warnings.textContent = imported.warnings.join("\n");
      }
    } catch (error) {
      elements.status.textContent = `Could not import ${file.name}.`;
      elements.error.hidden = false;
      elements.error.textContent = errorMessage(error);
    } finally {
      fileInput.value = "";
      elements.browseButton.disabled = false;
      elements.closeButton.disabled = false;
      importing = false;
    }
  };

  button.addEventListener("click", () => {
    resetMessages();
    elements.dialog.showModal();
  });
  elements.browseButton.addEventListener("click", () => fileInput.click());
  elements.closeButton.addEventListener("click", () => elements.dialog.close());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) void selectFile(file);
  });
  for (const eventName of ["dragenter", "dragover"]) {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("is-dragging");
    });
  }
  elements.dropZone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
    const file = event.dataTransfer?.files[0];
    if (file) void selectFile(file);
  });
}
