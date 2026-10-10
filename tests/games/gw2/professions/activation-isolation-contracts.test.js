import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { MESMER_SKILL_IDS as M, MESMER_TRAIT_IDS as MT } from '#gw2/professions/mesmer/data/ids.js';
import { RANGER_SKILL_IDS as R, RANGER_TRAIT_IDS as RT } from '#gw2/professions/ranger/data/ids.js';
import { WARRIOR_SKILL_IDS as W, WARRIOR_TRAIT_IDS as WT } from '#gw2/professions/warrior/data/ids.js';
import { THIEF_SKILL_IDS as T, THIEF_TRAIT_IDS as TT } from '#gw2/professions/thief/data/ids.js';
import { SHARED_SKILL_IDS as SHARED } from '#gw2/platform/skills/shared-actions.js';
import { DETONATE } from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import { alliedBarrierGranted } from '#gw2/professions/thief/specializations/specter/skills/barrier.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { skillEffectKey } from '#gw2/platform/effects/validation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const combat = { type: 'combat-start' };
const state = (runtime) => runtime.profession.specialization.state;
const cause = (at, fields = {}) => ({
  at,
  source: 'Fixture',
  sourceId: 'fixture',
  skillName: 'Fixture',
  actorType: 'player',
  ...fields
});
const damage = (at, fields = {}) =>
  cause(at, { type: 'damage', coefficient: 1, weaponStrengthProfileId: 'weapon.axe', ...fields });
const packet = (event) => ({ at: event.at, run: (runtime) => runtime.effects.emit({ kind: 'packet', event }) });
const proc = (result, name) => result.procSteps.some((step) => step.skill === name);

/** Use native services to distinguish new activation admission from intrinsic behavior and explicitly admitted work. */
function run(
  family,
  specialization,
  rotation = [combat, wait(4000)],
  { traitTriggers = true, ...config } = {},
  options = {}
) {
  const result = createProfessionSimulator(family)(
    rotation,
    {
      specialization,
      selectedTraitIds: [],
      initialResource: 0,
      boons: {},
      stats: { power: 2000, precision: 4000, conditionDamage: 1000 },
      target: { armor: 2597 },
      ...config
    },
    { ...options, profession: { runtimeFor: (config) => family.runtimeFor(config, { traitTriggers }) } }
  );
  assert.deepEqual(result.warnings, []);
  return { result, runtime: observedRuntime(result) };
}

test('Mesmer heal and control producers respect selection and isolation', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const heal = run(mesmerProfession, 'Core', [combat, M.ETHER_FEAST, wait(100)], {
        traitTriggers,
        selectedTraitIds: selected ? [MT.EGO_RESTORATION] : []
      });
      assert.equal(proc(heal.result, 'Ego Restoration'), selected && traitTriggers);
      for (const [specialization, trait, name] of [
        ['Chronomancer', MT.DANGER_TIME, 'Danger Time'],
        ['Troubadour', MT.SYNCOPATE, 'Syncopate']
      ]) {
        const { result } = run(
          mesmerProfession,
          specialization,
          undefined,
          { traitTriggers, selectedTraitIds: selected ? [trait] : [] },
          {
            timeline: [packet(cause(1, { type: 'control', controlKind: 'daze', skillId: M.TIME_SINK }))]
          }
        );
        assert.equal(proc(result, name), selected && traitTriggers);
      }
    }
});

test('Time Bomb isolates new timers and retains admitted cast-owned explosions after selection changes', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run(
      mesmerProfession,
      'Chronomancer',
      [combat, M.TIME_SINK, wait(7000)],
      {
        traitTriggers,
        selectedTraitIds: [MT.TIME_BOMB],
        initialResource: 3
      },
      {
        timeline: [
          {
            at: 2,
            run(runtime) {
              runtime.traits.delete(MT.TIME_BOMB);
            }
          }
        ]
      }
    );
    assert.equal(state(runtime).timeBombUntil > 0, traitTriggers);
    const explosion = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Time Bomb');
    assert.equal(Boolean(explosion), traitTriggers);
    if (explosion) assert.ok(explosion.activationId);
  }
});

test('Bloodsong isolates counter admission while preserving selected Bleeding damage policy', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { runtime } = run(
        mesmerProfession,
        'Virtuoso',
        undefined,
        {
          traitTriggers,
          selectedTraitIds: selected ? [MT.BLOODSONG] : []
        },
        { timeline: [packet(cause(1, { type: 'condition', condition: 'Bleeding', stacks: 6, duration: 1 }))] }
      );
      const active = selected && traitTriggers;
      assert.equal(state(runtime).bloodsongProgress, active ? 1 : 0);
      assert.equal(runtime.resourceController.value('blades'), Number(active));
    }
});

