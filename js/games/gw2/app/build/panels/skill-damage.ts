import { normalizeAttributePreview } from '#gw2/app/build/attribute-effects.js';
import { calculateSkillDamageAttributes } from '#gw2/app/build/buffed-attributes.js';
import {
  clearedValues,
  createSkillDamagePlan,
  simulationConfigValues,
  skillDamageControls,
  type SkillDamagePlan
} from '#gw2/app/build/skill-damage/plan.js';
import {
  conditionLabel,
  conditionPerSecond,
  contributionBuckets,
  createSkillDamageViewModel,
  type SkillDamageFilter,
  type SkillDamageRowView,
  type SkillDamageViewModel
} from '#gw2/app/build/skill-damage/view-model.js';
import type { SkillDamageRunner } from '#gw2/app/simulation/skill-damage/runner.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import type {
  AttributePreviewValues,
  PreviewControl
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillDamageEvaluation } from '#gw2/platform/skill-damage/types.js';
import { escapeHtml as esc } from '#ui/shared/html.js';

/** Preview values stay local to this panel; only its disclosure preference survives a page reload. */
interface SkillDamagePanelState {
  open: boolean;
  values: AttributePreviewValues | null;
  filter: SkillDamageFilter;
  expanded: string | null;
  closedGroups: Set<string>;
  plan: SkillDamagePlan | null;
  evaluation: {
    readonly signature: string;
    readonly result: SkillDamageEvaluation;
    readonly plan: SkillDamagePlan;
  } | null;
  error: string;
  failedSignature: string | null;
  readonly runner: SkillDamageRunner;
}

const panels = new WeakMap<ProfessionAppState, SkillDamagePanelState>();
const DISCLOSURE_STORAGE_KEY = 'gw2-skill-damage-open';
const CONTROL_GROUPS = Object.freeze([
  'Boons',
  'Target conditions',
  'Attunement',
  'Trait conditionals',
  'Mechanic',
  'Other buffs'
]);

function panelState(app: ProfessionAppState): SkillDamagePanelState {
  let state = panels.get(app);
  if (!state) {
    let open = false;
    try {
      open = localStorage.getItem(DISCLOSURE_STORAGE_KEY) === 'true';
    } catch {
      // A blocked browser preference store must not prevent opening the preview.
    }

    state = {
      open,
      values: null,
      filter: 'all',
      expanded: null,
      closedGroups: new Set(),
      plan: null,
      evaluation: null,
      error: '',
      failedSignature: null,
      runner: app.skillDamageRunner
    };
    panels.set(app, state);
  }

  return state;
}

/** Applies a worker result without rebuilding the assumption controls or losing the focused input. */
export function receiveSkillDamage(
  app: ProfessionAppState,
  signature: string,
  result: SkillDamageEvaluation | null,
  error: string
): void {
  const current = panels.get(app);
  if (!current) return;
  current.error = error;
  current.failedSignature = error ? signature : null;
  if (result && current.plan?.signature === signature) current.evaluation = { signature, result, plan: current.plan };
  renderRegions(app);
}

/** Renders the collapsible section; measurement starts only once it is opened, and only for changed inputs. */
export function renderSkillDamage(app: ProfessionAppState): void {
  const host = document.getElementById('skill-damage-preview');
  if (!host || !app.attributeData) return;
  const state = panelState(app);
  bindHost(host, app);
  if (!state.open) {
    state.runner.cancel();
    host.innerHTML = disclosureHtml(false, '');
    return;
  }

  const controls = skillDamageControls(app);
  // First open adopts the saved assumptions; later builds keep the user's choices for controls that still exist.
  state.values = normalizeAttributePreview(controls, state.values ?? simulationConfigValues(app, controls));
  host.innerHTML = disclosureHtml(
    true,
    `<div class="skill-damage-body"><div class="skill-damage-stats" data-sd-region="stats"></div><div class="skill-damage-layout">${assumptionsHtml(app, controls, state.values)}<div class="skill-damage-main" data-sd-region="table"></div></div></div>`
  );
  renderRegions(app);
}

