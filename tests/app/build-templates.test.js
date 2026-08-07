import assert from "node:assert/strict";
import test from "node:test";

import {
  initBuildTemplates,
  loadTemplateAction,
  undoTemplateLoad,
} from "../../js/app/build/presets.js";

function createApp() {
  return {
    adapter: {
      id: "mesmer",
      profession: {},
      storageKey: "test-build",
      toApplicationBuild: (build) => structuredClone(build),
    },
    build: {
      profession: "mesmer",
      marker: "current",
      rotation: ["Current rotation"],
    },
    changedCalls: [],
    changed(...args) {
      this.changedCalls.push(args);
    },
    currentTemplate: null,
    templateContainer: null,
    templateUndoBuild: null,
  };
}

function createButton() {
  return {
    disabled: false,
    innerHTML: "<span>Template</span>",
    textContent: "",
  };
}

test("template discovery loads the profession-scoped manifest", async (t) => {
  let requestedPath;
  t.mock.method(globalThis, "fetch", async (url) => {
    requestedPath = String(url).split("?")[0];
    return { ok: false };
  });

  await initBuildTemplates({ adapter: { id: "mesmer" } });

  assert.equal(requestedPath, "Builds/mesmer/manifest.json");
});

test("template actions load paired or partial state and support undo", async (t) => {
  const payloads = new Map([
    [
      "Builds/mesmer/test-build.json",
      {
        profession: "mesmer",
        marker: "template",
        rotation: ["Embedded rotation is ignored"],
      },
    ],
    [
      "Rotations/mesmer/test-rotation.json",
      { rotation: ["Template rotation"] },
    ],
  ]);
  t.mock.method(globalThis, "fetch", async (url) => {
    const path = String(url).split("?")[0];
    const payload = payloads.get(path);
    return {
      ok: payload !== undefined,
      json: async () => structuredClone(payload),
    };
  });
  const preset = {
    section: "Chronomancer",
    label: "Power",
    build: "Builds/mesmer/test-build.json",
    rotation: "Rotations/mesmer/test-rotation.json",
  };

  const templateApp = createApp();
  await loadTemplateAction(
    templateApp,
    preset,
    "template",
    createButton(),
  );
  assert.equal(templateApp.build.marker, "template");
  assert.deepEqual(templateApp.build.rotation, ["Template rotation"]);
  assert.deepEqual(templateApp.changedCalls, [[]]);
  assert.equal(templateApp.currentTemplate.build, preset.build);

  undoTemplateLoad(templateApp);
  assert.equal(templateApp.build.marker, "current");
  assert.deepEqual(templateApp.build.rotation, ["Current rotation"]);
  assert.deepEqual(templateApp.changedCalls, [[], []]);

  const buildOnlyApp = createApp();
  await loadTemplateAction(
    buildOnlyApp,
    preset,
    "build",
    createButton(),
  );
  assert.equal(buildOnlyApp.build.marker, "template");
  assert.deepEqual(buildOnlyApp.build.rotation, ["Current rotation"]);
  assert.deepEqual(buildOnlyApp.changedCalls, [[]]);

  const rotationOnlyApp = createApp();
  await loadTemplateAction(
    rotationOnlyApp,
    preset,
    "rotation",
    createButton(),
  );
  assert.equal(rotationOnlyApp.build.marker, "current");
  assert.deepEqual(rotationOnlyApp.build.rotation, ["Template rotation"]);
  assert.deepEqual(rotationOnlyApp.changedCalls, [[false]]);
});

test("a complete template without a rotation clears stale rotation state", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      profession: "mesmer",
      marker: "build-only-template",
    }),
  }));
  const app = createApp();

  await loadTemplateAction(
    app,
    {
      section: "Mirage",
      label: "Power",
      build: "Builds/mesmer/build-only.json",
    },
    "template",
    createButton(),
  );

  assert.equal(app.build.marker, "build-only-template");
  assert.deepEqual(app.build.rotation, []);
});
