import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { effectFields, effectPlanningState } from '#tests/helpers/effect-report.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { snapshotProfessionState } from '#tests/helpers/profession-state.js';

test('planning projections omit private mechanic state while retaining visible observations', () => {
  // Availability is observed in the runtime; presentation does not need its internal counters, costs, or schedules.
  for (const [family, specialization, slice, privateKeys, visibleKey, stateId] of [
    [
      elementalistProfession,
      'Core',
      'core',
      ['spearNextDamageBonus', 'spearNextRechargeReduction', 'spearNextGuaranteedCritical', 'spearNextControlHit'],
      'primaryAttunement',
      STATE.PRIMARY_ATTUNEMENT
    ],
    [
      guardianProfession,
      'Core',
      'core',
      ['justiceHitCount', 'virtueReadyAt'],
      'symbolicAvengerExpirations',
      STATE.SYMBOLIC_AVENGER_EXPIRATIONS
    ],
    [rangerProfession, 'Core', 'core', ['nextPetInstance', 'player'], 'activePetSlot', STATE.ACTIVE_PET_SLOT],
    [
      thiefProfession,
      'Antiquary',
      'specialization',
      ['backfireState', 'canachCoinIndex'],
      'artifactSlots',
      STATE.ARTIFACT_SLOTS
    ],
    [revenantProfession, 'Conduit', 'specialization', ['beguilingHazeRecharge'], 'affinity', STATE.AFFINITY],
    [warriorProfession, 'Bladesworn', 'specialization', ['dragonChargeReachedAt'], 'flow', STATE.FLOW],
    [
      warriorProfession,
      'Paragon',
      'specialization',
      ['commandEchoes', 'activeRefrainId'],
      'motivation',
      STATE.MOTIVATION
    ]
  ]) {
    const config = { specialization };
    const profession = family.runtimeFor(config).createState(config);
    const owner = slice === 'core' ? profession.core : profession.specialization.state;
    const projected = projectObservedState(family, { profession, config, time: 0 });
    for (const key of privateKeys) {
      assert.equal(Object.hasOwn(owner, key), true, `${family.id}/${specialization}: live ${key}`);
      assert.equal(Object.hasOwn(projected, key), false, `${family.id}/${specialization}: projected ${key}`);
    }

    assert.deepEqual(projected[stateId], owner[visibleKey]);

    if (typeof owner[visibleKey] === 'object') assert.notEqual(projected[stateId], owner[visibleKey]);
  }
});

test('Ranger pet projections expose detached observations without traversing private pet state', () => {
  const config = { specialization: 'Core' };
  const profession = rangerProfession.runtimeFor(config).createState(config);
  const pet = profession.core.pet;
  // A nested privacy check must inspect the actual pet owner, not only the player's state keys.
  for (const key of ['activationClaims', 'effects', 'autoAction', 'commandReadyAt']) {
    assert.equal(Object.hasOwn(pet, key), true);
    Object.defineProperty(pet, key, { get: () => assert.fail(`Projection read private pet ${key}`) });
  }

  const projected = projectObservedState(rangerProfession, { profession, config, time: 0 });
  for (const key of ['activationClaims', 'effects', 'autoAction', 'commandReadyAt'])
    assert.equal(Object.hasOwn(projected[STATE.PET], key), false);
  assert.equal(projected[STATE.PET].id, pet.id);
  projected[STATE.PET].ferociousSymbiosis.stacks = 5;
  assert.equal(pet.ferociousSymbiosis.stacks, 0);
});