test('phantasm batches capture selected repeats and bonus blades independently of subsequent trait selection', () => {
  for (const [specialization, trait] of [
    ['Chronomancer', MT.CHRONOPHANTASMA],
    ['Virtuoso', MT.PHANTASMAL_BLADES]
  ]) {
    for (const selected of [false, true])
      for (const traitTriggers of [false, true]) {
        const { result } = run(
          mesmerProfession,
          specialization,
          [combat, M.PHANTASMAL_BERSERKER, wait(12000)],
          {
            traitTriggers,
            primaryWeapon: 'Greatsword',
            selectedTraitIds: [MT.BOUNTIFUL_BLADES, ...(selected ? [trait] : [])]
          },
          {
            timeline: [
              {
                at: 1,
                run(runtime) {
                  runtime.traits.delete(trait);
                }
              }
            ]
          }
        );
        const summons = result.events.find((event) => event.type === 'mesmer.phantasm-summoned');
        assert.equal(summons.count, 2);
        assert.equal(
          proc(result, specialization === 'Chronomancer' ? 'Chronophantasma' : 'Phantasmal Blades'),
          selected && traitTriggers
        );
        // Both co-spawned entities retain their captured resource conversion, even without new reward producers.
        assert.equal(summons.conversionTimes.length, 2);
        if (specialization === 'Chronomancer')
          assert.equal(
            result.events.some((event) => event.type === 'mesmer.phantasm-resummoned'),
            selected && traitTriggers
          );
      }
  }
});

test('Harmonize implicit minor and Mayhem dodge rewards obey isolation', () => {
  for (const traitTriggers of [false, true]) {
    const { result } = run(mesmerProfession, 'Troubadour', [combat, M.PHANTASMAL_BERSERKER, wait(10000)], {
      traitTriggers,
      primaryWeapon: 'Greatsword'
    });
    assert.equal(
      result.events.some((event) => event.type === 'resource' && event.reason === 'Harmonize'),
      traitTriggers
    );
    const { runtime } = run(
      mesmerProfession,
      'Troubadour',
      [SHARED.DODGE],
      { traitTriggers, selectedTraitIds: [MT.MAYHEM] },
      {
        initialize(runtime) {
          runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(M.FLUSTERING_FLUTE), 0, 10);
        }
      }
    );
    assert.equal(runtime.cooldownController.rechargeFor(M.FLUSTERING_FLUTE).work, traitTriggers ? 8.5 : 10);
  }
});

test('Infinite Forge admits its loop through initialization and keeps explicitly admitted renewal available', () => {
  for (const traitTriggers of [false, true])
    for (const admitted of [false, true]) {
      const { runtime } = run(
        mesmerProfession,
        'Virtuoso',
        [wait(4000)],
        { traitTriggers, selectedTraitIds: [MT.INFINITE_FORGE] },
        {
          initialize(runtime) {
            if (admitted) runtime.schedule('mesmer.infinite-forge', 1);
          }
        }
      );
      assert.equal(runtime.resourceController.value('blades') > 0, traitTriggers || admitted);
    }
});

test('Fortifying Bond isolates configured and delivered boon admission and excludes unavailable pets', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const activePet of [false, true]) {
        const { result } = run(
          rangerProfession,
          'Core',
          undefined,
          { traitTriggers, selectedTraitIds: selected ? [RT.FORTIFYING_BOND] : [], boons: { might: 1 } },
          {
            initialize(runtime) {
              runtime.profession.core.petActive = activePet;
            },
            timeline: [packet(cause(1, { type: 'buff', kind: 'fury', stacks: 1, duration: 2 }))]
          }
        );
        const grants = result.resolvedEvents.filter((event) => event.sourceId === RT.FORTIFYING_BOND);
        assert.equal(grants.length > 0, selected && traitTriggers && activePet);
        for (const grant of grants) {
          assert.equal(grant.resolvedAudience.includesSelf, false);
          assert.equal(grant.resolvedAudience.companionIds.length, 1);
        }
      }
});

