import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import {
  analyzePreparedEvtc,
  prepareEvtcAnalysis,
} from "../../js/evtc-analyzer/analyze.js";
import {
  decompressEvtcInput,
  EVTC_FILE_LIMITS,
} from "../../js/evtc-analyzer/decompression.js";
import { EvtcError } from "../../js/evtc-analyzer/errors.js";
import { analyzeGenericCombat } from "../../js/evtc-analyzer/generic-analysis.js";
import { parseEvtc } from "../../js/evtc-analyzer/parser.js";
import { detectPlayers } from "../../js/evtc-analyzer/player-detection.js";
import { EvtcAnalysisContext } from "../../js/evtc-analyzer/context.js";
import { bindEvtcAnalyzer } from "../../js/evtc-analyzer/ui.js";
import { validateGolemEncounter } from "../../js/evtc-analyzer/validation.js";
import {
  ADDRESSES,
  buildEvtc,
  buildZip,
  combatEvent,
  golemAgent,
  playerAgent,
} from "./fixture-builder.js";

async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error instanceof EvtcError, true);
    assert.equal(error.code, code);
    return true;
  });
}

async function analysisFor(events, options = {}) {
  const prepared = await prepareEvtcAnalysis(buildEvtc({ events, ...options }));
  return analyzePreparedEvtc(prepared);
}

function fields(result) {
  return Object.fromEntries(
    result.profession[0].sections[0].fields.map((field) => [
      field.label,
      field.value,
    ]),
  );
}

test("parses a valid uncompressed EVTC with complete records", () => {
  const log = parseEvtc(buildEvtc());
  assert.equal(log.header.magic, "EVTC");
  assert.equal(log.header.revision, 1);
  assert.equal(log.header.encounterId, 16199);
  assert.equal(log.agents.length, 2);
  assert.equal(log.skills.length, 4);
  assert.equal(log.events.length, 3);
});

test("expands deflate ZIP and zevtc-compatible inputs in the browser adapter", async () => {
  const evtc = buildEvtc();
  for (const fileName of ["fixture.evtc.zip", "fixture.zevtc"]) {
    const expanded = await decompressEvtcInput(buildZip(evtc, { fileName }));
    assert.deepEqual(Buffer.from(expanded), evtc);
    assert.equal(parseEvtc(expanded).header.encounterId, 16199);
  }
  assert.deepEqual(
    Buffer.from(await decompressEvtcInput(buildZip(evtc, { method: 0 }))),
    evtc,
  );
});

test("rejects invalid magic and unknown EVTC revisions", () => {
  const invalid = buildEvtc();
  invalid.write("NOPE", 0, "ascii");
  assert.throws(() => parseEvtc(invalid), { code: "INVALID_MAGIC" });
  assert.throws(() => parseEvtc(buildEvtc({ revision: 2 })), {
    code: "UNSUPPORTED_REVISION",
  });
});

test("rejects truncated header, agent, skill, and combat-event records", () => {
  assert.throws(() => parseEvtc(buildEvtc().subarray(0, 10)), {
    code: "TRUNCATED_HEADER",
  });
  const agents = buildEvtc();
  assert.throws(() => parseEvtc(agents.subarray(0, 40)), {
    code: "TRUNCATED_AGENTS",
  });
  const skills = buildEvtc({ agents: [] });
  assert.throws(() => parseEvtc(skills.subarray(0, 24 + 10)), {
    code: "TRUNCATED_SKILLS",
  });
  assert.throws(
    () => parseEvtc(Buffer.concat([buildEvtc(), Buffer.from([1])])),
    { code: "TRUNCATED_EVENTS" },
  );
});

test("rejects unsupported ZIP compression and dangerous declared expansion", async () => {
  const evtc = buildEvtc();
  await rejectsCode(
    () => decompressEvtcInput(buildZip(evtc, { method: 12 })),
    "UNSUPPORTED_COMPRESSION",
  );
  await rejectsCode(
    () =>
      decompressEvtcInput(
        buildZip(evtc, {
          method: 0,
          declaredExpandedSize: EVTC_FILE_LIMITS.maximumExpandedBytes + 1,
        }),
      ),
    "EXPANDED_SIZE_EXCEEDED",
  );
});

