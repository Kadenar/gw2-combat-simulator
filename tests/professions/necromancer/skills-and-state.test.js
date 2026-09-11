import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { isSlotSkillSelectable } from '#gw2/app/build/state/skill-selection.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { skillBreakdownRows } from '#gw2/app/results/result-tables.js';
import { weaponSkills } from '#gw2/app/rotation/palette/model.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  actualNecromancerLifeForceCost,
  createNecromancerCoreState,
  normalizedNecromancerLifeForceCost
} from '#gw2/professions/necromancer/core/state.js';
import { addSoulShards, purgeTimedState } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/core/profiles.js';
import { REAPER_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { RITUALIST_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 2000,
    ferocity: 500,
    conditionDamage: 1200,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: {
      Chilled: true,
      Vulnerability: 25
    }
  }
});

const simulate = createProfessionSimulator(necromancerProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

const applyNecromancerPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(necromancerCatalog, patch), patch);

const authoringNecromancerProfession = withActivePatchPreview(necromancerProfession);

// The unsupported boon-removal variants must not add extra damage packets.
test('Spinal Shivers emits one zero-boon strike and one Chill application', () => {
  for (const boonless of [true, false]) {
    const result = simulate('Core', ['Spinal Shivers'], {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Focus',
      target: { boonless }
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillId === ID.SPINAL_SHIVERS)
        .map((event) => event.coefficient),
      [2.5]
    );
    assert.deepEqual(
      result.resolvedEvents
        .filter(
          (event) => event.type === 'condition' && event.skillId === ID.SPINAL_SHIVERS && event.condition === 'Chilled'
        )
        .map((event) => [event.stacks, event.duration]),
      [[1, 5]]
    );
  }
});

// Each producer enters canonical condition resolution once, retaining its source and natural lifetime.
test('Necromancer Chill producers retain duration scaling and chained trait attribution', () => {
  for (const [specialization, rotation, selectedTraitIds, skillName, sourceId, duration] of [
    ['Core', ['Spinal Shivers'], [], 'Spinal Shivers', ID.SPINAL_SHIVERS, 5],
    ['Reaper', ['Spectral Grasp'], [], 'Spectral Grasp', ID.SPECTRAL_GRASP, 4],
    ['Reaper', ['"Suffer!"'], [], '"Suffer!"', ID.SUFFER, 3],
    ['Core', ['Death Shroud', 'Life Transfer'], [TRAIT.TRANSFUSION], 'Lesser Chilblains', TRAIT.TRANSFUSION, 2],
    [
      'Reaper',
      ["Reaper's Shroud", 'Infusing Terror', 'Terrify'],
      [TRAIT.SHIVERS_OF_DREAD],
      'Shivers of Dread',
      TRAIT.SHIVERS_OF_DREAD,
      2
    ]
  ]) {
    const result = simulate(specialization, rotation, {
      initialResource: 100,
      selectedTraitIds: [
        ...selectedTraitIds,
        TRAIT.BITTER_CHILL,
        ...(specialization === 'Reaper' ? [TRAIT.DEATHLY_CHILL] : [])
      ],
      stats: { expertise: 750 },
      target: { conditions: { Chilled: false, Vulnerability: 0 } }
    });
    assert.deepEqual(result.warnings, []);
    const chill = result.resolvedEvents.find((event) => event.condition === 'Chilled' && event.skillName === skillName);
    assert.ok(chill, skillName);
    assert.equal(chill.type, 'condition');
    assert.equal(chill.stacks, 1);
    assert.equal(chill.duration, duration);
    assert.equal(chill.effectiveDuration, duration * 1.5);
    assert.equal(chill.naturalExpiresAt, chill.at + duration * 1.5);
    assert.equal(chill.sourceId, sourceId);
    assert.equal(chill.actorType, selectedTraitIds.length ? 'effect' : 'player');
    for (const traitId of [TRAIT.BITTER_CHILL, ...(specialization === 'Reaper' ? [TRAIT.DEATHLY_CHILL] : [])]) {
      const followup = result.resolvedEvents.find(
        (event) => event.sourceId === traitId && event.triggeredBy === skillName
      );
      assert.ok(followup, `${skillName}: ${traitId}`);
      assert.equal(followup.at, chill.at);
      assert.ok(result.resolvedEvents.indexOf(followup) > result.resolvedEvents.indexOf(chill));
    }

    if (sourceId === TRAIT.TRANSFUSION) {
      assert.equal(chill.skillId, ID.LESSER_CHILBLAINS);
      assert.equal(chill.triggeredBy, 'Life Transfer');
    }
  }
});

// Both trait strikes must precede their Chill-driven carapace and Vulnerability gains at the same timestamp.
test('Chill of Death and Chilling Nova preserve sibling strike ordering', () => {
  const selectedTraitIds = [TRAIT.CHILL_OF_DEATH, TRAIT.CHILLING_NOVA, TRAIT.BITTER_CHILL, TRAIT.DEATHLY_CHILL];
  const config = {
    stats: { precision: 3000, expertise: 750 },
    target: { health: 1000000, startingHealthFraction: 0.4, conditions: { Chilled: true, Vulnerability: 0 } }
  };
  const rotation = ['Gravedigger', 'Gravedigger'];
  const baseline = simulate('Reaper', rotation, { ...config, selectedTraitIds });
  const result = simulate('Reaper', rotation, {
    ...config,
    selectedTraitIds: [...selectedTraitIds, TRAIT.CORRUPTERS_FERVOR, TRAIT.DEADLY_STRENGTH]
  });
  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(result.warnings, []);
  const firstChillIndex = result.resolvedEvents.findIndex((event) => event.condition === 'Chilled');
  assert.ok(firstChillIndex >= 0);
  for (const traitId of [TRAIT.CHILL_OF_DEATH, TRAIT.CHILLING_NOVA]) {
    const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.sourceId === traitId);
    const chill = result.resolvedEvents.find((event) => event.condition === 'Chilled' && event.sourceId === traitId);
    assert.ok(strike);
    assert.ok(chill);
    assert.equal(strike.at, chill.at);
    assert.ok(result.resolvedEvents.indexOf(strike) < firstChillIndex);
    assert.equal(
      strike.damage,
      baseline.resolvedEvents.find((event) => event.type === 'damage' && event.sourceId === traitId).damage
    );
    assert.equal(chill.effectiveDuration, (traitId === TRAIT.CHILLING_NOVA ? 2 : 5) * 1.5);
  }

  const nextStrike = (simulation) =>
    simulation.resolvedEvents.findLast((event) => event.type === 'damage' && event.skillId === ID.GRAVEDIGGER);
  assert.ok(nextStrike(result).damage > nextStrike(baseline).damage);
});

