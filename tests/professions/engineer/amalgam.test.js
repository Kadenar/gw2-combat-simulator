import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createEngineerBuildDefaults, toApplicationBuild } from '#gw2/professions/engineer/build/build.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { amalgamAttributeRules } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-rules.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
  selectedMorphSkillIds: [77103, 77203, 76954],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    observationPolicy
  });
}

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('Amalgam traits activate on morph and Evolve chronology', () => {
  const result = simulate('Amalgam', [77103, 77104, 76705, 'Evolve', 'Grenade Kit', 'Shrapnel Grenade'], {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Plasmatic State', 'Flux State'],
    selectedMorphSkillIds: [77103, 77104, 76705],
    selectedTraitIds: [TRAIT.WILLING_HOST, TRAIT.HARDENED_CHROME, TRAIT.CARBOLIC_COMPOSITION, TRAIT.NEW_GENES]
  });

  assert.equal(result.warnings.length, 0);
  assert.ok(result.profession.willingHostUntil > 0);
  assert.ok(result.profession.evolvedUntil > 0);
  assert.equal(result.profession.rapaciousUntil, result.profession.evolvedUntil);
  assert.equal(result.profession.predatorUntil, result.profession.evolvedUntil);
  assert.equal(result.profession.titanicUntil, result.profession.evolvedUntil);
  assert.equal(
    result.events.filter(
      (event) => event.type === 'buff' && event.kind === 'alacrity' && event.skillName === 'New Genes'
    ).length,
    3
  );
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Rapacious Strain'));
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'condition' && event.name === 'Carbolic Composition — Poisoned'
    )
  );
});

test('Evolve raises attributes by ten percent for eight seconds', () => {
  const neutralMorphs = [76815, 77285, 77358];
  const config = {
    selectedMorphSkillIds: neutralMorphs,
    stats: {
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000
    }
  };
  const baseline = simulate('Amalgam', [{ type: 'wait', durationMs: 750 }, 'Puncturing Jab'], config);
  const evolved = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], config);
  const puncture = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

  assert.ok(Math.abs(puncture(evolved).damage / puncture(baseline).damage - 1.1) < 1e-12);
  assert.equal(evolved.endState.profession.evolvedUntil, 8.78);
});

test("Sharpshooter derives bleeding damage from Evolve's Power bonus", () => {
  const config = {
    selectedMorphSkillIds: [76815, 77285, 77358],
    selectedTraitIds: [TRAIT.SHARPSHOOTER, TRAIT.DOUBLE_HELIX],
    stats: {
      power: 2000,
      conditionDamage: 1000,
      expertise: 0
    },
    amalgamEvolveAttributePool: {
      Power: 2000,
      'Condition Damage': 1000
    },
    target: { conditions: {} }
  };
  const result = simulate(
    'Amalgam',
    ['Evolve', 'Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 1000 }],
    config
  );
  const bleed = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel Grenade' && event.condition === 'Bleeding'
  );

  // Double Helix raises eligible Power from 2000 to 2400; Sharpshooter then
  // replaces bleeding's condition damage with two-thirds of that final Power.
  assert.ok(bleed);
  assert.ok(Math.abs(bleed.damage / bleed.damagingStackSeconds - 118) < 1e-12);
});

test('Evolve cannot raise condition duration above the global cap', () => {
  const result = simulate(
    'Amalgam',
    ['Evolve', 'Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 13000 }],
    {
      selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Bomb Kit', 'Flux State'],
      selectedMorphSkillIds: [77103, 77104, 76705],
      selectedTraitIds: [TRAIT.SERRATED_STEEL],
      stats: { expertise: 1500 },
      target: { conditions: {} }
    }
  );
  const directBleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel Grenade' && event.condition === 'Bleeding'
  );

  assert.equal(directBleeds.length, 3);
  assert.ok(directBleeds.every((event) => Math.abs(event.effectiveDuration - 14) < 1e-12));
});

test('Evolve grants each selected protocol strain without leaking it to casts', () => {
  const result = simulate('Amalgam', ['Evolve'], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });
  const berserker = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Berserker Strain' && event.kind === 'stability'
  );

  assert.equal(berserker.stacks, 5);
  assert.equal(berserker.duration, 8);
  assert.equal(result.endState.profession.berserkerUntil, result.endState.profession.evolvedUntil);

  const demolish = simulate('Amalgam', [76954], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });

  assert.equal(
    demolish.events.some((event) => event.type === 'buff' && event.kind === 'stability'),
    false
  );
});

