import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { lifeForcePercent } from '#tests/helpers/necromancer-resource.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { createNecromancerBuildDefaults } from '#gw2/professions/necromancer/build/build.js';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { RITUALIST_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { necromancerAppAdapter } from '#gw2/professions/necromancer/app/app-definition.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';

const baseConfig = Object.freeze({
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 2000,
    ferocity: 500,
    conditionDamage: 1200,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    conditions: {
      Chilled: true,
      Vulnerability: 25
    }
  }
});

const simulate = createObservedProfessionSimulator(necromancerProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

// Meltdown's summary owns its buff while the delayed strike and condition remain independently visible.
test('Cascading Corruption links its grants without hiding its offensive effects', () => {
  const result = simulate('Harbinger', ['Elixir of Promise', { type: 'wait', durationMs: 1000 }], {
    initialBlight: 5,
    initialCascadingCorruptionStacks: 15,
    selectedSkillIds: [62667],
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
  });
  assert.deepEqual(result.warnings, []);
  const proc = result.events.find((event) => event.type === 'proc' && event.sourceId === TRAIT.CASCADING_CORRUPTION);
  assert.ok(proc);
  const effects = result.events.filter((event) => event.parentEventOrder === proc.eventOrder);
  for (const type of ['buff', 'damage', 'condition'])
    assert.ok(
      effects.some((event) => event.type === type),
      type
    );
  const rows = simulationEventLogRows(result, null, necromancerProfession);
  const summary = rows.find((row) => row.id === `event:${proc.eventOrder}`);
  assert.match(summary.description, /^Cascading Corruption.*Meltdown/i);
  for (const effect of effects) {
    const row = rows.find((entry) => entry.id === `event:${effect.eventOrder}`);

    if (effect.type === 'buff') assert.equal(row, undefined);
    else assert.equal(row?.parentId, summary.id);
  }
});

test('Ritualist spirits attack, empower Essence Blast, and innervate', () => {
  const result = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', 'Essence Blast', 'Innervate Anguish', "Exit Ritualist's Shroud"],
    { initialResource: 50 }
  );
  const lingering = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", { type: 'wait', durationMs: 9000 }],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.planningState.profession.activeSpirits, {});
  assert.ok(lifeForcePercent(result.planningState.profession.lifeForce) > 50);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Essence Blast'));
  assert.ok(lingering.planningState.profession.activeSpirits.anguish);
  assert.ok(lifeForcePercent(lingering.planningState.profession.lifeForce) < 90);
  assert.ok(lingering.breakdown.some((entry) => entry.name === 'Anguish Autoattack'));
});

test('Soul Twisting refunds only the first spirit summon after entering Ritualist Shroud', () => {
  const baseline = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish'], { initialResource: 100 });
  const twisting = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish', 'Wanderlust'], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_TWISTING]
  });

  assert.ok(baseline.planningState.cooldowns[ID.ANGUISH]);
  assert.equal(twisting.planningState.cooldowns[ID.ANGUISH], undefined);
  assert.ok(twisting.planningState.cooldowns[ID.WANDERLUST]);
  assert.equal(twisting.planningState.profession.soulTwistingAvailable, false);
});

// Replacing Anguish must preserve the other spirits' clocks and rejoin their next eligible cycle.
test('spirit replacement skips its busy pulse without restarting the other spirit clocks', () => {
  const run = (replace) =>
    simulate(
      'Ritualist',
      [
        "Ritualist's Shroud",
        'Anguish',
        'Wanderlust',
        'Preservation',
        { type: 'wait', durationMs: 4000 },
        replace ? 'Anguish' : { type: 'wait', durationMs: 560 },
        { type: 'wait', durationMs: 8500 }
      ],
      { initialResource: 100, selectedTraitIds: [TRAIT.SOUL_TWISTING] }
    );
  const baseline = run(false);
  const replaced = run(true);
  const times = (result, spirit) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === 'damage' &&
          event.metadata?.spiritAttackType === 'autoattack' &&
          event.metadata.spirit === spirit
      )
      .map((event) => event.at);
  assert.deepEqual(replaced.warnings, []);
  for (const key of ['wanderlust', 'preservation']) assert.deepEqual(times(replaced, key), times(baseline, key));
  const originalAnguish = times(baseline, 'anguish');
  const replacedAnguish = times(replaced, 'anguish');
  assert.ok(originalAnguish.length >= 2);
  assert.deepEqual(replacedAnguish, originalAnguish.slice(1));
  assert.equal(replacedAnguish[0], times(replaced, 'wanderlust')[1]);
});