test('Necromancer modules expose isolated balance-profile authoring', () => {
  const modules = new Map(authoringNecromancerProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const profile = (moduleId, profileId) => {
    const module = modules.get(moduleId);

    return [...module.balanceProfiles, ...module.skillVariants].find((entry) => entry.id === profileId);
  };

  const bloodFiend = profile('Core', NECROMANCER_CORE_BALANCE_PROFILE_IDS.bloodFiendAttack);
  const shade = profile('Scourge', SCOURGE_BALANCE_PROFILE_IDS.shade);
  const blight = profile('Harbinger', HARBINGER_BALANCE_PROFILE_IDS.resources);
  const spirit = profile('Ritualist', RITUALIST_BALANCE_PROFILE_IDS.anguish);
  const reaper = profile('Reaper', REAPER_BALANCE_PROFILE_IDS.resources);

  assert.equal(bloodFiend.profile.profileKind, 'skill-variant');
  assert.equal(bloodFiend.patchableFields.damagePerCoefficient, 4338);
  assert.equal(shade.profile.effects[0].coefficient, 0.666);
  assert.equal(blight.patchableFields.maximumStacks, 25);
  assert.equal(spirit.profile.effects[1].ticks.length, 7);
  assert.equal(reaper.patchableFields.lifeForceDrain, 4);
  assert.deepEqual(
    modules.get('Core').modifierRules.find((rule) => rule.id === 'necromancer.target-the-weak-critical-chance')
      .parameters,
    { criticalChancePerCondition: 0.02 }
  );
  assert.deepEqual(
    modules.get('Ritualist').modifierRules.find((rule) => rule.id === 'necromancer.anguish-conditional-damage')
      .parameters,
    { damagePerCondition: 0.02, controlledBonus: 0.2 }
  );

  const preview = applyNecromancerPatch({
    skills: {
      [ID.SPECTRAL_GRASP]: {
        effects: [{ effectIndex: 0, duration: { from: 4, to: 6 } }]
      },
      [ID.NIGHTMARE_WEAPON]: {
        effects: [
          {
            effectIndex: 0,
            allyStacks: { from: 3, to: 4 },
            audience: { maximumRecipients: { from: 5, to: 6 } }
          }
        ]
      },
      [ID.RIGOR_MORTIS]: {
        effects: [
          {
            effectIndex: 0,
            tickIndex: 0,
            coefficient: { from: 0.25, to: 0.3 }
          }
        ]
      }
    },
    balanceProfiles: {
      [SCOURGE_BALANCE_PROFILE_IDS.shade]: {
        effects: [
          {
            effectIndex: 0,
            coefficient: { from: 0.666, to: 0.7 }
          }
        ]
      },
      [HARBINGER_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 25, to: 30 } }
      },
      [RITUALIST_BALANCE_PROFILE_IDS.resources]: {
        fields: { pulseInterval: { from: 4, to: 3 } }
      }
    }
  });

  assert.equal(preview.skillsById.get(ID.NIGHTMARE_WEAPON).effects[0].allyStacks, 4);
  assert.equal(preview.skillsById.get(ID.SPECTRAL_GRASP).effects[0].duration, 6);
  assert.equal(necromancerCatalog.skillsById.get(ID.SPECTRAL_GRASP).effects[0].duration, 4);
  assert.equal(preview.skillsById.get(ID.NIGHTMARE_WEAPON).effects[0].audience.maximumRecipients, 6);
  assert.equal(preview.skillsById.get(ID.RIGOR_MORTIS).effects[0].ticks[0].coefficient, 0.3);
  assert.equal(preview.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade).effects[0].coefficient, 0.7);
  assert.equal(preview.balanceProfilesById.get(HARBINGER_BALANCE_PROFILE_IDS.resources).maximumStacks, 30);
  assert.equal(preview.balanceProfilesById.get(RITUALIST_BALANCE_PROFILE_IDS.resources).pulseInterval, 3);

  assert.equal(necromancerCatalog.skillsById.get(ID.NIGHTMARE_WEAPON).effects[0].allyStacks, 3);
  assert.equal(
    necromancerCatalog.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade).effects[0].coefficient,
    0.666
  );
  assert.equal(necromancerCatalog.balanceProfilesById.get(HARBINGER_BALANCE_PROFILE_IDS.resources).maximumStacks, 25);
});

test('Necromancer multi-hit skills use their configured packet timings', () => {
  const packetTail = observationTail(6000);
  const weepingShots = simulate(
    'Harbinger',
    ['Weeping Shots'],
    {
      boons: { quickness: true },
      primaryWeapon: 'Pistol'
    },
    packetTail
  );
  const vitalDraw = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Vital Draw'],
    { boons: { quickness: true } },
    packetTail
  );
  const taintedBolts = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Tainted Bolts'],
    { boons: { quickness: true } },
    packetTail
  );
  const darkBarrage = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Dark Barrage'],
    { boons: { quickness: true } },
    packetTail
  );
  const deathsCharge = simulate(
    'Reaper',
    ["Reaper's Shroud", "Death's Charge"],
    { boons: { quickness: true } },
    packetTail
  );
  const soulSpiral = simulate('Reaper', ["Reaper's Shroud", 'Soul Spiral'], { boons: { quickness: true } }, packetTail);
  const anguish = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish'], { boons: { quickness: true } }, packetTail);
  const wanderlust = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Wanderlust'],
    { boons: { quickness: true } },
    packetTail
  );
  const offsets = (result, skillName, skillId, type = 'damage') => {
    const start = result.steps.find((step) => step.skill === skillName)?.start;

    assert.notEqual(start, undefined, skillName);

    return result.events
      .filter((event) => event.type === type && event.skillId === skillId)
      .map((event) => Math.round(event.at * 1000 - start));
  };

  assert.deepEqual(offsets(weepingShots, 'Weeping Shots', ID.WEEPING_SHOTS), [240, 360, 520, 640, 760, 880]);
  assert.deepEqual(
    offsets(weepingShots, 'Weeping Shots', ID.WEEPING_SHOTS, 'condition'),
    [240, 360, 520, 640, 760, 840, 880]
  );
  assert.deepEqual(offsets(vitalDraw, 'Vital Draw', ID.VITAL_DRAW), [760, 1760, 2760]);
  assert.deepEqual(offsets(taintedBolts, 'Tainted Bolts', ID.TAINTED_BOLTS), [320, 600]);
  assert.deepEqual(offsets(taintedBolts, 'Tainted Bolts', ID.TAINTED_BOLTS, 'condition'), [320, 600]);
  assert.deepEqual(offsets(darkBarrage, 'Dark Barrage', ID.DARK_BARRAGE), [600, 680, 680, 800, 800, 800]);
  assert.deepEqual(offsets(darkBarrage, 'Dark Barrage', ID.DARK_BARRAGE, 'condition'), [600, 680, 680, 800, 800, 800]);
  assert.deepEqual(
    offsets(deathsCharge, "Death's Charge", ID.DEATHS_CHARGE),
    [40, 160, 280, 400, 520, 640, 760, 880, 960, 1160]
  );
  assert.deepEqual(
    offsets(soulSpiral, 'Soul Spiral', ID.SOUL_SPIRAL),
    [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040]
  );
  assert.deepEqual(
    offsets(soulSpiral, 'Soul Spiral', ID.SOUL_SPIRAL, 'condition'),
    [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040]
  );
  assert.deepEqual(offsets(anguish, 'Anguish', ID.ANGUISH), [1360, 1520, 1560, 1640, 1680, 1720, 1760]);
  assert.deepEqual(offsets(wanderlust, 'Wanderlust', ID.WANDERLUST), [720, 2760, 3760, 4760, 5760]);
  assert.deepEqual(offsets(wanderlust, 'Wanderlust', ID.WANDERLUST, 'condition'), [2760, 3760, 4760, 5760]);
});

test('Wanderlust Vulnerability affects only its final two field hits', () => {
  const result = simulate('Ritualist', ["Ritualist's Shroud", 'Wanderlust', { type: 'wait', durationMs: 6000 }], {
    initialResource: 100,
    target: { armor: 2597, conditions: {} }
  });
  const fieldHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Spirit of Wanderlust - Initial Attack'
  );
  const vulnerability = result.events.find(
    (event) => event.type === 'condition' && event.skillId === ID.WANDERLUST && event.condition === 'Vulnerability'
  );

  assert.equal(fieldHits.length, 4);
  assert.equal(vulnerability.at, fieldHits[1].at);
  assert.ok(fieldHits[1].eventOrder < vulnerability.eventOrder);
  assert.ok(Math.abs(fieldHits[1].damage / fieldHits[0].damage - 1) < 1e-12);
  assert.ok(Math.abs(fieldHits[2].damage / fieldHits[0].damage - 1.04) < 1e-12);
  assert.ok(Math.abs(fieldHits[3].damage / fieldHits[0].damage - 1.04) < 1e-12);
});

