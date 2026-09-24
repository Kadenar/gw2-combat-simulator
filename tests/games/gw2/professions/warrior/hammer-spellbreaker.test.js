import assert from 'node:assert/strict';
import test from 'node:test';

import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { canonicalGw2SkillId } from '#gw2/platform/skills/aliases.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/policy.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import {
  observeSpellbreakerEvent,
  reactToSpellbreakerDamage
} from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';

// Both execution stages must integrate a temporary boon and detect completion on the next 40 ms tick.
test('Magebane Tether integrates Alacrity gained or lost during its recharge', () => {
  for (const stage of ['scheduler', 'resolver']) {
    for (const alacrityAt of [0, 2]) {
      const config = { specialization: 'Spellbreaker', selectedTraitIds: [TRAIT.MAGEBANE_TETHER] };
      const profession = warriorProfession.resolveRuntime(config);
      const events = [];
      const scheduler = createScheduler({ profession, config, schedulerPolicy: createGw2SchedulerPolicy(config) });
      const context =
        stage === 'scheduler'
          ? scheduler.context
          : {
              config,
              profession,
              catalog: profession.catalog,
              helpers: profession.catalog,
              state: { profession: profession.createProfessionState(config) },
              query: { timeline: createGw2TimelineIndex({ config, events, resolved: true }) },
              recordProc() {}
            };
      const observe = stage === 'scheduler' ? observeSpellbreakerEvent : reactToSpellbreakerDamage;
      const alacrity = {
        type: 'buff',
        kind: 'alacrity',
        at: alacrityAt,
        duration: 4.08,
        stacks: 1,
        source: 'fixture',
        sourceId: 'fixture',
        actorType: 'player',
        resolvedAudience: {
          includesSelf: true,
          includesSummons: false,
          alliedPlayerCount: 0,
          companionIds: [],
          recipientCount: 1
        }
      };
      const grantAlacrity = () => (stage === 'scheduler' ? context.emit(alacrity) : events.push(alacrity));
      if (alacrityAt === 0) grantAlacrity();
      const hit = { type: 'damage', actorType: 'player', coefficient: 1, skillId: ID.BREACHING_STRIKE, at: 0 };
      observe(context, hit);
      if (alacrityAt > 0) grantAlacrity();
      const state = spellbreakerState.from(context);
      assert.equal(state.magebaneTetherUntil, 8);
      // 12 seconds of work completes at 10.98; readiness is first detected at 11.00.
      observe(context, { ...hit, at: 10.99 });
      assert.equal(state.magebaneTetherUntil, 8, `${stage}: blocked before the tick`);
      observe(context, { ...hit, at: 11 });
      assert.equal(state.magebaneTetherUntil, 19, `${stage}: ready at the tick`);
    }
  }
});

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 0,
    ferocity: 500,
    conditionDamage: 0,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    health: 4_000_000,
    defiant: false,
    controlled: false,
    conditions: {}
  },
  boons: { quickness: true }
});

