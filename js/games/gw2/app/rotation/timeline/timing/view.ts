import { escapeHtml as esc } from '#gw2/app/presentation/shared/html.js';
import { formatTimelineTime, resultCombatReferenceMs } from '#gw2/app/rotation/result/model.js';
import { ACTION_ICONS, PLACEHOLDER_ICON } from '#gw2/app/rotation/shared/icons.js';
import { skillTimingAnalyses, stateTimingAnalysis } from '#gw2/app/rotation/timeline/timing/model.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import type { SimulationEvent, Skill, SkillId } from '#gw2/platform/engine/types.js';

const TIMING_DETAIL_INITIAL_USES = 12;

const timingCheckSelections = new WeakMap<ProfessionAppState, SkillId[]>();
const STATE_TIMING_CHECK_IDS = Object.freeze({
  photonForge: 'state:engineer.photon-forge',
  radiantForge: 'state:guardian.radiant-forge',
  shroud: 'state:necromancer.shroud',
  gunsaber: 'state:warrior.gunsaber'
} as const satisfies Record<string, SkillId>);

interface StateTimingCheckDefinition {
  readonly id: SkillId;
  readonly label: string;
  readonly availableFor: (skill: Skill) => boolean;
  readonly eventActive: (app: ProfessionAppState, event: SimulationEvent) => boolean | null;
}

function snapshotState(event: SimulationEvent): Readonly<Record<string, unknown>> | null {
  return event.state && typeof event.state === 'object' && !Array.isArray(event.state)
    ? (event.state as Readonly<Record<string, unknown>>)
    : null;
}

function eventMatchesSkill(app: ProfessionAppState, event: SimulationEvent, name: string): boolean {
  const skillId = app.skillByName.get(name)?.id;
  return skillId != null && (event.skillId === skillId || event.sourceId === skillId);
}

/** Defines transient duration checks from the authoritative profession transitions already emitted by simulation. */
const STATE_TIMING_CHECKS: readonly StateTimingCheckDefinition[] = Object.freeze([
  {
    id: STATE_TIMING_CHECK_IDS.photonForge,
    label: 'Time in Photon Forge',
    availableFor: (skill) =>
      ['Engage Photon Forge', 'Deactivate Photon Forge'].includes(skill.name) || skill.forgeSkill === true,
    eventActive: (_app, event) => {
      const state = event.type === 'engineer.state' ? snapshotState(event) : null;
      return typeof state?.photonForgeActive === 'boolean' ? state.photonForgeActive : null;
    }
  },
  {
    id: STATE_TIMING_CHECK_IDS.radiantForge,
    label: 'Time in Radiant Forge',
    availableFor: (skill) => ['Enter Radiant Forge', 'Exit Radiant Forge'].includes(skill.name),
    eventActive: (_app, event) =>
      event.type === 'guardian.radiant-forge-entered'
        ? true
        : event.type === 'guardian.radiant-forge-exited'
          ? false
          : null
  },
  {
    id: STATE_TIMING_CHECK_IDS.shroud,
    label: 'Time in Shroud',
    availableFor: (skill) => Boolean(skill.shroudEntry || skill.shroudExit),
    eventActive: (_app, event) => {
      const state = event.type === 'necromancer.state' ? snapshotState(event) : null;
      if (!state || !Object.hasOwn(state, 'activeShroud')) return null;
      const activeShroud = String(state.activeShroud || '');
      return Boolean(activeShroud && activeShroud !== 'lich');
    }
  },
  {
    id: STATE_TIMING_CHECK_IDS.gunsaber,
    label: 'Time in Gunsaber',
    availableFor: (skill) =>
      ['Unsheathe Gunsaber', 'Sheathe Gunsaber', 'Dragon Trigger'].includes(skill.name) || skill.gunsaberSkill === true,
    eventActive: (app, event) => {
      if (event.type !== 'sigil_swap' || event.source !== 'warrior') return null;
      if (eventMatchesSkill(app, event, 'Unsheathe Gunsaber') || eventMatchesSkill(app, event, 'Dragon Trigger')) {
        return true;
      }

      return eventMatchesSkill(app, event, 'Sheathe Gunsaber') ? false : null;
    }
  }
]);