test('public expiry projections use exclusive deadlines without mutating the live owner', () => {
  // Expiration is an observation of stored deadlines, independent of queued work or a later grant.
  for (const [family, specialization, slice, key, value, expired, stateId] of [
    [
      warriorProfession,
      'Spellbreaker',
      'specialization',
      'attackerInsightExpiries',
      [5, 7],
      [7],
      STATE.ATTACKER_INSIGHT_EXPIRIES
    ],
    [warriorProfession, 'Spellbreaker', 'specialization', 'magebaneTetherUntil', 5, 0, STATE.MAGEBANE_TETHER_UNTIL],
    [
      warriorProfession,
      'Bladesworn',
      'specialization',
      'overchargedCartridgeWindows',
      [{ startedAt: 1, expiresAt: 5 }],
      [],
      STATE.OVERCHARGED_CARTRIDGE_WINDOWS
    ],
    [rangerProfession, 'Untamed', 'specialization', 'ambushReadyUntil', 5, 0, STATE.AMBUSH_READY_UNTIL],
    [guardianProfession, 'Core', 'core', 'symbolicAvengerExpirations', [5, 7], [7], STATE.SYMBOLIC_AVENGER_EXPIRATIONS],
    [guardianProfession, 'Dragonhunter', 'specialization', 'tetherUntil', 5, 0, STATE.TETHER_UNTIL]
  ]) {
    const config = { specialization };
    const profession = family.runtimeFor(config).createState(config);
    const owner = slice === 'core' ? profession.core : profession.specialization.state;
    owner[key] = structuredClone(value);
    for (const time of [4.999999, 5, 5.000001]) {
      const projected = projectObservedState(family, { profession, config, time });
      assert.deepEqual(projected[stateId], time < 5 ? value : expired, `${specialization}.${key} at ${time}`);
      assert.deepEqual(owner[key], value, 'Projection leaves the stored deadlines untouched');
    }
  }
});

test('filtered public windows remain deeply detached from their live owners', () => {
  // Filtering must preserve nested detachment even when a visible window survives the observation.
  const guardian = guardianProfession.runtimeFor({ specialization: 'Core' }).createState({ specialization: 'Core' });
  const expiredFlip = { identity: 1, visibleAt: 0, availableAt: 0, expiresAt: 5, remainingUses: 1 };
  const visibleFlip = { identity: 2, visibleAt: 0, availableAt: 0, expiresAt: 7, remainingUses: 1 };
  guardian.core.availableFlips = { expired: expiredFlip, visible: visibleFlip };
  const guardianProjection = projectObservedState(guardianProfession, { profession: guardian, time: 5 });
  assert.deepEqual(guardianProjection[STATE.AVAILABLE_FLIPS], { visible: visibleFlip });
  guardianProjection[STATE.AVAILABLE_FLIPS].visible.expiresAt = 99;
  assert.equal(visibleFlip.expiresAt, 7);
  assert.equal(guardian.core.availableFlips.expired, expiredFlip);

  const config = { specialization: 'Bladesworn' };
  const bladesworn = warriorProfession.runtimeFor(config).createState(config);
  const cartridge = {
    startedAt: 1,
    expiresAt: 7,
    damageBonus: 0.15,
    burningDuration: 3,
    supercharged: false
  };
  bladesworn.specialization.state.overchargedCartridgeWindows = [cartridge];
  const bladeswornProjection = projectObservedState(warriorProfession, { profession: bladesworn, time: 5 });
  assert.deepEqual(bladeswornProjection[STATE.OVERCHARGED_CARTRIDGE_WINDOWS], [cartridge]);
  bladeswornProjection[STATE.OVERCHARGED_CARTRIDGE_WINDOWS][0].damageBonus = 99;
  assert.equal(cartridge.damageBonus, 0.15);
});

test('Mesmer public projectors do not traverse private cast history', () => {
  // Private acceptance records must not be visited merely to publish the Core and active elite observations.
  for (const specialization of ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']) {
    const config = { specialization };
    const profession = mesmerProfession.runtimeFor(config).createState(config);
    profession.core.castDetails.set('private-cast', {
      get clarityConsumed() {
        return assert.fail('Projection traversed private cast details');
      }
    });
    const flip = { identity: 1, visibleAt: 0, availableAt: 0, expiresAt: 7, remainingUses: 1 };
    profession.core.availableFlips = { visible: flip, expired: { ...flip, identity: 2, expiresAt: 5 } };
    const projected = projectObservedState(mesmerProfession, { profession, config, time: 5 });
    assert.equal(Object.hasOwn(projected, 'castDetails'), false);
    assert.deepEqual(projected[STATE.AVAILABLE_FLIPS], { visible: flip });
    projected[STATE.AVAILABLE_FLIPS].visible.expiresAt = 99;
    assert.equal(flip.expiresAt, 7);
    assert.equal(profession.core.availableFlips.expired.expiresAt, 5);
  }
});

