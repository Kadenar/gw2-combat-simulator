import assert from 'node:assert/strict';
import test from 'node:test';

import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import { mechanicResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { runMesmer, simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

// Trait-owned scheduling must keep honoring balance edits for both the disable proc and delayed wave.
test('Syncopate reads patched damage from its trait profile', () => {
  const result = runMesmer(
    ['Deafening Drum', { type: 'wait', durationMs: 4000 }],
    defaultSimulationConfig({
      patchId: 'syncopate-test',
      specialization: 'Troubadour',
      selectedTraitIds: [TRAIT.SYNCOPATE],
      initialResource: 0
    }),
    {
      profession: withPatchPreview(mesmerProfession, {
        id: 'syncopate-test',
        label: 'Syncopate test',
        professions: {
          mesmer: {
            balanceProfiles: {
              [TRAIT.SYNCOPATE]: {
                effects: [
                  { effectIndex: 0, coefficient: 0.25 },
                  { effectIndex: 1, coefficient: 0.5 }
                ]
              }
            }
          }
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  const drum = result.events.find((event) => event.type === 'damage' && event.skillName === 'Deafening Drum');
  const procs = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Syncopate');
  assert.deepEqual(procs.map((event) => event.coefficient).sort(), [0.25, 0.25, 0.5]);
  assert.ok(procs.some((event) => event.at === drum.at));
  assert.ok(procs.some((event) => event.at > drum.at));
});

// Troubadour instruments, tales, and traits preserve note costs and scheduled effects.
test('Troubadour instruments and Syncopate use independent weapon-strength ownership', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    initialResource: 3,
    selectedTraitIds: [TRAIT.SYNCOPATE, TRAIT.SHREDDING, TRAIT.FORTISSIMO],
    boons: { ...defaults.boons, quickness: true, alacrity: true }
  });
  const lute = simulateMesmer(
    [
      { type: 'cast', skillId: 76552 },
      { name: '__wait', waitMs: 1000 }
    ],
    config
  );
  const luteHits = lute.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.LIVELY_LUTE);
  assert.ok(luteHits.length > 0);
  assert.ok(luteHits.every((event) => event.weaponStrengthProfileId === 'nonweapon.profession-mechanic'));

  const drum = simulateMesmer(['Deafening Drum', { name: '__wait', waitMs: 4000 }], config);
  const drumHit = drum.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Deafening Drum');
  const syncopate = drum.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Syncopate');
  assert.equal(drumHit.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.ok(syncopate.length > 0);
  assert.ok(syncopate.every((event) => event.weaponStrengthProfileId === 'nonweapon.unequipped'));

  const stochasticDrum = simulateMesmer(['Deafening Drum', { name: '__wait', waitMs: 4000 }], {
    ...config,
    randomness: { mode: 'stochastic', seed: 1 }
  });
  const stochasticDrumHit = stochasticDrum.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Deafening Drum'
  );
  const stochasticSyncopate = stochasticDrum.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Syncopate'
  );

  assert.ok(stochasticDrumHit.weaponStrengthSampled);
  assert.ok(stochasticSyncopate.length > 0);
  assert.ok(
    stochasticSyncopate.every(
      (event) =>
        event.source === 'Trait' &&
        event.weaponStrengthSampled === true &&
        event.activationId !== stochasticDrumHit.activationId
    )
  );
});

test('Troubadour performance packets register before later overlapping actions', () => {
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    selectedSkillIds: [10234],
    initialResource: 3
  });
  for (const [skillName, offset] of [
    ['Lively Lute', 500],
    ['Crescendo', 900]
  ]) {
    const result = simulateMesmer(
      [mesmerCatalog.skills.find((skill) => skill.name === skillName).id, { name: 'Signet of Midnight', offset }],
      config
    );
    const hit = result.events.find((event) => event.type === 'damage' && event.skillName === skillName);
    const overlappingAction = result.events.find(
      (event) => event.type === 'action' && event.skillName === 'Signet of Midnight'
    );

    assert.ok(hit.at < overlappingAction.at, skillName);
    assert.ok(hit.eventOrder < overlappingAction.eventOrder, skillName);
  }
});

// Compare recharge between uses so the trait contract does not depend on performance animations.
test('Master of Misdirection reduces instrument and Crescendo recharge by fifteen percent', () => {
  for (const skillId of [
    ID.LIVELY_LUTE,
    ID.LIVELY_LUTE_ALTERNATE,
    ID.FLUSTERING_FLUTE,
    ID.DEAFENING_DRUM,
    ID.HARMONIOUS_HARP,
    ID.HARMONIOUS_HARP_ALTERNATE,
    ID.CRESCENDO
  ]) {
    const recharge = (selectedTraitIds) => {
      const cast = { type: 'cast', skillId };
      const result = simulateMesmer(
        [cast, cast],
        defaultSimulationConfig({ specialization: 'Troubadour', initialResource: 3, selectedTraitIds })
      );
      assert.deepEqual(result.warnings, []);
      return result.steps[1].start - result.steps[0].end;
    };

    assert.equal(recharge([TRAIT.MASTER_OF_MISDIRECTION]), recharge([]) * 0.85, `skill ${skillId}`);
  }
});