test('Hardened Chrome and New Genes grant the requested morph boons', () => {
  const protocols = [
    [76959, 'protection', 4, 1],
    [76798, 'aegis', 4, 1],
    [77163, 'stability', 4, 2],
    [76815, 'vigor', 4, 1],
    [76806, 'might', 12, 5],
    [77103, 'fury', 6, 1],
    [76927, 'swiftness', 6, 1]
  ];
  const defaults = new Map([
    [2, 77103],
    [3, 77203],
    [4, 76954]
  ]);

  for (const [skillId, kind, duration, stacks] of protocols) {
    const skill = engineerCatalog.skillsById.get(skillId);
    const selected = new Map(defaults);

    selected.set(Number(skill.mechanicSlot), skillId);
    const result = simulate('Amalgam', [skillId], {
      selectedMorphSkillIds: [...selected.values()],
      selectedTraitIds: [TRAIT.HARDENED_CHROME, TRAIT.NEW_GENES]
    });
    const hardened = result.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.HARDENED_CHROME);

    assert.equal(hardened.kind, 'protection');
    assert.equal(hardened.duration, 2.5);

    const newGenes = result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.NEW_GENES);

    assert.ok(newGenes.some((event) => event.kind === 'alacrity' && event.duration === 5 && event.stacks === 1));
    assert.ok(newGenes.some((event) => event.kind === 'might' && event.duration === 12 && event.stacks === 4));
    assert.ok(newGenes.some((event) => event.kind === kind && event.duration === duration && event.stacks === stacks));
  }

  const evolve = simulate('Amalgam', ['Evolve'], {
    selectedTraitIds: [TRAIT.HARDENED_CHROME]
  });
  const protection = evolve.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.HARDENED_CHROME);

  assert.equal(protection.duration, 4);
});

test('Carbolic Composition poisons only Amalgam skill hits', () => {
  const result = simulate('Amalgam', [77103, 'Puncturing Jab'], {
    selectedMorphSkillIds: [77103, 77203, 76954],
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION],
    target: { conditions: {} }
  });
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Carbolic Composition'
  );

  assert.equal(poison.length, 3);
  assert.ok(
    poison.every(
      (event) =>
        event.triggeredBy === 'Offensive Protocol: Shred' && Math.abs(event.naturalExpiresAt - event.at - 3.99) < 1e-12
    )
  );
  assert.equal(
    poison.some((event) => event.triggeredBy === 'Puncturing Jab'),
    false
  );

  const strain = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION],
    stats: { precision: 4000, ferocity: 0 },
    target: { conditions: {} }
  });
  const rapacious = strain.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Rapacious Strain');

  assert.equal(rapacious.criticalChance, 1);
  assert.deepEqual(
    {
      actorType: rapacious.actorType,
      ownerActorType: rapacious.ownerActorType
    },
    { actorType: 'effect', ownerActorType: 'player' }
  );
  assert.ok(
    strain.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Carbolic Composition' &&
        event.triggeredBy === 'Rapacious Strain'
    )
  );

  const inherited = simulate('Amalgam', ['Flux State', { type: 'wait', durationMs: 7000 }], {
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION, TRAIT.EXPLOSIVE_ENTRANCE],
    target: { conditions: {} }
  });

  assert.equal(
    inherited.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Carbolic Composition' &&
        event.triggeredBy === 'Explosive Entrance'
    ),
    false
  );
});

test('Silver Lining moves strain activation from Evolve to each morph', () => {
  const selectedMorphSkillIds = [76959, 76866, 76954];
  const baseMorph = simulate('Amalgam', [76959], {
    selectedMorphSkillIds
  });

  assert.equal(
    baseMorph.events.some((event) => event.type === 'buff' && event.skillName === 'Resiliant Strain'),
    false
  );

  const baseEvolve = simulate('Amalgam', ['Evolve'], {
    selectedMorphSkillIds
  });

  assert.ok(
    baseEvolve.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Resiliant Strain' &&
        event.kind === 'resistance' &&
        event.duration === 8
    )
  );

  const silverMorph = simulate('Amalgam', [76959], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING]
  });

  assert.ok(
    silverMorph.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Resiliant Strain' &&
        event.kind === 'resistance' &&
        event.duration === 8
    )
  );

  const silverEvolve = simulate('Amalgam', ['Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING]
  });

  assert.equal(
    silverEvolve.events.some(
      (event) =>
        event.type === 'buff' && ['Resiliant Strain', 'Predator Strain', 'Berserker Strain'].includes(event.skillName)
    ),
    false
  );
});