test("rejects non-golem encounters and accepts numeric training-golem targets", () => {
  const unsupported = parseEvtc(buildEvtc({ encounterId: 12345 }));
  assert.throws(() => validateGolemEncounter(unsupported), {
    code: "UNSUPPORTED_ENCOUNTER",
    message:
      "This analyzer currently supports Special Forces Training Area golem logs only.",
  });
  const supported = validateGolemEncounter(parseEvtc(buildEvtc()));
  assert.equal(supported.golem.speciesId, 16199);
  assert.equal(supported.mapId, 1154);
  assert.equal(supported.targetAddress, ADDRESSES.golem);
});

test("detects core, elite, and unknown specializations without crashing", () => {
  for (const [elite, expected] of [
    [0, "core"],
    [64, "harbinger"],
    [999, "unknown"],
  ]) {
    const log = parseEvtc(
      buildEvtc({ agents: [playerAgent({ elite }), golemAgent()] }),
    );
    const selection = detectPlayers(log, validateGolemEncounter(log));
    assert.equal(selection.selected.professionId, "necromancer");
    assert.equal(selection.selected.specializationId, expected);
  }
});

test("returns a player selection result when multiple players deal meaningful damage", () => {
  const second = playerAgent({
    address: ADDRESSES.secondPlayer,
    profession: 2,
    elite: 18,
    character: "Fixture Warrior",
    account: ":Second.0000",
  });
  const log = parseEvtc(
    buildEvtc({
      agents: [playerAgent(), second, golemAgent()],
      events: [
        combatEvent({ time: 1_000 }),
        combatEvent({
          time: 1_500,
          source: ADDRESSES.secondPlayer,
          sourceInstance: 3,
          value: 700,
        }),
        combatEvent({ time: 2_000 }),
      ],
    }),
  );
  const selection = detectPlayers(log, validateGolemEncounter(log));
  assert.equal(selection.kind, "selection-required");
  assert.equal(selection.players.length, 2);
  assert.deepEqual(
    selection.players.map((player) => player.professionId).sort(),
    ["necromancer", "warrior"],
  );
});

test("collects legacy and explicit CBTS_BUFFAPPLY condition applications", async () => {
  for (const [revision, stateChange] of [
    [0, 0],
    [1, 69],
  ]) {
    const result = await analysisFor(
      [
        combatEvent({ time: 1_000, result: 1 }),
        combatEvent({
          time: 1_000,
          value: 3_600,
          skillId: 736,
          buff: 1,
          stateChange,
        }),
        combatEvent({ time: 2_000 }),
      ],
      { revision },
    );
    assert.equal(result.generic.outgoingApplications.length, 1);
    assert.equal(result.generic.outgoingApplications[0].applications, 1);
  }
});

test("generic analysis counts critical rolls, non-critical rolls, and final damage distributions", () => {
  const log = parseEvtc(
    buildEvtc({
      events: [
        combatEvent({ time: 1_000, value: 1_200, result: 1 }),
        combatEvent({ time: 2_000, value: 800, result: 0 }),
        combatEvent({
          time: 2_500,
          value: 0,
          buffDamage: 500,
          buff: 1,
          skillId: 736,
        }),
      ],
    }),
  );
  const encounter = validateGolemEncounter(log);
  const player = detectPlayers(log, encounter).selected;
  const stats = analyzeGenericCombat(
    new EvtcAnalysisContext(log, encounter, player),
  );
  assert.equal(stats.connectedStrikeHits, 2);
  assert.equal(stats.criticalHits, 1);
  assert.equal(stats.nonCriticalHits, 1);
  assert.equal(stats.totalOutgoingStrikeDamage, 2_000);
  assert.equal(stats.totalOutgoingConditionDamage, 500);
  assert.deepEqual(stats.perSkill[0].criticalDamageRolls.samples, [1_200]);
  assert.deepEqual(stats.perSkill[0].nonCriticalDamageRolls.samples, [800]);
  assert.equal(stats.weaponStrength.status, "unavailable");
  assert.ok(stats.weaponStrength.missingInputs.includes("player Power"));
});

