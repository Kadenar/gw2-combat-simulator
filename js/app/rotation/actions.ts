import type { RotationCommand, Skill, SkillId } from '../../platform/engine/types.js';
import type { ProfessionAppState, RotationActionOptions } from '../profession/types.js';
import { normalizeRotationInsertionIndex } from '../../platform/ui/insertion-cursor.js';

export function resolveEntrySkill(
  app: ProfessionAppState,
  item: RotationCommand | { readonly name: SkillId; readonly skillId?: unknown }
): Skill | undefined {
  if ('type' in item && item.type !== 'cast') return undefined;
  const identity = 'type' in item ? item.skillId : (item.skillId ?? item.name);
  const skillId = identity == null ? null : Number(identity);
  return skillId !== null && Number.isFinite(skillId)
    ? app.skillById.get(skillId)
    : app.skillByName.get(String(identity));
}

export function createRotationItem(
  app: ProfessionAppState,
  name: string,
  options: RotationActionOptions = {}
): RotationCommand {
  // Translate palette identities directly into the canonical discriminated command model.
  if (name === '__cooldown_reset') return { type: 'cooldown-reset' };
  if (name === '__combat_start') {
    return options.concurrentOffsetMs == null
      ? { type: 'combat-start' }
      : { type: 'combat-start', concurrentOffsetMs: options.concurrentOffsetMs };
  }

  if (name === '__wait') {
    return { type: 'wait', durationMs: Number(options.durationMs) || 0 };
  }

  const skill = resolveEntrySkill(app, { name, skillId: options.skillId });
  const defaultInterruptMs = skill?.defaultInterruptMs;
  const interruptAfterMs =
    defaultInterruptMs != null && options.interruptAfterMs == null ? defaultInterruptMs : options.interruptAfterMs;
  return {
    type: 'cast',
    skillId: skill?.id ?? options.skillId ?? name,
    ...(options.concurrentOffsetMs == null ? {} : { concurrentOffsetMs: options.concurrentOffsetMs }),
    ...(interruptAfterMs == null ? {} : { interruptAfterMs }),
    ...(options.releaseAtCharges == null ? {} : { releaseAtCharges: options.releaseAtCharges }),
    ...(options.doubleEdgeOutcome == null ? {} : { doubleEdgeOutcome: options.doubleEdgeOutcome })
  };
}

export function insertRotationItems(app: ProfessionAppState, items: readonly RotationCommand[]): boolean {
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
