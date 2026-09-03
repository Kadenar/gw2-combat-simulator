import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activationDamageCommitLabel,
  activationDamageCommitMs,
  activationDamageCommitWarning,
  suggestedActivationInterruptMs,
  validateActivationConcurrentOffsetMs,
  validateActivationInterruptMs
} from '#gw2/app/rotation/editing/activation-editor.js';
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
import { eventLogCsv, mountEventLog } from '#gw2/app/presentation/results/event-log-view.js';
import {
  bindPaletteInteractions,
  paletteGroupHtml,
  paletteSkillHtml,
  virtualPaletteSkillHtml
} from '#gw2/app/rotation/palette/view.js';
import { escapeHtml, gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import {
  normalizeRotationInsertionIndex,
  rotationInsertionGapHtml,
  rotationTimelineEntryHtml
} from '#ui/rotation/insertion-cursor.js';
import {
  resultSummaryMetrics,
  targetHealthBreakpointSnapshots
} from '#gw2/app/presentation/results/result-transform.js';
import {
  dismissResultMetricDetails,
  mountRotationResults,
  nextResultSortState,
  SKILL_COLS,
  sortResultRows
} from '#gw2/app/presentation/results/rotation-results.js';
import { mountRotationWarnings } from '#ui/results/rotation-warnings.js';
import {
  formatTimelineCastDetails,
  formatTimelineDuration,
  formatTimelineSkillTooltip,
  rotationEntryName,
  timelineDeadTimeMarkers,
  timelineSkillCastOrdinals
} from '#gw2/app/rotation/timeline/model.js';
import { bindTimelineInteractions, getSkillDropInsertionIndex } from '#gw2/app/rotation/timeline/view.js';

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

  assert.match(rotationInsertionGapHtml(2, 2), /class="rot-insertion-gap active"/);
  assert.match(rotationInsertionGapHtml(2, null), /Insert at position 3/);
  const entryHtml = rotationTimelineEntryHtml(
    2,
    null,
    '<div class="rot-dead-time">Dead</div><div class="rot-skill">Skill</div>'
  );
  assert.match(
    entryHtml,
    /class="rot-entry"[\s\S]*data-insertion-index="2"[\s\S]*class="rot-dead-time"[\s\S]*class="rot-skill"/
  );
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

test('result charts reuse the target-health DPS snapshot breakpoints', () => {
  const chartContainer = inertContainer();
  const container = {
    innerHTML: '',
    querySelector: (selector) => (selector === '[data-role="result-charts"]' ? chartContainer : null),
    querySelectorAll: () => []
  };

  mountRotationResults(container, {
    breakpoints: [
      { healthPercent: 80, dps: 1200, elapsed: 1, damage: 1200 },
      { healthPercent: 60, dps: 1400, elapsed: 2, damage: 2800 }
    ],
    chartSeries: {
      durationMs: 3000,
      dps: [{ t: 0, v: 0 }],
      effects: {},
      cumulativeDamage: [
        { t: 0, v: 0 },
        { t: 3000, v: 4000 }
      ]
    }
  });

  assert.match(chartContainer.innerHTML, /data-chart-phase="100-80"[\s\S]*?aria-pressed="false"/);
  assert.match(chartContainer.innerHTML, /data-chart-phase="80-60"[\s\S]*?aria-pressed="false"/);
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

test('shared results render summaries, totals, contributions, and icons', () => {
  const container = inertContainer();
  const resolved = [];

  mountRotationResults(
    container,
    {
      metrics: [
        { label: 'Player DPS', value: '1,234', className: 'dps' },
        { label: 'Environment Damage', value: '50', className: 'environment', group: 'target' },
        { label: 'Target Damage', value: '1,284', className: 'target-damage', group: 'target' }
      ],
      breakpoints: [{ healthPercent: 80, dps: 1234, elapsed: 3.25 }],
      skillColumns: [
        { key: 'name', label: 'Skill', numeric: false },
        { key: 'total', label: 'Total', numeric: true }
      ],
      skillRows: [
        { name: 'Low', total: 10 },
        { name: 'High', total: 20 }
      ],
      conditions: [
        { name: 'Weak <slow>', damage: 0, dps: 0, averageStacks: 0.5 },
        { name: 'Burn <hot>', damage: 25, dps: 5, averageStacks: 1.25 }
      ],
      conditionTotal: { label: 'Total Conditions', damage: 25, dps: 5 },
      contributions: [
        {
          name: 'Bonus',
          dpsIncrease: 12,
          pctIncrease: 1.5,
          icon: 'bonus.png'
        },
        {
          name: 'Noise',
          dpsIncrease: -0.1,
          pctIncrease: -0.001
        },
        {
          name: 'Penalty',
          dpsIncrease: -12,
          pctIncrease: -1.5
        }
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
              id: 'critical:illusion',
              label: 'Illusion critical hits',
              category: 'critical',
              unit: 'count',
              lowAverage: 18.2,
              overallAverage: 21.5,
              highAverage: 25.4,
              delta: 7.2,
              correlation: 0.84,
              estimatedDpsDelta: 360
            }
          ]
        }
      }
    },
    {
      resolveSkillIcon: (row) => {
        resolved.push(row.name);

        return `icon-${row.name}.png`;
      }
    }
  );

  assert.match(container.innerHTML, /res-summary/);
  assert.equal((container.innerHTML.match(/res-stat-target-start/g) || []).length, 1);
  assert.match(container.innerHTML, /<details class="res-dps-snapshots">/);
  assert.match(container.innerHTML, /DPS snapshots/);
  assert.doesNotMatch(container.innerHTML, /res-breakpoints/);
  assert.match(container.innerHTML, /80%<\/b> target health/);
  assert.match(container.innerHTML, />1,234</);
  assert.match(container.innerHTML, /at 3\.25s/);
  assert.ok(container.innerHTML.indexOf('High') < container.innerHTML.indexOf('Low'));
  assert.match(container.innerHTML, /Total Conditions/);
  assert.equal((container.innerHTML.match(/class="res-breakdown-section"/g) || []).length, 1);
  assert.doesNotMatch(container.innerHTML, /res-section-title"><svg/);
  assert.ok(container.innerHTML.indexOf('Damage Breakdown') < container.innerHTML.indexOf('Conditions'));
  assert.ok(container.innerHTML.indexOf('Damaging Conditions') < container.innerHTML.indexOf('Burn &lt;hot&gt;'));
  assert.ok(container.innerHTML.indexOf('Burn &lt;hot&gt;') < container.innerHTML.indexOf('Other Conditions'));
  assert.ok(container.innerHTML.indexOf('Other Conditions') < container.innerHTML.indexOf('Weak &lt;slow&gt;'));
  assert.match(container.innerHTML, /\+12/);
  assert.match(container.innerHTML, /\+1\.50%/);
  assert.match(
    container.innerHTML,
    /Noise<\/span>\s*<span class="contrib-val">0<\/span>\s*<span class="contrib-pct">0\.00%/
  );
  assert.match(
    container.innerHTML,
    /Penalty<\/span>\s*<span class="contrib-val">-12<\/span>\s*<span class="contrib-pct">-1\.50%/
  );
  assert.doesNotMatch(container.innerHTML, /-0(?:\.00)?%?/);
  assert.match(container.innerHTML, /<img src="bonus\.png" alt="" \/>Bonus/);
  assert.match(container.innerHTML, /contrib-status/);
  assert.match(container.innerHTML, /Recalculating/);
  assert.match(container.innerHTML, /disabling each modifier and rerunning the simulation/);
  assert.match(container.innerHTML, /misleading if doing so breaks the rotation/);
  assert.match(container.innerHTML, /Randomized DPS range/);
  assert.match(container.innerHTML, /Recalculate/);
  assert.match(container.innerHTML, /500 simulations/);
  assert.match(container.innerHTML, /Rare low outcome/);
  assert.match(container.innerHTML, /About 1 in 100 runs are lower/);
  assert.match(container.innerHTML, /Rare high outcome/);
  assert.match(container.innerHTML, /About 1 in 100 runs are higher/);
  assert.match(container.innerHTML, /1,100&ndash;1,350/);
  assert.match(container.innerHTML, /What was different in the highest-DPS simulations\?/);
  assert.match(container.innerHTML, /50 highest vs 50 lowest/);
  assert.match(container.innerHTML, /The 50 highest-DPS simulations averaged 1,460 DPS/);
  assert.match(container.innerHTML, /The 50 lowest-DPS simulations averaged 1,040 DPS/);
  assert.match(container.innerHTML, /Illusion critical hits/);
  assert.match(container.innerHTML, /Highest-DPS group: 25\.4 average per simulation/);
  assert.match(container.innerHTML, /Lowest-DPS group: 18\.2 average per simulation/);
  assert.match(container.innerHTML, /\+7\.2/);
  assert.match(container.innerHTML, /difference/);
  assert.match(container.innerHTML, /&asymp; \+360 DPS/);
  assert.match(container.innerHTML, /estimated DPS difference/);
  assert.match(container.innerHTML, /single-variable trend estimates/);
  assert.match(container.innerHTML, /averages across each group/);
  assert.match(container.innerHTML, /do not add them together/);
  assert.ok(container.innerHTML.indexOf('DPS snapshots') < container.innerHTML.indexOf('Randomized DPS range'));
  assert.deepEqual(resolved, ['High', 'Low']);

  assert.doesNotThrow(() => mountRotationResults(inertContainer(), {}));
});

test('modifier contribution errors are visible and escaped', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    contributionsError: 'Comparison <failed>'
  });

  assert.match(container.innerHTML, /Modifier Contributions/);
  assert.match(container.innerHTML, /class="contrib-pending contrib-error"/);
  assert.match(container.innerHTML, /Comparison &lt;failed&gt;/);
  assert.doesNotMatch(container.innerHTML, /Comparison <failed>/);
});