/** Recomputes the plan from current values and repaints stats and rows, leaving the controls (and focus) intact. */
function renderRegions(app: ProfessionAppState): void {
  const host = document.getElementById('skill-damage-preview');
  const state = panels.get(app);
  if (!host || !state?.open || !state.values) return;
  const stats = host.querySelector<HTMLElement>('[data-sd-region="stats"]');
  const table = host.querySelector<HTMLElement>('[data-sd-region="table"]');
  if (!stats || !table) return;
  const controls = skillDamageControls(app);
  try {
    state.plan = createSkillDamagePlan(app, controls, state.values);
  } catch (error) {
    state.runner.cancel();
    state.plan = null;
    state.error = error instanceof Error ? error.message : String(error);
  }

  stats.innerHTML = statsHtml(app, state.values);
  if (!state.plan) {
    table.innerHTML = `<p class="skill-damage-empty">${esc(state.error || 'Skill damage could not be prepared.')}</p>`;
    return;
  }

  const current = state.evaluation?.signature === state.plan.signature;
  // A failed request stays visible until inputs change; rendering its error must not submit it again.
  if (!current && state.failedSignature !== state.plan.signature) {
    state.error = '';
    state.runner.schedule(state.plan);
  }

  // Keep labels and measurements from the same completed plan while a changed build is being measured.
  const displayedPlan = state.evaluation?.plan ?? state.plan;
  const model = createSkillDamageViewModel(displayedPlan, state.evaluation?.result ?? null, {
    filter: state.filter,
    expanded: state.expanded,
    closedGroups: state.closedGroups,
    targetArmor: Number(displayedPlan.request.config.target?.armor) || 0
  });
  // Expanding a row or receiving new measurements must not jump the independently scrolled list back to its top.
  const scroller = table.querySelector('.sd-table-scroll');
  const position = { top: scroller?.scrollTop ?? 0, left: scroller?.scrollLeft ?? 0 };
  table.innerHTML = tableHtml(model, state, current);
  table.querySelector('.sd-table-scroll')?.scrollTo(position);
}

/** The section starts collapsed; its body is only built while open. */
function disclosureHtml(open: boolean, body: string): string {
  return `<details class="skill-damage"${open ? ' open' : ''}><summary class="skill-damage-title">Skill damage <small>Preview only</small></summary><p class="sd-note">Damage if this skill or effect occurs under the selected conditions.</p>${body}</details>`;
}

/** Delegated listeners are installed once per host, so repaints never stack handlers. */
function bindHost(host: HTMLElement, app: ProfessionAppState): void {
  if (host.dataset.sdBound === 'true') return;
  host.dataset.sdBound = 'true';
  const state = panelState(app);
  host.addEventListener(
    'toggle',
    (event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.classList.contains('skill-damage')) return;
      if (state.open === details.open) return;
      state.open = details.open;
      try {
        localStorage.setItem(DISCLOSURE_STORAGE_KEY, String(state.open));
      } catch {
        // Keep the current page's choice even when persistence is unavailable.
      }

      renderSkillDamage(app);
    },
    true
  );
  host.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-sd-group], [data-sd-row], [data-sd-filter], [data-sd-action]'
    );
    if (!target) return;
    if (target.dataset.sdGroup) {
      const id = target.dataset.sdGroup;
      if (state.closedGroups.has(id)) state.closedGroups.delete(id);
      else state.closedGroups.add(id);
    } else if (target.dataset.sdRow) {
      state.expanded = state.expanded === target.dataset.sdRow ? null : target.dataset.sdRow;
    } else if (target.dataset.sdFilter) {
      state.filter = target.dataset.sdFilter as SkillDamageFilter;
    } else if (target.dataset.sdAction) {
      const controls = skillDamageControls(app);
      state.values =
        target.dataset.sdAction === 'use-config' ? simulationConfigValues(app, controls) : clearedValues(controls);
      renderSkillDamage(app);
      return;
    }

    renderRegions(app);
  });
  // The input event already applied a value; repainting again on blur's change event would replace the table under
  // a pending click, so only a real change repaints.
  const readControls = (): void => {
    const controls = skillDamageControls(app);
    const input = Object.fromEntries(
      Array.from(
        host.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-skill-damage-control]'),
        (control) => [
          control.dataset.skillDamageControl!,
          control instanceof HTMLInputElement && control.type === 'checkbox' ? Number(control.checked) : control.value
        ]
      )
    );
    const values = normalizeAttributePreview(controls, input);
    if (JSON.stringify(values) === JSON.stringify(state.values)) return;
    state.values = values;
    renderRegions(app);
  };

  host.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).matches('[data-skill-damage-control]')) readControls();
  });
  host.addEventListener('change', (event) => {
    const control = event.target as HTMLInputElement;
    if (!control.matches('[data-skill-damage-control]')) return;
    readControls();
    // Write the clamped value back so the field never shows a number the preview did not use.
    if (control.type === 'number') control.value = String(state.values?.[control.dataset.skillDamageControl!] ?? '');
  });
  // The ladder readout follows pointer and keyboard focus; exact values are always printed beneath the bars.
  const showVariant = (event: Event): void => {
    const bar = (event.target as HTMLElement).closest<HTMLElement>('[data-sd-variant]');
    const readout = bar?.closest('.sd-ladder')?.querySelector<HTMLElement>('.sd-ladder-readout');
    if (bar && readout) readout.textContent = bar.dataset.sdVariant || '';
  };

  host.addEventListener('mouseover', showVariant);
  host.addEventListener('focusin', showVariant);
}