test("generic analysis derives actions-per-minute from casts and weapon swaps", () => {
  const log = parseEvtc(
    buildEvtc({
      events: [
        combatEvent({ time: 1_000, value: 1_000 }),
        combatEvent({ time: 2_000, activation: 3, value: 500, skillId: 100 }),
        combatEvent({ time: 3_000, activation: 3, value: 500, skillId: 736 }),
        combatEvent({ time: 4_000, stateChange: 11, target: 4n }),
        combatEvent({ time: 61_000, value: 1_000 }),
      ],
    }),
  );
  const encounter = validateGolemEncounter(log);
  const player = detectPlayers(log, encounter).selected;
  const { actionsPerMinute } = analyzeGenericCombat(
    new EvtcAnalysisContext(log, encounter, player),
  );
  assert.equal(actionsPerMinute.castCount, 2);
  assert.equal(actionsPerMinute.weaponSwapCount, 1);
  assert.equal(actionsPerMinute.totalActions, 3);
  assert.equal(actionsPerMinute.durationMs, 60_000);
  assert.equal(actionsPerMinute.castApm, 2);
  assert.equal(actionsPerMinute.apm, 3);
});

test("Barbed Precision reports exact classification for an isolated matching application", async () => {
  const result = await analysisFor([
    combatEvent({ time: 1_000, result: 1 }),
    combatEvent({
      time: 1_000,
      value: 3_600,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({ time: 2_000 }),
  ]);
  const section = result.profession[0].sections[0];
  assert.equal(section.status, "exact");
  assert.equal(fields(result)["Observed candidate procs"], 1);
  assert.equal(fields(result)["Minimum possible procs"], 1);
  assert.equal(fields(result)["Maximum possible procs"], 1);
});

test("Barbed Precision excludes Bleeding from a known direct skill", async () => {
  const result = await analysisFor([
    combatEvent({ time: 1_000, result: 1, skillId: 10529 }),
    combatEvent({
      time: 1_000,
      value: 3_600,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({ time: 2_000 }),
  ]);
  assert.equal(fields(result)["Observed candidate procs"], 0);
  assert.match(
    result.profession[0].sections[0].evidence.join(" "),
    /1 applications excluded by known direct/,
  );
});

test("Barbed Precision derives a stable duration cohort and keeps it beside direct Bleeding", async () => {
  const events = [];
  for (const time of [1_000, 2_000, 3_000]) {
    events.push(
      combatEvent({ time, result: 1 }),
      combatEvent({
        time,
        value: 6_000,
        skillId: 736,
        buff: 1,
        stateChange: 69,
      }),
    );
  }
  events.push(
    combatEvent({ time: 4_000, result: 1, skillId: 10529 }),
    combatEvent({
      time: 4_000,
      value: 6_000,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({
      time: 4_000,
      value: 20_000,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
  );
  const result = await analysisFor(events);
  const section = result.profession[0].sections[0];
  assert.equal(section.status, "inferred");
  assert.equal(fields(result)["Observed candidate procs"], 4);
  assert.equal(fields(result)["Minimum possible procs"], 4);
  assert.equal(fields(result)["Maximum possible procs"], 4);
  assert.equal(fields(result)["Observed proc rate"], "100.00%");
  assert.match(section.evidence.join(" "), /stable 6\.0s candidate duration/);
});

test("Barbed Precision excludes durations outside a derived trait signature", async () => {
  const events = [];
  for (const time of [1_000, 2_000, 3_000]) {
    events.push(
      combatEvent({ time, result: 1 }),
      combatEvent({
        time,
        value: 6_000,
        skillId: 736,
        buff: 1,
        stateChange: 69,
      }),
      ...Array.from({ length: 4 }, () =>
        combatEvent({
          time,
          value: 8_000,
          skillId: 736,
          buff: 1,
          stateChange: 69,
        }),
      ),
    );
  }
  const result = await analysisFor(events);
  const section = result.profession[0].sections[0];
  assert.equal(section.status, "inferred");
  assert.equal(fields(result)["Observed candidate procs"], 3);
  assert.equal(fields(result)["Observed proc rate"], "100.00%");
  assert.match(
    section.evidence.join(" "),
    /12 applications excluded because their duration did not match/,
  );
});

test("Barbed Precision bounds condition-transfer collisions", async () => {
  const result = await analysisFor([
    combatEvent({ time: 1_000, result: 1 }),
    combatEvent({
      time: 1_000,
      value: 0,
      skillId: 10705,
      activation: 3,
    }),
    combatEvent({
      time: 1_000,
      value: 3_600,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({ time: 2_000 }),
  ]);
  assert.equal(result.profession[0].sections[0].status, "ambiguous");
  assert.equal(fields(result)["Minimum possible procs"], 0);
  assert.equal(fields(result)["Maximum possible procs"], 1);
  assert.equal(fields(result)["Observed proc rate"], "0.00%–100.00%");
  assert.equal(
    fields(result)["Difference from expectation"],
    "-0.33 procs to +0.67 procs",
  );
});

test("Barbed Precision bounds multiple same-timestamp applications to one proc", async () => {
  const application = combatEvent({
    time: 1_000,
    value: 3_600,
    skillId: 736,
    buff: 1,
    stateChange: 69,
  });
  const result = await analysisFor([
    combatEvent({ time: 1_000, result: 1 }),
    application,
    { ...application },
    combatEvent({ time: 2_000 }),
  ]);
  assert.equal(result.profession[0].sections[0].status, "ambiguous");
  assert.equal(fields(result)["Minimum possible procs"], 0);
  assert.equal(fields(result)["Maximum possible procs"], 1);
  assert.equal(fields(result)["Ambiguous events"], 2);
  assert.equal(fields(result)["Observed proc rate"], "0.00%–100.00%");
});

test("Barbed Precision never allows more than one ambiguous proc per critical hit", async () => {
  const application = combatEvent({
    time: 1_000,
    value: 5_000,
    skillId: 736,
    buff: 1,
    stateChange: 69,
  });
  const result = await analysisFor([
    combatEvent({ time: 1_000, result: 1 }),
    application,
    { ...application },
    combatEvent({ time: 2_000 }),
  ]);
  assert.equal(fields(result)["Minimum possible procs"], 0);
  assert.equal(fields(result)["Maximum possible procs"], 1);
  assert.equal(fields(result)["Observed proc rate"], "0.00%–100.00%");
});

function engineerAnalysisFor(events) {
  return analysisFor(events, {
    agents: [
      playerAgent({ profession: 3, elite: 0, character: "Fixture Engineer" }),
      golemAgent(),
    ],
  });
}

function sectionFields(section) {
  return Object.fromEntries(
    section.fields.map((field) => [field.label, field.value]),
  );
}

test("Engineer loads Shrapnel and Serrated Steel sections", async () => {
  const result = await engineerAnalysisFor([
    combatEvent({ time: 1_000, skillId: 5806, result: 0 }),
    combatEvent({ time: 2_000 }),
  ]);
  assert.equal(result.player.professionId, "engineer");
  assert.deepEqual(
    result.profession[0].sections.map((section) => section.title),
    ["Shrapnel", "Serrated Steel"],
  );
});

test("Engineer Shrapnel classifies an isolated explosion Bleeding without a crit", async () => {
  const result = await engineerAnalysisFor([
    combatEvent({ time: 1_000, skillId: 5806, result: 0 }),
    combatEvent({
      time: 1_000,
      value: 6_000,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({ time: 2_000 }),
  ]);
  const [shrapnel, serrated] = result.profession[0].sections;
  const shrapnelFields = sectionFields(shrapnel);
  assert.equal(shrapnel.status, "exact");
  assert.equal(shrapnelFields["Eligible explosion hits"], 1);
  assert.equal(shrapnelFields["Observed candidate procs"], 1);
  assert.equal(shrapnelFields["Minimum possible procs"], 1);
  assert.equal(shrapnelFields["Maximum possible procs"], 1);
  // The non-critical explosion cannot proc Serrated Steel.
  assert.equal(sectionFields(serrated)["Eligible critical hits"], 0);
  assert.equal(sectionFields(serrated)["Observed candidate procs"], 0);
});

test("Engineer Serrated Steel classifies an isolated critical Bleeding", async () => {
  const result = await engineerAnalysisFor([
    combatEvent({ time: 1_000, result: 1 }),
    combatEvent({
      time: 1_000,
      value: 3_990,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({ time: 2_000 }),
  ]);
  const [shrapnel, serrated] = result.profession[0].sections;
  const serratedFields = sectionFields(serrated);
  assert.equal(serrated.status, "exact");
  assert.equal(serratedFields["Eligible critical hits"], 1);
  assert.equal(serratedFields["Observed candidate procs"], 1);
  // A non-explosion crit cannot proc Shrapnel.
  assert.equal(sectionFields(shrapnel)["Eligible explosion hits"], 0);
  assert.equal(sectionFields(shrapnel)["Observed candidate procs"], 0);
});

test("Engineer Shrapnel excludes Bleeding from a known direct skill", async () => {
  const result = await engineerAnalysisFor([
    combatEvent({ time: 1_000, skillId: 5806, result: 0 }),
    combatEvent({ time: 1_000, skillId: 10661, result: 0 }),
    combatEvent({
      time: 1_000,
      value: 6_000,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({ time: 2_000 }),
  ]);
  const [shrapnel] = result.profession[0].sections;
  assert.equal(sectionFields(shrapnel)["Observed candidate procs"], 0);
  assert.match(
    shrapnel.evidence.join(" "),
    /1 applications excluded by known direct/,
  );
});

test("Engineer bounds a Bleeding that fits both Shrapnel and Serrated Steel", async () => {
  const result = await engineerAnalysisFor([
    combatEvent({ time: 1_000, skillId: 5806, result: 1 }),
    combatEvent({
      time: 1_000,
      value: 6_000,
      skillId: 736,
      buff: 1,
      stateChange: 69,
    }),
    combatEvent({ time: 2_000 }),
  ]);
  const [shrapnel, serrated] = result.profession[0].sections;
  assert.equal(shrapnel.status, "ambiguous");
  assert.equal(serrated.status, "ambiguous");
  for (const section of [shrapnel, serrated]) {
    const values = sectionFields(section);
    assert.equal(values["Minimum possible procs"], 0);
    assert.equal(values["Maximum possible procs"], 1);
  }
});

test("worker request and terminal analysis results are structured-clone serializable", async () => {
  const source = buildEvtc();
  const buffer = source.buffer.slice(
    source.byteOffset,
    source.byteOffset + source.byteLength,
  );
  const request = {
    type: "analyze",
    requestId: 7,
    fileName: "fixture.zevtc",
    buffer,
  };
  const cloned = structuredClone(request, { transfer: [buffer] });
  assert.equal(buffer.byteLength, 0);
  const prepared = await prepareEvtcAnalysis(cloned.buffer);
  const result = await analyzePreparedEvtc(prepared);
  assert.doesNotThrow(() =>
    structuredClone({
      type: "analysis",
      requestId: 7,
      result,
    }),
  );
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.equal(JSON.stringify(result).includes(":Fixture.0000"), false);
});

test("home-page analyzer exposes accessible drop and file-picker behavior", async () => {
  const [page, ui] = await Promise.all([
    readFile(new URL("../../index.html", import.meta.url), "utf8"),
    readFile(new URL("../../js/evtc-analyzer/ui.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Log analysis/);
  assert.match(page, /data-evtc-dropzone/);
  assert.match(page, /role="button"\s+tabindex="0"/);
  assert.match(page, /data-evtc-input/);
  assert.match(ui, /addEventListener\("drop"/);
  assert.match(ui, /addEventListener\("change"/);
  assert.match(ui, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(ui, /postMessage\([\s\S]*\[buffer\]/);
});

test("UI bindings transfer files from drop, keyboard, and picker interactions", async () => {
  class FakeElement {
    constructor() {
      this.hidden = false;
      this.dataset = {};
      this.value = "";
      this.files = [];
      this.listeners = new Map();
      this.attributes = new Map();
      this.children = new Map();
      this.clicks = 0;
      const classes = new Set();
      this.classList = {
        add: (value) => classes.add(value),
        remove: (value) => classes.delete(value),
      };
    }

    querySelector(selector) {
      return this.children.get(selector) || null;
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    dispatch(type, event = {}) {
      for (const listener of this.listeners.get(type) || []) listener(event);
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    replaceChildren() {}

    click() {
      this.clicks += 1;
    }
  }

  const analyzer = new FakeElement();
  const dropzone = new FakeElement();
  const input = new FakeElement();
  const status = new FakeElement();
  const resetButton = new FakeElement();
  const selection = new FakeElement();
  const results = new FakeElement();
  for (const [selector, value] of [
    ["[data-evtc-dropzone]", dropzone],
    ["[data-evtc-input]", input],
    ["[data-evtc-status]", status],
    ["[data-evtc-reset]", resetButton],
    ["[data-evtc-selection]", selection],
    ["[data-evtc-results]", results],
  ]) {
    analyzer.children.set(selector, value);
  }
  const documentRoot = {
    querySelector: (selector) =>
      selector === "[data-evtc-analyzer]" ? analyzer : null,
  };
  const posts = [];
  const workers = [];
  const createWorker = () => {
    const worker = {
      listeners: new Map(),
      terminated: false,
      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      },
      postMessage(message, transfer) {
        posts.push({ message, transfer });
      },
      terminate() {
        this.terminated = true;
      },
    };
    workers.push(worker);
    return worker;
  };
  const file = {
    name: "fixture.zevtc",
    size: 16,
    async arrayBuffer() {
      return new ArrayBuffer(16);
    },
  };
  const dispose = bindEvtcAnalyzer(documentRoot, { createWorker });
  let prevented = false;
  dropzone.dispatch("keydown", {
    key: "Enter",
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(input.clicks, 1);

  dropzone.dispatch("drop", {
    dataTransfer: { files: [file] },
    preventDefault() {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].message.type, "analyze");
  assert.equal(posts[0].transfer[0], posts[0].message.buffer);

  dispose();
  input.files = [file];
  input.dispatch("change");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(posts.length, 2);
  assert.equal(posts[1].message.fileName, "fixture.zevtc");
  dispose();
  assert.equal(
    workers.every((worker) => worker.terminated),
    true,
  );
});

test("analyzer code has no upload, persistence, or external-request path", async () => {
  const directory = new URL("../../js/evtc-analyzer/", import.meta.url);
  const paths = [];
  const visit = async (url) => {
    for (const entry of await readdir(url, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
      if (entry.isDirectory()) await visit(child);
      else if (/\.(ts|js)$/.test(entry.name)) paths.push(child);
    }
  };
  await visit(directory);
  const source = (
    await Promise.all(paths.map((path) => readFile(path, "utf8")))
  ).join("\n");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(
    source,
    /XMLHttpRequest|sendBeacon|localStorage|sessionStorage/,
  );
  assert.match(source, /file\.arrayBuffer\(\)/);
});

test("the CLI wrapper reuses the shared parser instead of defining an EVTC parser", async () => {
  const source = await readFile(
    new URL("../../scripts/analysis/analyze-evtc.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /evtc-analyzer\/decompression\.js/);
  assert.match(source, /evtc-analyzer\/parser\.js/);
  assert.doesNotMatch(source, /readUInt(?:16|32|64)|inflateRawSync/);
});
