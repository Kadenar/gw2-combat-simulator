import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChartSeries,
  buildPhaseDpsSeries,
  chartValueAt,
  mountTimeSeriesCharts,
} from "../../../js/platform/ui/charts.js";
import {
  eventLogCsv,
  eventLogRows,
  mountEventLog,
} from "../../../js/platform/ui/event-log.js";
import {
  paletteGroupHtml,
  paletteSkillHtml,
  virtualPaletteSkillHtml,
} from "../../../js/platform/ui/palette.js";
import {
  escapeHtml,
  gw2ApiText,
} from "../../../js/platform/ui/html.js";
import {
  targetHealthBreakpointSnapshots,
} from "../../../js/platform/ui/result-transform.js";
import {
  mountRotationWarnings,
  mountRotationResults,
  nextResultSortState,
  SKILL_COLS,
  sortResultRows,
} from "../../../js/platform/ui/rotation-results.js";
import {
  bindTimelineInteractions,
  formatTimelineCastDetails,
  formatTimelineSkillTooltip,
  getSkillDropInsertionIndex,
  insertRotationEntry,
  insertRotationEntries,
  moveRotationEntry,
  removeRotationEntryOptions,
  rotationEntryName,
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

test("timeline cast details include start, end, and elapsed cast time", () => {
  assert.equal(
    formatTimelineCastDetails(
      { start: 1250, end: 2010 },
      time => `${(time / 1000).toFixed(2)}s`,
    ),
    "Cast: 1.25s → 2.01s\nCast time: 0.76s",
  );
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
      time => `${(time / 1000).toFixed(3)}s`,
    ),
    "Well of Darkness at 2.500s for 481ms\n"
      + "Well of Darkness cast 2 of 3\n"
      + "Skill cast 3 of 4",
  );
  assert.equal(ordinals.has(1), false);
  assert.equal(ordinals.has(5), false);
});

