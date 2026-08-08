import type { LegacyRotationItem } from "../../platform/engine/types.js";
import type {
  ProfessionAppState,
  RotationActionOptions,
} from "../profession/types.js";
import { normalizeRotationInsertionIndex } from "../../platform/ui/insertion-cursor.js";

export function insertRotationItems(
  app: ProfessionAppState,
  items: readonly LegacyRotationItem[],
): boolean {
  if (!items.length) return false;
  const insertionIndex = normalizeRotationInsertionIndex(
    app.rotationInsertionIndex,
    app.build.rotation.length,
  );
  if (insertionIndex === null) {
    app.rotationInsertionIndex = null;
    app.build.rotation.push(...items);
  } else {
    app.build.rotation.splice(insertionIndex, 0, ...items);
    app.rotationInsertionIndex = insertionIndex + items.length;
  }
  app.changed(false);
  return true;
}

export function addRotation(
  app: ProfessionAppState,
  name: string,
  options: RotationActionOptions = {},
): void {
  const skillId = options.skillId == null ? null : Number(options.skillId);
  const skill =
    skillId !== null && Number.isFinite(skillId)
      ? app.skillById.get(skillId)
      : app.skillByName.get(name);
  const defaultInterruptMs = skill?.defaultInterruptMs;
  const resolvedOptions =
    defaultInterruptMs != null && options.interruptMs == null
      ? { interruptMs: defaultInterruptMs, ...options }
      : options;
  const item: LegacyRotationItem = Object.keys(resolvedOptions).length
    ? { name, ...resolvedOptions }
    : name;
  insertRotationItems(app, [item]);
}