test('Vital Draw grants nine percent life force for its three assumed hits', () => {
  const result = simulate('Harbinger', ['Harbinger Shroud', 'Vital Draw'], { initialResource: 20 });
  const states = result.events.filter((event) => event.type === 'necromancer.state');
  const gainIndex = states.findIndex((event) => event.reason === 'skill-life-force');

  // Compare adjacent resource snapshots so the contract remains independent of cast-duration drain.
  assert.equal(states[gainIndex].state.lifeForce - states[gainIndex - 1].state.lifeForce, 9);
});

test('Relic of Fireworks refreshes from qualifying Reaper Shroud skills', () => {
  const result = simulate('Reaper', ["Reaper's Shroud", 'Soul Spiral'], {
    initialResource: 100,
    relic: 'Fireworks'
  });
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.SOUL_SPIRAL && event.name === 'Soul Spiral'
  );

  assert.equal(procs.length, 12);
  assert.ok(procs.every((proc) => proc.sourceSkill === 'Soul Spiral'));
  assert.equal(procs[0].detail, 'activated');
  assert.ok(procs.slice(1).every((proc) => proc.detail === 'refreshed'));
  assert.equal(hits.length, 12);
  assert.ok(Math.abs(hits[1].damage / hits[0].damage - 1.07) < 1e-12);
});

test('Necromancer single-hit skills use their configured offsets', () => {
  const declarativeOffsets = new Map([
    [ID.DARK_PACT, 640],
    [ID.GRASPING_DEAD, 560],
    [ID.BLOOD_IS_POWER, 560],
    [ID.PUTRID_CURSE, 360],
    [ID.SIGNET_OF_SPITE, 560],
    [ID.BLOOD_CURSE, 360],
    [ID.RENDING_CURSE, 440],
    [ID.NECROTIC_STAB, 160],
    [ID.ENFEEBLING_BLOOD, 1200],
    [ID.CHILLING_SCYTHE, 720],
    [ID.GRAVEDIGGER, 840],
    [ID.FADING_TWILIGHT, 520],
    [ID.OPPRESSIVE_COLLAPSE, 560],
    [ID.HARROWING_WAVE, 320],
    [ID.VILE_BLAST, 560],
    [ID.VICIOUS_SHOT, 360],
    [ID.DEVOURING_VISAGE, 480],
    [ID.DARK_SLASH, 480],
    [ID.ADDLE, 240],
    [ID.DEADLY_SLICE, 400],
    [ID.SINISTER_STAB, 520],
    [ID.ISOLATE, 440],
    [ID.LIFE_SLASH, 400]
  ]);

  for (const [skillId, expectedOffset] of declarativeOffsets) {
    const skill = necromancerCatalog.skillsById.get(skillId);
    const strike = skill.effects.find((effect) => effect.type === 'strike');

    assert.equal(strike?.timingAnchor, 'castStart', skill.name);
    assert.equal(strike?.timingScale, 'cast', skill.name);
    assert.equal(Math.round(strike.ticks[0].atMs), expectedOffset, skill.name);
  }

  const devouringDarkness = simulate('Core', ['Devouring Darkness'], {
    boons: { quickness: true },
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.LINGERING_CURSE]
  });
  const essenceBlast = simulate('Ritualist', ["Ritualist's Shroud", 'Essence Blast'], { boons: { quickness: true } });
  const elixirs = simulate('Harbinger', ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition'], {
    boons: { quickness: true },
    initialBlight: 25,
    selectedSkills: ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition']
  });
  const blightSkills = simulate('Harbinger', ['Harbinger Shroud', 'Devouring Cut', 'Voracious Arc'], {
    boons: { quickness: true },
    initialBlight: 25
  });
  const manifestShade = simulate('Scourge', ['Manifest Sand Shade'], {
    boons: { quickness: true }
  });
  const customOffset = (result, skillName, skillId) => {
    const start = result.steps.find((step) => step.skill === skillName)?.start;
    const hit = result.events.find((event) => event.type === 'damage' && event.skillId === skillId);

    assert.notEqual(start, undefined, skillName);
    assert.ok(hit, skillName);

    return Math.round(hit.at * 1000 - start);
  };

  assert.equal(customOffset(devouringDarkness, 'Devouring Darkness', ID.DEVOURING_DARKNESS), 480);
  assert.equal(customOffset(essenceBlast, 'Essence Blast', ID.ESSENCE_BLAST), 560);
  assert.equal(customOffset(elixirs, 'Elixir of Promise', ID.ELIXIR_OF_PROMISE), 400);
  assert.equal(customOffset(elixirs, 'Elixir of Risk', ID.ELIXIR_OF_RISK), 504);
  assert.equal(customOffset(elixirs, 'Elixir of Ambition', ID.ELIXIR_OF_AMBITION), 400);
  assert.equal(customOffset(blightSkills, 'Devouring Cut', ID.DEVOURING_CUT), 360);
  assert.equal(customOffset(blightSkills, 'Voracious Arc', ID.VORACIOUS_ARC), 800);
  assert.equal(customOffset(manifestShade, 'Manifest Sand Shade', ID.MANIFEST_SAND_SHADE), 440);
});

test('Elixir of Anguish applies Cripple and Swiftness for their exact durations', () => {
  const base = simulate('Harbinger', ['Elixir of Anguish'], {
    initialBlight: 0,
    selectedSkills: ['Elixir of Anguish']
  });
  const empowered = simulate('Harbinger', ['Elixir of Anguish'], {
    initialBlight: 5,
    selectedSkills: ['Elixir of Anguish']
  });
  const durations = (result) => ({
    cripple: result.resolvedEvents.find(
      (event) => event.skillId === ID.ELIXIR_OF_ANGUISH && event.condition === 'Crippled'
    )?.duration,
    swiftness: result.events.find((event) => event.skillId === ID.ELIXIR_OF_ANGUISH && event.kind === 'swiftness')
      ?.duration
  });

  assert.deepEqual(durations(base), { cripple: 5, swiftness: 10 });
  assert.deepEqual(durations(empowered), { cripple: 10, swiftness: 20 });
});

test('Signet of Spite follows its live passive and active profile', () => {
  const withSignet = simulate('Core', ['Rending Claws', 'Death Shroud', 'Life Blast'], {
    initialResource: 100,
    primaryWeapon: 'Axe',
    selectedSkills: ['Signet of Spite']
  });
  const withoutSignet = simulate('Core', ['Rending Claws', 'Death Shroud', 'Life Blast'], {
    initialResource: 100,
    primaryWeapon: 'Axe',
    selectedSkills: ['Blood Is Power']
  });
  const active = simulate('Core', ['Signet of Spite', 'Rending Claws'], {
    boons: { quickness: true },
    primaryWeapon: 'Axe',
    selectedSkills: ['Signet of Spite']
  });
  const damage = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === name)?.damage;
  const signetEvents = active.events.filter((event) => event.skillId === ID.SIGNET_OF_SPITE);
  const conditions = signetEvents
    .filter((event) => event.type === 'condition')
    .map((event) => [event.condition, event.stacks, event.duration]);

  assert.ok(damage(withSignet, 'Rending Claws') > damage(withoutSignet, 'Rending Claws'));
  assert.equal(damage(withSignet, 'Life Blast'), damage(withoutSignet, 'Life Blast'));
  assert.equal(damage(active, 'Rending Claws'), damage(withoutSignet, 'Rending Claws'));
  assert.equal(active.steps[0].fullCastMs, 880);
  assert.equal(necromancerCatalog.skillsById.get(ID.SIGNET_OF_SPITE).cooldown, 40);
  assert.equal(signetEvents.find((event) => event.type === 'damage')?.coefficient, 1);
  assert.deepEqual(conditions, [
    ['Bleeding', 2, 10],
    ['Poisoned', 2, 10],
    ['Torment', 2, 6],
    ['Crippled', 1, 10],
    ['Vulnerability', 5, 10],
    ['Weakness', 1, 10]
  ]);
  assert.equal(signetEvents.find((event) => event.type === 'blind')?.duration, 5);
  assert.deepEqual(
    signetEvents
      .filter((event) => event.type === 'condition' && event.condition === 'Vulnerability')
      .map((event) => [event.stacks, event.duration]),
    [[5, 10]]
  );
});

