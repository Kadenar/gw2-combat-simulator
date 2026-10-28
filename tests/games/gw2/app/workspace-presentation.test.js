import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2SimulationPresentation } from '#gw2/app/results/view.js';

test('empty rotations keep placeholder DPS metrics grouped with the builder', () => {
  const results = {
    innerHTML: '',
    // Panels append markup after the shell clears each section.
    insertAdjacentHTML(position, html) {
      assert.equal(position, 'beforeend');
      this.innerHTML += html;
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const summaryStrip = { ...results, innerHTML: '' };
  const summaryMirror = { innerHTML: 'stale summary' };
  const previousDocument = globalThis.document;

  const mockDocument = {
    getElementById: (id) =>
      id === 'rotation-results'
        ? results
        : id === 'rotation-dps-summary'
          ? summaryStrip
          : id === 'analysis-dps-summary'
            ? summaryMirror
            : null
  };
  // Mirror the ownerDocument relationship that real result containers expose.
  results.ownerDocument = mockDocument;
  globalThis.document = mockDocument;
  try {
    const app = { patch: patchSelectionFixture(undefined), build: { rotation: [] }, results: null };
    gw2SimulationPresentation.render(app, gw2SimulationPresentation.createViewModel(app));
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(summaryStrip.innerHTML, /res-summary-placeholder/);
  assert.deepEqual(
    [...summaryStrip.innerHTML.matchAll(/<span class="res-label">([^<]+)<\/span>/g)].map((match) => match[1]),
    ['Duration', 'Actions / min', 'Total Idle Time', 'Player Damage', 'Player DPS', 'Strike', 'Condition']
  );
  assert.equal([...summaryStrip.innerHTML.matchAll(/<span class="res-val[^>]*">—<\/span>/g)].length, 7);
  assert.match(results.innerHTML, /No analysis yet/);
  assert.equal(summaryMirror.innerHTML, '');
});

// First visits and invalidated tab results must not tell users their existing rotation is empty.
test('rotations waiting for results show an accessible analysis skeleton', () => {
  for (const simulationStatus of ['idle', 'queued', 'running']) {
    const app = {
      patch: patchSelectionFixture(undefined),
      build: { rotation: [{ type: 'cast', skillId: 'Strike' }] },
      results: null,
      simulationStatus
    };
    const model = gw2SimulationPresentation.createViewModel(app);
    assert.equal(model.analysis, null);
    assert.match(model.analysisEmptyHtml, /class="analysis-skeleton"/);
    assert.match(model.analysisEmptyHtml, /role="status" aria-label="Loading combat analysis" aria-busy="true"/);
    assert.doesNotMatch(model.analysisEmptyHtml, /No analysis yet|Add skills/);

    app.build.rotation = [];
    const emptyModel = gw2SimulationPresentation.createViewModel(app);
    assert.match(emptyModel.analysisEmptyHtml, /No analysis yet/);
    assert.doesNotMatch(emptyModel.analysisEmptyHtml, /analysis-skeleton/);
  }
});

test('workspace renders RNG controls while detailed analysis stays lazy', () => {
  const summaryAttributes = new Map();
  const runButton = {};
  const results = {
    dataset: {},
    innerHTML: '',
    // Preserve appended panels so assertions inspect the complete workspace section.
    insertAdjacentHTML(position, html) {
      assert.equal(position, 'beforeend');
      this.innerHTML += html;
    },
    querySelector: (selector) => (selector === '[data-role="rng-run"]' ? runButton : null),
    querySelectorAll: () => []
  };
  const summaryStrip = {
    dataset: {},
    innerHTML: '',
    // Summary panels use the same append contract as workspace panels.
    insertAdjacentHTML(position, html) {
      assert.equal(position, 'beforeend');
      this.innerHTML += html;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute(name, value) {
      summaryAttributes.set(name, value);
    }
  };
  const previousDocument = globalThis.document;
  let runCount = 0;
  const mockDocument = {
    body: { dataset: {} },
    defaultView: { location: { hash: '#workspace' } },
    addEventListener() {},
    getElementById: (id) => (id === 'rotation-results' ? results : id === 'rotation-dps-summary' ? summaryStrip : null)
  };
  results.ownerDocument = mockDocument;
  summaryStrip.ownerDocument = mockDocument;
  globalThis.document = mockDocument;
  try {
    const app = {
      patch: patchSelectionFixture(undefined),
      build: { rotation: [{ type: 'cast', skillId: 'Strike' }], targetHealth: 0 },
      buildRevision: 2,
      resultRevision: 1,
      results: {
        rotationEndTime: 1,
        observationEndTime: 1,
        combatEndTime: 1,
        totalDamage: 100,
        dps: 100,
        strikeDamage: 100,
        conditionDamage: 0,
        randomDistributionRequested: true,
        randomDistributionTrials: 500,
        inputTrace: { start: 0, end: 1, actions: [] }
      },
      runRandomDistribution() {
        runCount += 1;
      }
    };
    gw2SimulationPresentation.render(app, gw2SimulationPresentation.createViewModel(app));
    // The summary must expose both stale and refreshed results with valid ARIA tokens.
    assert.equal(summaryAttributes.get('aria-busy'), 'true');
    app.resultRevision = app.buildRevision;
    gw2SimulationPresentation.render(app, gw2SimulationPresentation.createViewModel(app));
    assert.equal(summaryAttributes.get('aria-busy'), 'false');
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(results.innerHTML, /Randomized DPS range/);
  assert.match(results.innerHTML, /Calculate range/);
  assert.doesNotMatch(results.innerHTML, /Damage Breakdown|result-charts/);
  assert.equal(results.dataset.analysisStale, 'true');
  assert.equal(typeof runButton.onclick, 'function');
  runButton.onclick();
  assert.equal(runCount, 1);
  assert.match(summaryStrip.innerHTML, /Baseline Player DPS/);
  // Collapsed input summaries render as markup without needing a browser document or chart nodes.
  assert.match(summaryStrip.innerHTML, /Input activity &middot; 0.00 actions\/s/);
  assert.doesNotMatch(summaryStrip.innerHTML, /input-activity-body|input-kb-svg|data-rating|input-meter/);
});
