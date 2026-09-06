/** Measures real browser worker pools and cancellation on representative rotations; starts a private Vite server. */
/* global window, document, requestAnimationFrame, cancelAnimationFrame */
import { spawn, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { chromium } from '@playwright/test';

const server = spawn(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    "import { createServer } from 'vite'; const server = await createServer({ server: { host: '127.0.0.1', port: 4179, strictPort: true, watch: null } }); await server.listen();"
  ],
  { stdio: 'ignore', windowsHide: true }
);
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch('http://127.0.0.1:4179')).ok) break;
    } catch {
      /* Server is still starting. */
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.text().startsWith('optimizer-benchmark:')) process.stderr.write(`${message.text()}\n`);
  });
  const rows = [];
  for (const profession of process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['elementalist', 'necromancer', 'ranger']) {
    const manifest = JSON.parse(await readFile(`data/gw2/builds/${profession}/manifest.json`, 'utf8'));
    const preset = manifest.flatMap((section) => section.presets).find((entry) => entry.rotation);
    const build = JSON.parse(await readFile(preset.build, 'utf8'));
    const rotation = JSON.parse(await readFile(preset.rotation, 'utf8'));
    await page.goto(`http://127.0.0.1:4179/${profession}.html`);
    await page.waitForFunction(
      () => window.professionApp && document.getElementById('loading-overlay').classList.contains('hidden')
    );
    rows.push(
      ...(await page.evaluate(
        async ({ build, rotation, profession }) => {
          const { captureGearOptimizerRequest, optimizerSlots } =
            await import('/js/games/gw2/app/simulation/gear-optimizer.ts');
          const { GearOptimizerRunner } = await import('/js/games/gw2/app/simulation/gear-optimizer-runner.ts');
          const app = window.professionApp;
          app.build = app.adapter.toApplicationBuild({ ...build, rotation: rotation.rotation ?? rotation });
          app.changed();
          while (app.simulationStatus !== 'idle') await new Promise((resolve) => setTimeout(resolve, 10));
          app.randomDistributionRunner.cancel?.();
          app.modifierContributionRunner.cancel?.();
          app.relicComparisonRunner.cancel?.();
          const request = captureGearOptimizerRequest(app, {
            prefixes: ["Berserker's", "Assassin's", "Viper's"],
            locks: optimizerSlots(app.build, app.adapter).filter(
              (slot) => !['Helm', 'Shoulders', 'Chest', 'Gloves', 'Leggins', 'Boots'].includes(slot)
            )
          });
          const output = [];
          for (const workers of [1, 2, 4]) {
            const runs = [];
            // Three cold pools per size report medians including initialization and finalist verification.
            for (let run = 0; run < 3; run++) {
              runs.push(
                await new Promise((resolve, reject) => {
                  let firstResultMs = null;
                  let maxFrameGapMs = 0;
                  let previousFrame = performance.now();
                  let frame;
                  const sampleFrame = () => {
                    const now = performance.now();
                    maxFrameGapMs = Math.max(maxFrameGapMs, now - previousFrame);
                    previousFrame = now;
                    frame = requestAnimationFrame(sampleFrame);
                  };

                  frame = requestAnimationFrame(sampleFrame);
                  const runner = new GearOptimizerRunner(
                    app,
                    () => {
                      const state = runner.state;
                      if (state.winners.length && firstResultMs === null) firstResultMs = state.elapsedMs;
                      if (state.status === 'failed') {
                        cancelAnimationFrame(frame);
                        reject(new Error(state.error));
                      }

                      if (state.status === 'complete') {
                        cancelAnimationFrame(frame);
                        resolve({
                          elapsedMs: state.elapsedMs,
                          firstResultMs,
                          maxFrameGapMs,
                          rawCount: state.rawCount.toString(),
                          groupedCount: state.count.toString(),
                          simulations: state.simulations.toString(),
                          winnerKeys: state.winners.map((winner) => winner.key),
                          warnings: [...state.warnings.keys()],
                          heapBytes: performance.memory?.usedJSHeapSize ?? null
                        });
                      }
                    },
                    undefined,
                    workers
                  );
                  runner.run(request);
                })
              );
            }

            runs.sort((a, b) => a.elapsedMs - b.elapsedMs);
            output.push({ profession, workers, ...runs[1] });
            console.info(
              `optimizer-benchmark: ${profession}, ${workers} workers, ${runs[1].groupedCount} unique candidates, ${Math.round(runs[1].elapsedMs)} ms median`
            );
          }

          const large = captureGearOptimizerRequest(app, { prefixes: ["Berserker's", "Assassin's", "Viper's"] });
          const cancelMs = await new Promise((resolve) => {
            const runner = new GearOptimizerRunner(app, () => {
              if (runner.state.status === 'preparing') {
                const start = performance.now();
                runner.cancel();
                resolve(performance.now() - start);
              }
            });
            runner.run(large);
          });
          output.forEach((row) => {
            row.cancelMs = cancelMs;
          });
          return output;
        },
        { build, rotation, profession }
      ))
    );
  }

  for (const row of rows) {
    const reference = rows.find((entry) => entry.profession === row.profession);
    if (JSON.stringify(row.winnerKeys) !== JSON.stringify(reference.winnerKeys) || row.rawCount !== reference.rawCount)
      throw new Error('Worker-count ranking or coverage mismatch.');
  }

  rows.forEach((row) => {
    delete row.winnerKeys;
  });

  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        cpu: cpus()[0].model,
        revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        rows
      },
      null,
      2
    )
  );
} finally {
  await browser?.close();
  server.kill();
}
