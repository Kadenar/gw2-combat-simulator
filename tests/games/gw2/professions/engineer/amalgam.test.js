import { attributeSourcePool } from '#gw2/platform/builds/attribute-inputs.js';
import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { createEngineerBuildDefaults, toApplicationBuild } from '#gw2/professions/engineer/build/build.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { amalgamCastAvailability } from '#gw2/professions/engineer/specializations/amalgam/mechanics/availability.js';
import { amalgamResolverEventReactions } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-effects.js';
import { amalgamModifiers } from '#gw2/professions/engineer/specializations/amalgam/modifiers.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { amalgamMaximumAmmo } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import { createMaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { test } from 'node:test';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
  selectedMorphSkillIds: [77103, 77203, 76954],
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createObservedProfessionSimulator(engineerProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('Amalgam resolver procs honor positive poison fields and zero strike coefficients', () => {
  // Minimal resolver inputs isolate the authoring contract without a full morph rotation.
  for (const [coefficient, duration, stacks] of [
    [0.9, 7, 3],
    [0, 1, 1]
  ]) {
    const catalog = applyBalanceProfilePatch(engineerCatalog, {
      balanceProfiles: {
        [TRAIT.CARBOLIC_COMPOSITION]: { effects: [{ type: 'condition', duration, stacks }] },
        [PROFILE.rapaciousStrain]: {
          effects: [{ type: 'strike', coefficient }]
        }
      }
    });
    const conditions = [];
    const context = {
      procs: createProcRegistry(() => context),
      helpers: catalog,
      traits: new Set([TRAIT.CARBOLIC_COMPOSITION]),
      profession: { core: {}, specialization: { kind: 'Amalgam', state: { evolvedUntil: 10, rapaciousUntil: 10 } } },
      queue: new StableEventQueue(),
      effects: captureEffectEmissions({
        submit(event, delivery) {
          if (delivery.settlement === 'reaction') conditions.push(event);
          else context.queue.enqueue(event);
          return event;
        }
      }).effects
    };
    bindTriggerPoints(context, engineerProfession, { specialization: 'Amalgam' });
    const event = {
      type: 'damage',
      at: 0,
      coefficient: 1,
      actorType: 'player',
      skillId: 77103,
      skillName: 'Offensive Protocol: Shred'
    };
    amalgamResolverEventReactions.damage(context, event);
    assert.equal(conditions[0].duration, duration);
    assert.equal(conditions[0].stacks, stacks);
    assert.equal(context.queue.dequeue().coefficient, coefficient);
  }
});

test('Rapacious with zero ICD cannot trigger itself but still triggers Carbolic Composition', () => {
  const catalog = applyBalanceProfilePatch(engineerCatalog, {
    balanceProfiles: {
      [PROFILE.rapaciousStrain]: { fields: { internalCooldown: 0 } }
    }
  });
  const conditions = [];
  const context = {
    procs: createProcRegistry(() => context),
    helpers: catalog,
    traits: new Set([TRAIT.CARBOLIC_COMPOSITION]),
    queue: new StableEventQueue(),
    profession: { core: {}, specialization: { kind: 'Amalgam', state: { evolvedUntil: 10, rapaciousUntil: 10 } } },
    effects: captureEffectEmissions({
      submit(event, delivery) {
        if (delivery.settlement === 'reaction') conditions.push(event);
        else context.queue.enqueue(event);
        return event;
      }
    }).effects
  };
  bindTriggerPoints(context, engineerProfession, { specialization: 'Amalgam' });
  amalgamResolverEventReactions.damage(context, {
    type: 'damage',
    at: 1,
    coefficient: 1,
    actorType: 'player',
    skillId: 77103,
    skillName: 'Offensive Protocol: Shred'
  });
  const proc = context.queue.dequeue();
  // Disabling the cooldown isolates recursion prevention from timing gates.
  amalgamResolverEventReactions.damage(context, proc);
  assert.equal(context.queue.length, 0);
  assert.ok(conditions.some((condition) => condition.triggeredBy === 'Rapacious Strain'));
});

test('Amalgam traits activate on morph and Evolve chronology', () => {
  const result = simulate('Amalgam', [77103, 77104, 76705, 'Evolve', 'Grenade Kit', 'Shrapnel Grenade'], {
    selectedSkillIds: [5857, 5805, 5927, 77209, 76993],
    selectedMorphSkillIds: [77103, 77104, 76705],
    selectedTraitIds: [TRAIT.WILLING_HOST, TRAIT.HARDENED_CHROME, TRAIT.CARBOLIC_COMPOSITION, TRAIT.NEW_GENES]
  });

  assert.equal(result.warnings.length, 0);
  assert.ok(observedRuntime(result).profession.specialization.state.willingHostUntil > 0);
  assert.ok(observedRuntime(result).profession.specialization.state.evolvedUntil > 0);
  assert.equal(
    observedRuntime(result).profession.specialization.state.rapaciousUntil,
    observedRuntime(result).profession.specialization.state.evolvedUntil
  );
  assert.equal(
    observedRuntime(result).profession.specialization.state.predatorUntil,
    observedRuntime(result).profession.specialization.state.evolvedUntil
  );
  assert.equal(
    observedRuntime(result).profession.specialization.state.titanicUntil,
    observedRuntime(result).profession.specialization.state.evolvedUntil
  );
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
    attributeInputs: baseAttributeInputs({
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000
    })
  };
  const baseline = simulate('Amalgam', [{ type: 'wait', durationMs: 750 }, 'Puncturing Jab'], config);
  const evolved = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], config);
  const puncture = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

  assertFlooredDamageMultiplier(puncture(evolved).damage, puncture(baseline).damage, 1.1);
  assert.equal(
    evolved.planningState.profession.evolvedUntil,
    evolved.steps[0].start / 1000 + ((evolved.steps[0].end - evolved.steps[0].start) / 1000) * (520 / 640) + 8
  );
});

