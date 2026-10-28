import { effectFields } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mountTimeSeriesCharts } from '#gw2/app/results/charts/time-series-view.js';
import { mountSimulationSection } from '#ui/results/simulation-view.js';
import { createGw2SimulationViewModel } from '#gw2/app/results/view.js';
import { mountResultCharts } from '#gw2/app/results/charts/section-view.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';

// Hidden views keep shared output available without reading Analysis data; re-entry prepares fresh projections.
test('Analysis projections are prepared only when the Analysis view is active', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else delete globalThis.document;
  });
  const document = {
    body: { dataset: { simulatorView: 'workspace' } },
    defaultView: { location: { hash: '#analysis' } }
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const analysisReads = new Set();
  const { effectReport, boonGeneration } = effectFields([], 1);
  const analysisFields = {
    effectReport,
    boonGeneration,
    breakdown: [],
    conditionBreakdown: [],
    contributions: [],
    procSteps: []
  };
  const recordAnalysisRead = (name, value) => {
    analysisReads.add(name);

    return value;
  };

  const app = {
    profession: {
      ui: normalizeProfessionUi('fixture', {
        effectPresentations: () => recordAnalysisRead('effectPresentations', []),
        chartApplications: () => recordAnalysisRead('chartApplications', [])
      })
    },
    adapter: { eliteSpecialization: () => 'Core' },
    build: { rotation: [{ type: 'wait', durationMs: 1000 }] },
    results: {
      rotationEndTime: 1,
      observationEndTime: 1,
      combatEndTime: 1,
      totalDamage: 100,
      dps: 100,
      randomDistributionRequested: true,
      inputTrace: { start: 0, end: 1, actions: [] }
    }
  };
  for (const [name, value] of Object.entries(analysisFields)) {
    Object.defineProperty(app.results, name, { get: () => recordAnalysisRead(name, value) });
  }

  // Profession projection hooks prove Analysis was prepared without pinning which result fields it reads.
  const assertAnalysisPrepared = () => {
    assert.ok(analysisReads.has('effectPresentations'));
    assert.ok(analysisReads.has('chartApplications'));
  };

  for (const view of ['workspace', 'gear-optimizer', 'analysis', 'workspace', 'analysis']) {
    document.body.dataset.simulatorView = view;
    analysisReads.clear();
    const model = createGw2SimulationViewModel(app);

    if (view === 'analysis') assertAnalysisPrepared();
    else assert.deepEqual(analysisReads, new Set());

    assert.equal(model.analysis !== null, view === 'analysis');
    assert.equal(model.headerDps, '100');
    const summary = inertContainer();
    mountSimulationSection(summary, model.summary);
    assert.match(summary.innerHTML, /Baseline Player DPS/);
    assert.match(summary.innerHTML, />100</);
    assert.match(summary.innerHTML, /Input activity &middot; 0.00 actions\/s/);
    assert.doesNotMatch(summary.innerHTML, /input-activity-body|input-kb-svg|data-rating|input-meter/);
    const workspace = inertContainer();
    mountSimulationSection(workspace, model.workspace);
    assert.match(workspace.innerHTML, /Randomized DPS range/);
  }

  // A direct #analysis load also prepares projections before navigation sets the body dataset.
  delete document.body.dataset.simulatorView;
  analysisReads.clear();
  assert.ok(createGw2SimulationViewModel(app).analysis);
  assertAnalysisPrepared();
});

