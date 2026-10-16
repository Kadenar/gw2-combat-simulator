import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { setBeastmode } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Catalog edits must change both autonomous and commanded recharge, including the selected trait multiplier.
test('natural pet recharge uses the active skill catalog on both execution paths', () => {
  for (const specialization of ['Core', 'Untamed']) {
    for (const packAlpha of [false, true]) {
      const result = runRanger(
        [
          { type: 'combat-start' },
          ...(specialization === 'Untamed' ? [ID.CANINE_CRIPPLING_LEAP] : []),
          { type: 'wait', durationMs: 6000 }
        ],
        {
          selectedPet: 'Wolf',
          specialization,
          initialUntamedState: 'Ranger',
          selectedTraitIds: packAlpha ? [TRAIT.PACK_ALPHA] : []
        },
        { extend: (native) => ({ catalog: withSkill(native.catalog, ID.CANINE_CRIPPLING_LEAP, { cooldown: 40 }) }) }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      const recharge = runtime.cooldownController.rechargeFor(ID.CANINE_CRIPPLING_LEAP);
      assert.ok(recharge);
      assert.equal(recharge.work, packAlpha ? 32 : 40);
      assert.equal(recharge.companionId, runtime.profession.core.pet.id);
      assert.ok(runtime.cooldownController.readyAt(ID.CANINE_CRIPPLING_LEAP) > runtime.time);
    }
  }
});

// Measured Iboga exceptions retain their own patchable recharge instead of becoming scheduler constants.
test('Iboga autonomous recharge reads its owner profiles', () => {
  for (const [skillId, profileId] of [
    [ID.NARCOTIC_SPORES_PET, PROFILE.narcoticSporesAutonomous],
    [ID.CRIPPLING_ANGUISH_PET, PROFILE.cripplingAnguishAutonomous]
  ]) {
    const result = runRanger(
      [{ type: 'combat-start' }, { type: 'wait', durationMs: 6000 }],
      { selectedPet: 'Fanged Iboga', selectedTraitIds: [TRAIT.PACK_ALPHA] },
      { extend: (native) => ({ catalog: withProfile(native.catalog, profileId, { cooldown: 50 }) }) }
    );
    assert.deepEqual(result.warnings, []);
    const recharge = observedRuntime(result).cooldownController.rechargeFor(skillId);
    assert.ok(recharge);
    assert.equal(recharge.work, 40);
  }
});

// A request waiting for the pet lane spends no recharge; an executed command retains its global recharge after retirement.
for (const retireBy of ['swap', 'merge']) {
  test(`pet command cooldown starts only when the pet acts before ${retireBy}`, () => {
    for (const queued of [false, true]) {
      let readyAt;
      const result = runRanger(
        ['Fang Grapple', { type: 'wait', durationMs: 6000 }],
        {
          specialization: retireBy === 'merge' ? 'Soulbeast' : 'Core',
          selectedPet: 'Fanged Iboga',
          selectedPet2: 'Tiger'
        },
        {
          initialize(runtime) {
            if (retireBy === 'merge')
              setBeastmode(runtime.mechanics, runtime.helpers.skillsById.get(ID.LEAVE_BEASTMODE), false);

            if (queued) runtime.profession.core.pet.busyUntil = 5;
          },
          timeline: [
            {
              at: 0.5,
              run(runtime) {
                if (retireBy === 'merge')
                  setBeastmode(runtime.mechanics, runtime.helpers.skillsById.get(ID.BEASTMODE), true);
                else swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
              }
            }
          ],
          probes: [
            [
              6,
              (runtime) => {
                readyAt = runtime.cooldownController.readyAt(ID.FANG_GRAPPLE) ?? 0;
              }
            ]
          ]
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.events.some((event) => event.type === 'action' && event.skillId === ID.FANG_GRAPPLE),
        !queued
      );

      if (queued) assert.equal(readyAt, 0);
      else assert.ok(readyAt > 6);
    }
  });
}

// Natural pet skills must stay available independently of their same-named merged counterparts.
test('Jacaranda Photosynthesize resolves to a companion skill outside and inside Soulbeast', () => {
  for (const specialization of ['Core', 'Druid', 'Soulbeast', 'Untamed', 'Galeshot']) {
    const { catalog } = rangerProfession.runtimeFor({ specialization });
    const pet = catalog.skillsById.get(ID.JACARANDA_PHOTOSYNTHESIZE);
    assert.ok(pet, specialization);
    assert.equal(pet.petSkill, true);
    assert.equal(pet.petAutonomousSkill, true);
    assert.equal(pet.beastmodeSkill, false);
    assert.equal(pet.rechargeBuffAudience, 'summon');
    const merged = catalog.skillsById.get(ID.PHOTOSYNTHESIZE);

    if (specialization === 'Soulbeast') {
      assert.ok(merged);
      assert.equal(merged.petSkill, false);
      assert.equal(merged.beastmodeSkill, true);
      assert.notEqual(pet.id, merged.id);
    } else {
      assert.equal(merged, undefined);
    }
  }
});

// A commanded heal retains its cooldown and caster without triggering autonomous healing.
test('commanded Jacaranda Photosynthesize recharges and grants regeneration only to its companion', () => {
  const samples = [];
  const result = runRanger(
    [
      { type: 'combat-start' },
      { type: 'cast', skillId: ID.JACARANDA_PHOTOSYNTHESIZE },
      { type: 'wait', durationMs: 15000 }
    ],
    { specialization: 'Untamed', initialUntamedState: 'Ranger', selectedPet: 'Jacaranda' },
    {
      probes: [3, 10].map((at) => [
        at,
        (runtime) => {
          const progress = runtime.cooldownController.rechargeFor(ID.JACARANDA_PHOTOSYNTHESIZE);
          const skill = runtime.helpers.skillsById.get(ID.JACARANDA_PHOTOSYNTHESIZE);
          assert.ok(progress);
          assert.equal(progress.companionId, rangerPetCompanionId(runtime));
          const readyAt = runtime.cooldownController.project(skill, progress);
          assert.equal(readyAt, progress.startedAt + skill.cooldown);
          samples.push({ ...progress, readyAt });

          if (at === 3) {
            assert.equal(
              runtime.mechanics.combat.activeBoonStacks('regeneration', at, 1, {
                actor: 'companion',
                companionId: progress.companionId
              }),
              1
            );
            assert.equal(runtime.mechanics.combat.activeBoonStacks('regeneration', at, 1), 0);
          }
        }
      ])
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(samples.length, 2);
  assert.deepEqual(samples[1], samples[0], 'AI decisions must not restart the commanded heal recharge.');
  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'action' &&
        event.skillId === ID.JACARANDA_ROOT_SLAP &&
        event.at > samples[0].startedAt &&
        event.at < samples[0].readyAt
    ),
    'Jacaranda must resume basic attacks while Photosynthesize recharges.'
  );
});

// The simulator has no incoming damage that would justify autonomous self-healing.
test('Jacaranda damage AI never requests Photosynthesize', () => {
  const result = runRanger([{ type: 'combat-start' }, { type: 'wait', durationMs: 30000 }], {
    specialization: 'Druid',
    selectedPet: 'Jacaranda'
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => [ID.JACARANDA_PHOTOSYNTHESIZE, ID.PHOTOSYNTHESIZE].includes(event.skillId)),
    false
  );
  assert.ok(result.events.some((event) => event.type === 'action' && event.skillId === ID.JACARANDA_ROOT_SLAP));
});

// Feed real received boons into the runtime so autonomous cooldowns exercise the same history as manual commands.
const grantAlacrity = (runtime, duration) =>
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      kind: 'alacrity',
      at: runtime.time,
      duration,
      stacks: 1,
      source: 'fixture',
      sourceId: 'fixture',
      actorType: 'player',
      audience: { recipients: 'party' }
    }
  });

