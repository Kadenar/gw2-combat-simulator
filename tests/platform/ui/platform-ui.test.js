import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activationDamageCommitLabel,
  activationDamageCommitMs,
  activationDamageCommitWarning,
  suggestedActivationInterruptMs,
  validateActivationConcurrentOffsetMs,
  validateActivationInterruptMs
} from '#gw2/app/presentation/rotation/editors/activation-editor.js';
import { chargeReleaseRowLabel } from '#ui/rotation/editors/charge-release-editor.js';
import { validateDurationMs } from '#ui/rotation/editors/duration-editor.js';
import { positionFloatingEditor } from '#ui/rotation/editors/floating-editor.js';
import {
  buildChartSeries,
  buildPhaseDpsSeries,
  buildPhaseEffectSeries,
  chartValueAt,
  mountTimeSeriesCharts
} from '#gw2/app/presentation/results/charts/time-series.js';
import { eventLogCsv } from '#gw2/app/presentation/results/event-log.js';
import { escapeHtml, gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';
import {
  resultSummaryMetrics,
  targetHealthBreakpointSnapshots
} from '#gw2/app/presentation/results/result-transform.js';
import {
  dismissResultMetricDetails,
  nextResultSortState,
  SKILL_COLS,
  sortResultRows
} from '#gw2/app/presentation/results/rotation-results.js';
import {
  applyTimelineDrop,
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  getSkillDropInsertionIndex,
  rotationEntryName,
  timelineDeadTimeMarkers,
  timelineSkillCastOrdinals
} from '#gw2/app/presentation/rotation/timeline.js';

function inertContainer() {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

test('floating editors flip and clamp beside connected anchors', () => {
  const originalWindow = globalThis.window;
  const classes = new Set();
  const properties = {};
  const style = {
    left: '',
    top: '',
    setProperty(name, value) {
      properties[name] = value;
    }
  };
  const editor = {
    classList: {
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      }
    },
    getBoundingClientRect: () => ({ width: 200, height: 160 }),
    style
  };

  try {
    globalThis.window = { innerWidth: 500, innerHeight: 400 };
    const rightAnchor = {
      isConnected: true,
      getBoundingClientRect: () => ({ left: 100, right: 140, top: 100, height: 40 })
    };
    assert.equal(positionFloatingEditor(editor, rightAnchor), true);
    assert.equal(style.left, '152px');
    assert.equal(style.top, '44px');
    assert.equal(properties['--floating-editor-arrow-y'], '76px');
    assert.equal(classes.has('opens-left'), false);

    const leftAnchor = {
      isConnected: true,
      getBoundingClientRect: () => ({ left: 190, right: 230, top: 0, height: 20 })
    };
    globalThis.window.innerWidth = 220;
    assert.equal(positionFloatingEditor(editor, leftAnchor), true);
    assert.equal(style.left, '8px');
    assert.equal(style.top, '8px');
    assert.equal(properties['--floating-editor-arrow-y'], '18px');
    assert.equal(classes.has('opens-left'), true);
    assert.equal(positionFloatingEditor(editor, { ...rightAnchor, isConnected: false }), false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('activation editor suggests and validates manual interruption times', () => {
  assert.equal(suggestedActivationInterruptMs(920, 1200), 880);
  assert.equal(suggestedActivationInterruptMs(null, 500), 480);
  assert.equal(suggestedActivationInterruptMs(0, 0), 40);
  assert.deepEqual(validateActivationInterruptMs('640', 920), {
    valid: true,
    value: 640
  });
  assert.match(validateActivationInterruptMs('640.4', 920).error, /whole-millisecond/);
  assert.deepEqual(validateActivationInterruptMs('620', 920), { valid: true, value: 620 });
  assert.match(validateActivationInterruptMs('630', 920).error, /divisible by 20 ms/);
  assert.equal(validateActivationInterruptMs('', 920).valid, false);
  assert.equal(validateActivationInterruptMs(0, 920).valid, false);
  assert.deepEqual(validateActivationInterruptMs(920, 920), { valid: true, value: 920 });
  assert.deepEqual(validateActivationInterruptMs(657, 657), { valid: true, value: 657 });
  assert.equal(validateActivationInterruptMs(921, 920).valid, false);
  assert.deepEqual(validateActivationConcurrentOffsetMs(0), { valid: true, value: 0 });
  assert.deepEqual(validateActivationConcurrentOffsetMs(120), { valid: true, value: 120 });
  assert.match(validateActivationConcurrentOffsetMs('100.4').error, /divisible by 40 ms/);
  assert.match(validateActivationConcurrentOffsetMs(100).error, /divisible by 40 ms/);
  assert.deepEqual(validateActivationConcurrentOffsetMs(-440, null), { valid: true, value: -440 });
  assert.deepEqual(validateActivationConcurrentOffsetMs(681, null), { valid: true, value: 681 });
  assert.match(validateActivationConcurrentOffsetMs('681.5', null).error, /whole-millisecond/);
  assert.equal(validateActivationConcurrentOffsetMs('').valid, false);
  assert.equal(validateActivationConcurrentOffsetMs(-1).valid, false);
  assert.equal(
    activationDamageCommitMs({
      effects: [
        { type: 'strike', persistsAfterInterrupt: true, interruptCommitMs: 560 },
        { type: 'strike', persistsAfterInterrupt: true, interruptCommitMs: 280 }
      ]
    }),
    280
  );
  assert.equal(activationDamageCommitMs({ effects: [], interruptCommitMs: 160 }), 160);
  assert.equal(activationDamageCommitMs({ effects: [], interruptMode: 'per-packet' }), 0);
  assert.equal(activationDamageCommitMs({ effects: [] }), null);
  assert.equal(activationDamageCommitLabel(160), 'Damage commit cutoff: 160 ms minimum');
  assert.equal(activationDamageCommitLabel(null), '');
  assert.match(activationDamageCommitWarning(159, 160), /contribute no damage.*at least 160 ms/);
  assert.match(activationDamageCommitWarning(200, null), /No damage commit time is configured/);
  assert.equal(activationDamageCommitWarning(160, 160), '');
});

test('duration editor validates and rounds millisecond values', () => {
  assert.deepEqual(validateDurationMs('1000'), { valid: true, value: 1000 });
  assert.deepEqual(validateDurationMs('1.4'), { valid: true, value: 1 });
  assert.equal(validateDurationMs('').valid, false);
  assert.equal(validateDurationMs('Infinity').valid, false);
  assert.equal(validateDurationMs('0.9').valid, false);
  assert.equal(validateDurationMs('501', 1, 500).valid, false);
});

test('charge release rows expose time, Flow, and coefficient', () => {
  assert.equal(
    chargeReleaseRowLabel({
      charges: 3,
      at: 12.75,
      delta: 0.75,
      flowAfter: 7.5,
      coefficient: 5.435
    }),
    '3 charges · 12.750s (+0.750s) · 7.50 Flow · 5.43 coefficient'
  );
});

test('rotation insertion cursors validate positions and expose accessible gaps', () => {
  assert.equal(normalizeRotationInsertionIndex(0, 3), 0);
  assert.equal(normalizeRotationInsertionIndex(3, 3), 3);
  assert.equal(normalizeRotationInsertionIndex(4, 3), null);
  assert.equal(normalizeRotationInsertionIndex(1.5, 3), null);
  assert.equal(normalizeRotationInsertionIndex(null, 3), null);
  assert.equal(normalizeRotationInsertionIndex(undefined, 3), null);
});

test('timeline cast details preserve millisecond wait boundaries', () => {
  assert.equal(
    formatTimelineCastDetails({ start: 3000, end: 3083 }, (time) => `${(time / 1000).toFixed(3)}s`),
    'Cast: 3.000s → 3.083s\nCast time: 0.083s'
  );
});

test('timeline dead time includes explicit waits and excludes concurrent casts and gap-fill attacks', () => {
  const markers = timelineDeadTimeMarkers([
    { ri: 0, skill: 'Long Cast', start: 0, end: 1000 },
    { ri: 1, skill: 'Instant Cast', start: 200, end: 200 },
    { ri: 2, skill: 'Wait', start: 1000, end: 1400, type: 'wait' },
    { ri: 3, skill: 'Next Cast', start: 1400, end: 1800 },
    {
      ri: 4,
      skill: 'Gap-filled Cast',
      start: 2000,
      end: 2400,
      partialFill: { startMs: 1800, durationMs: 150 }
    },
    {
      ri: 5,
      skill: 'Invalid Cast',
      start: 3000,
      end: 3200,
      invalid: true
    }
  ]);

  assert.deepEqual(markers, [
    { insertionIndex: 2, start: 1000, end: 1400, durationMs: 400, reason: 'explicit-wait' },
    { insertionIndex: 4, start: 1950, end: 2000, durationMs: 50 }
  ]);
  assert.equal(formatTimelineDuration(400), '400ms');
  assert.equal(formatTimelineDuration(1000), '1s');
  assert.equal(formatTimelineDuration(1250), '1.25s');
  assert.equal(formatTimelineDuration(12_500), '12.5s');
  assert.equal(formatTimelineDuration(100_000), '100s');
});

test('timeline dead time precedes simultaneous instant and non-instant casts', () => {
  const markers = timelineDeadTimeMarkers([
    { ri: 0, skill: 'Previous Cast', start: 0, end: 1000 },
    { ri: 1, skill: 'Instant Cast', start: 1500, end: 1500 },
    { ri: 2, skill: 'Following Cast', start: 1500, end: 1900 }
  ]);

  assert.deepEqual(markers, [{ insertionIndex: 1, start: 1000, end: 1500, durationMs: 500 }]);
});

test('timeline overlays suppress wait shapes and retain only excess dead time', () => {
  const markers = timelineDeadTimeMarkers(
    [
      { ri: 0, skill: 'First Cast', start: 0, end: 1000 },
      { ri: 1, skill: 'Wait', start: 1000, end: 1400, type: 'wait' },
      { ri: 2, skill: 'Next Cast', start: 1500, end: 1900 }
    ],
    [],
    { includeExplicitWaits: false }
  );

  assert.deepEqual(markers, [{ insertionIndex: 2, start: 1400, end: 1500, durationMs: 100 }]);
});

test('timeline dead time excludes forced post-interrupt cast lockout', () => {
  const markers = timelineDeadTimeMarkers([
    { ri: 0, skill: 'Interrupted Cast', start: 0, end: 400, castLockoutEnd: 1000, interrupted: true },
    { ri: 1, skill: 'Following Cast', start: 1000, end: 1200 }
  ]);

  assert.deepEqual(markers, []);
});

test('timeline dead time includes missing commits and the full duration of explicit pre-commit cancellations', () => {
  const markers = timelineDeadTimeMarkers(
    [
      {
        ri: 0,
        skill: 'Missing Commit',
        start: 0,
        end: 400,
        activationId: 'cast:1',
        interrupted: true,
        missingInterruptCommit: true
      },
      {
        ri: 1,
        skill: 'Missing Commit With Damage',
        start: 400,
        end: 700,
        activationId: 'cast:2',
        interrupted: true,
        missingInterruptCommit: true
      },
      {
        ri: 2,
        skill: 'Below Explicit Commit',
        start: 700,
        end: 900,
        activationId: 'cast:3',
        interrupted: true,
        cancelledBeforeCommit: true
      },
      {
        ri: 3,
        skill: 'Per-packet Channel',
        start: 900,
        end: 1000,
        activationId: 'cast:4',
        interrupted: true
      }
    ],
    [
      { type: 'damage', at: 0.5, source: 'fixture', sourceId: 2, activationId: 'cast:2', damage: 10 },
      { type: 'damage', at: 0.8, source: 'fixture', sourceId: 3, activationId: 'cast:3', damage: 10 }
    ]
  );

  assert.deepEqual(markers, [
    {
      insertionIndex: 0,
      start: 0,
      end: 400,
      durationMs: 400,
      reason: 'zero-damage-cast',
      skill: 'Missing Commit'
    },
    {
      insertionIndex: 2,
      start: 700,
      end: 900,
      durationMs: 200,
      reason: 'cancelled-before-commit',
      skill: 'Below Explicit Commit'
    }
  ]);
});

test('timeline skill tooltips include matching and global cast ordinals', () => {
  const steps = [
    { ri: 0, skill: 'Well of Darkness', start: 1000, end: 1481 },
    { ri: 1, skill: 'Wait', start: 1481, end: 2000 },
    { ri: 2, skill: 'Nightfall', start: 2000, end: 2750 },
    { ri: 3, skill: 'Well of Darkness', start: 3000, end: 3481 },
    { ri: 4, skill: 'Well of Darkness', start: 2500, end: 2981 },
    {
      ri: 5,
      skill: 'Well of Darkness',
      start: 4000,
      end: 4481,
      invalid: true
    }
  ];
  const ordinals = timelineSkillCastOrdinals(steps);

  assert.deepEqual(ordinals.get(4), {
    matchingIndex: 2,
    matchingTotal: 3,
    skillIndex: 3,
    skillTotal: 4
  });
  assert.equal(
    formatTimelineSkillTooltip('Well of Darkness', steps[4], ordinals.get(4), (time) => `${(time / 1000).toFixed(3)}s`),
    'Well of Darkness at 2.500s for 481ms\n' + 'Well of Darkness cast 2 of 3\n' + 'Skill cast 3 of 4'
  );
  assert.match(
    formatTimelineSkillTooltip(
      'Dragon Slash—Force',
      steps[4],
      ordinals.get(4),
      (time) => `${(time / 1000).toFixed(3)}s`,
      ['Charges reached: 4', 'Time spent charging: 0.750s', 'Flow spent: 10']
    ),
    /Charges reached: 4\nTime spent charging: 0\.750s\nFlow spent: 10$/
  );
  assert.equal(ordinals.has(1), false);
  assert.equal(ordinals.has(5), false);
});

test('GW2 API text removes presentation tags for native tooltips', () => {
  const description = '<c=@abilitytype>Stances</c> grant protection.<br><c=@reminder>Once per interval.</c>';

  assert.equal(gw2ApiText(description), 'Stances grant protection.\nOnce per interval.');
  assert.equal(escapeHtml(gw2ApiText('<c=abilitytype>"Glamour" & allies</c>')), '&quot;Glamour&quot; &amp; allies');
});

test('shared chart lookup and series cover damage timing and configurable effects', () => {
  assert.equal(chartValueAt([], 10), 0);
  assert.equal(
    chartValueAt(
      [
        { t: 0, v: 1 },
        { t: 100, v: 4 }
      ],
      99
    ),
    1
  );
  assert.equal(
    chartValueAt(
      [
        { t: 0, v: 1 },
        { t: 100, v: 4 }
      ],
      100
    ),
    4
  );

  const series = buildChartSeries(
    {
      duration: 9,
      deathTime: 2,
      dpsStartTime: 0.5,
      resolvedEvents: [
        { type: 'damage', at: 0.5, damage: 100 },
        {
          type: 'condition',
          at: 1,
          condition: 'burn',
          duration: 2,
          expiresAt: 2,
          naturalExpiresAt: 3,
          stacks: 3,
          damage: 0,
          damageTicks: [
            { at: 1, damage: 50 },
            { at: 2, damage: 250 }
          ]
        }
      ],
      events: [
        {
          type: 'buff',
          at: 0,
          kind: 'power',
          duration: 2,
          stacks: 2,
          resolvedAudience: {
            includesSelf: true,
            includesSummons: false,
            alliedPlayerCount: 0,
            companionIds: [],
            recipientCount: 1
          }
        }
      ]
    },
    1000,
    {
      effectName: (value) => `Effect <${value}>`,
      stackCaps: { 'Effect <burn>': 2 }
    }
  );

  assert.equal(series.durationMs, 1500);
  assert.equal(series.dps[0].v, 0);
  assert.equal(series.dps[1].v, 150);
  assert.equal(series.dps.at(-1).v, 400 / 1.5);
  assert.equal(series.cumulativeDamage.at(-1).v, 400);
  assert.equal(series.effects['Effect <burn>'][1].v, 2);
  assert.equal(series.effects['Effect <burn>'].at(-1).v, 2);
  assert.equal(series.effects['Effect <power>'][0].v, 2);
  assert.deepEqual(series.effectTypes, {
    'Effect <burn>': 'condition',
    'Effect <power>': 'buff'
  });
});

test('shared DPS charts start their sample grid at the first hit', () => {
  const series = buildChartSeries({
    duration: 2,
    dpsStartTime: 1.156,
    resolvedEvents: [
      { type: 'damage', at: 1.156, damage: 3567 },
      { type: 'damage', at: 1.32, damage: 916 }
    ]
  });

  assert.equal(series.durationMs, 844);
  assert.deepEqual(series.dps.slice(0, 2), [
    { t: 0, v: 0 },
    { t: 250, v: 4483 / 0.25 }
  ]);
});

test('target health breakpoints use cumulative damage and individual condition ticks', () => {
  const snapshots = targetHealthBreakpointSnapshots(
    {
      dpsStartTime: 0.5,
      resolvedEvents: [
        { type: 'damage', at: 0.5, damage: 100 },
        {
          type: 'condition',
          at: 0.75,
          damage: 350,
          damageTicks: [
            { at: 1, damage: 150 },
            { at: 1.5, damage: 200 }
          ]
        },
        { type: 'damage', at: 1.5, damage: 200 },
        { type: 'damage', at: 2, damage: 200 }
      ]
    },
    1000
  );

  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.healthPercent),
    [80, 60, 40, 20]
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.elapsed),
    [0.5, 1, 1, 1.5]
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.damage),
    [250, 650, 650, 850]
  );
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.dps),
    [500, 650, 650, 850 / 1.5]
  );
  assert.deepEqual(
    targetHealthBreakpointSnapshots(
      {
        dpsStartTime: 0,
        resolvedEvents: [
          { type: 'damage', at: 1, damage: 100 },
          { type: 'damage', at: 2, damage: 100 }
        ]
      },
      1000,
      [80, 40, 20],
      40
    ).map(({ healthPercent, at }) => ({ healthPercent, at })),
    [{ healthPercent: 20, at: 2 }]
  );
  assert.deepEqual(targetHealthBreakpointSnapshots({}, 0), []);
});