const maimProcs = (result) =>
  result.events.filter((event) => event.type === 'condition' && event.traitId === TRAIT.MAIM_THE_DISILLUSIONED);

// Maim lands with each native player performance hit; Harp's damageless pulse and Crescendo each proc it once.
test('Maim the Disillusioned procs on each player instrument and Crescendo hit', () => {
  const run = (selectedTraitIds) =>
    simulateMesmer(
      [
        { type: 'cast', skillId: 76552 },
        'Flustering Flute',
        'Deafening Drum',
        ID.HARMONIOUS_HARP_ALTERNATE,
        'Crescendo'
      ],
      defaultSimulationConfig({ specialization: 'Troubadour', initialResource: 0, selectedTraitIds })
    );

  assert.deepEqual(maimProcs(run([])), []);

  const result = run([TRAIT.MAIM_THE_DISILLUSIONED]);
  assert.deepEqual(result.warnings, []);
  const procs = maimProcs(result);

  const actions = result.events.filter((event) => event.type === 'action');
  assert.equal(actions.length, 5);

  for (const { name, skillId } of actions) {
    const procTimes = procs.filter((event) => event.skillId === skillId).map((event) => event.at);

    if (name === 'Harmonious Harp') {
      assert.equal(procTimes.length, 1);
      continue;
    }

    const hitTimes = result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === skillId && event.actorType === 'player')
      .map((event) => event.at);
    assert.ok(hitTimes.length > 0);
    assert.deepEqual(procTimes, hitTimes);
  }

  // Performances are not shatters, so shatter-only modifiers never treat their torment as a shatter hit.
  assert.ok(procs.every((event) => event.procType === 'trait' && event.metadata?.shatterTraitEligible === false));
});

const callAndResponse = (instrument, selectedTraitIds) =>
  simulateMesmer(
    [mesmerCatalog.skills.find((skill) => skill.name === instrument).id, { name: '__wait', waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.CALL_AND_RESPONSE, ...selectedTraitIds]
    })
  );

// Afterimages are illusions: the player's instrument traits never ride on the replay.
test('Call and Response afterimages carry no player instrument traits', () => {
  for (const [instrument, riders] of [
    ['Lively Lute', [TRAIT.SHREDDING, TRAIT.MAIM_THE_DISILLUSIONED]],
    ['Flustering Flute', [TRAIT.MAYHEM]],
    ['Deafening Drum', [TRAIT.SYNCOPATE]]
  ]) {
    const result = callAndResponse(instrument, riders);
    const riderEvent = (event) => riders.includes(event.traitId) || riders.includes(event.sourceId);
    const afterimageHits = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.source === 'Afterimage'
    );

    assert.deepEqual(result.warnings, []);
    assert.ok(afterimageHits.length > 0);
    assert.ok(afterimageHits.every((event) => event.summonKind === 'afterimage'));
    assert.ok(result.events.some(riderEvent));
    assert.ok(result.events.filter(riderEvent).every((event) => event.actorType !== 'summon'));
  }
});

// Player-only damage bonuses skip afterimage strikes, as they skip every other illusion.
test('Shredding does not increase afterimage Lively Lute damage', () => {
  const afterimageDamage = (selectedTraitIds) =>
    callAndResponse('Lively Lute', selectedTraitIds)
      .resolvedEvents.filter((event) => event.type === 'damage' && event.source === 'Afterimage')
      .map((event) => event.damage);

  assert.ok(afterimageDamage([]).length > 0);
  assert.deepEqual(afterimageDamage([TRAIT.SHREDDING]), afterimageDamage([]));
});

// Flute is shatter skill 2, so Blinding Dissipation follows the player's impact but not the afterimage replay.
test('Blinding Dissipation blinds on the player Flustering Flute impact only', () => {
  const blindingDissipation = (result) =>
    result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.BLINDING_DISSIPATION);

  assert.deepEqual(blindingDissipation(callAndResponse('Flustering Flute', [])), []);

  const result = callAndResponse('Flustering Flute', [TRAIT.BLINDING_DISSIPATION]);
  const fluteHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Flustering Flute' && event.source === 'Player'
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.source === 'Afterimage'));
  assert.deepEqual(
    blindingDissipation(result).map((event) => event.at),
    fluteHits.map((event) => event.at)
  );
});

