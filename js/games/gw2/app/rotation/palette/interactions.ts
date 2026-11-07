/** Routes palette gestures to editors and complete rotation edits. */
import { createRotationItem, resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { activationDamageCommitMs, openActivationEditor } from '#gw2/app/rotation/editing/activation-editor.js';
import { castEditorForSkill, openProfessionCastEditor } from '#gw2/app/rotation/editing/cast-editor.js';
import { commitRotationEdit } from '#gw2/app/rotation/editing/commit.js';
import {
  hasConfigurableDoubleEdgeOutcome,
  openDoubleEdgeEditor
} from '#gw2/app/rotation/editing/double-edge-editor.js';
import type { ProfessionRotationDragState, RotationActionOptions } from '#gw2/app/rotation/editing/state.js';
import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { paletteSkillIsInstant, queryPaletteContext, type PaletteContext } from '#gw2/app/rotation/palette/model.js';
import type { RotationSkill } from '#gw2/app/rotation/skill-views.js';
import { clearTimelineDropIndicators } from '#gw2/app/rotation/timeline/interactions.js';
import { rotationEntryName } from '#gw2/app/rotation/timeline/model.js';
import { WAIT_ICON } from '#gw2/app/shared/icons.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/combat/action-tick.js';
import { summonQuicknessCastTimeMs } from '#gw2/platform/execution/cast-timing.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { openDurationEditor } from '#ui/rotation/editing/duration-editor.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';
import { suppressRepeatedButtonActivation } from '#ui/shared/dom.js';

type PaletteActivationEvent = (MouseEvent | KeyboardEvent) & {
  readonly currentTarget: HTMLElement;
};

type PaletteDragEvent = DragEvent & {
  readonly currentTarget: HTMLElement;
};

interface PaletteInteractionHandlers {
  readonly onActivate?: (name: string, event: PaletteActivationEvent) => unknown;
  readonly onControlActivate?: (id: string) => unknown;
  readonly onDragStart?: (name: string, event: PaletteDragEvent) => unknown;
  readonly onDragEnd?: () => unknown;
}

export function bindPaletteInteractions(
  root: HTMLElement | null | undefined,
  handlers: PaletteInteractionHandlers = {}
): void {
  if (!root) return;

  // Keep optional inventories compact on narrow screens until users choose a disclosure state.
  // Restore that choice on rerender without mistaking initialization for a user toggle.
  for (const disclosure of root.querySelectorAll<HTMLDetailsElement>('details[data-palette-storage-key]')) {
    const storageKey = disclosure.dataset.paletteStorageKey;

    if (!storageKey) continue;

    const view = root.ownerDocument.defaultView;
    const collapseQuery = disclosure.dataset.paletteCollapseQuery;

    if (collapseQuery && view) disclosure.open = !view.matchMedia(collapseQuery).matches;

    try {
      const stored = view?.localStorage.getItem(storageKey);

      if (stored === 'true' || stored === 'false') disclosure.open = stored === 'true';
    } catch {
      // Browser storage may be unavailable in private or embedded contexts.
    }

    let previousOpen = disclosure.open;
    disclosure.ontoggle = () => {
      if (disclosure.open === previousOpen) return;

      previousOpen = disclosure.open;

      try {
        view?.localStorage.setItem(storageKey, String(disclosure.open));
      } catch {
        // Browser storage may be unavailable in private or embedded contexts.
      }
    };
  }

  for (const control of root.querySelectorAll<HTMLElement>('.pal-control[data-palette-control-id]')) {
    control.onkeydown = (event) => {
      suppressRepeatedButtonActivation(event);
    };

    control.onclick = (event) => {
      // Pointer selection must not capture subsequent custom Enter/Space hotkeys.
      if (event.detail > 0) control.blur();

      handlers.onControlActivate?.(control.dataset.paletteControlId || '');
    };
  }

  // Assign DOM handler properties rather than accumulating listeners, making
  // rebinding the same rendered palette idempotent.
  for (const icon of root.querySelectorAll<HTMLElement>('.pal-skill[data-skill]')) {
    const name = icon.dataset.skill || '';
    const draggable = icon.getAttribute('draggable') === 'true';
    icon.onclick = (event) => {
      // Blur before queueing so a rerender cannot restore mouse-acquired focus.
      if (event.detail > 0) icon.blur();

      // Context restrictions block activation; a cooldown merely delays the queued cast.
      if (icon.getAttribute('aria-disabled') === 'true') return;

      handlers.onActivate?.(name, event as unknown as PaletteActivationEvent);
    };

    // Browsers disagree on modified native activation, so route advanced edits consistently.
    icon.onkeydown = (event) => {
      // Plain Enter also produces native clicks on every repeat unless its default action is cancelled.
      if (suppressRepeatedButtonActivation(event)) return;

      if (!['Enter', ' '].includes(event.key) || (!event.shiftKey && !event.ctrlKey)) return;

      if (event.altKey || event.metaKey) return;

      event.preventDefault();

      if (icon.getAttribute('aria-disabled') === 'true') return;

      handlers.onActivate?.(name, event as PaletteActivationEvent);
    };

    icon.ondragstart = (event) => {
      if (!draggable) {
        event.preventDefault();
        return;
      }

      if (handlers.onDragStart?.(name, event as PaletteDragEvent) === false) {
        event.preventDefault();
        return;
      }

      icon.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', name);

      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    };

    icon.ondragend = () => {
      icon.classList.remove('dragging');
      handlers.onDragEnd?.();
    };
  }
}

const CONCURRENT_OFFSET_MS = 120;

/** Honors authored interrupt defaults before falling back to the commit point or normal cast time. */
function defaultPaletteInterruptMs(skill: Skill | null | undefined): number {
  return Math.round(Number(skill?.defaultInterruptMs ?? skill?.interruptCommitMs ?? skill?.castTimeMs ?? 0));
}

function resolveProfessionPaletteAction(
  app: ProfessionAppState,
  name: string,
  skillId: number | null,
  context: PaletteContext = queryPaletteContext(capturePaletteInput(app))
): RotationCommand | RotationCommand[] | null | undefined {
  const resolveAction = app.profession.ui?.resolvePaletteAction;
  return typeof resolveAction === 'function' ? resolveAction(context, { name, skillId }) : undefined;
}

/**
 * Converts a dragged palette identity into one or more rotation entries.
 * Returns `null` for waits that require editor input, empty names, and duplicate
 * combat-start markers. Profession-owned actions resolve through their UI
 * contract before ordinary skills are converted; composite actions may return
 * multiple items.
 */
export function resolvePaletteDropItem(
  app: ProfessionAppState,
  name: string,
  skillId: number | null = null
): RotationCommand | RotationCommand[] | null {
  if (!name) return null;

  const professionAction = resolveProfessionPaletteAction(
    app,
    name,
    skillId,
    queryPaletteContext(capturePaletteInput(app))
  );

  if (professionAction !== undefined) return professionAction;

  if (name === '__combat_start' && app.build.rotation.some((entry) => rotationEntryName(entry) === '__combat_start')) {
    return null;
  }

  if (name === '__wait') return null;

  return createRotationItem(app, name, skillId == null ? {} : { skillId });
}

type PaletteActivationEditors = {
  readonly openDuration: typeof openDurationEditor;
  readonly openCast: typeof openProfessionCastEditor;
  readonly openDoubleEdge: typeof openDoubleEdgeEditor;
  readonly openActivation: typeof openActivationEditor;
};

const PALETTE_ACTIVATION_EDITORS: PaletteActivationEditors = {
  openDuration: openDurationEditor,
  openCast: openProfessionCastEditor,
  openDoubleEdge: openDoubleEdgeEditor,
  openActivation: openActivationEditor
};

/** Routes a palette activation through profession actions and the smallest applicable cast editor. */
export function dispatchPaletteActivation(
  app: ProfessionAppState,
  name: string,
  event: Pick<PaletteActivationEvent, 'currentTarget' | 'shiftKey' | 'ctrlKey'>,
  editors: PaletteActivationEditors = PALETTE_ACTIVATION_EDITORS
): void {
  // Retained palette tiles cannot author commands against a rotation whose new state has not rendered yet.
  if (app.analysis.state.resultRevision !== app.analysis.state.buildRevision) return;

  const icon = event.currentTarget;
  const parsedSkillId = Number(icon.dataset.skillId);
  const skillId = icon.dataset.skillId != null && Number.isFinite(parsedSkillId) ? parsedSkillId : null;
  const identity = skillId == null ? {} : { skillId };
  const input = capturePaletteInput(app);
  const context = queryPaletteContext(input);
  const professionAction = resolveProfessionPaletteAction(app, name, skillId, context);

  // `undefined` means the profession does not own the action. `null` means it handled the activation without insertion.
  if (professionAction !== undefined) {
    if (professionAction !== null) {
      commitRotationEdit(app, {
        type: 'insert',
        entries: Array.isArray(professionAction) ? professionAction : [professionAction]
      });
    }

    return;
  }

  // The one-per-rotation restriction belongs to the command state, independently of tile styling.
  if (name === '__combat_start' && app.build.rotation.some((entry) => rotationEntryName(entry) === '__combat_start'))
    return;

  if (name === '__wait') {
    editors.openDuration({
      anchor: icon,
      heading: 'Add wait',
      name: 'Wait',
      icon: WAIT_ICON,
      label: 'Duration',
      value: 1000,
      minimumMs: GW2_ACTION_TICK_MS,
      stepMs: GW2_ACTION_TICK_MS,
      onApply(waitMs) {
        app.addRotation(name, { durationMs: waitMs });
      }
    });
    return;
  }

  // Editors inspect the live bar face; every authored command retains the canonical input identity.
  const displaySkillId = icon.dataset.displaySkillId == null ? skillId : Number(icon.dataset.displaySkillId);
  const skill: RotationSkill | undefined =
    displaySkillId == null ? undefined : app.activeCatalog.skillsById.get(displaySkillId);

  const castEditor = castEditorForSkill(app, skill);

  if (skill && castEditor) {
    const insertionIndex =
      normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length) ??
      app.build.rotation.length;
    editors.openCast({
      app,
      anchor: icon,
      skill,
      descriptor: castEditor,
      insertionIndex,
      onApply(patch) {
        app.addRotation(name, { ...identity, ...patch });
      }
    });
    return;
  }

  if (hasConfigurableDoubleEdgeOutcome(skill)) {
    editors.openDoubleEdge({
      anchor: icon,
      skillName: String(skill.displayName || skill.name),
      icon: skill.icon || undefined,
      outcome: 'success',
      onApply(outcome) {
        app.addRotation(name, {
          ...identity,
          doubleEdgeOutcome: outcome
        });
      }
    });
    return;
  }

  const instant = paletteSkillIsInstant(input, context, skill, name);

  // Companion animations can overlap the player just like instant player skills.
  if (
    event.shiftKey &&
    (instant || skill?.independentCast === true) &&
    skill?.canCastConcurrently !== false &&
    app.build.rotation.length
  ) {
    app.addRotation(name, {
      ...identity,
      concurrentOffsetMs: CONCURRENT_OFFSET_MS
    });
    return;
  }

  if (event.ctrlKey && !instant) {
    const suggestedInterruptMs = defaultPaletteInterruptMs(skill);
    editors.openActivation({
      anchor: icon,
      skillName: String(skill?.displayName || skill?.name || name),
      icon: skill?.icon || icon.querySelector('img')?.getAttribute('src') || undefined,
      interruptMs: suggestedInterruptMs,
      fullCastMs: Number(skill?.castTimeMs) || null,
      quicknessCastMs: skill?.independentCast ? summonQuicknessCastTimeMs(skill) : undefined,
      suggestedInterruptMs,
      damageCommitMs: activationDamageCommitMs(skill),
      onApply(interruptMs) {
        app.addRotation(name, {
          ...identity,
          ...(interruptMs == null ? {} : { interruptAfterMs: interruptMs })
        });
      }
    });
    return;
  }

  app.addRotation(name, identity);
}