test('summary metrics render a clickable and escaped contributor disclosure', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    metrics: [
      {
        label: 'Total Idle Time',
        value: '650ms',
        details: [
          { label: 'Idle time between skills', value: '250ms' },
          { label: "Skill cancelled '<Mind Stab>'", value: '400ms' }
        ]
      }
    ]
  });

  assert.match(container.innerHTML, /<details class="res-metric-info">/);
  assert.match(container.innerHTML, /aria-label="Show Total Idle Time breakdown"/);
  assert.match(container.innerHTML, /Idle time between skills/);
  assert.match(container.innerHTML, /Skill cancelled '&lt;Mind Stab&gt;'/);
  assert.doesNotMatch(container.innerHTML, /Skill cancelled '<Mind Stab>'/);
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

test('summary metric click-away dismissal binds before the native details click toggle', () => {
  const eventTypes = [];
  const ownerDocument = {
    addEventListener: (type) => eventTypes.push(type),
    querySelectorAll: () => []
  };
  const container = { ...inertContainer(), ownerDocument };

  mountRotationResults(container, { metrics: [] });

  assert.deepEqual(eventTypes, ['pointerdown']);
});

test('skill damage rows group player damage before owned entities', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    skillColumns: [
      { key: 'name', label: 'Skill', numeric: false },
      { key: 'strike', label: 'Strike', numeric: true },
      {
        key: 'condition',
        label: 'Condition',
        numeric: true,
        className: 'condi'
      },
      { key: 'total', label: 'Total', numeric: true, className: 'total' },
      { key: 'dps', label: 'DPS', numeric: true, className: 'dps' }
    ],
    skillRows: [
      {
        name: 'Player Low',
        strike: 6,
        condition: 4,
        total: 10,
        dps: 2,
        group: 'Player'
      },
      {
        name: 'Entity High',
        strike: 75,
        condition: 25,
        total: 100,
        dps: 20,
        group: 'Entities'
      },
      {
        name: 'Player High',
        strike: 15,
        condition: 5,
        total: 20,
        dps: 4,
        group: 'Player'
      },
      {
        name: 'Entity Low',
        strike: 30,
        condition: 20,
        total: 50,
        dps: 10,
        group: 'Entities'
      }
    ]
  });

  const html = container.innerHTML;
  const playerGroup = html.indexOf('data-skill-group="Player"');
  const entityGroup = html.indexOf('data-skill-group="Entities"');

  assert.ok(playerGroup >= 0);
  assert.ok(entityGroup > playerGroup);
  assert.ok(html.indexOf('Player High') < html.indexOf('Player Low'));
  assert.ok(html.indexOf('Player Low') < entityGroup);
  assert.ok(html.indexOf('Entity High') < html.indexOf('Entity Low'));
  assert.match(html, /aria-label="Player Strike: 21">21</);
  assert.match(html, /aria-label="Player Condition: 9">9</);
  assert.match(html, /aria-label="Player Total: 30">30</);
  assert.match(html, /aria-label="Player DPS: 6">6</);
  assert.match(html, /aria-label="Entities Strike: 105">105</);
  assert.match(html, /aria-label="Entities Condition: 45">45</);
  assert.match(html, /aria-label="Entities Total: 150">150</);
  assert.match(html, /aria-label="Entities DPS: 30">30</);
});