test('Mercurial Tendencies reduces Evolve once per quarter-second', () => {
  const selectedMorphSkillIds = [76815, 76866, 76954];
  const baseline = simulate('Amalgam', ['Evolve', 76815, 'Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING]
  });
  const reduced = simulate('Amalgam', ['Evolve', 76815, 'Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING, TRAIT.MERCURIAL_TENDENCIES]
  });
  const evolveStart = (result) => result.steps.filter((step) => step.skill === 'Evolve')[1].start;

  assert.equal(evolveStart(baseline) - evolveStart(reduced), 2500);
  const procs = reduced.events.filter((event) => event.type === 'proc' && event.name === 'Mercurial Tendencies');

  assert.equal(procs.length, 1);
  assert.equal(procs[0].cooldownReduction, 2.5);
});

test('Willing Host and Symbiotic Synergy apply their damage windows', () => {
  const selectedMorphSkillIds = [76815, 76866, 76954];
  const baselineMorph = simulate('Amalgam', [76815], {
    selectedMorphSkillIds,
    target: { conditions: {} }
  });
  const symbioticMorph = simulate('Amalgam', [76815], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY],
    target: { conditions: {} }
  });
  const pierceDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Offensive Protocol: Pierce')
      .damage;

  assert.ok(Math.abs(pierceDamage(symbioticMorph) / pierceDamage(baselineMorph) - 1.33) < 1e-12);

  const baselineFollowup = simulate('Amalgam', [76815, 'Puncturing Jab'], {
    selectedMorphSkillIds,
    target: { conditions: {} }
  });
  const willingFollowup = simulate('Amalgam', [76815, 'Puncturing Jab'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.WILLING_HOST],
    target: { conditions: {} }
  });
  const punctureDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab').damage;

  assert.ok(Math.abs(punctureDamage(willingFollowup) / punctureDamage(baselineFollowup) - 1.05) < 1e-12);

  const reset = simulate('Amalgam', [76815, 'Evolve', 76815], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY]
  });
  const morphSteps = reset.steps.filter((step) => step.skill === 'Offensive Protocol: Pierce');
  const evolveStep = reset.steps.find((step) => step.skill === 'Evolve');

  assert.equal(morphSteps[1].start, evolveStep.end);
});

test('Double Helix gives Evolve two charges and doubles its attribute bonus', () => {
  const config = {
    selectedMorphSkillIds: [76815, 77285, 77358],
    selectedTraitIds: [TRAIT.DOUBLE_HELIX],
    stats: {
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000
    },
    target: { conditions: {} }
  };
  const charges = simulate('Amalgam', ['Evolve', 'Evolve'], config);
  const evolveSteps = charges.steps.filter((step) => step.skill === 'Evolve');

  assert.equal(evolveSteps.length, 2);
  assert.equal(evolveSteps[1].start, evolveSteps[0].end);

  const baseline = simulate('Amalgam', [{ type: 'wait', durationMs: 750 }, 'Puncturing Jab'], config);
  const evolved = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], config);
  const puncture = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

  assert.ok(Math.abs(puncture(evolved).damage / puncture(baseline).damage - 1.2) < 1e-12);
});

test('Evolve scales only its eligible static attribute pool', () => {
  const pool = {
    Power: 1000,
    Precision: 1000,
    Toughness: 1000,
    Vitality: 1000,
    Ferocity: 1000,
    'Condition Damage': 1000,
    Expertise: 1000,
    Concentration: 1000,
    'Healing Power': 1000
  };
  const attributes = [
    'power',
    'precision',
    'toughness',
    'vitality',
    'ferocity',
    'conditionDamage',
    'expertise',
    'concentration',
    'healingPower'
  ];
  const resolved = Object.fromEntries(attributes.map((attribute) => [attribute, 1500]));
  const context = (traits) => ({
    traits: new Set(traits),
    config: { amalgamEvolveAttributePool: pool },
    runtime: {
      profession: {
        specialization: {
          kind: 'Amalgam',
          state: { evolvedUntil: 10 }
        }
      }
    },
    time: 1
  });

  assert.deepEqual(
    amalgamAttributeRules.modifyAttributes(context([]), resolved),
    Object.fromEntries(attributes.map((attribute) => [attribute, 1600]))
  );
  assert.deepEqual(
    amalgamAttributeRules.modifyAttributes(context([TRAIT.DOUBLE_HELIX]), resolved),
    Object.fromEntries(attributes.map((attribute) => [attribute, 1700]))
  );
});