test('Ritualist live spirit packets retain independent ownership and cadence', () => {
  const packets = simulate(
    'Ritualist',
    [
      "Ritualist's Shroud",
      'Anguish',
      'Wanderlust',
      'Preservation',
      'Essence Blast',
      { type: 'wait', durationMs: 8000 }
    ],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.EXPLOSIVE_GROWTH, TRAIT.SPIRITS_STRENGTH]
    }
  );
  const detachedBond = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", { type: 'wait', durationMs: 8000 }],
    {
      initialResource: 100
    }
  );
  const damageEvents = packets.resolvedEvents.filter((event) => event.type === 'damage');
  const anguish = damageEvents.filter((event) => event.skillName === 'Anguish');
  const wanderlust = damageEvents.filter((event) => event.skillName === 'Wanderlust');
  const preservationAutos = damageEvents.filter((event) => event.skillName === 'Preservation Autoattack');
  const wanderlustAutos = damageEvents.filter((event) => event.skillName === 'Wanderlust Autoattack');
  const anguishAutos = damageEvents.filter((event) => event.skillName === 'Anguish Autoattack');
  const lingering = wanderlust.filter((event) => event.actorType === 'player' && event.source === 'Spirit');
  const essence = damageEvents.find((event) => event.skillName === 'Essence Blast');
  const growth = damageEvents.filter((event) => event.skillName === 'Explosive Growth');
  const growthRow = skillBreakdownRows(packets).find((row) => row.name === 'Explosive Growth');
  const bond = detachedBond.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Painful Bond'
  );
  const detachedAutos = detachedBond.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Anguish Autoattack'
  );

  assert.ok(anguish.length > 0);
  assert.equal(
    anguish.every((event) => event.actorType === 'player' && event.coefficient === 0.36),
    true
  );
  assert.ok(lingering.length > 0);
  assert.equal(
    lingering.every((event) => event.coefficient === 0.42),
    true
  );
  assert.ok(preservationAutos.length > 0);
  assert.equal(
    preservationAutos.every(
      (event) =>
        event.actorType === 'summon' &&
        event.coefficient === 0.3 &&
        event.weaponStrength === 1440 &&
        event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(
    wanderlustAutos.every(
      (event) =>
        event.coefficient === 0.4 && event.weaponStrength === 1440 && event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(
    anguishAutos.every(
      (event) =>
        event.coefficient === 0.4 && event.weaponStrength === 1510 && event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(essence.coefficient, 0.75);
  assert.equal(essence.metadata.activeSpirits, 3);
  assert.ok(growth.length > 0);
  assert.equal(growthRow.parentSkill, 'Anguish');
  assert.equal(detachedAutos.length, 0);
  assert.ok(bond.length >= 8);
});

test('Ritualist spirit autos inherit owner Fury without inheriting owner Might', () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', { type: 'wait', durationMs: 9000 }];
  const run = (boons) =>
    simulate('Ritualist', rotation, {
      initialResource: 100,
      boons,
      sharePlayerBoonsWithSummons: false
    });
  const spiritAuto = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Anguish Autoattack');
  const baseline = spiritAuto(run({ might: 0, fury: false }));
  const might = spiritAuto(run({ might: 25, fury: false }));
  const fury = spiritAuto(run({ might: 0, fury: true }));

  assert.ok(baseline);
  assert.ok(might);
  assert.ok(fury);
  assert.equal(might.damage, baseline.damage);
  assert.equal(might.criticalChance, baseline.criticalChance);
  assert.equal(fury.criticalChance, Math.min(1, baseline.criticalChance + 0.25));
  assert.ok(fury.damage > baseline.damage);
});

test("Innervate Anguish uses profession-mechanic strength without Spirit's Strength", () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', 'Innervate Anguish'];
  const baseline = simulate('Ritualist', rotation, {
    initialResource: 100
  });
  const strengthened = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SPIRITS_STRENGTH]
  });
  const innervate = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Innervate Anguish');
  const baselineHit = innervate(baseline);
  const strengthenedHit = innervate(strengthened);

  assert.ok(baselineHit);
  assert.ok(strengthenedHit);
  assert.equal(baselineHit.coefficient, 1.3);
  assert.equal(baselineHit.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.equal(baselineHit.resolvedWeaponStrength, 1100);
  assert.equal(strengthenedHit.damage, baselineHit.damage);
});

test("Spirit's Strength scales Ritualist minion strikes at the specialization boundary", () => {
  const run = (selectedTraitIds) =>
    simulate('Ritualist', ['Summon Bone Fiend', { type: 'wait', durationMs: 5000 }], {
      selectedSkillIds: [10533],
      selectedTraitIds
    });
  const strike = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.source === 'Minion' && event.parentSkillName === 'Summon Bone Fiend'
    );
  const baseline = strike(run([]));
  const strengthened = strike(run([TRAIT.SPIRITS_STRENGTH]));

  assert.ok(baseline);
  assert.ok(strengthened);
  assertFlooredDamageMultiplier(strengthened.damage, baseline.damage, 1.5);
});