const simulate = createProfessionSimulator(warriorProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

function strike(skillId) {
  return warriorCatalog.skillsById.get(skillId).effects.find((effect) => effect.type === 'strike');
}

test('hammer and dagger/mace timings preserve their 40 ms packet spacing', () => {
  for (const [skillId, castMs, packetMs] of [
    [ID.HAMMER_SWING, 480, 360],
    [ID.HAMMER_BASH, 640, 320],
    [ID.HAMMER_SMASH, 440, 320],
    [ID.FIERCE_BLOW, 880, 600],
    [ID.HAMMER_SHOCK, 600, 320],
    [ID.STAGGERING_BLOW, 480, 400],
    [ID.BACKBREAKER, 880, 680],
    [ID.EARTHSHAKER, 1000, 840],
    [ID.CRUSHING_BLOW, 560, 440],
    [ID.TREMOR, 560, 440],
    [ID.PRECISE_CUT, 320, 280],
    [ID.FOCUSED_SLASH, 360, 280],
    [ID.KEEN_STRIKE, 440, 280],
    [ID.DISRUPTING_STAB, 440, 160],
    [69297, 840, 760]
  ]) {
    const canonicalSkillId = canonicalGw2SkillId(skillId);
    const skill = warriorCatalog.skillsById.get(canonicalSkillId);

    assert.equal(skill.castTimeMs, castMs, skill.name);

    const usesHammer = [
      ID.HAMMER_SWING,
      ID.HAMMER_BASH,
      ID.HAMMER_SMASH,
      ID.FIERCE_BLOW,
      ID.HAMMER_SHOCK,
      ID.STAGGERING_BLOW,
      ID.BACKBREAKER,
      ID.EARTHSHAKER
    ].includes(skillId);
    const rotation =
      skillId === ID.HAMMER_BASH
        ? [ID.HAMMER_SWING, skillId]
        : skillId === ID.HAMMER_SMASH
          ? [ID.HAMMER_SWING, ID.HAMMER_BASH, skillId]
          : skillId === ID.FOCUSED_SLASH
            ? [ID.PRECISE_CUT, skillId]
            : skillId === ID.KEEN_STRIKE
              ? [ID.PRECISE_CUT, ID.FOCUSED_SLASH, skillId]
              : [skillId];
    const result = simulate('Spellbreaker', rotation, {
      primaryWeapon: usesHammer ? 'Hammer' : 'Dagger',
      secondaryWeapon: usesHammer ? '' : 'Mace',
      initialResource: skill.burst ? 10 : 0
    });
    // Alias inputs execute and emit events under their canonical runtime identity.
    const action = result.events.find((event) => event.type === 'action' && event.skillId === canonicalSkillId);
    const damage = result.events.find((event) => event.type === 'damage' && event.activationId === action.activationId);

    assert.equal(Math.round((damage.at - action.at) * 1000), packetMs, skill.name);
  }

  const tremor = simulate('Spellbreaker', [ID.TREMOR], {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Mace'
  });
  const tremorAction = tremor.events.find((event) => event.type === 'action');

  assert.deepEqual(
    tremor.events
      .filter((event) => event.type === 'damage')
      .map((event) => Math.round((event.at - tremorAction.at) * 1000)),
    [440, 520]
  );
  assert.equal(strike(ID.STAGGERING_BLOW).comboFinishers[0].finisherType, 'Whirl');
  assert.equal(strike(ID.EARTHSHAKER).comboFinishers[0].finisherType, 'Blast');
  assert.equal(strike(ID.RUPTURING_SMASH).comboFinishers[0].finisherType, 'Blast');
});

test('hammer cooldowns, conditional damage, recharge, and Defense traits work', () => {
  for (const [skillId, cooldown] of [
    [ID.FIERCE_BLOW, 6],
    [ID.HAMMER_SHOCK, 8],
    [ID.STAGGERING_BLOW, 18],
    [ID.BACKBREAKER, 25],
    [ID.EARTHSHAKER, 8],
    [ID.RUPTURING_SMASH, 5],
    [ID.TO_THE_LIMIT, 24]
  ]) {
    const skill = warriorCatalog.skillsById.get(skillId);

    assert.equal(skill.cooldown, cooldown);
    assert.equal(Object.hasOwn(skill, 'recharge'), false);
  }

  const fierceCoefficient = (defiant) =>
    simulate('Core', ['Fierce Blow'], {
      primaryWeapon: 'Hammer',
      target: { defiant }
    }).events.find((event) => event.type === 'damage').coefficient;

  assert.equal(fierceCoefficient(false), 1.8);
  assert.equal(fierceCoefficient(true), 2.7);

  const reset = simulate('Core', ['Fierce Blow', 'Backbreaker', 'Fierce Blow'], { primaryWeapon: 'Hammer' });

  assert.deepEqual(
    reset.steps.filter(({ skill }) => skill === 'Fierce Blow').map(({ start }) => start),
    [0, 1760]
  );

  const defense = simulate('Spellbreaker', ['Earthshaker', '__cooldown_reset', 'Earthshaker'], {
    primaryWeapon: 'Hammer',
    initialResource: 20,
    selectedTraitIds: [TRAIT.CULL_THE_WEAK, TRAIT.MERCILESS_HAMMER],
    target: { defiant: true }
  });
  const weaknesses = defense.events.filter((event) => event.sourceId === TRAIT.CULL_THE_WEAK);

  assert.equal(weaknesses.length, 1);
  assert.deepEqual(
    {
      condition: weaknesses[0].condition,
      duration: weaknesses[0].duration
    },
    { condition: 'Weakness', duration: 3.5 }
  );
  assert.equal(defense.planningState.profession.adrenaline, 16);
});

test("Spellbreaker only gains Attacker's Insight from control and lightning leap combos", () => {
  const insightConfig = {
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT]
  };
  const insightStacks = (result) => result.planningState.profession.attackerInsightExpiries.length;

  const breaching = simulate('Spellbreaker', [69297], {
    ...insightConfig,
    primaryWeapon: 'Dagger',
    initialResource: 10,
    target: {}
  });

  assert.equal(insightStacks(breaching), 0);

  const breachingCombo = simulate('Spellbreaker', [ID.WINDS_OF_DISENCHANTMENT, 69297], {
    ...insightConfig,
    primaryWeapon: 'Dagger',
    initialResource: 10,
    target: {}
  });

  assert.equal(insightStacks(breachingCombo), 1);
  assert.equal(
    breachingCombo.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Breaching Strike' &&
        event.fieldType === 'Lightning' &&
        event.finisherType === 'Leap' &&
        event.outcome.name === 'Dazing Strike'
    ).length,
    1
  );

  const boonlessWinds = simulate(
    'Spellbreaker',
    [ID.WINDS_OF_DISENCHANTMENT],
    {
      ...insightConfig,
      target: {}
    },
    observationTail(5000)
  );
  assert.equal(insightStacks(boonlessWinds), 0);

  const breakEnchantments = simulate('Spellbreaker', [ID.BREAK_ENCHANTMENTS], {
    ...insightConfig,
    target: {}
  });

  assert.equal(insightStacks(breakEnchantments), 0);

  const bullsCharge = simulate('Spellbreaker', [ID.BULLS_CHARGE], {
    ...insightConfig,
    target: { defiant: true }
  });

  assert.equal(insightStacks(bullsCharge), 1);

  const bullsChargeCombo = simulate('Spellbreaker', [ID.WINDS_OF_DISENCHANTMENT, ID.BULLS_CHARGE], {
    ...insightConfig,
    target: { defiant: true }
  });

  assert.equal(insightStacks(bullsChargeCombo), 2);
  assert.equal(
    bullsChargeCombo.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === "Bull's Charge" &&
        event.fieldType === 'Lightning' &&
        event.finisherType === 'Leap' &&
        event.outcome.kind === 'control' &&
        event.outcome.name === 'Dazing Strike'
    ).length,
    1
  );

  assert.deepEqual(
    [
      warriorCatalog.skillsById.get(ID.WINDS_OF_DISENCHANTMENT).comboFields[0].fieldType,
      warriorCatalog.skillsById.get(ID.WINDS_OF_DISENCHANTMENT).comboFields[0].duration,
      warriorCatalog.skillsById.get(ID.BREACHING_STRIKE).comboFinishers[0].finisherType,
      warriorCatalog.skillsById.get(ID.BULLS_CHARGE).comboFinishers[0].finisherType
    ],
    ['Lightning', 5, 'Leap', 'Leap']
  );
});

