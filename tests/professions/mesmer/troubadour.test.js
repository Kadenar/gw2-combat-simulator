import assert from 'node:assert/strict';
import { canonicalTime } from '#kernel/core/clock.js';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { shatterResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { skillBreakdownRows } from '#gw2/app/results/result-tables.js';

// A launched Drum wave keeps its damage and disable proc, with distinct breakdown attribution.
test('committed Drum interruptions preserve separate Syncopate and delayed-wave rows', () => {
  const config = { specialization: 'Troubadour', initialResource: 0, selectedTraitIds: [TRAIT.SYNCOPATE] };
  const cast = { type: 'cast', skillId: ID.DEAFENING_DRUM };
  const wait = { type: 'wait', durationMs: 4000 };
  for (const command of [
    cast,
    { ...cast, interruptAfterMs: mesmerCatalog.skillsById.get(ID.DEAFENING_DRUM).interruptCommitMs }
  ]) {
    const result = simulateMesmer([command, wait], config);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      skillBreakdownRows(result)
        .filter((row) => row.name.startsWith('Syncopate'))
        .map((row) => [row.name, row.hits])
        .sort(),
      [
        ['Syncopate', 2],
        ['Syncopate (Delay Wave)', 1]
      ].sort()
    );
    const wave = result.events.find((event) => event.damageBreakdownName === 'Syncopate (Delay Wave)');
    assert.ok(wave.at * 1000 > result.steps[0].end);
    assert.ok(
      result.events.some((event) => event.type === 'damage' && event.name === 'Syncopate' && event.at === wave.at)
    );
  }

  const cancelled = simulateMesmer([{ ...cast, interruptAfterMs: 20 }, wait], config);
  assert.equal(
    skillBreakdownRows(cancelled).some((row) => row.name.startsWith('Syncopate')),
    false
  );
});

// Trait-owned scheduling must keep honoring balance edits for both the disable proc and delayed wave.
test('Syncopate reads patched damage from its trait profile', () => {
  const result = simulateGw2({
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
    }),
    rotation: ['Deafening Drum', { type: 'wait', durationMs: 4000 }],
    config: defaultSimulationConfig({
      patchId: 'syncopate-test',
      specialization: 'Troubadour',
      selectedTraitIds: [TRAIT.SYNCOPATE],
      initialResource: 0
    })
  });
  assert.deepEqual(result.warnings, []);
  const drum = result.events.find((event) => event.type === 'damage' && event.skillName === 'Deafening Drum');
  const procs = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Syncopate');
  assert.deepEqual(procs.map((event) => event.coefficient).sort(), [0.25, 0.25, 0.5]);
  assert.ok(procs.some((event) => event.at === drum.at));
  assert.ok(procs.some((event) => event.at > drum.at));
});

// Troubadour instruments, tales, and traits preserve note costs and scheduled effects.
test('Troubadour instruments use configured packets and normalized strength', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    initialResource: 3,
    selectedTraitIds: [TRAIT.SYNCOPATE, TRAIT.SHREDDING, TRAIT.FORTISSIMO],
    boons: { ...defaults.boons, quickness: true, alacrity: true }
  });
  const lute = simulateMesmer(['Lively Lute', { name: '__wait', waitMs: 1000 }], config);
  const luteHits = lute.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.LIVELY_LUTE);

  assert.equal(lute.steps[0].end, 560);
  assert.deepEqual(
    luteHits.map((event) => Number(event.at.toFixed(3))),
    [0.44, 0.64, 0.84, 1.04]
  );
  assert.deepEqual(
    luteHits.map((event) => event.coefficient),
    [1, 1, 1, 1]
  );
  assert.ok(luteHits.every((event) => event.weaponStrengthProfileId === 'nonweapon.profession-mechanic'));

  const drum = simulateMesmer(['Deafening Drum', { name: '__wait', waitMs: 4000 }], config);
  const drumHit = drum.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Deafening Drum');
  const syncopate = drum.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Syncopate');

  assert.equal(drum.steps[0].end, 680);
  assert.equal(drumHit.at, 0.52);
  assert.equal(drumHit.coefficient, 2);
  assert.equal(drumHit.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.deepEqual(
    syncopate.map((event) => event.at),
    [0.52, 3.52, 3.52]
  );
  assert.deepEqual(
    syncopate.map((event) => event.coefficient),
    [0.75, 1, 0.75]
  );
  assert.deepEqual(
    syncopate.map((event) => event.weaponStrengthProfileId),
    ['nonweapon.unequipped', 'nonweapon.unequipped', 'nonweapon.unequipped']
  );

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
  assert.equal(stochasticSyncopate.length, 3);
  assert.ok(
    stochasticSyncopate.every(
      (event) =>
        event.source === 'Trait' &&
        event.weaponStrengthSampled === true &&
        event.activationId !== stochasticDrumHit.activationId
    )
  );
});