test('Ritualist weapon spells consume stacks and Resilient Weapon is usable', () => {
  const weaponSpells = simulate(
    'Ritualist',
    [
      'Nightmare Weapon',
      'Splinter Weapon',
      "Ritualist's Shroud",
      'Essence Blast',
      'Essence Blast',
      'Essence Blast',
      'Essence Blast',
      'Essence Blast'
    ],
    {
      initialResource: 100,
      selectedSkillIds: [76739, 76975]
    }
  );
  const resilient = simulate('Ritualist', ['Resilient Weapon'], {
    selectedSkillIds: [77259]
  });
  const nightmare = weaponSpells.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Nightmare Weapon'
  );
  const splinter = weaponSpells.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Splinter Weapon'
  );
  const nightmareIcon = necromancerCatalog.skillsById.get(ID.NIGHTMARE_WEAPON).icon;
  const splinterIcon = necromancerCatalog.skillsById.get(ID.SPLINTER_WEAPON).icon;
  const nightmareProcs = weaponSpells.procSteps.filter((step) => step.skill === 'Nightmare Weapon');
  const splinterProcs = weaponSpells.procSteps.filter((step) => step.skill === 'Splinter Weapon');

  assert.deepEqual(weaponSpells.warnings, []);
  assert.equal(nightmare.length, 5);
  assert.equal(splinter.length, 5);
  assert.equal(
    splinter.every((event) => event.coefficient === 0.4),
    true
  );
  assert.equal(
    nightmareProcs.every((step) => step.icon === nightmareIcon),
    true
  );
  assert.equal(
    splinterProcs.every((step) => step.icon === splinterIcon),
    true
  );
  const nightmareProc = necromancerCatalog.balanceProfilesById.get(RITUALIST_BALANCE_PROFILE_IDS.nightmareWeaponProc);

  assert.equal(nightmareProc.effects[1].stacks, 2);
  assert.equal(nightmareProc.effects[1].duration, 8);
  assert.deepEqual(resilient.warnings, []);
  assert.equal(
    observedRuntime(resilient).profession.specialization.state.weaponSpells.resilient.recipients.player.charges,
    5
  );
});