function stateTimingCheck(skillId: SkillId): StateTimingCheckDefinition | undefined {
  return STATE_TIMING_CHECKS.find((definition) => definition.id === skillId);
}

function timingCheckIds(app: ProfessionAppState): SkillId[] {
  return timingCheckSelections.get(app) || [];
}

function timingSkillLabel(app: ProfessionAppState, skillId: SkillId): string {
  const stateCheck = stateTimingCheck(skillId);
  if (stateCheck) return stateCheck.label;
  const skill = app.skillById.get(skillId);
  return String(skill?.displayName || skill?.name || skillId);
}

function paletteSkillId(app: ProfessionAppState, value: string | undefined): SkillId | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && app.skillById.has(numeric)) return numeric;
  return app.skillById.has(value) ? value : null;
}

/** Uses the live palette plus authored casts so the picker follows the current build without losing prior flips. */
function timingCheckPickerSkills(app: ProfessionAppState): Skill[] {
  const ids = new Set<SkillId>();
  for (const entry of app.build.rotation) {
    if (entry.type === 'cast') ids.add(entry.skillId);
  }

  if (typeof document !== 'undefined') {
    for (const tile of document.querySelectorAll<HTMLElement>('#rotation-palette .pal-skill[data-skill-id]')) {
      const skillId = paletteSkillId(app, tile.dataset.skillId);
      if (skillId != null) ids.add(skillId);
    }
  }

  return [...ids]
    .map((skillId) => app.skillById.get(skillId))
    .filter((skill): skill is Skill => skill != null)
    .sort((left, right) =>
      String(left.displayName || left.name).localeCompare(String(right.displayName || right.name))
    );
}

interface TimingCheckPickerOption {
  readonly id: SkillId;
  readonly label: string;
  readonly icon: string;
  readonly category: string;
}

const WEAPON_BAR_TIMING_CATEGORIES = [1, 2, 3, 4, 5].map((slot) => `Weapon bar · Slot ${slot}`);
const TIMING_CHECK_CATEGORY_ORDER = [
  'State durations',
  ...WEAPON_BAR_TIMING_CATEGORIES,
  'Other weapon skills',
  'Profession skills',
  'Slot skills',
  'Actions'
];

function timingCheckWeaponCategory(skill: Skill): string {
  const match = String(skill.slot || '').match(/^(?:Weapon_)?([1-5])$/);
  return match ? `Weapon bar · Slot ${match[1]}` : 'Other weapon skills';
}

function timingCheckSkillCategory(skill: Skill): string {
  if (skill.name === 'Swap Weapons' || skill.type === 'Action') return 'Actions';
  if (skill.type === 'Weapon' || skill.weapon || /^Weapon_[1-5]$/.test(String(skill.slot || ''))) {
    return timingCheckWeaponCategory(skill);
  }

  const tile =
    typeof document === 'undefined'
      ? null
      : [...document.querySelectorAll<HTMLElement>('#rotation-palette .pal-skill[data-skill-id]')].find(
          (candidate) => candidate.dataset.skillId === String(skill.id)
        );
  if (tile?.closest('.action-palette-group')) return 'Actions';
  if (tile?.closest('.utility-palette-group')) return 'Slot skills';
  if (tile?.closest('.weapon-palette-section')) return timingCheckWeaponCategory(skill);
  if (tile?.closest('.profession-palette-section')) return 'Profession skills';
  if (['Heal', 'Utility', 'Elite'].includes(String(skill.type))) return 'Slot skills';
  return 'Profession skills';
}