// Cry of Pain augments the player's native confusion; the afterimage replay keeps the base application.
test('Cry of Pain upgrades only the player Flustering Flute confusion', () => {
  const traited = mesmerProfession.catalog.skillsById.get(ID.FLUSTERING_FLUTE);
  const confusion = (result, actorType) =>
    result.events.filter(
      (event) => event.type === 'condition' && event.condition === 'Confusion' && event.actorType === actorType
    );
  const base = callAndResponse('Flustering Flute', []);
  const upgraded = callAndResponse('Flustering Flute', [TRAIT.CRY_OF_PAIN]);
  const playerConfusion = confusion(upgraded, 'player');

  assert.equal(
    playerConfusion.reduce((total, event) => total + event.stacks, 0),
    confusion(base, 'player').reduce((total, event) => total + event.stacks, 0) + traited.cryOfPainAdditionalStacks
  );
  assert.ok(
    playerConfusion.every(
      (event) => event.duration === confusion(base, 'player')[0].duration * (1 + traited.cryOfPainDurationMultiplier)
    )
  );
  assert.ok(confusion(base, 'summon').length > 0);
  assert.deepEqual(
    confusion(upgraded, 'summon').map(({ stacks, duration }) => ({ stacks, duration })),
    confusion(base, 'summon').map(({ stacks, duration }) => ({ stacks, duration }))
  );
});

test('Shatter Storm gives Lively Lute a second charge without a full cooldown', () => {
  const config = (selectedTraitIds) =>
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds
    });
  const ordinary = simulateMesmer(
    [
      { type: 'cast', skillId: 76552 },
      { type: 'cast', skillId: 76552 }
    ],
    config([])
  );
  const shatterStorm = simulateMesmer(
    [
      { type: 'cast', skillId: 76552 },
      { type: 'cast', skillId: 76552 }
    ],
    config([TRAIT.SHATTER_STORM])
  );
  const shatterStormAfterOne = simulateMesmer([{ type: 'cast', skillId: 76552 }], config([TRAIT.SHATTER_STORM]));
  const shatterStormBeforeUse = simulateMesmer([], config([TRAIT.SHATTER_STORM]));
  const livelyLute = mesmerCatalog.skillsById.get(ID.LIVELY_LUTE);
  const paletteApp = (results) => ({
    patch: mesmerAppAdapter.profession.resolvePatch(),
    // Palette models now resolve tooltip presentation through the profession adapter.
    adapter: mesmerAppAdapter,
    build: { rotation: [] },
    results
  });

  assert.equal(ordinary.steps[1].start, 10160);
  assert.equal(shatterStorm.steps[1].start, shatterStorm.steps[0].end);
  assert.equal(paletteSkillView(paletteApp(ordinary), livelyLute).ammo, null);
  assert.deepEqual(paletteSkillView(paletteApp(shatterStormBeforeUse), livelyLute).ammo, {
    current: 2,
    maximum: 2,
    pips: [true, true]
  });
  assert.deepEqual(paletteSkillView(paletteApp(shatterStormAfterOne), livelyLute).ammo, {
    current: 1,
    maximum: 2,
    pips: [true, false]
  });
});

test('Chaotic Interruption recharges a phantasm cast before Tortured Mastermind delayed control lands', () => {
  const result = simulateMesmer(
    ['Flustering Flute', 'Tale of the Tortured Mastermind', 'Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      primaryWeapon: 'Staff',
      selectedSkillIds: [76746, 77066],
      selectedTraitIds: [TRAIT.CHAOTIC_INTERRUPTION],
      target: { activatingSkills: true }
    })
  );

  const proc = result.events.find((event) => event.type === 'proc' && event.name === 'Chaotic Interruption');

  assert.equal(proc?.at, 3.92);
  assert.equal(proc?.sourceSkill, 'Tale of the Tortured Mastermind');
  assert.equal(result.planningState.cooldowns[ID.PHANTASMAL_WARLOCK].readyAt, 7440);
});