test('Mesmer public endurance and instrument observations remain detached', () => {
  // Display consumers can edit both copied clocks and derived entries without changing their live owners.
  for (const specialization of ['Mirage', 'Troubadour']) {
    const config = { specialization };
    const profession = mesmerProfession.runtimeFor(config).createState(config);
    const state = profession.specialization.state;

    if (specialization === 'Troubadour') state.instruments = { Lute: 7, Flute: 5 };

    const projected = projectObservedState(mesmerProfession, { profession, config, time: 5 });
    assert.deepEqual(projected[STATE.ENDURANCE], state.endurance);
    projected[STATE.ENDURANCE].value = 0;
    assert.equal(state.endurance.value, 100);

    if (specialization === 'Troubadour') {
      assert.deepEqual(projected[STATE.ACTIVE_INSTRUMENTS], [{ name: 'Lute', remaining: 2000 }]);
      projected[STATE.ACTIVE_INSTRUMENTS][0].name = 'edited';
      assert.deepEqual(state.instruments, { Lute: 7, Flute: 5 });
    }
  }
});

test('Antiquary filters refund grants without sharing surviving grants with live state', () => {
  // Expiry and earliest-first display ordering affect the detached observation, never the owner's grants or order.
  const config = { specialization: 'Antiquary' };
  const profession = thiefProfession.runtimeFor(config).createState(config);
  const grants = [
    { charges: 2, expiresAt: 9 },
    { charges: 1, expiresAt: 5 },
    { charges: 3, expiresAt: 7 }
  ];
  profession.specialization.state.chakInitiativeRefunds = grants;
  const projected = projectObservedState(thiefProfession, { profession, config, time: 5 });
  assert.deepEqual(projected[STATE.CHAK_INITIATIVE_REFUNDS], [grants[2], grants[0]]);
  projected[STATE.CHAK_INITIATIVE_REFUNDS][0].charges = 0;
  assert.deepEqual(grants, [
    { charges: 2, expiresAt: 9 },
    { charges: 1, expiresAt: 5 },
    { charges: 3, expiresAt: 7 }
  ]);
});

test('force clocks are detached in snapshots and planning projections and absent for inactive specializations', () => {
  // Snapshots and presentation share one clock shape without sharing mutable resource state.
  for (const [profession, specialization, clockKey, stateId] of [
    [rangerProfession, 'Druid', 'astralClock', STATE.ASTRAL_CLOCK],
    [thiefProfession, 'Specter', 'shadowClock', STATE.SHADOW_CLOCK]
  ]) {
    const config = { specialization };
    const runtime = profession.runtimeFor(config);
    const state = runtime.createState(config);
    const clock = state.specialization.state[clockKey];
    Object.assign(clock, { value: 37, maximum: 90, updatedAt: 2 });
    const detached = snapshotProfessionState(state);
    assert.deepEqual(detached[clockKey], clock);
    assert.notEqual(detached[clockKey], clock);
    const projected = projectObservedState(profession, { profession: state, time: 2 });
    assert.deepEqual(projected[stateId], clock);
    assert.notEqual(projected[stateId], clock);
    // Projection must leave the live resource and its capacity untouched.
    assert.deepEqual(clock, { value: 37, maximum: 90, updatedAt: 2, rate: 0 });
    for (const professionState of [projected]) {
      const resources = profession.ui.resourceViews({ specialization, professionState });
      assert.equal(
        resources.find(({ id }) => id === (specialization === 'Druid' ? 'astral-force' : 'shadow-force')).value,
        37
      );
    }

    clock.value = 12;
    assert.equal(detached[clockKey].value, 37);
    assert.equal(projected[stateId].value, 37);
    assert.equal(clock.value, 12);
    assert.equal(detached[clockKey].value, 37);

    const core = profession.runtimeFor({ specialization: 'Core' }).createState({ specialization: 'Core' });
    const inactive = projectObservedState(profession, { profession: core, time: 0 });
    assert.equal(inactive[stateId], undefined);
  }
});