const integer = (value: number): string => Math.round(value).toLocaleString('en-US');
const percent = (fraction: number, digits = 1): string => `${(fraction * 100).toFixed(digits)}%`;
const factor = (value: number): string => `×${value.toFixed(3)}`;
const signedPercent = (fraction: number): string => `${fraction >= 0 ? '+' : ''}${(fraction * 100).toFixed(1)}%`;

/** Stats with this panel's values; a changed value names its no-preview baseline, as the Attribute Preview does. */
function statsHtml(app: ProfessionAppState, values: AttributePreviewValues): string {
  const controls = skillDamageControls(app);
  const current = calculateSkillDamageAttributes(app, values, controls).attributes;
  const baseline = calculateSkillDamageAttributes(app, clearedValues(controls), controls).attributes;
  const stat = (label: string, name: string, format: (value: number) => string): string => {
    const value = current[name]?.final ?? 0;
    const previous = baseline[name]?.final ?? 0;
    const changed = format(value) !== format(previous);
    return `<div class="sd-stat"><span class="sd-stat-label">${label}</span><span class="sd-stat-value">${format(value)}</span><span class="sd-stat-note${changed ? ' is-changed' : ''}">${changed ? `from ${format(previous)}` : 'no preview change'}</span></div>`;
  };

  const percentStat = (value: number): string => `${value.toFixed(1)}%`;
  return [
    stat('Power', 'Power', integer),
    stat('Critical chance', 'Critical Chance', percentStat),
    stat('Critical damage', 'Critical Damage', percentStat),
    stat('Condition damage', 'Condition Damage', integer),
    stat('Condition duration', 'Condition Duration', percentStat),
    ...['Burning', 'Bleeding', 'Torment', 'Confusion', 'Poison']
      .filter((name) => current[`${name} Duration`]?.final !== current['Condition Duration']?.final)
      .map((name) => stat(`${name} duration`, `${name} Duration`, percentStat)),
    stat('Strike multiplier', 'Strike Multiplier', factor),
    stat('Condition multiplier', 'Condition Multiplier', factor),
    stat('Target armor', 'Target Armor', integer)
  ].join('');
}

function controlHtml(control: PreviewControl, value: number | string | undefined): string {
  const attrs = `data-skill-damage-control="${esc(control.key)}" aria-label="${esc(control.label)}"`;
  const input = control.options
    ? `<select ${attrs}>${control.options.map((option) => `<option value="${esc(option)}"${option === value ? ' selected' : ''}>${esc(control.optionLabels?.[option] ?? option)}</option>`).join('')}</select>`
    : control.max != null
      ? `<input ${attrs} type="number" min="${control.min ?? 0}" max="${control.max}" step="1" value="${esc(String(value ?? 0))}">`
      : `<input ${attrs} type="checkbox"${value ? ' checked' : ''}>`;
  return `<label class="sd-control"><span>${esc(control.label)}</span>${input}<small>${esc(control.description)}</small></label>`;
}

