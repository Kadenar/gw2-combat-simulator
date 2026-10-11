import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

const trait = { source: 'Trait', sourceId: TRAIT.MASTER_FENCER, actorType: 'effect' };
const proc = {
  ...trait,
  type: 'proc',
  procType: 'trait',
  name: 'Master Fencer',
  eventOrder: 2,
  parentEventOrder: 1,
  at: 1
};
const buff = {
  ...trait,
  type: 'buff',
  kind: 'fury',
  stacks: 1,
  duration: 12,
  at: 1,
  parentEventOrder: 2,
  eventOrder: 3,
  audience: { recipients: 'self' }
};
const hit = {
  type: 'damage',
  at: 1,
  eventOrder: 1,
  source: 'Player',
  sourceId: 10,
  actorType: 'player',
  name: 'Strike',
  skillName: 'Strike',
  damage: 10
};
const present = (events, resolvedEvents = [hit]) =>
  simulationEventLogRows({ events, resolvedEvents }, null, mesmerProfession);

// Consolidation follows explicit proc ownership and derives duration and recipient labels from the grants.
test('trait grants consolidate beneath their trigger without losing applications or descendant ownership', () => {
  const events = [
    proc,
    buff,
    {
      ...buff,
      eventOrder: 4,
      duration: 6,
      audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 4 },
      resolvedAudience: {
        includesSelf: false,
        includesSummons: false,
        alliedPlayerCount: 2,
        companionIds: [],
        recipientCount: 2
      }
    },
    {
      type: 'marker',
      source: 'Runtime',
      actorType: 'environment',
      at: 1,
      eventOrder: 5,
      parentEventOrder: 4,
      name: 'Grant reaction'
    }
  ];
  const before = structuredClone(events);
  const rows = present(events);
  const summary = rows.find((row) => row.id === 'event:2');
  assert.equal(summary.description, 'Master Fencer → Fury x1 · self 12s; x1 · 2 allies 6s');
  assert.equal(summary.parentId, 'event:1');
  assert.equal(summary.source.id, 'trait');
  assert.equal(summary.tag.label, 'Fury');
  assert.equal(summary.details.length, 2);
  assert.match(summary.details[1], /2 allies 6s.*event 4/);
  assert.equal(rows.find((row) => row.id === 'event:5').parentId, summary.id);
  assert.ok(!rows.some((row) => row.id === 'event:3' || row.id === 'event:4'));
  assert.deepEqual(events, before);
});

// Matching timestamps and labels cannot merge separate causes, separate traits, or unattributed applications.
test('trait grouping keeps distinct causes and sources separate and resolves names by source ID', () => {
  const events = [
    { ...buff, parentEventOrder: 1, skillName: 'Strike', name: 'Application' },
    { ...buff, eventOrder: 4, parentEventOrder: 10 },
    { ...buff, eventOrder: 5, parentEventOrder: 1, sourceId: TRAIT.CRITICAL_INFUSION, skillName: 'Strike' },
    { ...buff, eventOrder: 6, parentEventOrder: undefined },
    { ...buff, eventOrder: 7, parentEventOrder: undefined }
  ];
  const rows = present(events, [hit, { ...hit, eventOrder: 10 }]);
  for (const event of events) assert.ok(rows.some((row) => row.id === `event:${event.eventOrder}`));
  assert.match(rows.find((row) => row.id === 'event:3').description, /^Master Fencer → Fury/);
  assert.match(rows.find((row) => row.id === 'event:5').description, /^Critical Infusion → Fury/);
  assert.equal(rows.find((row) => row.id === 'event:4').parentId, 'event:10');
});

// Informational procs and procs with other effects must retain their independent meaning.
test('consolidation preserves proc details, other effects, and zero-recipient grants', () => {
  for (const extra of [{ detail: 'Arms another effect' }, {}]) {
    const events = [
      { ...proc, ...extra },
      {
        ...buff,
        resolvedAudience: {
          includesSelf: false,
          includesSummons: false,
          alliedPlayerCount: 0,
          companionIds: [],
          recipientCount: 0
        }
      },
      ...(!extra.detail ? [{ ...buff, eventOrder: 4, kind: 'might' }] : [])
    ];
    const rows = present(events);
    if (extra.detail) {
      // A consolidated row retains non-buff benefits instead of discarding their explanation.
      assert.match(rows.find((row) => row.id === 'event:2').description, /no recipients 12s.*Arms another effect/);
      assert.ok(!rows.some((row) => row.id === 'event:3'));
    } else {
      const summary = rows.find((row) => row.id === 'event:2');
      assert.match(summary.description, /Master Fencer → Fury.*no recipients 12s; Might.*self 12s/);
      assert.equal(summary.details.length, 2);
      assert.ok(!rows.some((row) => ['event:3', 'event:4'].includes(row.id)));
    }
  }
});

