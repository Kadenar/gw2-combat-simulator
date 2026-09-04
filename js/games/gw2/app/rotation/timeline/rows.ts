import { escapeHtml as esc } from '#gw2/app/presentation/shared/html.js';
import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { doubleEdgeOutcomeLabel, hasConfigurableDoubleEdgeOutcome } from '#gw2/app/rotation/editing/double-edge.js';
import { professionEndState } from '#gw2/app/rotation/shared/context.js';
import {
  ACTION_ICONS,
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  PLACEHOLDER_ICON,
  WAIT_ICON,
  resolveProcIcon
} from '#gw2/app/rotation/shared/icons.js';
import {
  automaticPhotonForgeExitTimelineMarkers,
  automaticTomeStowTimelineMarkers,
  continuumEndTimelineMarkers,
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  groupConsecutiveProcSteps,
  procBadgeLabel,
  procFilterKey,
  procFilterLabel,
  procStackLabel,
  relicProcExpirationTimelineMarkers,
  relicProcTimelineMarkers,
  rotationEntryName,
  rotationSkillHighlightKey,
  shatterResourceSpends,
  sigilProcTimelineMarkers,
  targetHealthTimelineMarkers,
  timelineDeadTimeMarkers,
  timelineItem,
  timelineSkillCastOrdinals,
  timelineStepsWithChargeFills,
  timelineWeaponLineExitMarkerRowIndex,
  timelineWeaponRowGroups,
  timelineWeaponRows,
  traitProcTimelineMarkers
} from '#gw2/app/rotation/timeline/model.js';
import {
  formatTimelineTime,
  resultCombatReferenceMs,
  weaponSetActiveSegments,
  weaponSetDurationTotals
} from '#gw2/app/rotation/timeline/timing/model.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';
import type { RotationCommand, SchedulerStep } from '#gw2/platform/engine/execution/types.js';
import { rotationInsertionGapHtml, rotationTimelineEntryHtml } from '#ui/rotation/insertion-cursor.js';

export interface TimelineRowRender {
  readonly key: string;
  readonly html: string;
}

const timelineCommandKeys = new WeakMap<object, number>();
let nextTimelineCommandKey = 1;

const UNLABELED_WEAPON_LINES = new Set(['Celestial Avatar', 'Elixir Gun', 'Flamethrower', 'Gunsaber']);

/** Hides redundant bar-replacement labels so their skill tiles keep the normal timeline alignment. */
export function timelineWeaponLineLabel(weaponLine: string | null | undefined): string {
  return !weaponLine || weaponLine.endsWith(' Kit') || UNLABELED_WEAPON_LINES.has(weaponLine) ? '' : weaponLine;
}

function timelineCommandKey(command: RotationCommand): number {
  const object = command as object;
  const existing = timelineCommandKeys.get(object);
  if (existing) return existing;
  const key = nextTimelineCommandKey++;
  timelineCommandKeys.set(object, key);
  return key;
}