test('Troubadour tales grant their boons and instrument-specific notes', () => {
  const cases = [
    [
      'Lively Lute',
      'Tale of the Soulkeeper',
      2,
      [
        ['might', 10, 15],
        ['fury', 1, 10],
        ['quickness', 1, 4]
      ]
    ],
    ['Deafening Drum', 'Tale of the Honorable Rogue', 1, [['aegis', 1, 4]]],
    ['Flustering Flute', 'Tale of the Tortured Mastermind', 1, []],
    [
      'Harmonious Harp',
      'Tale of the Valiant Marshal',
      1,
      [
        ['stability', 5, 4],
        ['resistance', 1, 3]
      ]
    ]
  ];

  for (const [instrument, tale, expectedNotes, expectedBoons] of cases) {
    const result = simulateMesmer(
      [
        instrument === 'Harmonious Harp'
          ? ID.HARMONIOUS_HARP_ALTERNATE
          : mesmerCatalog.skills.find((skill) => skill.name === instrument).id,
        tale,
        { name: '__wait', waitMs: 100 }
      ],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        initialResource: 3,
        allies: { count: 4, strikesPerSecond: 1 },
        sharePlayerBoonsWithSummons: true
      })
    );

    assert.equal(result.planningState.profession[STATE.NOTES].value, expectedNotes, tale);
    assert.ok(
      result.events.some((event) => event.type === 'mesmer.instrument' && instrument.includes(event.instrument))
    );
    const boons = result.events
      .filter((event) => event.type === 'buff' && event.skillName === tale)
      .map((event) => [event.kind, event.stacks, event.duration]);

    assert.deepEqual(boons, expectedBoons, tale);
    assert.ok(
      result.events
        .filter((event) => event.type === 'buff' && event.skillName === tale)
        .every(
          (event) =>
            event.audience?.recipients === 'party' &&
            event.resolvedAudience.recipientCount === 5 &&
            event.resolvedAudience.includesSummons === false
        ),
      tale
    );

    if (instrument === 'Harmonious Harp') {
      assert.ok(
        result.events.some((event) => event.type === 'buff' && event.kind === 'distortion' && event.duration === 2)
      );
    }
  }
});

// Background playing windows feed instrument queries without performing attacks or spending notes.
test('August Queen starts all instruments with duration based on the previously playing count', () => {
  const instruments = [ID.LIVELY_LUTE, ID.FLUSTERING_FLUTE, ID.DEAFENING_DRUM, ID.HARMONIOUS_HARP_ALTERNATE];
  const config = defaultSimulationConfig({ specialization: 'Troubadour', initialResource: 0, selectedTraitIds: [] });
  for (let count = 0; count <= 4; count++) {
    const result = simulateMesmer(
      [...instruments.slice(0, count), 'Tale of the August Queen', { type: 'wait', durationMs: 1 }],
      config
    );
    assert.deepEqual(result.warnings, []);
    const queen = result.events.find(
      (event) => event.type === 'action' && event.skillId === ID.TALE_OF_THE_AUGUST_QUEEN
    );
    const windows = result.events.filter(
      (event) => event.type === 'mesmer.instrument' && event.activationId === queen.activationId
    );
    assert.deepEqual(new Set(windows.map((event) => event.instrument)), new Set(['Lute', 'Flute', 'Drum', 'Harp']));
    assert.ok(windows.every((event) => canonicalTime(event.expiresAt - event.at) === 3 + count * 3));
    assert.equal(result.planningState.profession[STATE.ACTIVE_INSTRUMENTS].length, 4);
    assert.equal(result.planningState.profession[STATE.NOTES].value, 0);
  }
});

test('August Queen grants Chaos Aura and Distortion and enables Second Scion without spending notes', () => {
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    initialResource: 2,
    selectedTraitIds: [TRAIT.ILLUSIONARY_MEMBRANE, TRAIT.CALL_AND_RESPONSE]
  });
  const queen = simulateMesmer(['Tale of the August Queen', { type: 'wait', durationMs: 1 }], config);
  assert.equal(queen.planningState.profession[STATE.NOTES].value, 2);
  assert.ok(
    queen.resolvedEvents.some((event) => event.type === 'aura' && event.aura === 'Chaos Aura' && event.duration === 6)
  );
  assert.ok(queen.events.some((event) => event.kind === 'distortion' && event.duration === 2));
  assert.ok(queen.events.some((event) => event.kind === 'illusionary-membrane'));
  assert.equal(
    queen.events.some((event) => event.type === 'damage' || event.type === 'condition'),
    false
  );
  const scion = simulateMesmer(
    ['Tale of the August Queen', 'Tale of the Second Scion', { type: 'wait', durationMs: 1 }],
    config
  );
  assert.equal(scion.planningState.profession[STATE.NOTES].value, 3);
  const expired = simulateMesmer(
    ['Tale of the August Queen', { type: 'wait', durationMs: 3000 }, 'Tale of the Second Scion'],
    config
  );
  assert.equal(expired.planningState.profession[STATE.ACTIVE_INSTRUMENTS].length, 0);
  assert.equal(expired.planningState.profession[STATE.NOTES].value, 2);
  const canceled = simulateMesmer(
    [
      { name: 'Tale of the August Queen', interruptMs: 0 },
      { type: 'wait', durationMs: 1000 }
    ],
    config
  );
  assert.equal(canceled.planningState.profession[STATE.ACTIVE_INSTRUMENTS].length, 0);
  assert.equal(
    canceled.events.some(
      (event) => event.type === 'aura' || event.kind === 'distortion' || event.kind === 'illusionary-membrane'
    ),
    false
  );
});