test("Sharpshooter derives bleeding damage from Evolve's Power bonus", () => {
  const config = {
    selectedMorphSkillIds: [76815, 77285, 77358],
    selectedTraitIds: [TRAIT.SHARPSHOOTER, TRAIT.DOUBLE_HELIX],
    attributeInputs: baseAttributeInputs({
      power: 2000,
      conditionDamage: 1000,
      expertise: 0
    }),
    target: { conditions: {} }
  };
  const result = simulate(
    'Amalgam',
    ['Evolve', 'Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 2000 }],
    config
  );
  const bleed = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel Grenade' && event.condition === 'Bleeding'
  );

  // Double Helix raises eligible Power from 2000 to 2400; Sharpshooter then
  // replaces bleeding's condition damage with two-thirds of that final Power.
  assert.ok(bleed);
  // Select a complete interval because shared partial packets attribute rounded integer shares.
  assert.equal(bleed.damageTicks.find((tick) => tick.fraction === 1).damage, 118 * bleed.stacks);
});

test('Evolve cannot raise condition duration above the global cap', () => {
  const result = simulate(
    'Amalgam',
    ['Evolve', 'Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 13000 }],
    {
      selectedSkillIds: [5857, 5805, 5927, 5812, 76993],
      selectedMorphSkillIds: [77103, 77104, 76705],
      selectedTraitIds: [TRAIT.SERRATED_STEEL],
      attributeInputs: baseAttributeInputs({ expertise: 1500 }),
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
  assert.equal(result.planningState.profession.berserkerUntil, result.planningState.profession.evolvedUntil);

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
    attributeInputs: baseAttributeInputs({ precision: 4000, ferocity: 0 }),
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

test('Mercurial Tendencies reduces Evolve recharge after control', () => {
  const selectedMorphSkillIds = [76815, 76866, 76954];
  const baseline = simulate('Amalgam', ['Evolve', 76815, 'Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING]
  });
  const reduced = simulate('Amalgam', ['Evolve', 76815, 'Evolve'], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING, TRAIT.MERCURIAL_TENDENCIES]
  });
  const evolveStart = (result) => result.steps.filter((step) => step.skillId === ID.EVOLVE_BASE)[1].start;

  assert.equal(evolveStart(baseline) - evolveStart(reduced), 2000);
  const proc = reduced.events.find((event) => event.type === 'proc' && event.name === 'Mercurial Tendencies');
  assert.equal(proc.cooldownReduction, 2);
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

  assertFlooredDamageMultiplier(pierceDamage(symbioticMorph), pierceDamage(baselineMorph), 1.33);

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

  assertFlooredDamageMultiplier(punctureDamage(willingFollowup), punctureDamage(baselineFollowup), 1.05);

  const reset = simulate('Amalgam', [76815, 'Evolve', 76815], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY]
  });
  const morphSteps = reset.steps.filter((step) => step.skill === 'Offensive Protocol: Pierce');
  const evolveStep = reset.steps.find((step) => step.skillId === ID.EVOLVE_BASE);

  assert.equal(morphSteps[1].start, evolveStep.end);
});

test('Symbiotic Synergy boosts Thorns retaliation for every protocol slot', () => {
  // Retaliation retains its Morph identity after activation, so the trait boosts both immediate and delayed hits.
  for (const [slot, skillId] of [
    ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163,
    ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104,
    ID.DEFENSIVE_PROTOCOL_THORNS
  ].entries()) {
    const selectedMorphSkillIds = [...baseConfig.selectedMorphSkillIds];
    selectedMorphSkillIds[slot] = skillId;
    const config = {
      selectedMorphSkillIds,
      professionAssumptions: { inDamagingField: true },
      target: { conditions: {} }
    };
    const rotation = [skillId, 'Puncturing Jab'];
    const baseline = simulate('Amalgam', rotation, config, observationTail(6000));
    const traited = simulate(
      'Amalgam',
      rotation,
      { ...config, selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY] },
      observationTail(6000)
    );
    assert.deepEqual(baseline.warnings, []);
    assert.deepEqual(traited.warnings, []);
    const damageEvents = (result, name) =>
      result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === name);
    // Both Thorns components use profession-mechanic strength; retaliation's half coefficient sets their ratio.
    for (const result of [baseline, traited]) {
      const initial = damageEvents(result, 'Initial Damage')[0];
      for (const hit of damageEvents(result, 'Thorns Retaliation')) {
        assert.equal(hit.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
        assertFlooredDamageMultiplier(hit.damage, initial.damage, 0.5);
      }
    }

    const retaliation = damageEvents(traited, 'Thorns Retaliation');
    assert.ok(retaliation.length > 0);
    assert.ok(retaliation.some((event) => event.at > traited.steps[0].end / 1000));
    for (const event of retaliation) {
      const original = damageEvents(baseline, 'Thorns Retaliation').find((hit) => hit.at === event.at);
      assert.ok(original);
      assert.equal(event.skillId, skillId);
      assertFlooredDamageMultiplier(event.damage, original.damage, 1.33);
    }

    assertFlooredDamageMultiplier(
      damageEvents(traited, 'Initial Damage')[0].damage,
      damageEvents(baseline, 'Initial Damage')[0].damage,
      1.33
    );
    assert.equal(damageEvents(traited, 'Puncturing Jab')[0].damage, damageEvents(baseline, 'Puncturing Jab')[0].damage);
  }
});

