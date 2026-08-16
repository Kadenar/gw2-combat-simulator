import assert from "node:assert/strict";
import test from "node:test";
import {
  suggestedActivationInterruptMs,
  validateActivationInterruptMs,
} from "../../../js/platform/ui/activation-editor.js";
import { chargeReleaseRowLabel } from "../../../js/platform/ui/charge-release-editor.js";
import { validateDurationMs } from "../../../js/platform/ui/duration-editor.js";
import {
  buildChartSeries,
  buildPhaseDpsSeries,
  buildPhaseEffectSeries,
  chartValueAt,
  mountTimeSeriesCharts,
} from "../../../js/platform/ui/charts.js";
import {
  eventLogCsv,
  eventLogRows,
  mountEventLog,
} from "../../../js/platform/ui/event-log.js";
import {
  bindPaletteInteractions,
  paletteGroupHtml,
  paletteSkillHtml,
  virtualPaletteSkillHtml,
} from "../../../js/platform/ui/palette.js";
import { escapeHtml, gw2ApiText } from "../../../js/platform/ui/html.js";
import {
  normalizeRotationInsertionIndex,
  rotationInsertionGapHtml,
  rotationTimelineEntryHtml,
} from "../../../js/platform/ui/insertion-cursor.js";
import { targetHealthBreakpointSnapshots } from "../../../js/platform/ui/result-transform.js";
import {
  mountRotationWarnings,
  mountRotationResults,
  nextResultSortState,
  SKILL_COLS,
  sortResultRows,
} from "../../../js/platform/ui/rotation-results.js";
import {
  normalizeRotationDeadTimeVisibility,
  normalizeRotationTimelineSize,
  ROTATION_TIMELINE_SIZE_OPTIONS,
} from "../../../js/platform/ui/rotation-timeline-size.js";
import {
  DEFAULT_ROTATION_WORKSPACE_STATE,
  reduceRotationWorkspaceState,
  syncRotationFocusResults,
} from "../../../js/platform/ui/rotation-workspace.js";
import {
  bindTimelineInteractions,
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  getSkillDropInsertionIndex,
  insertRotationEntry,
  insertRotationEntries,
  moveRotationEntry,
  removeRotationEntryOptions,
  rotationEntryName,
  timelineDeadTimeMarkers,
  timelineSkillCastOrdinals,
  updateRotationEntry,
} from "../../../js/platform/ui/timeline.js";

