import assert from 'node:assert/strict';
import test from 'node:test';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { EffectRecorder, effectStateAt } from '#gw2/platform/results/effect-report.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// Acceptance and packet-free tasks mutate native state at shared instants, including the terminal boundary.
function captureFixture() {
  let persistent = 0;
  let transient = 0;
  return defineTestProfession({
    id: 'effect-capture',
    name: 'Effect capture',
    catalog: createCanonicalCatalog({
      generated: [{ id: 990101, name: 'Grant', castTimeMs: 0, effects: [] }]
    }),
    hooks: {
      initialize(runtime) {
        runtime.schedule('set', 1, { persistent: 1, transient: 1 });
        runtime.schedule('set', 1, { persistent: 2, transient: 0 });
        runtime.schedule('set', 2, { persistent: 3, transient: 0 });
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            at: 1,
            flatDamage: 10,
            source: 'Test',
            sourceId: 'test.hit',
            actorType: 'player'
          }
        });
      },
      onCastStart() {
        persistent = 1;
      },
      tasks: {
        set(_runtime, counts) {
          persistent = counts.persistent;
          transient = counts.transient;
        }
      },
      observeEffects: () => [
        timedEffectState('persistent', [{ stacks: persistent, expiresAt: null }]),
        timedEffectState('transient', [{ stacks: transient, expiresAt: null }])
      ]
    }
  });
}

// Record one settled native scope per timestamp, preserving zero-length runs and lethal siblings but excluding later state.
for (const [label, durationMs, health, captureTimes, terminalCount] of [
  ['rotation end', 2000, 0, [0, 1, 2], 3],
  ['target death', 2000, 1, [0, 1], 2],
  ['zero-length run', 0, 0, [0], 1]
]) {
  test(`chart captures settle once per timestamp through ${label}`, (t) => {
    const capture = t.mock.method(EffectRecorder.prototype, 'capture');
    const result = simulateGw2({
      profession: captureFixture(),
      rotation: [990101, { type: 'wait', durationMs }],
      config: { target: { health } }
    });
    const calls = capture.mock.calls.filter(({ arguments: args }) => args[2] === 'buff:persistent');
    assert.deepEqual(
      calls.map(({ arguments: args }) => args[0]),
      captureTimes
    );
    const persistent = result.effectReport.tracks.find((track) => track.kind === 'persistent');
    const transient = result.effectReport.tracks.find((track) => track.kind === 'transient');
    assert.equal(result.effectReport.end, captureTimes.at(-1));
    assert.equal(persistent.terminal.count, terminalCount);
    assert.deepEqual(transient.segments, []);
    assert.equal(transient.terminal.count, 0);
    if (durationMs) assert.equal(effectStateAt(result.effectReport, persistent, 0.5).count, 1);
    if (durationMs && !health) assert.equal(effectStateAt(result.effectReport, persistent, 1.5).count, 2);
    assert.deepEqual(result.warnings, []);
  });
}

// Visible interval starts determine order, with stable IDs for ties and terminal-only tracks at the report boundary.
test('effect track ordering is independent of same-timestamp capture order', () => {
  for (const kinds of [
    ['zeta', 'alpha'],
    ['alpha', 'zeta']
  ]) {
    const recorder = new EffectRecorder();
    const state = (kind, stacks = 1) => timedEffectState(kind, [{ stacks, expiresAt: null }]);
    recorder.capture(0, [state('delayed', 0)], 'delayed');
    recorder.capture(0, [state('early')], 'early');
    for (const kind of kinds) recorder.capture(1, [state(kind)], kind);
    recorder.capture(2, [state('delayed')], 'delayed');
    for (const kind of [...kinds].reverse()) recorder.capture(3, [state(`terminal-${kind}`)], `terminal-${kind}`);
    const report = recorder.finish(3);
    assert.deepEqual(
      report.tracks.map((track) => track.kind),
      ['early', 'alpha', 'zeta', 'delayed', 'terminal-alpha', 'terminal-zeta']
    );
    assert.equal(report.tracks.at(-1).segments.length, 0);
    assert.equal(report.tracks.at(-1).terminal.count, 1);
  }
});
