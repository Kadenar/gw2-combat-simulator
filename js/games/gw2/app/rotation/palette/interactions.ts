/** Routes palette gestures to editors and complete rotation edits. */
import { cursorPreviewReady } from '#gw2/app/rotation/cursor-preview.js';
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
import type { RotationSkill } from '#gw2/app/rotation/skill-types.js';
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

      // Context restrictions block activation. A cooldown delays the queued cast.
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

/** Keeps absent and nonnumeric palette IDs out of skill lookups. */
function paletteSkillId(raw: string | number | null | undefined): number | null {
  const parsed = Number(raw);
  return raw != null && Number.isFinite(parsed) ? parsed : null;
}

/** Honors authored interrupt defaults before falling back to the commit point or normal cast time. */
function defaultPaletteInterruptMs(skill: Skill | null | undefined): number {
  return Math.round(Number(skill?.defaultInterruptMs ?? skill?.interruptCommitMs ?? skill?.castTimeMs ?? 0));
}

type PaletteActionEditors = {
  readonly openDuration: typeof openDurationEditor;
  readonly openCast: typeof openProfessionCastEditor;
  readonly openDoubleEdge: typeof openDoubleEdgeEditor;
  readonly openActivation: typeof openActivationEditor;
};

const PALETTE_ACTION_EDITORS: PaletteActionEditors = {
  openDuration: openDurationEditor,
  openCast: openProfessionCastEditor,
  openDoubleEdge: openDoubleEdgeEditor,
  openActivation: openActivationEditor
};

type PaletteActionRequest = {
  readonly name: string;
  readonly skillId: number | null;
  readonly anchor: HTMLElement | null;
} & (
  | {
      readonly type: 'activate';
      readonly displaySkillId?: number;
      readonly shiftKey?: boolean;
      readonly ctrlKey?: boolean;
    }
  | { readonly type: 'drop'; readonly index: number }
);