test('Double Helix gives Evolve two charges and doubles its attribute bonus', () => {
  const config = {
    selectedMorphSkillIds: [76815, 77285, 77358],
    selectedTraitIds: [TRAIT.DOUBLE_HELIX],
    attributeInputs: baseAttributeInputs({
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000
    }),
    target: { conditions: {} }
  };
  const charges = simulate('Amalgam', ['Evolve', 'Evolve'], config);
  const evolveSteps = charges.steps.filter((step) => step.skillId === ID.EVOLVE_DOUBLE_HELIX);

  assert.equal(evolveSteps.length, 2);
  assert.ok(evolveSteps[1].start < evolveSteps[0].end + 40000);

  const baseline = simulate('Amalgam', [{ type: 'wait', durationMs: 750 }, 'Puncturing Jab'], config);
  const evolved = simulate('Amalgam', ['Evolve', 'Puncturing Jab'], config);
  const puncture = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

  assertFlooredDamageMultiplier(puncture(evolved).damage, puncture(baseline).damage, 1.2);
});

test('Evolve aliases use only the trait-selected identity and share its charges and recharge', () => {
  // Alternating API IDs must never create an extra cooldown or ammo pool.
  for (const selectedTraitIds of [[], [TRAIT.DOUBLE_HELIX]]) {
    const traited = selectedTraitIds.length > 0;
    const skillId = traited ? ID.EVOLVE_DOUBLE_HELIX : ID.EVOLVE_BASE;
    const inactive = engineerCatalog.skillsById.get(traited ? ID.EVOLVE_BASE : ID.EVOLVE_DOUBLE_HELIX);
    assert.equal(
      amalgamCastAvailability(
        { config: { specialization: 'Amalgam', selectedTraitIds }, traits: new Set(selectedTraitIds) },
        inactive
      ).ready,
      false
    );
    const capacity = createMaximumAmmoContext(() => ({}), new Set(selectedTraitIds), engineerCatalog);
    assert.equal(amalgamMaximumAmmo(capacity, inactive, Number(inactive.ammo || 0)), 0);
    const result = simulate('Amalgam', [ID.EVOLVE_DOUBLE_HELIX, ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX], {
      selectedTraitIds
    });
    assert.deepEqual(result.warnings, []);
    assert.ok(result.steps.every((step) => step.skillId === skillId && !step.invalid));
    assert.deepEqual([...observedRuntime(result).cooldownController.cooldownSkillIds()], [skillId]);
    assert.deepEqual([...observedRuntime(result).cooldownController.ammoSkillIds()], traited ? [skillId] : []);
    const [first, second, third] = result.steps;
    // Both Evolve identities recover from activation rather than cast completion.
    assert.ok(third.start >= first.start + 32000);
    if (traited) {
      assert.equal(observedRuntime(result).cooldownController.readAmmo(skillId).maximum, 2);
      assert.ok(second.start < first.start + 32000);
    } else {
      assert.ok(second.start >= first.start + 32000);
    }

    for (const name of ['Evolve', 'Evolve (Base)', 'Evolve (Double Helix)']) {
      const named = simulate('Amalgam', [name], { selectedTraitIds });
      assert.deepEqual(named.warnings, []);
      assert.equal(named.steps[0].skillId, skillId);
    }
  }
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
    catalog: engineerCatalog,
    traits: new Set(traits),
    config: {
      attributeInputs: {
        weaponSets: [0, 1].map(() => ({
          commonTotals: baseAttributeInputs().weaponSets[0].commonTotals,
          conversionPool: pool,
          sources: {}
        }))
      }
    },
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
    amalgamModifiers.modifyAttributes(context([]), resolved),
    Object.fromEntries(attributes.map((attribute) => [attribute, 1600]))
  );
  assert.deepEqual(
    amalgamModifiers.modifyAttributes(context([TRAIT.DOUBLE_HELIX]), resolved),
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

  assert.deepEqual(attributeSourcePool(config, 'common'), app.attributeData.attributeSeed.conversionPool);
  assert.equal(app.attributeData.attributes.Ferocity.final - attributeSourcePool(config, 'common').Ferocity, 150);
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
    attributeSourcePool(request.baseConfig, 'common').Power - attributeSourcePool(comparison.config, 'common').Power,
    100
  );
  assert.equal(
    attributeSourcePool(request.baseConfig, 'common').Precision -
      attributeSourcePool(comparison.config, 'common').Precision,
    70
  );
});

