// Shared structure and behavior for the build file and rotation import dialogs.

import { captureBuildDestination } from '#gw2/app/build/state/workspace.js';
import { ensureDocumentStyles } from '#ui/shared/dom.js';

import type { ProfessionAppState } from '#gw2/app/types.js';

const IMPORT_DIALOG_STYLES = `
    /* Class display rules would otherwise override the hidden attribute on grid lists and fieldsets. */
    .import-dialog-form [hidden] { display:none; }
    .import-dialog-form h3 { margin:0 0 6px; color:var(--text-bright); }
    .import-dialog-intro { margin:0 0 14px; color:var(--text-dim); font-size:12px; line-height:1.5; }
    .import-dialog-drop { display:flex; min-height:140px; padding:20px; align-items:center;
      justify-content:center; border:2px dashed var(--border-light); border-radius:8px;
      background:var(--bg-panel-alt); text-align:center; transition:border-color .15s, background .15s; }
    .import-dialog-drop.is-dragging { border-color:var(--accent); background:rgba(102,170,255,.08); }
    .import-dialog-drop strong { display:block; margin-bottom:5px; color:var(--text-bright); font-size:13px; }
    .import-dialog-drop small { display:block; margin:8px 0; color:var(--text-dim); font-size:10px; }
    .import-dialog-status { margin:12px 0 0; color:var(--text-dim); font-size:12px; }
    .import-dialog-status:empty { display:none; }
    .import-dialog-status.is-success { color:var(--health); }
    .import-dialog-error { margin:12px 0 0; color:var(--condi); font-size:12px; white-space:pre-wrap; }
    .import-dialog-notices { display:grid; gap:6px; margin:10px 0 0; padding:0; list-style:none; color:var(--text-dim);
      font-size:11px; }
    .import-dialog-notices li { padding:8px 10px; border:1px solid var(--border); border-radius:5px;
      background:rgba(166,124,34,.06); line-height:1.45; }
    .import-dialog-notices strong { display:block; margin-bottom:2px; color:var(--text-bright); }
    .import-dialog-apply:disabled { opacity:.45; cursor:not-allowed; }
  `;

/** Installs the shared import dialog rules once, before a dialog adds its own. */
export function ensureImportDialogStyles(document: Document): void {
  ensureDocumentStyles(document, 'import-dialog-styles', IMPORT_DIALOG_STYLES);
}

/** Markup for a file drop zone; `prefix` names its `data-<prefix>-drop` and `data-<prefix>-browse` hooks. */
export function importDropZoneHtml(prefix: string, title: string, extensions: string): string {
  return `<div class="import-dialog-drop" data-${prefix}-drop>
      <div>
        <strong>${title}</strong>
        <small>${extensions}</small>
        <button type="button" class="btn btn-io" data-${prefix}-browse>Browse files</button>
      </div>
    </div>`;
}

/**
 * Finds a dialog part that the dialog's own markup guarantees.
 *
 * @throws {Error} When the markup and its selectors have drifted apart.
 */
export function requiredDialogPart<T extends Element>(dialog: HTMLDialogElement, selector: string): T {
  const element = dialog.querySelector<T>(selector);
  if (!element) throw new Error(`Import dialog failed to initialize: ${selector} missing.`);
  return element;
}

/** Renders "Label: detail" notices as list items with the label emphasized, hiding the list when empty. */
export function renderImportNotices(list: HTMLElement, notices: readonly string[]): void {
  const document = list.ownerDocument;
  list.replaceChildren(
    ...notices.map((notice) => {
      const item = document.createElement('li');
      const separator = notice.indexOf(':');
      if (separator > 0 && separator < 40) {
        const label = document.createElement('strong');
        label.textContent = notice.slice(0, separator);
        item.append(label, notice.slice(separator + 1).trim());
      } else {
        item.textContent = notice;
      }

      return item;
    })
  );
  list.hidden = notices.length === 0;
}

/** Routes files chosen through the browse button, the hidden file input, or a drop onto `dropZone`. */
export function bindImportFileSources(
  dropZone: HTMLElement,
  browseButton: HTMLButtonElement,
  fileInput: HTMLInputElement,
  onFile: (file: File) => void
): void {
  browseButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) onFile(file);
  });
  for (const eventName of ['dragenter', 'dragover']) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    });
  }

  dropZone.addEventListener('dragleave', (event) => {
    // Moving between the zone's own children also fires dragleave; only leaving the zone clears the highlight.
    if (event.relatedTarget instanceof Node && dropZone.contains(event.relatedTarget)) return;
    dropZone.classList.remove('is-dragging');
  });
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
    const file = event.dataTransfer?.files[0];
    if (file) onFile(file);
  });
}

/** Dialog callbacks driven by an import preview controller. */
export interface ImportPreviewView<Preview> {
  /** Clears the previous preview and shows `message` while loading. */
  begin(message: string): void;
  ready(preview: Preview): void;
  fail(message: string, error: unknown): void;
  setLoading(loading: boolean): void;
  /** Runs after every load attempt, including superseded ones. */
  settled(): void;
}

export interface ImportPreviewController<Preview> {
  /** Loads one preview; ignored while another load is running. */
  load(read: () => Promise<Preview>, loadingMessage: string, failureMessage: string): Promise<void>;
  /**
   * Confirms the loaded preview still targets the tab and build it was loaded for.
   *
   * @throws {Error} When the active tab or build changed since loading started.
   */
  validateDestination(): void;
  /** Discards any in-flight load, e.g. when the dialog closes. */
  cancel(): void;
}

/** Serializes asynchronous preview loads so a stale or superseded read can never be applied. */
export function createImportPreviewController<Preview>(
  app: ProfessionAppState,
  view: ImportPreviewView<Preview>
): ImportPreviewController<Preview> {
  let generation = 0;
  let loading = false;
  let validateLoaded = (): void => {};

  const setLoading = (value: boolean): void => {
    loading = value;
    view.setLoading(value);
  };

  return {
    async load(read, loadingMessage, failureMessage) {
      if (loading) return;
      const current = ++generation;
      const validate = captureBuildDestination(app);
      view.begin(loadingMessage);
      setLoading(true);
      try {
        const preview = await read();
        if (current !== generation) return;
        // An asynchronous read cannot target a different tab or build selected while it was loading.
        validate();
        validateLoaded = validate;
        view.ready(preview);
      } catch (error) {
        if (current === generation) view.fail(failureMessage, error);
      } finally {
        view.settled();
        if (current === generation) setLoading(false);
      }
    },
    validateDestination: () => validateLoaded(),
    cancel() {
      generation += 1;
      setLoading(false);
    }
  };
}
