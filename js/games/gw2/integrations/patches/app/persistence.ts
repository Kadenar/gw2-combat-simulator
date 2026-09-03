import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import type { AuthoringPayload } from '#gw2/integrations/patches/app/editor-state.js';

export interface SavedAuthoringPayload {
  readonly preview: PatchPreview;
  readonly sourceFile?: string;
  readonly rebuildRequired?: boolean;
}

/** Loads live registry metadata and the active preview from the local authoring API. */
export async function loadPatchAuthoring(): Promise<AuthoringPayload> {
  const response = await fetch('api/patch-preview', {
    headers: { Accept: 'application/json' }
  });
  const result = (await response.json()) as AuthoringPayload & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Authoring API failed.');
  return result;
}

/** Persists a compact candidate and returns the preview validated by the local authoring API. */
export async function savePatchAuthoring(preview: PatchPreview): Promise<SavedAuthoringPayload> {
  const response = await fetch('api/patch-preview', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ preview })
  });
  const result = (await response.json()) as Partial<SavedAuthoringPayload> & { error?: string };
  if (!response.ok || !result.preview) {
    throw new Error(result.error || 'Patch preview save failed.');
  }

  return result as SavedAuthoringPayload;
}