test('randomized DPS range waits for its calculate button', () => {
  const runButton = {};
  const container = {
    ...inertContainer(),
    querySelector: (selector) => (selector === '[data-role="rng-run"]' ? runButton : null)
  };
  let runCount = 0;

  mountRotationResults(
    container,
    {
      metrics: [],
      randomDistributionRequested: true,
      randomDistributionTrials: 500
    },
    {
      onRunRandomDistribution() {
        runCount += 1;
      }
    }
  );

  assert.match(container.innerHTML, /weapon strength and supported random procs/);
  assert.match(container.innerHTML, /500 simulations/);
  assert.match(container.innerHTML, /Calculate range/);
  assert.equal(typeof runButton.onclick, 'function');
  runButton.onclick();
  assert.equal(runCount, 1);
});

test('relic comparison passes the selected relic and shows stacks only for Thorns', () => {
  const runButton = {};
  const targetInput = { value: 'Thorns' };
  const stackInput = { value: '4' };
  const stackControl = { hidden: false };
  const container = {
    ...inertContainer(),
    querySelector: (selector) =>
      selector === '[data-role="relic-comparison-run"]'
        ? runButton
        : selector === '[data-role="relic-comparison-target"]'
          ? targetInput
          : selector === '[data-role="relic-comparison-stacks-control"]'
            ? stackControl
            : selector === '[data-role="relic-comparison-stacks"]'
              ? stackInput
              : null
  };
  let targetRelic = null;
  let startingStacks = null;

  mountRotationResults(
    container,
    {
      metrics: [],
      relicComparisonAvailable: true,
      relicComparisonOpponent: 'Fractal',
      relicComparisonTarget: 'Thorns',
      relicComparisonTargets: ['Akeem', 'Thorns'],
      relicComparisonInitialStacks: 4
    },
    {
      onRunRelicComparison(relic, stacks) {
        targetRelic = relic;
        startingStacks = stacks;
      }
    }
  );

  assert.match(container.innerHTML, /Relic break-even comparison/);
  assert.doesNotMatch(container.innerHTML, /Off by default/);
  assert.match(container.innerHTML, /<option value="Akeem">Relic of Akeem<\/option>/);
  assert.doesNotMatch(container.innerHTML, /value="Fractal"/);
  assert.match(container.innerHTML, /aria-label="Starting Thorns stacks"/);
  assert.match(container.innerHTML, /min="0" max="10" step="1" value="4"/);
  targetInput.value = 'Akeem';
  targetInput.onchange();
  assert.equal(stackControl.hidden, true);
  runButton.onclick();
  assert.equal(targetRelic, 'Akeem');
  assert.equal(startingStacks, 4);
});