test('Natural Mender isolates startup and retains admitted astral renewal', () => {
  for (const traitTriggers of [false, true])
    for (const admitted of [false, true]) {
      const { runtime } = run(
        rangerProfession,
        'Druid',
        [wait(3500)],
        {
          traitTriggers,
          initialAstralForce: 0,
          selectedTraitIds: [RT.NATURAL_MENDER]
        },
        {
          initialize(runtime) {
            if (admitted) runtime.schedule('ranger.natural-mender', 1, 1);
          }
        }
      );
      assert.equal(runtime.resourceController.value('astralForce') > 0, traitTriggers || admitted);
    }
});

test('Nature’s Vengeance isolates the half-strength child repeat and keeps spirit delivery owned across pet replacement', () => {
  for (const id of [R.STORM_SPIRIT, R.STONE_SPIRIT])
    for (const traitTriggers of [false, true]) {
      const { result } = run(rangerProfession, 'Core', [id, R.PET_SWAP, wait(6500)], {
        traitTriggers,
        selectedTraitIds: [RT.NATURES_VENGEANCE],
        selectedPet: 'Tiger',
        selectedPet2: 'Pig'
      });
      const child = result.resolvedEvents.filter((event) =>
        id === R.STORM_SPIRIT
          ? event.type === 'damage' && event.skillId === R.CALL_LIGHTNING
          : event.type === 'condition' && event.condition === 'Crippled' && event.skillId === id
      );
      assert.ok(child.length > 0);
      // Repeat entitlement survives pet replacement and remains attached to its summoning activation.
      const activation = result.events.find((event) => event.type === 'action' && event.skillId === id);
      assert.ok(child.every((event) => event.activationId === activation.activationId));
      if (id === R.STORM_SPIRIT)
        assert.equal(
          child.some((event) => event.coefficient === 1),
          traitTriggers
        );
    }
});

test('Let Loose weapon-swap admission cannot claim its interval in isolation', () => {
  for (const traitTriggers of [false, true]) {
    const { runtime } = run(rangerProfession, 'Untamed', [combat, SHARED.SWAP_WEAPONS], {
      traitTriggers,
      selectedTraitIds: [RT.LET_LOOSE],
      primaryWeapon: 'Axe',
      weaponSet2Primary: 'Sword'
    });
    assert.equal(runtime.procs.deadline('ranger.untamed.letLoose') > 0, traitTriggers);
  }
});

test('Heightened Focus isolates new rewards and uses target health instead of player health', () => {
  for (const traitTriggers of [false, true])
    for (const healthPercent of [25, 100]) {
      const { runtime, result } = run(
        warriorProfession,
        'Core',
        undefined,
        {
          traitTriggers,
          selectedTraitIds: [WT.HEIGHTENED_FOCUS],
          target: { armor: 2597, health: 1000000, startingHealthFraction: healthPercent / 100 }
        },
        { timeline: [packet(damage(1))] }
      );
      const active = traitTriggers && healthPercent < 50;
      assert.equal(runtime.procs.deadline(WT.HEIGHTENED_FOCUS) > 0, active);
      assert.equal(proc(result, 'Heightened Focus'), active);
    }
});

test('King of Fires separates new critical auras from admitted aura observation and detonation', () => {
  for (const traitTriggers of [false, true])
    for (const removed of [false, true]) {
      const { runtime } = run(
        warriorProfession,
        'Berserker',
        undefined,
        { traitTriggers, selectedTraitIds: [WT.KING_OF_FIRES] },
        {
          timeline: [packet(damage(1, { forceCrit: true }))],
          catalog: (catalog) =>
            removed
              ? withProfile(catalog, WT.KING_OF_FIRES, {
                  effects: catalog.balanceProfilesById
                    .get(WT.KING_OF_FIRES)
                    .effects.filter((effect) => effect.name !== 'fire-aura'),
                  removedEffectKeys: [skillEffectKey('buff', 'fire-aura')]
                })
              : catalog
        }
      );
      assert.equal(runtime.procs.deadline('warrior.berserker.kingOfFires') > 0, traitTriggers);
      assert.equal(state(runtime).fireAuraUntil > 0, traitTriggers && !removed);
    }

  const { result, runtime } = run(
    warriorProfession,
    'Berserker',
    undefined,
    { traitTriggers: false, selectedTraitIds: [WT.KING_OF_FIRES] },
    {
      timeline: [packet(cause(1, { type: 'aura', aura: 'Fire Aura', duration: 5 }))],
      initialize(runtime) {
        runtime.schedule(DETONATE, 2, { activationId: 'admitted', skillId: W.BERSERK });
      }
    }
  );
  assert.equal(state(runtime).fireAuraUntil, 0);
  assert.equal(proc(result, 'King of Fires'), true);
});