// A committed performance retains its launched notes, including Shredding's extra packet, beyond the cast end.
test('committed Lute interruptions preserve pending performance packets', () => {
  for (const skillId of [ID.LIVELY_LUTE, ID.LIVELY_LUTE_ALTERNATE]) {
    for (const selectedTraitIds of [[], [TRAIT.SHREDDING]]) {
      const config = { specialization: 'Troubadour', initialResource: 0, selectedTraitIds };
      const cast = { type: 'cast', skillId };
      const wait = { type: 'wait', durationMs: 1500 };
      const full = simulateMesmer([cast, wait], config);
      const interrupted = simulateMesmer(
        [{ ...cast, interruptAfterMs: mesmerCatalog.skillsById.get(skillId).interruptCommitMs }, wait],
        config
      );
      const packets = (result) => result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);
      assert.deepEqual(interrupted.warnings, []);
      assert.ok(interrupted.steps[0].interrupted);
      assert.ok(packets(full).some((event) => event.at * 1000 > interrupted.steps[0].end));
      assert.deepEqual(
        packets(interrupted).map(({ at, coefficient }) => [at, coefficient]),
        packets(full).map(({ at, coefficient }) => [at, coefficient])
      );
    }
  }
});

test('Troubadour performance packets register before later overlapping actions', () => {
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    selectedSkills: ['Signet of Midnight'],
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

test('Harmonious Harp replays at 480ms after its Harp Playing packet commits without dealing damage', () => {
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    initialResource: 3,
    boons: { quickness: false }
  });
  const full = simulateMesmer(['Harmonious Harp'], config);
  const interrupted = simulateMesmer([{ name: 'Harmonious Harp', interruptMs: 480 }], config, {
    kind: 'tail',
    durationMs: 1
  });

  assert.equal(interrupted.steps[0].fullCastMs, full.steps[0].fullCastMs);
  assert.equal(interrupted.steps[0].end - interrupted.steps[0].start, 480);
  assert.equal(interrupted.steps[0].interrupted, true);
  assert.equal(interrupted.endState.profession.resource, 0);
  const instrument = interrupted.events.find(
    (event) => event.type === 'mesmer.instrument' && event.instrument === 'Harp'
  );
  assert.equal(instrument.at, 0.48);
  assert.equal(instrument.expiresAt, 20.48);
  assert.equal(
    interrupted.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Harmonious Harp'),
    false
  );
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

test('Tortured Mastermind follows its four-hit condition timeline', () => {
  const result = simulateMesmer(
    ['Flustering Flute', 'Tale of the Tortured Mastermind', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.SYNCOPATE, TRAIT.DAZZLING]
    })
  );
  const taleHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Tale of the Tortured Mastermind'
  );
  const taleConditions = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Tale of the Tortured Mastermind'
  );

  assert.equal(result.steps[1].start, 560);
  assert.equal(result.steps[1].end, 960);
  assert.deepEqual(
    taleHits.map((event) => Number(event.at.toFixed(3))),
    [0.92, 1.92, 2.92, 3.92]
  );
  assert.deepEqual(
    taleHits.map((event) => event.coefficient),
    [1, 1, 1, 1]
  );
  assert.deepEqual(
    taleConditions
      .filter((event) => event.condition === 'Torment')
      .map((event) => [Number(event.at.toFixed(3)), event.stacks, event.duration]),
    [
      [0.92, 1, 8],
      [1.92, 1, 8],
      [2.92, 1, 8],
      [3.92, 1, 8]
    ]
  );
  assert.deepEqual(
    taleConditions
      .filter((event) => event.condition !== 'Torment' && event.sourceId !== TRAIT.DAZZLING)
      .map((event) => [event.condition, Number(event.at.toFixed(3)), event.stacks, event.duration]),
    [
      ['Weakness', 0.92, 1, 5],
      ['Vulnerability', 1.92, 10, 4]
    ]
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'control' && event.skillName === 'Tale of the Tortured Mastermind' && event.at === 3.92
    )
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Syncopate' && event.at === 3.92
    )
  );
  assert.equal(result.endState.profession.resource, 1);
});

test('Chaotic Interruption recharges a phantasm cast before Tortured Mastermind delayed control lands', () => {
  const result = simulateMesmer(
    ['Flustering Flute', 'Tale of the Tortured Mastermind', 'Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      primaryWeapon: 'Staff',
      selectedSkills: ['Flustering Flute', 'Tale of the Tortured Mastermind'],
      selectedTraitIds: [TRAIT.CHAOTIC_INTERRUPTION],
      target: { activatingSkills: true }
    })
  );

  const proc = result.events.find((event) => event.type === 'proc' && event.name === 'Chaotic Interruption');

  assert.equal(proc?.at, 3.92);
  assert.equal(proc?.sourceSkill, 'Tale of the Tortured Mastermind');
  assert.equal(result.endState.cooldowns['Phantasmal Warlock'].readyAt, 6440);
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

    assert.equal(result.endState.profession.resource, expectedNotes, tale);
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
    [0, 4000, 25000]
  );
  assert.equal(result.endState.profession.resource, 0);
  assert.equal(aegis.length, 3);
  assert.ok(aegis.every((event) => event.duration === 4));
});