function snapshot(profession, specialization, professionState, atSeconds, result) {
  // These fixture buffs were scheduled and committed; specialized views can inspect either report history.
  if (result) result = { ...result, events: result.resolvedEvents };

  return profession.ui.rotationStateSnapshot({
    balanceContext: withPatchPreview(profession).resolvePatch().balanceContext,
    specialization,
    professionState,
    atSeconds,
    planningState: effectPlanningState(result, atSeconds),
    result
  });
}

function valuesById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item.value]));
}

// Each case supplies the smallest projected state needed to prove the profession
// hooks expose active values and omit expired windows at an insertion point.
test('Elementalist snapshots include Weaver and Catalyst stack/timer windows', () => {
  const weaver = valuesById(
    snapshot(
      elementalistProfession,
      'Weaver',
      { [STATE.PRIMARY_ATTUNEMENT]: 'Fire', [STATE.SECONDARY_ATTUNEMENT]: 'Air', [STATE.UNRAVEL_UNTIL]: 9 },
      4
    )
  );
  assert.equal(weaver.unravel, '5.0s');

  const catalyst = valuesById(
    snapshot(
      elementalistProfession,
      'Catalyst',
      {
        [STATE.ELEMENTAL_EMPOWERMENT_EXPIRIES]: [11, 14, 15],
        [STATE.SPHERE_EXPIRY]: { Fire: 15, Water: 10, Air: 0, Earth: 0 }
      },
      12,
      {
        ...effectFields([], 120, {
          frames: [
            {
              at: 0,
              states: [
                timedEffectState(
                  'elemental empowerment',
                  [11, 14, 15].map((expiresAt) => ({ expiresAt, stacks: 1 })),
                  10
                )
              ]
            },
            {
              at: 1,
              states: [
                timedEffectState(
                  'elemental empowerment',
                  [11, 14, 15].map((expiresAt) => ({ expiresAt, stacks: 1 })),
                  10
                ),
                timedEffectState('empowering auras', [{ expiresAt: 11, stacks: 1 }], 5)
              ]
            },
            {
              at: 9,
              states: [
                timedEffectState(
                  'elemental empowerment',
                  [11, 14, 15].map((expiresAt) => ({ expiresAt, stacks: 1 })),
                  10
                ),
                timedEffectState('empowering auras', [{ expiresAt: 19, stacks: 2 }], 5)
              ]
            }
          ]
        })
      }
    )
  );
  assert.equal(catalyst['catalyst-elemental-empowerment'], '2/10');
  assert.equal(catalyst['catalyst-empowering-auras'], '2/5 · 7.0s');
  assert.equal(catalyst['catalyst-fire-sphere'], '3.0s');
  assert.equal(catalyst['catalyst-water-sphere'], undefined);

  const evoker = valuesById(snapshot(elementalistProfession, 'Evoker', { [STATE.ELEMENTAL_BALANCE_UNTIL]: 8.5 }, 6));
  assert.equal(evoker['evoker-elemental-balance'], '2.5s');
});

test('Amalgam snapshot includes Evolve and all active duration-bearing strains', () => {
  const values = valuesById(
    snapshot(
      engineerProfession,
      'Amalgam',
      { [STATE.EVOLVED_UNTIL]: 12, [STATE.RAPACIOUS_UNTIL]: 10, [STATE.TITANIC_UNTIL]: 11 },
      5,
      {
        ...effectFields(
          [
            {
              type: 'buff',
              resolvedAudience: {
                includesSelf: true,
                includesSummons: false,
                companionIds: [],
                alliedPlayerCount: 0,
                recipientCount: 1
              },
              sourceId: 'engineer.resiliant-strain',
              at: 1,
              duration: 8
            }
          ],
          120
        )
      }
    )
  );
  assert.equal(values['amalgam-evolve'], '7.0s');
  assert.equal(values['amalgam-active-strains'], 'Resiliant 4.0s · Rapacious 5.0s · Titanic 6.0s');
});