/** Preview inputs grouped as in the Attribute Preview, then the equipment that is always included. */
function assumptionsHtml(
  app: ProfessionAppState,
  controls: readonly PreviewControl[],
  values: AttributePreviewValues
): string {
  const groups = [...CONTROL_GROUPS, ...new Set(controls.map((control) => control.group))].filter(
    (group, index, all) => all.indexOf(group) === index
  );
  const fieldsets = groups
    .map((group) => {
      const members = controls.filter((control) => control.group === group);
      return members.length
        ? `<fieldset><legend>${esc(group === 'Target conditions' ? 'Target' : group)}</legend>${members.map((control) => controlHtml(control, values[control.key])).join('')}</fieldset>`
        : '';
    })
    .join('');
  const build = app.build;
  const fixed = [...new Set((build.weaponSigils || []).flat().filter(Boolean)).values()].map(
    (name) => `Sigil of ${name}`
  );
  if (build.rune) fixed.push(`Rune of ${build.rune}`);
  if (build.relic) fixed.push(`Relic of ${build.relic}`);
  if (build.food) fixed.push(build.food);
  if (build.utility) fixed.push(build.utility);
  fixed.push(
    ...calculateSkillDamageAttributes(app, values, controls).alwaysApplied.filter((name) => !fixed.includes(name))
  );
  return `<aside class="skill-damage-assumptions" aria-label="Damage assumptions"><h4>Assumptions</h4>${fieldsets}${
    fixed.length
      ? `<fieldset><legend>Always applied</legend><ul class="sd-fixed">${fixed.map((name) => `<li>${esc(name)}</li>`).join('')}</ul></fieldset>`
      : ''
  }<div class="sd-actions"><button type="button" class="btn sd-action-primary" data-sd-action="use-config">Use simulation config</button><button type="button" class="btn" data-sd-action="clear">Clear buffs</button></div></aside>`;
}

function columnTemplate(model: SkillDamageViewModel): string {
  return [
    'minmax(220px, 1fr)',
    '64px',
    ...(model.showStrikeColumns ? ['44px', '56px'] : []),
    ...(model.showAppliedColumn ? ['minmax(170px, 1fr)'] : []),
    '84px',
    '88px',
    '96px',
    '84px'
  ].join(' ');
}

function tableHtml(model: SkillDamageViewModel, state: SkillDamagePanelState, current: boolean): string {
  const filters = (['all', 'equipped', 'unslotted', 'procs'] as const)
    .map((filter) => {
      const label = { all: 'All', equipped: 'Equipped', unslotted: 'Not slotted', procs: 'Procs' }[filter];
      return `<button type="button" class="sd-chip" data-sd-filter="${filter}" aria-pressed="${state.filter === filter}">${label} <span>${model.counts[filter]}</span></button>`;
    })
    .join('');
  const columns = columnTemplate(model);
  const header = [
    '<span>Skill</span>',
    '<span class="sd-num">Cast</span>',
    ...(model.showStrikeColumns ? ['<span class="sd-num">Hits</span>', '<span class="sd-num">Coef.</span>'] : []),
    ...(model.showAppliedColumn ? ['<span>Conditions applied</span>'] : []),
    '<span class="sd-num">Strike</span>',
    '<span class="sd-num">Conditions</span>',
    '<span class="sd-num">Total (avg)</span>',
    '<span class="sd-num">Per cast s</span>'
  ].join('');
  // The first measurement has nothing to show yet; later ones keep the previous table, dimmed, beside a spinner.
  if (!state.evaluation && !state.error) return loadingHtml();
  const status = state.error
    ? `<p class="sd-status is-error">${esc(state.error)}</p>`
    : !current
      ? '<p class="sd-status" role="status"><span class="sd-spinner" aria-hidden="true"></span>Updating</p>'
      : '';
  const groups = model.groups
    .map(
      (group) =>
        `<div class="sd-group"><button type="button" class="sd-group-title" data-sd-group="${esc(group.id)}" aria-expanded="${group.open}">${esc(group.title)}</button>${
          group.open ? group.rows.map((row) => rowHtml(row, model, columns)).join('') : ''
        }</div>`
    )
    .join('');
  // Keep unavailable effects inspectable in a quiet disclosure, with each reason beneath its source.
  const unavailable = model.unavailable.length
    ? `<details class="sd-unavailable"><summary><span>Calculation details</span><span class="sd-unavailable-count">${model.unavailable.length}</span></summary><ul class="sd-unavailable-list" role="list">${model.unavailable.map((row) => `<li><strong>${esc(row.name)}</strong><p>${esc(row.reason)}</p></li>`).join('')}</ul></details>`
    : '';
  return `<div class="sd-toolbar"><div role="group" aria-label="Show" class="sd-filters">${filters}</div>${status}</div><div class="sd-table-scroll" tabindex="0" role="region" aria-label="Skill damage results"><div class="sd-table${current ? '' : ' is-stale'}" style="--sd-columns: ${columns}"><div class="sd-header">${header}</div>${groups || '<p class="skill-damage-empty">No damaging skills match this filter.</p>'}</div></div>${unavailable}`;
}

