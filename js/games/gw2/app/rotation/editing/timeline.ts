import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import {
  activationDamageCommitMs,
  openActivationEditor,
  suggestedActivationInterruptMs
} from '#gw2/app/rotation/editing/activation-editor.js';
import { openDragonSlashReleaseEditor } from '#gw2/app/rotation/editing/charge-release.js';
import { hasConfigurableDoubleEdgeOutcome, openDoubleEdgeEditor } from '#gw2/app/rotation/editing/double-edge.js';
import { insertRotationEntries, moveRotationEntry, updateRotationEntry } from '#gw2/app/rotation/editing/operations.js';
import { resolvePaletteDrop } from '#gw2/app/rotation/palette/interactions.js';
import { COMBAT_START_ICON, WAIT_ICON } from '#gw2/app/rotation/shared/icons.js';
import type { TimelineInteractionOptions } from '#gw2/app/rotation/timeline/interactions.js';
import { currentTimelineResults, timelineItem } from '#gw2/app/rotation/timeline/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { SchedulerStep, Skill } from '#gw2/platform/engine/types.js';
import { openDurationEditor } from '#ui/rotation/editors/duration-editor.js';

/** Uses the simulated duration when available so runtime instant-cast conversions get the correct editor mode. */
function timelineFullCastMs(
  step: SchedulerStep | null | undefined,
  skill: Pick<Skill, 'castTimeMs'> | undefined
): number {
  const simulatedDuration = Number(step?.fullCastMs);
  if (step?.fullCastMs != null && Number.isFinite(simulatedDuration)) {
    return Math.max(0, Math.round(simulatedDuration));
  }

  return Math.max(0, Math.round(Number(skill?.castTimeMs) || 0));
}

// Waits keep free millisecond durations; concurrent offsets use the activation editor's GW2 action-tick validation.
function editRotationDuration(app: ProfessionAppState, index: number, event?: Event): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const eventTarget = event?.currentTarget;
  const anchor =
    (eventTarget instanceof HTMLElement ? eventTarget : null) ||
    document.querySelector<HTMLElement>(`#rotation-timeline .rot-wait-badge[data-idx="${index}"]`);
  if (!anchor) return false;

  openDurationEditor({
    anchor,
    heading: 'Edit wait',
    name: 'Wait',
    icon: anchor.closest('.rot-skill')?.querySelector<HTMLImageElement>('img')?.src || WAIT_ICON,
    label: 'Duration',
    value: Number(item.durationMs) || 1,
    onApply(durationMs) {
      const currentEntry = app.build.rotation[index];
      if (currentEntry === undefined) return;
      app.build.rotation[index] = updateRotationEntry(currentEntry, {
        durationMs
      });
      app.changed(false);
    }
  });
  return false;
}

// Dragon Slash variants accumulate charges before releasing; this editor sets the
// charge threshold at which the skill fires. releaseAtCharges == null means "wait
// for maximum charges" (the default). insertionIndex lets the editor know where in
// the rotation this cast falls so it can show available charge counts in context.
function editReleaseAtCharges(app: ProfessionAppState, index: number, event?: Event): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const skill = resolveEntrySkill(app, item.command);
  if (!skill?.dragonSlash) return false;
  const eventTarget = event?.currentTarget;
  const anchor =
    (eventTarget instanceof HTMLElement ? eventTarget : null) ||
    document.querySelector<HTMLElement>(`#rotation-timeline .rot-charge-release-badge[data-idx="${index}"]`);
  if (!anchor) return false;
  openDragonSlashReleaseEditor({
    app,
    anchor,
    skill,
    insertionIndex: index,
    currentReleaseAtCharges: item.releaseAtCharges == null ? null : Number(item.releaseAtCharges),
    onApply(releaseAtCharges) {
      const currentEntry = app.build.rotation[index];
      if (currentEntry === undefined) return;
      app.build.rotation[index] = updateRotationEntry(currentEntry, {
        releaseAtCharges
      });
      app.changed(false);
    }
  });
  return false;
}

