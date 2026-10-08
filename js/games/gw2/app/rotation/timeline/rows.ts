/**
 * Projects authored commands and simulation events into timeline rows and the proc panel.
 * The view reconciles this HTML into the DOM, so imported text must be escaped at each HTML boundary.
 */
import { escapeHtml as esc } from '#ui/shared/html.js';
import { skillTooltipAttributes } from '#gw2/app/shared/tooltip-overlay.js';
import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import {
  doubleEdgeOutcomeLabel,
  hasConfigurableDoubleEdgeOutcome
} from '#gw2/app/rotation/editing/double-edge-editor.js';
import { professionPlanningState } from '#gw2/app/rotation/context.js';
import {
  ACTION_ICONS,
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  WAIT_ICON,
  resolveProcIcon
} from '#gw2/app/shared/icons.js';
import { PLACEHOLDER_ICON } from '#gw2/app/shared/placeholder-icon.js';
import {
  professionTimelineMarkers,
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  groupConsecutiveProcSteps,
  procBadgeLabel,
  procFilterKey,
  procFilterLabel,
  procTypeLabel,
  procStackLabel,
  relicProcExpirationTimelineMarkers,
  relicProcTimelineMarkers,
  rotationEntryName,
  rotationSkillHighlightKey,
  mechanicResourceSpends,
  sigilProcTimelineMarkers,
  targetHealthTimelineMarkers,
  timelineDeadTimeMarkers,
  timelineTransitionDelayMarkers,
  timelineItem,
  timelineSkillCastOrdinals,
  timelineTargetImpactDetails,
  timelineStepsWithChargeFills,
  timelineWeaponRowGroups,
  timelineWeaponRows,
  traitProcTimelineMarkers
} from '#gw2/app/rotation/timeline/model.js';
import { formatTimelineTime, resultCombatReferenceMs } from '#gw2/app/shared/result-clock.js';
import { weaponSetActiveSegments, weaponSetDurationTotals } from '#gw2/app/rotation/timeline/timing/model.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { RotationCommand } from '#gw2/platform/execution/rotation.js';
import type { SimulationStep } from '#gw2/platform/results/types.js';
import { rotationInsertionGapHtml, rotationTimelineEntryHtml } from '#ui/rotation/insertion-cursor.js';

/** The view retains a row's DOM node while both its identity and rendered HTML remain unchanged. */
export interface TimelineRowRender {
  readonly key: string;
  readonly html: string;
}

// Circular-arrow glyph marks relic activations that only extended an active effect window.
// Drawn on a 12px grid with 2px strokes and a filled head so it stays legible at badge size.
const PROC_REFRESH_ICON =
  '<svg viewBox="0 0 12 12" focusable="false"><path class="proc-refresh-arc" d="M9.3 7.7A3.5 3.5 0 1 1 6 3"/><path d="M5.5 0.75V5.25L9 3Z"/></svg>';

const timelineCommandKeys = new WeakMap<object, number>();
let nextTimelineCommandKey = 1;

/** Keeps row identity attached to its first command when edits move that command to another index. */
function timelineCommandKey(command: RotationCommand): number {
  const object = command as object;
  const existing = timelineCommandKeys.get(object);
  if (existing) return existing;
  const key = nextTimelineCommandKey++;
  timelineCommandKeys.set(object, key);
  return key;
}

/**
 * Builds shared editable/reference markup without changing DOM nodes or rotation state.
 * Null results retain authored tiles without simulation details; readOnly omits editing controls.
 * Proc visibility and disclosure state come from the caller so rerenders preserve those choices.
 */
