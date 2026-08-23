import {
  bindTimelineInteractions,
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  rotationEntryName,
  timelineDeadTimeMarkers,
  timelineSkillCastOrdinals,
  updateRotationEntry
} from '../../platform/ui/timeline.js';
import {
  activationDamageCommitMs,
  closeActivationEditor,
  openActivationEditor,
  suggestedActivationInterruptMs
} from '../../platform/ui/activation-editor.js';
import { closeChargeReleaseEditor } from '../../platform/ui/charge-release-editor.js';
import { closeDurationEditor, openDurationEditor } from '../../platform/ui/duration-editor.js';
import { escapeHtml as esc } from '../../platform/ui/html.js';
import {
  mountRotationInsertionCursor,
  rotationInsertionGapHtml,
  rotationTimelineEntryHtml
} from '../../platform/ui/insertion-cursor.js';
import { activeSpecialization, professionEndState } from './context.js';
import {
  ACTION_ICONS,
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  PLACEHOLDER_ICON,
  WAIT_ICON,
  resolveProcIcon
} from './icons.js';
import { renderPalette, resolvePaletteDropItem } from './palette-view.js';
import { renderRotationStateSnapshot } from './state-snapshot-view.js';
import { createRotationItem, resolveEntrySkill } from './actions.js';
import { openDragonSlashReleaseEditor } from './charge-release.js';
import {
  closeDoubleEdgeEditor,
  doubleEdgeOutcomeLabel,
  hasConfigurableDoubleEdgeOutcome,
  openDoubleEdgeEditor
} from './double-edge.js';
import { formatTimelineTime, resultCombatReferenceMs } from './result-model.js';
import {
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
  timelineWeaponRows
} from './timeline-model.js';
import type { RotationCommand, SchedulerRecord, SchedulerStep, SkillId } from '../../platform/engine/types.js';
import type { Gw2ProcStep } from '../../platform/gw2/types.js';
import type { TimelineInteractionOptions } from '../../platform/ui/types.js';
import type { ProfessionAppState, RotationActionOptions } from '../profession/types.js';

type TimelineItem = SchedulerRecord & {
  command: RotationCommand;
  type: RotationCommand['type'];
  name: string;
  skillId?: SkillId;
  concurrentOffsetMs?: number;
  interruptAfterMs?: number;
  releaseAtCharges?: unknown;
  doubleEdgeOutcome?: unknown;
  durationMs?: number;
};

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

