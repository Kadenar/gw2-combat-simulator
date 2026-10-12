import assert from 'node:assert/strict';
import test from 'node:test';
import { rotationActionSummary } from '#gw2/integrations/logs/shared/rotation/summary.js';
import { resolvedActionIdentity } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/reconstruct.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/reconstruct.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';

// Projection preserves resolved identity and the source clock, leaving evidence ownership to each adapter.
test('action summaries preserve catalog, canonical, and unmatched identities', () => {
  const source = {
    start: 1000,
    end: 1200,
    rawSkillId: 1000,
    rawName: 'Source',
    status: 'unknown',
    evidence: 'animation',
    metadataAccurate: false
  };
  const canonical = { ...source, canonicalSkillId: 0, canonicalName: 'Canonical' };
  for (const [action, skill, id, name, kind] of [
    [source, null, 1000, 'Source', 'unknown'],
    [canonical, null, 0, 'Canonical', 'unknown'],
    [canonical, { id: 2000, name: 'Selected', type: 'Weapon' }, 2000, 'Selected', 'weapon-skill']
  ]) {
    const summary = rotationActionSummary({ ...action, ...resolvedActionIdentity(action, skill) }, 900);
    assert.equal(summary.rawSkillId, source.rawSkillId);
    assert.equal(summary.skillId, id);
    assert.equal(summary.name, name);
    assert.equal(summary.kind, kind);
    assert.equal(summary.status, source.status);
    assert.equal(summary.supportedByCatalog, skill != null);
    assert.equal(summary.timestampMs + 900, source.start);
    assert.equal(summary.endTimestampMs + 900, source.end);
    assert.equal(Object.hasOwn(summary, 'evidence'), false);
    assert.equal(Object.hasOwn(summary, 'metadataAccurate'), false);
  }
});

test('both adapters retain source provenance beside the common resolved identity', () => {
  const catalog = { skills: [{ id: 2000, name: 'Observed', type: 'Weapon', castTimeMs: 500, effects: [] }] };
  const report = reconstructDpsReportRotation(
    {
      players: [
        {
          name: 'Fixture',
          profession: 'Chronomancer',
          rotation: [{ id: 1000, skills: [{ castTime: 1000, duration: 500 }] }]
        }
      ],
      phases: [{ name: 'Encounter', start: 0, end: 3000 }],
      skillMap: { s1000: { name: 'Observed', isNotAccurate: true } }
    },
    catalog
  );
  const evtc = reconstructEvtcRotation(
    log({
      skills: [{ id: 1000, name: 'Observed' }],
      events: [
        event({ time: 1000, skillId: 1000, stateChange: 67, value: 500 }),
        event({ time: 1500, skillId: 1000, stateChange: 68, activation: 5, value: 500 })
      ]
    }),
    catalog
  );
  for (const result of [report, evtc]) {
    const action = result.actions.find((candidate) => candidate.rawSkillId === 1000);
    assert.equal(action.skillId, 2000);
    assert.equal(action.name, 'Observed');
    assert.equal(action.kind, 'weapon-skill');
    assert.equal(action.supportedByCatalog, true);
  }

  assert.equal(report.actions[0].metadataAccurate, false);
  assert.equal(Object.hasOwn(report.actions[0], 'evidence'), false);
  assert.equal(evtc.actions[0].evidence, 'animation');
  assert.equal(evtc.actions[0].metadataAccurate, true);
  assert.equal(evtc.actions[0].eiRule, evtc.sourceActions[0].eiRule);
  assert.equal(evtc.actions[0].castOrigin, evtc.sourceActions[0].castOrigin);
});