/** Routes clicks, keyboard activations, and drops through the same editors while preserving their insertion positions. */
export function dispatchPaletteAction(
  app: ProfessionAppState,
  request: PaletteActionRequest,
  editors: PaletteActionEditors = PALETTE_ACTION_EDITORS
): void {
  // Block tile actions until simulation results match the current build.
  if (!request.name || !cursorPreviewReady(app.analysis.state)) return;

  const { name, skillId, anchor } = request;
  const identity = skillId == null ? {} : { skillId };
  const complete = (entries: readonly RotationCommand[]): void => {
    commitRotationEdit(
      app,
      request.type === 'drop' ? { type: 'drop', index: request.index, entries } : { type: 'insert', entries }
    );
  };

  const insert = (options: RotationActionOptions = {}): void => {
    complete([createRotationItem(app, name, { ...identity, ...options })]);
  };

  // Dropped macros resolve their commands from the state where they will be inserted.
  const input = capturePaletteInput(app, request.type === 'drop' ? request.index : undefined);
  const context = queryPaletteContext(input);
  const professionAction = app.profession.ui.resolvePaletteAction(context, { name, skillId });

  // Undefined delegates to ordinary routing; null and empty macros are handled without insertion.
  if (professionAction !== undefined) {
    if (professionAction !== null) complete(Array.isArray(professionAction) ? professionAction : [professionAction]);

    return;
  }

  // Enforce one combat-start marker from the commands, regardless of tile styling.
  if (name === '__combat_start' && app.build.rotation.some((entry) => rotationEntryName(entry) === '__combat_start'))
    return;

  if (name === '__wait') {
    if (!anchor) return;

    editors.openDuration({
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
    return;
  }

  // Activation uses the displayed skill. Drops resolve the skill from the build's selected traits.
  // Both keep the requested skill identity in the inserted command.
  const displaySkillId = request.type === 'activate' ? (request.displaySkillId ?? skillId) : null;
  const skill: RotationSkill | undefined =
    request.type === 'drop'
      ? resolveEntrySkill(app, { name, skillId })
      : displaySkillId == null
        ? undefined
        : app.activeCatalog.skillsById.get(displaySkillId);
  const castEditor = castEditorForSkill(app, skill);

  if (skill && castEditor) {
    if (!anchor) return;

    editors.openCast({
      app,
      anchor,
      skill,
      descriptor: castEditor,
      insertionIndex:
        request.type === 'drop'
          ? request.index
          : (normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length) ??
            app.build.rotation.length),
      onApply: insert
    });
    return;
  }

  if (hasConfigurableDoubleEdgeOutcome(skill)) {
    if (!anchor) return;

    editors.openDoubleEdge({
      anchor,
      skillName: String(skill.displayName || skill.name),
      icon: skill.icon || undefined,
      outcome: 'success',
      onApply: (doubleEdgeOutcome) => insert({ doubleEdgeOutcome })
    });
    return;
  }

  // Modified activation is separate from dragging; drop does not inherit Shift or Ctrl behavior.
  if (request.type === 'activate') {
    const instant = paletteSkillIsInstant(input, context, skill, name);

    if (
      request.shiftKey &&
      (instant || skill?.independentCast === true) &&
      skill?.canCastConcurrently !== false &&
      app.build.rotation.length
    ) {
      insert({ concurrentOffsetMs: CONCURRENT_OFFSET_MS });
      return;
    }

    if (request.ctrlKey && !instant) {
      if (!anchor) return;

      const suggestedInterruptMs = defaultPaletteInterruptMs(skill);
      editors.openActivation({
        anchor,
        skillName: String(skill?.displayName || skill?.name || name),
        icon: skill?.icon || anchor.querySelector('img')?.getAttribute('src') || undefined,
        interruptMs: suggestedInterruptMs,
        fullCastMs: Number(skill?.castTimeMs) || null,
        quicknessCastMs: skill?.independentCast ? summonQuicknessCastTimeMs(skill) : undefined,
        suggestedInterruptMs,
        damageCommitMs: activationDamageCommitMs(skill),
        onApply: (interruptMs) => insert(interruptMs == null ? {} : { interruptAfterMs: interruptMs })
      });
      return;
    }
  }

  insert();
}

/** Translates a native click or keyboard activation into the same action request used by drops. */
export function dispatchPaletteActivation(
  app: ProfessionAppState,
  name: string,
  event: Pick<PaletteActivationEvent, 'currentTarget' | 'shiftKey' | 'ctrlKey'>,
  editors: PaletteActionEditors = PALETTE_ACTION_EDITORS
): void {
  const icon = event.currentTarget;
  dispatchPaletteAction(
    app,
    {
      type: 'activate',
      name,
      skillId: paletteSkillId(icon.dataset.skillId),
      displaySkillId: icon.dataset.displaySkillId == null ? undefined : Number(icon.dataset.displaySkillId),
      anchor: icon,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey
    },
    editors
  );
}

/** Binds the current palette to application edits and drag state after each render. */
export function bindAppPaletteInteractions(
  app: ProfessionAppState,
  element: HTMLElement,
  paletteContext: PaletteContext
): void {
  bindPaletteInteractions(element, {
    onControlActivate(controlId) {
      if (!cursorPreviewReady(app.analysis.state)) return;

      if (app.profession.ui.updatePaletteControl(paletteContext, controlId)) {
        app.changed();
      }
    },
    onActivate(name, event) {
      dispatchPaletteActivation(app, name, event);
    },
    onDragStart(name, event) {
      if (!cursorPreviewReady(app.analysis.state)) return false;

      const skillId = paletteSkillId(event.currentTarget.dataset.skillId);
      app.dragState = {
        source: 'palette',
        name,
        ...(skillId == null ? {} : { skillId })
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

/** Dispatches the dragged skill at the drop position, including insertion after an editor is applied. */
export function dispatchPaletteDrop(
  app: ProfessionAppState,
  name: string,
  drag: ProfessionRotationDragState,
  insertAt: number
): void {
  dispatchPaletteAction(app, {
    type: 'drop',
    name,
    skillId: paletteSkillId(drag.skillId),
    anchor: paletteDragAnchor(name),
    index: insertAt
  });
}