test('Tortured Mastermind and Soulkeeper require their matching instrument for notes', () => {
  for (const [wrong, tale] of [
    ['Lively Lute', 'Tale of the Tortured Mastermind'],
    ['Flustering Flute', 'Tale of the Soulkeeper']
  ]) {
    const result = simulateMesmer(
      [
        wrong === 'Harmonious Harp' ? 77077 : mesmerCatalog.skills.find((skill) => skill.name === wrong).id,
        tale,
        { type: 'wait', durationMs: 100 }
      ],
      {
        specialization: 'Troubadour',
        initialResource: 0,
        selectedTraitIds: []
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[STATE.NOTES].value, 0);
  }
});

// Second Scion rewards the count of distinct playing instruments, regardless of their identities.
test('Second Scion grants one note with at least two playing instruments', () => {
  const instruments = [ID.LIVELY_LUTE, ID.FLUSTERING_FLUTE, ID.DEAFENING_DRUM, ID.HARMONIOUS_HARP_ALTERNATE];
  const config = defaultSimulationConfig({ specialization: 'Troubadour', initialResource: 0, selectedTraitIds: [] });
  const cases = [[], ...instruments.map((instrument) => [instrument]), instruments.slice(0, 3), instruments];
  for (let first = 0; first < instruments.length; first++) {
    for (let second = first + 1; second < instruments.length; second++)
      cases.push([instruments[first], instruments[second]]);
  }

  for (const playing of cases) {
    const result = simulateMesmer([...playing, 'Tale of the Second Scion', { type: 'wait', durationMs: 1 }], config);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[STATE.NOTES].value, playing.length >= 2 ? 1 : 0, playing.join(', '));
  }
});

// Eligibility is captured before recitation; expired instruments cannot qualify a later cast.
test('Second Scion snapshots its performance requirement at cast acceptance', () => {
  const config = defaultSimulationConfig({ specialization: 'Troubadour', initialResource: 0, selectedTraitIds: [] });
  const opening = [ID.LIVELY_LUTE, ID.FLUSTERING_FLUTE];
  const probe = simulateMesmer(opening, config);
  const expiryMs = Math.min(
    ...probe.events.filter((event) => event.type === 'mesmer.instrument').map((event) => event.expiresAt * 1000)
  );
  const endMs = probe.steps.at(-1).end;
  for (const [offset, expected] of [
    [-40, 1],
    [0, 0]
  ]) {
    const result = simulateMesmer(
      [
        ...opening,
        { type: 'wait', durationMs: expiryMs - endMs + offset },
        'Tale of the Second Scion',
        { type: 'wait', durationMs: 1 }
      ],
      config
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[STATE.NOTES].value, expected);
  }
});

// Performance grants use the shared capped note pool and require a committed tale.
test('Second Scion respects cancellation and the note cap', () => {
  const config = defaultSimulationConfig({ specialization: 'Troubadour', initialResource: 0, selectedTraitIds: [] });
  const canceled = simulateMesmer(
    [{ type: 'cast', skillId: 76552 }, 'Flustering Flute', { name: 'Tale of the Second Scion', interruptMs: 0 }],
    config
  );
  assert.equal(canceled.planningState.profession[STATE.NOTES].value, 0);
  const capped = simulateMesmer(
    [
      { type: 'cast', skillId: 76552 },
      'Deafening Drum',
      'Tale of the Soulkeeper',
      'Tale of the Honorable Rogue',
      'Tale of the Second Scion',
      { type: 'wait', durationMs: 1 }
    ],
    config
  );
  assert.deepEqual(capped.warnings, []);
  assert.equal(capped.planningState.profession[STATE.NOTES].value, 3);
});

test('Tale of the Honorable Rogue owns its Aegis, note gate, and two-charge timing', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Tale of the Honorable Rogue', 'Tale of the Honorable Rogue', 'Tale of the Honorable Rogue'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0,
      boons: { ...defaults.boons, quickness: false, alacrity: false }
    })
  );
  const casts = result.steps.filter((step) => step.skill === 'Tale of the Honorable Rogue');
  const aegis = result.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Tale of the Honorable Rogue' && event.kind === 'aegis'
  );

  assert.deepEqual(
    casts.map((step) => step.start),
    [0, 3200, 20000]
  );
  assert.equal(result.planningState.profession[STATE.NOTES].value, 0);
  assert.equal(aegis.length, 3);
  assert.ok(aegis.every((event) => event.duration === 4));
});

