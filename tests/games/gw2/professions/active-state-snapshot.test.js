import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';

import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { projectRangerPlanningState } from '#gw2/professions/ranger/family-state.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { projectThiefPlanningState } from '#gw2/professions/thief/family-state.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

test('force clocks are detached in snapshots and planning projections and absent for inactive specializations', () => {
  // Snapshots and presentation share one clock shape without sharing mutable resource state.
  for (const [profession, specialization, clockKey, project] of [
    [rangerProfession, 'Druid', 'astralClock', projectRangerPlanningState],
    [thiefProfession, 'Specter', 'shadowClock', projectThiefPlanningState]
  ]) {
    const config = { specialization };
    const runtime = profession.runtimeFor(config);
    const state = runtime.createState(config);
    const clock = state.specialization.state[clockKey];
    Object.assign(clock, { value: 37, maximum: 90, updatedAt: 2 });
    const detached = snapshotProfessionState(state);
    assert.deepEqual(detached[clockKey], clock);
    assert.notEqual(detached[clockKey], clock);
    const projected = project({ profession: state, time: 2 });
    assert.deepEqual(projected[clockKey], clock);
    assert.notEqual(projected[clockKey], clock);
    // Projection must leave the live resource and its capacity untouched.
    assert.deepEqual(clock, { value: 37, maximum: 90, updatedAt: 2, rate: 0 });
    for (const professionState of [state, detached, projected]) {
      const resources = profession.ui.resourceViews({ specialization, professionState });
      assert.equal(
        resources.find(({ id }) => id === (specialization === 'Druid' ? 'astral-force' : 'shadow-force')).value,
        37
      );
    }

    clock.value = 12;
    assert.equal(detached[clockKey].value, 37);
    assert.equal(projected[clockKey].value, 37);
    // Palette entry gates must consume the projected clock, including an explicit zero.
    const entrySkill = profession.catalog.skillsByName.get(
      specialization === 'Druid' ? 'Celestial Avatar' : 'Enter Shadow Shroud'
    );
    for (const value of [0, 100]) {
      projected[clockKey].value = value;
      assert.equal(
        profession.ui.paletteSkillAvailability({ specialization, professionState: projected }, entrySkill).available,
        value === 100
      );
    }

    assert.equal(clock.value, 12);
    assert.equal(detached[clockKey].value, 37);

    const core = profession.runtimeFor({ specialization: 'Core' }).createState({ specialization: 'Core' });
    const inactive = project({ profession: core, time: 0 });
    assert.equal(inactive[clockKey], undefined);
  }
});

function snapshot(profession, specialization, professionState, atSeconds, result) {
  // These fixture buffs were scheduled and committed; specialized views can inspect either report history.
  if (result) result = { ...result, events: result.resolvedEvents };
  return profession.ui.rotationStateSnapshot({
    catalog: profession.catalog,
    specialization,
    professionState,
    atSeconds,
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
      { primaryAttunement: 'Fire', secondaryAttunement: 'Air', unravelUntil: 9 },
      4
    )
  );
  assert.equal(weaver.unravel, '5.0s');

  const catalyst = valuesById(
    snapshot(
      elementalistProfession,
      'Catalyst',
      {
        elementalEmpowermentExpiries: [11, 14, 15],
        sphereExpiry: { Fire: 15, Water: 10, Air: 0, Earth: 0 }
      },
      12,
      {
        resolvedEvents: [
          {
            type: 'buff',
            resolvedAudience: {
              includesSelf: true,
              includesSummons: false,
              companionIds: [],
              alliedPlayerCount: 0,
              recipientCount: 1
            },
            kind: 'empowering auras',
            at: 1,
            duration: 10,
            stacks: 1
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
            kind: 'empowering auras',
            at: 9,
            duration: 10,
            stacks: 1
          }
        ]
      }
    )
  );
  assert.equal(catalyst['catalyst-elemental-empowerment'], '2/10');
  assert.equal(catalyst['catalyst-empowering-auras'], '2/5 · 7.0s');
  assert.equal(catalyst['catalyst-fire-sphere'], '3.0s');
  assert.equal(catalyst['catalyst-water-sphere'], undefined);

  const evoker = valuesById(snapshot(elementalistProfession, 'Evoker', { elementalBalanceUntil: 8.5 }, 6));
  assert.equal(evoker['evoker-elemental-balance'], '2.5s');
});

