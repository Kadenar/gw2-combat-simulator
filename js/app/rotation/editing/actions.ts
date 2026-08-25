import type { RotationCommand, Skill, SkillId } from '../../../platform/engine/types.js';
import type { ProfessionAppState, RotationActionOptions } from '../../profession/types.js';
import { normalizeRotationInsertionIndex } from '../../../platform/ui/insertion-cursor.js';
import { clearRotationSelection } from './clipboard.js';

/**
 * Resolves the catalog skill behind a rotation entry or palette item. Non-cast
 * commands (wait, combat-start, …) have no skill and return undefined. Prefers a
 * numeric skillId lookup and falls back to name-based lookup.
 */
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

/**
 * Builds one canonical rotation command from a palette identity plus options.
 * Sentinel names (`__cooldown_reset`, `__combat_start`, `__wait`) map to their
 * control commands; anything else becomes a `cast`. Optional cast fields are
 * only included when supplied, and interrupt timing defaults to the skill's
 * `defaultInterruptMs` when the caller leaves it unset.
 */
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

/**
 * Inserts authored commands at the armed insertion cursor (or appends when no
 * cursor is set), advances the cursor past them, and triggers a re-sim via
 * `changed`. Returns false for an empty batch.
 */
export function insertRotationItems(app: ProfessionAppState, items: readonly RotationCommand[]): boolean {
  if (!items.length) return false;
  // New authored actions invalidate index-based range selections from the previous timeline.
  clearRotationSelection(app);
  const insertionIndex = normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length);
  if (insertionIndex === null) {
    app.rotationInsertionIndex = null;
    app.build.rotation.push(...items);
  } else {
    app.build.rotation.splice(insertionIndex, 0, ...items);
    app.rotationInsertionIndex = insertionIndex + items.length;
  }

  // Inserting into a long timeline would otherwise paint a command-only pending state and then
  // repaint resolved markers, making both the document and timeline jump between geometries.
  if (insertionIndex === null) app.changed(false);
  else app.changed(false, false, { deferRotationRender: true });
  return true;
}

/** Builds a single command from a palette identity and inserts it. */
export function addRotation(app: ProfessionAppState, name: string, options: RotationActionOptions = {}): void {
  insertRotationItems(app, [createRotationItem(app, name, options)]);
}
