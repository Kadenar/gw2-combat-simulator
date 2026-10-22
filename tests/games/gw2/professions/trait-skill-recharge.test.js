import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { elementalistDodgeCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_TRAIT_IDS as E, ELEMENTALIST_SKILL_IDS as ES } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { explosiveEntrance } from '#gw2/professions/engineer/core/traits/explosives/index.js';
import { ENGINEER_SKILL_IDS, ENGINEER_TRAIT_IDS as N } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { mechanistCastCompleted } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { guardianCastCompleted, guardianStruck } from '#gw2/professions/guardian/core/mechanics/trigger-points.js';
import { justiceActivated } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_TRAIT_IDS as G, GUARDIAN_SKILL_IDS as GS } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerHealCompleted } from '#gw2/professions/mesmer/core/mechanics/trigger-points.js';
import { MESMER_TRAIT_IDS as M, MESMER_SKILL_IDS as MS } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { necromancerStrike } from '#gw2/professions/necromancer/core/mechanics/trigger-points.js';
import { maliciousSwarm } from '#gw2/professions/necromancer/core/traits/spite/index.js';
import { NECROMANCER_TRAIT_IDS as D, NECROMANCER_SKILL_IDS as DS } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import {
  castCompleted,
  mergedBeastHit,
  petSwapped,
  strike
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { RANGER_TRAIT_IDS as R, RANGER_SKILL_IDS as RS } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { THIEF_TRAIT_IDS as T, THIEF_SKILL_IDS as TS } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { WARRIOR_TRAIT_IDS as W, WARRIOR_SKILL_IDS as WS } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Explosive Entrance's compiled strike trigger, applied to an observed runtime's mechanic capabilities.
const explosiveEntranceStrike = (runtime, event) =>
  compileProfessionRules({
    traitTriggers: explosiveEntrance.triggers.map((rule) => ({ ...rule, trait: explosiveEntrance.id }))
  }).reactions['damage.resolved'](runtime, event, {});

import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { strikeResourcesGranted } from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import { WARRIOR_SKILL_IDS } from '#gw2/professions/warrior/data/ids.js';
import { spellbreakerStrike } from '#gw2/professions/warrior/specializations/spellbreaker/mechanics/trigger-points.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

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
    MS.LESSER_CHAOS_STORM,
    28,
    (r) => r.fireTrigger(mesmerHealCompleted, { skill: heal, at: r.time, delivery: {} })
  ],
  [
    guardianProfession,
    G.ZEALOTS_RESOLUTION,
    GS.LESSER_SYMBOL_OF_RESOLUTION,
    30,
    (r) => r.fireTrigger(guardianStruck, { cause: hit(r), damage: 1 })
  ],
  [
    guardianProfession,
    G.FURIOUS_FOCUS,
    GS.LESSER_SYMBOL_OF_BLADES,
    10,
    (r) => r.fireTrigger(justiceActivated, { cast: cast(r) })
  ],
  [
    guardianProfession,
    G.PROTECTORS_RESTORATION,
    GS.LESSER_SYMBOL_OF_PROTECTION,
    20,
    (r) => r.fireTrigger(guardianCastCompleted, { cast: cast(r) })
  ],
  [
    necromancerProfession,
    D.CHILL_OF_DEATH,
    DS.LESSER_SPINAL_SHIVERS,
    16,
    // Owned summons retain eligibility while the invoked skill uses the same native recharge gate.
    (r) =>
      r.fireTrigger(necromancerStrike, {
        event: { ...hit(r), actorType: 'summon' },
        details: {},
        firstHit: true,
        shroudSkillOne: false
      })
  ],
  [
    necromancerProfession,
    D.MALICIOUS_SWARM,
    DS.LESSER_SIGNET_OF_THE_LOCUST,
    15,
    (r) => compiled(maliciousSwarm).onCastCommit(r.mechanics, cast(r))
  ],
  [
    rangerProfession,
    R.CLARION_BOND,
    RS.LESSER_CALL_OF_THE_WILD,
    15,
    (r) => r.fireTrigger(petSwapped, { skill: heal, at: r.time })
  ],
  [
    rangerProfession,
    R.CHILD_OF_EARTH,
    RS.LESSER_MUDDY_TERRAIN,
    20,
    (r) => r.fireTrigger(castCompleted, { skill: heal, at: r.time })
  ],
  [
    rangerProfession,
    R.GO_FOR_THE_THROAT,
    RS.LESSER_SIC_EM,
    10,
    (r) => {
      const skillId = rangerPetForState(r.profession.core).skillIds.at(-1);
      r.fireTrigger(strike, { event: { ...hit(r), actorType: 'summon', skillId } });
    }
  ],
  [
    rangerProfession,
    R.GO_FOR_THE_THROAT,
    RS.LESSER_SIC_EM,
    10,
    (r) => r.fireTrigger(mergedBeastHit, { event: hit(r) }),
    'Soulbeast'
  ],
  [
    warriorProfession,
    W.SIGNET_MASTERY,
    WS.LESSER_SIGNET_OF_MIGHT,
    20,
    (r) => r.fireTrigger(strikeResourcesGranted, { event: hit(r) })
  ],
  ...['Fire', 'Water', 'Air', 'Earth'].map((attunement) => [
    elementalistProfession,
    E.EVASIVE_ARCANA,
    {
      Fire: ES.FLAME_BURST_TRAIT,
      Water: ES.CLEANSING_WAVE_TRAIT,
      Air: ES.BLINDING_FLASH_TRAIT,
      Earth: ES.SHOCK_WAVE_TRAIT
    }[attunement],
    10,
    (r) => {
      r.profession.core.primaryAttunement = attunement;
      r.fireTrigger(elementalistDodgeCompleted, { cast: cast(r) });
    }
  ])
];