test('relic comparison keeps its footprint while rerunning', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    metrics: [],
    relicComparisonAvailable: true,
    relicComparisonStale: true,
    relicComparisonOpponent: 'Fractal',
    relicComparisonTarget: 'Thorns',
    relicComparisonTargets: ['Thorns']
  });

  assert.match(container.innerHTML, /class="relic-cmp-skeleton" role="status"/);
  assert.match(container.innerHTML, /data-role="relic-comparison-run" disabled/);
  assert.match(container.innerHTML, /Running…/);
});

test('randomized DPS range renders completed simulations and percentage progress', () => {
  const container = inertContainer();

  mountRotationResults(container, {
    metrics: [],
    randomDistributionRequested: true,
    randomDistributionStale: true,
    randomDistributionTrials: 500,
    randomDistributionProgress: {
      completed: 125,
      total: 500,
      percent: 25
    }
  });

  assert.match(container.innerHTML, /role="progressbar"/);
  assert.match(container.innerHTML, /aria-valuenow="25"/);
  assert.match(container.innerHTML, /style="width: 25%"/);
  assert.match(container.innerHTML, /125 \/ 500 simulations \(25%\)/);
});

test('rotation warnings render a collapsed count and escaped details', () => {
  const container = inertContainer();

  mountRotationWarnings(container, [
    { time: '1.25s', message: 'Unsafe <script>' },
    { time: '2.50s', message: 'Missing resource' }
  ]);

  assert.match(container.innerHTML, /<details class="rotation-warnings-wrap">/);
  assert.doesNotMatch(container.innerHTML, /rotation-warnings-wrap" open/);
  assert.match(container.innerHTML, /Warnings \(2\)/);
  assert.match(container.innerHTML, /rotation-warning-time">1\.25s/);
  assert.match(container.innerHTML, /rotation-warning-time">2\.50s/);
  assert.match(container.innerHTML, /Unsafe &lt;script&gt;/);
  assert.doesNotMatch(container.innerHTML, /Unsafe <script>/);
  assert.match(container.innerHTML, /Missing resource/);

  mountRotationWarnings(container, ['Still unsafe'], { open: true });
  assert.match(container.innerHTML, /rotation-warnings-wrap" open/);

  mountRotationWarnings(container, []);
  assert.equal(container.innerHTML, '');
});

test('palette primitives escape values and render state, ammo, cooldowns, and groups', () => {
  const html = paletteSkillHtml({
    name: 'Skill"><bad>',
    skillId: 12345,
    title: 'Title"><bad>',
    icon: 'icon" onerror="bad',
    variantBadge: '<MAX>',
    color: '#abc',
    disabled: true,
    draggable: true,
    cooldownLabel: '<5s',
    ammo: { current: 1, maximum: 2, pips: [true, false] },
    resource: {
      id: 'endurance',
      label: 'Current endurance: 50/100',
      value: 50,
      maximum: 100
    }
  });

  assert.match(html, /pal-disabled/);
  assert.match(html, /draggable="false"/);
  assert.match(html, /1\/2/);
  assert.equal((html.match(/pal-ammo-pip filled/g) || []).length, 1);
  assert.match(html, /&lt;5s/);
  assert.match(paletteSkillHtml({ name: 'Missing icon' }), /src="data:image\/svg\+xml/);
  assert.match(html, /data-skill-id="12345"/);
  assert.match(html, /skill-variant-badge pal-variant-badge/);
  assert.match(html, /pal-has-resource/);
  assert.match(html, /data-resource-id="endurance"/);
  assert.match(html, /style="width:50%"/);
  assert.match(html, /aria-valuenow="50"/);
  assert.match(html, /&lt;MAX&gt;/);
  assert.doesNotMatch(html, /<bad>/);
  assert.doesNotMatch(html, /onerror="bad"/);
  assert.match(paletteSkillHtml({ name: 'Reserved', concealed: true }), /pal-concealed/);

  const virtualView = {
    name: 'Wait',
    title: 'Wait',
    icon: 'wait.png'
  };
  const virtual = virtualPaletteSkillHtml(virtualView);

  assert.match(virtual, /draggable="true"/);
  assert.match(
    paletteGroupHtml({
      label: '<Group>',
      statusIcon: {
        icon: 'pet.png',
        label: 'Fanged Iboga',
        title: 'Active pet: Fanged Iboga'
      },
      skills: [{ ...virtualView, virtual: true }]
    }),
    /&lt;Group&gt;/
  );
  assert.match(
    paletteGroupHtml({
      label: 'Pet',
      statusIcon: {
        icon: 'pet.png',
        label: 'Fanged Iboga',
        title: 'Active pet: Fanged Iboga'
      },
      skills: [virtualView]
    }),
    /Active pet: Fanged Iboga/
  );
  assert.match(
    paletteGroupHtml({
      id: 'resource-controls',
      label: 'Resource',
      controls: [
        {
          id: 'resource"><bad>',
          label: 'Resource control',
          icon: 'resource.png',
          color: '#abc',
          className: 'resource-control',
          active: true,
          pressed: true,
          muted: true,
          badge: 'S'
        }
      ]
    }),
    /data-palette-group="resource-controls"[\s\S]*class="pal-control resource-control pal-control-active pal-control-pressed pal-control-muted"[\s\S]*data-palette-control-id="resource&quot;&gt;&lt;bad&gt;"[\s\S]*class="pal-control-badge"/
  );
  assert.match(
    paletteGroupHtml({
      label: 'Reserved',
      className: 'pal-group-concealed',
      skills: [virtualView]
    }),
    /pal-group pal-group-concealed/
  );
});

test('palette controls delegate neutral control identities', () => {
  const control = {
    dataset: { paletteControlId: 'profession-resource:one' },
    onclick: null
  };
  let activated = '';

  bindPaletteInteractions(
    {
      querySelectorAll(selector) {
        return selector === '.pal-control[data-palette-control-id]' ? [control] : [];
      }
    },
    {
      onControlActivate(id) {
        activated = id;
      }
    }
  );

  control.onclick({});
  assert.equal(activated, 'profession-resource:one');
});

test('palette disclosures restore and persist their visibility', () => {
  const writes = [];
  const disclosure = {
    dataset: { paletteStorageKey: 'palette-panel-open' },
    open: true,
    ontoggle: null
  };

  bindPaletteInteractions({
    ownerDocument: {
      defaultView: {
        localStorage: {
          getItem: () => 'false',
          setItem: (key, value) => writes.push([key, value])
        }
      }
    },
    querySelectorAll(selector) {
      return selector === 'details[data-palette-storage-key]' ? [disclosure] : [];
    }
  });

  assert.equal(disclosure.open, false);
  disclosure.open = true;
  disclosure.ontoggle();
  assert.deepEqual(writes, [['palette-panel-open', 'true']]);
});

test('timeline canonical entries expose stable presentation names', () => {
  assert.equal(rotationEntryName({ type: 'cast', skillId: 'One' }), 'One');
  assert.equal(rotationEntryName({ type: 'wait', durationMs: 50 }), '__wait');
});

test('timeline binding inserts palette entries and drop positions use tile halves', () => {
  let dragState = { source: 'palette', name: 'New', skillId: 12345 };
  let changes = 0;
  const rotation = [{ type: 'cast', skillId: 'A' }];
  const root = {
    classList: { add() {}, remove() {} },
    querySelectorAll: () => []
  };
  const insertEntries = (entries, insertAt) => {
    if (!entries.length) return false;
    rotation.splice(insertAt, 0, ...entries);
    return true;
  };

  const binding = bindTimelineInteractions(root, {
    rotation,
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
  });

  assert.equal(binding.applyDrop(1), true);
  assert.deepEqual(rotation, [
    { type: 'cast', skillId: 'A' },
    { type: 'cast', skillId: 12345, interruptAfterMs: 100 }
  ]);
  assert.equal(dragState, null);
  assert.equal(changes, 1);

  dragState = { source: 'palette', name: 'Macro' };
  const macroBinding = bindTimelineInteractions(root, {
    rotation,
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
  });

  assert.equal(macroBinding.applyDrop(1), true);
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

test('timeline binding routes the wait pencil to duration editing', () => {
  let editedIndex = null;
  let propagationStopped = false;
  const waitPencil = { dataset: { idx: '2' } };
  const root = {
    classList: { add() {}, remove() {} },
    querySelectorAll(selector) {
      return selector === '.rot-edit-wait, .rot-wait-badge' ? [waitPencil] : [];
    }
  };

  // The pencil opens the editor without reporting a completed timeline mutation until Apply is used.
  bindTimelineInteractions(root, {
    rotation: [],
    getDragState: () => null,
    setDragState() {},
    moveEntry: () => false,
    insertEntries: () => false,
    onEditWait(index) {
      editedIndex = index;
      return false;
    }
  });
  waitPencil.onclick({
    stopPropagation() {
      propagationStopped = true;
    }
  });

  assert.equal(editedIndex, 2);
  assert.equal(propagationStopped, true);
});

test('event log CSV escapes cells', () => {
  const rows = [{ at: 0, type: 'action', description: 'CAST Quote "skill"' }];

  assert.match(eventLogCsv(rows), /"CAST Quote ""skill"""/);
});

test('event-log mounting filters rows, escapes descriptions, and configures filename', () => {
  let html = '';
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
      if (!mounted && selector.includes('event-log-details')) return { open: true };

      return null;
    },
    querySelectorAll(selector) {
      if (!mounted && selector.includes(':checked')) {
        return [{ dataset: { filterId: 'kept' } }];
      }

      return [];
    }
  };

  mountEventLog(
    container,
    [
      { at: 0, type: 'one', description: 'Keep <safe>', keep: true },
      { at: 1, type: 'two', description: 'Drop me', keep: false }
    ],
    {
      filename: 'custom"name.csv',
      filters: [
        {
          id: 'kept',
          label: 'Kept only',
          predicate: (row) => row.keep
        }
      ]
    }
  );

  assert.match(html, /Keep &lt;safe&gt;/);
  assert.doesNotMatch(html, /Drop me/);
  assert.match(html, /data-filename="custom&quot;name\.csv"/);
  assert.match(html, /log-filter-kept/);
});
