// Synthetic previews keep patch-isolation tests independent of released balance notes.
import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';

export const testPatchPreview = { id: 'test-preview', label: 'Test preview' };

/** Rebind simulation ownership so a fixture preview is available through the ordinary app adapter. */
export function withTestPreviewAdapter(adapter, preview = testPatchPreview) {
  return defineProfessionApp({
    profession: withPatchPreview(defineNativeProfession(adapter.profession.nativeDefinition), preview),
    createBuildContext: adapter.createBuildContext,
    toApplicationBuild: adapter.toApplicationBuild,
    tooltips: {}
  });
}