function timingCheckPickerOptions(app: ProfessionAppState): TimingCheckPickerOption[] {
  const skills = timingCheckPickerSkills(app);
  const options = skills.map((skill) => ({
    id: skill.id,
    label: String(skill.displayName || skill.name),
    icon: skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON,
    category: timingCheckSkillCategory(skill)
  }));

  for (const definition of STATE_TIMING_CHECKS) {
    const representative = skills.find(definition.availableFor);
    if (!representative) continue;
    options.push({
      id: definition.id,
      label: definition.label,
      icon: representative.icon || ACTION_ICONS[representative.name] || PLACEHOLDER_ICON,
      category: 'State durations'
    });
  }

  return options.sort(
    (left, right) =>
      TIMING_CHECK_CATEGORY_ORDER.indexOf(left.category) - TIMING_CHECK_CATEGORY_ORDER.indexOf(right.category) ||
      left.label.localeCompare(right.label)
  );
}

/** Keeps timing choices in this inspection session without changing or persisting the build. */
function setTimingCheckIds(app: ProfessionAppState, checkIds: readonly SkillId[]): void {
  timingCheckSelections.set(app, [...new Set(checkIds)]);
  app.adapter.renderRotationBuilder(app);
}

function renderTimingChecks(app: ProfessionAppState): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('rotation-timing-checks');
  if (!root) return;
  const previousPicker = root.querySelector<HTMLDetailsElement>('.timing-check-picker');
  const pickerWasOpen = previousPicker?.open === true;
  const previousQuery = previousPicker?.querySelector<HTMLInputElement>('input[type="search"]')?.value || '';
  const selectedIds = timingCheckIds(app);
  const selectedKeys = new Set(selectedIds.map(String));
  const pickerOptions = timingCheckPickerOptions(app).filter((option) => !selectedKeys.has(String(option.id)));
  const pickerGroups = TIMING_CHECK_CATEGORY_ORDER.map((category) => ({
    category,
    options: pickerOptions.filter((option) => option.category === category)
  })).filter((group) => group.options.length);

  root.innerHTML = `<span class="timing-checks-label">Timing checks</span>
    <div class="timing-check-chips">
      ${selectedIds
        .map((skillId) => {
          const label = timingSkillLabel(app, skillId);
          return `<span class="timing-check-chip">${esc(label)}
            <button type="button" data-remove-timing-skill-id="${esc(String(skillId))}"
              aria-label="Remove ${esc(label)} timing check" title="Remove ${esc(label)}">&times;</button>
          </span>`;
        })
        .join('')}
      <details class="timing-check-picker"${pickerWasOpen ? ' open' : ''}>
        <summary>+ Add skill</summary>
        <div class="timing-check-picker-menu">
          <label class="sr-only" for="timing-check-search">Search skills</label>
          <input id="timing-check-search" type="search" value="${esc(previousQuery)}"
            placeholder="Search skills" autocomplete="off">
          <div class="timing-check-picker-options">
            ${
              pickerOptions.length
                ? pickerGroups
                    .map((group, groupIndex) => {
                      const labelId = `timing-check-group-${groupIndex}`;
                      return `<div class="timing-check-picker-group" role="group" aria-labelledby="${labelId}">
                        <div id="${labelId}" class="timing-check-picker-group-label">${esc(group.category)}</div>
                        ${group.options
                          .map(
                            (option) => `<button type="button" data-add-timing-skill-id="${esc(String(option.id))}"
                              data-search-text="${esc(option.label.toLowerCase())}">
                              <img src="${esc(option.icon)}" alt=""><span>${esc(option.label)}</span>
                            </button>`
                          )
                          .join('')}
                      </div>`;
                    })
                    .join('')
                : '<span class="timing-check-picker-empty">No more available skills</span>'
            }
            <span class="timing-check-search-empty" hidden>No matching skills</span>
          </div>
        </div>
      </details>
    </div>`;

  root.querySelectorAll<HTMLButtonElement>('[data-remove-timing-skill-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.removeTimingSkillId;
      setTimingCheckIds(
        app,
        selectedIds.filter((skillId) => String(skillId) !== key)
      );
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-add-timing-skill-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const option = pickerOptions.find((candidate) => String(candidate.id) === button.dataset.addTimingSkillId);
      if (!option) return;
      // Choosing a skill submits this compact picker; reopening it is an explicit request to add another.
      const picker = root.querySelector<HTMLDetailsElement>('.timing-check-picker');
      if (picker) picker.open = false;
      setTimingCheckIds(app, [...selectedIds, option.id]);
    });
  });

  const search = root.querySelector<HTMLInputElement>('input[type="search"]');
  const applySearch = (): void => {
    const query = search?.value.trim().toLowerCase() || '';
    let visible = 0;
    root.querySelectorAll<HTMLButtonElement>('[data-add-timing-skill-id]').forEach((button) => {
      button.hidden = !String(button.dataset.searchText || '').includes(query);
      if (!button.hidden) visible += 1;
    });
    root.querySelectorAll<HTMLElement>('.timing-check-picker-group').forEach((group) => {
      group.hidden = ![...group.querySelectorAll<HTMLButtonElement>('[data-add-timing-skill-id]')].some(
        (button) => !button.hidden
      );
    });
    const empty = root.querySelector<HTMLElement>('.timing-check-search-empty');
    if (empty) empty.hidden = !pickerOptions.length || visible > 0;
  };

  search?.addEventListener('input', applySearch);
  applySearch();
}