function inertContainer() {
  return {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

test("rotation timeline sizes expose two larger display options", () => {
  assert.deepEqual(
    ROTATION_TIMELINE_SIZE_OPTIONS.map((option) => [
      option.value,
      option.label,
    ]),
    [
      ["normal", "100%"],
      ["large", "125%"],
      ["extra-large", "150%"],
    ],
  );
  assert.equal(normalizeRotationTimelineSize("large"), "large");
  assert.equal(normalizeRotationTimelineSize("extra-large"), "extra-large");
  assert.equal(normalizeRotationTimelineSize("unsupported"), "normal");
  assert.equal(normalizeRotationTimelineSize(null), "normal");
  assert.equal(normalizeRotationDeadTimeVisibility("true"), true);
  assert.equal(normalizeRotationDeadTimeVisibility(true), true);
  assert.equal(normalizeRotationDeadTimeVisibility("false"), false);
  assert.equal(normalizeRotationDeadTimeVisibility(null), false);
});

test("rotation workspace keeps config closed by default and scopes focus mode", () => {
  assert.deepEqual(DEFAULT_ROTATION_WORKSPACE_STATE, {
    configOpen: false,
    focus: false,
  });

  const configOpen = reduceRotationWorkspaceState(
    DEFAULT_ROTATION_WORKSPACE_STATE,
    "toggle-config",
  );
  assert.deepEqual(configOpen, { configOpen: true, focus: false });
  assert.deepEqual(reduceRotationWorkspaceState(configOpen, "escape"), {
    configOpen: false,
    focus: false,
  });

  const focused = reduceRotationWorkspaceState(
    DEFAULT_ROTATION_WORKSPACE_STATE,
    "toggle-focus",
  );
  assert.deepEqual(focused, { configOpen: false, focus: true });
  assert.deepEqual(
    reduceRotationWorkspaceState(
      { configOpen: true, focus: true },
      "toggle-focus",
    ),
    { configOpen: false, focus: false },
  );
  assert.equal(reduceRotationWorkspaceState(focused, "escape"), focused);
});

test("focus mode expands DPS snapshots only for the focused workspace", () => {
  let focused = true;
  const details = { dataset: {}, open: false };
  const root = {
    body: { hasAttribute: () => focused },
    querySelectorAll: () => [details],
  };

  syncRotationFocusResults(root);
  assert.equal(details.open, true);
  assert.equal(details.dataset.focusExpanded, "true");

  focused = false;
  syncRotationFocusResults(root);
  assert.equal(details.open, false);
  assert.equal(details.dataset.focusExpanded, undefined);
});

test("activation editor suggests and validates manual interruption times", () => {
  assert.equal(suggestedActivationInterruptMs(920, 1200), 919);
  assert.equal(suggestedActivationInterruptMs(null, 500), 499);
  assert.equal(suggestedActivationInterruptMs(0, 0), 1);
  assert.deepEqual(validateActivationInterruptMs("640", 920), {
    valid: true,
    value: 640,
  });
  assert.deepEqual(validateActivationInterruptMs("640.4", 920), {
    valid: true,
    value: 640,
  });
  assert.equal(validateActivationInterruptMs("", 920).valid, false);
  assert.equal(validateActivationInterruptMs(0, 920).valid, false);
  assert.equal(validateActivationInterruptMs(920, 920).valid, false);
});

test("duration editor validates and rounds millisecond values", () => {
  assert.deepEqual(validateDurationMs("1000"), { valid: true, value: 1000 });
  assert.deepEqual(validateDurationMs("1.4"), { valid: true, value: 1 });
  assert.equal(validateDurationMs("").valid, false);
  assert.equal(validateDurationMs("Infinity").valid, false);
  assert.equal(validateDurationMs("0.9").valid, false);
  assert.equal(validateDurationMs("501", 1, 500).valid, false);
});

test("charge release rows expose time, Flow, and coefficient", () => {
  assert.equal(
    chargeReleaseRowLabel({
      charges: 3,
      at: 12.75,
      delta: 0.75,
      flowAfter: 7.5,
      coefficient: 5.435,
    }),
    "3 charges · 12.750s (+0.750s) · 7.50 Flow · 5.43 coefficient",
  );
});

test("rotation insertion cursors validate positions and expose accessible gaps", () => {
  assert.equal(normalizeRotationInsertionIndex(0, 3), 0);
  assert.equal(normalizeRotationInsertionIndex(3, 3), 3);
  assert.equal(normalizeRotationInsertionIndex(4, 3), null);
  assert.equal(normalizeRotationInsertionIndex(1.5, 3), null);
  assert.equal(normalizeRotationInsertionIndex(null, 3), null);
  assert.equal(normalizeRotationInsertionIndex(undefined, 3), null);

  assert.match(
    rotationInsertionGapHtml(2, 2),
    /class="rot-insertion-gap active"/,
  );
  assert.match(rotationInsertionGapHtml(2, null), /Insert at position 3/);
  assert.match(
    rotationTimelineEntryHtml(2, null, '<div class="rot-skill">Skill</div>'),
    /class="rot-entry"[\s\S]*data-insertion-index="2"[\s\S]*class="rot-skill"/,
  );
});

test("timeline cast details include start, end, and elapsed cast time", () => {
  assert.equal(
    formatTimelineCastDetails(
      { start: 1250, end: 2010 },
      (time) => `${(time / 1000).toFixed(2)}s`,
    ),
    "Cast: 1.25s → 2.01s\nCast time: 0.76s",
  );
});

test("timeline dead time excludes explicit waits, concurrent casts, and gap-fill attacks", () => {
  const markers = timelineDeadTimeMarkers([
    { ri: 0, skill: "Long Cast", start: 0, end: 1000 },
    { ri: 1, skill: "Instant Cast", start: 200, end: 200 },
    { ri: 2, skill: "Wait", start: 1000, end: 1400, type: "wait" },
    { ri: 3, skill: "Next Cast", start: 1400, end: 1800 },
    {
      ri: 4,
      skill: "Gap-filled Cast",
      start: 2000,
      end: 2400,
      partialFill: { startMs: 1800, durationMs: 150 },
    },
    {
      ri: 5,
      skill: "Invalid Cast",
      start: 3000,
      end: 3200,
      invalid: true,
    },
  ]);

  assert.deepEqual(markers, [
    { insertionIndex: 4, start: 1950, end: 2000, durationMs: 50 },
  ]);
  assert.equal(formatTimelineDuration(400), "400ms");
  assert.equal(formatTimelineDuration(1000), "1s");
  assert.equal(formatTimelineDuration(1250), "1.25s");
  assert.equal(formatTimelineDuration(12_500), "12.5s");
  assert.equal(formatTimelineDuration(100_000), "100s");
});

test("timeline skill tooltips include matching and global cast ordinals", () => {
  const steps = [
    { ri: 0, skill: "Well of Darkness", start: 1000, end: 1481 },
    { ri: 1, skill: "Wait", start: 1481, end: 2000 },
    { ri: 2, skill: "Nightfall", start: 2000, end: 2750 },
    { ri: 3, skill: "Well of Darkness", start: 3000, end: 3481 },
    { ri: 4, skill: "Well of Darkness", start: 2500, end: 2981 },
    {
      ri: 5,
      skill: "Well of Darkness",
      start: 4000,
      end: 4481,
      invalid: true,
    },
  ];
  const ordinals = timelineSkillCastOrdinals(steps);

  assert.deepEqual(ordinals.get(4), {
    matchingIndex: 2,
    matchingTotal: 3,
    skillIndex: 3,
    skillTotal: 4,
  });
  assert.equal(
    formatTimelineSkillTooltip(
      "Well of Darkness",
      steps[4],
      ordinals.get(4),
      (time) => `${(time / 1000).toFixed(3)}s`,
    ),
    "Well of Darkness at 2.500s for 481ms\n" +
      "Well of Darkness cast 2 of 3\n" +
      "Skill cast 3 of 4",
  );
  assert.match(
    formatTimelineSkillTooltip(
      "Dragon Slash—Force",
      steps[4],
      ordinals.get(4),
      (time) => `${(time / 1000).toFixed(3)}s`,
      ["Charges reached: 4", "Time spent charging: 0.750s", "Flow spent: 10"],
    ),
    /Charges reached: 4\nTime spent charging: 0\.750s\nFlow spent: 10$/,
  );
  assert.equal(ordinals.has(1), false);
  assert.equal(ordinals.has(5), false);
});

test("GW2 API text removes presentation tags for native tooltips", () => {
  const description =
    "<c=@abilitytype>Stances</c> grant protection.<br><c=@reminder>Once per interval.</c>";
  assert.equal(
    gw2ApiText(description),
    "Stances grant protection.\nOnce per interval.",
  );
  assert.equal(
    escapeHtml(gw2ApiText('<c=abilitytype>"Glamour" & allies</c>')),
    "&quot;Glamour&quot; &amp; allies",
  );
});

test("shared chart lookup and series cover damage timing and configurable effects", () => {
  assert.equal(chartValueAt([], 10), 0);
  assert.equal(
    chartValueAt(
      [
        { t: 0, v: 1 },
        { t: 100, v: 4 },
      ],
      99,
    ),
    1,
  );
  assert.equal(
    chartValueAt(
      [
        { t: 0, v: 1 },
        { t: 100, v: 4 },
      ],
      100,
    ),
    4,
  );

  const series = buildChartSeries(
    {
      duration: 9,
      deathTime: 2,
      dpsStartTime: 0.5,
      resolvedEvents: [
        { type: "damage", at: 0.5, damage: 100 },
        {
          type: "condition",
          at: 1,
          condition: "burn",
          duration: 2,
          expiresAt: 2,
          naturalExpiresAt: 3,
          stacks: 3,
          damage: 0,
          damageTicks: [
            { at: 1, damage: 50 },
            { at: 2, damage: 250 },
          ],
        },
      ],
      events: [{ type: "buff", at: 0, kind: "power", duration: 2, stacks: 2 }],
    },
    1000,
    {
      effectName: (value) => `Effect <${value}>`,
      stackCaps: { "Effect <burn>": 2 },
    },
  );

  assert.equal(series.durationMs, 1500);
  assert.equal(series.dps[0].v, 0);
  assert.equal(series.dps[1].v, 150);
  assert.equal(series.dps.at(-1).v, 400 / 1.5);
  assert.equal(series.cumulativeDamage.at(-1).v, 400);
  assert.equal(series.effects["Effect <burn>"][1].v, 2);
  assert.equal(series.effects["Effect <burn>"].at(-1).v, 2);
  assert.equal(series.effects["Effect <power>"][0].v, 2);
});

test("shared DPS charts start their sample grid at the first hit", () => {
  const series = buildChartSeries({
    duration: 2,
    dpsStartTime: 1.156,
    resolvedEvents: [
      { type: "damage", at: 1.156, damage: 3567 },
      { type: "damage", at: 1.32, damage: 916 },
    ],
  });

  assert.equal(series.durationMs, 844);
  assert.deepEqual(series.dps.slice(0, 2), [
    { t: 0, v: 0 },
    { t: 250, v: 4483 / 0.25 },
  ]);
});

test("target health breakpoints use cumulative damage and individual condition ticks", () => {
  const snapshots = targetHealthBreakpointSnapshots(
    {
      dpsStartTime: 0.5,
      resolvedEvents: [
        { type: "damage", at: 0.5, damage: 100 },
        {
          type: "condition",
          at: 0.75,
          damage: 350,
          damageTicks: [
            { at: 1, damage: 150 },
            { at: 1.5, damage: 200 },
          ],
        },
        { type: "damage", at: 1.5, damage: 200 },
        { type: "damage", at: 2, damage: 200 },
      ],
    },
    1000,
  );

  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.healthPercent),
    [80, 60, 40, 20],
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.elapsed),
    [0.5, 1, 1, 1.5],
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.damage),
    [250, 650, 650, 850],
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.dps),
    [500, 650, 650, 850 / 1.5],
  );
  assert.deepEqual(targetHealthBreakpointSnapshots({}, 0), []);
});