test("GW2 API text removes presentation tags for native tooltips", () => {
  const description = "<c=@abilitytype>Stances</c> grant protection.<br><c=@reminder>Once per interval.</c>";
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
  assert.equal(chartValueAt([{ t: 0, v: 1 }, { t: 100, v: 4 }], 99), 1);
  assert.equal(chartValueAt([{ t: 0, v: 1 }, { t: 100, v: 4 }], 100), 4);

  const series = buildChartSeries({
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
    events: [
      { type: "buff", at: 0, kind: "power", duration: 2, stacks: 2 },
    ],
  }, 1000, {
    effectName: value => `Effect <${value}>`,
    stackCaps: { "Effect <burn>": 2 },
  });

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
  const snapshots = targetHealthBreakpointSnapshots({
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
  }, 1000);

  assert.deepEqual(
    snapshots.map(snapshot => snapshot.healthPercent),
    [80, 60, 40, 20],
  );
  assert.deepEqual(
    snapshots.map(snapshot => snapshot.elapsed),
    [0.5, 1, 1, 1.5],
  );
  assert.deepEqual(
    snapshots.map(snapshot => snapshot.damage),
    [250, 650, 650, 850],
  );
  assert.deepEqual(
    snapshots.map(snapshot => snapshot.dps),
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

test("shared chart markup escapes effect names and uses scoped roles without ids", () => {
  const container = inertContainer();
  mountTimeSeriesCharts(container, {
    durationMs: 1000,
    dps: [{ t: 0, v: 0 }],
    effects: { 'Bad"><img src=x>': [{ t: 0, v: 1 }] },
    cumulativeDamage: [
      { t: 0, v: 0 },
      { t: 1000, v: 1000 },
    ],
  }, {
    healthBreakpoints: [
      { healthPercent: 80, elapsed: 0.2, damage: 200 },
      { healthPercent: 60, elapsed: 0.4, damage: 400 },
      { healthPercent: 40, elapsed: 0.6, damage: 600 },
      { healthPercent: 20, elapsed: 0.8, damage: 800 },
    ],
  });
  assert.match(container.innerHTML, /data-role="dps-canvas"/);
  assert.match(container.innerHTML, /Bad&quot;&gt;&lt;img src=x&gt;/);
  assert.match(container.innerHTML, /data-role="chart-phase-toggles"/);
  assert.match(container.innerHTML, /Full Fight/);
  assert.deepEqual(
    [...container.innerHTML.matchAll(/data-chart-phase="([^"]+)"/g)]
      .map(match => match[1]),
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
    querySelector: selector =>
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
  assert.deepEqual(SKILL_COLS.map(column => column.key), [
    "name",
    "strike",
    "condition",
    "total",
    "dps",
    "average",
    "dct",
    "casts",
    "hits",
  ]);
  const rows = [
    { name: "Beta", total: 20, dps: 5 },
    { name: "Alpha", total: 10, dps: 8 },
  ];
  const columns = [
    { key: "name", numeric: false },
    { key: "dps", numeric: true },
  ];
  assert.deepEqual(
    sortResultRows(rows, columns, null, null).map(row => row.name),
    ["Beta", "Alpha"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "dps", "asc").map(row => row.name),
    ["Beta", "Alpha"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "dps", "desc").map(row => row.name),
    ["Alpha", "Beta"],
  );
  assert.deepEqual(
    sortResultRows(rows, columns, "name", "asc").map(row => row.name),
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
  mountRotationResults(container, {
    metrics: [{ label: "DPS", value: "1,234", className: "dps" }],
    breakpoints: [
      { healthPercent: 80, dps: 1234, elapsed: 3.25 },
    ],
    skillColumns: [
      { key: "name", label: "Skill", numeric: false },
      { key: "total", label: "Total", numeric: true },
    ],
    skillRows: [
      { name: "Low", total: 10 },
      { name: "High", total: 20 },
    ],
    conditions: [{ name: "Burn <hot>", damage: 25, dps: 5, averageStacks: 1.25 }],
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
          },
        ],
      },
    },
  }, {
    resolveSkillIcon: row => {
      resolved.push(row.name);
      return `icon-${row.name}.png`;
    },
  });

  assert.match(container.innerHTML, /res-summary/);
  assert.match(container.innerHTML, /DPS snapshots/);
  assert.match(container.innerHTML, /80%<\/b> target health/);
  assert.match(container.innerHTML, />1,234</);
  assert.match(container.innerHTML, /at 3\.25s/);
  assert.ok(container.innerHTML.indexOf("High") < container.innerHTML.indexOf("Low"));
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
  assert.match(container.innerHTML, /500 outcomes per run/);
  assert.match(container.innerHTML, /Very unlucky/);
  assert.match(container.innerHTML, /P1 DPS/);
  assert.match(container.innerHTML, /Very lucky/);
  assert.match(container.innerHTML, /P99 DPS/);
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
  assert.match(container.innerHTML, /Highest-DPS group: 25\.4 average per simulation/);
  assert.match(container.innerHTML, /Lowest-DPS group: 18\.2 average per simulation/);
  assert.match(container.innerHTML, /\+7\.2/);
  assert.match(container.innerHTML, /difference/);
  assert.match(container.innerHTML, /averages across each group/);
  assert.match(container.innerHTML, /do not add them together/);
  assert.ok(
    container.innerHTML.indexOf("DPS snapshots")
    < container.innerHTML.indexOf("Simulation RNG distribution"),
  );
  assert.deepEqual(resolved, ["High", "Low"]);

  assert.doesNotThrow(() => mountRotationResults(inertContainer(), {}));
});

test("skill damage rows group player damage before owned entities", () => {
  const container = inertContainer();
  mountRotationResults(container, {
    skillColumns: [
      { key: "name", label: "Skill", numeric: false },
      { key: "total", label: "Total", numeric: true },
    ],
    skillRows: [
      { name: "Player Low", total: 10, group: "Player" },
      { name: "Entity High", total: 100, group: "Entities" },
      { name: "Player High", total: 20, group: "Player" },
      { name: "Entity Low", total: 50, group: "Entities" },
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
  assert.match(html, /30 total/);
  assert.match(html, /150 total/);
});

test("RNG distribution waits for its manual run button", () => {
  const runButton = {};
  const container = {
    ...inertContainer(),
    querySelector: selector =>
      selector === '[data-role="rng-run"]' ? runButton : null,
  };
  let runCount = 0;
  mountRotationResults(container, {
    metrics: [],
    randomDistributionRequested: true,
    randomDistributionTrials: 500,
  }, {
    onRunRandomDistribution() {
      runCount += 1;
    },
  });

  assert.match(container.innerHTML, /Run the distribution when the rotation is ready/);
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

  assert.match(
    container.innerHTML,
    /<details class="rotation-warnings-wrap">/,
  );
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
    color: "#abc",
    disabled: true,
    draggable: true,
    cooldownLabel: "<5s",
    ammo: { current: 1, maximum: 2, pips: [true, false] },
  });
  assert.match(html, /pal-disabled/);
  assert.match(html, /draggable="false"/);
  assert.match(html, /1\/2/);
  assert.equal((html.match(/pal-ammo-pip filled/g) || []).length, 1);
  assert.match(html, /&lt;5s/);
  assert.match(html, /data-fallback-icon="data:image\/svg\+xml/);
  assert.match(html, /data-skill-id="12345"/);
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
      skills: [{ ...virtualView, virtual: true }],
    }),
    /&lt;Group&gt;/,
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
  assert.deepEqual(
    rotation,
    ["B", "D", "Macro A", "Macro B", "C", "A"],
  );
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
    setDragState: value => {
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
    setDragState: value => {
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
  assert.deepEqual(rows.map(row => row.description), [
    'CAST Quote "skill"',
    "CAST First",
    "PROC Later",
  ]);
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
      if (!mounted && selector.includes("event-log-details")) return { open: true };
      return null;
    },
    querySelectorAll(selector) {
      if (!mounted && selector.includes(":checked")) {
        return [{ dataset: { filterId: "kept" } }];
      }
      return [];
    },
  };
  mountEventLog(container, [
    { at: 0, type: "one", description: "Keep <safe>", keep: true },
    { at: 1, type: "two", description: "Drop me", keep: false },
  ], {
    filename: 'custom"name.csv',
    filters: [{
      id: "kept",
      label: "Kept only",
      predicate: row => row.keep,
    }],
  });

  assert.match(html, /Keep &lt;safe&gt;/);
  assert.doesNotMatch(html, /Drop me/);
  assert.match(html, /data-filename="custom&quot;name\.csv"/);
  assert.match(html, /log-filter-kept/);
});