test('Manifest Sand Shade aliases load the one canonical Scourge behavior', () => {
  const canonical = simulate('Scourge', [ID.MANIFEST_SAND_SHADE], { initialResource: 100 });

  for (const aliasId of [42297, 46473, 46474]) {
    const result = simulate('Scourge', [aliasId], { initialResource: 100 });
    const action = result.events.find((event) => event.type === 'action');

    assert.equal(necromancerCatalog.skillsById.has(aliasId), false);
    assert.equal(action.skillId, ID.MANIFEST_SAND_SHADE);
    assert.equal(result.endState.profession.shades.length, canonical.endState.profession.shades.length);
    assert.equal(result.endState.profession.lifeForce, canonical.endState.profession.lifeForce);
    assert.deepEqual(result.warnings, canonical.warnings);
  }
});

test('core heals remain selectable and castable without requiring damage effects', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const build = { specialization: 'Core' };
  const app = { profession: necromancerProfession, build, activeCatalog: necromancerCatalog };

  // Heal slots remain usable even when their healing is outside the damage model.
  for (const name of ['Well of Blood', 'Consume Conditions']) {
    const skill = necromancerCatalog.skillsByName.get(name);
    assert.equal(skill.type, 'Heal', name);
    assert.equal(isSlotSkillSelectable(app, skill, 'Core'), true, name);
    assert.equal(adapter.isSkillAvailable(skill, { build, specialization: 'Core' }), true, name);
    const result = simulate('Core', [name]);
    assert.deepEqual(result.warnings, [], name);
    assert.ok(
      result.events.some((event) => event.type === 'action' && event.skillId === skill.id),
      name
    );
  }
});

test('catalog skills with simulated active effects have mechanics', () => {
  for (const skill of necromancerCatalog.skills) {
    // Healing and Signet of Undeath's revive do not need target-combat effects.
    if (skill.type === 'Heal' || skill.id === ID.SIGNET_OF_UNDEATH) continue;
    assert.equal(
      Boolean(
        skill.handlerId ||
        skill.effects.length ||
        skill.lifeForceGain ||
        skill.flipParentId != null ||
        skill.type === 'Action'
      ),
      true,
      `${skill.id} ${skill.name}`
    );
  }
});

test('Core Death Shroud drains life force and gates transformed skills', () => {
  const result = simulate(
    'Core',
    ['Death Shroud', 'Life Blast', { type: 'wait', durationMs: 1000 }, 'End Death Shroud'],
    { initialResource: 100 }
  );
  const invalid = simulate('Core', ['Life Blast', 'Death Shroud', 'Rending Claws'], {
    initialResource: 100,
    primaryWeapon: 'Axe'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeShroud, '');
  assert.ok(result.endState.profession.lifeForce < 97);
  assert.ok(result.strikeDamage > 0);
  assert.equal(invalid.warnings.length, 2);
  assert.match(invalid.warnings.join(' '), /Life Blast is unavailable/);
  assert.match(invalid.warnings.join(' '), /Rending Claws is unavailable/);
});

test('Reaper Shroud enforces its chain and four-percent drain', () => {
  const result = simulate(
    'Reaper',
    [
      "Reaper's Shroud",
      'Life Rend',
      'Life Slash',
      'Life Reap',
      { type: 'wait', durationMs: 1000 },
      "Exit Reaper's Shroud"
    ],
    { initialResource: 100 }
  );
  const skipped = simulate('Reaper', ["Reaper's Shroud", 'Life Reap'], {
    initialResource: 100
  });

  assert.deepEqual(result.warnings, []);
  assert.ok(result.endState.profession.lifeForce < 93);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Life Reap'));
  assert.match(skipped.warnings.join(' '), /Life Reap is unavailable/);
});

test('Death and Reaper shrouds drain a percentage of the maximum life-force pool', () => {
  const drainAfterOneSecond = (specialization, enter, exit) =>
    simulate(specialization, [enter, { type: 'wait', durationMs: 1000 }, exit], {
      initialResource: 100,
      selectedTraitIds: [TRAIT.SOUL_BATTERY]
    }).endState.profession.lifeForce;

  assert.equal(drainAfterOneSecond('Core', 'Death Shroud', 'End Death Shroud'), 116.4);
  assert.equal(drainAfterOneSecond('Reaper', "Reaper's Shroud", "Exit Reaper's Shroud"), 115.2);
});

test('life-force capacity is 69% of health and Soul Battery increases it by 20%', () => {
  const base = simulate('Core', [], {
    initialResource: 100,
    stats: { vitality: 1000 }
  }).endState.profession;
  const battery = simulate('Core', [], {
    initialResource: 100,
    stats: { vitality: 1000 },
    selectedTraitIds: [TRAIT.SOUL_BATTERY]
  }).endState.profession;

  assert.equal(base.maximumHealth, 19212);
  assert.equal(base.lifeForcePoolCapacity, 19212 * 0.69);
  assert.equal(battery.lifeForcePoolCapacity, base.lifeForcePoolCapacity * 1.2);
});

test('Alchemic Vigor increases Harbinger health and its physical life-force pool', () => {
  const core = simulate('Core', [], { stats: { vitality: 1000 } }).endState.profession;
  const harbinger = simulate('Harbinger', [], { stats: { vitality: 1000 } }).endState.profession;

  assert.equal(harbinger.maximumHealth, core.maximumHealth + 2400);
  assert.equal(harbinger.lifeForcePoolCapacity, harbinger.maximumHealth * 0.69);
});

test('Reaper greatsword chain is ordered and Chilling Scythe recharges Gravedigger', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const skills = weaponSkills({
    adapter,
    skills: necromancerCatalog.skills,
    build: {
      specialization: 'Reaper',
      weapons: ['Greatsword', ''],
      alternateWeapons: ['Axe', 'Focus'],
      specializations: [{ name: 'Reaper', traits: '1-1-1' }]
    },
    weaponData: {
      Greatsword: { wielding: '2h' },
      Axe: { wielding: '1h' },
      Focus: { wielding: '1h' }
    }
  });
  const result = simulate(
    'Reaper',
    ['Gravedigger', 'Dusk Strike', 'Fading Twilight', 'Chilling Scythe', 'Gravedigger'],
    {
      primaryWeapon: 'Greatsword',
      target: { conditions: {} }
    }
  );

  assert.deepEqual(
    skills.filter((skill) => skill.chainRoot === ID.DUSK_STRIKE).map((skill) => skill.name),
    ['Dusk Strike', 'Fading Twilight', 'Chilling Scythe']
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps.filter((step) => step.skill === 'Gravedigger').length, 2);
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.condition === 'Chilled' &&
        event.skillName === 'Chilling Scythe' &&
        event.duration === 2
    ),
    true
  );
});