test("phase DPS is recalculated from damage within the selected health range", () => {
  assert.deepEqual(
    buildPhaseDpsSeries(
      [
        { t: 0, v: 0 },
        { t: 1000, v: 100 },
        { t: 2000, v: 300 },
        { t: 3000, v: 600 },
      ],
      1000,
      3000,
      100,
      600,
    ),
    [
      { t: 0, v: 0 },
      { t: 1000, v: 200 },
      { t: 2000, v: 250 },
    ],
  );
  assert.deepEqual(buildPhaseDpsSeries([], 1000, 1000, 100, 100), []);
});

test("phase effects are cropped and rebased to the selected health range", () => {
  assert.deepEqual(
    buildPhaseEffectSeries(
      [
        { t: 0, v: 0 },
        { t: 500, v: 1 },
        { t: 1500, v: 2 },
        { t: 2500, v: 0 },
        { t: 3000, v: 3 },
      ],
      1000,
      3000,
    ),
    [
      { t: 0, v: 1 },
      { t: 500, v: 2 },
      { t: 1500, v: 0 },
      { t: 2000, v: 3 },
    ],
  );
  assert.deepEqual(buildPhaseEffectSeries([], 1000, 3000), []);
  assert.deepEqual(buildPhaseEffectSeries([{ t: 0, v: 1 }], 1000, 1000), []);
});