test('Guardian snapshots combine core and elite active state', () => {
  const willbender = valuesById(
    snapshot(
      guardianProfession,
      'Willbender',
      {
        [STATE.SYMBOLIC_AVENGER_EXPIRATIONS]: [4, 7, 8, 9],
        [STATE.JUSTICE_UNTIL]: 8,
        [STATE.RESOLVE_UNTIL]: 7,
        [STATE.COURAGE_UNTIL]: 3,
        [STATE.LETHAL_TEMPO]: { stacks: 4, expiresAt: 10 }
      },
      4
    )
  );
  assert.equal(willbender['guardian-symbolic-avenger'], '3/5 · 5.0s');
  assert.equal(willbender['willbender-rushing-justice'], '4.0s');
  assert.equal(willbender['willbender-flowing-resolve'], '3.0s');
  assert.equal(willbender['willbender-crashing-courage'], undefined);
  assert.equal(willbender['willbender-lethal-tempo'], '4/5 · 6.0s');

  const dragonhunter = valuesById(snapshot(guardianProfession, 'Dragonhunter', { [STATE.TETHER_UNTIL]: 9 }, 4));
  assert.equal(dragonhunter['dragonhunter-tether'], '5.0s');

  const luminary = valuesById(
    snapshot(
      guardianProfession,
      'Luminary',
      { [STATE.LIGHT_AURA_UNTIL]: 7, [STATE.EFFULGENT_STACKS]: 7, [STATE.EFFULGENT_ACTIVE_UNTIL]: 6 },
      4
    )
  );
  assert.equal(luminary['luminary-light-aura'], '3.0s');
  assert.equal(luminary['luminary-effulgent-stance'], '7/10 · 2.0s');
  assert.equal(
    valuesById(snapshot(guardianProfession, 'Luminary', { [STATE.LIGHT_AURA_UNTIL]: 4 }, 4))['luminary-light-aura'],
    undefined
  );
});

test('Mesmer and Harbinger snapshots expose their short decision windows', () => {
  const mesmer = valuesById(
    snapshot(
      mesmerProfession,
      'Chronomancer',
      { [STATE.CLARITY_REMAINING]: 3500, [STATE.CONTINUUM_ACTIVE]: true, [STATE.CONTINUUM_REMAINING]: 4200 },
      10,
      {
        ...effectFields(
          [
            {
              type: 'buff',
              resolvedAudience: {
                includesSelf: true,
                includesSummons: false,
                companionIds: [],
                alliedPlayerCount: 0,
                recipientCount: 1
              },
              kind: 'danger-time',
              at: 8,
              duration: 10,
              stacks: 1
            }
          ],
          120
        )
      }
    )
  );
  assert.equal(mesmer['mesmer-clarity'], '3.5s');
  assert.equal(mesmer['chronomancer-continuum-split'], '4.2s');
  assert.equal(mesmer['chronomancer-danger-time'], '8.0s');

  const expiredDangerTime = valuesById(
    snapshot(mesmerProfession, 'Chronomancer', {}, 19, {
      ...effectFields(
        [
          {
            type: 'buff',
            resolvedAudience: {
              includesSelf: true,
              includesSummons: false,
              companionIds: [],
              alliedPlayerCount: 0,
              recipientCount: 1
            },
            kind: 'danger-time',
            at: 8,
            duration: 10,
            stacks: 1
          }
        ],
        120
      )
    })
  );
  assert.equal(expiredDangerTime['chronomancer-danger-time'], undefined);

  const harbinger = valuesById(
    snapshot(necromancerProfession, 'Harbinger', { [STATE.BLIGHT]: 12, [STATE.MELTDOWN_UNTIL]: 9 }, 6)
  );
  assert.equal(harbinger['harbinger-meltdown'], '3.0s');
});