test("delayed interrupted weapon damage preserves Reaper's chain while shroud entry resets it", () => {
  const config = {
    initialResource: 100,
    primaryWeapon: 'Greatsword',
    target: { conditions: {} }
  };
  const interrupted = simulate(
    'Reaper',
    ['Dusk Strike', { name: 'Grasping Darkness', interruptMs: 120 }, 'Fading Twilight'],
    config
  );
  const enteredShroud = simulate('Reaper', ['Dusk Strike', "Reaper's Shroud"], config);
  const shrouded = simulate(
    'Reaper',
    ['Dusk Strike', "Reaper's Shroud", "Exit Reaper's Shroud", 'Dusk Strike'],
    config
  );

  assert.deepEqual(interrupted.warnings, []);
  assert.deepEqual(
    interrupted.steps.map((step) => step.skill),
    ['Dusk Strike', 'Grasping Darkness', 'Fading Twilight']
  );
  assert.equal(interrupted.steps[1].interrupted, true);
  assert.equal(enteredShroud.endState.profession.autoattackChains[ID.DUSK_STRIKE], undefined);
  assert.deepEqual(shrouded.warnings, []);
  assert.deepEqual(
    shrouded.steps.map((step) => step.skill),
    ['Dusk Strike', "Reaper's Shroud", "Exit Reaper's Shroud", 'Dusk Strike']
  );
});

test('non-chain skills reset greatsword and spear autoattacks', () => {
  const greatsword = simulate('Reaper', ['Dusk Strike', 'Well of Suffering', 'Dusk Strike'], {
    primaryWeapon: 'Greatsword',
    target: { conditions: {} }
  });
  const spear = simulate('Harbinger', ['Dark Slash', 'Well of Suffering', 'Dark Slash'], {
    primaryWeapon: 'Spear',
    target: { conditions: {} }
  });

  assert.deepEqual(greatsword.warnings, []);
  assert.deepEqual(
    greatsword.steps.map((step) => step.skill),
    ['Dusk Strike', 'Well of Suffering', 'Dusk Strike']
  );
  assert.deepEqual(spear.warnings, []);
  assert.deepEqual(
    spear.steps.map((step) => step.skill),
    ['Dark Slash', 'Well of Suffering', 'Dark Slash']
  );
});

test('sword autoattack advances through Deathly Enervation before returning to Enervation Blade', () => {
  const config = {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    target: { conditions: {} }
  };
  const afterBlade = simulate('Core', ['Enervation Blade'], config);
  const afterEcho = simulate('Core', ['Enervation Blade', 'Enervation Echo'], config);
  const completed = simulate(
    'Core',
    ['Enervation Blade', 'Enervation Echo', 'Deathly Enervation', 'Enervation Blade'],
    config
  );
  const deathlyDamage = completed.events.find(
    (event) => event.type === 'damage' && event.skillId === ID.DEATHLY_ENERVATION
  );
  const deathlyChill = completed.events.find(
    (event) => event.type === 'condition' && event.condition === 'Chilled' && event.skillId === ID.DEATHLY_ENERVATION
  );

  assert.deepEqual(
    necromancerCatalog.autoattackChains
      .find((chain) => chain[0] === ID.ENERVATION_BLADE)
      .map((skillId) => necromancerCatalog.skillsById.get(skillId).name),
    ['Enervation Blade', 'Enervation Echo', 'Deathly Enervation']
  );
  assert.equal(afterBlade.endState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.ENERVATION_ECHO);
  assert.equal(afterEcho.endState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.DEATHLY_ENERVATION);
  assert.deepEqual(completed.warnings, []);
  assert.deepEqual(
    completed.steps.map((step) => step.skill),
    ['Enervation Blade', 'Enervation Echo', 'Deathly Enervation', 'Enervation Blade']
  );
  assert.equal(completed.endState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.ENERVATION_ECHO);
  assert.equal(deathlyDamage?.coefficient, 1.4);
  assert.equal(deathlyChill?.duration, 2);
});

test('other weapon skills preserve the exceptional Necromancer sword autoattack chain within three seconds', () => {
  const result = simulate('Core', ['Enervation Blade', 'Ravenous Wave', 'Enervation Echo'], {
    boons: { quickness: true },
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    target: { conditions: {} }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Enervation Blade', 'Ravenous Wave', 'Enervation Echo']
  );
  assert.equal(result.endState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.DEATHLY_ENERVATION);
});

test('Necromancer sword autoattack progress expires three seconds after the latest chain step', () => {
  const config = {
    boons: { quickness: true },
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    target: { conditions: {} }
  };
  const retained = simulate(
    'Core',
    ['Enervation Blade', { type: 'wait', durationMs: 2900 }, 'Enervation Echo'],
    config
  );
  const expired = simulate(
    'Core',
    ['Enervation Blade', { type: 'wait', durationMs: 3100 }, 'Enervation Echo', 'Enervation Blade'],
    config
  );

  assert.deepEqual(retained.warnings, []);
  assert.equal(retained.endState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.DEATHLY_ENERVATION);
  assert.match(expired.warnings.join(' '), /Enervation Echo is unavailable/);
  assert.deepEqual(
    expired.events.filter((event) => event.type === 'action').map((event) => event.skillName),
    ['Enervation Blade', 'Enervation Blade']
  );
  assert.equal(expired.endState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.ENERVATION_ECHO);
});

test('Gravedigger fully recharges when it hits below 50% target health', () => {
  const setup = simulate('Reaper', ['Dusk Strike'], {
    primaryWeapon: 'Greatsword',
    target: { health: 0, conditions: {} }
  });
  const result = simulate('Reaper', ['Dusk Strike', 'Gravedigger', 'Gravedigger'], {
    primaryWeapon: 'Greatsword',
    target: {
      health: setup.totalDamage * 1.5,
      conditions: {}
    }
  });
  const gravediggers = result.steps.filter((step) => step.skill === 'Gravedigger');

  assert.deepEqual(result.warnings, []);
  assert.equal(gravediggers.length, 2);
  assert.equal(gravediggers[1].start, gravediggers[0].end);
});

test('target-health scheduler refinement only reruns rotations that cast Gravedigger', () => {
  const refine = necromancerProfession.simulation.refineSchedulerConfig;
  const config = { target: { health: 100 } };
  const damageResult = {
    events: [{ type: 'action', skillId: ID.DUSK_STRIKE }],
    resolvedEvents: [{ type: 'damage', at: 1, damage: 60 }]
  };

  assert.equal(refine(config, damageResult), null);

  const refinement = refine(config, {
    ...damageResult,
    events: [{ type: 'action', skillId: ID.GRAVEDIGGER }]
  });

  assert.equal(refinement._schedulerFeedback.targetBelowHalfAt, 1);
});

test('Reaper and Harbinger shroud transitions emit the current weapon set', () => {
  for (const [specialization, enter, exit] of [
    ['Reaper', "Reaper's Shroud", "Exit Reaper's Shroud"],
    ['Harbinger', 'Harbinger Shroud', 'Exit Harbinger Shroud']
  ]) {
    const result = simulate(specialization, [enter, exit], {
      initialResource: 100,
      weaponSet2Primary: 'Scepter',
      startingWeaponSet: 2
    });

    assert.deepEqual(
      result.events.filter((event) => event.type === 'weapon_set').map((event) => event.weaponSet),
      [2, 2],
      specialization
    );
  }
});

test('Scourge shades use ammo and shade skills spend life force', () => {
  const ammo = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Manifest Sand Shade', 'Manifest Sand Shade', 'Manifest Sand Shade'],
    { initialResource: 100 }
  );
  const cost = simulate('Scourge', ['Manifest Sand Shade', 'Nefarious Favor', { type: 'wait', durationMs: 1000 }], {
    initialResource: 30
  });

  assert.equal(ammo.endState.profession.shades.length, 2);
  assert.equal(ammo.endState.profession.lifeForce, 100);
  assert.equal(ammo.steps[3].start, 15720);
  assert.deepEqual(ammo.warnings, []);
  assert.ok(
    Math.abs(
      cost.endState.profession.lifeForce - (30 - normalizedNecromancerLifeForceCost(cost.endState.profession, 21))
    ) < 1e-12
  );
  assert.ok(cost.conditionDamage > 0);
});