test('target health breakpoints use environment damage for timing but player damage for DPS', () => {
  const snapshots = targetHealthBreakpointSnapshots(
    {
      dpsStartTime: 0.5,
      resolvedEvents: [{ type: 'damage', at: 0.5, damage: 100 }],
      environmentConditionBreakdown: [
        {
          name: 'Burning',
          damageTicks: [{ at: 1, damage: 120 }]
        }
      ]
    },
    400,
    [50]
  );

  assert.deepEqual(snapshots, [
    {
      healthPercent: 50,
      at: 1,
      elapsed: 0.5,
      damage: 100,
      dps: 200,
      environmentDamage: 120,
      targetDamage: 220
    }
  ]);
});

test('summary metrics separate player attribution from right-grouped target damage', () => {
  const metrics = resultSummaryMetrics({
    duration: 2,
    deathTime: null,
    totalDamage: 100,
    dps: 50,
    strikeDamage: 100,
    conditionDamage: 0,
    environmentDamage: 44,
    environmentDps: 22,
    environmentConditionBreakdown: [{ name: 'Bleeding', damage: 44 }]
  });
  const environment = metrics.find((metric) => metric.label === 'Environment Damage');

  assert.equal(metrics.find((metric) => metric.label === 'Player Damage').value, '100');
  assert.equal(metrics.find((metric) => metric.label === 'Player DPS').value, '50');
  assert.equal(environment.value, '44');
  assert.equal(environment.group, 'target');
  assert.equal(metrics.find((metric) => metric.label === 'Target Damage').value, '144');
  assert.deepEqual(environment.details, [
    { label: 'Environment DPS', value: '22' },
    { label: 'Bleeding', value: '44' }
  ]);
});