// Shared editor for two distinct duration fields:
//   concurrentOffsetMs — ms from start of preceding cast to start this cast
//   durationMs         — explicit idle gap inserted between skills
// Anchor falls back to a DOM query so the editor can be opened programmatically (e.g. keyboard).
// onApply re-reads the rotation entry rather than closing over `entry` to guard against
// rotation mutations between the editor opening and the user confirming.
function editRotationDuration(
  app: ProfessionAppState,
  index: number,
  key: 'concurrentOffsetMs' | 'durationMs',
  event?: Event
): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const eventTarget = event?.currentTarget;
  const anchor =
    (eventTarget instanceof HTMLElement ? eventTarget : null) ||
    document.querySelector<HTMLElement>(
      `#rotation-timeline .${key === 'concurrentOffsetMs' ? 'rot-offset-badge' : 'rot-wait-badge'}[data-idx="${index}"]`
    );
  if (!anchor) return false;

  const skill = resolveEntrySkill(app, item.command);
  const isWait = key === 'durationMs';
  openDurationEditor({
    anchor,
    heading: isWait ? 'Edit wait' : 'Edit offset',
    name: isWait ? 'Wait' : String(skill?.displayName || skill?.name || item.name),
    icon:
      anchor.closest('.rot-skill')?.querySelector<HTMLImageElement>('img')?.src ||
      (isWait ? WAIT_ICON : skill?.icon || undefined),
    label: isWait ? 'Duration' : 'From start of preceding cast',
    value: Number(item[key]) || 1,
    onApply(durationMs) {
      const currentEntry = app.build.rotation[index];
      if (currentEntry === undefined) return;
      app.build.rotation[index] = updateRotationEntry(currentEntry, {
        [key]: durationMs
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

// "Activation" here means cast behavior: how long the skill runs before it's
// interrupted (early-cancelled to skip the aftercast). fullCastMs comes from the
// simulation result because traits/haste can extend the catalog cast time; falls
// back to catalog value when no sim result exists yet. The anchor is the whole
// .rot-skill card rather than the edit button so the popover positions correctly.
// interruptAfterMs omitted means no interruption; the editor removes it with undefined.
function editRotationActivation(app: ProfessionAppState, index: number, event?: Event): boolean {
  const entry = app.build.rotation[index];
  if (entry === undefined) return false;
  const item = timelineItem(entry);
  const skill = resolveEntrySkill(app, item.command);
  if (!skill) return false;

  const step = app.results?.steps?.find((candidate) => candidate.ri === index && !candidate.invalid);
  const catalogCastMs = Math.round(Number(skill.castTimeMs) || 0);
  const fullCastMs = Math.round(Number(step?.fullCastMs) || catalogCastMs);
  const eventTarget = event?.currentTarget;
  const eventElement = eventTarget instanceof HTMLElement ? eventTarget : null;
  const anchor =
    eventElement?.closest<HTMLElement>('.rot-skill') ||
    document.querySelector<HTMLElement>(`#rotation-timeline .rot-skill[data-idx="${index}"]`);
  if (!anchor) return false;

  openActivationEditor({
    anchor,
    skillName: String(skill.displayName || skill.name),
    icon: anchor.querySelector<HTMLImageElement>('img')?.getAttribute('src') || skill.icon || undefined,
    interruptMs: item.interruptAfterMs == null ? null : Number(item.interruptAfterMs),
    fullCastMs,
    suggestedInterruptMs: suggestedActivationInterruptMs(fullCastMs, catalogCastMs),
    damageCommitMs: activationDamageCommitMs(skill),
    onApply(interruptMs) {
      const currentEntry = app.build.rotation[index];
      if (currentEntry === undefined) return;
      app.build.rotation[index] = updateRotationEntry(currentEntry, {
        interruptAfterMs: interruptMs ?? undefined
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

function paletteDragAnchor(name: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('#rotation-palette .pal-skill.dragging') ||
    [...document.querySelectorAll<HTMLElement>('#rotation-palette .pal-skill[data-skill]')].find(
      (element) => element.dataset.skill === name
    ) ||
    null
  );
}

function timelineInteractionOptions(app: ProfessionAppState): TimelineInteractionOptions {
  return {
    rotation: app.build.rotation,
    getDragState: () => app.dragState,
    setDragState: (value) => {
      app.dragState = value;
    },
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
    },
    onChanged: () => {
      app.rotationInsertionIndex = null;
      app.changed(false);
    },
    onRemove: (index) => app.build.rotation.splice(index, 1),
    onTruncate: (index) => app.build.rotation.splice(index),
    onEditOffset: (index, event) => editRotationDuration(app, index, 'concurrentOffsetMs', event),
    onEditActivation: (index, event) => editRotationActivation(app, index, event),
    onEditReleaseAtCharges: (index, event) => editReleaseAtCharges(app, index, event),
    onEditDoubleEdgeOutcome: (index, event) => editDoubleEdgeOutcome(app, index, event),
    onEditWait: (index, event) => editRotationDuration(app, index, 'durationMs', event)
  };
}

export function renderTimeline(app: ProfessionAppState): void {
  // Close any open popover editors — their anchors are about to be replaced by innerHTML.
  closeActivationEditor();
  closeChargeReleaseEditor();
  closeDoubleEdgeEditor();
  closeDurationEditor();
  const element = document.getElementById('rotation-timeline');
  const procElement = document.getElementById('rotation-procs');
  if (!element) return;
  const procPanel = procElement?.querySelector<HTMLDetailsElement>('.rotation-procs-wrap') || null;
  // Capture open state before innerHTML wipes the element, so the panel stays open after re-render.
  const procPanelWasOpen = procPanel?.open ?? false;
  element.ondragover = null;
  element.ondragleave = null;
  element.ondrop = null;
  if (!app.build.rotation.length) {
    app.rotationSkillHighlightKey = null;
    element.classList.add('is-empty');
    element.innerHTML = `<div class="rot-empty">
            <strong>Build your rotation</strong>
            <span>Click or drag skills from the palette above</span>
        </div>`;
    if (procElement) procElement.innerHTML = '';
    app.rotationInsertionIndex = mountRotationInsertionCursor({
      root: element,
      insertionIndex: app.rotationInsertionIndex,
      rotationLength: 0,
      onSelect(index) {
        app.rotationInsertionIndex = index;
        renderPalette(app);
        renderTimeline(app);
        renderRotationStateSnapshot(app);
      },
      onClear() {
        app.rotationInsertionIndex = null;
        renderPalette(app);
        renderTimeline(app);
        renderRotationStateSnapshot(app);
      }
    });
    bindTimelineInteractions(element, timelineInteractionOptions(app));
    return;
  }

  element.classList.remove('is-empty');
  const resultSteps = app.results?.steps || [];
  // ri < 0 marks injected/synthetic steps (e.g. auto-attacks) not tied to a rotation entry.
  const steps = new Map<number, SchedulerStep>(
    resultSteps.filter((step) => step.ri >= 0).map((step) => [step.ri, step])
  );
  const castOrdinals = timelineSkillCastOrdinals(resultSteps);
  const resourceSpends = shatterResourceSpends(app.results);
  const automaticTomeStows = automaticTomeStowTimelineMarkers(app.results, app.build.rotation.length);
  // Tome stow indexes act as weapon-row boundaries — the tome weapon line ends when pages run out.
  const automaticTomeStowIndexes = new Set(automaticTomeStows.map((marker) => marker.insertionIndex));
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
    weaponLineEndIndexes: automaticTomeStowIndexes,
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
  const combatReferenceMs = resultCombatReferenceMs(app.results);
  const formatTime = (timeMs: number): string => formatTimelineTime(timeMs, combatReferenceMs);
  const deadTimes = timelineDeadTimeMarkers(
    timelineStepsWithChargeFills(resultSteps, resourceSpends),
    app.results?.resolvedEvents || []
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
  const procSteps = [...(app.results?.procSteps || [])].sort((a, b) => a.start - b.start);
  const procVisibility = procSteps.length ? syncProcVisibility(app, procSteps) : new Set<string>();
  const overlayProcMarkers = [
    ...(app.overlaySigilProcs ? sigilProcTimelineMarkers(app.results, app.build.rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcTimelineMarkers(app.results, app.build.rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcExpirationTimelineMarkers(app.results, app.build.rotation.length) : [])
  ].sort((left, right) => left.start - right.start);
  const overlayProcMarkersByIndex = new Map<number, typeof overlayProcMarkers>();
  for (const marker of overlayProcMarkers) {
    const markers = overlayProcMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    overlayProcMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const continuumEnds = continuumEndTimelineMarkers(app.results, app.build.rotation.length);
  const continuumEndsByIndex = new Map<number, typeof continuumEnds>();
  for (const marker of continuumEnds) {
    const markers = continuumEndsByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    continuumEndsByIndex.set(marker.insertionIndex, markers);
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
      professionState: professionEndState(app.results)
    }) || [];
  const healthMarkers = targetHealthTimelineMarkers(
    app.results,
    app.build.targetHealth,
    targetThresholds,
    app.build.rotation.length
  );
  const healthMarkersByIndex = new Map<number, typeof healthMarkers>();
  for (const marker of healthMarkers) {
    const markers = healthMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    healthMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const renderContinuumEnd = (marker: (typeof continuumEnds)[number]): string => {
    const time = formatTime(marker.start);
    const detail = [
      'Continuum Shift',
      `Continuum Split ended automatically at ${time}`,
      'Cooldown state restored'
    ].join('\n');
    return `<div class="rot-skill rot-injected" title="${esc(detail)}"
            style="--att-border:#d6b46b">
            <img src="${esc(ACTION_ICONS['Continuum Shift'])}" alt="" />
            <span class="rot-injected-badge">AUTO</span>
            <span class="rot-time">${time}</span>
        </div>`;
  };

  const renderAutomaticTomeStow = (marker: (typeof automaticTomeStows)[number]): string => {
    const time = formatTime(marker.start);
    const detail = ['Stow Tome', `Tome closed automatically at ${time}`, 'No tome pages remaining'].join('\n');
    const icon = app.activeCatalog.skillsByName.get('Stow Tome')?.icon || ACTION_ICONS['Stow Tome'] || PLACEHOLDER_ICON;
    return `<div class="rot-skill rot-injected" title="${esc(detail)}"
            style="--att-border:#d6b46b">
            <img src="${esc(icon)}" alt="" />
            <span class="rot-injected-badge">AUTO</span>
            <span class="rot-time">${time}</span>
        </div>`;
  };

  const renderHealthMarker = (marker: (typeof healthMarkers)[number]): string => {
    const time = formatTime(marker.start);
    const label = `${marker.healthPercent}%`;
    const detail = [
      `Target reached ${label} health`,
      `At ${time}`,
      `${Math.round(marker.damage).toLocaleString()} cumulative damage`
    ].join('\n');
    return `<div class="rot-skill rot-injected rot-health-marker"
            title="${esc(detail)}" style="--att-border:#d96b6b">
            <img src="${esc(COMBAT_START_ICON)}" alt="" />
            <span class="rot-injected-badge">${esc(label)}</span>
            <span class="rot-time">${time}</span>
        </div>`;
  };

  const renderDeadTime = (marker: (typeof deadTimes)[number]): string => {
    const duration = formatTimelineDuration(marker.durationMs);
    const detail =
      marker.reason === 'zero-damage-cast'
        ? [
            `Dead time: ${duration} wasted`,
            `${marker.skill || 'Skill'} dealt no damage after being interrupted`,
            'No interruptCommitMs is configured'
          ].join('\n')
        : [
            `Dead time: ${duration} wasted`,
            `No skill cast from ${formatTime(marker.start)} to ${formatTime(marker.end)}`
          ].join('\n');
    return `<div class="rot-skill rot-injected rot-dead-time" role="note"
            aria-label="${esc(detail)}" title="${esc(detail)}">
            <span class="rot-dead-time-label">Dead</span>
            <strong class="rot-dead-time-duration">${esc(duration)}</strong>
        </div>`;
  };

  const renderOverlayProcMarker = (marker: (typeof overlayProcMarkers)[number]): string => {
    const key = procFilterKey(marker);
    const time = formatTime(marker.start);
    const icon = resolveProcIcon(app, marker) || PLACEHOLDER_ICON;
    const isRelic = marker.type === 'relic_proc';
    const expired = marker.expired === true;
    const type = isRelic ? 'Relic' : 'Sigil';
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
    return `<div class="rot-skill rot-injected rot-proc-overlay ${isRelic ? 'rot-relic-proc' : 'rot-sigil-proc'}${expired ? ' rot-relic-expired' : ''}" data-proc-key="${esc(key)}" data-skill-highlight-key="${esc(key)}"${procVisibility.has(key) ? '' : ' hidden'}
            title="${esc(detail)}" style="--att-border:${color};--proc-color:${color}">
            <img src="${esc(icon)}" alt="" />
            ${expired ? '<span class="proc-expired-cross" aria-hidden="true"></span>' : ''}
            ${badgeLabel ? `<span class="proc-count">${esc(badgeLabel)}</span>` : ''}
            <span class="rot-injected-badge">${type.toUpperCase()}</span>
            <span class="rot-time">${time}</span>
        </div>`;
  };

  let timelineHtml = rows
    .map((row, rowNumber) => {
      const weapons = row.weaponSet === 1 ? app.build.weapons : app.build.alternateWeapons;
      const weaponLabel = row.weaponLine || weapons.filter(Boolean).join('/') || 'Unequipped';
      const rowLabel = row.weaponLine ? row.weaponLine.replace(/ Kit$/, '') : `W${row.weaponSet}`;
      const rowTitle = row.weaponLine ? `${row.weaponLine} weapon line` : `Weapon set ${row.weaponSet}: ${weaponLabel}`;
      const rowItems: string[] = [];
      row.skills.forEach(({ entry, index }) => {
        for (const marker of deadTimesByIndex.get(index) || []) {
          rowItems.push(renderDeadTime(marker));
        }

        for (const marker of overlayProcMarkersByIndex.get(index) || []) {
          rowItems.push(renderOverlayProcMarker(marker));
        }

        for (const marker of healthMarkersByIndex.get(index) || []) {
          rowItems.push(renderHealthMarker(marker));
        }

        for (const marker of continuumEndsByIndex.get(index) || []) {
          rowItems.push(renderContinuumEnd(marker));
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
        const catalogCastMs = Math.round(Number(skill?.castTimeMs) || 0);
        const fullCastMs = Math.round(Number(step?.fullCastMs) || catalogCastMs);
        // Show the edit button only if there is something to configure (instant skills have nothing to interrupt).
        const canEditActivation =
          item.type === 'cast' && (item.interruptAfterMs != null || fullCastMs > 0 || catalogCastMs > 0);
        rowItems.push(
          rotationTimelineEntryHtml(
            index,
            app.rotationInsertionIndex ?? app.build.rotation.length,
            `<div class="rot-skill${item.concurrentOffsetMs != null ? ' rot-concurrent' : ''}${invalid ? ' rot-invalid' : ''}${chargeMismatch ? ' rot-charge-mismatch' : ''}" draggable="true"
                    data-idx="${index}" data-skill-highlight-key="${esc(highlightKey)}" title="${esc(skillTooltip)}${titleSuffix}${resourceTitle}" style="--att-border:#9d7bd0">
                    <img src="${esc(icon)}" alt="" />
                    ${skill?.variantBadge ? `<span class="skill-variant-badge rot-variant-badge">${esc(skill.variantBadge)}</span>` : ''}
                    ${
                      canEditActivation
                        ? `<button type="button" class="rot-edit-activation" data-idx="${index}"
                        title="Edit cast behavior" aria-label="Edit ${esc(display)} cast behavior" aria-haspopup="dialog">&#9998;</button>`
                        : ''
                    }
                    <span class="rot-x" title="Remove (Shift: remove this and everything after)">×</span>
                    ${invalid ? '<span class="rot-invalid-badge" title="Invalid — not simulated">✕</span>' : ''}
                    ${
                      resourceSpend
                        ? `<span class="rot-resource-spend-badge"
                        title="${esc(resourceLabel)}" aria-label="${esc(resourceLabel)}">${esc(resourceShortLabel)}</span>`
                        : ''
                    }
                    ${time && item.concurrentOffsetMs == null && item.interruptAfterMs == null && !skill?.dragonSlash ? `<span class="rot-time">${time}</span>` : ''}
                    ${
                      item.concurrentOffsetMs != null
                        ? `<span class="rot-offset-badge rot-timed-action-badge" data-idx="${index}"
                        title="Delay ${item.concurrentOffsetMs}ms; cast at ${esc(time)}">${esc(concurrentLabel)}</span>`
                        : ''
                    }
                    ${
                      item.interruptAfterMs != null
                        ? `<span class="rot-gapfill-badge rot-interrupt-badge rot-timed-action-badge"
                        data-idx="${index}" title="Interrupt after ${item.interruptAfterMs}ms; cast at ${esc(time)}">${esc(interruptLabel)}</span>`
                        : ''
                    }
                    ${
                      skill?.dragonSlash
                        ? `<span class="rot-gapfill-badge rot-charge-release-badge rot-timed-action-badge"
                        data-idx="${index}" title="Release at ${item.releaseAtCharges == null ? 'maximum' : item.releaseAtCharges} charges; cast at ${esc(time)}">${esc(chargeReleaseLabel)}</span>`
                        : ''
                    }
                    ${
                      hasConfigurableDoubleEdgeOutcome(skill)
                        ? `<span class="rot-gapfill-badge rot-double-edge-badge rot-timed-action-badge"
                        data-idx="${index}" title="Risky recast: ${esc(doubleEdgeOutcomeLabel(doubleEdgeOutcome))}">${esc(doubleEdgeLabel)}</span>`
                        : ''
                    }
                    ${item.durationMs != null ? `<span class="rot-gapfill-badge rot-wait-badge" data-idx="${index}">⌛${item.durationMs}ms</span>` : ''}
                </div>`
          )
        );
      });
      // Trailing markers (insertionIndex === rotation.length) belong after the last skill in the last row.
      if (rowNumber === rows.length - 1) {
        for (const marker of overlayProcMarkersByIndex.get(app.build.rotation.length) || []) {
          rowItems.push(renderOverlayProcMarker(marker));
        }

        rowItems.push(
          rotationInsertionGapHtml(app.build.rotation.length, app.rotationInsertionIndex ?? app.build.rotation.length)
        );
        for (const marker of healthMarkersByIndex.get(app.build.rotation.length) || []) {
          rowItems.push(renderHealthMarker(marker));
        }

        for (const marker of continuumEndsByIndex.get(app.build.rotation.length) || []) {
          rowItems.push(renderContinuumEnd(marker));
        }

        for (const marker of automaticTomeStowsByIndex.get(app.build.rotation.length) || []) {
          rowItems.push(renderAutomaticTomeStow(marker));
        }
      }

      const skills = rowItems.join('');
      const finalSkill = row.skills.at(-1);
      const insertAt = finalSkill ? finalSkill.index + 1 : 0;
      return `<div class="rot-row" style="--row-color:#9d7bd0">
            <div class="rot-row-label" title="${esc(rowTitle)}">${esc(rowLabel)}</div>
            <div class="rot-row-skills" data-insert-idx="${insertAt}">${skills}</div>
        </div>`;
    })
    .join('');

  if (procSteps.length) {
    const procOptions = [...new Map(procSteps.map((proc) => [procFilterKey(proc), proc])).values()].sort((a, b) =>
      procFilterLabel(a).localeCompare(procFilterLabel(b))
    );
    const visibleProcCount = procOptions.filter((proc) => procVisibility.has(procFilterKey(proc))).length;
    const procs = groupConsecutiveProcSteps(procSteps)
      .map((group) => {
        const proc = group.steps[0];
        if (!proc) return '';
        const { key } = group;
        const icon = resolveProcIcon(app, proc) || PLACEHOLDER_ICON;
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
        const badgeLabel = procBadgeLabel(group.steps);
        const stackLabel = procStackLabel(group.steps.at(-1) || proc);
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
        return `<div class="proc-icon" data-proc-key="${esc(key)}"${procVisibility.has(key) ? '' : ' hidden'} title="${esc(detail)}"
                style="--proc-color:${procColors[proc.type] || '#9d7bd0'}">
                <img src="${esc(icon)}" alt="" />
                ${badgeLabel ? `<span class="proc-count">${esc(badgeLabel)}</span>` : ''}
                ${stackLabel ? `<span class="proc-stack">${esc(stackLabel)}</span>` : ''}
                <span class="proc-time">${time}</span>
            </div>`;
      })
      .join('');
    if (procElement)
      procElement.innerHTML = `<details class="rotation-procs-wrap"${procPanelWasOpen ? ' open' : ''}>
            <summary>Procs (${procSteps.length} activation${procSteps.length === 1 ? '' : 's'})</summary>
            <div class="rotation-procs-content">
                <details class="proc-filter"${app.procFilterOpen ? ' open' : ''}>
                    <summary title="Choose which proc types are shown">Visible <span class="proc-filter-count">${visibleProcCount}/${procOptions.length}</span></summary>
                    <div class="proc-filter-menu">
                        ${procOptions
                          .map((proc) => {
                            const key = procFilterKey(proc);
                            return `<label class="proc-filter-option">
                                <input type="checkbox" data-proc-key="${esc(key)}"${procVisibility.has(key) ? ' checked' : ''}>
                                <span>${esc(procFilterLabel(proc))}</span>
                            </label>`;
                          })
                          .join('')}
                    </div>
                </details>
                <div class="proc-icons-row">${procs}</div>
            </div>
        </details>`;
  } else if (procElement) procElement.innerHTML = '';
  element.innerHTML = timelineHtml;
  app.rotationInsertionIndex = mountRotationInsertionCursor({
    root: element,
    insertionIndex: app.rotationInsertionIndex,
    rotationLength: app.build.rotation.length,
    onSelect(index) {
      app.rotationInsertionIndex = index;
      renderPalette(app);
      renderTimeline(app);
      renderRotationStateSnapshot(app);
    },
    onClear() {
      app.rotationInsertionIndex = null;
      renderPalette(app);
      renderTimeline(app);
      renderRotationStateSnapshot(app);
    }
  });

  const applySkillHighlight = (): void => {
    const skills = [...element.querySelectorAll<HTMLElement>('.rot-skill[data-skill-highlight-key]')];
    const key = app.rotationSkillHighlightKey;
    const active = !!key && skills.some((skill) => skill.dataset.skillHighlightKey === key);
    if (!active) app.rotationSkillHighlightKey = null;
    skills.forEach((skill) => {
      const match = active && skill.dataset.skillHighlightKey === key;
      skill.classList.toggle('skill-highlight', match);
      skill.classList.toggle('skill-faded', active && !match);
    });
  };

  element.querySelectorAll<HTMLElement>('.rot-skill[data-skill-highlight-key]').forEach((skill) => {
    skill.addEventListener('click', () => {
      const key = skill.dataset.skillHighlightKey;
      app.rotationSkillHighlightKey = app.rotationSkillHighlightKey === key ? null : key;
      applySkillHighlight();
    });
  });
  applySkillHighlight();

  const procFilter = procElement?.querySelector<HTMLDetailsElement>('.proc-filter') || null;
  const activeProcVisibility = app.procVisibility || new Set();
  if (procFilter && procElement) {
    procFilter.addEventListener('toggle', () => {
      app.procFilterOpen = procFilter.open;
    });
    // Proc filter toggles update DOM visibility directly rather than re-rendering,
    // keeping the panel open and avoiding an expensive full timeline rebuild.
    procFilter.querySelectorAll('input[data-proc-key]').forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.addEventListener('change', () => {
        const key = input.dataset.procKey || '';
        if (input.checked) activeProcVisibility.add(key);
        else activeProcVisibility.delete(key);

        if (!input.checked && app.rotationSkillHighlightKey === key) {
          app.rotationSkillHighlightKey = null;
          applySkillHighlight();
        }

        app.procFilterOpen = true;
        procElement.querySelectorAll('.proc-icon[data-proc-key]').forEach((procIcon) => {
          if (!(procIcon instanceof HTMLElement)) return;
          procIcon.hidden = !activeProcVisibility.has(procIcon.dataset.procKey || '');
        });
        element.querySelectorAll('.rot-proc-overlay[data-proc-key]').forEach((procIcon) => {
          if (!(procIcon instanceof HTMLElement)) return;
          procIcon.hidden = !activeProcVisibility.has(procIcon.dataset.procKey || '');
        });
        const count = procFilter.querySelector('.proc-filter-count');
        if (count) {
          const visible = procFilter.querySelectorAll('input[data-proc-key]:checked').length;
          const total = procFilter.querySelectorAll('input[data-proc-key]').length;
          count.textContent = `${visible}/${total}`;
        }
      });
    });
  }

  const procIconsRow = procElement?.querySelector<HTMLElement>('.proc-icons-row') || null;
  if (procIconsRow) {
    const applyProcHighlight = (): void => {
      const icons = [...procIconsRow.querySelectorAll('.proc-icon[data-proc-key]')];
      const key = app.procHighlightKey;
      const active = !!key && icons.some((icon) => icon instanceof HTMLElement && icon.dataset.procKey === key);
      if (!active) app.procHighlightKey = null;
      icons.forEach((icon) => {
        if (!(icon instanceof HTMLElement)) return;
        const match = active && icon.dataset.procKey === key;
        icon.classList.toggle('proc-highlight', match);
        icon.classList.toggle('proc-faded', active && !match);
      });
    };

    procIconsRow.querySelectorAll('.proc-icon[data-proc-key]').forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      icon.addEventListener('click', () => {
        const key = icon.dataset.procKey;
        app.procHighlightKey = app.procHighlightKey === key ? null : key;
        applyProcHighlight();
      });
    });
    applyProcHighlight();
  }

  bindTimelineInteractions(element, timelineInteractionOptions(app));
}