test('Scourge shade costs and packets use their fixed PvE values', () => {
  const shade = simulate('Scourge', ['Manifest Sand Shade', 'Desert Shroud', { type: 'wait', durationMs: 6100 }], {
    initialResource: 100
  });
  const manifest = necromancerCatalog.skillsById.get(ID.MANIFEST_SAND_SHADE);
  const strikes = shade.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.DESERT_SHROUD && event.name === 'Desert Shroud'
  );
  const torment = shade.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.DESERT_SHROUD && event.duration === 5
  );

  assert.deepEqual(
    [ID.NEFARIOUS_FAVOR, ID.SAND_CASCADE, ID.GARISH_PILLAR, ID.DESERT_SHROUD, ID.SANDSTORM_SHROUD].map((skillId) =>
      Math.round(actualNecromancerLifeForceCost(necromancerCatalog.skillsById.get(skillId).lifeForceCost))
    ),
    [1935, 2487, 3685, 4606, 3224]
  );
  assert.equal(manifest.ammo, 3);
  assert.equal(manifest.ammoRecharge, 15);
  assert.ok(Math.abs(strikes.reduce((sum, event) => sum + event.coefficient, 0) - 3.15) < 1e-12);
  assert.equal(strikes.length, 7);
  assert.equal(torment.length, 7);
  assert.equal(
    torment.every((event) => event.stacks === 1 && event.duration === 5),
    true
  );
  const shadeProfile = necromancerCatalog.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade);

  assert.equal(shadeProfile.effects[0].coefficient, 0.666);
  assert.deepEqual(
    [shadeProfile.effects[1].condition, shadeProfile.effects[1].stacks, shadeProfile.effects[1].duration],
    ['Torment', 1, 2]
  );
});

test('Scourge barrier, shroud, and greater-shade traits trigger precisely', () => {
  const barrier = simulate('Scourge', ['Manifest Sand Shade', 'Sand Cascade', 'Sand Flare'], {
    initialResource: 100,
    selectedSkills: ['Sand Flare'],
    selectedTraitIds: [TRAIT.ABRASIVE_GRIT, TRAIT.DESERT_EMPOWERMENT],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const greaterShade = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Manifest Sand Shade', { type: 'wait', durationMs: 8100 }],
    {
      selectedTraitIds: [TRAIT.SAND_SAVANT]
    }
  );
  const sandstorm = simulate('Scourge', ['Sandstorm Shroud', { type: 'wait', durationMs: 4100 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.HERALD_OF_SORROW, TRAIT.SOUL_BARBS],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const buffs = (result, kind) => result.events.filter((event) => event.type === 'buff' && event.kind === kind);
  const sandstormTorment = sandstorm.resolvedEvents.find(
    (event) =>
      event.type === 'condition' &&
      event.skillId === ID.SANDSTORM_SHROUD &&
      event.condition === 'Torment' &&
      event.stacks === 6
  );

  assert.equal(buffs(barrier, 'might').length, 3);
  assert.equal(
    buffs(barrier, 'might').every(
      (event) =>
        event.stacks === 2 &&
        event.duration === 6 &&
        event.audience?.recipients === 'party' &&
        event.resolvedAudience.includesSummons === false
    ),
    true
  );
  assert.equal(buffs(barrier, 'alacrity').length, 3);
  assert.equal(
    buffs(barrier, 'alacrity').every(
      (event) =>
        event.duration === 1.5 &&
        event.audience?.recipients === 'party' &&
        event.resolvedAudience.includesSummons === false
    ),
    true
  );
  assert.equal(greaterShade.endState.profession.shades.length, 0);
  assert.equal(greaterShade.steps[1].start, 19_470);
  assert.equal(sandstormTorment?.duration, 5);
  assert.equal(sandstormTorment?.at, 3.5);
  assert.equal(
    sandstorm.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillId === ID.SANDSTORM_SHROUD && event.name === 'Sandstorm Shroud'
    )?.coefficient,
    3
  );
  assert.deepEqual(
    buffs(sandstorm, 'protection').map((event) => [event.at, event.duration]),
    [
      [0, 1.5],
      [1, 1.5],
      [2, 1.5],
      [3.5, 3]
    ]
  );
  assert.ok(
    buffs(sandstorm, 'protection').every(
      (event) => event.audience?.recipients === 'party' && !event.resolvedAudience.includesSummons
    )
  );
  assert.deepEqual(
    buffs(sandstorm, 'necromancer-soul-barbs').map((event) => event.duration),
    [15]
  );
});

test('Sand Sage extends boons only while a Scourge shade is active', () => {
  const run = (selectedTraitIds) =>
    simulate('Scourge', ['Manifest Sand Shade', 'Blood Is Power'], {
      selectedSkills: ['Blood Is Power'],
      selectedTraitIds
    });
  const mightDuration = (result) =>
    result.events.find((event) => event.type === 'buff' && event.kind === 'might')?.duration;

  assert.equal(mightDuration(run([])), 20);
  assert.equal(mightDuration(run([TRAIT.SAND_SAGE])), 23);
});

test('Lingering Curse increases scepter base duration beyond the stat cap', () => {
  const config = {
    primaryWeapon: 'Scepter',
    stats: { expertise: 1500 }
  };
  const base = simulate('Core', ['Blood Curse'], config);
  const lingering = simulate('Core', ['Blood Curse'], {
    ...config,
    selectedTraitIds: [TRAIT.LINGERING_CURSE]
  });
  const bleedingDuration = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === ID.BLOOD_CURSE && event.condition === 'Bleeding'
    )?.effectiveDuration;

  assert.equal(bleedingDuration(base), 9);
  assert.equal(bleedingDuration(lingering), 13.5);
});

test('Harbinger Shroud generates and consumes expiring blight', () => {
  const generated = simulate(
    'Harbinger',
    ['Harbinger Shroud', { type: 'wait', durationMs: 3100 }, 'Exit Harbinger Shroud'],
    { initialResource: 100 }
  );
  const consumed = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Devouring Cut', 'Exit Harbinger Shroud', { type: 'wait', durationMs: 1000 }],
    {
      initialResource: 100,
      initialBlight: 5
    }
  );
  const expired = simulate('Harbinger', [{ type: 'wait', durationMs: 25_100 }], { initialBlight: 10 });
  const lateExit = simulate(
    'Harbinger',
    ['Harbinger Shroud', { type: 'wait', durationMs: 11_000 }, 'Exit Harbinger Shroud'],
    { initialResource: 100 }
  );

  assert.equal(generated.endState.profession.blight, 6);
  assert.equal(consumed.endState.profession.blight, 0);
  assert.ok(consumed.resolvedEvents.some((event) => event.condition === 'Torment' && event.stacks === 5));
  assert.equal(expired.endState.profession.blight, 0);
  assert.deepEqual(lateExit.warnings, []);
  assert.equal(lateExit.endState.profession.activeShroud, '');
});