test('phase DPS is recalculated from damage within the selected health range', () => {
  assert.deepEqual(
    buildPhaseDpsSeries(
      [
        { t: 0, v: 0 },
        { t: 1000, v: 100 },
        { t: 2000, v: 300 },
        { t: 3000, v: 600 }
      ],
      1000,
      3000,
      100,
      600
    ),
    [
      { t: 0, v: 0 },
      { t: 1000, v: 200 },
      { t: 2000, v: 250 }
    ]
  );
  assert.deepEqual(buildPhaseDpsSeries([], 1000, 1000, 100, 100), []);
});

test('phase effects are cropped and rebased to the selected health range', () => {
  assert.deepEqual(
    buildPhaseEffectSeries(
      [
        { t: 0, v: 0 },
        { t: 500, v: 1 },
        { t: 1500, v: 2 },
        { t: 2500, v: 0 },
        { t: 3000, v: 3 }
      ],
      1000,
      3000
    ),
    [
      { t: 0, v: 1 },
      { t: 500, v: 2 },
      { t: 1500, v: 0 },
      { t: 2000, v: 3 }
    ]
  );
  assert.deepEqual(buildPhaseEffectSeries([], 1000, 3000), []);
  assert.deepEqual(buildPhaseEffectSeries([{ t: 0, v: 1 }], 1000, 1000), []);
});