test("shared chart markup escapes effect names and uses scoped roles without ids", () => {
  const container = inertContainer();
  mountTimeSeriesCharts(
    container,
    {
      durationMs: 1000,
      dps: [{ t: 0, v: 0 }],
      effects: { 'Bad"><img src=x>': [{ t: 0, v: 1 }] },
      cumulativeDamage: [
        { t: 0, v: 0 },
        { t: 1000, v: 1000 },
      ],
    },
    {
      healthBreakpoints: [
        { healthPercent: 80, elapsed: 0.2, damage: 200 },
        { healthPercent: 60, elapsed: 0.4, damage: 400 },
        { healthPercent: 40, elapsed: 0.6, damage: 600 },
        { healthPercent: 20, elapsed: 0.8, damage: 800 },
      ],
    },
  );
  assert.match(container.innerHTML, /data-role="dps-canvas"/);
  assert.match(container.innerHTML, /Bad&quot;&gt;&lt;img src=x&gt;/);
  assert.match(container.innerHTML, /data-role="chart-phase-toggles"/);
  assert.match(container.innerHTML, /Chart range/);
  assert.match(container.innerHTML, /data-role="effects-panel-title"/);
  assert.match(container.innerHTML, /Full Fight/);
  assert.deepEqual(
    [...container.innerHTML.matchAll(/data-chart-phase="([^"]+)"/g)].map(
      (match) => match[1],
    ),
    ["full", "100-80", "80-60", "60-40", "40-20", "20-0"],
  );
  const finalPhaseButton = container.innerHTML.match(
    /<button type="button"[\s\S]*?data-chart-phase="20-0"[\s\S]*?<\/button>/,
  );
  assert.ok(finalPhaseButton);
  assert.doesNotMatch(finalPhaseButton[0], /disabled/);
  assert.doesNotMatch(container.innerHTML, /\sid="/);
});

test("result charts reuse the target-health DPS snapshot breakpoints", () => {
  const chartContainer = inertContainer();
  const container = {
    innerHTML: "",
    querySelector: (selector) =>
      selector === '[data-role="result-charts"]' ? chartContainer : null,
    querySelectorAll: () => [],
  };
  mountRotationResults(container, {
    breakpoints: [
      { healthPercent: 80, dps: 1200, elapsed: 1, damage: 1200 },
      { healthPercent: 60, dps: 1400, elapsed: 2, damage: 2800 },
    ],
    chartSeries: {
      durationMs: 3000,
      dps: [{ t: 0, v: 0 }],
      effects: {},
      cumulativeDamage: [
        { t: 0, v: 0 },
        { t: 3000, v: 4000 },
      ],
    },
  });

  assert.match(
    chartContainer.innerHTML,
    /data-chart-phase="100-80"[\s\S]*?aria-pressed="false"/,
  );
  assert.match(
    chartContainer.innerHTML,
    /data-chart-phase="80-60"[\s\S]*?aria-pressed="false"/,
  );
});

test("result sorting handles defaults, numeric directions, strings, and cycling", () => {
  assert.deepEqual(
    SKILL_COLS.map((column) => column.key),
    [
      "name",
      "strike",
      "condition",
      "total",
      "dps",
      "average",
      "dct",
      "casts",
      "hits",
      "critChance",
    ],
  );
  const rows = [
    { name: "Beta", total: 20, dps: 5 },
    { name: "Alpha", total: 10, dps: 8 },
  ];
  const columns = [
    { key: "name", numeric: false },
    { key: "dps", numeric: true },
  ];
  assert.deepEqual(
    sortResultRows(rows, columns, null, null).map((row) => row.name),
    ["Beta", "Alpha"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "dps", "asc").map((row) => row.name),
    ["Beta", "Alpha"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "dps", "desc").map((row) => row.name),
    ["Alpha", "Beta"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "name", "asc").map((row) => row.name),
    ["Alpha", "Beta"],
  );
  assert.deepEqual(nextResultSortState(null, null, "dps"), {
    column: "dps",
    direction: "desc",
  });
  assert.deepEqual(nextResultSortState("dps", "desc", "dps"), {
    column: "dps",
    direction: "asc",
  });
  assert.deepEqual(nextResultSortState("dps", "asc", "dps"), {
    column: null,
    direction: null,
  });
});