// Readiness must account for earned work; AI recovery may delay an attack but cannot spend unfinished recharge.
for (const [label, grantAt, duration] of [
  ['no Alacrity', 0, 0],
  ['Alacrity expires during recharge', 0, 10],
  ['Alacrity covers the recharge', 0, 30],
  ['Alacrity arrives during recharge', 8, 30]
]) {
  test(`autonomous pet recharge preserves earned work: ${label}`, () => {
    let sample;
    const result = runRanger(
      [{ type: 'combat-start' }, { type: 'wait', durationMs: 30000 }],
      { selectedPet: 'Carrion Devourer', allies: { count: 0 }, sharePlayerBoonsWithSummons: true },
      {
        initialize(runtime) {
          if (duration && !grantAt) grantAlacrity(runtime, duration);
        },
        timeline: grantAt ? [{ at: grantAt, run: (runtime) => grantAlacrity(runtime, duration) }] : [],
        probes: [
          [
            10,
            (runtime) => {
              const progress = runtime.cooldownController.rechargeFor(ID.PET_TAIL_LASH);
              assert.equal(progress.companionId, rangerPetCompanionId(runtime));
              sample = {
                ...progress,
                readyAt: runtime.cooldownController.readyAt(ID.PET_TAIL_LASH)
              };
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(sample.work, 20);
    const expected = !duration
      ? sample.startedAt + sample.work
      : grantAt
        ? grantAt + (sample.work - (grantAt - sample.startedAt)) / 1.25
        : duration === 10
          ? sample.startedAt + sample.work - (duration - sample.startedAt) * 0.25
          : sample.startedAt + sample.work / 1.25;
    assert.ok(Math.abs(sample.readyAt - expected) < 1e-9);
    const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
    const repeat = actions.find((event) => event.skillId === ID.PET_TAIL_LASH && event.at > sample.startedAt);
    assert.ok(repeat);
    assert.ok(repeat.at >= gw2CooldownReadyAt(expected), 'Autonomous attacks cannot spend unfinished recharge.');
    assert.equal(
      actions.some((event) => event.at >= gw2CooldownReadyAt(expected) && event.at < repeat.at),
      false,
      'The next free AI decision must recognize the newly ready special.'
    );
  });
}

// Retiring a pet ends its boon window; a replacement or returning incarnation cannot rewrite that earned work.
test('autonomous recharge discards Alacrity and retains earned work across retirement and swap-back', () => {
  const samples = [];
  const sample = (runtime) => {
    const progress = runtime.cooldownController.rechargeFor(ID.PET_TAIL_LASH);
    samples.push({
      ...progress,
      current: rangerPetCompanionId(runtime),
      readyAt: runtime.cooldownController.readyAt(ID.PET_TAIL_LASH)
    });
  };

  const result = runRanger(
    [
      { type: 'combat-start' },
      { type: 'wait', durationMs: 6000 },
      'Swap Pets',
      { type: 'wait', durationMs: 20000 },
      'Swap Pets',
      { type: 'wait', durationMs: 1000 }
    ],
    {
      selectedPet: 'Carrion Devourer',
      selectedPet2: 'Tiger',
      allies: { count: 0 },
      sharePlayerBoonsWithSummons: true
    },
    {
      initialize: (runtime) => grantAlacrity(runtime, 30),
      timeline: [8, 26.1].map((at) => ({ at, run: (runtime) => grantAlacrity(runtime, 30) })),
      probes: [
        [5, sample],
        [8, sample],
        [26.2, sample]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const [beforeSwap, retired, returned] = samples;
  assert.equal(retired.companionId, undefined);
  assert.equal(returned.companionId, undefined);
  assert.notEqual(returned.current, returned.companionId);
  assert.equal(returned.readyAt, retired.readyAt);
  assert.ok(retired.readyAt > beforeSwap.readyAt);
  assert.ok(
    Math.abs(retired.readyAt - (beforeSwap.startedAt + beforeSwap.work - (6 - beforeSwap.startedAt) * 0.25)) < 1e-9
  );
});

// Tiger's autonomous policy remains immune even when that exact companion receives Alacrity.
test('Tiger autonomous recharge keeps its Alacrity immunity', () => {
  const samples = [];
  for (const duration of [0, 30]) {
    const result = runRanger(
      [{ type: 'combat-start' }, { type: 'wait', durationMs: 12000 }],
      { selectedPet: 'Tiger', allies: { count: 0 }, sharePlayerBoonsWithSummons: true },
      {
        initialize(runtime) {
          if (duration) grantAlacrity(runtime, duration);
        },
        probes: [
          [
            1,
            (runtime) =>
              samples.push({
                readyAt: runtime.cooldownController.readyAt(ID.FELINE_BITE),
                progress: runtime.cooldownController.rechargeFor(ID.FELINE_BITE)
              })
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const progress = samples.at(-1);
    assert.equal(progress.progress, undefined);
    assert.ok(progress.readyAt > 1);
    const repeat = result.events.find(
      (event) => event.type === 'action' && event.skillId === ID.FELINE_BITE && event.at >= progress.readyAt
    );
    assert.ok(repeat);
    assert.ok(repeat.at >= gw2CooldownReadyAt(progress.readyAt));
  }

  assert.deepEqual(samples[0], samples[1]);
});

// Returning to the same pet creates a new boon recipient without clearing its existing skill cooldown.
test('swap-back grants cannot accelerate recharge earned by the previous pet incarnation', () => {
  const samples = [];
  const sample = (runtime) => {
    const skill = runtime.helpers.skillsById.get(ID.POISONOUS_CLOUD);
    const progress = runtime.cooldownController.rechargeFor(skill.id);
    samples.push({
      current: rangerPetCompanionId(runtime),
      owner: progress?.companionId,
      readyAt: runtime.cooldownController.readyAt(skill.id)
    });
  };

  const result = runRanger(
    [
      { type: 'combat-start' },
      'Poisonous Cloud',
      { type: 'wait', durationMs: 2000 },
      'Swap Pets',
      { type: 'wait', durationMs: 20000 },
      'Swap Pets',
      // Keep the second command after the observation of the original recharge owner.
      { type: 'wait', durationMs: 3000 },
      'Poisonous Cloud',
      { type: 'wait', durationMs: 40000 }
    ],
    {
      selectedPet: 'Carrion Devourer',
      selectedPet2: 'Tiger',
      allies: { count: 0 },
      sharePlayerBoonsWithSummons: true
    },
    {
      timeline: [
        {
          at: 25,
          run(runtime) {
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'buff',
                kind: 'alacrity',
                at: runtime.time,
                duration: 30,
                stacks: 1,
                source: 'fixture',
                sourceId: 'fixture',
                actorType: 'player',
                audience: { recipients: 'party' }
              }
            });
          }
        }
      ],
      probes: [
        [5, sample],
        [
          25,
          (runtime) => {
            sample(runtime);
            assert.equal(
              runtime.mechanics.combat.activeBoonStacks('alacrity', runtime.time, 1, {
                actor: 'companion',
                companionId: rangerPetCompanionId(runtime)
              }),
              1
            );
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(samples.length, 2);
  assert.notEqual(samples[0].current, samples[1].current);
  assert.equal(samples[0].owner, samples[1].owner);
  assert.notEqual(samples[1].owner, samples[1].current);
  assert.equal(samples[0].readyAt, samples[1].readyAt);
  assert.equal(samples[1].owner, undefined);
});

// Compare real commanded recharges after a pet swap; only the addressed incarnation may accelerate them.
test('replacement pet recharge ignores outgoing, expired and player-only Alacrity', () => {
  const observations = new Map();
  for (const [label, duration, sharing, grantAt] of [
    ['none', 0, true, 0],
    ['outgoing', 30, true, 0],
    ['expired', 1, true, 0],
    ['player', 30, false, 0],
    ['incoming', 30, true, 3]
  ]) {
    const grant = (runtime) => {
      if (duration)
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'buff',
            kind: 'alacrity',
            at: runtime.time,
            duration,
            stacks: 1,
            source: 'fixture',
            sourceId: 'fixture',
            actorType: 'player',
            audience: { recipients: 'party' }
          }
        });
    };

    let sample;
    const result = runRanger(
      [
        { type: 'combat-start' },
        { type: 'wait', durationMs: 2000 },
        'Swap Pets',
        { type: 'wait', durationMs: 1000 },
        'Poisonous Cloud',
        'Poisonous Cloud',
        // Keep observation open until the pet lane executes the queued repeat command.
        { type: 'wait', durationMs: 40000 }
      ],
      {
        selectedPet: 'Tiger',
        selectedPet2: 'Carrion Devourer',
        boons: {},
        allies: { count: 0 },
        sharePlayerBoonsWithSummons: sharing
      },
      {
        initialize(runtime) {
          if (!grantAt) grant(runtime);
        },
        timeline: grantAt ? [{ at: grantAt, run: grant }] : [],
        probes: [
          [
            5,
            (runtime) => {
              const skill = runtime.helpers.skillsById.get(ID.POISONOUS_CLOUD);
              const progress = runtime.cooldownController.rechargeFor(skill.id);
              assert.equal(progress.companionId, rangerPetCompanionId(runtime));
              assert.equal(runtime.cooldownController.rechargeFor(skill.id).companionId, progress.companionId);
              sample = {
                readyAt: runtime.cooldownController.project(skill, progress),
                baseReadyAt: progress.startedAt + progress.work
              };
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const commands = result.events.filter((event) => event.type === 'action' && event.skillId === ID.POISONOUS_CLOUD);
    observations.set(label, { ...sample, nextCommandAt: commands[1].at });
  }

  const baseline = observations.get('none');
  assert.equal(baseline.readyAt, baseline.baseReadyAt);
  for (const label of ['outgoing', 'expired', 'player']) assert.deepEqual(observations.get(label), baseline);
  assert.ok(observations.get('incoming').readyAt < baseline.readyAt);
  assert.ok(observations.get('incoming').nextCommandAt < baseline.nextCommandAt);
});