test('Peak Performance and Magebane Tether use their logged recharge timing', () => {
  const peak = simulate('Spellbreaker', ["Bull's Charge"], {
    selectedTraitIds: [TRAIT.PEAK_PERFORMANCE]
  });
  const bull = peak.steps.find(({ skill }) => skill === "Bull's Charge");
  const peakBuff = peak.events.find((event) => event.type === 'buff' && event.kind === 'peak-performance');

  assert.equal(peakBuff.at * 1000, bull.end);
  const peakState = warriorProfession.ui
    .rotationStateSnapshot({
      specialization: 'Spellbreaker',
      result: peak,
      atSeconds: peakBuff.at + 2
    })
    .find(({ id }) => id === 'peak-performance');

  assert.deepEqual(peakState, {
    id: 'peak-performance',
    label: 'Peak Performance',
    value: '4.0s',
    title: 'Peak Performance: +10% strike damage (+15% total from trait)'
  });

  const magebaneProcs = (alacrity) =>
    simulate('Spellbreaker', ['Breaching Strike', { type: 'wait', durationMs: 9000 }, 'Breaching Strike'], {
      initialResource: 20,
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Mace',
      selectedTraitIds: [TRAIT.MAGEBANE_TETHER],
      boons: { alacrity }
    }).procSteps.filter(({ skill }) => skill === 'Magebane Tether').length;

  assert.equal(magebaneProcs(false), 1);
  assert.equal(magebaneProcs(true), 2);
});

test('"To the Limit!" restores endurance, grants flow, and triggers Thick Skin', () => {
  const core = simulate('Core', ['Dodge', '"To the Limit!"'], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.THICK_SKIN]
  });

  assert.equal(core.planningState.profession.adrenaline, 30);
  assert.equal(core.planningState.profession.endurance, 100);
  const protection = core.events.find((event) => event.sourceId === TRAIT.THICK_SKIN);

  assert.deepEqual({ boon: protection.boon, duration: protection.duration }, { boon: 'protection', duration: 3 });

  const bladesworn = simulate('Bladesworn', ['"To the Limit!"'], {
    initialResource: 0
  });

  assert.ok(bladesworn.planningState.profession.flow >= 30);
});