test('Paragon combat entry and burst acceptance isolate motivation rewards', () => {
  for (const traitTriggers of [false, true]) {
    const entry = run(warriorProfession, 'Paragon', [combat, wait(100)], {
      traitTriggers,
      selectedTraitIds: [WT.CALL_TO_ACTION]
    });
    assert.equal(state(entry.runtime).callToActionActivated, traitTriggers);
    const burst = run(
      warriorProfession,
      'Paragon',
      [combat, W.EVISCERATE],
      {
        traitTriggers,
        selectedTraitIds: [WT.RALLY_THE_VALIANT],
        primaryWeapon: 'Axe',
        initialResource: 30
      },
      {
        initialize(runtime) {
          state(runtime).activeRefrainId = W.CHANT_OF_ACTION;
        }
      }
    );
    assert.equal(burst.runtime.resourceController.value('motivation'), traitTriggers ? 4 : 0);
  }
});

test('Larcenous Torment isolates player-only resource and siphon rewards', () => {
  for (const traitTriggers of [false, true])
    for (const actorType of ['player', 'effect', 'summon']) {
      const { runtime, result } = run(
        thiefProfession,
        'Specter',
        undefined,
        { traitTriggers, selectedTraitIds: [TT.LARCENOUS_TORMENT], initialShadowForce: 0 },
        {
          timeline: [packet(cause(1, { type: 'condition', condition: 'Torment', stacks: 2, duration: 1, actorType }))]
        }
      );
      const active = traitTriggers && actorType === 'player';
      assert.equal(runtime.resourceController.value('shadowForce'), active ? 1 : 0);
      assert.equal(
        result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TT.LARCENOUS_TORMENT),
        active
      );
    }
});

test('Dark Sentry captures distinct allied recipients and isolates implicit minor admission', () => {
  for (const traitTriggers of [false, true]) {
    const barrier = run(thiefProfession, 'Specter', [T.ENTER_SHADOW_SHROUD, wait(1000)], {
      traitTriggers,
      initialShadowForce: 100,
      allies: { count: 3 }
    });
    assert.ok(barrier.result.resolvedEvents.some((event) => event.kind === 'barrier'));
    assert.equal(barrier.runtime.procs.deadline('thief.specter.darkSentry:1') > 0, traitTriggers);
    const { runtime } = run(
      thiefProfession,
      'Specter',
      undefined,
      { traitTriggers, allies: { count: 3 } },
      {
        timeline: [
          {
            at: 1,
            run(runtime) {
              runtime.fireTrigger(alliedBarrierGranted, { allyIndices: [1, 1, 3, 4, 0] });
            }
          },
          {
            at: 2,
            run(runtime) {
              runtime.fireTrigger(alliedBarrierGranted, { allyIndices: [1, 2] });
            }
          }
        ]
      }
    );
    assert.equal(runtime.procs.deadline('thief.specter.darkSentry:1'), traitTriggers ? 2 : 0);
    assert.equal(runtime.procs.deadline('thief.specter.darkSentry:2'), traitTriggers ? 3 : 0);
    assert.equal(runtime.procs.deadline('thief.specter.darkSentry:3'), traitTriggers ? 2 : 0);
    assert.equal(runtime.procs.deadline('thief.specter.darkSentry:4'), 0);
  }

  const admitted = run(
    thiefProfession,
    'Specter',
    undefined,
    { traitTriggers: false, allies: { count: 1 } },
    {
      initialize(runtime) {
        runtime.schedule('thief.specter-dark-sentry', 1, { allyIndices: [1] });
      }
    }
  );
  assert.ok(admitted.runtime.procs.deadline('thief.specter.darkSentry:1') > 0);
});

test('Daredevil keeps the selected dodge attack while isolating its follow-up damage window', () => {
  for (const traitTriggers of [false, true])
    for (const [trait, kind] of [
      [TT.BOUNDING_DODGER, 'bounding-dodger'],
      [TT.LOTUS_TRAINING, 'lotus-training']
    ]) {
      const { result } = run(thiefProfession, 'Daredevil', [combat, SHARED.DODGE, wait(1000)], {
        traitTriggers,
        selectedTraitIds: [trait]
      });
      assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === SHARED.DODGE));
      assert.equal(
        result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === kind),
        traitTriggers
      );
    }
});