/** Binds the current palette to application edits and drag state after each render. */
export function bindAppPaletteInteractions(
  app: ProfessionAppState,
  element: HTMLElement,
  paletteContext: PaletteContext
): void {
  bindPaletteInteractions(element, {
    onControlActivate(controlId) {
      if (app.analysis.state.resultRevision !== app.analysis.state.buildRevision) return;

      if (app.profession.ui.updatePaletteControl(paletteContext, controlId)) {
        app.changed();
      }
    },
    onActivate(name, event) {
      dispatchPaletteActivation(app, name, event);
    },
    onDragStart(name, event) {
      if (app.analysis.state.resultRevision !== app.analysis.state.buildRevision) return false;

      const parsedSkillId = Number(event.currentTarget.dataset.skillId);
      app.dragState = {
        source: 'palette',
        name,
        ...(event.currentTarget.dataset.skillId != null && Number.isFinite(parsedSkillId)
          ? { skillId: parsedSkillId }
          : {})
      };
    },
    onDragEnd() {
      app.dragState = null;
      clearTimelineDropIndicators(document.getElementById('rotation-timeline'));
    }
  });
}

function paletteDragAnchor(name: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('#rotation-palette .pal-skill.dragging') ||
    [...document.querySelectorAll<HTMLElement>('#rotation-palette .pal-skill[data-skill]')].find(
      (element) => element.dataset.skill === name
    ) ||
    null
  );
}

