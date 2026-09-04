import { createRotationItem, insertRotationItems, resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { activationDamageCommitMs, openActivationEditor } from '#gw2/app/rotation/editing/activation-editor.js';
import { openDragonSlashReleaseEditor } from '#gw2/app/rotation/editing/charge-release.js';
import { hasConfigurableDoubleEdgeOutcome, openDoubleEdgeEditor } from '#gw2/app/rotation/editing/double-edge.js';
import { createPaletteContext, paletteSkillIsInstant, type PaletteContext } from '#gw2/app/rotation/palette/model.js';
import { WAIT_ICON } from '#gw2/app/rotation/shared/icons.js';
import { clearTimelineDropIndicators, type RotationDragState } from '#gw2/app/rotation/timeline/interactions.js';
import { rotationEntryName } from '#gw2/app/rotation/timeline/model.js';
import type { ProfessionAppState, RotationActionOptions } from '#gw2/app/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { openDurationEditor } from '#ui/rotation/editors/duration-editor.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';

export type PaletteMouseEvent = MouseEvent & {
  readonly currentTarget: HTMLElement;
};

export type PaletteDragEvent = DragEvent & {
  readonly currentTarget: HTMLElement;
};

export interface PaletteInteractionHandlers {
  readonly onActivate?: (name: string, event: PaletteMouseEvent) => unknown;
  readonly onControlActivate?: (id: string, event: PaletteMouseEvent) => unknown;
  readonly onDragStart?: (name: string, event: PaletteDragEvent) => unknown;
  readonly onDragEnd?: (name: string, event: PaletteDragEvent) => unknown;
}

export function bindPaletteInteractions(
  root: HTMLElement | null | undefined,
  handlers: PaletteInteractionHandlers = {}
): void {
  if (!root) return;
  // Restore optional palette panels after every rerender and persist the next native disclosure toggle.
  for (const disclosure of root.querySelectorAll<HTMLDetailsElement>('details[data-palette-storage-key]')) {
    const storageKey = disclosure.dataset.paletteStorageKey;
    if (!storageKey) continue;
    try {
      const stored = root.ownerDocument.defaultView?.localStorage.getItem(storageKey);
      if (stored === 'true' || stored === 'false') disclosure.open = stored === 'true';
    } catch {
      // Browser storage may be unavailable in private or embedded contexts.
    }

    disclosure.ontoggle = () => {
      try {
        root.ownerDocument.defaultView?.localStorage.setItem(storageKey, String(disclosure.open));
      } catch {
        // Browser storage may be unavailable in private or embedded contexts.
      }
    };
  }

  for (const control of root.querySelectorAll<HTMLElement>('.pal-control[data-palette-control-id]')) {
    control.onclick = (event) => {
      handlers.onControlActivate?.(control.dataset.paletteControlId || '', event as unknown as PaletteMouseEvent);
    };
  }

  // Assign DOM handler properties rather than accumulating listeners, making
  // rebinding the same rendered palette idempotent.
  for (const icon of root.querySelectorAll<HTMLElement>('.pal-skill[data-skill]')) {
    const name = icon.dataset.skill || '';
    const draggable = icon.getAttribute('draggable') === 'true';
    icon.onclick = (event) => {
      if (icon.classList.contains('pal-context-disabled')) return;
      handlers.onActivate?.(name, event as unknown as PaletteMouseEvent);
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

    icon.ondragend = (event) => {
      icon.classList.remove('dragging');
      handlers.onDragEnd?.(name, event as PaletteDragEvent);
    };
  }
}

const CONCURRENT_OFFSET_MS = 120;

/** Defaults palette interruption to the skill's commit point, or its normal cast time when none is declared. */
export function defaultPaletteInterruptMs(skill: Skill | null | undefined): number {
  return Math.round(Number(skill?.interruptCommitMs ?? skill?.castTimeMs ?? 0));
}

function resolveProfessionPaletteAction(
  app: ProfessionAppState,
  name: string,
  skillId: number | null,
  context: PaletteContext = createPaletteContext(app)
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
  const professionAction = resolveProfessionPaletteAction(app, name, skillId, createPaletteContext(app));
  if (professionAction !== undefined) return professionAction;
  if (name === '__combat_start' && app.build.rotation.some((entry) => rotationEntryName(entry) === '__combat_start')) {
    return null;
  }

  if (name === '__wait') return null;
  return createRotationItem(app, name, skillId == null ? {} : { skillId });
}

type PaletteActivationEditors = {
  readonly openDuration: typeof openDurationEditor;
  readonly openDragonSlash: typeof openDragonSlashReleaseEditor;
  readonly openDoubleEdge: typeof openDoubleEdgeEditor;
  readonly openActivation: typeof openActivationEditor;
};

const PALETTE_ACTIVATION_EDITORS: PaletteActivationEditors = {
  openDuration: openDurationEditor,
  openDragonSlash: openDragonSlashReleaseEditor,
  openDoubleEdge: openDoubleEdgeEditor,
  openActivation: openActivationEditor
};

/** Routes a palette activation through profession actions and the smallest applicable cast editor. */
export function dispatchPaletteActivation(
  app: ProfessionAppState,
  name: string,
  event: Pick<PaletteMouseEvent, 'currentTarget' | 'shiftKey' | 'ctrlKey'>,
  editors: PaletteActivationEditors = PALETTE_ACTIVATION_EDITORS
): void {
  const icon = event.currentTarget;
  const parsedSkillId = Number(icon.dataset.skillId);
  const skillId = icon.dataset.skillId != null && Number.isFinite(parsedSkillId) ? parsedSkillId : null;
  const identity = skillId == null ? {} : { skillId };
  const context = createPaletteContext(app);
  const professionAction = resolveProfessionPaletteAction(app, name, skillId, context);
  // `undefined` means the profession does not own the action. `null` means it handled the activation without insertion.
  if (professionAction !== undefined) {
    if (professionAction !== null) {
      insertRotationItems(app, Array.isArray(professionAction) ? professionAction : [professionAction]);
    }

    return;
  }

  if (name === '__combat_start' && icon.classList.contains('pal-disabled')) return;

  if (name === '__wait') {
    editors.openDuration({
      anchor: icon,
      heading: 'Add wait',
      name: 'Wait',
      icon: WAIT_ICON,
      label: 'Duration',
      value: 1000,
      onApply(waitMs) {
        app.addRotation(name, { durationMs: waitMs });
      }
    });
    return;
  }

  const skill = skillId == null ? app.skillByName.get(name) : app.skillById.get(skillId);
  if (skill?.dragonSlash) {
    const insertionIndex =
      normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length) ??
      app.build.rotation.length;
    editors.openDragonSlash({
      app,
      anchor: icon,
      skill,
      insertionIndex,
      onApply(releaseAtCharges) {
        app.addRotation(name, {
          ...identity,
          ...(releaseAtCharges == null ? {} : { releaseAtCharges })
        });
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

  const instant = paletteSkillIsInstant(app, context, skill, name);
  if (event.shiftKey && instant && skill?.canCastConcurrently !== false && app.build.rotation.length) {
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
      if (app.profession.ui.updatePaletteControl(paletteContext, controlId)) {
        app.changed();
      }
    },
    onActivate(name, event) {
      dispatchPaletteActivation(app, name, event);
    },
    onDragStart(name, event) {
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
  drag: RotationDragState | null | undefined,
  insertAt: number
): RotationCommand | RotationCommand[] | null {
  const parsedSkillId = Number(drag?.skillId);
  const skill = resolveEntrySkill(app, {
    name,
    skillId: drag?.skillId
  });
  const insert = (options: RotationActionOptions = {}): void => {
    const item = createRotationItem(app, name, {
      ...(Number.isFinite(parsedSkillId) ? { skillId: parsedSkillId } : {}),
      ...options
    });
    app.build.rotation.splice(insertAt, 0, item);
    app.rotationInsertionIndex = null;
    app.changed(false);
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
      onApply: (durationMs) => insert({ durationMs })
    });
    return null;
  }

  if (skill?.dragonSlash) {
    const anchor = paletteDragAnchor(name);
    if (!anchor) return null;
    openDragonSlashReleaseEditor({
      app,
      anchor,
      skill,
      insertionIndex: insertAt,
      onApply(releaseAtCharges) {
        insert({
          ...(releaseAtCharges == null ? {} : { releaseAtCharges })
        });
      }
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