test('Troubadour Dodge spends continuous endurance and waits for regeneration with Vigor', () => {
  for (const [vigor, readyAt] of [
    [false, 10000],
    [true, 6680]
  ]) {
    const result = simulateMesmer(['Dodge', 'Dodge', 'Dodge'], {
      specialization: 'Troubadour',
      selectedTraitIds: [],
      boons: { vigor }
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.steps.map((step) => step.start),
      [0, 0, readyAt]
    );
    assert.ok(result.planningState.profession[STATE.ENDURANCE].value < 0.11);
    assert.equal(result.planningState.profession[STATE.ENDURANCE].maximum, 100);
    assert.equal(result.planningState.ammoBySkillId[SHARED_SKILL_IDS.DODGE], undefined);
    assert.equal(Object.hasOwn(result.planningState.cooldowns, -5), false);
  }
});

test('Honorable Rogue restores 50 endurance, preserving partial regeneration and capping a full pool', () => {
  for (const flute of [false, true]) {
    for (const dodges of [1, 2]) {
      const config = {
        specialization: 'Troubadour',
        initialResource: 3,
        selectedTraitIds: [],
        boons: { quickness: false, alacrity: false, vigor: false }
      };
      const rotation = [
        ...(flute ? ['Flustering Flute'] : []),
        ...Array(dodges).fill('Dodge'),
        { type: 'wait', durationMs: 1000 }
      ];
      const before = simulateMesmer(rotation, config);
      const after = simulateMesmer([...rotation, 'Tale of the Honorable Rogue'], config);
      assert.deepEqual(before.warnings, []);
      assert.deepEqual(after.warnings, []);
      const rate = flute ? 6.25 : 5;
      assert.equal(before.planningState.profession[STATE.ENDURANCE].value, 100 - 50 * dodges + rate);
      const tale = after.steps.at(-1);
      const expected = Math.min(
        100,
        before.planningState.profession[STATE.ENDURANCE].value + 50 + ((tale.end - tale.start) / 1000) * rate
      );
      assert.ok(Math.abs(after.planningState.profession[STATE.ENDURANCE].value - expected) < 0.000001);
      assert.equal(Object.hasOwn(after.planningState.cooldowns, -5), false);
      assert.equal(after.planningState.ammoBySkillId[SHARED_SKILL_IDS.DODGE], undefined);
      assert.ok(after.planningState.cooldowns[ID.TALE_OF_THE_HONORABLE_ROGUE].remaining > 0);
    }
  }
});

test('Troubadour uses initial endurance and Energy grants through the shared pool and palette', () => {
  const result = simulateMesmer(['__combat_start', { type: 'wait', durationMs: 1000 }, 'Swap Weapons'], {
    specialization: 'Troubadour',
    selectedTraitIds: [],
    initialEndurance: 0,
    boons: { vigor: false },
    sigilSets: [{ names: ['Energy'] }, { names: ['Energy'] }]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.ENDURANCE].value, 55);
  const view = mesmerProfession.ui
    .resourceViews({
      catalog: mesmerCatalog,
      specialization: 'Troubadour',
      professionState: result.planningState.profession
    })
    .find((resource) => resource.id === 'endurance');
  assert.equal(view.value, 55);
  assert.equal(view.maximum, 100);
  assert.equal(view.displayMode, 'bar');
  assert.equal(view.paletteSkillId, SHARED_SKILL_IDS.DODGE);
});

test('Troubadour instrument note spends retain rotation timeline metadata', () => {
  const result = simulateMesmer(
    [{ type: 'cast', skillId: 76552 }, 'Tale of the Soulkeeper', 'Flustering Flute'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3
    })
  );
  const spends = mechanicResourceSpends(result);

  assert.deepEqual(spends.get(0), {
    count: 3,
    resource: 'notes'
  });
  assert.deepEqual(spends.get(2), {
    count: 2,
    resource: 'notes'
  });
  assert.deepEqual(
    result.planningState.profession[STATE.ACTIVE_INSTRUMENTS].map((instrument) => instrument.name),
    ['Lute', 'Flute']
  );
  const resourceViews = mesmerProfession.ui.resourceViews({
    catalog: mesmerCatalog,
    specialization: 'Troubadour',
    professionState: result.planningState.profession
  });
  const notesView = resourceViews.find((view) => view.id === 'notes');
  const playingView = resourceViews.find((view) => view.id === 'playing-instruments');

  assert.equal(notesView.pipStyle, 'mesmer-notes');
  assert.equal(notesView.statusItems, undefined);
  assert.equal(playingView.displayMode, 'status');
  assert.equal(playingView.statusItemsLabel, undefined);
  assert.deepEqual(
    playingView.statusItems.map((item) => item.label),
    ['Lute', 'Flute']
  );
  assert.ok(playingView.statusItems.every((item) => /^\d+\.\d+s$/.test(item.valueLabel)));
  const resourceHtml = activeResourceGroup({
    activeCatalog: mesmerCatalog,
    profession: mesmerProfession,
    adapter: { eliteSpecialization: () => 'Troubadour' },
    build: { initialResource: 0 },
    results: result
  });

  assert.match(resourceHtml, /active-resource-pips mesmer-notes/);
  assert.equal([...resourceHtml.matchAll(/<span class="active-resource-pip(?: active)?"><\/span>/g)].length, 3);
  assert.match(resourceHtml, /active-resource-statuses/);
  assert.doesNotMatch(resourceHtml, /active-resource-status-label/);
  assert.match(resourceHtml, />Lute</);
  assert.match(resourceHtml, />Flute</);
  for (const index of [0, 2]) {
    const spend = result.events.find(
      (event) =>
        event.type === 'resource' &&
        event.reason === 'profession mechanic' &&
        event.activationId === result.steps[index].activationId
    );

    assert.ok(spend);
    const action = result.events.find((event) => event.type === 'action' && event.activationId === spend.activationId);

    assert.ok(action);
    assert.equal(spend.activationId, action.activationId);
    const playing = result.events.find(
      (event) => event.type === 'mesmer.instrument' && event.activationId === spend.activationId
    );

    // Notes are consumed before the instrument starts playing, which can precede cast completion.
    assert.ok(playing);
    assert.equal(spend.at, playing.at);
    assert.ok(result.events.indexOf(spend) < result.events.indexOf(playing));
  }

  const empty = simulateMesmer(
    ['Deafening Drum'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0
    })
  );

  assert.deepEqual(mechanicResourceSpends(empty).get(0), {
    count: 0,
    resource: 'notes'
  });
});