// Decorative skill glyphs scan in sequence without implying measured damage or actual progress.
const LOADING_SKILL_GLYPHS = Object.freeze([
  '<path d="m5 19 3-3m-3-3 6 6M8 16 19 5l-2 7-6 6M6 14l4 4"/>',
  '<path d="M7 20 4 14l3-7 3 4 3-8 2 9 4-5 1 8-4 5Z" fill="currentColor" stroke="none"/>',
  '<path d="m12 3 8 3-1 9-7 6-7-6-1-9Z"/>',
  '<path d="m14 2-10 12h7l-1 8L21 9h-8Z" fill="currentColor" stroke="none"/>',
  '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>'
]);
const LOADING_GOLEM_URL = new URL('@images/skill-damage-golem.png', import.meta.url).href;

/** Separate limbs dance around their joints while the original artwork remains the reduced-motion pose. */
function loadingHtml(): string {
  const golem = ['leg-left', 'leg-right', 'arm-left', 'arm-right', 'torso']
    .map(
      (part) =>
        `<img class="sd-golem-part sd-golem-${part}" src="${esc(LOADING_GOLEM_URL)}" width="156" height="130" alt="" decoding="async">`
    )
    .join('');
  const slots = LOADING_SKILL_GLYPHS.map(
    (glyph, index) =>
      `<span class="sd-loading-slot" style="--sd-slot: ${index}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${glyph}</svg></span>`
  ).join('');
  const rows = Array.from({ length: 4 }, () => '<span></span>').join('');
  return `<div class="sd-loading" role="status" aria-live="polite"><div class="sd-loading-scene" aria-hidden="true"><div class="sd-golem-stage"><span class="sd-training-golem">${golem}<img class="sd-golem-still" src="${esc(LOADING_GOLEM_URL)}" width="156" height="130" alt="" decoding="async"></span><span class="sd-golem-shadow"></span></div><div class="sd-loading-bar">${slots}</div></div><p>Calculating skill damage</p><div class="sd-skeleton" aria-hidden="true">${rows}</div></div>`;
}

function castLabel(row: SkillDamageRowView): string {
  if (row.castSeconds == null) return 'proc';
  return row.castSeconds > 0 ? `${row.castSeconds.toFixed(2)}s` : 'instant';
}

function rowHtml(row: SkillDamageRowView, model: SkillDamageViewModel, columns: string): string {
  const m = row.measurement;
  const icon = row.icon
    ? `<img class="sd-icon" src="${esc(row.icon)}" alt="" loading="lazy">`
    : `<span class="sd-badge">${esc(row.badge)}</span>`;
  // The collapsed summary counts all applications; expansion separates their different durations and factors.
  const stacksByCondition = new Map<string, number>();
  for (const condition of m.conditions)
    stacksByCondition.set(condition.condition, (stacksByCondition.get(condition.condition) ?? 0) + condition.stacks);
  const applied = [...stacksByCondition]
    .map(
      ([condition, stacks]) =>
        `<span class="sd-condition-chip" data-condition="${esc(condition)}">${esc(conditionLabel(condition))} <b>×${integer(stacks)}</b></span>`
    )
    .join('');
  const cells = [
    `<button type="button" class="sd-skill" data-sd-row="${esc(row.id)}" aria-expanded="${row.expanded}">${icon}<span class="sd-name">${esc(row.name)}<small>${esc(row.context)}</small></span></button>`,
    `<span class="sd-num sd-dim">${castLabel(row)}</span>`,
    ...(model.showStrikeColumns
      ? [
          `<span class="sd-num sd-dim">${m.hits ? integer(m.hits) : '—'}</span>`,
          `<span class="sd-num sd-dim">${m.coefficient ? m.coefficient.toFixed(2) : '—'}</span>`
        ]
      : []),
    ...(model.showAppliedColumn
      ? [`<span class="sd-applied">${applied || '<span class="sd-dim">—</span>'}</span>`]
      : []),
    `<span class="sd-num">${m.strike ? integer(m.strike) : '—'}</span>`,
    `<span class="sd-num">${m.conditionDamage ? integer(m.conditionDamage) : '—'}</span>`,
    `<span class="sd-num sd-total">${integer(m.total)}</span>`,
    `<span class="sd-num">${row.perCastSecond == null ? '—' : integer(row.perCastSecond)}</span>`
  ].join('');
  return `<div class="sd-row sd-${row.status}${row.expanded ? ' is-expanded' : ''}"><div class="sd-cells" style="grid-template-columns: ${columns}">${cells}</div>${
    row.expanded ? breakdownHtml(row, model) : ''
  }</div>`;
}