test('shroud strikes use their fixed or equipped weapon strengths', () => {
  const core = simulate('Core', ['Death Shroud', 'Life Blast'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const reaper = simulate('Reaper', ["Reaper's Shroud", 'Life Rend'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const harbinger = simulate('Harbinger', ['Harbinger Shroud', 'Devouring Cut'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const scourge = simulate('Scourge', ['Manifest Sand Shade'], {
    initialResource: 100,
    primaryWeapon: 'Pistol'
  });
  const ritualist = simulate(
    'Ritualist',
    [
      "Ritualist's Shroud",
      'Essence Blast',
      'Anguish',
      { type: 'wait', durationMs: 1200 },
      'Wanderlust',
      { type: 'wait', durationMs: 2000 },
      'Summon Spirits',
      { type: 'wait', durationMs: 3000 }
    ],
    {
      initialResource: 100,
      primaryWeapon: 'Pistol',
      weaponSet2Primary: 'Scepter',
      startingWeaponSet: 2
    }
  );
  const damage = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === name);

  assert.equal(damage(core, 'Life Blast').skillWeapon, 'Hammer');
  assert.equal(damage(reaper, 'Life Rend').skillWeapon, 'Hammer');
  assert.equal(damage(harbinger, 'Devouring Cut').skillWeapon, 'Hammer');
  assert.equal(
    scourge.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.MANIFEST_SAND_SHADE)
      ?.skillWeapon,
    'Unequipped'
  );
  assert.equal(damage(ritualist, 'Essence Blast').skillWeapon, 'Scepter');
  const anguishHits = ritualist.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Anguish' && event.metadata?.spiritAttackType === 'initial'
  );
  const wanderlustOpening = damage(ritualist, 'Wanderlust');
  const wanderlustFields = ritualist.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Spirit of Wanderlust - Initial Attack'
  );

  assert.equal(anguishHits.length, 7);
  assert.ok(anguishHits.every((event) => event.coefficient === 0.36));
  assert.ok(anguishHits.every((event) => event.weaponStrengthProfileId === 'transform.ritualist-shroud'));
  assert.ok(anguishHits.every((event) => event.resolvedWeaponStrength === 1100));
  assert.equal(new Set(anguishHits.map((event) => event.activationId)).size, 1);
  assert.equal(wanderlustOpening.skillWeapon, 'Scepter');
  assert.equal(wanderlustOpening.weaponStrengthProfileId, 'weapon.scepter');
  assert.equal(wanderlustFields.length, 4);
  assert.ok(wanderlustFields.every((event) => event.coefficient === 0.42));
  assert.ok(wanderlustFields.every((event) => event.weaponStrengthProfileId === 'transform.ritualist-shroud'));
  assert.ok(wanderlustFields.every((event) => event.resolvedWeaponStrength === 1100));
  assert.equal(new Set(wanderlustFields.map((event) => event.activationId)).size, 1);
  assert.notEqual(wanderlustFields[0].activationId, wanderlustOpening.activationId);
  assert.equal(damage(ritualist, 'Summon Spirits').skillWeapon, 'Unequipped');
});

test('Harbinger shroud attacks use their Blight thresholds and coefficients', () => {
  const run = (skill, initialBlight) =>
    simulate('Harbinger', ['Harbinger Shroud', skill, 'Exit Harbinger Shroud', { type: 'wait', durationMs: 7100 }], {
      initialResource: 100,
      initialBlight
    });
  const baseCut = run('Devouring Cut', 0);
  const empoweredCut = run('Devouring Cut', 5);
  const baseArc = run('Voracious Arc', 0);
  const empoweredArc = run('Voracious Arc', 5);
  const vitalDraw = run('Vital Draw', 0);
  const darkBarrage = run('Dark Barrage', 0);
  const strikeCoefficients = (result, skillId) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === skillId)
      .map((event) => event.coefficient);

  assert.deepEqual(strikeCoefficients(baseCut, ID.DEVOURING_CUT), [1]);
  assert.deepEqual(strikeCoefficients(empoweredCut, ID.DEVOURING_CUT), [2]);
  assert.deepEqual(strikeCoefficients(baseArc, ID.VORACIOUS_ARC), [1.4]);
  assert.deepEqual(strikeCoefficients(empoweredArc, ID.VORACIOUS_ARC), [2.8]);
  const vitalDrawCoefficients = strikeCoefficients(vitalDraw, ID.VITAL_DRAW);
  const darkBarrageCoefficients = strikeCoefficients(darkBarrage, ID.DARK_BARRAGE);

  assert.equal(vitalDrawCoefficients.length, 3);
  assert.ok(Math.abs(vitalDrawCoefficients.reduce((sum, value) => sum + value, 0) - 1.2) < 1e-12);
  assert.equal(darkBarrageCoefficients.length, 6);
  assert.ok(Math.abs(darkBarrageCoefficients.reduce((sum, value) => sum + value, 0) - 3.6) < 1e-12);
  assert.equal(empoweredCut.endState.profession.blight, 0);
  assert.equal(
    empoweredArc.events.some(
      (event) => event.type === 'necromancer.state' && event.reason === 'blight-skill' && event.state.blight === 0
    ),
    true
  );
  // The 1.26-second Arc cast generates two new Blight before shroud exit.
  assert.equal(empoweredArc.endState.profession.blight, 2);
  assert.equal(
    empoweredCut.resolvedEvents.some(
      (event) => event.condition === 'Torment' && event.stacks === 5 && event.duration === 5
    ),
    true
  );
  assert.equal(
    empoweredArc.resolvedEvents.some(
      (event) => event.condition === 'Torment' && event.stacks === 5 && event.duration === 7
    ),
    true
  );
  assert.equal(
    empoweredArc.events.some(
      (event) => event.type === 'control' && event.controlKind === 'daze' && event.duration === 0.5
    ),
    true
  );
});

test('Blight skills pay their cost before Wicked Corruption and elixirs', () => {
  const run = (skill, selectedTraitIds = []) =>
    simulate('Harbinger', ['Harbinger Shroud', skill, 'Exit Harbinger Shroud', 'Elixir of Risk'], {
      initialBlight: 25,
      selectedSkills: ['Elixir of Risk'],
      selectedTraitIds,
      stats: { precision: 4000 },
      target: {
        ...baseConfig.target,
        health: 1_000_000_000,
        conditions: { Vulnerability: 25 }
      }
    });

  for (const [skill, skillId, elixirConsumption] of [
    ['Devouring Cut', ID.DEVOURING_CUT, 15],
    ['Voracious Arc', ID.VORACIOUS_ARC, 17]
  ]) {
    const baseline = run(skill);
    const wicked = run(skill, [TRAIT.WICKED_CORRUPTION]);
    const skillDamage = (result) =>
      result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === skillId);
    const wickedStrike = skillDamage(wicked);

    assert.equal(wickedStrike.metadata.necromancerBlight, 20, skill);
    assert.ok(Math.abs(wickedStrike.damage / skillDamage(baseline).damage - 1.2) < 1e-12, skill);
    assert.equal(
      wicked.events.find((event) => event.type === 'necromancer.state' && event.reason === 'blight-skill')?.state
        .blight,
      20,
      skill
    );
    assert.equal(
      wicked.events.find((event) => event.type === 'necromancer.state' && event.reason === 'blight-consumed')?.state
        .blight,
      elixirConsumption,
      skill
    );
    assert.equal(wicked.endState.profession.blight, 25, skill);
  }
});