test("shared results render summaries, totals, contributions, and icons", () => {
  const container = inertContainer();
  const resolved = [];
  mountRotationResults(
    container,
    {
      metrics: [{ label: "DPS", value: "1,234", className: "dps" }],
      breakpoints: [{ healthPercent: 80, dps: 1234, elapsed: 3.25 }],
      skillColumns: [
        { key: "name", label: "Skill", numeric: false },
        { key: "total", label: "Total", numeric: true },
      ],
      skillRows: [
        { name: "Low", total: 10 },
        { name: "High", total: 20 },
      ],
      conditions: [
        { name: "Burn <hot>", damage: 25, dps: 5, averageStacks: 1.25 },
      ],
      conditionTotal: { label: "Total Conditions", damage: 25, dps: 5 },
      contributions: [
        {
          name: "Bonus",
          dpsIncrease: 12,
          pctIncrease: 1.5,
          icon: "bonus.png",
        },
        {
          name: "Noise",
          dpsIncrease: -0.1,
          pctIncrease: -0.001,
        },
        {
          name: "Penalty",
          dpsIncrease: -12,
          pctIncrease: -1.5,
        },
      ],
      contributionsStale: true,
      randomDistributionRequested: true,
      randomDistribution: {
        trials: 500,
        mean: 1234,
        p01: 1000,
        p10: 1100,
        p50: 1225,
        p90: 1350,
        p99: 1500,
        explanation: {
          cohortPercent: 10,
          lowDpsMean: 1040,
          highDpsMean: 1460,
          drivers: [
            {
              id: "critical:illusion",
              label: "Illusion critical hits",
              category: "critical",
              unit: "count",
              lowAverage: 18.2,
              overallAverage: 21.5,
              highAverage: 25.4,
              delta: 7.2,
              correlation: 0.84,
              estimatedDpsDelta: 360,
            },
          ],
        },
      },
    },
    {
      resolveSkillIcon: (row) => {
        resolved.push(row.name);
        return `icon-${row.name}.png`;
      },
    },
  );

  assert.match(container.innerHTML, /res-summary/);
  assert.match(container.innerHTML, /DPS snapshots/);
  assert.match(container.innerHTML, /80%<\/b> target health/);
  assert.match(container.innerHTML, />1,234</);
  assert.match(container.innerHTML, /at 3\.25s/);
  assert.ok(
    container.innerHTML.indexOf("High") < container.innerHTML.indexOf("Low"),
  );
  assert.match(container.innerHTML, /Total Conditions/);
  assert.match(container.innerHTML, /\+12/);
  assert.match(container.innerHTML, /\+1\.50%/);
  assert.match(
    container.innerHTML,
    /Noise<\/span>\s*<span class="contrib-val">0<\/span>\s*<span class="contrib-pct">0\.00%/,
  );
  assert.match(
    container.innerHTML,
    /Penalty<\/span>\s*<span class="contrib-val">-12<\/span>\s*<span class="contrib-pct">-1\.50%/,
  );
  assert.doesNotMatch(container.innerHTML, /-0(?:\.00)?%?/);
  assert.match(container.innerHTML, /<img src="bonus\.png" alt="" \/>Bonus/);
  assert.match(container.innerHTML, /contrib-status/);
  assert.match(container.innerHTML, /Recalculating/);
  assert.match(container.innerHTML, /Simulation RNG distribution/);
  assert.match(
    container.innerHTML,
    /Always available for the current rotation/,
  );
  assert.match(container.innerHTML, /Run again/);
  assert.match(container.innerHTML, /500 outcomes per run/);
  assert.match(container.innerHTML, /Rare low outcome/);
  assert.match(container.innerHTML, /About 1 in 100 runs are lower/);
  assert.match(container.innerHTML, /Rare high outcome/);
  assert.match(container.innerHTML, /About 1 in 100 runs are higher/);
  assert.match(container.innerHTML, /1,100&ndash;1,350/);
  assert.match(
    container.innerHTML,
    /What was different in the highest-DPS simulations\?/,
  );
  assert.match(container.innerHTML, /50 highest vs 50 lowest/);
  assert.match(
    container.innerHTML,
    /The 50 highest-DPS simulations averaged 1,460 DPS/,
  );
  assert.match(
    container.innerHTML,
    /The 50 lowest-DPS simulations averaged 1,040 DPS/,
  );
  assert.match(container.innerHTML, /Illusion critical hits/);
  assert.match(
    container.innerHTML,
    /Highest-DPS group: 25\.4 average per simulation/,
  );
  assert.match(
    container.innerHTML,
    /Lowest-DPS group: 18\.2 average per simulation/,
  );
  assert.match(container.innerHTML, /\+7\.2/);
  assert.match(container.innerHTML, /difference/);
  assert.match(container.innerHTML, /&asymp; \+360 DPS/);
  assert.match(container.innerHTML, /estimated DPS difference/);
  assert.match(container.innerHTML, /single-variable trend estimates/);
  assert.match(container.innerHTML, /averages across each group/);
  assert.match(container.innerHTML, /do not add them together/);
  assert.ok(
    container.innerHTML.indexOf("DPS snapshots") <
      container.innerHTML.indexOf("Simulation RNG distribution"),
  );
  assert.deepEqual(resolved, ["High", "Low"]);

  assert.doesNotThrow(() => mountRotationResults(inertContainer(), {}));
});