/** Resolves a drop immediately or opens the required editor before inserting at the chosen boundary. */
export function resolvePaletteDrop(
  app: ProfessionAppState,
  name: string,
  drag: ProfessionRotationDragState | null | undefined,
  insertAt: number
): RotationCommand | RotationCommand[] | null {
  const parsedSkillId = Number(drag?.skillId);
  const skill: RotationSkill | undefined = resolveEntrySkill(app, {
    name,
    skillId: drag?.skillId
  });
  const insert = (options: RotationActionOptions = {}): void => {
    const item = createRotationItem(app, name, {
      ...(Number.isFinite(parsedSkillId) ? { skillId: parsedSkillId } : {}),
      ...options
    });
    commitRotationEdit(app, { type: 'drop', index: insertAt, entries: [item] });
  };

  if (name === '__wait') {
    const anchor = paletteDragAnchor(name);

    if (!anchor) return null;

    openDurationEditor({
      anchor,
      heading: 'Add wait',
      name: 'Wait',
      icon: WAIT_ICON,
      label: 'Duration',
      value: 1000,
      minimumMs: GW2_ACTION_TICK_MS,
      stepMs: GW2_ACTION_TICK_MS,
      onApply: (durationMs) => insert({ durationMs })
    });
    return null;
  }

  const castEditor = castEditorForSkill(app, skill);

  if (skill && castEditor) {
    const anchor = paletteDragAnchor(name);

    if (!anchor) return null;

    openProfessionCastEditor({
      app,
      anchor,
      skill,
      descriptor: castEditor,
      insertionIndex: insertAt,
      onApply: insert
    });
    return null;
  }

  if (hasConfigurableDoubleEdgeOutcome(skill)) {
    const anchor = paletteDragAnchor(name);

    if (!anchor) return null;

    openDoubleEdgeEditor({
      anchor,
      skillName: String(skill.displayName || skill.name),
      icon: skill.icon || undefined,
      outcome: 'success',
      onApply: (doubleEdgeOutcome) => insert({ doubleEdgeOutcome })
    });
    return null;
  }

  return resolvePaletteDropItem(app, name, Number.isFinite(parsedSkillId) ? parsedSkillId : null);
}