// "Activation" here means either interrupting a cast-bar skill or placing an
// instant skill during the previous cast. The simulated duration selects the
// appropriate editor, including runtime instant-cast conversions. The anchor is
// the whole .rot-skill card so the popover positions correctly.
function editRotationActivation(app: ProfessionAppState, index: number, event?: Event): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const skill = resolveEntrySkill(app, item.command);
  const isCombatStart = item.type === 'combat-start';
  // Away-from-target casts model precasts, so expose the option only before the authored combat marker.
  const combatStartIndex = app.build.rotation.findIndex((command) => command.type === 'combat-start');
  const isPrecast = item.type === 'cast' && combatStartIndex > index;
  if (!skill && !isCombatStart) return false;

  const step = currentTimelineResults(app)?.steps?.find((candidate) => candidate.ri === index && !candidate.invalid);
  const catalogCastMs = Math.round(Number(skill?.castTimeMs) || 0);
  const fullCastMs = timelineFullCastMs(step, skill);
  // Combat Start has no cast bar, but its optional offset uses the same normal-versus-overlap
  // contract as an instant skill so users can move the marker into the preceding cast.
  const behavior = isCombatStart || item.concurrentOffsetMs != null || fullCastMs === 0 ? 'concurrent' : 'interrupt';
  const eventTarget = event?.currentTarget;
  const eventElement = eventTarget instanceof HTMLElement ? eventTarget : null;
  const anchor =
    eventElement?.closest<HTMLElement>('.rot-skill') ||
    document.querySelector<HTMLElement>(`#rotation-timeline .rot-skill[data-idx="${index}"]`);
  if (!anchor) return false;

  openActivationEditor({
    anchor,
    skillName: isCombatStart ? 'Combat Start' : String(skill?.displayName || skill?.name),
    icon:
      anchor.querySelector<HTMLImageElement>('img')?.getAttribute('src') ||
      (isCombatStart ? COMBAT_START_ICON : skill?.icon || undefined),
    behavior,
    interruptMs: behavior === 'interrupt' && item.interruptAfterMs != null ? Number(item.interruptAfterMs) : null,
    concurrentOffsetMs:
      behavior === 'concurrent' && item.concurrentOffsetMs != null ? Number(item.concurrentOffsetMs) : null,
    minimumConcurrentOffsetMs: isCombatStart ? null : 0,
    fullCastMs,
    suggestedInterruptMs: suggestedActivationInterruptMs(fullCastMs, catalogCastMs),
    damageCommitMs: activationDamageCommitMs(skill),
    allowOffTarget: isPrecast,
    offTarget: item.offTarget === true,
    onApply(timingMs, offTarget) {
      const currentEntry = app.build.rotation[index];
      if (currentEntry === undefined) return;
      // Timing and targeting belong to the same cast command, so the pencil editor updates both together.
      app.build.rotation[index] = updateRotationEntry(currentEntry, {
        ...(behavior === 'concurrent'
          ? { concurrentOffsetMs: timingMs ?? undefined }
          : { interruptAfterMs: timingMs ?? undefined }),
        ...(isPrecast ? { offTarget: offTarget ? true : undefined } : {})
      });
      app.changed(false);
    }
  });
  return false;
}

// Double Edge is a warrior skill with a random success/backfire outcome in-game;
// the sim lets users pin the outcome so benchmarks are deterministic. Defaults to
// "success" for any value other than the explicit "backfire" string, including unset.
function editDoubleEdgeOutcome(app: ProfessionAppState, index: number, event?: Event): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const skill = resolveEntrySkill(app, item.command);
  if (!hasConfigurableDoubleEdgeOutcome(skill)) return false;
  const eventTarget = event?.currentTarget;
  const anchor =
    (eventTarget instanceof HTMLElement ? eventTarget : null) ||
    document.querySelector<HTMLElement>(`#rotation-timeline .rot-double-edge-badge[data-idx="${index}"]`);
  if (!anchor) return false;
  openDoubleEdgeEditor({
    anchor,
    skillName: String(skill.displayName || skill.name),
    icon: skill.icon || undefined,
    outcome: item.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success',
    onApply(outcome) {
      const currentEntry = app.build.rotation[index];
      if (currentEntry === undefined) return;
      app.build.rotation[index] = updateRotationEntry(currentEntry, {
        doubleEdgeOutcome: outcome
      });
      app.changed(false);
    }
  });
  return false;
}

/** Connects timeline controls to rotation edits while keeping rendering free of mutations. */
export function timelineInteractionOptions(app: ProfessionAppState): TimelineInteractionOptions {
  return {
    rotation: app.build.rotation,
    getDragState: () => app.dragState,
    setDragState: (value) => {
      app.dragState = value;
    },
    moveEntry: (fromIndex, toIndex) => moveRotationEntry(app.build.rotation, fromIndex, toIndex),
    insertEntries: (entries, insertAt) => insertRotationEntries(app.build.rotation, entries, insertAt),
    resolvePaletteEntry: (name, drag, insertAt) => resolvePaletteDrop(app, name, drag, insertAt),
    onChanged: () => {
      app.rotationInsertionIndex = null;
      app.changed(false);
    },
    onRemove: (index) => app.build.rotation.splice(index, 1),
    onTruncate: (index) => app.build.rotation.splice(index),
    onEditActivation: (index, event) => editRotationActivation(app, index, event),
    onEditReleaseAtCharges: (index, event) => editReleaseAtCharges(app, index, event),
    onEditDoubleEdgeOutcome: (index, event) => editDoubleEdgeOutcome(app, index, event),
    onEditWait: (index, event) => editRotationDuration(app, index, event)
  };
}