test('shared chart markup escapes effect names and uses scoped roles without ids', () => {
  const container = inertContainer();

  mountTimeSeriesCharts(
    container,
    {
      durationMs: 1000,
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
    ['boon', 'condition', 'buff']
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
    dps: [{ t: 0, v: 100 }],
    effects: {}
  });

  assert.equal(dpsCanvas.width, 760);
  assert.equal(effectsCanvas.width, 760);
  assert.equal(dpsCanvas.style.width, '100%');
  assert.equal(effectsCanvas.style.width, '100%');
});

test('result sorting handles defaults, numeric directions, strings, and cycling', () => {
  assert.deepEqual(
    SKILL_COLS.map((column) => column.key),
    ['name', 'strike', 'condition', 'total', 'dps', 'average', 'dct', 'casts', 'hits', 'critChance']
  );
  const rows = [
    { name: 'Beta', total: 20, dps: 5 },
    { name: 'Alpha', total: 10, dps: 8 }
  ];
  const columns = [
    { key: 'name', numeric: false },
    { key: 'dps', numeric: true }
  ];

  assert.deepEqual(
    sortResultRows(rows, columns, null, null).map((row) => row.name),
    ['Beta', 'Alpha']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'dps', 'asc').map((row) => row.name),
    ['Beta', 'Alpha']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'dps', 'desc').map((row) => row.name),
    ['Alpha', 'Beta']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'name', 'asc').map((row) => row.name),
    ['Alpha', 'Beta']
  );
  assert.deepEqual(nextResultSortState(null, null, 'dps'), {
    column: 'dps',
    direction: 'desc'
  });
  assert.deepEqual(nextResultSortState('dps', 'desc', 'dps'), {
    column: 'dps',
    direction: 'asc'
  });
  assert.deepEqual(nextResultSortState('dps', 'asc', 'dps'), {
    column: null,
    direction: null
  });
});