test('Ranger snapshots expose elite windows and resolver-owned Ferocious Symbiosis', () => {
  const soulbeast = valuesById(snapshot(rangerProfession, 'Soulbeast', { [STATE.ONE_WOLF_PACK_UNTIL]: 9 }, 4));
  assert.equal(soulbeast['soulbeast-one-wolf-pack'], '5.0s');

  const untamed = valuesById(
    snapshot(
      rangerProfession,
      'Untamed',
      {
        [STATE.AMBUSH_READY_UNTIL]: 7,
        [STATE.FEROCIOUS_SYMBIOSIS_PLAYER]: { stacks: 3, expiresAt: 9 },
        [STATE.PET]: { id: 'pet', ferociousSymbiosis: { stacks: 5, expiresAt: 8 } }
      },
      4
    )
  );
  assert.equal(untamed['untamed-ambush-window'], '3.0s');
  assert.equal(untamed['untamed-ferocious-symbiosis-player'], '3/5 · 5.0s');
  assert.equal(untamed['untamed-ferocious-symbiosis-pet'], '5/5 · 4.0s');

  const projected = projectObservedState(rangerProfession, {
    profession: rangerProfession.runtimeFor({ specialization: 'Untamed' }).createState({ specialization: 'Untamed' })
  });
  assert.equal(projected[STATE.FEROCIOUS_SYMBIOSIS_PLAYER].stacks, 0);
  assert.equal(projected[STATE.FEROCIOUS_SYMBIOSIS_PLAYER].expiresAt, 0);

  const galeshot = valuesById(snapshot(rangerProfession, 'Galeshot', { [STATE.MISTRAL_UNTIL]: 7.5 }, 4));
  assert.equal(galeshot['galeshot-mistral'], '3.5s');
});

test('Revenant snapshots expose shared drains and elite stack/form windows', () => {
  const renegade = valuesById(
    snapshot(
      revenantProfession,
      'Renegade',
      {
        [STATE.ACTIVE_UPKEEPS]: [
          { skillId: 1, upkeepCost: 6, startsAt: 0, empoweredNextPulse: false },
          { skillId: 2, upkeepCost: 2, startsAt: 0, empoweredNextPulse: false }
        ],
        [STATE.CRUSHING_ABYSS]: [3, 9, 11],
        [STATE.KALLAS_FERVOR]: [
          { at: 1, expiresAt: 10 },
          { at: 2, expiresAt: 11 }
        ]
      },
      4,
      effectFields(
        [
          {
            type: 'buff',
            kind: 'band-together',
            at: 0,
            duration: 8,
            stacks: 1,
            resolvedAudience: {
              includesSelf: true,
              includesSummons: false,
              companionIds: [],
              alliedPlayerCount: 0,
              recipientCount: 1
            }
          }
        ],
        10,
        { policies: [{ kind: 'band-together', maximumStacks: 1 }] }
      )
    )
  );
  assert.equal(renegade['revenant-upkeep-drain'], '-8/s');
  assert.equal(renegade['revenant-crushing-abyss'], '2/3 · 5.0s');
  assert.equal(renegade['renegade-kallas-fervor'], '2/5 · 6.0s');
  assert.equal(renegade['renegade-band-together'], '4.0s');

  const conduit = valuesById(
    snapshot(revenantProfession, 'Conduit', { [STATE.CONDUIT_FORM]: 'Mesmer', [STATE.COSMIC_WISDOM_UNTIL]: 9 }, 4)
  );
  assert.equal(conduit['conduit-cosmic-wisdom'], 'Mesmer · 5.0s');

  const vindicator = valuesById(snapshot(revenantProfession, 'Vindicator', { [STATE.REAVERS_CURSE_UNTIL]: 7 }, 4));
  assert.equal(vindicator['vindicator-reavers-curse'], '3.0s');
});

