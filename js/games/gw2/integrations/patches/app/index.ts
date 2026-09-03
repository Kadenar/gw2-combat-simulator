import {
  acceptSavedDraft,
  editorState,
  loadEditorPayload,
  prepareEditorStateForRender,
  setEditorStatus
} from '#gw2/integrations/patches/app/editor-state.js';
import { compactPatchPreview } from '#gw2/integrations/patches/app/model.js';
import { loadPatchAuthoring, savePatchAuthoring } from '#gw2/integrations/patches/app/persistence.js';
import { bindPatchAuthoringView, renderPatchAuthoring } from '#gw2/integrations/patches/app/render.js';

const app = document.querySelector<HTMLElement>('[data-patch-authoring-app]');
if (!app) throw new Error('Patch preview authoring root is missing.');

/** Refreshes the editor from disk while preserving the existing session if loading fails. */
async function loadAuthoring(): Promise<void> {
  setEditorStatus('Loading live authoring metadata…', 'neutral');
  renderPatchAuthoring();
  try {
    const result = await loadPatchAuthoring();
    loadEditorPayload(result);
    setEditorStatus(
      result.preview ? `Loaded ${result.sourceFile}` : 'No active preview exists; a new draft is ready.',
      'success'
    );
  } catch (error) {
    setEditorStatus(error instanceof Error ? error.message : 'Unable to load patch authoring metadata.', 'error');
  }

  renderPatchAuthoring();
}

/** Saves the compact generated draft and adopts the server-validated result as clean state. */
async function saveAuthoring(): Promise<void> {
  prepareEditorStateForRender();
  const candidate = compactPatchPreview(editorState.draft);
  setEditorStatus('Validating and writing active-preview.ts…', 'neutral');
  renderPatchAuthoring();
  try {
    const result = await savePatchAuthoring(candidate);
    acceptSavedDraft(result.preview);
    setEditorStatus(`Saved ${result.sourceFile}. Rebuild or restart the simulator to load it.`, 'success');
  } catch (error) {
    setEditorStatus(error instanceof Error ? error.message : 'Patch preview save failed.', 'error');
  }

  renderPatchAuthoring();
}

bindPatchAuthoringView(app, {
  onSave: () => void saveAuthoring(),
  onReset: () => void loadAuthoring()
});

window.addEventListener('beforeunload', (event) => {
  if (!editorState.dirty) return;
  event.preventDefault();
});

void loadAuthoring();