test('Ritualist weapon spells scale with allied players', () => {
  // Modeled allied strikes require an actual combat boundary even when the player never attacks.
  const rotation = [{ type: 'combat-start' }, 'Nightmare Weapon', 'Splinter Weapon'];
  const solo = simulate(
    'Ritualist',
    rotation,
    {
      selectedSkillIds: [76739, 76975],
      allies: { count: 0, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const party = simulate(
    'Ritualist',
    rotation,
    {
      selectedSkillIds: [76739, 76975],
      allies: { count: 4, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const allyProcs = party.resolvedEvents.filter((event) => event.type === 'damage' && event.metadata?.triggeredByAlly);
  const applicationEvents = party.events.filter(
    (event) => event.type === 'buff' && [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON].includes(event.skillId)
  );

  assert.equal(solo.totalDamage, 0);
  assert.ok(party.totalDamage > solo.totalDamage);
  // Allies spend their own grants directly; their Splinter hits also exhaust the caster's five Nightmare charges.
  assert.equal(
    allyProcs.filter((event) => event.skillName === 'Nightmare Weapon' && event.triggeredBy !== 'Splinter Weapon')
      .length,
    12
  );
  assert.equal(
    allyProcs.filter((event) => event.skillName === 'Nightmare Weapon' && event.triggeredBy === 'Splinter Weapon')
      .length,
    5
  );
  assert.equal(allyProcs.filter((event) => event.name === 'Splinter Weapon').length, 12);
  assert.deepEqual([...new Set(allyProcs.map((event) => event.metadata?.triggeredByAlly))], [1, 2, 3, 4]);
  assert.equal(
    applicationEvents.every(
      (event) =>
        event.resolvedAudience.alliedPlayerCount === 4 &&
        event.resolvedAudience.recipientCount === 5 &&
        event.resolvedAudience.companionIds.length === 0
    ),
    true
  );

  const wieldersBoon = simulate(
    'Ritualist',
    [{ type: 'combat-start' }, 'Nightmare Weapon'],
    {
      selectedSkillIds: [76739],
      selectedTraitIds: [TRAIT.WIELDERS_BOON],
      allies: { count: 1, strikesPerSecond: 10 }
    },
    observationTail(2000)
  );

  assert.equal(
    wieldersBoon.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' && event.skillName === 'Nightmare Weapon' && event.metadata?.triggeredByAlly === 1
    ).length,
    5
  );
});

test('Ritualist weapon spells prioritize players, include minions, and exclude spirits', () => {
  const result = simulate(
    'Ritualist',
    [
      'Summon Bone Minions',
      "Ritualist's Shroud",
      'Anguish',
      "Exit Ritualist's Shroud",
      'Nightmare Weapon',
      'Splinter Weapon'
    ],
    {
      initialResource: 100,
      selectedSkillIds: [10541, 76739, 76975],
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS],
      allies: { count: 2, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const applications = result.events.filter(
    (event) => event.type === 'buff' && [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON].includes(event.skillId)
  );

  assert.deepEqual(result.warnings, []);
  assert.ok(result.planningState.profession.activeSpirits.anguish);
  assert.deepEqual(
    applications.map((event) => event.skillId),
    [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON]
  );
  assert.equal(
    applications.every(
      (event) =>
        event.resolvedAudience.alliedPlayerCount === 2 &&
        event.resolvedAudience.recipientCount === 5 &&
        event.resolvedAudience.companionIds.join(',') === 'minion:bone-minion:0,minion:bone-minion:1' &&
        event.resolvedAudience.companionIds.every((recipient) => !recipient.startsWith('spirit:'))
    ),
    true
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' &&
        event.skillName === 'Nightmare Weapon' &&
        event.metadata?.triggeredByAlly &&
        event.triggeredBy !== 'Splinter Weapon'
    ).length,
    6
  );
});

test("Wanderlust's player-scaled attacks cannot spend the player's Splinter Weapon stacks", () => {
  const result = simulate(
    'Ritualist',
    [
      "Ritualist's Shroud",
      'Wanderlust',
      "Exit Ritualist's Shroud",
      'Splinter Weapon',
      'Necrotic Slash',
      { type: 'wait', durationMs: 4000 }
    ],
    {
      initialResource: 100,
      selectedSkillIds: [76975],
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS]
    }
  );
  const splinterProcs = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Splinter Weapon'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    splinterProcs.some((event) => event.triggeredBy === 'Necrotic Slash'),
    true
  );
  assert.equal(
    splinterProcs.some(
      (event) =>
        String(event.triggeredBy).includes('Wanderlust') || String(event.summonOwner).startsWith('spirit:wanderlust')
    ),
    false
  );
});

test('Necromancer trait procs resolve from real event state', () => {
  const dhuumfire = simulate(
    'Core',
    ['Death Shroud', 'Life Blast', 'End Death Shroud', { type: 'wait', durationMs: 3100 }],
    { selectedTraitIds: [TRAIT.DHUUMFIRE] }
  );
  const demonicLore = simulate('Scourge', ['Manifest Sand Shade', { type: 'wait', durationMs: 3100 }], {
    selectedTraitIds: [TRAIT.DEMONIC_LORE]
  });
  const deathlyChill = simulate(
    'Reaper',
    ["Reaper's Shroud", "Executioner's Scythe", "Exit Reaper's Shroud", { type: 'wait', durationMs: 3100 }],
    { selectedTraitIds: [TRAIT.DEATHLY_CHILL] }
  );

  assert.ok(dhuumfire.resolvedEvents.some((event) => event.name === 'Dhuumfire - Burning'));
  assert.ok(demonicLore.resolvedEvents.some((event) => event.name === 'Demonic Lore - Burning'));
  assert.ok(deathlyChill.resolvedEvents.some((event) => event.name === 'Deathly Chill - Bleeding'));
});

test('Last Tyrant counts Necromancer trait Burning', () => {
  const dhuumfire = simulate('Core', ['Death Shroud', ...Array(6).fill('Life Blast'), 'End Death Shroud'], {
    relic: 'Last Tyrant',
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const demonicLore = simulate('Scourge', ['Manifest Sand Shade', { type: 'wait', durationMs: 3100 }], {
    initialResource: 100,
    relic: 'Last Tyrant',
    selectedTraitIds: [TRAIT.DEMONIC_LORE]
  });
  const sadisticSearing = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Nefarious Favor', { type: 'wait', durationMs: 1000 }],
    { initialResource: 100, relic: 'Last Tyrant', selectedTraitIds: [TRAIT.SADISTIC_SEARING] }
  );

  assert.equal(
    dhuumfire.resolvedEvents.filter((event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning')
      .length,
    6
  );
  assert.equal(
    dhuumfire.resolvedEvents.filter(
      (event) => event.sourceId === `relic.${RELIC_IDS.LAST_TYRANT}` && event.type === 'damage'
    ).length,
    1
  );
  for (const [result, sourceId] of [
    [dhuumfire, TRAIT.DHUUMFIRE],
    [demonicLore, TRAIT.DEMONIC_LORE],
    [sadisticSearing, TRAIT.SADISTIC_SEARING]
  ]) {
    assert.equal(
      result.resolvedEvents.some(
        (event) => event.sourceId === sourceId && event.condition === 'Burning' && event.ownerActorType === 'player'
      ),
      true
    );
    assert.equal(
      result.procSteps.some((step) => step.skill === 'Relic of the Last Tyrant' && step.detail === '1/5 stacks'),
      true
    );
  }
});

test('migrated Core trait lines retain previously uncovered threshold, blind, heal, and fear behavior', () => {
  const threshold = simulate('Core', ['Ghastly Claws'], {
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.SIPHONED_POWER, TRAIT.CHILL_OF_DEATH],
    target: { ...baseConfig.target, health: 1 }
  });
  const blind = simulate('Core', ['Deathly Swarm'], {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.CHILLING_DARKNESS]
  });
  const heal = simulate('Core', ['Summon Blood Fiend'], {
    selectedSkillIds: [10547],
    selectedTraitIds: [TRAIT.DARK_DEFENSE]
  });
  const fear = (selectedTraitIds = []) =>
    simulate('Core', ['Wail of Doom'], {
      initialResource: 0,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Warhorn',
      selectedTraitIds
    });
  const plainFear = fear();
  const fearOfDeath = fear([TRAIT.FEAR_OF_DEATH]);

  assert.equal(
    threshold.procSteps.some((step) => step.skill === 'Siphoned Power'),
    true
  );
  assert.equal(
    threshold.procSteps.some((step) => step.skill === 'Lesser Spinal Shivers'),
    true
  );
  assert.equal(
    blind.resolvedEvents.some((event) => event.condition === 'Chilled' && event.sourceId === TRAIT.CHILLING_DARKNESS),
    true
  );
  assert.equal(
    heal.events.some((event) => event.type === 'buff' && event.kind === 'protection' && event.duration === 3),
    true
  );
  assert.equal(heal.planningState.profession.carapaceExpiries.length, 10);
  assert.equal(
    lifeForcePercent(fearOfDeath.planningState.profession.lifeForce) -
      lifeForcePercent(plainFear.planningState.profession.lifeForce),
    15
  );
});

test('Blood Is Power and Plague Signet preserve transferred conditions', () => {
  const result = simulate('Harbinger', ['Blood Is Power', 'Plague Signet', { type: 'wait', durationMs: 10_100 }], {
    selectedSkillIds: [10544, 10562],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION]
  });
  const transferred = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.fixedDuration === true
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    transferred.filter((event) => event.condition === 'Bleeding').reduce((sum, event) => sum + event.stacks, 0),
    2
  );
  assert.equal(
    transferred.filter((event) => event.condition === 'Torment').reduce((sum, event) => sum + event.stacks, 0),
    2
  );
  assert.deepEqual(result.planningState.profession.selfConditions, []);
  // Transferring after the aftercast preserves the original expiry instead of restarting the self-condition.
  for (const event of transferred) {
    const self = result.events.find(
      (candidate) => candidate.type === 'self_condition' && candidate.condition === event.condition
    );
    assert.ok(self.at < event.at);
    assert.ok(Math.abs(event.at + event.effectiveDuration - self.expiresAt) < 0.0001);
  }
});

test('Plague Sending treats Scourge F5 as entering shroud', () => {
  const result = simulate('Scourge', ['Desert Shroud', 'Blood Is Power', { type: 'wait', durationMs: 10_100 }], {
    initialResource: 100,
    selectedSkillIds: [10544],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION, TRAIT.PLAGUE_SENDING]
  });
  const transferred = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.fixedDuration === true
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    transferred.map((event) => [event.condition, event.stacks]),
    [
      ['Bleeding', 1],
      ['Bleeding', 1],
      ['Torment', 1],
      ['Torment', 1]
    ]
  );
  assert.deepEqual(result.planningState.profession.selfConditions, []);
});

// Shared trait grants retain the triggering owner's attribution and selection gate across shroud implementations.
test('Soul Barbs preserves Core trait attribution and Scourge cast attribution', () => {
  for (const [specialization, skillName, source, sourceId] of [
    ['Core', 'Death Shroud', 'Trait', TRAIT.SOUL_BARBS],
    ['Scourge', 'Desert Shroud', 'necromancer', ID.DESERT_SHROUD]
  ]) {
    const result = simulate(specialization, [skillName], {
      initialResource: 100,
      selectedTraitIds: [TRAIT.SOUL_BARBS]
    });
    assert.deepEqual(result.warnings, []);
    const grant = result.events.find((event) => event.type === 'buff' && event.kind === 'necromancer-soul-barbs');
    assert.ok(grant, specialization);
    assert.equal(grant.source, source);
    assert.equal(grant.sourceId, sourceId);

    if (specialization === 'Scourge') {
      assert.equal(grant.skillId, ID.DESERT_SHROUD);
      assert.equal(grant.skillName, skillName);
      assert.ok(grant.activationId);
    }

    const unselected = simulate(specialization, [skillName], { initialResource: 100, selectedTraitIds: [] });
    assert.deepEqual(unselected.warnings, []);
    assert.equal(
      unselected.events.some((event) => event.kind === 'necromancer-soul-barbs'),
      false
    );
  }
});

test('Desert Shroud pulses do not retrigger shroud skill-one traits', () => {
  const result = simulate('Scourge', ['Desert Shroud', { type: 'wait', durationMs: 6100 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const applications = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning'
  );

  assert.equal(applications.length, 1);
});

test('requested Harbinger damage traits apply at their per-hit triggers', () => {
  const result = simulate(
    'Harbinger',
    [
      'Harbinger Shroud',
      'Tainted Bolts',
      'Dark Barrage',
      'Vital Draw',
      'Exit Harbinger Shroud',
      { type: 'wait', durationMs: 3100 }
    ],
    {
      initialResource: 100,
      initialBlight: 10,
      selectedTraitIds: [TRAIT.DHUUMFIRE, TRAIT.UNYIELDING_BLAST, TRAIT.SEPTIC_CORRUPTION, TRAIT.INSIDIOUS_DISRUPTION]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning').length,
    2
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.skillId === ID.TAINTED_BOLTS && event.condition === 'Torment').length,
    2
  );
  assert.equal(result.procSteps.filter((step) => step.skill === 'Unyielding Blast').length, 1);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.sourceId === TRAIT.SEPTIC_CORRUPTION && event.condition === 'Poisoned'
    ).length,
    6
  );
  const insidiousDisruption = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.INSIDIOUS_DISRUPTION && event.condition === 'Torment'
  );

  assert.equal(insidiousDisruption.length, 3);
  assert.ok(insidiousDisruption.every((event) => event.duration === 5));
});