test('Amalgam snapshot includes Evolve and all active duration-bearing strains', () => {
  const values = valuesById(
    snapshot(engineerProfession, 'Amalgam', { evolvedUntil: 12, rapaciousUntil: 10, titanicUntil: 11 }, 5, {
      resolvedEvents: [
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
      ]
    })
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
        symbolicAvengerExpirations: [4, 7, 8, 9],
        justiceUntil: 8,
        resolveUntil: 7,
        courageUntil: 3,
        lethalTempoStacks: 4,
        lethalTempoUntil: 10
      },
      4
    )
  );
  assert.equal(willbender['guardian-symbolic-avenger'], '3/5 · 5.0s');
  assert.equal(willbender['willbender-rushing-justice'], '4.0s');
  assert.equal(willbender['willbender-flowing-resolve'], '3.0s');
  assert.equal(willbender['willbender-crashing-courage'], undefined);
  assert.equal(willbender['willbender-lethal-tempo'], '4/5 · 6.0s');

  const dragonhunter = valuesById(snapshot(guardianProfession, 'Dragonhunter', { tetherUntil: 9 }, 4));
  assert.equal(dragonhunter['dragonhunter-tether'], '5.0s');

  const luminary = valuesById(
    snapshot(guardianProfession, 'Luminary', { lightAuraUntil: 7, effulgentStacks: 7, effulgentActiveUntil: 6 }, 4)
  );
  assert.equal(luminary['luminary-light-aura'], '3.0s');
  assert.equal(luminary['luminary-effulgent-stance'], '7/10 · 2.0s');
  assert.equal(
    valuesById(snapshot(guardianProfession, 'Luminary', { lightAuraUntil: 4 }, 4))['luminary-light-aura'],
    undefined
  );
});

test('Mesmer and Harbinger snapshots expose their short decision windows', () => {
  const mesmer = valuesById(
    snapshot(
      mesmerProfession,
      'Chronomancer',
      { clarityRemaining: 3500, continuumActive: true, continuumRemaining: 4200 },
      10,
      {
        resolvedEvents: [
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
        ]
      }
    )
  );
  assert.equal(mesmer['mesmer-clarity'], '3.5s');
  assert.equal(mesmer['chronomancer-continuum-split'], '4.2s');
  assert.equal(mesmer['chronomancer-danger-time'], '8.0s');

  const expiredDangerTime = valuesById(
    snapshot(mesmerProfession, 'Chronomancer', {}, 19, {
      resolvedEvents: [
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
      ]
    })
  );
  assert.equal(expiredDangerTime['chronomancer-danger-time'], undefined);

  const harbinger = valuesById(snapshot(necromancerProfession, 'Harbinger', { blight: 12, meltdownUntil: 9 }, 6));
  assert.equal(harbinger['harbinger-meltdown'], '3.0s');
});

test('Ranger snapshots expose elite windows and resolver-owned Ferocious Symbiosis', () => {
  const soulbeast = valuesById(snapshot(rangerProfession, 'Soulbeast', { oneWolfPackUntil: 9 }, 4));
  assert.equal(soulbeast['soulbeast-one-wolf-pack'], '5.0s');

  const untamed = valuesById(
    snapshot(
      rangerProfession,
      'Untamed',
      {
        ambushReadyUntil: 7,
        ferociousSymbiosisPlayerStacks: 3,
        ferociousSymbiosisPlayerUntil: 9,
        ferociousSymbiosisPetStacks: 5,
        ferociousSymbiosisPetUntil: 8
      },
      4
    )
  );
  assert.equal(untamed['untamed-ambush-window'], '3.0s');
  assert.equal(untamed['untamed-ferocious-symbiosis-player'], '3/5 · 5.0s');
  assert.equal(untamed['untamed-ferocious-symbiosis-pet'], '5/5 · 4.0s');

  const projected = projectRangerPlanningState({
    profession: {
      core: {},
      specialization: { kind: 'Untamed', state: { rangerUnleashed: true, ambushReadyUntil: 7 } }
    }
  });
  assert.equal(projected.ferociousSymbiosisPlayerStacks, 0);
  assert.equal(projected.ferociousSymbiosisPlayerUntil, 0);

  const galeshot = valuesById(snapshot(rangerProfession, 'Galeshot', { mistralUntil: 7.5 }, 4));
  assert.equal(galeshot['galeshot-mistral'], '3.5s');
});

