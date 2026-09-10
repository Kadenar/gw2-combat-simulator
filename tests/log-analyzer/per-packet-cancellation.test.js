import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { event, log } from '../helpers/evtc-fixture.js';

// Rounded imports use one cancellation boundary for damage and occupancy while retaining observed gaps and overlaps.
test('both log adapters quantize channel and atomic cancellations to the same action grid', () => {
  for (const source of ['evtc', 'report']) {
    for (const interruptMode of ['per-packet', 'commit']) {
      const catalog = createCanonicalCatalog({
        generated: [
          {
            id: 1000,
            name: 'Mind Stab',
            castTimeMs: 520,
            unaffectedByQuickness: true,
            interruptMode,
            effects: [200, 400].map((atMs) => ({
              type: 'strike',
              timingAnchor: 'castStart',
              persistsAfterInterrupt: true,
              interruptCommitMs: atMs,
              ticks: [
                { atMs, coefficient: 1 },
                { atMs, projectile: true, coefficient: 1 }
              ]
            }))
          },
          { id: 2000, name: 'Time Sink', castTimeMs: 80, unaffectedByQuickness: true, independentCast: true },
          { id: 3000, name: 'Blink', castTimeMs: 520, unaffectedByQuickness: true }
        ]
      });
      const profession = defineProfession({ id: 'quantization-contract', name: 'Quantization Contract', catalog });
      for (const duration of [379, 380, 381, 397, 400, 403, 420, 519, 520]) {
        for (const gap of [0, 200]) {
          const casts = [
            { id: 1000, start: 0, duration },
            { id: 2000, start: 160, duration: 80 },
            { id: 3000, start: duration + gap, duration: 520 }
          ];
          const imported =
            source === 'evtc'
              ? reconstructEvtcRotation(
                  log({
                    events: [
                      event({ time: 0, stateChange: 1 }),
                      ...casts.flatMap((cast) => [
                        event({ time: cast.start, skillId: cast.id, stateChange: 67, value: 520 }),
                        event({
                          time: cast.start + cast.duration,
                          skillId: cast.id,
                          stateChange: 68,
                          value: cast.duration,
                          activation: 3
                        })
                      ])
                    ].sort((left, right) => left.time - right.time)
                  }),
                  catalog
                )
              : reconstructDpsReportRotation(
                  parseDpsReport({
                    players: [
                      {
                        name: 'Fixture Chronomancer',
                        profession: 'Chronomancer',
                        rotation: casts.map((cast) => ({
                          id: cast.id,
                          skills: [{ castTime: cast.start, duration: cast.duration, timeGained: 0 }]
                        }))
                      }
                    ],
                    phases: [{ start: 0, end: 2000, name: 'Full Fight', phaseType: 'Encounter' }],
                    skillMap: Object.fromEntries(catalog.skills.map((skill) => [`s${skill.id}`, { name: skill.name }]))
                  }),
                  catalog
                );
          const replay = createScheduler({ profession }).run([...imported.rotation, { name: '__wait', waitMs: 1000 }]);
          const rounded = Math.round(duration / 40) * 40;
          const label = `${source}, ${interruptMode}, duration ${duration}, gap ${gap}`;
          const channel = replay.steps.find((step) => step.skillId === 1000);
          const overlap = replay.steps.find((step) => step.skillId === 2000);
          const following = replay.steps.find((step) => step.skillId === 3000);
          assert.equal(channel.end - channel.start, rounded, label);
          assert.equal(overlap.start, 160, label);
          assert.equal(following.start, rounded + gap, label);
          assert.deepEqual(
            replay.events
              .filter((event) => event.type === 'damage' && event.skillId === 1000)
              .map((event) => Math.round(event.at * 1000)),
            rounded < 400 ? [200, 200] : [200, 200, 400, 400],
            label
          );
          assert.deepEqual(
            imported.rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
            gap ? [gap] : [],
            label
          );
        }
      }
    }
  }
});