test('Thief snapshots expose stealth gates, Bounding Dodger, Combat High, and artifact effects', () => {
  const revealed = valuesById(
    snapshot(thiefProfession, 'Core', { [STATE.STEALTH_UNTIL]: 12, [STATE.REVEALED_UNTIL]: 7 }, 4)
  );
  assert.equal(revealed['thief-revealed'], '3.0s');
  assert.equal(revealed['thief-stealth'], undefined);

  const daredevil = valuesById(
    snapshot(
      thiefProfession,
      'Daredevil',
      {},
      4,
      effectFields([], 10, {
        frames: [{ at: 0, states: [timedEffectState('bounding-dodger', [{ stacks: 1, expiresAt: 9 }], 1)] }]
      })
    )
  );
  assert.equal(daredevil['daredevil-bounding-dodger'], '5.0s');

  const antiquary = valuesById(
    snapshot(
      thiefProfession,
      'Antiquary',
      {
        [STATE.COMBAT_HIGH_EXPIRATIONS]: [6, 8, 10, 12, 14, 16, 18, 20],
        [STATE.ANTIQUARY_DAMAGE_UNTIL]: 9,
        [STATE.BONUS_STEALTH_ATTACK]: { charges: 2, expiresAt: 8 },
        [STATE.MISTBURN]: { charges: 4, expiresAt: 10 },
        [STATE.KRYPTIS_DAMAGE_UNTIL]: 11,
        [STATE.CHAK_INITIATIVE_REFUNDS]: [{ charges: 3, expiresAt: 12 }],
        [STATE.HOLO_UTILITY_COOLDOWN_REDUCTION_EXPIRATIONS]: [3, 13, 14]
      },
      4
    )
  );
  assert.equal(antiquary['antiquary-combat-high'], '8/10 · 16.0s');
  assert.equal(antiquary['antiquary-exhilarating-ephemera'], '5.0s');
  assert.equal(antiquary['antiquary-metal-legion-guitar'], '2 charges · 4.0s');
  assert.equal(antiquary['antiquary-mistburn-mortar'], '4 charges · 6.0s');
  assert.equal(antiquary['antiquary-kryptis-turret'], '7.0s');
  assert.equal(antiquary['antiquary-chak-shield'], '3 charges · 8.0s');
  assert.equal(antiquary['antiquary-holo-dancer-decoy'], '2 uses · 9.0s');
});

test('Warrior snapshots expose shared stacks, Bladesworn buffs, and Paragon refrain', () => {
  const result = {
    ...effectFields(
      [
        {
          type: 'buff',
          resolvedAudience: {
            includesSelf: true,
            includesSummons: false,
            companionIds: [],
            alliedPlayerCount: 0,
            recipientCount: 1
          },
          kind: 'furious-surge',
          at: 1,
          duration: 10,
          stacks: 3
        },
        {
          type: 'buff',
          resolvedAudience: {
            includesSelf: true,
            includesSummons: false,
            companionIds: [],
            alliedPlayerCount: 0,
            recipientCount: 1
          },
          kind: 'berserkers-power',
          at: 2,
          duration: 15,
          stacks: 2
        },
        {
          type: 'buff',
          resolvedAudience: {
            includesSelf: true,
            includesSummons: false,
            companionIds: [],
            alliedPlayerCount: 0,
            recipientCount: 1
          },
          kind: 'fierce-as-fire',
          at: 2,
          duration: 15,
          stacks: 6
        },
        {
          type: 'buff',
          resolvedAudience: {
            includesSelf: true,
            includesSummons: false,
            companionIds: [],
            alliedPlayerCount: 0,
            recipientCount: 1
          },
          kind: 'guns-and-glory',
          at: 3,
          duration: 10,
          stacks: 1
        }
      ],
      120
    )
  };
  const bladesworn = valuesById(snapshot(warriorProfession, 'Bladesworn', {}, 4, result));
  assert.equal(bladesworn['furious-surge'], '3/25');
  assert.equal(bladesworn['berserkers-power'], '2/4');
  assert.equal(bladesworn['bladesworn-fierce-as-fire'], '6/10');
  assert.equal(bladesworn['bladesworn-guns-and-glory'], '9.0s');

  const paragon = valuesById(
    snapshot(
      warriorProfession,
      'Paragon',
      {
        [STATE.ACTIVE_REFRAIN]: 'Chant of Action',
        [STATE.MOTIVATION]: { value: 5, maximum: 10, rate: 0, updatedAt: 4 }
      },
      4
    )
  );
  assert.equal(paragon['paragon-active-refrain'], 'Chant of Action');
});