test('Spear skills generate, refresh, consume, and damage with Soul Shards', () => {
  const chain = simulate('Harbinger', ['Dark Slash', 'Deadly Slice', 'Sinister Stab'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const utility = simulate('Harbinger', ['Extirpate', 'Addle', 'Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    target: {
      ...baseConfig.target,
      health: 1_000_000_000
    }
  });
  const belowHalf = simulate('Harbinger', ['Extirpate', 'Addle', 'Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    target: {
      ...baseConfig.target,
      health: 20_000
    }
  });
  const expired = simulate('Harbinger', ['Dark Slash', 'Deadly Slice', { type: 'wait', durationMs: 10_100 }], {
    primaryWeapon: 'Spear'
  });
  const damageEvents = (result, skillId) =>
    result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);

  assert.deepEqual(
    damageEvents(chain, ID.DARK_SLASH).map((event) => event.coefficient),
    [1.2]
  );
  assert.deepEqual(
    damageEvents(chain, ID.DEADLY_SLICE).map((event) => event.coefficient),
    [1.4]
  );
  assert.deepEqual(
    damageEvents(chain, ID.SINISTER_STAB).map((event) => event.coefficient),
    [1.8]
  );
  assert.equal(chain.endState.profession.soulShards, 2);
  assert.equal(chain.endState.profession.lifeForce, 5);
  assert.equal(
    chain.events.some(
      (event) => event.type === 'condition' && event.condition === 'Chilled' && event.skillId === ID.SINISTER_STAB
    ),
    true
  );
  assert.equal(expired.endState.profession.soulShards, 0);

  assert.equal(utility.endState.profession.lifeForce, 22);
  assert.equal(utility.endState.profession.soulShards, 0);
  assert.equal(
    utility.events.some(
      (event) => event.type === 'buff' && event.skillId === ID.EXTIRPATE && event.kind === 'might' && event.stacks === 5
    ),
    true
  );
  assert.equal(
    utility.events.some(
      (event) => event.type === 'condition' && event.skillId === ID.EXTIRPATE && event.condition === 'Weakness'
    ),
    true
  );
  assert.equal(
    utility.events.some(
      (event) => event.type === 'control' && event.skillId === ID.ADDLE && event.controlKind === 'daze'
    ),
    true
  );
  assert.equal(
    utility.events.some(
      (event) => event.type === 'condition' && event.skillId === ID.ADDLE && event.condition === 'Immobilized'
    ),
    false
  );

  const perforate = damageEvents(utility, ID.PERFORATE).filter((event) => event.name === 'Perforate');
  const shards = damageEvents(utility, ID.SOUL_SHARDS).filter((event) => event.name === 'Soul Shards');

  assert.equal(perforate.length, 7);
  assert.deepEqual(
    perforate.map((event) => event.coefficient),
    Array(7).fill(0.5)
  );
  assert.deepEqual(
    perforate.map((event) => event.coefficientModifiers),
    Array(7)
      .fill(null)
      .map(() => [
        {
          kind: 'target-health-below',
          threshold: 0.5,
          multiplier: 1.2
        }
      ])
  );
  assert.equal(shards.length, 4);
  assert.equal(
    shards.every((event) => event.parentSkillName === 'Perforate'),
    true
  );
  assert.equal(
    shards.every((event) => event.flatStrikePowerCoeff === 0.1),
    true
  );
  const normalShardDamage = utility.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Soul Shards'
  )?.damage;
  const lowShardDamage = Math.max(
    ...belowHalf.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Soul Shards')
      .map((event) => event.damage)
  );

  assert.ok(Math.abs(lowShardDamage / normalShardDamage - 1.5) < 1e-12);
  const normalPerforateDamage = utility.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Perforate'
  )?.damage;
  const lowPerforateDamage = Math.max(
    ...belowHalf.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Perforate')
      .map((event) => event.damage)
  );

  assert.ok(Math.abs(lowPerforateDamage / normalPerforateDamage - 1.2) < 1e-12);
});

test('Soul Shards expire after ten seconds and refresh together when another shard is gained', () => {
  const state = createNecromancerCoreState();

  assert.equal(addSoulShards(state, 2, 0), 2);
  assert.deepEqual(state.soulShardExpiries, [10, 10]);

  assert.equal(addSoulShards(state, 1, 9), 1);
  assert.deepEqual(state.soulShardExpiries, [19, 19, 19]);

  purgeTimedState(state, 10);
  assert.equal(state.soulShards, 3);
  purgeTimedState(state, 19);
  assert.equal(state.soulShards, 0);
});

test('Isolate and Distress expose the follow-up and reset Perforate', () => {
  const result = simulate('Harbinger', ['Perforate', 'Isolate', 'Distress', 'Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const expiredFollowUp = simulate('Harbinger', ['Isolate', { type: 'wait', durationMs: 3100 }, 'Distress'], {
    primaryWeapon: 'Spear'
  });
  const delayedHitWindow = simulate('Harbinger', ['Isolate', { type: 'wait', durationMs: 2800 }, 'Distress'], {
    boons: { quickness: true },
    primaryWeapon: 'Spear'
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(delayedHitWindow.warnings, []);
  assert.equal(
    Math.round(
      delayedHitWindow.events.find((event) => event.type === 'damage' && event.skillId === ID.ISOLATE).at * 1000
    ),
    440
  );
  assert.equal(
    delayedHitWindow.events.find((event) => event.type === 'action' && event.skillId === ID.ISOLATE).rechargeReadyAt,
    18.44
  );
  assert.equal(result.steps[3].start < 8000, true);
  assert.equal(
    result.events.filter(
      (event) => event.type === 'damage' && event.skillId === ID.PERFORATE && event.name === 'Perforate'
    ).length,
    14
  );
  assert.equal(result.events.filter((event) => event.type === 'damage' && event.name === 'Soul Shards').length, 6);
  assert.equal(
    result.events.some(
      (event) => event.type === 'necromancer.state' && event.reason === 'distress' && event.state.soulShards === 6
    ),
    true
  );
  const rows = skillBreakdownRows(result);

  assert.equal(rows.find((row) => row.name === 'Perforate')?.hits, 14);
  assert.equal(rows.find((row) => row.name === 'Soul Shards')?.hits, 6);
  assert.equal(
    rows.find((row) => row.name === 'Soul Shards')?.icon,
    'https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png'
  );
  assert.equal(
    result.events.some(
      (event) => event.type === 'condition' && event.condition === 'Chilled' && event.skillId === ID.ISOLATE
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillId === ID.ISOLATE &&
        event.condition === 'Vulnerability' &&
        event.stacks === 8
    ),
    true
  );
  assert.match(expiredFollowUp.warnings.join(' '), /Distress is unavailable/);
});

test('Addle grants four shards to defiant foes and checks activation shards', () => {
  const normal = simulate('Harbinger', ['Addle'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const defiant = simulate('Harbinger', ['Addle'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    target: {
      ...baseConfig.target,
      defiant: true,
      activatingSkills: false
    }
  });
  const threshold = simulate('Harbinger', ['Dark Slash', 'Deadly Slice', 'Extirpate', 'Addle'], {
    initialResource: 0,
    primaryWeapon: 'Spear'
  });
  const immobilizes = (result) =>
    result.events.filter(
      (event) => event.type === 'condition' && event.skillId === ID.ADDLE && event.condition === 'Immobilized'
    );

  assert.equal(normal.endState.profession.soulShards, 2);
  assert.equal(normal.endState.profession.lifeForce, 10);
  assert.equal(immobilizes(normal).length, 0);
  assert.equal(normal.events.find((event) => event.type === 'control' && event.skillId === ID.ADDLE)?.duration, 0.25);
  assert.equal(defiant.endState.profession.soulShards, 4);
  assert.equal(defiant.endState.profession.lifeForce, 20);
  assert.equal(immobilizes(defiant).length, 0);
  assert.equal(defiant.events.find((event) => event.type === 'control' && event.skillId === ID.ADDLE)?.duration, 1.5);
  assert.equal(threshold.endState.profession.soulShards, 5);
  assert.equal(immobilizes(threshold).length, 1);
});
