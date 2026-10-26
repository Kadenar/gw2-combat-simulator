import { buildContextInput } from '#gw2/app/build/isolated-preview.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import { createSkillSelectionContext } from '#gw2/platform/profession-definition/runtime-context.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { RotationActionOptions } from '#gw2/app/rotation/editing/state.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';

type SkillIdSelector = (skillId: SkillId) => SkillId;

let lastSelection: { readonly patch: object; readonly layout: string; readonly select: SkillIdSelector } | null = null;

/**
 * Applies the same trait-selected identity transform as the rotation driver, so stored commands display the variant
 * that will actually be cast (for example, Evolve under Double Helix). Timeline rows call this for every entry, so only
 * a patch or trait change rebuilds the selector.
 */
function selectedSkillId(app: ProfessionAppState, skillId: SkillId): SkillId {
  const layout = JSON.stringify(app.build.specializations ?? []);

  if (lastSelection?.patch !== app.patch || lastSelection.layout !== layout) {
    const config = app.adapter.createBuildContext(buildContextInput(app)).simulationConfig();
    const runtime = app.profession.runtimeFor(config);
    const context = createSkillSelectionContext(normalizeSelectedTraitIds(config.selectedTraitIds));
    lastSelection = { patch: app.patch, layout, select: (id) => runtime.modifySkillId?.(context, id) ?? id };
  }

  return lastSelection.select(skillId);
}

/**
 * Resolves the catalog skill behind a rotation entry or palette item. Non-cast
 * commands have no skill. Explicit identities select the trait-dependent variant without name collisions.
 */
export function resolveEntrySkill(
  app: ProfessionAppState,
  item: RotationCommand | { readonly name: SkillId; readonly skillId?: unknown }
): Skill | undefined {
  if ('type' in item && item.type !== 'cast') return undefined;

  // Palette items and commands carry the canonical identity independently of their display label.
  const identity = item.skillId;

  if (typeof identity !== 'string' && typeof identity !== 'number') return undefined;

  return app.activeCatalog.skillsById.get(selectedSkillId(app, identity));
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
    ...(options.offTarget === true ? { offTarget: true } : {}),
    ...(Number(options.impactDelayMs) > 0 ? { impactDelayMs: Number(options.impactDelayMs) } : {}),
    ...(options.concurrentOffsetMs == null ? {} : { concurrentOffsetMs: options.concurrentOffsetMs }),
    ...(interruptAfterMs == null ? {} : { interruptAfterMs }),
    ...(options.releaseAtCharges == null ? {} : { releaseAtCharges: options.releaseAtCharges }),
    ...(Number(options.releaseDelayMs) > 0 ? { releaseDelayMs: Number(options.releaseDelayMs) } : {}),
    ...(options.doubleEdgeOutcome == null ? {} : { doubleEdgeOutcome: options.doubleEdgeOutcome })
  };
}

/**
 * Inserts authored commands at the armed insertion cursor (or appends when no
 * cursor is set), advances the cursor past them, and triggers a re-sim via
 * `changed`. Empty batches leave the rotation untouched.
 */
export function insertRotationItems(app: ProfessionAppState, items: readonly RotationCommand[]): void {
  if (!items.length) return;

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
}

/** Builds a single command from a palette identity and inserts it. */
export function addRotation(app: ProfessionAppState, name: string, options: RotationActionOptions = {}): void {
  insertRotationItems(app, [createRotationItem(app, name, options)]);
}
