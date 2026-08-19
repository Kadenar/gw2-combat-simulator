import type { LegacyRotationItem, Skill, SkillId } from '../../platform/engine/types.js';
import type { ProfessionAppState, RotationActionOptions } from '../profession/types.js';
import { normalizeRotationInsertionIndex } from '../../platform/ui/insertion-cursor.js';

export function resolveEntrySkill(
  app: ProfessionAppState,
  item: { readonly name: SkillId; readonly skillId?: unknown }
): Skill | undefined {
  const skillId = item.skillId == null ? null : Number(item.skillId);
  return skillId !== null && Number.isFinite(skillId)
    ? app.skillById.get(skillId)
    : app.skillByName.get(String(item.name));
}

export function createRotationItem(
  app: ProfessionAppState,
  name: string,
  options: RotationActionOptions = {}
): LegacyRotationItem {
  const skill = resolveEntrySkill(app, { name, skillId: options.skillId });
  const defaultInterruptMs = skill?.defaultInterruptMs;
  const resolvedOptions =
    defaultInterruptMs != null && options.interruptMs == null
      ? { ...options, interruptMs: defaultInterruptMs }
      : options;
  return Object.keys(resolvedOptions).length ? { name, ...resolvedOptions } : name;
}

export function insertRotationItems(app: ProfessionAppState, items: readonly LegacyRotationItem[]): boolean {
  if (!items.length) return false;
  const insertionIndex = normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length);
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

export function addRotation(app: ProfessionAppState, name: string, options: RotationActionOptions = {}): void {
  insertRotationItems(app, [createRotationItem(app, name, options)]);
}
