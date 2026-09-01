import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { migrateWarriorBuild, validateWarriorBuild } from '#gw2/content/professions/warrior/build/build.js';
import { warriorCatalog } from '#gw2/content/professions/warrior/catalog.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/content/professions/warrior/definition.js';
import { canonicalGw2SkillId } from '#gw2/platform/skills/aliases.js';

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

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: warriorProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
      boons: { ...baseConfig.boons, ...(config.boons || {}) }
    },
    mode: 'sequence',
    observationPolicy
  });
}

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
    [69297, 842, 758]
  ]) {
    const canonicalSkillId = canonicalGw2SkillId(skillId);
    const skill = warriorCatalog.skillsById.get(canonicalSkillId);

    if (skillId === 69297) {
      assert.equal(skill.castTimeMs, castMs, skill.name);
      assert.equal(skill.unaffectedByQuickness, true, skill.name);
      assert.equal(skill.quicknessCastTimeMs, undefined, skill.name);
    } else {
      assert.equal(skill.quicknessCastTimeMs, castMs, skill.name);
    }

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
    [440, 480]
  );
  assert.equal(strike(ID.STAGGERING_BLOW).comboFinishers[0].finisherType, 'Whirl');
  assert.equal(strike(ID.EARTHSHAKER).comboFinishers[0].finisherType, 'Blast');
  assert.equal(strike(ID.RUPTURING_SMASH).comboFinishers[0].finisherType, 'Blast');
});

test('recorded interrupt commit cutoffs preserve landed warrior packets', () => {
  const cases = [
    {
      skillId: ID.HAMMER_SMASH,
      cutoffMs: 320,
      prefix: [ID.HAMMER_SWING, ID.HAMMER_BASH],
      config: { primaryWeapon: 'Hammer' }
    },
    {
      skillId: ID.FIERCE_BLOW,
      cutoffMs: 600,
      prefix: [],
      config: { primaryWeapon: 'Hammer' }
    },
    {
      skillId: ID.CRUSHING_BLOW,
      cutoffMs: 440,
      prefix: [],
      config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Mace' }
    },
    {
      skillId: ID.KEEN_STRIKE,
      cutoffMs: 280,
      prefix: [ID.PRECISE_CUT, ID.FOCUSED_SLASH],
      config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Mace' }
    },
    {
      skillId: ID.BREACHING_STRIKE,
      cutoffMs: 758,
      prefix: [],
      config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Mace', initialResource: 10 }
    },
    {
      skillId: 69297,
      cutoffMs: 758,
      prefix: [],
      config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Mace', initialResource: 10 }
    },
    {
      skillId: 69433,
      cutoffMs: 758,
      prefix: [],
      config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Mace', initialResource: 10 }
    }
  ];

  for (const { skillId, cutoffMs, prefix, config } of cases) {
    const canonicalSkillId = canonicalGw2SkillId(skillId);
    const skill = warriorCatalog.skillsById.get(canonicalSkillId);
    const damageCount = (interruptMs) =>
      simulate('Spellbreaker', [...prefix, { name: skill.name, skillId, interruptMs }], config).events.filter(
        (event) => event.type === 'damage' && event.skillId === canonicalSkillId
      ).length;

    assert.equal(skill.interruptCommitMs, cutoffMs, skill.name);
    assert.equal(damageCount(cutoffMs - 1), 0, `${skill.name} before commit`);
    assert.equal(damageCount(cutoffMs), 1, `${skill.name} at commit`);
  }
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
  assert.equal(defense.endState.profession.adrenaline, 16);
});

test("Spellbreaker boon removal and lightning leap combos drive Attacker's Insight", () => {
  const insightConfig = {
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT]
  };
  const insightStacks = (result) => result.endState.profession.attackerInsightExpiries.length;
  const removals = (result, skillId) =>
    result.resolvedEvents.filter((event) => event.type === 'warrior.boon-removal' && event.skillId === skillId);

  const breaching = simulate('Spellbreaker', [69297], {
    ...insightConfig,
    primaryWeapon: 'Dagger',
    initialResource: 10,
    target: { boonless: true }
  });

  assert.deepEqual(
    removals(breaching, ID.BREACHING_STRIKE).map(({ attemptedBoonRemovals, boonsRemoved }) => ({
      attemptedBoonRemovals,
      boonsRemoved
    })),
    [{ attemptedBoonRemovals: 2, boonsRemoved: 0 }]
  );
  assert.equal(insightStacks(breaching), 0);

  const breachingCombo = simulate('Spellbreaker', [ID.WINDS_OF_DISENCHANTMENT, 69297], {
    ...insightConfig,
    primaryWeapon: 'Dagger',
    initialResource: 10,
    target: { boonless: true }
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
      target: { boonless: true }
    },
    observationTail(5000)
  );
  const windsRemovals = removals(boonlessWinds, ID.WINDS_OF_DISENCHANTMENT);

  assert.equal(windsRemovals.length, 5);
  assert.deepEqual(
    windsRemovals.slice(1).map((event, index) => Number((event.at - windsRemovals[index].at).toFixed(3))),
    [1, 1, 1, 1]
  );
  assert.equal(insightStacks(boonlessWinds), 0);

  const boonfulWinds = simulate(
    'Spellbreaker',
    [ID.WINDS_OF_DISENCHANTMENT],
    {
      ...insightConfig,
      target: { boonless: false }
    },
    observationTail(5000)
  );

  assert.equal(insightStacks(boonfulWinds), 5);

  const breakEnchantments = simulate('Spellbreaker', [ID.BREAK_ENCHANTMENTS], {
    ...insightConfig,
    target: { boonCount: 4 }
  });

  assert.deepEqual(
    removals(breakEnchantments, ID.BREAK_ENCHANTMENTS).map(({ attemptedBoonRemovals, boonsRemoved }) => ({
      attemptedBoonRemovals,
      boonsRemoved
    })),
    [{ attemptedBoonRemovals: 4, boonsRemoved: 4 }]
  );
  assert.equal(insightStacks(breakEnchantments), 4);

  const bullsCharge = simulate('Spellbreaker', [ID.BULLS_CHARGE], {
    ...insightConfig,
    target: { defiant: true }
  });

  assert.equal(insightStacks(bullsCharge), 1);

  const bullsChargeCombo = simulate('Spellbreaker', [ID.WINDS_OF_DISENCHANTMENT, ID.BULLS_CHARGE], {
    ...insightConfig,
    target: { boonless: true, defiant: true }
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

  assert.equal(core.endState.profession.adrenaline, 30);
  assert.equal(core.endState.profession.endurance, 100);
  const protection = core.events.find((event) => event.sourceId === TRAIT.THICK_SKIN);

  assert.deepEqual({ boon: protection.boon, duration: protection.duration }, { boon: 'protection', duration: 3 });

  const bladesworn = simulate('Bladesworn', ['"To the Limit!"'], {
    initialResource: 0
  });

  assert.ok(bladesworn.endState.profession.flow >= 30);
});
