import {
  applyTimelineDrop,
  clearTimelineDropIndicators,
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  getSkillDropInsertionIndex,
  rotationEntryName,
  timelineDeadTimeMarkers,
  timelineSkillCastOrdinals,
  updateSkillDropIndicator
} from '#gw2/app/presentation/rotation/timeline.js';
import { useEffect, useState } from 'react';
import type { CSSProperties, DragEvent, ReactNode } from 'react';
import { renderReact } from '#ui/react-root.js';
import {
  activationDamageCommitMs,
  openActivationEditor,
  suggestedActivationInterruptMs
} from '#gw2/app/presentation/rotation/editors/activation-editor.js';
import { openDurationEditor } from '#ui/rotation/editors/duration-editor.js';
import { closeFloatingEditor } from '#ui/rotation/editors/floating-editor.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';
import { activeSpecialization, professionEndState } from '#gw2/app/rotation/shared/context.js';
import {
  ACTION_ICONS,
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  PLACEHOLDER_ICON,
  WAIT_ICON,
  resolveProcIcon
} from '#gw2/app/rotation/shared/icons.js';
import { renderPalette, resolvePaletteDropItem } from '#gw2/app/rotation/palette/view.js';
import { renderRotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/view.js';
import { createRotationItem, resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { openDragonSlashReleaseEditor } from '#gw2/app/rotation/editing/charge-release.js';
import { insertRotationEntries, moveRotationEntry, updateRotationEntry } from '#gw2/app/rotation/editing/operations.js';
import {
  doubleEdgeOutcomeLabel,
  hasConfigurableDoubleEdgeOutcome,
  openDoubleEdgeEditor
} from '#gw2/app/rotation/editing/double-edge.js';
import { formatTimelineTime, resultCombatReferenceMs } from '#gw2/app/rotation/result/model.js';
import {
  automaticPhotonForgeExitTimelineMarkers,
  automaticTomeStowTimelineMarkers,
  continuumEndTimelineMarkers,
  groupConsecutiveProcSteps,
  procBadgeLabel,
  procFilterKey,
  procFilterLabel,
  procStackLabel,
  relicProcExpirationTimelineMarkers,
  relicProcTimelineMarkers,
  rotationSkillHighlightKey,
  shatterResourceSpends,
  sigilProcTimelineMarkers,
  targetHealthTimelineMarkers,
  timelineStepsWithChargeFills,
  timelineWeaponLineExitMarkerRowIndex,
  timelineWeaponRows,
  traitProcTimelineMarkers
} from '#gw2/app/rotation/timeline/model.js';
import type { RotationCommand, SchedulerRecord, SchedulerStep, Skill, SkillId } from '#gw2/platform/engine/types.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import type { TimelineInteractionOptions } from '#gw2/app/presentation/rotation/timeline.js';
import type { ProfessionAppState, RotationActionOptions } from '#gw2/app/types.js';

type TimelineItem = SchedulerRecord & {
  command: RotationCommand;
  type: RotationCommand['type'];
  name: string;
  skillId?: SkillId;
  concurrentOffsetMs?: number;
  interruptAfterMs?: number;
  offTarget?: boolean;
  releaseAtCharges?: unknown;
  doubleEdgeOutcome?: unknown;
  durationMs?: number;
};

const timelineCommandKeys = new WeakMap<object, number>();
let nextTimelineCommandKey = 1;

function timelineCommandKey(command: RotationCommand): number {
  const object = command as object;
  const existing = timelineCommandKeys.get(object);
  if (existing) return existing;
  const key = nextTimelineCommandKey++;
  timelineCommandKeys.set(object, key);
  return key;
}

// Projects canonical commands into the uniform fields needed by timeline rendering.
function timelineItem(command: RotationCommand): TimelineItem {
  if (command.type === 'cast') {
    return { ...command, command, name: String(command.skillId) };
  }

  if (command.type === 'wait') {
    return { ...command, command, name: '__wait' };
  }

  return {
    ...command,
    command,
    name: command.type === 'combat-start' ? '__combat_start' : '__cooldown_reset'
  };
}

/** Prevents a newly changed rotation from displaying timings produced for the previous build revision. */
export function currentTimelineResults(
  app: Pick<ProfessionAppState, 'buildRevision' | 'resultRevision' | 'results'>
): ProfessionAppState['results'] {
  return app.resultRevision === app.buildRevision ? app.results : null;
}

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

// Merges new proc keys into the visible set. New procs auto-show; previously
// hidden procs stay hidden; procs that disappeared are dropped.
export function syncProcVisibility(app: ProfessionAppState, procSteps: readonly Gw2ProcStep[]): Set<string> {
  const procKeys = new Set(procSteps.map(procFilterKey));
  const current = app.procVisibility instanceof Set ? app.procVisibility : null;
  const knownKeys = app.procVisibilityKeys instanceof Set ? app.procVisibilityKeys : null;
  app.procVisibility = new Set([...procKeys].filter((key) => !knownKeys || !knownKeys.has(key) || current?.has(key)));
  app.procVisibilityKeys = procKeys;
  return app.procVisibility as Set<string>;
}

// Waits keep free millisecond durations; concurrent offsets use the activation editor's GW2 action-tick validation.
function editRotationDuration(
  app: ProfessionAppState,
  index: number,
  event?: { readonly currentTarget: EventTarget | null }
): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const eventTarget = event?.currentTarget;
  const anchor = eventTarget instanceof HTMLElement ? eventTarget : null;
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
function editReleaseAtCharges(
  app: ProfessionAppState,
  index: number,
  event?: { readonly currentTarget: EventTarget | null }
): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const skill = resolveEntrySkill(app, item.command);
  if (!skill?.dragonSlash) return false;
  const eventTarget = event?.currentTarget;
  const anchor = eventTarget instanceof HTMLElement ? eventTarget : null;
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
function editRotationActivation(
  app: ProfessionAppState,
  index: number,
  event?: { readonly currentTarget: EventTarget | null }
): boolean {
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
  const anchor = eventElement?.closest<HTMLElement>('.rot-skill') || null;
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
function editDoubleEdgeOutcome(
  app: ProfessionAppState,
  index: number,
  event?: { readonly currentTarget: EventTarget | null }
): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const skill = resolveEntrySkill(app, item.command);
  if (!hasConfigurableDoubleEdgeOutcome(skill)) return false;
  const eventTarget = event?.currentTarget;
  const anchor = eventTarget instanceof HTMLElement ? eventTarget : null;
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

function paletteDragAnchor(app: ProfessionAppState): HTMLElement | null {
  const anchor = app.dragState?.anchor;
  return anchor instanceof HTMLElement ? anchor : null;
}

function timelineInteractionOptions(app: ProfessionAppState): TimelineInteractionOptions {
  return {
    getDragState: () => app.dragState,
    setDragState: (value) => {
      app.dragState = value;
    },
    moveEntry: (fromIndex, toIndex) => moveRotationEntry(app.build.rotation, fromIndex, toIndex),
    insertEntries: (entries, insertAt) => insertRotationEntries(app.build.rotation, entries, insertAt),
    resolvePaletteEntry: (name, drag, insertAt) => {
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
        const anchor = paletteDragAnchor(app);
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
        const anchor = paletteDragAnchor(app);
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
        const anchor = paletteDragAnchor(app);
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
    },
    onChanged: () => {
      app.rotationInsertionIndex = null;
      app.changed(false);
    }
  };
}

function setInsertionIndex(app: ProfessionAppState, index: number | null): void {
  app.rotationInsertionIndex = index;
  renderPalette(app);
  renderTimeline(app);
  renderRotationStateSnapshot(app);
}

function InsertionGap({ app, index }: { readonly app: ProfessionAppState; readonly index: number }) {
  const activeIndex = app.rotationInsertionIndex ?? app.build.rotation.length;
  const active = index === activeIndex;
  return (
    <button
      type='button'
      className={`rot-insertion-gap${active ? ' active' : ''}`}
      data-insertion-index={index}
      title={active ? `Insertion point at position ${index + 1}` : `Insert at position ${index + 1}`}
      aria-label={active ? `Insertion point at position ${index + 1}` : `Set insertion point at position ${index + 1}`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (index === activeIndex) return;
        setInsertionIndex(app, index === app.build.rotation.length ? null : index);
      }}
    >
      <span className='rot-insertion-arrow' aria-hidden='true'>
        →
      </span>
      <span className='rot-insertion-marker' aria-hidden='true' />
    </button>
  );
}

function shouldIgnoreArrowKey(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof Element
    ? Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], dialog"))
    : false;
}

/** Keeps insertion-point keyboard navigation attached to the React timeline lifecycle. */
function TimelineKeyboard({ app, root }: { readonly app: ProfessionAppState; readonly root: HTMLElement }) {
  useEffect(() => {
    const document = root.ownerDocument;
    const scope = root.closest('.rotation-panel') || root;
    const handleKeydown = (event: KeyboardEvent): void => {
      const activeIndex = normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length);
      if (event.key === 'Escape' && activeIndex !== null) {
        setInsertionIndex(app, null);
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (shouldIgnoreArrowKey(event) || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const focused = document.activeElement;
      if (focused && focused !== document.body && !scope.contains(focused)) return;
      const displayIndex = activeIndex ?? app.build.rotation.length;
      const next = displayIndex + (event.key === 'ArrowLeft' ? -1 : 1);
      if (next < 0 || next > app.build.rotation.length) return;
      event.preventDefault();
      setInsertionIndex(app, next === app.build.rotation.length ? null : next);
      // Keep :focus-visible on the selected boundary so the old gap does not continue to look active.
      root.querySelector<HTMLButtonElement>(`.rot-insertion-gap[data-insertion-index='${next}']`)?.focus();
    };

    const resetDrag = (): void => clearTimelineDropIndicators(root);
    const handleDragOver = (event: globalThis.DragEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (!app.dragState || target?.closest('.rot-row-skills')) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      root.classList.add('drag-over-empty');
    };

    const handleDragLeave = (event: globalThis.DragEvent): void => {
      if (event.target === root) root.classList.remove('drag-over-empty');
    };

    const handleDrop = (event: globalThis.DragEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (!app.dragState || target?.closest('.rot-row-skills')) return;
      event.preventDefault();
      clearTimelineDropIndicators(root);
      applyTimelineDrop(timelineInteractionOptions(app), app.build.rotation.length);
    };

    document.addEventListener('keydown', handleKeydown);
    root.addEventListener('timeline-drag-clear', resetDrag);
    root.addEventListener('dragover', handleDragOver);
    root.addEventListener('dragleave', handleDragLeave);
    root.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      root.removeEventListener('timeline-drag-clear', resetDrag);
      root.removeEventListener('dragover', handleDragOver);
      root.removeEventListener('dragleave', handleDragLeave);
      root.removeEventListener('drop', handleDrop);
    };
  }, [app, root]);
  return null;
}

function stopControlDrag(event: DragEvent<HTMLElement>): void {
  event.preventDefault();
  event.stopPropagation();
}

/** Keeps proc disclosure, filtering, and highlighting local while application visibility stays authoritative. */
function ProcPanel({
  app,
  procSteps,
  procColors,
  formatTime
}: {
  readonly app: ProfessionAppState;
  readonly procSteps: readonly Gw2ProcStep[];
  readonly procColors: Readonly<Record<string, string>>;
  readonly formatTime: (timeMs: number) => string;
}) {
  const [open, setOpen] = useState(false);
  if (!procSteps.length) return null;
  const visibility = app.procVisibility || new Set<string>();
  const options = [...new Map(procSteps.map((proc) => [procFilterKey(proc), proc])).values()].sort((left, right) =>
    procFilterLabel(left).localeCompare(procFilterLabel(right))
  );
  const groups = groupConsecutiveProcSteps(procSteps);
  const groupKeys = new Set(groups.map((group) => group.key));
  if (app.procHighlightKey && !groupKeys.has(app.procHighlightKey)) app.procHighlightKey = null;
  return (
    <details className='rotation-procs-wrap' open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        Procs ({procSteps.length} activation{procSteps.length === 1 ? '' : 's'})
      </summary>
      <div className='rotation-procs-content'>
        <details
          className='proc-filter'
          open={Boolean(app.procFilterOpen)}
          onToggle={(event) => {
            app.procFilterOpen = event.currentTarget.open;
          }}
        >
          <summary title='Choose which proc types are shown'>
            Visible{' '}
            <span className='proc-filter-count'>
              {options.filter((proc) => visibility.has(procFilterKey(proc))).length}/{options.length}
            </span>
          </summary>
          <div className='proc-filter-menu'>
            {options.map((proc) => {
              const key = procFilterKey(proc);
              return (
                <label key={key} className='proc-filter-option'>
                  <input
                    type='checkbox'
                    data-proc-key={key}
                    checked={visibility.has(key)}
                    onChange={(event) => {
                      if (event.currentTarget.checked) visibility.add(key);
                      else visibility.delete(key);
                      if (!event.currentTarget.checked && app.rotationSkillHighlightKey === key) {
                        app.rotationSkillHighlightKey = null;
                      }

                      app.procFilterOpen = true;
                      renderTimeline(app);
                    }}
                  />
                  <span>{procFilterLabel(proc)}</span>
                </label>
              );
            })}
          </div>
        </details>
        <div className='proc-icons-row'>
          {groups.map((group, groupIndex) => {
            const proc = group.steps[0];
            if (!proc) return null;
            const { key } = group;
            const type =
              proc.type === 'relic_proc'
                ? 'Relic'
                : proc.type === 'sigil_proc'
                  ? 'Sigil'
                  : proc.type === 'skill_proc'
                    ? 'Skill'
                    : 'Trait';
            const time = formatTime(proc.start);
            const count = group.steps.length;
            const detail =
              count === 1
                ? [
                    proc.skill,
                    `${type} proc at ${time}`,
                    proc.sourceSkill ? `Triggered by ${proc.sourceSkill}` : '',
                    proc.detail || ''
                  ]
                    .filter(Boolean)
                    .join('\n')
                : [
                    proc.skill,
                    `${type} proc x${count}`,
                    ...group.steps.map((step, index) =>
                      [
                        `${index + 1}. ${formatTime(step.start)}`,
                        step.sourceSkill ? `Triggered by ${step.sourceSkill}` : '',
                        step.detail || ''
                      ]
                        .filter(Boolean)
                        .join(' - ')
                    )
                  ].join('\n');
            const active = app.procHighlightKey === key;
            return (
              <div
                key={`${key}:${groupIndex}`}
                className={`proc-icon${active ? ' proc-highlight' : app.procHighlightKey ? ' proc-faded' : ''}`}
                data-proc-key={key}
                hidden={!visibility.has(key)}
                title={detail}
                style={{ '--proc-color': procColors[proc.type] || '#9d7bd0' } as CSSProperties}
                onClick={() => {
                  app.procHighlightKey = active ? null : key;
                  renderTimeline(app);
                }}
              >
                <img src={resolveProcIcon(app, proc) || PLACEHOLDER_ICON} alt='' />
                {procBadgeLabel(group.steps) ? <span className='proc-count'>{procBadgeLabel(group.steps)}</span> : null}
                {procStackLabel(group.steps.at(-1) || proc) ? (
                  <span className='proc-stack'>{procStackLabel(group.steps.at(-1) || proc)}</span>
                ) : null}
                <span className='proc-time'>{time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

export function renderTimeline(app: ProfessionAppState): void {
  // Closing editor leaves prevents stale anchors when a command is removed or moved.
  closeFloatingEditor();
  const element = document.getElementById('rotation-timeline');
  const procElement = document.getElementById('rotation-procs');
  if (!element) return;
  element.dataset.buildRevision = String(app.buildRevision);
  element.dataset.resultRevision = String(app.resultRevision);
  element.toggleAttribute('aria-busy', app.resultRevision !== app.buildRevision);
  if (!app.build.rotation.length) {
    app.rotationSkillHighlightKey = null;
    element.classList.add('is-empty');
    app.rotationInsertionIndex = normalizeRotationInsertionIndex(app.rotationInsertionIndex, 0);
    renderReact(
      element,
      <>
        <TimelineKeyboard app={app} root={element} />
        <div className='rot-empty'>
          <strong>Build your rotation</strong>
          <span>Click or drag skills from the palette above</span>
        </div>
      </>
    );
    if (procElement) renderReact(procElement, null);
    return;
  }

  element.classList.remove('is-empty');
  const results = currentTimelineResults(app);
  const resultSteps = results?.steps || [];
  // ri < 0 marks injected/synthetic steps (e.g. auto-attacks) not tied to a rotation entry.
  const steps = new Map<number, SchedulerStep>(
    resultSteps.filter((step) => step.ri >= 0).map((step) => [step.ri, step])
  );
  const castOrdinals = timelineSkillCastOrdinals(resultSteps);
  const resourceSpends = shatterResourceSpends(results);
  const automaticPhotonForgeExits = automaticPhotonForgeExitTimelineMarkers(results, app.build.rotation.length);
  const automaticTomeStows = automaticTomeStowTimelineMarkers(results, app.build.rotation.length);
  // Automatic transformation exits act as weapon-row boundaries even though
  // no authored deactivation or stow command exists at that position.
  const automaticWeaponLineEndIndexes = new Set(
    [...automaticPhotonForgeExits, ...automaticTomeStows].map((marker) => marker.insertionIndex)
  );
  const startingWeaponSet = app.build.startingWeaponSet;
  const specialization = activeSpecialization(app);
  const startingWeaponLine =
    app.profession.ui.timelineWeaponLineTransition({
      initial: true,
      build: app.build,
      specialization,
      weaponSet: startingWeaponSet,
      weaponLine: null
    }) ?? null;
  const rows = timelineWeaponRows(app.build.rotation, {
    startingWeaponSet,
    startingWeaponLine,
    weaponSwapChangesSet: app.profession.ui.weaponSwapChangesSet !== false && Boolean(app.build.alternateWeapons?.[0]),
    weaponLineEndIndexes: automaticWeaponLineEndIndexes,
    skillName: (entry) => resolveEntrySkill(app, entry)?.name || rotationEntryName(entry),
    weaponLineTransition: (entry, current) => {
      const item = timelineItem(entry);
      const skill = resolveEntrySkill(app, item.command);
      return app.profession.ui.timelineWeaponLineTransition({
        entry: item.command,
        skill,
        build: app.build,
        specialization,
        ...current
      });
    }
  });
  const combatReferenceMs = resultCombatReferenceMs(results);
  // Timeline timestamps keep millisecond precision so authored waits display their exact boundaries.
  const formatTime = (timeMs: number): string => formatTimelineTime(timeMs, combatReferenceMs, 3);
  const deadTimes = timelineDeadTimeMarkers(
    timelineStepsWithChargeFills(resultSteps, resourceSpends),
    results?.resolvedEvents || [],
    // The authored Wait tile already represents its own duration. Overlay only
    // idle time beyond that shape so the timeline does not render it twice.
    { includeExplicitWaits: false }
  );
  const deadTimesByIndex = new Map<number, typeof deadTimes>();
  for (const marker of deadTimes) {
    const markers = deadTimesByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    deadTimesByIndex.set(marker.insertionIndex, markers);
  }

  const procColors: Readonly<Record<string, string>> = {
    relic_proc: '#ddaa33',
    sigil_proc: '#4488cc',
    trait_proc: '#77cc77',
    skill_proc: '#bb88ff'
  };
  const procSteps = [...(results?.procSteps || [])].sort((a, b) => a.start - b.start);
  const procVisibility = procSteps.length ? syncProcVisibility(app, procSteps) : new Set<string>();
  const overlayProcMarkers = [
    ...(app.overlaySigilProcs ? sigilProcTimelineMarkers(results, app.build.rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcTimelineMarkers(results, app.build.rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcExpirationTimelineMarkers(results, app.build.rotation.length) : []),
    // Keep this requested trait proc opt-in without overlaying every simulated trait proc.
    ...(specialization === 'Luminary' && app.overlaySovereignOfLightProcs
      ? traitProcTimelineMarkers(results, app.build.rotation.length).filter(
          (marker) => marker.skill === 'Sovereign of Light'
        )
      : [])
  ].sort((left, right) => left.start - right.start);
  const overlayProcMarkersByIndex = new Map<number, typeof overlayProcMarkers>();
  for (const marker of overlayProcMarkers) {
    const markers = overlayProcMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    overlayProcMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const continuumEnds = continuumEndTimelineMarkers(results, app.build.rotation.length);
  const continuumEndsByIndex = new Map<number, typeof continuumEnds>();
  for (const marker of continuumEnds) {
    const markers = continuumEndsByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    continuumEndsByIndex.set(marker.insertionIndex, markers);
  }

  const automaticPhotonForgeExitsByIndex = new Map<number, typeof automaticPhotonForgeExits>();
  for (const marker of automaticPhotonForgeExits) {
    const markers = automaticPhotonForgeExitsByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    automaticPhotonForgeExitsByIndex.set(marker.insertionIndex, markers);
  }

  const automaticPhotonForgeExitsByRow = new Map<number, typeof automaticPhotonForgeExits>();
  const automaticPhotonForgeExitRowMarkers = new Set<(typeof automaticPhotonForgeExits)[number]>();
  for (const marker of automaticPhotonForgeExits) {
    const rowIndex = timelineWeaponLineExitMarkerRowIndex(rows, marker.insertionIndex, 'Photon Forge');
    if (rowIndex < 0) continue;
    const markers = automaticPhotonForgeExitsByRow.get(rowIndex) || [];
    markers.push(marker);
    automaticPhotonForgeExitsByRow.set(rowIndex, markers);
    automaticPhotonForgeExitRowMarkers.add(marker);
  }

  const automaticTomeStowsByIndex = new Map<number, typeof automaticTomeStows>();
  for (const marker of automaticTomeStows) {
    const markers = automaticTomeStowsByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    automaticTomeStowsByIndex.set(marker.insertionIndex, markers);
  }

  const targetThresholds =
    app.profession.ui.targetHealthThresholds?.({
      specialization: activeSpecialization(app),
      build: app.build,
      professionState: professionEndState(results)
    }) || [];
  const healthMarkers = targetHealthTimelineMarkers(
    results,
    app.build.targetHealth,
    targetThresholds,
    app.build.rotation.length,
    app.build.targetStartingHealthPercent
  );
  const healthMarkersByIndex = new Map<number, typeof healthMarkers>();
  for (const marker of healthMarkers) {
    const markers = healthMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    healthMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const renderContinuumEnd = (marker: (typeof continuumEnds)[number]): ReactNode => {
    const time = formatTime(marker.start);
    const detail = [
      'Continuum Shift',
      `Continuum Split ended automatically at ${time}`,
      'Cooldown state restored'
    ].join('\n');
    return (
      <div
        key={`continuum:${marker.insertionIndex}:${marker.start}`}
        className='rot-skill rot-injected rot-automatic-transition'
        title={detail}
        style={{ '--att-border': '#d6b46b' } as CSSProperties}
      >
        <img src={ACTION_ICONS['Continuum Shift']} alt='' />
        <span className='rot-injected-badge'>AUTO</span>
        <span className='rot-time'>{time}</span>
      </div>
    );
  };

  const renderAutomaticPhotonForgeExit = (marker: (typeof automaticPhotonForgeExits)[number]): ReactNode => {
    const time = formatTime(marker.start);
    const detail = ['Overheat', `Photon Forge ended automatically at ${time}`, 'Tool-belt cooldowns applied'].join(
      '\n'
    );
    const icon =
      app.activeCatalog.skillsByName.get('Deactivate Photon Forge')?.icon ||
      ACTION_ICONS['Deactivate Photon Forge'] ||
      PLACEHOLDER_ICON;
    return (
      <div
        key={`forge:${marker.insertionIndex}:${marker.start}`}
        className='rot-skill rot-injected rot-automatic-transition'
        title={detail}
        style={{ '--att-border': '#e5a72d' } as CSSProperties}
      >
        <img src={icon} alt='' />
        <span className='rot-injected-badge'>AUTO</span>
        <span className='rot-time'>{time}</span>
      </div>
    );
  };

  const renderAutomaticTomeStow = (marker: (typeof automaticTomeStows)[number]): ReactNode => {
    const time = formatTime(marker.start);
    const detail = ['Stow Tome', `Tome closed automatically at ${time}`, 'No tome pages remaining'].join('\n');
    const icon = app.activeCatalog.skillsByName.get('Stow Tome')?.icon || ACTION_ICONS['Stow Tome'] || PLACEHOLDER_ICON;
    return (
      <div
        key={`tome:${marker.insertionIndex}:${marker.start}`}
        className='rot-skill rot-injected'
        title={detail}
        style={{ '--att-border': '#d6b46b' } as CSSProperties}
      >
        <img src={icon} alt='' />
        <span className='rot-injected-badge'>AUTO</span>
        <span className='rot-time'>{time}</span>
      </div>
    );
  };

  const renderHealthMarker = (marker: (typeof healthMarkers)[number]): ReactNode => {
    const time = formatTime(marker.start);
    const label = `${marker.healthPercent}%`;
    const detail = [
      `Target reached ${label} health`,
      `At ${time}`,
      `${Math.round(marker.damage).toLocaleString()} cumulative damage`
    ].join('\n');
    return (
      <div
        key={`health:${marker.insertionIndex}:${marker.healthPercent}`}
        className='rot-skill rot-injected rot-health-marker'
        title={detail}
        style={{ '--att-border': '#d96b6b' } as CSSProperties}
      >
        <img src={COMBAT_START_ICON} alt='' />
        <span className='rot-injected-badge'>{label}</span>
        <span className='rot-time'>{time}</span>
      </div>
    );
  };

  const renderDeadTime = (marker: (typeof deadTimes)[number]): ReactNode => {
    const duration = formatTimelineDuration(marker.durationMs);
    const detail =
      marker.reason === 'explicit-wait'
        ? [
            `Idle time: ${duration} explicit wait`,
            `Wait from ${formatTime(marker.start)} to ${formatTime(marker.end)}`
          ].join('\n')
        : marker.reason != null
          ? marker.reason === 'cancelled-before-commit'
            ? [
                `Idle time: ${duration} wasted`,
                `${marker.skill || 'Skill'} was interrupted before its interruptCommitMs cutoff`
              ].join('\n')
            : [
                `Idle time: ${duration} wasted`,
                `${marker.skill || 'Skill'} dealt no damage after being interrupted`,
                'No interruptCommitMs is configured'
              ].join('\n')
          : [
              `Idle time: ${duration} wasted`,
              `No skill cast from ${formatTime(marker.start)} to ${formatTime(marker.end)}`
            ].join('\n');
    return (
      <div
        key={`idle:${marker.insertionIndex}:${marker.start}:${marker.end}`}
        className='rot-skill rot-injected rot-dead-time'
        role='note'
        aria-label={detail}
        title={detail}
      >
        <span className='rot-dead-time-label'>Idle</span>
        <strong className='rot-dead-time-duration'>{duration}</strong>
      </div>
    );
  };

  const renderOverlayProcMarker = (marker: (typeof overlayProcMarkers)[number]): ReactNode => {
    const key = procFilterKey(marker);
    const time = formatTime(marker.start);
    const icon = resolveProcIcon(app, marker) || PLACEHOLDER_ICON;
    const isRelic = marker.type === 'relic_proc';
    const isSkill = marker.type === 'skill_proc';
    const isTrait = marker.type === 'trait_proc';
    const expired = marker.expired === true;
    const type = isRelic ? 'Relic' : isSkill ? 'Skill' : isTrait ? 'Trait' : 'Sigil';
    const className = isRelic
      ? 'rot-relic-proc'
      : isSkill
        ? 'rot-skill-proc'
        : isTrait
          ? 'rot-trait-proc'
          : 'rot-sigil-proc';
    const color = procColors[marker.type] || '#9d7bd0';
    const count = marker.activations.length;
    const badgeLabel = expired ? '' : procBadgeLabel(marker.activations);
    const detail = expired
      ? [marker.skill, `Relic effect expired at ${time}`, count > 1 ? `After ${count} activations or refreshes` : '']
          .filter(Boolean)
          .join('\n')
      : count === 1
        ? [
            marker.skill,
            `${type} proc at ${time}`,
            marker.sourceSkill ? `Triggered by ${marker.sourceSkill}` : '',
            marker.detail || ''
          ]
            .filter(Boolean)
            .join('\n')
        : [
            marker.skill,
            `${type} proc x${count}`,
            ...marker.activations.map((activation, index) =>
              [
                `${index + 1}. ${formatTime(activation.start)}`,
                activation.sourceSkill ? `Triggered by ${activation.sourceSkill}` : '',
                activation.detail || ''
              ]
                .filter(Boolean)
                .join(' - ')
            )
          ].join('\n');
    const activeHighlight = app.rotationSkillHighlightKey === key;
    const hasHighlight = Boolean(app.rotationSkillHighlightKey);
    return (
      <div
        key={`proc:${key}:${marker.start}:${expired}`}
        className={`rot-skill rot-injected rot-proc-overlay ${className}${expired ? ' rot-relic-expired' : ''}${
          activeHighlight ? ' skill-highlight' : hasHighlight ? ' skill-faded' : ''
        }`}
        data-proc-key={key}
        data-skill-highlight-key={key}
        hidden={!procVisibility.has(key)}
        title={detail}
        style={{ '--att-border': color, '--proc-color': color } as CSSProperties}
        onClick={() => {
          app.rotationSkillHighlightKey = activeHighlight ? null : key;
          renderTimeline(app);
        }}
      >
        <img src={icon} alt='' />
        {expired ? <span className='proc-expired-cross' aria-hidden='true' /> : null}
        {badgeLabel ? <span className='proc-count'>{badgeLabel}</span> : null}
        <span className='rot-injected-badge'>{type.toUpperCase()}</span>
        <span className='rot-time'>{time}</span>
      </div>
    );
  };

  const availableHighlightKeys = new Set([
    ...app.build.rotation.map(rotationSkillHighlightKey),
    ...overlayProcMarkers.map(procFilterKey)
  ]);
  if (app.rotationSkillHighlightKey && !availableHighlightKeys.has(app.rotationSkillHighlightKey)) {
    app.rotationSkillHighlightKey = null;
  }

  const interactions = timelineInteractionOptions(app);
  const timelineRows = rows.map((row, rowNumber) => {
    const weapons = row.weaponSet === 1 ? app.build.weapons : app.build.alternateWeapons;
    const weaponLabel = row.weaponLine || weapons.filter(Boolean).join('/') || 'Unequipped';
    const rowLabel = row.weaponLine ? row.weaponLine.replace(/ Kit$/, '') : `W${row.weaponSet}`;
    const rowTitle = row.weaponLine ? `${row.weaponLine} weapon line` : `Weapon set ${row.weaponSet}: ${weaponLabel}`;
    const rowItems: ReactNode[] = [];
    row.skills.forEach(({ entry, index }) => {
      for (const marker of overlayProcMarkersByIndex.get(index) || []) {
        rowItems.push(renderOverlayProcMarker(marker));
      }

      for (const marker of healthMarkersByIndex.get(index) || []) {
        rowItems.push(renderHealthMarker(marker));
      }

      for (const marker of continuumEndsByIndex.get(index) || []) {
        rowItems.push(renderContinuumEnd(marker));
      }

      for (const marker of automaticPhotonForgeExitsByIndex.get(index) || []) {
        if (automaticPhotonForgeExitRowMarkers.has(marker)) continue;
        rowItems.push(renderAutomaticPhotonForgeExit(marker));
      }

      for (const marker of automaticTomeStowsByIndex.get(index) || []) {
        rowItems.push(renderAutomaticTomeStow(marker));
      }

      const item = timelineItem(entry);
      const highlightKey = rotationSkillHighlightKey(entry);
      const skill = resolveEntrySkill(app, item.command);
      const step = steps.get(index);
      const invalid = Boolean(step?.invalid);
      const display =
        item.type === 'wait'
          ? 'Wait'
          : item.type === 'combat-start'
            ? 'Combat Start'
            : item.type === 'cooldown-reset'
              ? 'Cooldown Reset'
              : String(skill?.displayName || skill?.name || item.name);
      const defaultIcon =
        item.type === 'wait'
          ? WAIT_ICON
          : item.type === 'combat-start'
            ? COMBAT_START_ICON
            : item.type === 'cooldown-reset'
              ? COOLDOWN_RESET_ICON
              : skill?.icon || (skill?.name ? ACTION_ICONS[skill.name] : '') || PLACEHOLDER_ICON;
      const icon =
        app.profession.ui.timelineSkillIcon?.({
          entry: item.command,
          index,
          rotation: app.build.rotation,
          build: app.build,
          catalog: app.activeCatalog,
          skill,
          defaultIcon
        }) || defaultIcon;
      const time = step && !invalid ? formatTime(step.start) : '';
      const resourceSpend = resourceSpends.get(index);
      const resourceSingular = resourceSpend?.resource.endsWith('s')
        ? resourceSpend.resource.slice(0, -1)
        : resourceSpend?.resource;
      // Blades and notes are consumed on cast end (when the hit lands); other resources on cast start.
      const resourceSpendTiming =
        resourceSpend?.resource === 'blades' || resourceSpend?.resource === 'notes' ? 'cast end' : 'cast start';
      const resourceLabel = resourceSpend
        ? `${resourceSpend.count} ${
            resourceSpend.count === 1 ? resourceSingular : resourceSpend.resource
          } consumed at ${resourceSpendTiming}`
        : '';
      const resourceShortLabel = resourceSpend
        ? resourceSpend.resource === 'dragon charges'
          ? `⚡${resourceSpend.count}`
          : `${resourceSpend.count}${
              resourceSpend.resource === 'blades'
                ? 'B'
                : resourceSpend.resource === 'clones'
                  ? 'C'
                  : resourceSpend.resource === 'notes'
                    ? 'N'
                    : 'R'
            }`
        : '';
      const dragonOutcome = resourceSpend?.resource === 'dragon charges' ? resourceSpend : null;
      const requestedCharges =
        item.releaseAtCharges == null ? Number(dragonOutcome?.maximumCharges) : Number(item.releaseAtCharges);
      const actualCharges = Number(dragonOutcome?.chargesReached ?? dragonOutcome?.count);
      // Mismatch means the sim ran out of flow before reaching the requested charge count.
      const chargeMismatch =
        Boolean(dragonOutcome) &&
        Number.isFinite(requestedCharges) &&
        Number.isFinite(actualCharges) &&
        requestedCharges !== actualCharges;
      const chargeOutcomeDetails = dragonOutcome
        ? [
            `Charges reached: ${actualCharges}`,
            `Time spent charging: ${Number(dragonOutcome.chargingSeconds || 0).toFixed(3)}s`,
            `Flow spent: ${Number(dragonOutcome.flowSpent || 0).toFixed(2)}`
          ]
        : [];
      const skillTooltip =
        step && !invalid && item.type === 'cast'
          ? formatTimelineSkillTooltip(display, step, castOrdinals.get(index), formatTime, chargeOutcomeDetails)
          : display;
      const titleSuffix = invalid
        ? `\n${step?.invalidReason || 'Not valid here — will not be simulated'}`
        : step && item.type !== 'cast'
          ? `\n${formatTimelineCastDetails(step, formatTime)}`
          : '';
      const resourceTitle = resourceLabel ? `\n${resourceLabel}` : '';
      const concurrentLabel =
        item.concurrentOffsetMs != null ? formatConcurrentTimelineBadge(item.concurrentOffsetMs, time) : '';
      const interruptLabel =
        item.interruptAfterMs != null ? formatInterruptTimelineBadge(item.interruptAfterMs, time) : '';
      const chargeReleaseLabel = skill?.dragonSlash
        ? `⚡${item.releaseAtCharges == null ? 'Max' : Number(item.releaseAtCharges)}${time ? `\n${time}` : ''}`
        : '';
      const doubleEdgeOutcome = item.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success';
      const doubleEdgeLabel = doubleEdgeOutcome === 'backfire' ? 'DE!' : 'DE✓';
      // Casts and Combat Start share behavior editing; waits expose their duration through the same pencil affordance.
      const canEditActivation = (item.type === 'cast' && skill != null) || item.type === 'combat-start';
      const canEditWait = item.type === 'wait';
      const skillHighlightActive = app.rotationSkillHighlightKey === highlightKey;
      const anySkillHighlight = Boolean(app.rotationSkillHighlightKey);
      // Dead time belongs to this boundary, after its insertion cursor and before the next authored skill.
      rowItems.push(
        <div key={timelineCommandKey(entry)} className='rot-entry'>
          <InsertionGap app={app} index={index} />
          {(deadTimesByIndex.get(index) || []).map(renderDeadTime)}
          <div
            className={`rot-skill${item.concurrentOffsetMs != null ? ' rot-concurrent' : ''}${
              invalid ? ' rot-invalid' : ''
            }${chargeMismatch ? ' rot-charge-mismatch' : ''}${
              skillHighlightActive ? ' skill-highlight' : anySkillHighlight ? ' skill-faded' : ''
            }`}
            draggable
            data-idx={index}
            data-skill-highlight-key={highlightKey}
            title={`${skillTooltip}${titleSuffix}${resourceTitle}`}
            style={{ '--att-border': '#9d7bd0' } as CSSProperties}
            onClick={() => {
              app.rotationSkillHighlightKey = skillHighlightActive ? null : highlightKey;
              renderTimeline(app);
            }}
            onDragStart={(event) => {
              app.dragState = { source: 'timeline', index };
              event.currentTarget.classList.add('dragging');
              event.dataTransfer.setData('text/plain', String(index));
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={(event) => {
              event.currentTarget.classList.remove('dragging');
              app.dragState = null;
              clearTimelineDropIndicators(element);
            }}
            onDragOver={(event) => {
              if (!app.dragState) return;
              event.preventDefault();
              clearTimelineDropIndicators(element);
              updateSkillDropIndicator(event.currentTarget, event.clientX);
            }}
            onDragLeave={(event) => event.currentTarget.classList.remove('drag-insert-before', 'drag-insert-after')}
            onDrop={(event) => {
              if (!app.dragState) return;
              event.preventDefault();
              event.stopPropagation();
              const insertAt = getSkillDropInsertionIndex(event.currentTarget, event.clientX);
              clearTimelineDropIndicators(element);
              if (insertAt != null) applyTimelineDrop(interactions, insertAt);
            }}
          >
            <img src={icon} alt='' />
            {skill?.variantBadge ? (
              <span className='skill-variant-badge rot-variant-badge'>{skill.variantBadge}</span>
            ) : null}
            {canEditActivation ? (
              <button
                type='button'
                className='rot-edit-activation'
                data-idx={index}
                title='Edit cast behavior'
                aria-label={`Edit ${display} cast behavior`}
                aria-haspopup='dialog'
                draggable={false}
                onMouseDown={(event) => event.stopPropagation()}
                onDragStart={stopControlDrag}
                onClick={(event) => {
                  event.stopPropagation();
                  editRotationActivation(app, index, event);
                }}
              >
                ✎
              </button>
            ) : canEditWait ? (
              <button
                type='button'
                className='rot-edit-wait'
                data-idx={index}
                title='Edit wait duration'
                aria-label='Edit Wait duration'
                aria-haspopup='dialog'
                draggable={false}
                onMouseDown={(event) => event.stopPropagation()}
                onDragStart={stopControlDrag}
                onClick={(event) => {
                  event.stopPropagation();
                  editRotationDuration(app, index, event);
                }}
              >
                ✎
              </button>
            ) : null}
            <button
              type='button'
              className='rot-x'
              title='Remove (Shift: remove this and everything after)'
              aria-label={`Remove ${display}`}
              draggable={false}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDragStart={stopControlDrag}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (event.shiftKey) app.build.rotation.splice(index);
                else app.build.rotation.splice(index, 1);
                app.rotationInsertionIndex = null;
                app.changed(false);
              }}
            >
              ×
            </button>
            {invalid ? (
              <span className='rot-invalid-badge' title='Invalid — not simulated'>
                ✕
              </span>
            ) : null}
            {resourceSpend && !skill?.dragonSlash ? (
              <span className='rot-resource-spend-badge' title={resourceLabel} aria-label={resourceLabel}>
                {resourceShortLabel}
              </span>
            ) : null}
            {time && item.concurrentOffsetMs == null && item.interruptAfterMs == null && !skill?.dragonSlash ? (
              <span className='rot-time'>{time}</span>
            ) : null}
            {item.concurrentOffsetMs != null ? (
              <span
                className='rot-offset-badge rot-timed-action-badge'
                title={`Delay ${item.concurrentOffsetMs}ms; cast at ${time}`}
              >
                {concurrentLabel}
              </span>
            ) : null}
            {item.interruptAfterMs != null ? (
              <span
                className='rot-gapfill-badge rot-interrupt-badge rot-timed-action-badge'
                data-idx={index}
                title={`Interrupt after ${item.interruptAfterMs}ms; cast at ${time}`}
                onClick={(event) => {
                  event.stopPropagation();
                  editRotationActivation(app, index, event);
                }}
              >
                {interruptLabel}
              </span>
            ) : null}
            {skill?.dragonSlash ? (
              <span
                className='rot-gapfill-badge rot-charge-release-badge rot-timed-action-badge'
                data-idx={index}
                title={`Release at ${item.releaseAtCharges == null ? 'maximum' : item.releaseAtCharges} charges; cast at ${time}`}
                onClick={(event) => {
                  event.stopPropagation();
                  editReleaseAtCharges(app, index, event);
                }}
              >
                {chargeReleaseLabel}
              </span>
            ) : null}
            {hasConfigurableDoubleEdgeOutcome(skill) ? (
              <span
                className='rot-gapfill-badge rot-double-edge-badge rot-timed-action-badge'
                data-idx={index}
                title={`Risky recast: ${doubleEdgeOutcomeLabel(doubleEdgeOutcome)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  editDoubleEdgeOutcome(app, index, event);
                }}
              >
                {doubleEdgeLabel}
              </span>
            ) : null}
            {item.durationMs != null ? (
              <span
                className='rot-gapfill-badge rot-wait-badge'
                data-idx={index}
                onClick={(event) => {
                  event.stopPropagation();
                  editRotationDuration(app, index, event);
                }}
              >
                ⌛{item.durationMs}ms
              </span>
            ) : null}
          </div>
        </div>
      );
    });
    for (const marker of automaticPhotonForgeExitsByRow.get(rowNumber) || []) {
      rowItems.push(renderAutomaticPhotonForgeExit(marker));
    }

    // Trailing markers (insertionIndex === rotation.length) belong after the last skill in the last row.
    if (rowNumber === rows.length - 1) {
      for (const marker of overlayProcMarkersByIndex.get(app.build.rotation.length) || []) {
        rowItems.push(renderOverlayProcMarker(marker));
      }

      rowItems.push(<InsertionGap key='trailing-insertion' app={app} index={app.build.rotation.length} />);
      for (const marker of healthMarkersByIndex.get(app.build.rotation.length) || []) {
        rowItems.push(renderHealthMarker(marker));
      }

      for (const marker of continuumEndsByIndex.get(app.build.rotation.length) || []) {
        rowItems.push(renderContinuumEnd(marker));
      }

      for (const marker of automaticPhotonForgeExitsByIndex.get(app.build.rotation.length) || []) {
        if (automaticPhotonForgeExitRowMarkers.has(marker)) continue;
        rowItems.push(renderAutomaticPhotonForgeExit(marker));
      }

      for (const marker of automaticTomeStowsByIndex.get(app.build.rotation.length) || []) {
        rowItems.push(renderAutomaticTomeStow(marker));
      }
    }

    const finalSkill = row.skills.at(-1);
    const insertAt = finalSkill ? finalSkill.index + 1 : 0;
    const firstCommand = row.skills[0]?.entry;
    const rowKey = firstCommand
      ? `${row.weaponSet}:${row.weaponLine || ''}:${timelineCommandKey(firstCommand)}`
      : `${row.weaponSet}:${row.weaponLine || ''}:empty:${rowNumber}`;
    return {
      key: rowKey,
      node: (
        <div key={rowKey} className='rot-row' style={{ '--row-color': '#9d7bd0' } as CSSProperties}>
          <div className='rot-row-label' title={rowTitle}>
            {rowLabel}
          </div>
          <div
            className='rot-row-skills'
            data-insert-idx={insertAt}
            onDragOver={(event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (!app.dragState || target?.closest('.rot-skill')) return;
              event.preventDefault();
              clearTimelineDropIndicators(element);
              event.currentTarget.classList.add('drag-over');
            }}
            onDragLeave={(event) => {
              if (event.target === event.currentTarget) event.currentTarget.classList.remove('drag-over');
            }}
            onDrop={(event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (!app.dragState || target?.closest('.rot-skill')) return;
              event.preventDefault();
              event.stopPropagation();
              clearTimelineDropIndicators(element);
              applyTimelineDrop(interactions, insertAt);
            }}
          >
            {rowItems}
          </div>
        </div>
      )
    };
  });

  app.rotationInsertionIndex = normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length);
  renderReact(
    element,
    <>
      <TimelineKeyboard app={app} root={element} />
      {timelineRows.map((row) => row.node)}
    </>
  );
  if (procElement) {
    renderReact(
      procElement,
      <ProcPanel app={app} procSteps={procSteps} procColors={procColors} formatTime={formatTime} />
    );
  }
}