test('Barbed Precision samples its secondary chance on guaranteed critical hits', () => {
  const result = simulate('Harbinger', ['Weeping Shots', { type: 'wait', durationMs: 4100 }], {
    primaryWeapon: 'Pistol',
    attributeInputs: baseAttributeInputs({ precision: 4000 }),
    selectedTraitIds: [TRAIT.BARBED_PRECISION]
  });
  const applications = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.BARBED_PRECISION && event.condition === 'Bleeding'
  );

  // The fixed default seed yields one successful secondary roll for these six critical hits.
  assert.equal(applications.length, 1);
  assert.ok(applications.every((application) => application.duration === 3));
  assert.ok(applications.every((application) => Math.abs(application.effectiveDuration - 3.6) < 1e-12));
});

test('Barbed Precision excludes minion strikes but includes Ritualist spirit strikes', () => {
  const minion = simulate('Core', ['Summon Shadow Fiend', { type: 'wait', durationMs: 9000 }], {
    selectedSkillIds: [10589],
    selectedTraitIds: [TRAIT.BARBED_PRECISION]
  });
  const spirit = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish', { type: 'wait', durationMs: 12_000 }], {
    initialResource: 100,
    attributeInputs: baseAttributeInputs({ precision: 4000 }),
    selectedTraitIds: [TRAIT.BARBED_PRECISION]
  });
  const applications = (result) =>
    result.resolvedEvents.filter(
      (event) => event.sourceId === TRAIT.BARBED_PRECISION && event.condition === 'Bleeding'
    );

  assert.equal(applications(minion).length, 0);
  assert.ok(applications(spirit).length > 0);
});