test('Troubadour adept and support traits emit their modeled effects', () => {
  const resonance = simulateMesmer(
    ['Flustering Flute', 'Dodge', 'Dodge', 'Dodge'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3
    })
  );

  // Flute and Vigor add to 8.75 endurance/sec; availability is detected on the next server tick.
  const recoveryMs = resonance.steps[3].start - resonance.steps[1].start;
  assert.ok(recoveryMs >= 50000 / 8.75 && recoveryMs < 50000 / 8.75 + 40);

  const mayhem = simulateMesmer(
    ['Flustering Flute', 'Dodge', 'Flustering Flute'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0,
      selectedTraitIds: [TRAIT.MAYHEM]
    })
  );
  const torment = mayhem.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.condition === 'Torment' && event.name.includes('Mayhem')
  );

  assert.equal(
    torment.reduce((sum, event) => sum + event.stacks, 0),
    8
  );
  assert.ok(torment.every((event) => event.duration === 5));
  assert.equal(mayhem.steps[2].start, 15360);

  const rogueEndurance = simulateMesmer(
    ['Dodge', 'Dodge', 'Tale of the Honorable Rogue', 'Dodge'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0
    })
  );

  assert.equal(rogueEndurance.steps[3].start, 0);

  const raconteur = simulateMesmer(
    ['Tale of the Soulkeeper'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      selectedTraitIds: [TRAIT.RACONTEUR],
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    })
  );

  assert.ok(
    raconteur.events.some(
      (event) =>
        event.type === 'buff' &&
        event.kind === 'protection' &&
        event.duration === 3 &&
        event.audience?.recipients === 'party' &&
        event.resolvedAudience.includesSummons === false
    )
  );

  const party = simulateMesmer(
    [{ type: 'cast', skillId: 76552 }, 'Crescendo'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.LIFE_OF_THE_PARTY],
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    })
  );
  const partyBoons = party.events.filter(
    (event) => event.type === 'buff' && ['quickness', 'might', 'fury'].includes(event.kind)
  );

  assert.ok(
    partyBoons.every(
      (event) =>
        event.audience?.recipients === 'party' &&
        event.resolvedAudience.recipientCount === 5 &&
        event.resolvedAudience.includesSummons === false
    )
  );
  assert.ok(partyBoons.some((event) => event.kind === 'quickness' && event.duration === 6));
  assert.ok(partyBoons.some((event) => event.kind === 'might' && event.stacks === 5 && event.duration === 8));
  assert.ok(partyBoons.some((event) => event.kind === 'quickness' && event.duration === 8));
  assert.ok(partyBoons.some((event) => event.kind === 'might' && event.stacks === 8 && event.duration === 15));
  assert.ok(partyBoons.some((event) => event.kind === 'fury' && event.duration === 8));
});