function contributorList(contributors: readonly Gw2ModifierContribution[]): string {
  const { additive, multipliers, additiveTotal } = contributionBuckets(contributors);
  const line = (label: string, value: string): string =>
    `<div class="sd-line"><span>${esc(label)}</span><span class="sd-mono">${value}</span></div>`;
  return (
    [
      additive.length
        ? `<div class="sd-subhead">Additive ${signedPercent(additiveTotal)}</div>${additive.map((entry) => line(entry.label, signedPercent(entry.value))).join('')}`
        : '',
      multipliers.length
        ? `<div class="sd-subhead">Multipliers</div>${multipliers.map((entry) => line(entry.label, factor(entry.value))).join('')}`
        : ''
    ].join('') || '<p class="sd-note">No active modifiers.</p>'
  );
}

/** Compact component sections keep the total and calculation readable; optional details retain the resolver's facts. */
function breakdownHtml(row: SkillDamageRowView, model: SkillDamageViewModel): string {
  const m = row.measurement;
  const fact = (label: string, value: string): string =>
    `<span class="sd-fact"><span>${esc(label)}</span> <b class="sd-mono">${value}</b></span>`;
  // Row columns already show totals and efficiency; expansion focuses on how the damage is calculated.
  const sections: string[] = [];
  const strike = m.strikeBreakdown;
  if (strike) {
    const inputs = [
      strike.weaponStrength == null ? '' : fact('Weapon strength', integer(strike.weaponStrength)),
      fact('Coefficient', m.coefficient.toFixed(2)),
      fact('Power', integer(strike.power)),
      model.targetArmor ? fact('Target armor', integer(model.targetArmor)) : '',
      fact('Crit chance', percent(strike.criticalChance)),
      fact('Crit damage', percent(strike.criticalDamageMultiplier)),
      fact('Non-crit', integer(strike.nonCriticalDamage)),
      fact('Crit', integer(strike.criticalDamage))
    ].join('');
    // Varying hits have a summed result, not a shared multiplication that would misstate the calculation.
    const formula = strike.variesAcrossHits
      ? '<span><small>Sum of individually calculated hits</small></span>'
      : `<span>${integer(strike.baseDamage)} <small>base</small></span><span>&times;</span><span>${strike.outgoingMultiplier.toFixed(3)} <small>modifiers</small></span><span>&times;</span><span>${strike.averagedCriticalMultiplier.toFixed(3)} <small>critical average</small></span><span>=</span>`;
    sections.push(
      `<section class="sd-component" aria-label="Strike breakdown"><div class="sd-component-heading"><strong>Strike</strong><span class="sd-formula">${formula}<b>${integer(m.strike)}</b></span></div><details class="sd-calculation-details"><summary>Calculation details</summary><div class="sd-facts">${inputs}</div><div class="sd-modifier-list">${contributorList(strike.contributors)}</div>${strike.variesAcrossHits ? '<p class="sd-note">Power, weapon strength, critical values, and modifiers shown describe the first hit. These inputs vary across hits; damage totals include every hit.</p>' : ''}</details></section>`
    );
  }

  if (m.conditions.length) {
    const rows = m.conditions
      .map((condition) => {
        const perSecond = conditionPerSecond(condition);
        return `<div class="sd-condition-row" data-condition="${esc(condition.condition)}"><span class="sd-condition-name">${esc(conditionLabel(condition.condition))}</span><span class="sd-mono">${integer(condition.stacks)}</span><span class="sd-mono">${perSecond == null ? '&mdash;' : integer(perSecond)}</span><span class="sd-mono">${condition.baseDurationSeconds}s &rarr; ${condition.effectiveDurationSeconds.toFixed(1)}s <small>${signedPercent(condition.effectiveDurationSeconds / Math.max(condition.baseDurationSeconds, 1e-9) - 1)}</small></span><span class="sd-mono">${integer(condition.damage)}</span></div>`;
      })
      .join('');
    // Keep damage and duration separate, with the contributing sources next to the factor they explain.
    const sources = (contributors: readonly Gw2ModifierContribution[]): string => {
      const { additive, multipliers } = contributionBuckets(contributors);
      return (
        [
          additive.map((entry) => `${esc(entry.label)} ${signedPercent(entry.value)}`).join(' + '),
          multipliers.map((entry) => `${esc(entry.label)} ${factor(entry.value)}`).join(' &middot; ')
        ]
          .filter(Boolean)
          .join(' &middot; ') || 'No active modifiers'
      );
    };

    const modifiers = m.conditions
      .map((condition) => {
        const perSecond = conditionPerSecond(condition);
        const baseDurationFactor =
          condition.baseDurationMultiplier !== 1 ? ` &times; ${condition.baseDurationMultiplier.toFixed(3)}` : '';
        return `<div class="sd-condition-factors"><strong>${esc(conditionLabel(condition.condition))}</strong>
        <div class="sd-condition-calculation"><span>Damage / second</span><span class="sd-mono">${condition.rate == null ? '&mdash;' : integer(condition.rate)} &times; ${(condition.multiplier ?? 1).toFixed(3)} = <b>${perSecond == null ? '&mdash;' : integer(perSecond)}</b></span><small>${sources(condition.damageContributors)}${condition.conditionDamage == null ? '' : ` &middot; Base rate at ${integer(condition.conditionDamage)} Condition Damage`}</small></div>
        <div class="sd-condition-calculation"><span>Duration</span><span class="sd-mono">${condition.baseDurationSeconds}s${baseDurationFactor} &times; ${condition.durationMultiplier.toFixed(3)} = <b>${condition.effectiveDurationSeconds.toFixed(1)}s</b></span><small>${sources(condition.durationContributors)} &middot; Bonus capped at +100%</small></div>
      </div>`;
      })
      .join('');
    sections.push(
      `<section class="sd-component" aria-label="Condition breakdown"><div class="sd-component-heading"><strong>Conditions</strong><b class="sd-mono">${integer(m.conditionDamage)}</b></div><div class="sd-condition-head"><span>Condition</span><span>Stacks</span><span>Per second</span><span>Duration</span><span>Damage</span></div>${rows}<details class="sd-calculation-details"><summary>Condition modifiers</summary><div class="sd-condition-factor-list">${modifiers}</div></details></section>`
    );
  }

  if (row.variants.length > 1) {
    const primary = row.variants.find((variant) => variant.primary) ?? row.variants.at(-1)!;
    const readout = (variant: (typeof row.variants)[number]): string =>
      `${variant.label} · ${integer(variant.total)} average`;
    sections.push(
      `<div class="sd-ladder"><div class="sd-ladder-head"><span class="sd-card-title">Average damage by level</span><span class="sd-ladder-readout" aria-live="polite">${esc(readout(primary))}</span></div><div class="sd-ladder-bars" style="grid-template-columns: repeat(${row.variants.length}, minmax(0, 1fr))">${row.variants
        .map(
          (variant) =>
            `<button type="button" class="sd-ladder-bar${variant.primary ? ' is-primary' : ''}" data-sd-variant="${esc(readout(variant))}" aria-label="${esc(readout(variant))}"><span style="height: ${variant.heightPercent.toFixed(1)}%"></span></button>`
        )
        .join(
          ''
        )}</div><div class="sd-ladder-labels" style="grid-template-columns: repeat(${row.variants.length}, minmax(0, 1fr))">${row.variants
        .map((variant) => `<span>${esc(variant.label)}<b>${integer(variant.total)}</b></span>`)
        .join('')}</div></div>`
    );
  }

  // Charge and pulse totals must remain distinguishable from complete skill activations and proc occurrences.
  const notes = [
    `Per ${row.unit}`,
    ...row.assumptions,
    ...(m.total === 0 ? ['No damage under the selected conditions.'] : [])
  ];
  return `<div class="sd-breakdown">${notes.length ? `<p class="sd-note">${notes.map(esc).join(' &middot; ')}</p>` : ''}${sections.join('')}</div>`;
}