/** Builds keyed timeline rows and proc markup without changing DOM nodes or rotation state. */
export function timelineRowsView(
  app: ProfessionAppState,
  build: Gw2ApplicationBuild,
  results: ProfessionAppResult | null,
  readOnly: boolean,
  procVisibility: ReadonlySet<string>,
  procPanelWasOpen: boolean
): { rows: TimelineRowRender[]; procHtml: string } {
  const rotation = build.rotation;
  let procHtml = '';
  const resultSteps = results?.steps || [];
  // Action details carry runtime-selected variants and other cast facts into the generic timeline tooltip.
  const actionDetails = new Map(
    (results?.events || [])
      .filter((event) => event.type === 'action' && event.activationId && event.detail)
      .map((event) => [String(event.activationId), String(event.detail)])
  );
  // ri < 0 marks injected/synthetic steps (e.g. auto-attacks) not tied to a rotation entry.
  const steps = new Map<number, SchedulerStep>(
    resultSteps.filter((step) => step.ri >= 0).map((step) => [step.ri, step])
  );
  const castOrdinals = timelineSkillCastOrdinals(resultSteps);
  const resourceSpends = shatterResourceSpends(results);
  const automaticPhotonForgeExits = automaticPhotonForgeExitTimelineMarkers(results, rotation.length);
  const automaticTomeStows = automaticTomeStowTimelineMarkers(results, rotation.length);
  // Automatic transformation exits act as weapon-row boundaries even though
  // no authored deactivation or stow command exists at that position.
  const automaticWeaponLineEndIndexes = new Set(
    [...automaticPhotonForgeExits, ...automaticTomeStows].map((marker) => marker.insertionIndex)
  );
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
  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false && Boolean(build.alternateWeapons?.[0]);
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet,
    startingWeaponLine,
    weaponSwapChangesSet: hasSecondWeaponSet,
    weaponLineEndIndexes: automaticWeaponLineEndIndexes,
    skillName: (entry) => resolveEntrySkill(app, entry)?.name || rotationEntryName(entry),
    weaponLineTransition: (entry, current) => {
      const item = timelineItem(entry);
      const skill = resolveEntrySkill(app, item.command);
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
    timelineEndMs: Number(results?.duration || 0) * 1000,
    hasSecondWeaponSet,
    weaponSwapSkillIds: new Set(app.skills.filter((skill) => skill.name === 'Swap Weapons').map((skill) => skill.id))
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
  const overlayProcMarkers = [
    ...(app.overlaySigilProcs ? sigilProcTimelineMarkers(results, rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcTimelineMarkers(results, rotation.length) : []),
    ...(app.overlayRelicProcs ? relicProcExpirationTimelineMarkers(results, rotation.length) : []),
    // Keep this requested trait proc opt-in without overlaying every simulated trait proc.
    ...(specialization === 'Luminary' && app.overlaySovereignOfLightProcs
      ? traitProcTimelineMarkers(results, rotation.length).filter((marker) => marker.skill === 'Sovereign of Light')
      : [])
  ].sort((left, right) => left.start - right.start);
  const overlayProcMarkersByIndex = new Map<number, typeof overlayProcMarkers>();
  for (const marker of overlayProcMarkers) {
    const markers = overlayProcMarkersByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    overlayProcMarkersByIndex.set(marker.insertionIndex, markers);
  }

  const continuumEnds = continuumEndTimelineMarkers(results, rotation.length);
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
      specialization,
      build,
      professionState: professionEndState(results)
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

  const renderContinuumEnd = (marker: (typeof continuumEnds)[number]): string => {
    const time = formatTime(marker.start);
    const detail = [
      'Continuum Shift',
      `Continuum Split ended automatically at ${time}`,
      'Cooldown state restored'
    ].join('\n');
    return `<div class="rot-skill rot-injected rot-automatic-transition" title="${esc(detail)}"
            style="--att-border:#d6b46b">
            <img src="${esc(ACTION_ICONS['Continuum Shift'])}" alt="" />
            <span class="rot-injected-badge">AUTO</span>
            <span class="rot-time">${time}</span>
        </div>`;
  };

  const renderAutomaticPhotonForgeExit = (marker: (typeof automaticPhotonForgeExits)[number]): string => {
    const time = formatTime(marker.start);
    const detail = ['Overheat', `Photon Forge ended automatically at ${time}`, 'Tool-belt cooldowns applied'].join(
      '\n'
    );
    const icon =
      app.activeCatalog.skillsByName.get('Deactivate Photon Forge')?.icon ||
      ACTION_ICONS['Deactivate Photon Forge'] ||
      PLACEHOLDER_ICON;
    return `<div class="rot-skill rot-injected rot-automatic-transition" title="${esc(detail)}"
            style="--att-border:#e5a72d">
            <img src="${esc(icon)}" alt="" />
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

  const renderOverlayProcMarker = (marker: (typeof overlayProcMarkers)[number]): string => {
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
    return `<div class="rot-entry rot-proc-entry" data-proc-key="${esc(key)}"${procVisibility.has(key) ? '' : ' hidden'}>
        <div class="rot-skill rot-injected rot-proc-overlay ${className}${expired ? ' rot-relic-expired' : ''}" data-proc-key="${esc(key)}" data-skill-highlight-key="${esc(key)}"
            title="${esc(detail)}" style="--att-border:${color};--proc-color:${color}">
            <img src="${esc(icon)}" alt="" />
            ${expired ? '<span class="proc-expired-cross" aria-hidden="true"></span>' : ''}
            ${badgeLabel ? `<span class="proc-count">${esc(badgeLabel)}</span>` : ''}
            <span class="rot-injected-badge">${type.toUpperCase()}</span>
            <span class="rot-time">${time}</span>
        </div>
        </div>`;
  };

  const timelineLines = rows.map((row, rowNumber) => {
    const rowItems: string[] = [];
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
          rotation,
          build,
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
      const actionDetail = step?.activationId ? actionDetails.get(step.activationId) : undefined;
      const skillTooltip =
        step && !invalid && item.type === 'cast'
          ? formatTimelineSkillTooltip(display, step, castOrdinals.get(index), formatTime, [
              ...(actionDetail ? [actionDetail] : []),
              ...chargeOutcomeDetails
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
      const chargeReleaseLabel = skill?.dragonSlash
        ? `⚡${item.releaseAtCharges == null ? 'Max' : Number(item.releaseAtCharges)}${time ? `\n${time}` : ''}`
        : '';
      const doubleEdgeOutcome = item.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success';
      const doubleEdgeLabel = doubleEdgeOutcome === 'backfire' ? 'DE!' : 'DE✓';
      // Casts and Combat Start share behavior editing; waits expose their duration through the same pencil affordance.
      const canEditActivation = (item.type === 'cast' && skill != null) || item.type === 'combat-start';
      const canEditWait = item.type === 'wait';
      // Dead time belongs to this boundary, after its insertion cursor and before the next authored skill.
      const deadTimeHtml = (deadTimesByIndex.get(index) || []).map(renderDeadTime).join('');
      const entryHtml = `${deadTimeHtml}<div class="rot-skill${item.concurrentOffsetMs != null ? ' rot-concurrent' : ''}${invalid ? ' rot-invalid' : ''}${chargeMismatch ? ' rot-charge-mismatch' : ''}"${readOnly ? '' : ' draggable="true"'}
                    data-idx="${index}" data-skill-highlight-key="${esc(highlightKey)}" title="${esc(skillTooltip)}${titleSuffix}${resourceTitle}" style="--att-border:#9d7bd0">
                    <img src="${esc(icon)}" alt="" />
                    ${skill?.variantBadge ? `<span class="skill-variant-badge rot-variant-badge">${esc(skill.variantBadge)}</span>` : ''}
                    ${
                      !readOnly && canEditActivation
                        ? `<button type="button" class="rot-edit-activation" data-idx="${index}"
                        title="Edit cast behavior" aria-label="Edit ${esc(display)} cast behavior" aria-haspopup="dialog">&#9998;</button>`
                        : !readOnly && canEditWait
                          ? `<button type="button" class="rot-edit-wait" data-idx="${index}"
                        title="Edit wait duration" aria-label="Edit Wait duration" aria-haspopup="dialog">&#9998;</button>`
                          : ''
                    }
                    ${readOnly ? '' : '<span class="rot-x" title="Remove (Shift: remove this and everything after)">×</span>'}
                    ${invalid ? '<span class="rot-invalid-badge" title="Invalid — not simulated">✕</span>' : ''}
                    ${
                      // Dragon Slash's release badge already shows its charges and timestamp without covering the pencil.
                      resourceSpend && !skill?.dragonSlash
                        ? `<span class="rot-resource-spend-badge"
                        title="${esc(resourceLabel)}" aria-label="${esc(resourceLabel)}">${esc(resourceShortLabel)}</span>`
                        : ''
                    }
                    ${time && item.concurrentOffsetMs == null && item.interruptAfterMs == null && !skill?.dragonSlash ? `<span class="rot-time">${time}</span>` : ''}
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
                </div>`;
      rowItems.push(
        readOnly
          ? `<div class="rot-entry">${entryHtml}</div>`
          : rotationTimelineEntryHtml(index, app.rotationInsertionIndex ?? rotation.length, entryHtml)
      );
    });
    for (const marker of automaticPhotonForgeExitsByRow.get(rowNumber) || []) {
      rowItems.push(renderAutomaticPhotonForgeExit(marker));
    }

    // Trailing markers (insertionIndex === rotation.length) belong after the last skill in the last row.
    if (rowNumber === rows.length - 1) {
      for (const marker of overlayProcMarkersByIndex.get(rotation.length) || []) {
        rowItems.push(renderOverlayProcMarker(marker));
      }

      if (!readOnly) {
        rowItems.push(rotationInsertionGapHtml(rotation.length, app.rotationInsertionIndex ?? rotation.length));
      }

      for (const marker of healthMarkersByIndex.get(rotation.length) || []) {
        rowItems.push(renderHealthMarker(marker));
      }

      for (const marker of continuumEndsByIndex.get(rotation.length) || []) {
        rowItems.push(renderContinuumEnd(marker));
      }

      for (const marker of automaticPhotonForgeExitsByIndex.get(rotation.length) || []) {
        if (automaticPhotonForgeExitRowMarkers.has(marker)) continue;
        rowItems.push(renderAutomaticPhotonForgeExit(marker));
      }

      for (const marker of automaticTomeStowsByIndex.get(rotation.length) || []) {
        rowItems.push(renderAutomaticTomeStow(marker));
      }
    }

    const skills = rowItems.join('');
    const finalSkill = row.skills.at(-1);
    const insertAt = finalSkill ? finalSkill.index + 1 : 0;
    const lineLabel = timelineWeaponLineLabel(row.weaponLine);
    const lineTitle = row.weaponLine ? `${row.weaponLine} weapon line` : '';
    return `<div class="rot-row-line">
            ${lineLabel ? `<div class="rot-row-line-label" title="${esc(lineTitle)}">${esc(lineLabel)}</div>` : ''}
            <div class="rot-row-skills" data-insert-idx="${insertAt}">${skills}</div>
        </div>`;
  });

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
