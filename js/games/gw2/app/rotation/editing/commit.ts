/** Installs a complete edit before issuing the single application notification that persists and simulates it. */
import { editRotation, type RotationEdit } from '#gw2/app/rotation/editing/session.js';
import type { ProfessionAppState, ProfessionChangeOptions } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

interface EditNotification {
  readonly rebuildStatic?: boolean;
  readonly rebuildGear?: boolean;
  readonly options?: ProfessionChangeOptions;
}

function commit(
  app: ProfessionAppState,
  edit: RotationEdit,
  notification: EditNotification,
  replacement?: Gw2CanonicalBuild
): boolean {
  const result = editRotation(app.build.rotation, app, edit);

  if (!result) return false;

  if (replacement) app.build = { ...replacement, rotation: result.rotation };
  else app.build.rotation = result.rotation;

  Object.assign(app, result.session);

  // Build/settings replacements and reference adoption still publish when the commands themselves are unchanged.
  if (result.commandsChanged || replacement || notification.rebuildStatic || edit.type === 'reset') {
    const rebuildStatic = notification.rebuildStatic ?? false;
    app.changed(rebuildStatic, notification.rebuildGear ?? rebuildStatic, notification.options);
  } else if (result.cursorChanged && edit.type !== 'select') {
    // Moving indistinguishable commands can clear the cursor without changing simulation inputs.
    app.selectRotationInsertion(result.session.rotationInsertionIndex ?? null);
  }

  return result.commandsChanged || result.cursorChanged || edit.type === 'reset' || Boolean(replacement);
}

export function commitRotationEdit(
  app: ProfessionAppState,
  edit: RotationEdit,
  notification: EditNotification = {}
): boolean {
  return commit(app, edit, notification);
}

/** Replacements refresh build views by default, including when callers supply only notification options. */
export function commitBuildReplacement(
  app: ProfessionAppState,
  build: Gw2CanonicalBuild,
  { rebuildStatic = true, ...notification }: EditNotification = {}
): void {
  commit(app, { type: 'replace', rotation: build.rotation }, { ...notification, rebuildStatic }, build);
}
