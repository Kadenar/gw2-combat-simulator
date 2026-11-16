/** Workspace timing controls persist preferences and refresh dependent simulations. */
import { bindHelpPopover, HELP_ICON_HTML } from '#gw2/app/build/panels/help-popover.js';
import { applyConditionTickOffset, applyTransitionDelays } from '#gw2/app/build/state/workspace.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import {
  CONDITION_TICK_OFFSET_MAX_MS,
  CONDITION_TICK_OFFSET_STEP_MS,
  normalizeConditionTickOffsetMs
} from '#gw2/platform/combat/condition-clock.js';
import { TRANSITION_DELAY_KEYS, type TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

/** Timing edits affect the active workspace and invalidate only its dependent build tabs. */
export function mountSimulationSettings(app: ProfessionAppState, root: Document = document): void {
  const container = root.getElementById('simulation-options');

  if (!container) return;

  container.querySelector('#simulation-condition-clock')?.remove();
  const clockSection = root.createElement('details');
  clockSection.id = 'simulation-condition-clock';
  clockSection.className = 'perma-group';
  clockSection.open = true;
  const clockSummary = root.createElement('summary');
  clockSummary.className = 'perma-group-label';
  clockSummary.textContent = 'Condition ticks';
  const clockControls = root.createElement('div');
  clockControls.className = 'perma-group-content';
  const clockRow = root.createElement('div');
  clockRow.className = 'boon-control condition-clock-control';
  const label = root.createElement('label');
  label.htmlFor = 'simulation-conditionTickOffsetMs';
  label.textContent = 'Tick offset (ms)';
  const offset = root.createElement('input');
  offset.id = 'simulation-conditionTickOffsetMs';
  offset.type = 'number';
  offset.min = '0';
  offset.max = String(CONDITION_TICK_OFFSET_MAX_MS);
  offset.step = String(CONDITION_TICK_OFFSET_STEP_MS);
  offset.value = String(normalizeConditionTickOffsetMs(app.workspace!.simulationSettings.conditionTickOffsetMs));
  offset.title = 'Moves condition ticks earlier within each second. Applies within this workspace.';
  offset.addEventListener('change', () => {
    const changed = applyConditionTickOffset(app, Number(offset.value));
    offset.value = String(normalizeConditionTickOffsetMs(app.workspace!.simulationSettings.conditionTickOffsetMs));

    if (changed) app.changed();
  });
  const picker = root.createElement('div');
  picker.className = 'condition-clock-picker';
  const help = root.createElement('details');
  help.id = 'condition-clock-details';
  help.innerHTML = `<summary aria-label="About condition tick offset">${HELP_ICON_HTML}</summary>
  <div class="condition-clock-description">
    <p>Moves the shared condition damage tick earlier within each one-second cycle. Player, summon, and permanent target conditions use the same clock.</p>
    <p>For a strike opener, 0 ms pays at 1000, 2000, 3000 ms after first damage. An offset of 320 ms pays at 680, 1680, 2680 ms.</p>
    <p>When a condition tick is the first damage, the clock counts from rotation start. The offset then moves that first tick, and DPS start moves with it.</p>
    <p>Application times and condition durations stay unchanged. Each tick pays the accumulated damage, including partial durations. Moving a tick across the end of a fight can change the reported DPS.</p>
    <p>Choose 0 to ${CONDITION_TICK_OFFSET_MAX_MS} ms in ${CONDITION_TICK_OFFSET_STEP_MS} ms steps.</p>
  </div>`;
  // The explanation opens and closes like the critical damage help.
  bindHelpPopover(help);

  picker.append(offset, help);
  clockRow.append(label, picker);
  clockControls.append(clockRow);
  clockSection.append(clockSummary, clockControls);
  container.append(clockSection);

  container.querySelector('#simulation-transition-delays')?.remove();
  const section = root.createElement('details');
  section.id = 'simulation-transition-delays';
  section.className = 'perma-group';
  section.open = true;
  const summary = root.createElement('summary');
  summary.className = 'perma-group-label';
  summary.textContent = 'Transition delays';
  const controls = root.createElement('div');
  controls.className = 'perma-group-content';
  const settings = app.workspace!.simulationSettings;
  const update = (delays: TransitionDelays): void => {
    // Manual edits and accepted imports share persistence and cache invalidation.
    if (applyTransitionDelays(app, delays)) app.changed();
  };

  // Pair entry and exit delays so each transition can be compared and edited on one row.
  const table = root.createElement('table');
  table.className = 'transition-delay-table';
  table.innerHTML = `<caption>All delays in ms</caption>
    <thead><tr><th scope="col">Transition</th><th scope="col">Entry</th><th scope="col">Exit</th></tr></thead>`;
  const body = table.createTBody();
  for (const [name, entry, exit] of [
    ['Weapon swap / Gunsaber', 'weaponSwapMs', null],
    ['Radiant / Photon Forge', 'forgeEntryMs', 'forgeExitMs'],
    ['Thief / Necromancer Shroud', 'shroudEntryMs', 'shroudExitMs']
  ] as const) {
    const row = body.insertRow();
    const heading = root.createElement('th');
    heading.scope = 'row';
    heading.textContent = name;
    row.append(heading);
    for (const [key, direction] of [
      [entry, 'entry'],
      [exit, 'exit']
    ] as const) {
      const cell = row.insertCell();

      if (!key) {
        cell.textContent = '-';
        continue;
      }

      const input = root.createElement('input');
      input.id = `simulation-${key}`;
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(settings.transitionDelays[key]);
      input.setAttribute('aria-label', `${name}${key === 'weaponSwapMs' ? '' : ` ${direction}`} (ms)`);
      input.title =
        'Additional input delay after the transition. Overlaps existing cast recovery. Applies within this workspace.';
      input.addEventListener('change', () => {
        update({ ...settings.transitionDelays, [key]: Number(input.value) });
        input.value = String(settings.transitionDelays[key]);
      });
      cell.append(input);
    }
  }

  controls.append(table);

  // Bulk actions persist all five delays together and rerun the simulation once.
  const actions = root.createElement('div');
  actions.className = 'transition-delay-actions';
  for (const [label, delay] of [
    ['Apply 100 ms to all', 100],
    ['Clear all', 0]
  ] as const) {
    const button = root.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = label;
    button.addEventListener('click', () => {
      const delays = { ...settings.transitionDelays };
      for (const key of TRANSITION_DELAY_KEYS) delays[key] = delay;
      update(delays);
    });
    actions.append(button);
  }

  controls.append(actions);

  section.append(summary, controls);
  container.append(section);
}