test('Honorable Rogue restores dodge readiness and stops recharge only when the pool fills', () => {
  for (const flute of [false, true]) {
    for (const dodges of [1, 2]) {
      const config = {
        specialization: 'Troubadour',
        initialResource: 3,
        selectedTraitIds: [],
        boons: { quickness: false, alacrity: false }
      };
      const rotation = [
        ...(flute ? ['Flustering Flute'] : []),
        ...Array(dodges).fill('Dodge'),
        { type: 'wait', durationMs: 1000 }
      ];
      const before = simulateMesmer(rotation, config);
      const after = simulateMesmer([...rotation, 'Tale of the Honorable Rogue'], config);
      const priorAmmo = before.endState.ammoBySkillId[ID.DODGE_TROUBADOUR];
      const restoredAmmo = after.endState.ammoBySkillId[ID.DODGE_TROUBADOUR];
      assert.deepEqual(before.warnings, []);
      assert.deepEqual(after.warnings, []);
      assert.equal(priorAmmo.charges, 2 - dodges);
      assert.equal(restoredAmmo.charges, 3 - dodges);
      assert.equal(Object.hasOwn(before.endState.cooldowns, 'Dodge'), dodges === 2);
      assert.equal(Object.hasOwn(after.endState.cooldowns, 'Dodge'), false);
      // Partial refunds keep the original recharge deadline, including Flute's faster recovery.
      assert.equal(restoredAmmo.rechargeDuration, flute ? 8 : 10);
      assert.equal(restoredAmmo.nextRechargeAt, dodges === 1 ? null : priorAmmo.nextRechargeAt);
      assert.ok(after.endState.cooldowns['Tale of the Honorable Rogue'].remaining > 0);
    }
  }
});

test('Troubadour instrument note spends retain rotation timeline metadata', () => {
  const result = simulateMesmer(
    ['Lively Lute', 'Tale of the Soulkeeper', 'Flustering Flute'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3
    })
  );
  const spends = shatterResourceSpends(result);

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
    result.endState.profession.activeInstruments.map((instrument) => instrument.name),
    ['Lute', 'Flute']
  );
  const resourceViews = mesmerProfession
    .resolveRuntime({
      specialization: 'Troubadour'
    })
    .ui.resourceViews({
      specialization: 'Troubadour',
      professionState: result.endState.profession
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
      (event) => event.type === 'resource' && event.reason === 'profession mechanic' && event.rotationIndex === index
    );

    assert.ok(spend);
    const action = result.events.find((event) => event.type === 'action' && event.name === spend.sourceSkill);

    assert.ok(action);
    assert.equal(spend.sourceSkill, action.name);
    assert.ok(Math.abs(spend.at - action.fullEndsAt) < 0.00001);
  }

  const empty = simulateMesmer(
    ['Deafening Drum'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0
    })
  );

  assert.deepEqual(shatterResourceSpends(empty).get(0), {
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

  assert.equal(resonance.steps[3].start, 8560);

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

  assert.deepEqual(
    torment.map((event) => [event.stacks, event.duration]),
    [
      [4, 5],
      [4, 5]
    ]
  );
  assert.equal(mayhem.steps[2].start, 15060);

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
  assert.equal(harmonize.endState.profession.resource, 2);

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

  assert.deepEqual(
    afterimageHits.map((event) => Number(event.at.toFixed(3))),
    [2.06, 2.26, 2.46]
  );
  assert.ok(afterimageHits.every((event) => event.actorType === 'summon'));
  assert.ok(
    response.events.some((event) => event.type === 'proc' && event.name === 'Call and Response' && event.at === 2.06)
  );

  const fortissimo = simulateMesmer(
    ['Crescendo', { name: '__wait', waitMs: 5100 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0,
      selectedTraitIds: [TRAIT.FORTISSIMO]
    })
  );

  assert.deepEqual(
    fortissimo.events
      .filter((event) => event.type === 'resource' && event.reason === 'Fortissimo')
      .map((event) => event.at),
    [2, 3, 4]
  );

  const altered = simulateMesmer(
    ['Deafening Drum', 'Crescendo', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.ALTERED_CHORD, TRAIT.SYNCOPATE]
    })
  );

  assert.ok(
    altered.events.some((event) => event.type === 'control' && event.skillName === 'Crescendo' && event.at === 1.52)
  );
  assert.ok(
    altered.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Crescendo' && event.at === 1.52
    )
  );

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

  assert.ok(
    fluteSpotlight.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.name.includes('Altered Chord') &&
        event.condition === 'Confusion' &&
        event.stacks === 5 &&
        event.duration === 8
    )
  );

  const crescendoReadyAt = (initialResource) =>
    simulateMesmer(
      ['Crescendo', 'Lively Lute'],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        initialResource,
        selectedTraitIds: [TRAIT.ALTERED_CHORD]
      })
    ).endState.cooldowns.Crescendo.readyAt;

  assert.equal(crescendoReadyAt(0) - crescendoReadyAt(1), 2000);
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