// A minimal real critical hit verifies the producer's canonical identity and proc-to-grant provenance contract.
test('Master Fencer records its trait ID and owns both Fury grants while Critical Infusion names Vigor', () => {
  const result = simulateMesmer(['Flying Cutter', { type: 'wait', durationMs: 1 }], {
    selectedTraitIds: [TRAIT.MASTER_FENCER, TRAIT.CRITICAL_INFUSION],
    attributeInputs: baseAttributeInputs({ precision: 3000, concentration: 750 }),
    allies: { count: 2, strikesPerSecond: 0 }
  });
  assert.deepEqual(result.warnings, []);
  const trigger = result.events.find((event) => event.type === 'proc' && event.sourceId === TRAIT.MASTER_FENCER);
  assert.ok(trigger);
  const grants = result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.MASTER_FENCER);
  assert.equal(grants.length, 2);
  assert.ok(grants.every((event) => event.parentEventOrder === trigger.eventOrder));
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.eventOrder === trigger.parentEventOrder)
  );
  const rows = simulationEventLogRows(result, null, mesmerProfession);
  assert.match(
    rows.find((row) => row.id === `event:${trigger.eventOrder}`).description,
    /Master Fencer → Fury.*self 12s.*2 allies 6s/
  );
  assert.ok(rows.some((row) => /^Critical Infusion → Vigor.*self 7.5s/.test(row.description)));
});

// Each producer must keep its scheduled marker and attach the real grants to that activation.
for (const [traitId, specialization, rotation, extra] of [
  [TRAIT.FENCERS_FINESSE, 'Core', ['Mind Slash'], { primaryWeapon: 'Sword' }],
  [TRAIT.ILLUSIONARY_MEMBRANE, 'Core', ['Cry of Frustration']],
  [TRAIT.COMPOUNDING_POWER, 'Core', ['Illusionary Leap'], { primaryWeapon: 'Sword', initialResource: 0 }],
  [TRAIT.DEADLY_BLADES, 'Virtuoso', ['Bladesong Harmony']],
  [TRAIT.DANGER_TIME, 'Chronomancer', ['Time Sink']],
  [TRAIT.STRETCHED_TIME, 'Chronomancer', ['Split Second']],
  [TRAIT.SEIZE_THE_MOMENT, 'Chronomancer', ['Split Second']],
  [TRAIT.RENEWING_OASIS, 'Mirage', ['Dodge / Mirage Cloak']],
  [TRAIT.NOMADS_ENDURANCE, 'Mirage', ['Mind Wrack']],
  [TRAIT.PHANTOM_PAIN, 'Mirage', ['Mind Wrack']],
  [TRAIT.MIRAGE_MANTLE, 'Mirage', ['Dodge / Mirage Cloak', 'Chaos Vortex'], { primaryWeapon: 'Staff' }],
  [TRAIT.RACONTEUR, 'Troubadour', ['Tale of the Soulkeeper']]
]) {
  test(`${specialization} trait ${traitId} preserves marker and grant provenance`, () => {
    const result = simulateMesmer([...rotation, { type: 'wait', durationMs: 1000 }], {
      specialization,
      selectedTraitIds: [traitId],
      ...extra
    });
    assert.deepEqual(result.warnings, []);
    const trigger = result.events.find((event) => event.type === 'proc' && event.sourceId === traitId);
    assert.ok(trigger, 'trait announcement was emitted');
    const grants = result.events.filter(
      (event) => event.type === 'buff' && event.parentEventOrder === trigger.eventOrder
    );
    assert.ok(grants.length, 'announcement owns its grants');
    assert.ok(grants.every((event) => event.source === 'Trait' && event.sourceId === traitId));
    assert.ok(
      result.procSteps.some((step) => step.skill === trigger.name),
      'timeline marker remains'
    );
    const rows = simulationEventLogRows(result, null, mesmerProfession);
    const summary = rows.find((row) => row.id === `event:${trigger.eventOrder}`);
    assert.ok(summary.description.startsWith(trigger.name));
    assert.ok(!summary.description.startsWith('TRAIT '), 'announcement was consolidated');
    assert.ok(grants.every((grant) => !rows.some((row) => row.id === `event:${grant.eventOrder}`)));
  });
}

// Consolidating a buff announcement must preserve damage and conditions from the same trait activation.
test('trait summaries retain non-buff children and their ownership', () => {
  const damage = { ...hit, eventOrder: 4, parentEventOrder: proc.eventOrder };
  const rows = present([proc, buff], [hit, damage]);
  const summary = rows.find((row) => row.id === 'event:2');
  assert.match(summary.description, /^Master Fencer/);
  assert.ok(!rows.some((row) => row.id === 'event:3'));
  assert.equal(rows.find((row) => row.id === 'event:4').parentId, summary.id);
});