function timingIntervalLabel(intervalMs: number | null): string {
  return intervalMs == null ? '—' : formatTimelineTime(intervalMs, 0, 3);
}

function timingShowAllButton(hiddenCount: number, noun: string): string {
  return hiddenCount
    ? `<button type="button" class="timing-show-all">+ ${hiddenCount} more ${noun}${hiddenCount === 1 ? '' : 's'}</button>`
    : '';
}

function renderSkillTimingDetail(
  app: ProfessionAppState,
  skillId: SkillId,
  result: ProfessionAppResult | null,
  combatReferenceMs: number,
  open: boolean
): string {
  const analysis = skillTimingAnalyses([skillId], result?.steps || [])[0];
  const name = timingSkillLabel(app, skillId);
  const hiddenUses = Math.max(0, analysis.occurrences.length - TIMING_DETAIL_INITIAL_USES);
  const rows = analysis.occurrences.length
    ? analysis.occurrences
        .map(
          (occurrence, index) => `<tr${index >= TIMING_DETAIL_INITIAL_USES ? ' hidden' : ''}>
            <th scope="row">#${index + 1}</th>
            <td>${formatTimelineTime(occurrence.startMs, combatReferenceMs, 3)}</td>
            <td>${timingIntervalLabel(occurrence.intervalMs)}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="3" class="timing-details-empty">No completed uses</td></tr>';
  return `<details class="timing-skill-details" data-timing-skill-id="${esc(String(skillId))}"${open ? ' open' : ''}>
    <summary>
      <strong>${esc(name)}</strong>
      <span>${analysis.useCount} use${analysis.useCount === 1 ? '' : 's'}</span>
      <span>Avg ${timingIntervalLabel(analysis.averageIntervalMs)}</span>
      <span>Fastest ${timingIntervalLabel(analysis.fastestIntervalMs)}</span>
      <span>Slowest ${timingIntervalLabel(analysis.slowestIntervalMs)}</span>
    </summary>
    <div class="timing-skill-detail-body">
      <table>
        <thead><tr><th>Use</th><th>Start</th><th>Interval from previous ${esc(name)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${timingShowAllButton(hiddenUses, 'use')}
    </div>
  </details>`;
}

/** Converts state snapshots and transition events into one compact enter-to-exit duration table. */
function renderStateTimingDetail(
  app: ProfessionAppState,
  definition: StateTimingCheckDefinition,
  result: ProfessionAppResult | null,
  combatReferenceMs: number,
  open: boolean
): string {
  const transitions = (result?.events || []).flatMap((event) => {
    const active = definition.eventActive(app, event);
    return active == null || !Number.isFinite(Number(event.at)) ? [] : [{ atMs: Number(event.at) * 1000, active }];
  });
  const analysis = stateTimingAnalysis(transitions, Number(result?.duration || 0) * 1000);
  const hiddenStays = Math.max(0, analysis.occurrences.length - TIMING_DETAIL_INITIAL_USES);
  const rows = analysis.occurrences.length
    ? analysis.occurrences
        .map(
          (occurrence, index) => `<tr${index >= TIMING_DETAIL_INITIAL_USES ? ' hidden' : ''}>
            <th scope="row">#${index + 1}</th>
            <td>${formatTimelineTime(occurrence.startMs, combatReferenceMs, 3)}</td>
            <td${occurrence.endedAtTimelineEnd ? ' title="Timeline end"' : ''}>${formatTimelineTime(
              occurrence.endMs,
              combatReferenceMs,
              3
            )}</td>
            <td>${timingIntervalLabel(occurrence.durationMs)}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="timing-details-empty">No active stays</td></tr>';
  return `<details class="timing-skill-details" data-timing-skill-id="${esc(String(definition.id))}"${
    open ? ' open' : ''
  }>
    <summary>
      <strong>${esc(definition.label)}</strong>
      <span>${analysis.useCount} stay${analysis.useCount === 1 ? '' : 's'}</span>
      <span>Avg ${timingIntervalLabel(analysis.averageDurationMs)}</span>
      <span>Shortest ${timingIntervalLabel(analysis.shortestDurationMs)}</span>
      <span>Longest ${timingIntervalLabel(analysis.longestDurationMs)}</span>
    </summary>
    <div class="timing-skill-detail-body">
      <table>
        <thead><tr><th>Stay</th><th>Enter</th><th>Exit</th><th>Duration</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${timingShowAllButton(hiddenStays, 'stay')}
    </div>
  </details>`;
}

function renderTimingDetails(app: ProfessionAppState, result: ProfessionAppResult | null): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('rotation-timing-details');
  if (!root) return;
  const previousPanel = root.querySelector<HTMLDetailsElement>('.rotation-timing-details-wrap');
  const panelWasOpen = previousPanel?.open === true;
  const openCheckIds = new Set(
    [...root.querySelectorAll<HTMLDetailsElement>('.timing-skill-details[open]')].map(
      (details) => details.dataset.timingSkillId || ''
    )
  );
  const selectedIds = timingCheckIds(app);
  if (!selectedIds.length) {
    root.innerHTML = '';
    return;
  }

  const combatReferenceMs = resultCombatReferenceMs(result);
  root.innerHTML = `<details class="rotation-procs-wrap rotation-timing-details-wrap"${panelWasOpen ? ' open' : ''}>
    <summary>Timing Details (${selectedIds.length} check${selectedIds.length === 1 ? '' : 's'})</summary>
    <div class="timing-details-list">
      ${selectedIds
        .map((skillId) => {
          const definition = stateTimingCheck(skillId);
          const open = openCheckIds.has(String(skillId));
          return definition
            ? renderStateTimingDetail(app, definition, result, combatReferenceMs, open)
            : renderSkillTimingDetail(app, skillId, result, combatReferenceMs, open);
        })
        .join('')}
    </div>
  </details>`;

  root.querySelectorAll<HTMLButtonElement>('.timing-show-all').forEach((button) => {
    button.addEventListener('click', () => {
      button
        .closest('.timing-skill-detail-body')
        ?.querySelectorAll('tr[hidden]')
        .forEach((row) => {
          if (row instanceof HTMLElement) row.hidden = false;
        });
      button.remove();
    });
  });
}

/** Refreshes persistent timing controls and their result-backed independent skill summaries. */
export function renderTimingAnalysis(app: ProfessionAppState, result: ProfessionAppResult | null): void {
  renderTimingChecks(app);
  renderTimingDetails(app, result);
}