export function timelineRowsView(
  app: ProfessionAppState,
  build: Gw2CanonicalBuild,
  results: ProfessionAppResult | null,
  readOnly: boolean,
  procVisibility: ReadonlySet<string>,
  procPanelWasOpen: boolean
): { rows: TimelineRowRender[]; procHtml: string } {
  const rotation = build.rotation;
  let procHtml = '';
  const resultSteps = results?.steps || [];
  // Only flag interrupted casts with no resolved damage, including delayed hits and condition ticks.
  const damagingActivations = new Set(
    (results?.resolvedEvents || []).filter((event) => Number(event.damage) > 0).map((event) => event.activationId)
  );
  // Action details carry runtime-selected variants and other cast facts into the generic timeline tooltip.
  const actionDetails = new Map(
    (results?.events || [])
      .filter((event) => event.type === 'action' && event.activationId && event.detail)
      .map((event) => [String(event.activationId), String(event.detail)])
  );
  const transitionDetails = new Map(
    (results?.events || [])
      .filter((event) => event.type === 'gw2.transition-lockout' && event.activationId)
      .map((event) => [
        String(event.activationId),
        `Transition delay: ${Math.round(Number(event.duration) * 1000)} ms (overlaps cast recovery)`
      ])
  );
  // ri < 0 marks injected/synthetic steps (e.g. auto-attacks) not tied to a rotation entry.
  const steps = new Map<number, SimulationStep>(
    resultSteps.filter((step) => step.ri >= 0).map((step) => [step.ri, step])
  );
  const castOrdinals = timelineSkillCastOrdinals(resultSteps);
  const resourceSpends = mechanicResourceSpends(results);
  // Partition commands by weapon set and transformation so events can be placed on their owning line.
  const startingWeaponSet = build.startingWeaponSet;
  const specialization = app.adapter.eliteSpecialization(build);
  const startingWeaponLine =
    app.profession.ui.timelineWeaponLineTransition({
      initial: true,
      build,
      specialization,
      weaponSet: startingWeaponSet,
      weaponLine: null
    }) ?? null;
  const hasSecondWeaponSet = Boolean(build.alternateWeapons?.[0]);
  // Executed transitions distinguish legal precombat swaps from rejected inputs and kit exits.
  const swappedActivations = new Set(
    (results?.events ?? [])
      .filter(
        (event) =>
          event.type === 'weapon_set' &&
          event.skillId != null &&
          app.skillById.get(event.skillId)?.inputCategory === 'weapon-swap'
      )
      .map((event) => event.activationId)
  );
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet,
    startingWeaponLine,
    isWeaponSwap(_entry, index) {
      // Pending rows keep the starting set until execution confirms a transition, including implicit combat entry.
      const activation = steps.get(index)?.activationId;
      return hasSecondWeaponSet && activation != null && swappedActivations.has(activation);
    },
    skillName: (entry) => resolveEntrySkill(app, entry)?.name || rotationEntryName(entry),
    weaponLineTransition: (entry, current, index) => {
      const item = timelineItem(entry);
      const step = steps.get(index);
      if (step?.invalid) return undefined;
      const skill =
        (step?.skillId == null ? undefined : app.skillById.get(step.skillId)) ?? resolveEntrySkill(app, item.command);
      return app.profession.ui.timelineWeaponLineTransition({
        entry: item.command,
        skill,
        build,
        specialization,
        ...current
      });
    }
  });
  const weaponDurationOptions = {
    startingWeaponSet,
    timelineEndMs: Number(results?.rotationEndTime || 0) * 1000,
    hasSecondWeaponSet,
    weaponSwapSkillIds: new Set(
      app.skills.filter((skill) => skill.inputCategory === 'weapon-swap').map((skill) => skill.id)
    )
  };
  const weaponDurationSegments = results ? weaponSetActiveSegments(resultSteps, weaponDurationOptions) : [];
  const weaponDurationTotals = results
    ? weaponSetDurationTotals(resultSteps, {
        ...weaponDurationOptions
      })
    : null;
  const combatReferenceMs = resultCombatReferenceMs(results);
  // Timeline timestamps keep millisecond precision so authored waits display their exact boundaries.
  const formatTime = (timeMs: number): string => formatTimelineTime(timeMs, combatReferenceMs, 3);
  const targetImpacts = timelineTargetImpactDetails(resultSteps, results?.events || [], formatTime);
  const deadTimes = timelineDeadTimeMarkers(
    timelineStepsWithChargeFills(resultSteps, resourceSpends),
    results?.resolvedEvents || [],
    // The authored Wait tile already represents its own duration. Overlay only
    // idle time beyond that shape so the timeline does not render it twice.
    { includeExplicitWaits: false }
  );
  const deadTimesByIndex = new Map<number, typeof deadTimes>();
  const transitionDelays = timelineTransitionDelayMarkers(
    resultSteps,
    results?.events || [],
    Number(results?.planningState?.atSeconds || 0) * 1000
  );
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
  // Resolve enabled declarations once; every proc uses the same active-specialization selection.
  const professionOverlays = app.profession.ui
    .timelineOverlays({ build, specialization })
    .filter((overlay) => app.timelineOverlayVisibility?.[overlay.id]);
  const overlayProcMarkers = [
    ...(app.overlaySigilProcs ? sigilProcTimelineMarkers(results, rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcTimelineMarkers(results, rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcExpirationTimelineMarkers(results, rotation.length) : []),
    ...(professionOverlays.length
      ? traitProcTimelineMarkers(results, rotation.length).filter((marker) =>
          professionOverlays.some((overlay) => overlay.matchesProc(marker))
        )
      : [])
  ].sort((left, right) => left.start - right.start);
  // Insertion indexes place simulated events between authored commands without adding editable commands.
  const overlayProcMarkersByIndex = new Map<number, typeof overlayProcMarkers>();
  for (const marker of overlayProcMarkers) {
    const markers = overlayProcMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    overlayProcMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const professionMarkers = professionTimelineMarkers(
    results,
    rotation.length,
    app.profession.ui.timelineMarkers({ result: results, build, specialization, catalog: app.activeCatalog })
  );
  const professionMarkersByIndex = new Map<number, typeof professionMarkers>();
  for (const marker of professionMarkers) {
    const markers = professionMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    professionMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const targetThresholds =
    app.profession.ui.targetHealthThresholds?.({
      specialization,
      build,
      professionState: professionPlanningState(results)
    }) || [];
  const healthMarkers = targetHealthTimelineMarkers(
    results,
    build.targetHealth,
    targetThresholds,
    rotation.length,
    build.targetStartingHealthPercent
  );
  const healthMarkersByIndex = new Map<number, typeof healthMarkers>();
  for (const marker of healthMarkers) {
    const markers = healthMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    healthMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const renderProfessionMarker = (marker: (typeof professionMarkers)[number]): string => {
    const time = formatTime(marker.start);
    const detail = marker.title(time);
    return `<div class="rot-skill rot-injected rot-automatic-transition" title="${esc(detail)}"
            style="--att-border:${esc(marker.color)}">
            <img src="${esc(marker.icon)}" alt="" />
            <span class="rot-injected-badge">${esc(marker.badge)}</span>
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
    return `<div class="rot-skill rot-injected rot-dead-time" role="note"
            aria-label="${esc(detail)}" title="${esc(detail)}">
            <span class="rot-dead-time-label">Idle</span>
            <strong class="rot-dead-time-duration">${esc(duration)}</strong>
        </div>`;
  };

  const renderTransitionDelay = (marker: (typeof transitionDelays)[number]): string => {
    const detail = `Forced transition delay: ${marker.durationMs} ms\nRecovery from ${formatTime(marker.start)} to ${formatTime(marker.end)}\nAlready overlaps any cast recovery or explicit wait.`;
    return `<div class="rot-skill rot-injected rot-forced-delay" role="note" aria-label="${esc(detail)}" title="${esc(detail)}">
      <span class="rot-dead-time-label">Delay</span><strong class="rot-dead-time-duration">${esc(formatTimelineDuration(marker.durationMs))}</strong>
    </div>`;
  };

  // Both proc presentations describe the same activations; expiration remains an overlay-only detail.
  const procActivationDetail = (proc: Gw2ProcStep, activations: readonly Gw2ProcStep[]): string =>
    activations.length === 1
      ? [
          proc.skill,
          `${procTypeLabel(proc)} proc at ${formatTime(proc.start)}`,
          proc.sourceSkill ? `Triggered by ${proc.sourceSkill}` : '',
          proc.detail || ''
        ]
          .filter(Boolean)
          .join('\n')
      : [
          proc.skill,
          `${procTypeLabel(proc)} proc x${activations.length}`,
          ...activations.map((activation, index) =>
            [
              `${index + 1}. ${formatTime(activation.start)}`,
              activation.sourceSkill ? `Triggered by ${activation.sourceSkill}` : '',
              activation.detail || ''
            ]
              .filter(Boolean)
              .join(' - ')
          )
        ].join('\n');

  const renderOverlayProcMarker = (marker: (typeof overlayProcMarkers)[number]): string => {
    const key = procFilterKey(marker);
    const time = formatTime(marker.start);
    const icon = resolveProcIcon(app, marker) || PLACEHOLDER_ICON;
    const expired = marker.expired === true;
    const type = procTypeLabel(marker);
    const className = `rot-${type.toLowerCase()}-proc`;
    const color = procColors[marker.type] || '#9d7bd0';
    const count = marker.activations.length;
    const badgeLabel = expired ? '' : procBadgeLabel(marker.activations);
    // Live activations show the stack state they left behind and whether they only extended an active window.
    const stackLabel = expired ? '' : procStackLabel(marker.activations.at(-1) || marker);
    const refreshed = !expired && marker.refreshed === true;
    const detail = expired
      ? [marker.skill, `Relic effect expired at ${time}`, count > 1 ? `After ${count} activations or refreshes` : '']
          .filter(Boolean)
          .join('\n')
      : procActivationDetail(marker, marker.activations);
    return `<div class="rot-entry rot-proc-entry" data-proc-key="${esc(key)}"${procVisibility.has(key) ? '' : ' hidden'}>
        <div class="rot-skill rot-injected rot-proc-overlay ${className}${expired ? ' rot-relic-expired' : ''}${refreshed ? ' rot-relic-refreshed' : ''}" data-proc-key="${esc(key)}" data-skill-highlight-key="${esc(key)}"
            title="${esc(detail)}" style="--att-border:${color};--proc-color:${color}">
            <img src="${esc(icon)}" alt="" />
            ${expired ? '<span class="proc-expired-cross" aria-hidden="true"></span>' : ''}
            ${badgeLabel ? `<span class="proc-count">${esc(badgeLabel)}</span>` : ''}
            ${stackLabel ? `<span class="proc-stack">${esc(stackLabel)}</span>` : ''}
            ${refreshed ? `<span class="proc-refresh" aria-hidden="true">${PROC_REFRESH_ICON}</span>` : ''}
            <span class="rot-injected-badge">${type.toUpperCase()}</span>
            <span class="rot-time">${time}</span>
        </div>
        </div>`;
  };

  // Emit boundary markers before each authored tile, then close the line with any automatic exits.
  const timelineLines = rows.map((row, rowNumber) => {
    const rowItems: string[] = [];
    row.skills.forEach(({ entry, index }) => {
      for (const marker of overlayProcMarkersByIndex.get(index) || []) {
        rowItems.push(renderOverlayProcMarker(marker));
      }

      for (const marker of healthMarkersByIndex.get(index) || []) {
        rowItems.push(renderHealthMarker(marker));
      }

      for (const marker of professionMarkersByIndex.get(index) || []) {
        rowItems.push(renderProfessionMarker(marker));
      }

      const item = timelineItem(entry);
      const highlightKey = rotationSkillHighlightKey(entry);
      const step = steps.get(index);
      // Trait-selected variants can differ from saved commands; display the skill that actually ran.
      const skill = resolveEntrySkill(app, step?.skillId != null ? { name: step.skillId } : item.command);
      const invalid = Boolean(step?.invalid);
      // Empty interrupted packet casts are cancelled; committed non-damaging buffs retain their normal styling.
      const cancelledWithoutDamage =
        !invalid &&
        step?.interrupted === true &&
        (skill?.interruptMode === 'per-packet' ||
          step.cancelledBeforeCommit === true ||
          skill?.interruptCommitMs == null) &&
        !!step.activationId &&
        !damagingActivations.has(step.activationId);
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
          rotation,
          build,
          catalog: app.activeCatalog,
          skill
        }) || defaultIcon;
      const time = step && !invalid ? formatTime(step.start) : '';
      const resourceSpend = resourceSpends.get(index);
      const annotation = app.profession.ui.timelineAnnotation({
        build,
        specialization,
        catalog: app.activeCatalog,
        skill,
        entry: item.command,
        spend: resourceSpend,
        formattedTime: time
      });
      const resourceLabel = annotation?.resourceLabel || '';
      const resourceShortLabel = annotation?.resourceShortLabel || '';
      const outcomeMismatch = annotation?.outcomeMismatch === true;
      const outcomeDetails = annotation?.details || [];
      const actionDetail = step?.activationId ? actionDetails.get(step.activationId) : undefined;
      const skillTooltip =
        step && !invalid && item.type === 'cast'
          ? formatTimelineSkillTooltip(display, step, castOrdinals.get(index), formatTime, [
              ...(step.activationId && targetImpacts.has(step.activationId)
                ? [targetImpacts.get(step.activationId)!]
                : []),
              ...(actionDetail ? [actionDetail] : []),
              ...(step.activationId && transitionDetails.has(step.activationId)
                ? [transitionDetails.get(step.activationId)!]
                : []),
              ...(cancelledWithoutDamage ? ['Cancelled without dealing damage'] : []),
              ...outcomeDetails
            ])
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
      const doubleEdgeOutcome = item.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success';
      const doubleEdgeLabel = doubleEdgeOutcome === 'backfire' ? 'DE!' : 'DE✓';
      // Casts and Combat Start share behavior editing; waits expose their duration through the same pencil affordance.
      const canEditActivation = (item.type === 'cast' && skill != null) || item.type === 'combat-start';
      const editLabel = annotation?.editLabel || 'cast behavior';
      const canEditWait = item.type === 'wait';
      // Dead time belongs to this boundary, after its insertion cursor and before the next authored skill.
      const deadTimeHtml = [
        ...(deadTimesByIndex.get(index) || []).map((marker) => ({ start: marker.start, html: renderDeadTime(marker) })),
        ...transitionDelays
          .filter((marker) => marker.insertionIndex === index)
          .map((marker) => ({ start: marker.start, html: renderTransitionDelay(marker) }))
      ]
        .sort((left, right) => left.start - right.start)
        .map((marker) => marker.html)
        .join('');
      // Expose the displayed combat clock for comparison scrolling; unsimulated or invalid casts cannot anchor it.
      const combatTimeAttribute = step && !invalid ? ` data-combat-time-ms="${step.start - combatReferenceMs}"` : '';
      // Escape the complete title once so imported diagnostic and resource text cannot become HTML attributes.
      const entryHtml = `${deadTimeHtml}<div class="rot-skill${item.concurrentOffsetMs != null ? ' rot-concurrent' : ''}${invalid ? ' rot-invalid' : ''}${outcomeMismatch ? ' rot-charge-mismatch' : ''}${cancelledWithoutDamage ? ' rot-cancelled' : ''}"${readOnly ? '' : ' draggable="true"'}
                    data-idx="${index}"${combatTimeAttribute} data-skill-highlight-key="${esc(highlightKey)}" ${skill ? `${skillTooltipAttributes(skill, app.adapter.skillTooltip(skill, app.patchId, app.build), { details: (skillTooltip === display ? '' : skillTooltip) + titleSuffix + resourceTitle, detailsTitle: 'Rotation details' })} data-wiki-delay="700" tabindex="0"` : `title="${esc(skillTooltip + titleSuffix + resourceTitle)}"`} style="--att-border:${cancelledWithoutDamage ? '#ff3b45' : '#9d7bd0'}">
                    <img src="${esc(icon)}" alt="" />
                    ${skill?.variantBadge ? `<span class="skill-variant-badge rot-variant-badge">${esc(skill.variantBadge)}</span>` : ''}
                    ${
                      !readOnly && canEditActivation
                        ? `<button type="button" class="rot-edit-activation" data-idx="${index}"
                        title="Edit ${editLabel}" aria-label="Edit ${esc(display)} ${editLabel}" aria-haspopup="dialog">&#9998;</button>`
                        : !readOnly && canEditWait
                          ? `<button type="button" class="rot-edit-wait" data-idx="${index}"
                        title="Edit wait duration" aria-label="Edit Wait duration" aria-haspopup="dialog">&#9998;</button>`
                          : ''
                    }
                    ${readOnly ? '' : '<span class="rot-x" title="Remove (Shift: remove this and everything after)">×</span>'}
                    ${invalid ? '<span class="rot-invalid-badge" title="Invalid — not simulated">✕</span>' : ''}
                    ${
                      // A release badge already carries the timestamp, leaving room for the edit affordance.
                      resourceShortLabel && !annotation?.releaseBadge
                        ? `<span class="rot-resource-spend-badge"
                        title="${esc(resourceLabel)}" aria-label="${esc(resourceLabel)}">${esc(resourceShortLabel)}</span>`
                        : ''
                    }
                    ${time && item.concurrentOffsetMs == null && item.interruptAfterMs == null && !annotation?.releaseBadge ? `<span class="rot-time">${time}</span>` : ''}
                    ${
                      item.concurrentOffsetMs != null
                        ? `<span class="rot-offset-badge rot-timed-action-badge"
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
                      annotation?.releaseBadge
                        ? `<span class="rot-gapfill-badge rot-charge-release-badge rot-timed-action-badge"
                        data-idx="${index}" title="${esc(annotation.releaseBadge.title)}">${esc(annotation.releaseBadge.label)}</span>`
                        : ''
                    }
                    ${
                      hasConfigurableDoubleEdgeOutcome(skill)
                        ? `<span class="rot-gapfill-badge rot-double-edge-badge rot-timed-action-badge"
                        data-idx="${index}" title="Risky recast: ${esc(doubleEdgeOutcomeLabel(doubleEdgeOutcome))}">${esc(doubleEdgeLabel)}</span>`
                        : ''
                    }
                    ${item.durationMs != null ? `<span class="rot-gapfill-badge rot-wait-badge" data-idx="${index}">⌛${item.durationMs}ms</span>` : ''}
                </div>`;
      rowItems.push(
        readOnly
          ? `<div class="rot-entry">${entryHtml}</div>`
          : rotationTimelineEntryHtml(index, app.rotationInsertionIndex ?? rotation.length, entryHtml)
      );
    });

    // Trailing markers (insertionIndex === rotation.length) belong after the last skill in the last row.
    if (rowNumber === rows.length - 1) {
      rowItems.push(
        ...transitionDelays.filter((marker) => marker.insertionIndex === rotation.length).map(renderTransitionDelay)
      );
      for (const marker of overlayProcMarkersByIndex.get(rotation.length) || []) {
        rowItems.push(renderOverlayProcMarker(marker));
      }

      if (!readOnly) {
        rowItems.push(rotationInsertionGapHtml(rotation.length, app.rotationInsertionIndex ?? rotation.length));
      }

      for (const marker of healthMarkersByIndex.get(rotation.length) || []) {
        rowItems.push(renderHealthMarker(marker));
      }

      for (const marker of professionMarkersByIndex.get(rotation.length) || []) {
        rowItems.push(renderProfessionMarker(marker));
      }
    }

    const skills = rowItems.join('');
    // Preserve state boundaries as separate lines without adding labels beside their skill icons.
    return `<div class="rot-row-line">
            <div class="rot-row-skills">${skills}</div>
        </div>`;
  });

  // Wrap adjacent lines for one weapon-set stay in a keyed row with its own duration and accessible label.
  let timelineLineIndex = 0;
  const timelineRows = timelineWeaponRowGroups(rows).map((group, groupNumber) => {
    const weapons = group.weaponSet === 1 ? build.weapons : build.alternateWeapons;
    const weaponLabel = weapons.filter(Boolean).join('/') || 'Unequipped';
    const totalDurationMs = weaponDurationTotals?.get(group.weaponSet);
    const groupTitle = `Weapon set ${group.weaponSet}: ${weaponLabel}${
      totalDurationMs == null ? '' : `\nTotal active time: ${formatTimelineTime(totalDurationMs, 0, 3)}`
    }`;
    // Consecutive kit/transform lines share one group, while each real swap advances to the next active stay.
    const activeSegment = weaponDurationSegments[groupNumber];
    const activeDurationMs = activeSegment?.weaponSet === group.weaponSet ? activeSegment.durationMs : undefined;
    const durationLabel = activeDurationMs == null ? '' : formatTimelineTime(activeDurationMs, 0, 3);
    const groupLines = timelineLines.slice(timelineLineIndex, timelineLineIndex + group.rows.length).join('');
    timelineLineIndex += group.rows.length;
    const firstCommand = group.rows[0]?.skills[0]?.entry;
    const groupKey = firstCommand
      ? `${group.weaponSet}:${timelineCommandKey(firstCommand)}`
      : `${group.weaponSet}:empty:${groupNumber}`;
    return {
      key: groupKey,
      html: `<div class="rot-row" role="group" aria-label="${esc(groupTitle)}" style="--row-color:#9d7bd0">
            <div class="rot-row-label" title="${esc(groupTitle)}">
              <span class="rot-row-label-content">
                <span class="rot-row-label-text">W${group.weaponSet}</span>
                ${durationLabel ? `<span class="rot-row-duration">${durationLabel}</span>` : ''}
              </span>
            </div>
            <div class="rot-row-lines">${groupLines}</div>
        </div>`
    };
  });

  // The separate proc panel groups consecutive activations and shares filter keys with timeline overlays.
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
        // Compact proc labels use hundredths; hover details retain millisecond precision.
        const time = formatTimelineTime(proc.start, combatReferenceMs, 2);
        const badgeLabel = procBadgeLabel(group.steps);
        const stackLabel = procStackLabel(group.steps.at(-1) || proc);
        const detail = procActivationDetail(proc, group.steps);
        return `<div class="proc-icon" data-proc-key="${esc(key)}"${procVisibility.has(key) ? '' : ' hidden'} title="${esc(detail)}"
                style="--proc-color:${procColors[proc.type] || '#9d7bd0'}">
                <img src="${esc(icon)}" alt="" />
                ${badgeLabel ? `<span class="proc-count">${esc(badgeLabel)}</span>` : ''}
                ${stackLabel ? `<span class="proc-stack">${esc(stackLabel)}</span>` : ''}
                <span class="proc-time">${time}</span>
            </div>`;
      })
      .join('');
    procHtml = `<details class="rotation-procs-wrap"${procPanelWasOpen ? ' open' : ''}>
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
  }

  return { rows: timelineRows, procHtml };
}