test("skill damage rows group player damage before owned entities", () => {
  const container = inertContainer();
  mountRotationResults(container, {
    skillColumns: [
      { key: "name", label: "Skill", numeric: false },
      { key: "strike", label: "Strike", numeric: true },
      {
        key: "condition",
        label: "Condition",
        numeric: true,
        className: "condi",
      },
      { key: "total", label: "Total", numeric: true, className: "total" },
      { key: "dps", label: "DPS", numeric: true, className: "dps" },
    ],
    skillRows: [
      {
        name: "Player Low",
        strike: 6,
        condition: 4,
        total: 10,
        dps: 2,
        group: "Player",
      },
      {
        name: "Entity High",
        strike: 75,
        condition: 25,
        total: 100,
        dps: 20,
        group: "Entities",
      },
      {
        name: "Player High",
        strike: 15,
        condition: 5,
        total: 20,
        dps: 4,
        group: "Player",
      },
      {
        name: "Entity Low",
        strike: 30,
        condition: 20,
        total: 50,
        dps: 10,
        group: "Entities",
      },
    ],
  });

  const html = container.innerHTML;
  const playerGroup = html.indexOf('data-skill-group="Player"');
  const entityGroup = html.indexOf('data-skill-group="Entities"');
  assert.ok(playerGroup >= 0);
  assert.ok(entityGroup > playerGroup);
  assert.ok(html.indexOf("Player High") < html.indexOf("Player Low"));
  assert.ok(html.indexOf("Player Low") < entityGroup);
  assert.ok(html.indexOf("Entity High") < html.indexOf("Entity Low"));
  assert.match(html, /aria-label="Player Strike: 21">21</);
  assert.match(html, /aria-label="Player Condition: 9">9</);
  assert.match(html, /aria-label="Player Total: 30">30</);
  assert.match(html, /aria-label="Player DPS: 6">6</);
  assert.match(html, /aria-label="Entities Strike: 105">105</);
  assert.match(html, /aria-label="Entities Condition: 45">45</);
  assert.match(html, /aria-label="Entities Total: 150">150</);
  assert.match(html, /aria-label="Entities DPS: 30">30</);
});

test("RNG distribution waits for its manual run button", () => {
  const runButton = {};
  const container = {
    ...inertContainer(),
    querySelector: (selector) =>
      selector === '[data-role="rng-run"]' ? runButton : null,
  };
  let runCount = 0;
  mountRotationResults(
    container,
    {
      metrics: [],
      randomDistributionRequested: true,
      randomDistributionTrials: 500,
    },
    {
      onRunRandomDistribution() {
        runCount += 1;
      },
    },
  );

  assert.match(
    container.innerHTML,
    /Run the distribution when the rotation is ready/,
  );
  assert.match(container.innerHTML, /Run 500 outcomes/);
  assert.equal(typeof runButton.onclick, "function");
  runButton.onclick();
  assert.equal(runCount, 1);
});

test("RNG distribution renders completed outcomes and percentage progress", () => {
  const container = inertContainer();
  mountRotationResults(container, {
    metrics: [],
    randomDistributionRequested: true,
    randomDistributionStale: true,
    randomDistributionTrials: 500,
    randomDistributionProgress: {
      completed: 125,
      total: 500,
      percent: 25,
    },
  });

  assert.match(container.innerHTML, /role="progressbar"/);
  assert.match(container.innerHTML, /aria-valuenow="25"/);
  assert.match(container.innerHTML, /style="width: 25%"/);
  assert.match(container.innerHTML, /125 \/ 500 outcomes \(25%\)/);
});