test('Harmonize, Call and Response, Fortissimo, and Altered Chord execute', () => {
  const harmonize = simulateMesmer(
    ['Phantasmal Swordsman', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0
    })
  );

  assert.deepEqual(
    harmonize.events.filter((event) => event.type === 'resource').map((event) => event.reason),
    ['Harmonize', 'Phantasmal Swordsman phantasm conversion']
  );
  assert.equal(harmonize.planningState.profession[STATE.NOTES].value, 2);

  const response = simulateMesmer(
    [
      { type: 'cast', skillId: 76552 },
      { name: '__wait', waitMs: 2500 }
    ],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.CALL_AND_RESPONSE]
    })
  );
  const afterimageHits = response.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.source === 'Afterimage'
  );
  assert.ok(afterimageHits.length > 0);
  assert.ok(afterimageHits.every((event) => event.actorType === 'summon'));
  assert.ok(response.events.some((event) => event.type === 'proc' && event.name === 'Call and Response'));

  const altered = simulateMesmer(
    ['Deafening Drum', 'Crescendo', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.ALTERED_CHORD, TRAIT.SYNCOPATE]
    })
  );

  // Fortissimo restores notes without requiring an active instrument or a damaging Crescendo.
  const fortissimo = simulateMesmer(
    ['Crescendo', { name: '__wait', waitMs: 5100 }],
    defaultSimulationConfig({ specialization: 'Troubadour', initialResource: 0, selectedTraitIds: [TRAIT.FORTISSIMO] })
  );
  assert.equal(fortissimo.planningState.profession[STATE.NOTES].value, 3);

  assert.ok(altered.events.some((event) => event.type === 'control' && event.skillName === 'Crescendo'));
  assert.ok(altered.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Crescendo'));

  const luteSpotlight = simulateMesmer(
    [{ type: 'cast', skillId: 76552 }, 'Crescendo'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.ALTERED_CHORD]
    })
  );

  const luteStrike = luteSpotlight.events.find((event) => event.type === 'damage' && event.skillName === 'Crescendo');
  const alteredChord = luteSpotlight.events.find(
    (event) => event.type === 'buff' && event.kind === 'altered-chord' && event.duration === 10
  );
  assert.equal(alteredChord.at, luteStrike.at);
  assert.ok(alteredChord.priority > Number(luteStrike.priority || 0));

  const fluteSpotlight = simulateMesmer(
    ['Flustering Flute', 'Crescendo'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.ALTERED_CHORD]
    })
  );

  assert.equal(
    fluteSpotlight.resolvedEvents
      .filter(
        (event) =>
          event.type === 'condition' &&
          event.name.includes('Altered Chord') &&
          event.condition === 'Confusion' &&
          event.stacks === 1 &&
          event.duration === 8
      )
      .reduce((sum, event) => sum + event.stacks, 0),
    5
  );

  const crescendoReadyAt = (initialResource) =>
    simulateMesmer(
      ['Crescendo', { type: 'cast', skillId: 76552 }],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        initialResource,
        selectedTraitIds: [TRAIT.ALTERED_CHORD]
      })
    ).planningState.cooldowns[ID.CRESCENDO].readyAt;

  assert.equal(crescendoReadyAt(0) - crescendoReadyAt(1), 1600);
});

test('Shackles converts Lancer immobilize into a stun that triggers Syncopate', () => {
  const result = simulateMesmer(
    ['Mind the Gap', 'Phantasmal Lancer', { name: '__wait', waitMs: 6200 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialResource: 0,
      selectedTraitIds: [TRAIT.SYNCOPATE],
      relic: 'Shackles'
    })
  );
  const lancerConditions = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillName === 'Phantasmal Lancer' &&
      ['Crippled', 'Immobilized'].includes(event.condition)
  );
  const syncopate = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Syncopate');
  const shackles = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Relic of the Shackles'
  );
  const shacklesStuns = result.events.filter(
    (event) => event.type === 'control' && event.skillName === 'Relic of the Shackles'
  );

  assert.deepEqual(
    lancerConditions.map((event) => [event.condition, event.duration, event.source, event.actorType, event.summonKind]),
    [
      ['Crippled', 3, 'Phantasm', 'summon', 'phantasm'],
      ['Immobilized', 2, 'Phantasm', 'summon', 'phantasm']
    ]
  );
  assert.equal(shackles.length, 1);
  assert.equal(shackles[0].at, canonicalTime(lancerConditions[1].at + 5));
  assert.deepEqual(
    shacklesStuns.map((event) => [event.at, event.controlKind]),
    [[canonicalTime(lancerConditions[1].at + 5), 'stun']]
  );
  assert.equal(syncopate.length, 1);
  assert.equal(syncopate[0].at, shacklesStuns[0].at);
});
