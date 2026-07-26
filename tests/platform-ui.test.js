import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChartSeries,
  chartValueAt,
  mountTimeSeriesCharts,
} from "../js/platform/ui/charts.js";
import {
  eventLogCsv,
  eventLogRows,
  mountEventLog,
} from "../js/platform/ui/event-log.js";
import {
  paletteGroupHtml,
  paletteSkillHtml,
  virtualPaletteSkillHtml,
} from "../js/platform/ui/palette.js";
import {
  escapeHtml,
  gw2ApiText,
} from "../js/platform/ui/html.js";
import {
  mountRotationResults,
  nextResultSortState,
  SKILL_COLS,
  sortResultRows,
} from "../js/platform/ui/rotation-results.js";
import {
  bindTimelineInteractions,
  getSkillDropInsertionIndex,
  insertRotationEntry,
  moveRotationEntry,
  removeRotationEntryOptions,
  rotationEntryName,
  updateRotationEntry,
} from "../js/platform/ui/timeline.js";

function inertContainer() {
  return {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

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

  assert.equal(series.durationMs, 2000);
  assert.equal(series.dps[0].v, 0);
  assert.equal(series.dps[1].v, 300);
  assert.equal(series.dps.at(-1).v, 400 / 1.5);
  assert.equal(series.effects["Effect <burn>"][1].v, 2);
  assert.equal(series.effects["Effect <power>"][0].v, 2);
});

test("shared chart markup escapes effect names and uses scoped roles without ids", () => {
  const container = inertContainer();
  mountTimeSeriesCharts(container, {
    durationMs: 1000,
    dps: [{ t: 0, v: 0 }],
    effects: { 'Bad"><img src=x>': [{ t: 0, v: 1 }] },
  });
  assert.match(container.innerHTML, /data-role="dps-canvas"/);
  assert.match(container.innerHTML, /Bad&quot;&gt;&lt;img src=x&gt;/);
  assert.doesNotMatch(container.innerHTML, /\sid="/);
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

test("shared results render summaries, totals, contributions, warnings, and icons", () => {
  const container = inertContainer();
  const resolved = [];
  mountRotationResults(container, {
    metrics: [{ label: "DPS", value: "1,234", className: "dps" }],
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
    contributions: [{ name: "Bonus", dpsIncrease: 12, pctIncrease: 1.5 }],
    warnings: ["Unsafe <script>"],
  }, {
    resolveSkillIcon: row => {
      resolved.push(row.name);
      return `icon-${row.name}.png`;
    },
  });

  assert.match(container.innerHTML, /res-summary/);
  assert.ok(container.innerHTML.indexOf("High") < container.innerHTML.indexOf("Low"));
  assert.match(container.innerHTML, /Total Conditions/);
  assert.match(container.innerHTML, /\+12/);
  assert.match(container.innerHTML, /\+1\.50%/);
  assert.match(container.innerHTML, /Unsafe &lt;script&gt;/);
  assert.doesNotMatch(container.innerHTML, /Unsafe <script>/);
  assert.deepEqual(resolved, ["High", "Low"]);

  assert.doesNotThrow(() => mountRotationResults(inertContainer(), {}));
});

test("palette primitives escape values and render state, ammo, cooldowns, and groups", () => {
  const html = paletteSkillHtml({
    name: 'Skill"><bad>',
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
  assert.doesNotMatch(html, /<bad>/);
  assert.doesNotMatch(html, /onerror="bad"/);

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
});

test("timeline binding inserts palette entries and drop positions use tile halves", () => {
  let dragState = { source: "palette", name: "New" };
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
    resolvePaletteEntry: name => ({ name, waitMs: 100 }),
    onChanged: () => {
      changes += 1;
    },
  });
  assert.equal(binding.applyDrop(1), true);
  assert.deepEqual(rotation, ["A", { name: "New", waitMs: 100 }]);
  assert.equal(dragState, null);
  assert.equal(changes, 1);

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