test('Revenant snapshots expose shared drains and elite stack/form windows', () => {
  const renegade = valuesById(
    snapshot(
      revenantProfession,
      'Renegade',
      {
        activeUpkeeps: [
          { skillId: 1, upkeepCost: 6 },
          { skillId: 2, upkeepCost: 2 }
        ],
        crushingAbyss: [3, 9, 11],
        kallasFervor: [
          { at: 1, expiresAt: 10 },
          { at: 2, expiresAt: 11 }
        ],
        bandTogetherReady: true,
        bandTogetherExpiresAt: 8
      },
      4
    )
  );
  assert.equal(renegade['revenant-upkeep-drain'], '-8/s');
  assert.equal(renegade['revenant-crushing-abyss'], '2/3 · 5.0s');
  assert.equal(renegade['renegade-kallas-fervor'], '2/5 · 6.0s');
  assert.equal(renegade['renegade-band-together'], '4.0s');

  const conduit = valuesById(
    snapshot(revenantProfession, 'Conduit', { conduitForm: 'Mesmer', cosmicWisdomUntil: 9 }, 4)
  );
  assert.equal(conduit['conduit-cosmic-wisdom'], 'Mesmer · 5.0s');

  const vindicator = valuesById(snapshot(revenantProfession, 'Vindicator', { reaversCurseUntil: 7 }, 4));
  assert.equal(vindicator['vindicator-reavers-curse'], '3.0s');
});

test('Thief snapshots expose stealth gates, Bounding Dodger, Combat High, and artifact effects', () => {
  const revealed = valuesById(snapshot(thiefProfession, 'Core', { stealthUntil: 12, revealedUntil: 7 }, 4));
  assert.equal(revealed['thief-revealed'], '3.0s');
  assert.equal(revealed['thief-stealth'], undefined);

  const daredevil = valuesById(snapshot(thiefProfession, 'Daredevil', { boundingDamageUntil: 9 }, 4));
  assert.equal(daredevil['daredevil-bounding-dodger'], '5.0s');

  const antiquary = valuesById(
    snapshot(
      thiefProfession,
      'Antiquary',
      {
        combatHighExpirations: [6, 8, 10, 12, 14, 16, 18, 20],
        antiquaryDamageUntil: 9,
        stealthAttackCharges: 2,
        stealthAttackExpiresAt: 8,
        mistburn: { charges: 4, expiresAt: 10 },
        kryptisDamageUntil: 11,
        chakInitiativeRefundUntil: 12,
        holoUtilityCooldownReductionExpirations: [3, 13, 14]
      },
      4
    )
  );
  assert.equal(antiquary['antiquary-combat-high'], '8/10 · 16.0s');
  assert.equal(antiquary['antiquary-exhilarating-ephemera'], '5.0s');
  assert.equal(antiquary['antiquary-metal-legion-guitar'], '2 charges · 4.0s');
  assert.equal(antiquary['antiquary-mistburn-mortar'], '4 charges · 6.0s');
  assert.equal(antiquary['antiquary-kryptis-turret'], '7.0s');
  assert.equal(antiquary['antiquary-chak-shield'], '8.0s');
  assert.equal(antiquary['antiquary-holo-dancer-decoy'], '2 uses · 9.0s');
});

test('Warrior snapshots expose shared stacks, Bladesworn buffs, and Paragon refrain', () => {
  const result = {
    resolvedEvents: [
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
    ]
  };
  const bladesworn = valuesById(snapshot(warriorProfession, 'Bladesworn', {}, 4, result));
  assert.equal(bladesworn['furious-surge'], '3/25');
  assert.equal(bladesworn['berserkers-power'], '2/4');
  assert.equal(bladesworn['bladesworn-fierce-as-fire'], '6/10');
  assert.equal(bladesworn['bladesworn-guns-and-glory'], '9.0s');

  const paragon = valuesById(
    snapshot(warriorProfession, 'Paragon', { activeRefrain: 'Chant of Action', motivation: 5 }, 4)
  );
  assert.equal(paragon['paragon-active-refrain'], 'Chant of Action');
});
