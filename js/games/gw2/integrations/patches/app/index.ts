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

/** Locks the session during loading so reset cannot race edits or a pending save. */
async function loadAuthoring(): Promise<void> {
  if (editorState.pending) return;
  editorState.pending = true;
  try {
    setEditorStatus('Loading live authoring metadata…', 'neutral');
    renderPatchAuthoring();
    const result = await loadPatchAuthoring();
    loadEditorPayload(result);
    setEditorStatus(
      result.preview ? `Loaded ${result.sourceFile}` : 'No active preview exists; a new draft is ready.',
      'success'
    );
  } catch (error) {
    setEditorStatus(error instanceof Error ? error.message : 'Unable to load patch authoring metadata.', 'error');
  } finally {
    editorState.pending = false;
    renderPatchAuthoring();
  }
}

/** Locks edits and overlapping requests until the saved draft is accepted or the save fails. */
async function saveAuthoring(): Promise<void> {
  if (editorState.pending) return;
  editorState.pending = true;
  try {
    prepareEditorStateForRender();
    const candidate = compactPatchPreview(editorState.draft);
    setEditorStatus('Validating and writing active-preview.ts…', 'neutral');
    renderPatchAuthoring();
    const result = await savePatchAuthoring(candidate);
    acceptSavedDraft(result.preview);
    setEditorStatus(`Saved ${result.sourceFile}. Rebuild or restart the simulator to load it.`, 'success');
  } catch (error) {
    setEditorStatus(error instanceof Error ? error.message : 'Patch preview save failed.', 'error');
  } finally {
    editorState.pending = false;
    renderPatchAuthoring();
  }
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