function fixture(family, trait, specialization = 'Core', skillChanges) {
  const config = {
    specialization,
    selectedTraitIds: [trait],
    target: { armor: 2597, health: 1000000, fixedHealthFraction: 0.4, defiant: true },
    pet: 'Juvenile Tiger'
  };
  const native = family.runtimeFor(config);
  const profession = skillChanges
    ? { ...native, catalog: withSkill(native.catalog, skillChanges.id, { cooldown: skillChanges.cooldown }) }
    : native;
  const result = observeGw2Runtime({ profession, config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  runtime.effects = captureEffectEmissions({ now: () => runtime.time }).effects;
  return runtime;
}

// The real reset command clears invoked skill recharge across native catalogs while retaining passive trait ICDs.
for (const [family, trait, id, , , specialization = 'Core'] of [
  ...cases,
  [warriorProfession, W.MAGEBANE_TETHER, WS.MAGEBANE_TETHER, 12, undefined, 'Spellbreaker'],
  [engineerProfession, N.EXPLOSIVE_ENTRANCE, ENGINEER_SKILL_IDS.EXPLOSIVE_ENTRANCE_TRAIT_SKILL],
  [engineerProfession, N.EXPLOSIVE_ENTRANCE, ENGINEER_SKILL_IDS.LESSER_GRENADE_BARRAGE],
  [thiefProfession, T.BURST_OF_AGILITY, TS.LESSER_HASTE],
  [thiefProfession, T.UNCATCHABLE, TS.LESSER_CALTROPS]
]) {
  test(`${family.id} ${id} resets its skill recharge without resetting passive trait cooldowns`, () => {
    const config = { specialization, selectedTraitIds: [trait], pet: 'Juvenile Tiger' };
    const native = family.runtimeFor(config);
    const skill = native.catalog.skillsById.get(id);
    assert.equal(skill.type, 'Proc');
    const result = observeGw2Runtime({
      config,
      profession: {
        ...native,
        initialize(runtime) {
          native.initialize?.(runtime);
          runtime.cooldownController.startRecharge(skill, 0, 20);
          runtime.procs.setDeadline('fixture-passive-trait', 20);
        }
      },
      rotation: [{ type: 'wait', durationMs: 2000 }, { type: 'cooldown-reset' }]
    });
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.cooldownController.readyAt(id), undefined);
    assert.equal(runtime.cooldownController.rechargeFor(id), undefined);
    assert.equal(runtime.cooldownController.isOnCooldown(id), false);
    assert.equal(runtime.procs.deadline('fixture-passive-trait'), 20);
  });
}

// Native skill recharge is reserved before emission and reads the selected patch's cooldown.
for (const [family, trait, key, base, invoke, specialization] of cases) {
  for (const cooldown of [base, 2])
    test(`${family.id} ${key} uses ${cooldown}s recharge at the live trigger`, () => {
      const runtime = fixture(family, trait, specialization, { id: key, cooldown });
      const readyAt = () => runtime.cooldownController.readyAt(key);
      runtime.time = 1;
      invoke(runtime);
      const deadline = canonicalTime(1 + cooldown / 1.25);
      assert.equal(readyAt(), deadline);
      for (const at of [1, deadline - 0.001]) {
        runtime.time = at;
        invoke(runtime);
        assert.equal(readyAt(), deadline);
      }

      runtime.time = deadline;
      invoke(runtime);
      assert.equal(readyAt(), canonicalTime(runtime.time + cooldown / 1.25));
    });
}

test('Method of Madness uses Chronomancer recharge instead of ordinary Alacrity', () => {
  const runtime = fixture(mesmerProfession, M.METHOD_OF_MADNESS, 'Chronomancer');
  const invoke = cases[0][4];
  runtime.time = 1;
  invoke(runtime);
  const deadline = canonicalTime(1 + 28 / 1.5);
  assert.equal(runtime.cooldownController.readyAt(MS.LESSER_CHAOS_STORM), deadline);
  runtime.time = deadline;
  invoke(runtime);
  assert.equal(runtime.cooldownController.readyAt(MS.LESSER_CHAOS_STORM), canonicalTime(runtime.time + 28 / 1.5));
});

// Tether keeps action-tick eligibility on top of the skill-owned player recharge deadline.
test('Magebane Tether uses patched recharge and waits for the action tick after an off-tick deadline', () => {
  const runtime = fixture(warriorProfession, W.MAGEBANE_TETHER, 'Spellbreaker', {
    id: WS.MAGEBANE_TETHER,
    cooldown: 2.03
  });
  const invoke = () =>
    runtime.fireTrigger(spellbreakerStrike, {
      event: { ...hit(runtime), skillId: WARRIOR_SKILL_IDS.BREACHING_STRIKE }
    });
  runtime.time = 1;
  invoke();
  const deadline = canonicalTime(1 + 2.03 / 1.25);
  assert.equal(runtime.cooldownController.readyAt(WS.MAGEBANE_TETHER), deadline);
  for (const at of [1, deadline, deadline + 0.001]) {
    runtime.time = at;
    invoke();
    assert.equal(runtime.cooldownController.readyAt(WS.MAGEBANE_TETHER), deadline);
    assert.equal(runtime.profession.specialization.state.magebaneTetherUntil, 9);
  }

  runtime.time = gw2CooldownReadyAt(deadline);
  invoke();
  assert.equal(runtime.cooldownController.readyAt(WS.MAGEBANE_TETHER), canonicalTime(runtime.time + 2.03 / 1.25));
  assert.equal(runtime.profession.specialization.state.magebaneTetherUntil, canonicalTime(runtime.time + 8));
});

test('Evasive Arcana keeps independent attunement cooldowns', () => {
  const runtime = fixture(elementalistProfession, E.EVASIVE_ARCANA);
  runtime.time = 1;
  cases.at(-4)[4](runtime);
  runtime.time = 2;
  cases.at(-3)[4](runtime);
  assert.equal(runtime.cooldownController.readyAt(ES.FLAME_BURST_TRAIT), 9);
  assert.equal(runtime.cooldownController.readyAt(ES.CLEANSING_WAVE_TRAIT), 10);
});

// Invoked attacks and conditions retain player ownership instead of inheriting the generic trait-effect actor.
test('Evasive Arcana emits player-owned payloads in each damaging attunement', () => {
  for (const attunement of ['Fire', 'Air', 'Earth']) {
    const runtime = fixture(elementalistProfession, E.EVASIVE_ARCANA);
    const capture = captureEffectEmissions({ now: () => runtime.time });
    runtime.effects = capture.effects;
    runtime.profession.core.primaryAttunement = attunement;
    runtime.fireTrigger(elementalistDodgeCompleted, { cast: cast(runtime) });
    const payloads = capture.events.filter((event) => event.type === 'damage' || event.type === 'condition');
    assert.ok(payloads.some((event) => event.type === 'condition'));
    assert.ok(payloads.every((event) => event.actorType === 'player'));
  }
});

test('Explosive Entrance dodge rearming preserves recharge and a blocked hit does not consume the charge', () => {
  const runtime = fixture(engineerProfession, N.EXPLOSIVE_ENTRANCE);
  runtime.time = 1;
  explosiveEntranceStrike(runtime.mechanics, hit(runtime));
  assert.equal(runtime.profession.core.explosiveEntranceFired, true);
  assert.equal(runtime.cooldownController.readyAt(ENGINEER_SKILL_IDS.EXPLOSIVE_ENTRANCE_TRAIT_SKILL), 1.2);
  // Lingering player damage can trigger shortly before an already-running dodge finishes.
  explosiveEntrance.lifetime.eventHandlers['engineer.dodge'](runtime);
  for (const at of [1.1, 1.2]) {
    runtime.time = at;
    explosiveEntranceStrike(runtime.mechanics, hit(runtime));
    assert.equal(runtime.profession.core.explosiveEntranceFired, false);
    assert.equal(runtime.cooldownController.readyAt(ENGINEER_SKILL_IDS.EXPLOSIVE_ENTRANCE_TRAIT_SKILL), 1.2);
  }

  runtime.time = 1.201;
  explosiveEntranceStrike(runtime.mechanics, hit(runtime));
  assert.equal(runtime.profession.core.explosiveEntranceFired, true);
  assert.equal(runtime.cooldownController.readyAt(ENGINEER_SKILL_IDS.EXPLOSIVE_ENTRANCE_TRAIT_SKILL), 1.401);
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
            runtime.fireTrigger(mechanistCastCompleted, { skill: weapon, at: runtime.time });
            assert.equal(runtime.procs.deadline('rocketPunch'), at > deadline ? canonicalTime(at + elapsed) : deadline);
          }
        }))
      }
    );
    assert.deepEqual(result.warnings, []);
  });
}
