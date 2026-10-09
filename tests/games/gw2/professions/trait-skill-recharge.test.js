import assert from 'node:assert/strict';
import test from 'node:test';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { ELEMENTALIST_TRAIT_IDS as E } from '#gw2/professions/elementalist/data/ids.js';
import { ENGINEER_TRAIT_IDS as N } from '#gw2/professions/engineer/data/ids.js';
import { GUARDIAN_TRAIT_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import { MESMER_TRAIT_IDS as M } from '#gw2/professions/mesmer/data/ids.js';
import { NECROMANCER_TRAIT_IDS as D } from '#gw2/professions/necromancer/data/ids.js';
import { RANGER_TRAIT_IDS as R } from '#gw2/professions/ranger/data/ids.js';
import { THIEF_TRAIT_IDS as T } from '#gw2/professions/thief/data/ids.js';
import { WARRIOR_TRAIT_IDS as W } from '#gw2/professions/warrior/data/ids.js';
import { triggerEvasiveArcana } from '#gw2/professions/elementalist/core/traits/arcane/index.js';
import {
  applyExplosiveEntrance,
  resetExplosiveEntrance
} from '#gw2/professions/engineer/core/traits/explosives/explosions.js';
import { triggerMechFighter } from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { completeProtectorsRestoration } from '#gw2/professions/guardian/core/traits/honor/index.js';
import { reactToZealDamage } from '#gw2/professions/guardian/core/traits/zeal/behavior.js';
import { methodOfMadnessDamage, triggerMethodOfMadness } from '#gw2/professions/mesmer/core/traits/chaos/index.js';
import { applyChillOfDeath } from '#gw2/professions/necromancer/core/traits/spite/behavior.js';
import { maliciousSwarm } from '#gw2/professions/necromancer/core/traits/spite/index.js';
import { applyClarionBond } from '#gw2/professions/ranger/core/traits/marksmanship/beast-skills.js';
import { emitChildOfEarth } from '#gw2/professions/ranger/core/traits/wilderness-survival/index.js';
import {
  triggerGoForTheThroat,
  triggerMergedGoForTheThroat
} from '#gw2/professions/ranger/core/traits/beastmastery/pet-behavior.js';
import { burstOfAgility } from '#gw2/professions/thief/core/traits/trickery/index.js';
import { signetMasteryDamage } from '#gw2/professions/warrior/core/traits/arms/index.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { canonicalTime } from '#kernel/core/clock.js';

const heal = { id: 'fixture-heal', name: 'Fixture heal', type: 'Heal', slot: 'Heal' };
const cast = (r) => ({ id: 'fixture', skill: heal, command: {}, start: r.time, effectiveEnd: r.time });
const hit = (r) => ({
  at: r.time,
  type: 'damage',
  actorType: 'player',
  coefficient: 1,
  skillName: 'Fixture hit',
  skillId: 'fixture-hit'
});
const compiled = (definition) =>
  compileProfessionRules({ traitTriggers: definition.triggers.map((rule) => ({ ...rule, trait: definition.id })) });

// Run actual trait handlers against native profession services; every case tests admission before and after recharge.
const cases = [
  [
    mesmerProfession,
    M.METHOD_OF_MADNESS,
    M.METHOD_OF_MADNESS,
    28,
    (r) => triggerMethodOfMadness({ state: r }, heal, r.time, methodOfMadnessDamage(r))
  ],
  [
    guardianProfession,
    G.ZEALOTS_RESOLUTION,
    'guardian.core.zealotsResolution',
    30,
    (r) => reactToZealDamage(r, hit(r), 1)
  ],
  [
    guardianProfession,
    G.PROTECTORS_RESTORATION,
    'guardian.core.protectorsRestoration',
    20,
    (r) => completeProtectorsRestoration(r, cast(r))
  ],
  [necromancerProfession, D.CHILL_OF_DEATH, 'chillOfDeath', 16, (r) => applyChillOfDeath(r, hit(r))],
  [
    necromancerProfession,
    D.MALICIOUS_SWARM,
    D.MALICIOUS_SWARM,
    15,
    (r) => compiled(maliciousSwarm).onCastCommit(r.mechanics, cast(r))
  ],
  [rangerProfession, R.CLARION_BOND, 'ranger.core.clarionBond', 15, (r) => applyClarionBond(r, heal)],
  [rangerProfession, R.CHILD_OF_EARTH, 'ranger.core.childOfEarth', 20, (r) => emitChildOfEarth(r, heal)],
  [
    rangerProfession,
    R.GO_FOR_THE_THROAT,
    'ranger.core.goForTheThroatPet',
    10,
    (r) => {
      const skillId = r.profession.core.activePetSkillIds.at(-1);
      triggerGoForTheThroat(r, { ...hit(r), actorType: 'summon', skillId });
    }
  ],
  [
    rangerProfession,
    R.GO_FOR_THE_THROAT,
    'ranger.soulbeast.goForTheThroat',
    10,
    (r) => triggerMergedGoForTheThroat(r, hit(r)),
    'Soulbeast'
  ],
  [
    thiefProfession,
    T.BURST_OF_AGILITY,
    T.BURST_OF_AGILITY,
    60,
    (r) => compiled(burstOfAgility).reactions['damage.resolved'](r.mechanics, hit(r), {})
  ],
  [warriorProfession, W.SIGNET_MASTERY, W.SIGNET_MASTERY, 20, (r) => signetMasteryDamage(r, hit(r))],
  ...['Fire', 'Water', 'Air', 'Earth'].map((attunement) => [
    elementalistProfession,
    E.EVASIVE_ARCANA,
    `evasiveArcana${attunement}`,
    10,
    (r) => {
      r.profession.core.primaryAttunement = attunement;
      triggerEvasiveArcana(r, cast(r), heal);
    }
  ])
];

function fixture(family, trait, specialization = 'Core') {
  const config = {
    specialization,
    selectedTraitIds: [trait],
    target: { armor: 2597, health: 1000000, fixedHealthFraction: 0.4, defiant: true },
    pet: 'Juvenile Tiger'
  };
  const result = observeGw2Runtime({ profession: family.runtimeFor(config), config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  runtime.effects = captureEffectEmissions({ now: () => runtime.time }).effects;
  return runtime;
}

for (const [family, trait, key, base, invoke, specialization] of cases) {
  test(`${family.id} ${key} uses its profile recharge at the live trigger`, () => {
    const runtime = fixture(family, trait, specialization);
    runtime.time = 1;
    invoke(runtime);
    const deadline = canonicalTime(1 + base / 1.25);
    assert.equal(runtime.procs.deadline(key), deadline);
    for (const at of [1, deadline - 0.001, deadline]) {
      runtime.time = at;
      invoke(runtime);
      assert.equal(runtime.procs.deadline(key), deadline);
    }

    runtime.time = deadline + 0.001;
    invoke(runtime);
    assert.equal(runtime.procs.deadline(key), canonicalTime(runtime.time + base / 1.25));
  });
}

test('Method of Madness uses Chronomancer recharge instead of ordinary Alacrity', () => {
  const runtime = fixture(mesmerProfession, M.METHOD_OF_MADNESS, 'Chronomancer');
  const invoke = cases[0][4];
  runtime.time = 1;
  invoke(runtime);
  const deadline = canonicalTime(1 + 28 / 1.5);
  assert.equal(runtime.procs.deadline(M.METHOD_OF_MADNESS), deadline);
  runtime.time = deadline;
  invoke(runtime);
  assert.equal(runtime.procs.deadline(M.METHOD_OF_MADNESS), deadline);
  runtime.time += 0.001;
  invoke(runtime);
  assert.equal(runtime.procs.deadline(M.METHOD_OF_MADNESS), canonicalTime(runtime.time + 28 / 1.5));
});

test('Evasive Arcana keeps independent attunement cooldowns', () => {
  const runtime = fixture(elementalistProfession, E.EVASIVE_ARCANA);
  runtime.time = 1;
  cases.at(-4)[4](runtime);
  runtime.time = 2;
  cases.at(-3)[4](runtime);
  assert.equal(runtime.procs.deadline('evasiveArcanaFire'), 9);
  assert.equal(runtime.procs.deadline('evasiveArcanaWater'), 10);
});

test('Explosive Entrance dodge rearming preserves recharge and a blocked hit does not consume the charge', () => {
  const runtime = fixture(engineerProfession, N.EXPLOSIVE_ENTRANCE);
  runtime.time = 1;
  applyExplosiveEntrance(runtime, hit(runtime));
  assert.equal(runtime.profession.core.explosiveEntranceFired, true);
  assert.equal(runtime.procs.deadline(N.EXPLOSIVE_ENTRANCE), 1.2);
  // Lingering player damage can trigger shortly before an already-running dodge finishes.
  resetExplosiveEntrance(runtime);
  for (const at of [1.1, 1.2]) {
    runtime.time = at;
    applyExplosiveEntrance(runtime, hit(runtime));
    assert.equal(runtime.profession.core.explosiveEntranceFired, false);
    assert.equal(runtime.procs.deadline(N.EXPLOSIVE_ENTRANCE), 1.2);
  }

  runtime.time = 1.201;
  applyExplosiveEntrance(runtime, hit(runtime));
  assert.equal(runtime.profession.core.explosiveEntranceFired, true);
  assert.equal(runtime.procs.deadline(N.EXPLOSIVE_ENTRANCE), 1.401);
});

for (const recipient of ['player', 'engineer.mech', 'other-companion']) {
  test(`Rocket Punch uses received mech Alacrity, with a grant to ${recipient}`, () => {
    const elapsed = recipient === 'engineer.mech' ? 4 : 5;
    const weapon = { id: 'fixture-weapon', name: 'Fixture weapon', type: 'Weapon', slot: 'Weapon_3' };
    const deadline = 1 + elapsed;
    const result = runEngineer(
      [{ type: 'wait', durationMs: 7000 }],
      { specialization: 'Mechanist', sharePlayerBoonsWithSummons: true },
      {
        initialize(runtime) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              at: 0,
              source: 'fixture',
              sourceId: 'fixture',
              actorType: 'player',
              kind: 'alacrity',
              stacks: 1,
              duration: 20,
              audience:
                recipient === 'player'
                  ? { recipients: 'self' }
                  : { recipients: 'summons', eligibleCompanionIds: [recipient] }
            }
          });
        },
        timeline: [1, deadline - 0.001, deadline, deadline + 0.001].map((at) => ({
          at,
          run(runtime) {
            triggerMechFighter(runtime, weapon);
            assert.equal(runtime.procs.deadline('rocketPunch'), at > deadline ? canonicalTime(at + elapsed) : deadline);
          }
        }))
      }
    );
    assert.deepEqual(result.warnings, []);
  });
}