test('Devouring Darkness scales torment with distinct target conditions', () => {
  const result = simulate('Core', ['Devouring Darkness', { type: 'wait', durationMs: 4100 }], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.LINGERING_CURSE],
    target: {
      conditions: {
        Bleeding: true,
        Burning: true,
        Chilled: true,
        Poisoned: true,
        Torment: true,
        Vulnerability: 25
      }
    }
  });
  const application = result.resolvedEvents.find(
    (event) => event.skillId === ID.DEVOURING_DARKNESS && event.condition === 'Torment'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents
      .filter((event) => event.skillId === ID.DEVOURING_DARKNESS && event.condition === 'Torment')
      .reduce((sum, event) => sum + event.stacks, 0),
    5
  );
  assert.equal(application?.effectiveDuration, 4);
});

test('Lesser Chilblains owns its strike and poison damage attribution', () => {
  const baseline = simulate('Reaper', ["Reaper's Shroud", 'Soul Spiral'], {}, observationTail(4100));
  const result = simulate(
    'Reaper',
    ["Reaper's Shroud", 'Soul Spiral'],
    { selectedTraitIds: [TRAIT.TRANSFUSION] },
    observationTail(4100)
  );
  const rows = skillBreakdownRows(result);
  const lesserChilblains = rows.find((row) => row.name === 'Lesser Chilblains');
  const soulSpiral = rows.find((row) => row.name === 'Soul Spiral');
  const baselineSoulSpiral = skillBreakdownRows(baseline).find((row) => row.name === 'Soul Spiral');
  const attributedEvents = result.resolvedEvents.filter(
    (event) =>
      event.sourceId === ID.LESSER_CHILBLAINS &&
      (event.type === 'damage' || (event.type === 'condition' && event.condition === 'Poisoned'))
  );
  const chilblainsIcon = necromancerCatalog.skillsById.get(ID.CHILLBLAINS)?.icon;

  assert.ok(lesserChilblains?.strike > 0);
  assert.ok(lesserChilblains?.condition > 0);
  assert.equal(lesserChilblains?.skillId, ID.LESSER_CHILBLAINS);
  assert.equal(lesserChilblains?.icon, chilblainsIcon);
  assert.equal(lesserChilblains?.parentSkill, 'Soul Spiral');
  assert.equal(lesserChilblains?.casts, 0);
  // Shared condition-tick rounding can redistribute a single point between owners.
  assert.ok(Math.abs(soulSpiral.condition - baselineSoulSpiral.condition) <= 1);
  assert.ok(attributedEvents.some((event) => event.type === 'damage'));
  assert.ok(attributedEvents.some((event) => event.type === 'condition'));
  assert.equal(
    attributedEvents.every(
      (event) => event.skillName === 'Lesser Chilblains' && event.parentSkillName === 'Soul Spiral'
    ),
    true
  );
});

test('Voracious Arc gives Lesser Chilblains its own damage row', () => {
  const result = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Voracious Arc'],
    { selectedTraitIds: [TRAIT.TRANSFUSION] },
    observationTail(4100)
  );
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Lesser Chilblains');

  assert.ok(row?.strike > 0);
  assert.ok(row?.condition > 0);
  assert.equal(row?.skillId, ID.LESSER_CHILBLAINS);
  assert.equal(row?.parentSkill, 'Voracious Arc');
});

test('cross-specialization Necromancer trait triggers remain executable', () => {
  const spite = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud'], {
    selectedTraitIds: [TRAIT.REAPERS_MIGHT, TRAIT.WEAKENING_SHROUD]
  });
  const reaper = simulate(
    'Reaper',
    ["Reaper's Shroud", 'Soul Spiral', "Exit Reaper's Shroud", { type: 'wait', durationMs: 8100 }],
    {
      selectedTraitIds: [TRAIT.TRANSFUSION]
    }
  );
  const fear = simulate('Reaper', ["Reaper's Mark", { type: 'wait', durationMs: 2100 }], {
    primaryWeapon: 'Staff',
    selectedTraitIds: [TRAIT.SHIVERS_OF_DREAD, TRAIT.BITTER_CHILL, TRAIT.TERROR]
  });
  const malicious = simulate('Core', ['Summon Blood Fiend'], {
    selectedSkillIds: [10547],
    selectedTraitIds: [TRAIT.MALICIOUS_SWARM]
  });
  const ashes = simulate('Scourge', ['Harrowing Wave'], {
    initialResource: 0,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Torch',
    selectedTraitIds: [TRAIT.NOURISHING_ASHES]
  });

  assert.equal(
    spite.procSteps.some((step) => step.skill === "Reaper's Might"),
    true
  );
  assert.equal(
    spite.breakdown.some((entry) => entry.name === 'Weakening Shroud'),
    true
  );
  assert.equal(
    reaper.resolvedEvents.some((entry) => entry.type === 'damage' && entry.skillId === ID.LESSER_CHILBLAINS),
    true
  );
  assert.equal(
    fear.procSteps.some((step) => step.skill === 'Bitter Chill'),
    true
  );
  assert.equal(
    fear.resolvedEvents.some(
      (event) => event.skillId === ID.REAPERS_MARK && event.condition === 'Fear' && event.damage > 0
    ),
    true
  );
  assert.ok(fear.conditionDamage > 0);
  assert.equal(
    malicious.resolvedEvents.some(
      (entry) => entry.type === 'damage' && entry.skillId === ID.LESSER_SIGNET_OF_THE_LOCUST
    ),
    true
  );
  assert.equal(lifeForcePercent(ashes.planningState.profession.lifeForce), 10);
});

