import assert from 'node:assert/strict';
import test from 'node:test';

test('rotation profiler rejects invalid CLI selections before running simulations', async () => {
  // Fail malformed capture options and profession IDs instead of silently profiling the wrong cases.
  const originalArgv = process.argv;
  try {
    for (const [index, [args, error]] of [
      [['--filter'], /argument missing/i],
      [['--cpu-profile-dir'], /argument missing/i],
      [['--unknown'], /unknown option/i],
      [['not-a-profession'], /Unknown profession/]
    ].entries()) {
      process.argv = [process.execPath, 'benchmark-supported-rotations.mjs', ...args];
      await assert.rejects(import(`../../scripts/analysis/benchmark-supported-rotations.mjs?invalid=${index}`), error);
    }
  } finally {
    process.argv = originalArgv;
  }
});