test('Thorns retaliation requires the damaging-field assumption', () => {
  const selectedMorphSkillIds = [77103, 77104, 76705];
  // Vary only the assumption so the same successful cast proves the outgoing retaliation gate.
  for (const professionAssumptions of [undefined, {}, { inDamagingField: false }, { inDamagingField: true }]) {
    const result = simulate(
      'Amalgam',
      [77104],
      { selectedMorphSkillIds, professionAssumptions },
      observationTail(6000)
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Thorns Retaliation'),
      professionAssumptions?.inDamagingField === true
    );
  }
});

test('Amalgam build assumptions map to the canonical runtime configuration', () => {
  // Exercise the application boundary that supplies the runtime gate from persisted build assumptions.
  for (const inDamagingField of [true, false]) {
    const canonical = createEngineerBuildDefaults();
    canonical.specializations = [
      { name: 'Explosives', traits: '3-2-3' },
      { name: 'Firearms', traits: '3-3-2' },
      { name: 'Amalgam', traits: '2-2-3' }
    ];
    canonical.assumptions.inDamagingField = inDamagingField;
    const app = {
      adapter: engineerAppAdapter,
      build: toApplicationBuild(canonical),
      skillByName: engineerCatalog.skillsByName,
      attributeWeaponSet: 1
    };
    engineerAppAdapter.recalculate(app);
    const config = engineerAppAdapter.simulationConfig(app);

    assert.equal(config.professionAssumptions.inDamagingField, inDamagingField);
    assert.equal(Object.hasOwn(config, 'assumptions'), false);
    assert.equal(Object.hasOwn(config, 'inDamagingField'), false);
  }
});