test("rotation warnings render a collapsed count and escaped details", () => {
  const container = inertContainer();
  mountRotationWarnings(container, [
    { time: "1.25s", message: "Unsafe <script>" },
    { time: "2.50s", message: "Missing resource" },
  ]);

  assert.match(container.innerHTML, /<details class="rotation-warnings-wrap">/);
  assert.doesNotMatch(container.innerHTML, /rotation-warnings-wrap" open/);
  assert.match(container.innerHTML, /Warnings \(2\)/);
  assert.match(container.innerHTML, /rotation-warning-time">1\.25s/);
  assert.match(container.innerHTML, /rotation-warning-time">2\.50s/);
  assert.match(container.innerHTML, /Unsafe &lt;script&gt;/);
  assert.doesNotMatch(container.innerHTML, /Unsafe <script>/);
  assert.match(container.innerHTML, /Missing resource/);

  mountRotationWarnings(container, ["Still unsafe"], { open: true });
  assert.match(container.innerHTML, /rotation-warnings-wrap" open/);

  mountRotationWarnings(container, []);
  assert.equal(container.innerHTML, "");
});

test("palette primitives escape values and render state, ammo, cooldowns, and groups", () => {
  const html = paletteSkillHtml({
    name: 'Skill"><bad>',
    skillId: 12345,
    title: 'Title"><bad>',
    icon: 'icon" onerror="bad',
    variantBadge: "<MAX>",
    color: "#abc",
    disabled: true,
    draggable: true,
    cooldownLabel: "<5s",
    ammo: { current: 1, maximum: 2, pips: [true, false] },
    resource: {
      id: "endurance",
      label: "Current endurance: 50/100",
      value: 50,
      maximum: 100,
    },
  });
  assert.match(html, /pal-disabled/);
  assert.match(html, /draggable="false"/);
  assert.match(html, /1\/2/);
  assert.equal((html.match(/pal-ammo-pip filled/g) || []).length, 1);
  assert.match(html, /&lt;5s/);
  assert.match(html, /data-fallback-icon="data:image\/svg\+xml/);
  assert.match(html, /data-skill-id="12345"/);
  assert.match(html, /skill-variant-badge pal-variant-badge/);
  assert.match(html, /pal-has-resource/);
  assert.match(html, /data-resource-id="endurance"/);
  assert.match(html, /style="width:50%"/);
  assert.match(html, /aria-valuenow="50"/);
  assert.match(html, /&lt;MAX&gt;/);
  assert.doesNotMatch(html, /<bad>/);
  assert.doesNotMatch(html, /onerror="bad"/);
  assert.match(
    paletteSkillHtml({ name: "Reserved", concealed: true }),
    /pal-concealed/,
  );

  const virtualView = {
    name: "Wait",
    title: "Wait",
    icon: "wait.png",
  };
  const virtual = virtualPaletteSkillHtml(virtualView);
  assert.match(virtual, /draggable="true"/);
  assert.match(
    paletteGroupHtml({
      label: "<Group>",
      statusIcon: {
        icon: "pet.png",
        label: "Fanged Iboga",
        title: "Active pet: Fanged Iboga",
      },
      skills: [{ ...virtualView, virtual: true }],
    }),
    /&lt;Group&gt;/,
  );
  assert.match(
    paletteGroupHtml({
      label: "Pet",
      statusIcon: {
        icon: "pet.png",
        label: "Fanged Iboga",
        title: "Active pet: Fanged Iboga",
      },
      skills: [virtualView],
    }),
    /Active pet: Fanged Iboga/,
  );
  assert.match(
    paletteGroupHtml({
      id: "resource-controls",
      label: "Resource",
      controls: [
        {
          id: 'resource"><bad>',
          label: "Resource control",
          icon: "resource.png",
          color: "#abc",
          className: "resource-control",
          active: true,
          pressed: true,
          muted: true,
          badge: "S",
        },
      ],
    }),
    /data-palette-group="resource-controls"[\s\S]*class="pal-control resource-control pal-control-active pal-control-pressed pal-control-muted"[\s\S]*data-palette-control-id="resource&quot;&gt;&lt;bad&gt;"[\s\S]*class="pal-control-badge"/,
  );
  assert.match(
    paletteGroupHtml({
      label: "Reserved",
      className: "pal-group-concealed",
      skills: [virtualView],
    }),
    /pal-group pal-group-concealed/,
  );
});

test("palette controls delegate neutral control identities", () => {
  const control = {
    dataset: { paletteControlId: "profession-resource:one" },
    onclick: null,
  };
  let activated = "";
  bindPaletteInteractions(
    {
      querySelectorAll(selector) {
        return selector === ".pal-control[data-palette-control-id]"
          ? [control]
          : [];
      },
    },
    {
      onControlActivate(id) {
        activated = id;
      },
    },
  );

  control.onclick({});
  assert.equal(activated, "profession-resource:one");
});

test("timeline canonical entries update, simplify, insert, and reject invalid moves", () => {
  assert.equal(rotationEntryName("One"), "One");
  assert.equal(rotationEntryName({ name: "Two", offset: 50 }), "Two");
  assert.deepEqual(updateRotationEntry("One", { offset: 100 }), {
    name: "One",
    offset: 100,
  });
  assert.equal(
    removeRotationEntryOptions({ name: "One", offset: 100 }, ["offset"]),
    "One",
  );
  assert.equal(
    updateRotationEntry(
      { name: "One", interruptMs: 250 },
      {
        interruptMs: undefined,
      },
    ),
    "One",
  );

  const rotation = ["A", "B", "C"];
  assert.equal(moveRotationEntry(rotation, 0, 3), true);
  assert.deepEqual(rotation, ["B", "C", "A"]);
  assert.equal(moveRotationEntry(rotation, 1, 2), false);
  assert.equal(moveRotationEntry(rotation, -1, 1), false);
  assert.equal(moveRotationEntry(rotation, 0, 1.5), false);
  assert.equal(insertRotationEntry(rotation, "D", 1), true);
  assert.deepEqual(rotation, ["B", "D", "C", "A"]);
  assert.equal(
    insertRotationEntries(rotation, ["Macro A", "Macro B"], 2),
    true,
  );
  assert.deepEqual(rotation, ["B", "D", "Macro A", "Macro B", "C", "A"]);
  assert.equal(insertRotationEntries(rotation, [], 0), false);
});

test("timeline binding inserts palette entries and drop positions use tile halves", () => {
  let dragState = { source: "palette", name: "New", skillId: 12345 };
  let changes = 0;
  const rotation = ["A"];
  const root = {
    classList: { add() {}, remove() {} },
    querySelectorAll: () => [],
  };
  const binding = bindTimelineInteractions(root, {
    rotation,
    getDragState: () => dragState,
    setDragState: (value) => {
      dragState = value;
    },
    resolvePaletteEntry: (name, drag) => ({
      name,
      skillId: drag.skillId,
      waitMs: 100,
    }),
    onChanged: () => {
      changes += 1;
    },
  });
  assert.equal(binding.applyDrop(1), true);
  assert.deepEqual(rotation, [
    "A",
    { name: "New", skillId: 12345, waitMs: 100 },
  ]);
  assert.equal(dragState, null);
  assert.equal(changes, 1);

  dragState = { source: "palette", name: "Macro" };
  const macroBinding = bindTimelineInteractions(root, {
    rotation,
    getDragState: () => dragState,
    setDragState: (value) => {
      dragState = value;
    },
    resolvePaletteEntry: () => [
      { name: "Auto", skillId: 10 },
      { name: "Dodge", skillId: -5, offset: 0 },
    ],
    onChanged: () => {
      changes += 1;
    },
  });
  assert.equal(macroBinding.applyDrop(1), true);
  assert.deepEqual(rotation, [
    "A",
    { name: "Auto", skillId: 10 },
    { name: "Dodge", skillId: -5, offset: 0 },
    { name: "New", skillId: 12345, waitMs: 100 },
  ]);
  assert.equal(dragState, null);
  assert.equal(changes, 2);

  const tile = {
    dataset: { idx: "3" },
    getBoundingClientRect: () => ({ left: 10, width: 40 }),
  };
  assert.equal(getSkillDropInsertionIndex(tile, 20), 3);
  assert.equal(getSkillDropInsertionIndex(tile, 31), 4);
  assert.equal(getSkillDropInsertionIndex({ dataset: {} }, 0), null);
  assert.equal(getSkillDropInsertionIndex({ dataset: { idx: "" } }, 0), null);
});

test("event logs order stably and CSV escapes cells", () => {
  const rows = eventLogRows({
    events: [
      { type: "proc", at: 1, name: "Later" },
      { type: "action", at: 1, name: "First" },
      { type: "action", at: 0, name: 'Quote "skill"' },
    ],
  });
  assert.deepEqual(
    rows.map((row) => row.description),
    ['CAST Quote "skill"', "CAST First", "PROC Later"],
  );
  assert.match(eventLogCsv(rows), /"CAST Quote ""skill"""/);
  assert.equal(eventLogRows({ events: [] }).length, 0);
});

test("event-log mounting filters rows, escapes descriptions, and configures filename", () => {
  let html = "";
  let mounted = false;
  const container = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      mounted = true;
    },
    querySelector(selector) {
      if (!mounted && selector.includes("event-log-details"))
        return { open: true };
      return null;
    },
    querySelectorAll(selector) {
      if (!mounted && selector.includes(":checked")) {
        return [{ dataset: { filterId: "kept" } }];
      }
      return [];
    },
  };
  mountEventLog(
    container,
    [
      { at: 0, type: "one", description: "Keep <safe>", keep: true },
      { at: 1, type: "two", description: "Drop me", keep: false },
    ],
    {
      filename: 'custom"name.csv',
      filters: [
        {
          id: "kept",
          label: "Kept only",
          predicate: (row) => row.keep,
        },
      ],
    },
  );

  assert.match(html, /Keep &lt;safe&gt;/);
  assert.doesNotMatch(html, /Drop me/);
  assert.match(html, /data-filename="custom&quot;name\.csv"/);
  assert.match(html, /log-filter-kept/);
});
