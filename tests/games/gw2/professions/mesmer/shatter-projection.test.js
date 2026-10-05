import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';

/** Compare one committed spend with its tooltip tier, keeping preview and live catalogs independently selectable. */
function scenario(profession, patchId, specialization, skillId, spent, selectedTraitIds = []) {
  const context = profession.balanceContextFor(patchId);
  const skill = context.catalog.skillsById.get(skillId);
  const tooltip = describeSimulationSkill(context, skill, mesmerTooltips);
  assert.ok(!tooltip.incomplete);
  const qualifier = `${spent} ${specialization === 'Virtuoso' ? 'blades' : 'clones'} spent`;
  const result = runMesmer(
    [skill.name, { type: 'wait', durationMs: 2000 }],
    { ...createDefaultConfig(), patchId, specialization, initialResource: spent, selectedTraitIds },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  return {
    facts: tooltip.facts.filter(({ detail }) => detail.includes(qualifier)),
    events: result.events.filter((event) => event.skillId === skillId),
    result
  };
}

function preview(balanceProfiles) {
  return withPatchPreview(mesmerProfession, {
    id: 'shatter-projection',
    label: 'Shatter projection',
    professions: { mesmer: { balanceProfiles } }
  });
}

// A tier deletion must not shift the surviving tier, and each repeated packet keeps its own formula.
test('clone shatter tooltips and combat share selected repeat packets without relabeling resource tiers', () => {
  const profession = preview({
    'mesmer.chronomancer.split-second': {
      removeEffects: [{ type: 'strike', name: '1 resources' }],
      effects: [
        { type: 'strike', name: '2 resources', tickIndex: 0, coefficient: 1.5 },
        { type: 'strike', name: '2 resources', tickIndex: 1, coefficient: 2.5 }
      ]
    }
  });
  const patched = scenario(profession, 'shatter-projection', 'Chronomancer', ID.SPLIT_SECOND, 2);
  const strikes = patched.events.filter((event) => event.type === 'damage');
  assert.equal(strikes.length, 6);
  assert.deepEqual(
    strikes.map(({ coefficient }) => coefficient),
    [0.5, 0.5, 0.5, 2.5 / 3, 2.5 / 3, 2.5 / 3]
  );
  assert.deepEqual(
    patched.facts.filter(({ name }) => name === 'Strike damage').map(({ detail }) => detail),
    ['1.5 coefficient total · 3 hits — 2 clones spent', '2.5 coefficient total · 3 hits — 2 clones spent']
  );
  const removed = scenario(profession, 'shatter-projection', 'Chronomancer', ID.SPLIT_SECOND, 1);
  assert.equal(
    removed.events.some(({ type }) => type === 'damage'),
    false
  );
  assert.equal(
    removed.facts.some(({ name }) => name === 'Strike damage'),
    false
  );
  const current = scenario(profession, 'current', 'Chronomancer', ID.SPLIT_SECOND, 1);
  assert.ok(current.events.some(({ type }) => type === 'damage'));
  assert.ok(current.facts.some(({ name }) => name === 'Strike damage'));
});

// The player contributes a Confusion source even at zero clones; preview edits affect every source exactly once.
test('clone shatter Confusion uses the same selected stack budget in tooltips and combat', () => {
  const profession = preview({
    'mesmer.core.cry-of-frustration': {
      effects: [{ type: 'condition', name: 'Confusion', stacks: 2 }]
    }
  });
  for (const [patchId, stacksPerSource] of [
    ['current', 1],
    ['shatter-projection', 2]
  ]) {
    for (const spent of [0, 2]) {
      const { facts, events } = scenario(profession, patchId, 'Core', ID.CRY_OF_FRUSTRATION, spent);
      const expected = stacksPerSource * (spent + 1);
      const fact = facts.find(({ name }) => name === 'Confusion');
      assert.equal(fact.stacks, expected);
      assert.equal(fact.applications, 1);
      const confusion = events.filter((event) => event.type === 'condition' && event.condition === 'Confusion');
      assert.equal(confusion.length, 1);
      assert.equal(confusion[0].stacks, expected);
    }
  }
});

// Blade count does not determine condition applications when the selected strike has a different packet cadence.
test('Bladesong Confusion tooltips follow selected packet cadence rather than blades spent', () => {
  const profession = preview({
    'mesmer.virtuoso.bladesong-sorrow': {
      removeEffects: [{ type: 'strike', name: '2 resources' }],
      addEffects: [
        {
          type: 'strike',
          name: '2 resources',
          ticks: [
            { atMs: 1000, coefficient: 0.2 },
            { atMs: 1100, coefficient: 0.3 },
            { atMs: 1200, coefficient: 0.5 }
          ]
        }
      ],
      effects: [{ type: 'condition', name: 'Confusion', stacks: 2 }]
    }
  });
  for (const [patchId, applications, stacks] of [
    ['current', 2, 1],
    ['shatter-projection', 3, 2]
  ]) {
    const { facts, events } = scenario(profession, patchId, 'Virtuoso', ID.BLADESONG_SORROW, 2);
    const confusion = events.filter((event) => event.type === 'condition' && event.condition === 'Confusion');
    const fact = facts.find(({ name }) => name === 'Confusion');
    assert.equal(fact.applications, applications);
    assert.equal(fact.stacks, stacks);
    assert.equal(confusion.length, applications);
    assert.ok(confusion.every((event) => event.stacks === stacks));
    if (patchId === 'shatter-projection') {
      assert.deepEqual(
        events.filter(({ type }) => type === 'damage').map(({ coefficient }) => coefficient),
        [0.2, 0.3, 0.5]
      );
      assert.equal(
        facts.find(({ name }) => name === 'Strike damage').detail,
        '1 coefficient total · 3 hits — 2 blades spent'
      );
    }
  }
});

// Removing damage preserves independent Confusion cadence while suppressing hit-triggered traits.
test('removed blade strikes retain condition facts and combat applications without restoring damage', () => {
  const profession = preview({
    'mesmer.virtuoso.bladesong-sorrow': {
      removeEffects: [{ type: 'strike', name: '2 resources' }],
      effects: [{ type: 'condition', name: 'Confusion', stacks: 2 }]
    }
  });
  const { facts, events, result } = scenario(profession, 'shatter-projection', 'Virtuoso', ID.BLADESONG_SORROW, 2, [
    TRAIT.MAIM_THE_DISILLUSIONED
  ]);
  assert.equal(
    facts.some(({ name }) => name === 'Strike damage'),
    false
  );
  const confusion = facts.find(({ name }) => name === 'Confusion');
  assert.equal(confusion.stacks, 2);
  assert.equal(confusion.applications, 2);
  assert.equal(events.filter((event) => event.type === 'condition' && event.condition === 'Confusion').length, 2);
  assert.equal(
    events.some(({ type }) => type === 'damage'),
    false
  );
  assert.equal(
    result.events.some((event) => event.type === 'condition' && event.condition === 'Torment'),
    false
  );
  assert.equal(result.planningState.profession.resource, 0);
});

// Control shatters project the entire emitted skill payload, including Time Sink's companion condition.
test('Time Sink tooltip includes the same per-source Slow applications emitted by combat', () => {
  const { facts, events } = scenario(preview({}), 'current', 'Chronomancer', ID.TIME_SINK, 2);
  const slow = facts.find(({ name }) => name === 'Slow');
  assert.equal(slow.applications, 3);
  assert.equal(slow.stacks, 1);
  const conditions = events.filter((event) => event.type === 'condition' && event.condition === 'Slow');
  assert.equal(
    conditions.reduce((sum, event) => sum + event.stacks, 0),
    3
  );
});

// Zero-damage defensive tiers retain hit identity, whereas removed tiers cannot activate hit traits.
test('defensive shatter projections preserve the distinction between authored zero and removed strikes', () => {
  for (const [specialization, skillId, profileId] of [
    ['Core', ID.DISTORTION, 'mesmer.core.distortion'],
    ['Virtuoso', ID.BLADESONG_DISTORTION, 'mesmer.virtuoso.bladesong-distortion']
  ]) {
    const profession = preview({ [profileId]: { removeEffects: [{ type: 'strike', name: '2 resources' }] } });
    for (const patchId of ['current', 'shatter-projection']) {
      const { facts, result } = scenario(profession, patchId, specialization, skillId, 2, [
        TRAIT.MAIM_THE_DISILLUSIONED
      ]);
      assert.equal(
        facts.some(({ name }) => name === 'Strike damage'),
        false
      );
      assert.equal(
        result.events.some((event) => event.type === 'condition' && event.condition === 'Torment'),
        patchId === 'current'
      );
    }
  }
});

// Removing a condition must remove only its projection, preserving the selected strike in both consumers.
test('removed shatter Confusion disappears from tooltips and combat while damage survives', () => {
  for (const [specialization, skillId, profileId] of [
    ['Core', ID.CRY_OF_FRUSTRATION, 'mesmer.core.cry-of-frustration'],
    ['Virtuoso', ID.BLADESONG_SORROW, 'mesmer.virtuoso.bladesong-sorrow']
  ]) {
    const profession = preview({ [profileId]: { removeEffects: [{ type: 'condition', name: 'Confusion' }] } });
    const { facts, events } = scenario(profession, 'shatter-projection', specialization, skillId, 2);
    assert.equal(
      facts.some(({ name }) => name === 'Confusion'),
      false
    );
    assert.equal(
      events.some((event) => event.type === 'condition' && event.condition === 'Confusion'),
      false
    );
    assert.ok(facts.some(({ name }) => name === 'Strike damage'));
    assert.ok(events.some(({ type }) => type === 'damage'));
  }
});