test('shared chart markup escapes effect names and uses scoped roles without ids', () => {
  const container = inertContainer();

  mountTimeSeriesCharts(
    container,
    {
      durationMs: 1000,
      damageContributions: { strike: [{ t: 1000, v: 1000 }], condition: [] },
      dps: [{ t: 0, v: 0 }],
      effects: {
        'Bad"><img src=x>': [{ t: 0, v: 1 }],
        Quickness: [{ t: 0, v: 2.5 }],
        Alacrity: [{ t: 0, v: 1.5 }],
        Torment: [{ t: 0, v: 3 }]
      },
      effectTypes: {
        Quickness: 'boon',
        Alacrity: 'boon',
        Torment: 'condition',
        'Bad"><img src=x>': 'buff'
      },
      effectUnits: { Quickness: 's' },
      cumulativeDamage: [
        { t: 0, v: 0 },
        { t: 1000, v: 1000 }
      ]
    },
    {
      targetDied: true,
      healthBreakpoints: [
        { healthPercent: 80, elapsed: 0.2, damage: 200 },
        { healthPercent: 60, elapsed: 0.4, damage: 400 },
        { healthPercent: 40, elapsed: 0.6, damage: 600 },
        { healthPercent: 20, elapsed: 0.8, damage: 800 }
      ]
    }
  );
  assert.match(container.innerHTML, /data-role="dps-canvas"/);
  assert.match(container.innerHTML, /Bad&quot;&gt;&lt;img src=x&gt;/);
  assert.match(container.innerHTML, /Quickness \(s\)/);
  assert.deepEqual(
    [...container.innerHTML.matchAll(/data-role="chart-toggle-group" data-effect-type="([^"]+)"/g)].map(
      (match) => match[1]
    ),
    ['boon', 'buff', 'condition']
  );
  assert.equal(
    container.innerHTML.indexOf('Alacrity'),
    Math.min(container.innerHTML.indexOf('Alacrity'), container.innerHTML.indexOf('Quickness'))
  );
  assert.equal([...container.innerHTML.matchAll(/data-toggle-action="all"/g)].length, 3);
  assert.equal([...container.innerHTML.matchAll(/data-toggle-action="none"/g)].length, 3);
  assert.match(container.innerHTML, /data-role="chart-phase-toggles"/);
  assert.match(container.innerHTML, /Chart range/);
  assert.match(container.innerHTML, /data-role="effects-panel-title"/);
  assert.match(container.innerHTML, /Full Fight/);
  assert.deepEqual(
    [...container.innerHTML.matchAll(/data-chart-phase="([^"]+)"/g)].map((match) => match[1]),
    ['full', '100-80', '80-60', '60-40', '40-20', '20-0']
  );
  const finalPhaseButton = container.innerHTML.match(
    /<button type="button"[\s\S]*?data-chart-phase="20-0"[\s\S]*?<\/button>/
  );

  assert.ok(finalPhaseButton);
  assert.doesNotMatch(finalPhaseButton[0], /disabled/);
  assert.doesNotMatch(container.innerHTML, /\sid="/);
});

// Mount the result flow so health metadata and completed-range controls are checked together.
for (const [startingHealthPercent, targetDied] of [
  [100, false],
  [100, true],
  [90, true],
  [80, true],
  [20, true]
]) {
  test(`chart health phases respect a ${startingHealthPercent}% start and target ${targetDied ? 'death' : 'survival'}`, () => {
    const chartContainer = inertContainer();
    const container = {
      ...inertContainer(),
      querySelector: (selector) => (selector === '[data-role="result-charts"]' ? chartContainer : null)
    };
    const view = createGw2SimulationViewModel({
      profession: { ui: normalizeProfessionUi('fixture') },
      adapter: { eliteSpecialization: () => 'Core' },
      build: {
        rotation: [{ type: 'cast', skillId: 'Strike' }],
        targetHealth: 100,
        targetStartingHealthPercent: startingHealthPercent
      },
      results: {
        rotationEndTime: 10,
        observationEndTime: 10,
        combatEndTime: 10,
        dpsStartTime: 0,
        deathTime: targetDied ? 10 : null,
        totalDamage: startingHealthPercent - (targetDied ? 0 : 10),
        conditionDamage: 0,
        ...effectFields(
          [
            { type: 'damage', at: 8, damage: startingHealthPercent - 20 },
            { type: 'damage', at: 10, damage: targetDied ? 20 : 10 }
          ],
          10
        )
      }
    });
    mountSimulationSection(container, view.analysis);

    const phaseEnabled = (id) => {
      const button = chartContainer.innerHTML.match(new RegExp(`<button[^>]*data-chart-phase="${id}"[^>]*>`));
      assert.ok(button, `Missing ${id} phase control`);
      return !button[0].includes('disabled');
    };

    assert.equal(phaseEnabled('20-0'), targetDied);
    assert.equal(phaseEnabled('100-80'), startingHealthPercent === 100);
    assert.equal(phaseEnabled('80-60'), startingHealthPercent === 80);
  });
}

test('chart canvases stay fluid when their initial container width is unavailable', () => {
  const context = {
    beginPath() {},
    clearRect() {},
    fillText() {},
    lineTo() {},
    moveTo() {},
    restore() {},
    save() {},
    setLineDash() {},
    setTransform() {},
    stroke() {}
  };
  const parentElement = { clientWidth: 0 };
  const canvas = () => ({
    closest: () => null,
    getContext: () => context,
    parentElement,
    style: {}
  });
  const dpsCanvas = canvas();
  const effectsCanvas = canvas();
  const canvases = new Map([
    ['[data-role="dps-canvas"]', dpsCanvas],
    ['[data-role="effects-canvas"]', effectsCanvas]
  ]);
  const container = {
    innerHTML: '',
    querySelector: (selector) => canvases.get(selector) || null,
    querySelectorAll: () => []
  };

  mountTimeSeriesCharts(container, {
    durationMs: 1000,
    damageContributions: { strike: [], condition: [] },
    dps: [{ t: 0, v: 100 }],
    effects: {}
  });

  assert.equal(dpsCanvas.width, 760);
  assert.equal(effectsCanvas.width, 760);
  assert.equal(dpsCanvas.style.width, '100%');
  assert.equal(effectsCanvas.style.width, '100%');
});