test('remaining outgoing Necromancer trait families affect combat state', () => {
  const carapaceBase = simulate('Core', ['Blood Curse', 'Rending Curse'], {
    primaryWeapon: 'Scepter'
  });
  const carapace = simulate('Core', ['Blood Curse', 'Rending Curse'], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.CORRUPTERS_FERVOR, TRAIT.DEADLY_STRENGTH]
  });
  const armored = simulate('Core', ['Death Shroud', 'Life Blast'], {
    selectedTraitIds: [TRAIT.ARMORED_SHROUD, TRAIT.DEADLY_STRENGTH]
  });
  const augury = simulate('Reaper', ['"Suffer!"'], {
    selectedSkillIds: [30670],
    selectedTraitIds: [TRAIT.AUGURY_OF_DEATH]
  });
  const signet = simulate('Core', ['Signet of Spite'], {
    selectedSkillIds: [10622],
    selectedTraitIds: [TRAIT.SIGNETS_OF_SUFFERING]
  });
  const brew = simulate('Harbinger', ['Elixir of Risk'], {
    selectedSkillIds: [62530],
    selectedTraitIds: [TRAIT.BOLSTERING_BREW]
  });
  const empowerment = simulate('Scourge', ['Manifest Sand Shade'], {
    selectedTraitIds: [TRAIT.DESERT_EMPOWERMENT]
  });

  assert.ok(carapace.strikeDamage > carapaceBase.strikeDamage);
  assert.ok(armored.planningState.profession.carapaceExpiries.length >= 5);
  assert.equal(
    augury.breakdown.some((entry) => entry.name === 'Augury of Death'),
    true
  );
  assert.equal(
    signet.breakdown.some((entry) => entry.name === 'Signets of Suffering'),
    true
  );
  assert.equal(
    brew.events.some((event) => event.kind === 'protection' && event.skillId === ID.ELIXIR_OF_RISK),
    true
  );
  assert.equal(
    empowerment.events.some((event) => event.kind === 'alacrity' && event.skillId === ID.MANIFEST_SAND_SHADE),
    true
  );
});

test('Corrupted Talent owns the Harbinger shroud-entry life-force gain', () => {
  const withoutTrait = simulate('Harbinger', ['Harbinger Shroud'], {
    initialResource: 0
  });
  const withTrait = simulate('Harbinger', ['Harbinger Shroud'], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.CORRUPTED_TALENT]
  });

  assert.equal(lifeForcePercent(withoutTrait.planningState.profession.lifeForce), 0);
  assert.equal(lifeForcePercent(withTrait.planningState.profession.lifeForce), 15);
});

test('modifier candidates include every active Necromancer trait', () => {
  const build = createNecromancerBuildDefaults();
  const app = {
    patch: necromancerAppAdapter.profession.resolvePatch({ id: 'current' }),
    build,
    activeCatalog: necromancerCatalog,
    attributeWeaponSet: 1
  };

  app.attributeData = necromancerAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: necromancerAppAdapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);

  const activeTraitNames = new Set(app.attributeData.activeTraits.map((trait) => trait.name));
  const candidateNames = new Set(
    necromancerAppAdapter
      .modifierContributionRequest(app)
      .comparisons.map(({ modifier }) => modifier)
      .filter((candidate) => candidate.type === 'Trait')
      .map((candidate) => candidate.name)
  );

  assert.deepEqual(candidateNames, activeTraitNames);
});

// Undeath's resource clock survives removal of its unmodeled revive event and respects active recharge.
test('Signet of Undeath grants four life force per passive pulse and suspends during recharge', () => {
  const config = { initialResource: 0, selectedSkillIds: [10611] };
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  const first = simulate('Core', [wait(3000)], config);
  const second = simulate('Core', [wait(3000), wait(3000)], config);
  const recharging = simulate('Core', ['Signet of Undeath', wait(6000)], config);
  const resumed = simulate('Core', ['Signet of Undeath', wait(63000)], config);
  for (const result of [first, second, recharging, resumed]) assert.deepEqual(result.warnings, []);
  assert.equal(lifeForcePercent(first.planningState.profession.lifeForce), 4);
  assert.equal(lifeForcePercent(second.planningState.profession.lifeForce), 8);
  assert.equal(lifeForcePercent(recharging.planningState.profession.lifeForce), 0);
  assert.ok(recharging.planningState.cooldowns[ID.SIGNET_OF_UNDEATH].remaining > 0);
  assert.equal(lifeForcePercent(resumed.planningState.profession.lifeForce), 4);
});

