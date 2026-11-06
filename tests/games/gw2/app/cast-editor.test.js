/** Exercises the profession-owned editor model through the public presentation interface. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { formatTimelineTime } from '#gw2/app/shared/result-clock.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

const skill = warriorProfession.catalog.skillsById.get(62797);
const editor = () => warriorProfession.ui.castEditor({ specialization: 'Bladesworn' }, skill);

function preparation({ unavailable = false, rejected = false, command } = {}) {
  const requests = [];
  return {
    requests,
    input: {
      command,
      formatTime: (ms) => formatTimelineTime(ms, 3960, 3),
      preview(candidate) {
        requests.push(candidate);
        return candidate
          ? {
              steps: [{ activationId: 'candidate', invalidReason: 'Insufficient Flow' }],
              events: rejected
                ? []
                : [
                    {
                      type: 'resource',
                      reason: 'profession mechanic',
                      resource: 'dragon charges',
                      activationId: 'candidate',
                      chargesReached: 10,
                      at: 27.24,
                      flowAfter: 44.72,
                      coefficient: 20.4
                    }
                  ],
              planningState: { atSeconds: 24.76 }
            }
          : {
              steps: [],
              events: [
                {
                  type: 'resource',
                  reason: 'dragon trigger entry',
                  at: 24.76,
                  maximumCharges: 10,
                  chargesPerInterval: 10
                }
              ],
              planningState: { atSeconds: 24.76, profession: { [STATE.DRAGON_TRIGGER_ACTIVE]: !unavailable } }
            };
      }
    }
  };
}

test('active specialization recognizes the editor without preparing previews', () => {
  const f = preparation();
  assert.ok(editor());
  assert.deepEqual(f.requests, []);
  assert.equal(warriorProfession.ui.castEditor({ specialization: 'Core' }, skill), null);
  assert.equal(warriorProfession.ui.castEditor({ specialization: 'Bladesworn' }, { id: 1, name: 'Ordinary' }), null);
});

test('choice preparation owns combat-relative wording and preserves candidate options without the hold', () => {
  const command = { type: 'cast', skillId: skill.id, releaseAtCharges: 10, releaseDelayMs: 120, offTarget: true };
  const f = preparation({ command });
  const model = editor().prepare(f.input);
  assert.equal(model.choices[1].label, '10 charges · 23.280s (+2.480s) · 44.72 Flow · 20.40 coefficient');
  assert.equal(model.selectedChoiceId, '10');
  assert.equal(model.delay.valueMs, 120);
  assert.equal(f.requests[1].offTarget, true);
  assert.equal(f.requests[1].releaseDelayMs, undefined);
  assert.equal(command.releaseDelayMs, 120);
  assert.deepEqual(model.apply('maximum', 0), { releaseAtCharges: undefined, releaseDelayMs: undefined });
  assert.deepEqual(model.apply('10', 120), { releaseAtCharges: 10, releaseDelayMs: 120 });
  assert.equal(model.apply('unknown', 0), null);
  for (const invalid of [-40, 1, NaN, Infinity]) assert.equal(model.apply('10', invalid), null);
});

test('unreachable choices carry a reason without invented numbers and select maximum', () => {
  const f = preparation({ rejected: true, command: { type: 'cast', skillId: skill.id, releaseAtCharges: 10 } });
  const model = editor().prepare(f.input);
  assert.equal(model.choices[1].label, '10 charges · unavailable');
  assert.equal(model.choices[1].reason, 'Insufficient Flow');
  assert.equal(model.selectedChoiceId, 'maximum');
  assert.equal(model.apply('10', 0), null);
  const unavailable = editor().prepare(preparation({ unavailable: true }).input);
  assert.equal(unavailable.choices.length, 1);
  assert.match(unavailable.unavailableMessage, /Enter Dragon Trigger/);
});

test('Dragon Slash editor choices execute prefix candidates through the application adapter', async () => {
  const adapter = await loadProfessionAppAdapter('warrior');
  const build = createDefaultBuild(adapter);
  build.weapons = ['Sword', 'Pistol'];
  build.initialResource = 100;
  build.specializations = [{ name: 'Bladesworn', traits: '1-2-2' }];
  const skills = adapter.profession.catalog.skills;
  const skill = skills.find((skill) => skill.name === 'Dragon Slash-Force');
  build.rotation = [
    { type: 'cast', skillId: skills.find((skill) => skill.name === 'Dragon Trigger').id },
    { type: 'wait', durationMs: 1000 },
    { type: 'combat-start' }
  ];
  const app = {
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    adapter,
    build,
    activeCatalog: adapter.profession.catalog,
    attributeWeaponSet: 1,
    analysis: {
      state: {
        buildRevision: 0,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null,
        results: null
      }
    }
  };
  app.attributeData = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: app.patch
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const preview = (command) => adapter.rotationPreviewAt(app, 1, command ? [command] : []);
  const prefix = preview();
  assert.equal(prefix.planningState.atSeconds, 0);
  assert.equal(prefix.combatStartTime, 1);
  const descriptor = adapter.profession.ui.castEditor({ specialization: 'Bladesworn' }, skill);
  const projection = descriptor.prepare({ preview, formatTime: (ms) => formatTimelineTime(ms, 0, 3) });
  assert.equal(projection.unavailableMessage, undefined);
  assert.ok(projection.choices.length > 1);
  const row = projection.choices.at(-1);
  const actual = preview({ type: 'cast', skillId: skill.id, ...projection.apply(row.id, 0) });
  assert.deepEqual(actual.warnings, []);
  const release = actual.events.find(
    (event) => event.reason === 'profession mechanic' && event.resource === 'dragon charges'
  );
  assert.ok(row.label.includes(formatTimelineTime(release.at * 1000, 0, 3)));
  assert.ok(row.label.includes(`${release.flowAfter.toFixed(2)} Flow`));
  assert.ok(row.label.includes(`${release.coefficient.toFixed(2)} coefficient`));
  assert.equal(
    descriptor.prepare({ preview: () => adapter.rotationPreviewAt(app, 0), formatTime: String }).unavailableMessage,
    'Enter Dragon Trigger before using this skill.'
  );
});