// Inspect renderer paths directly: count changes must not imply intermediate stacks, while countdowns can slope.
test('effect counts render as steps for both audiences while duration and DPS curves stay linear', () => {
  const strokes = [];
  let path = [];
  let dashed = false;
  const context = {
    beginPath() {
      path = [];
    },
    clearRect() {},
    fillText() {},
    lineTo(x, y) {
      path.push([x, y]);
    },
    moveTo(x, y) {
      path.push([x, y]);
    },
    restore() {},
    save() {},
    setLineDash(values) {
      dashed = values.length > 0;
    },
    setTransform() {},
    stroke() {
      if (this.lineWidth === 2) strokes.push({ color: this.strokeStyle, path: [...path], dashed });
    }
  };
  const canvases = new Map(
    ['dps', 'effects', 'conditions'].map((kind) => [
      `[data-role="${kind}-canvas"]`,
      { getContext: () => context, parentElement: { clientWidth: 760 }, style: {} }
    ])
  );
  const colors = { Might: '#112233', Buff: '#223344', Burning: '#334455', Duration: '#445566' };
  const both = { dataset: { boonAudience: 'both' }, setAttribute() {} };
  const container = {
    innerHTML: '',
    querySelector: (selector) => canvases.get(selector) || null,
    querySelectorAll: (selector) =>
      selector === '[data-series]:checked'
        ? Object.keys(colors).map((name) => ({ dataset: { series: name } }))
        : selector === '[data-boon-audience]'
          ? [both]
          : []
  };
  const points = [
    { t: 0, v: 1 },
    { t: 500, v: 3 },
    { t: 1000, v: 0 }
  ];
  mountTimeSeriesCharts(
    container,
    {
      durationMs: 1000,
      damageContributions: { strike: [{ t: 1000, v: 1000 }], condition: [] },
      dps: points,
      effects: Object.fromEntries(Object.keys(colors).map((name) => [name, points])),
      alliedEffects: { Might: points },
      effectTypes: { Might: 'boon', Buff: 'buff', Burning: 'condition', Duration: 'buff' },
      effectUnits: { Duration: 's' }
    },
    { colors, dpsColor: '#556677' }
  );
  strokes.length = 0;
  both.onclick();
  const hasDiagonal = (stroke) =>
    stroke.path.some(
      ([x, y], index) => index > 0 && x !== stroke.path[index - 1][0] && y !== stroke.path[index - 1][1]
    );
  for (const name of ['Might', 'Buff', 'Burning']) {
    const curves = strokes.filter((stroke) => stroke.color === colors[name]);
    assert.equal(curves.length, name === 'Might' ? 2 : 1);
    for (const curve of curves) {
      assert.equal(hasDiagonal(curve), false, `${name} must hold its previous count until the change`);
      assert.ok(
        curve.path.some(
          ([x, y], index) => index > 0 && x === curve.path[index - 1][0] && y !== curve.path[index - 1][1]
        )
      );
    }
  }

  assert.ok(strokes.some((stroke) => stroke.color === colors.Might && stroke.dashed));
  assert.ok(hasDiagonal(strokes.find((stroke) => stroke.color === colors.Duration)));
  assert.ok(hasDiagonal(strokes.find((stroke) => stroke.color === '#556677')));
});

test('result charts reuse the target-health DPS snapshot breakpoints', () => {
  const chartContainer = inertContainer();
  const container = {
    ...inertContainer(),
    querySelector: (selector) => (selector === '[data-role="result-charts"]' ? chartContainer : null),
    querySelectorAll: () => []
  };

  mountResultCharts(
    container,
    {
      chartSeries: {
        durationMs: 3000,
        damageContributions: { strike: [{ t: 3000, v: 4000 }], condition: [] },
        dps: [{ t: 0, v: 0 }],
        effects: {},
        cumulativeDamage: [
          { t: 0, v: 0 },
          { t: 3000, v: 4000 }
        ]
      }
    },
    {
      healthBreakpoints: [
        { healthPercent: 80, dps: 1200, elapsed: 1, damage: 1200 },
        { healthPercent: 60, dps: 1400, elapsed: 2, damage: 2800 }
      ]
    }
  );

  assert.match(chartContainer.innerHTML, /data-chart-phase="100-80"[\s\S]*?aria-pressed="false"/);
  assert.match(chartContainer.innerHTML, /data-chart-phase="80-60"[\s\S]*?aria-pressed="false"/);
});