test('summary metric disclosures stay open for internal clicks and dismiss on click away', () => {
  const inside = {};
  const outside = {};
  const clickedDetails = { open: true, contains: (target) => target === inside };
  const otherDetails = { open: true, contains: () => false };
  const root = {
    querySelectorAll: () => [clickedDetails, otherDetails]
  };

  dismissResultMetricDetails(root, inside);
  assert.equal(clickedDetails.open, true);
  assert.equal(otherDetails.open, false);

  dismissResultMetricDetails(root, outside);
  assert.equal(clickedDetails.open, false);
});

test('timeline canonical entries expose stable presentation names', () => {
  assert.equal(rotationEntryName({ type: 'cast', skillId: 'One' }), 'One');
  assert.equal(rotationEntryName({ type: 'wait', durationMs: 50 }), '__wait');
});

test('timeline drops insert palette entries and drop positions use tile halves', () => {
  let dragState = { source: 'palette', name: 'New', skillId: 12345 };
  let changes = 0;
  const rotation = [{ type: 'cast', skillId: 'A' }];
  const insertEntries = (entries, insertAt) => {
    if (!entries.length) return false;
    rotation.splice(insertAt, 0, ...entries);
    return true;
  };

  const options = {
    getDragState: () => dragState,
    setDragState: (value) => {
      dragState = value;
    },
    moveEntry: () => false,
    insertEntries,
    resolvePaletteEntry: (name, drag) => ({
      type: 'cast',
      skillId: drag.skillId,
      interruptAfterMs: 100
    }),
    onChanged: () => {
      changes += 1;
    }
  };

  assert.equal(applyTimelineDrop(options, 1), true);
  assert.deepEqual(rotation, [
    { type: 'cast', skillId: 'A' },
    { type: 'cast', skillId: 12345, interruptAfterMs: 100 }
  ]);
  assert.equal(dragState, null);
  assert.equal(changes, 1);

  dragState = { source: 'palette', name: 'Macro' };
  const macroOptions = {
    getDragState: () => dragState,
    setDragState: (value) => {
      dragState = value;
    },
    moveEntry: () => false,
    insertEntries,
    resolvePaletteEntry: () => [
      { type: 'cast', skillId: 10 },
      { type: 'cast', skillId: -5, concurrentOffsetMs: 0 }
    ],
    onChanged: () => {
      changes += 1;
    }
  };

  assert.equal(applyTimelineDrop(macroOptions, 1), true);
  assert.deepEqual(rotation, [
    { type: 'cast', skillId: 'A' },
    { type: 'cast', skillId: 10 },
    { type: 'cast', skillId: -5, concurrentOffsetMs: 0 },
    { type: 'cast', skillId: 12345, interruptAfterMs: 100 }
  ]);
  assert.equal(dragState, null);
  assert.equal(changes, 2);

  const tile = {
    dataset: { idx: '3' },
    getBoundingClientRect: () => ({ left: 10, width: 40 })
  };

  assert.equal(getSkillDropInsertionIndex(tile, 20), 3);
  assert.equal(getSkillDropInsertionIndex(tile, 31), 4);
  assert.equal(getSkillDropInsertionIndex({ dataset: {} }, 0), null);
  assert.equal(getSkillDropInsertionIndex({ dataset: { idx: '' } }, 0), null);
});

test('event log CSV escapes cells', () => {
  const rows = [{ at: 0, type: 'action', description: 'CAST Quote "skill"' }];

  assert.match(eventLogCsv(rows), /"CAST Quote ""skill"""/);
});