test('Amalgam app config excludes temporary attributes from Evolve', () => {
  const canonical = createEngineerBuildDefaults();

  canonical.specializations = [
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '3-3-2' },
    { name: 'Amalgam', traits: '2-2-3' }
  ];
  const app = {
    build: toApplicationBuild(canonical),
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  engineerAppAdapter.recalculate(app);
  const config = engineerAppAdapter.simulationConfig(app);

  assert.deepEqual(config.amalgamEvolveAttributePool, app.attributeData.amalgamEvolveAttributePool);
  assert.equal(config.stats.ferocity - config.amalgamEvolveAttributePool.Ferocity, 150);
});

test('Amalgam food comparisons use the recalculated Evolve attribute pool', () => {
  const canonical = createEngineerBuildDefaults();

  canonical.food = 'Plate of Coq Au Vin with Salsa';
  canonical.specializations = [
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '3-3-2' },
    { name: 'Amalgam', traits: '2-2-3' }
  ];
  const app = {
    build: toApplicationBuild(canonical),
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  engineerAppAdapter.recalculate(app);
  const request = engineerAppAdapter.modifierContributionRequest(app);
  const comparison = request.comparisons.find(({ modifier }) => modifier.id === `Food:${canonical.food}`);

  assert.equal(
    request.baseConfig.amalgamEvolveAttributePool.Power - comparison.config.amalgamEvolveAttributePool.Power,
    100
  );
  assert.equal(
    request.baseConfig.amalgamEvolveAttributePool.Precision - comparison.config.amalgamEvolveAttributePool.Precision,
    70
  );
});

test('Thorns damaging-field assumption creates six one-second retaliations', () => {
  const selectedMorphSkillIds = [77103, 77104, 76705];
  const inactive = simulate('Amalgam', [77104], {
    selectedMorphSkillIds
  });

  assert.equal(
    inactive.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Thorns Retaliation'),
    false
  );

  const active = simulate(
    'Amalgam',
    ['Evolve', 77104],
    {
      selectedMorphSkillIds,
      professionAssumptions: { inDamagingField: true }
    },
    observationTail(6000)
  );
  const retaliation = active.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Thorns Retaliation'
  );

  assert.equal(retaliation.length, 6);
  assert.ok(retaliation.every((event) => event.coefficient === 0.5));
  assert.deepEqual(
    retaliation.slice(1).map((event, index) => Number((event.at - retaliation[index].at).toFixed(3))),
    Array(5).fill(1)
  );
  assert.equal(
    active.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Rapacious Strain').length,
    6
  );
  assert.equal(
    active.endState.profession.thornsUntil,
    active.steps.find((step) => step.skill === 'Defensive Protocol: Thorns').end / 1000 + 6
  );
});

test('Rapacious Strain follows Flux State packets beyond its half-second ICD', () => {
  const result = simulate('Amalgam', ['Evolve', 'Flux State', { type: 'wait', durationMs: 7000 }], {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Bomb Kit', 'Flux State'],
    selectedMorphSkillIds: [77103, 77104, 76705],
    target: { conditions: {} }
  });
  const rapacious = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Rapacious Strain'
  );

  // Flux State's initial packet plus twelve 520 ms field packets each clear
  // Rapacious Strain's strict 500 ms ICD while both strain states are active.
  assert.equal(rapacious.length, 13);
  assert.deepEqual(
    rapacious.slice(1).map((event, index) => Number((event.at - rapacious[index].at).toFixed(3))),
    Array(12).fill(0.52)
  );
});

test('Plasmatic State models both phases as one cast', () => {
  const result = simulate('Amalgam', ['Plasmatic State', 'Puncturing Jab'], {
    boons: { quickness: true },
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Plasmatic State', 'Flux State'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const step = result.steps.find((step) => step.skill === 'Plasmatic State');
  const following = result.steps.find((step) => step.skill === 'Puncturing Jab');

  assert.equal(step.end - step.start, 960);
  assert.equal(following.start - step.start, 960);
  const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Plasmatic State');

  assert.equal(Math.round((action.rechargeReadyAt - action.at) * 1000), 25_480);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Plasmatic State').length,
    2
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Plasmatic State')
      .map((event) => Math.round((event.at - step.start / 1000) * 1000)),
    [427, 787]
  );
  const firstPacket = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Plasmatic State'
  );

  assert.ok(Math.abs(result.endState.profession.plasmaticStateUntil - firstPacket.at - 6) < 1e-12);
});