test('signet passives and Soul Battery are profession-owned resources', () => {
  const signets = simulate('Core', [{ type: 'wait', durationMs: 3100 }], {
    initialResource: 0,
    selectedSkillIds: [10611, 21762]
  });
  const battery = simulate('Core', [], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_BATTERY]
  });
  const eternal = simulate('Core', [{ type: 'wait', durationMs: 4100 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE]
  });
  const eternalCap = simulate('Core', [{ type: 'wait', durationMs: 70_100 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE]
  });
  const perception = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud', 'Blood Curse'], {
    initialResource: 100,
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.DEATH_PERCEPTION]
  });

  assert.equal(lifeForcePercent(signets.planningState.profession.lifeForce), 4);
  assert.ok(signets.breakdown.some((entry) => entry.name === 'Signet of Vampirism - Passive Life Siphon'));
  assert.ok(battery.planningState.profession.lifeForce.maximum > signets.planningState.profession.lifeForce.maximum);
  assert.equal(lifeForcePercent(battery.planningState.profession.lifeForce), 100);
  assert.equal(lifeForcePercent(eternal.planningState.profession.lifeForce), 12);
  assert.equal(lifeForcePercent(eternalCap.planningState.profession.lifeForce), 66);
  const lifeBlast = perception.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.LIFE_BLAST
  );
  const bloodCurse = perception.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.BLOOD_CURSE
  );

  assert.ok(Math.abs(lifeBlast.criticalChance - 0.6761904761904762) < 1e-12);
  // Shroud critical damage includes Death Perception directly; the unconditional chance persists after exit.
  assert.ok(Math.abs(lifeBlast.criticalDamage - 1.8333333333333333 * 1.1) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalChance - 0.6761904761904762) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalDamage - 1.8333333333333333) < 1e-12);
});

test('the Power Harbinger trait set uses current critical and resource rules', () => {
  const runShroudStrike = (selectedTraitIds) =>
    simulate('Harbinger', ['Harbinger Shroud', 'Tainted Bolts'], {
      attributeInputs: baseAttributeInputs({ precision: 4000 }),
      selectedTraitIds,
      target: {
        ...baseConfig.target,
        health: 1_000_000_000,
        conditions: {
          ...baseConfig.target.conditions,
          Torment: true
        }
      }
    });
  const base = runShroudStrike([]);
  const deathPerception = runShroudStrike([TRAIT.DEATH_PERCEPTION]);
  const wickedCorruption = runShroudStrike([TRAIT.WICKED_CORRUPTION]);
  const both = runShroudStrike([TRAIT.DEATH_PERCEPTION, TRAIT.WICKED_CORRUPTION]);
  const strikeDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.TAINTED_BOLTS).damage;

  assertFlooredDamageMultiplier(strikeDamage(deathPerception), strikeDamage(base), 1.1);
  assertFlooredDamageMultiplier(strikeDamage(wickedCorruption), strikeDamage(base), 1.1);
  assertFlooredDamageMultiplier(strikeDamage(both), strikeDamage(base), 1.21);

  const implacable = simulate('Harbinger', ['Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.IMPLACABLE_FOE]
  });

  assert.equal(
    implacable.events.some(
      (event) => event.type === 'buff' && event.kind === 'stability' && event.stacks === 3 && event.duration === 5
    ),
    true
  );

  const fortitude = simulate('Harbinger', ['Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE, TRAIT.GLUTTONY],
    target: {
      ...baseConfig.target,
      health: 8000
    }
  });

  assert.equal(lifeForcePercent(fortitude.planningState.profession.lifeForce), 2.2);
});

test('critical sigils follow the active weapon set', () => {
  const result = simulate(
    'Harbinger',
    ['Vile Blast', 'Swap Weapons', 'Grasping Dead', { type: 'wait', durationMs: 2100 }],
    {
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Torch',
      weaponSet2Primary: 'Scepter',
      weaponSet2Secondary: 'Dagger',
      attributeInputs: baseAttributeInputs({ precision: 4000 }),
      sigilSets: [
        { names: ['Torment'], strike: 1, condition: 1 },
        { names: ['Earth'], strike: 1, condition: 1 }
      ]
    }
  );

  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Torment'),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Earth'),
    true
  );
});

// Disabling the autonomous clock leaves the summon/active packets and observation window intact.
test('a zero spirit interval disables recurrence without removing initial spirit effects', () => {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'no-spirit-loop',
    label: 'No spirit loop',
    professions: {
      necromancer: {
        balanceProfiles: {
          [RITUALIST_BALANCE_PROFILE_IDS.resources]: { fields: { pulseInterval: 0 } }
        }
      }
    }
  });
  const result = createObservedProfessionSimulator(profession, baseConfig)(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', 'Wanderlust', 'Preservation', { type: 'wait', durationMs: 10000 }],
    { patchId: 'no-spirit-loop', initialResource: 100 }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.resolvedEvents.some((event) => event.metadata?.spiritAttackType === 'initial'));
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.spirit-attack'),
    false
  );
});
