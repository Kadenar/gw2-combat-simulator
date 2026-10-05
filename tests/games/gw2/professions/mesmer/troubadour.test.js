import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import assert from 'node:assert/strict';
import { canonicalTime } from '#kernel/core/clock.js';
import test from 'node:test';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { mechanicResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';

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
  const lute = simulateMesmer(['Lively Lute', { name: '__wait', waitMs: 1000 }], config);
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
    const result = simulateMesmer([skillName, { name: 'Signet of Midnight', offset }], config);
    const hit = result.events.find((event) => event.type === 'damage' && event.skillName === skillName);
    const overlappingAction = result.events.find(
      (event) => event.type === 'action' && event.skillName === 'Signet of Midnight'
    );

    assert.ok(hit.at < overlappingAction.at, skillName);
    assert.ok(hit.eventOrder < overlappingAction.eventOrder, skillName);
  }
});

test('Shatter Storm gives Lively Lute a second charge without a full cooldown', () => {
  const config = (selectedTraitIds) =>
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds
    });
  const ordinary = simulateMesmer(['Lively Lute', 'Lively Lute'], config([]));
  const shatterStorm = simulateMesmer(['Lively Lute', 'Lively Lute'], config([TRAIT.SHATTER_STORM]));
  const shatterStormAfterOne = simulateMesmer(['Lively Lute'], config([TRAIT.SHATTER_STORM]));
  const shatterStormBeforeUse = simulateMesmer([], config([TRAIT.SHATTER_STORM]));
  const livelyLute = mesmerCatalog.skillsById.get(ID.LIVELY_LUTE);
  const paletteApp = (results) => ({
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
    available: true,
    label: '2/2 ammo',
    pips: [true, true]
  });
  assert.deepEqual(paletteSkillView(paletteApp(shatterStormAfterOne), livelyLute).ammo, {
    current: 1,
    maximum: 2,
    available: true,
    label: '1/2 ammo',
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
      [instrument, tale, { name: '__wait', waitMs: 100 }],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        initialResource: 3,
        allies: { count: 4, strikesPerSecond: 1 },
        sharePlayerBoonsWithSummons: true
      })
    );

    assert.equal(result.planningState.profession.notes.value, expectedNotes, tale);
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
  assert.equal(result.planningState.profession.notes.value, 0);
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
    assert.ok(result.planningState.profession.endurance.value < 0.11);
    assert.equal(result.planningState.profession.endurance.maximum, 100);
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
      assert.equal(before.planningState.profession.endurance.value, 100 - 50 * dodges + rate);
      const tale = after.steps.at(-1);
      const expected = Math.min(
        100,
        before.planningState.profession.endurance.value + 50 + ((tale.end - tale.start) / 1000) * rate
      );
      assert.ok(Math.abs(after.planningState.profession.endurance.value - expected) < 0.000001);
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
  assert.equal(result.planningState.profession.endurance.value, 55);
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
    ['Lively Lute', 'Tale of the Soulkeeper', 'Flustering Flute'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3
    })
  );
  const spends = mechanicResourceSpends(result);

  assert.deepEqual(spends.get(0), {
    count: 3,
    resource: 'notes',
    sourceSkill: 'Lively Lute'
  });
  assert.deepEqual(spends.get(2), {
    count: 2,
    resource: 'notes',
    sourceSkill: 'Flustering Flute'
  });
  assert.deepEqual(
    result.planningState.profession.activeInstruments.map((instrument) => instrument.name),
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
    assert.ok(Math.abs(spend.at - action.fullEndsAt) < 0.00001);
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
    resource: 'notes',
    sourceSkill: 'Deafening Drum'
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
    ['Lively Lute', 'Crescendo'],
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
  assert.equal(harmonize.planningState.profession.notes.value, 2);

  const response = simulateMesmer(
    ['Lively Lute', { name: '__wait', waitMs: 2500 }],
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
  assert.equal(fortissimo.planningState.profession.notes.value, 3);

  assert.ok(altered.events.some((event) => event.type === 'control' && event.skillName === 'Crescendo'));
  assert.ok(altered.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Crescendo'));

  const luteSpotlight = simulateMesmer(
    ['Lively Lute', 'Crescendo'],
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
      ['Crescendo', 'Lively Lute'],
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
