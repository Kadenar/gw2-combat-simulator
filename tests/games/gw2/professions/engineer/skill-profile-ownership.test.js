import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { engineerTooltips } from '#gw2/professions/engineer/app/tooltips.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { amalgamAttributes } from '#gw2/professions/engineer/specializations/amalgam/attributes.js';
import { applyAmalgamStrain } from '#gw2/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { holosmithSkillStrikeFactor } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import {
  overclockRechargeWork,
  signetModifierRules
} from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { evaluateAttributeDeclarations } from '#tests/helpers/attribute-declarations.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Returning to Current must restore the canonical owner without retaining any preview mutations.
function preview(skills, balanceProfiles = {}) {
  return withPatchPreview(engineerProfession, {
    id: 'engineer-ownership',
    label: 'Engineer ownership',
    professions: { engineer: { skills, balanceProfiles } }
  });
}

test('Engineer rejects removed skill profile targets', () => {
  for (const id of [
    'engineer.core.lightning-rod',
    'engineer.core.focused-lightning-rod',
    'engineer.core.conduit-surge',
    'engineer.core.electric-artillery',
    'engineer.core.focused-electric-artillery',
    ...[
      'sword',
      'blade-burst',
      'particle-accelerator',
      'laser-disk',
      'launch-wall',
      'prime-light-beam',
      'radiant-arc',
      'refraction-cutter'
    ].map((name) => `engineer.holosmith.${name}-heat-tier`),
    'engineer.holosmith.heat',
    'engineer.holosmith.overheat',
    'engineer.mechanist.force-signet',
    'engineer.mechanist.superconducting-signet',
    ID.OVERCLOCK_SIGNET,
    'engineer.amalgam.morphs',
    'engineer.amalgam.strains',
    'engineer.amalgam.rapacious-strain'
  ]) {
    assert.equal(engineerCatalog.balanceProfilesById.has(id), false);
    assert.throws(
      () => preview({}, { [id]: { fields: { duration: 1 } } }).resolvePatch({ id: 'engineer-ownership' }),
      /unknown|missing|not found/i
    );
  }
});

test('signet passives and Static Discharge consume independent selected skill fields', () => {
  const profession = preview({
    [ID.FORCE_SIGNET]: { fields: { damageIncrease: 0.31 } },
    [ID.SUPERCONDUCTING_SIGNET]: { fields: { conditionDamageIncrease: 0.27 } },
    [ID.OVERCLOCK_SIGNET]: { fields: { rechargeMultiplier: 0.37 } },
    [ID.STATIC_DISCHARGE_TRAIT_SKILL]: { fields: { criticalDamage: 1.7 } }
  });
  for (const patchId of ['current', 'engineer-ownership', 'current']) {
    const selected = profession.resolvePatch({ id: patchId }).balanceContext;
    const context = {
      ...selected,
      time: 0,
      config: {
        selectedTraitIds: [],
        selectedSkillIds: [ID.FORCE_SIGNET, ID.SUPERCONDUCTING_SIGNET, ID.OVERCLOCK_SIGNET]
      },
      cooldownController: { readyAt: () => 0 }
    };
    const expected = (id, field, patched) =>
      patchId === 'current' ? engineerCatalog.skillsById.get(id)[field] : patched;
    for (const [rule, id, field, patched] of [
      [signetModifierRules[0], ID.FORCE_SIGNET, 'damageIncrease', 0.31],
      [signetModifierRules[1], ID.SUPERCONDUCTING_SIGNET, 'conditionDamageIncrease', 0.27]
    ]) {
      assert.equal(rule.when(context), true);
      assert.equal(rule.amount(context), expected(id, field, patched));
      assert.equal(rule.when({ ...context, timeline: { skillOnCooldownAt: () => true } }), false);
      const improved = {
        ...context,
        config: { ...context.config, selectedTraitIds: [TRAIT.MECH_CORE_J_DRIVE] },
        timeline: { skillOnCooldownAt: () => true }
      };
      assert.equal(rule.when(improved), true);
      assert.equal(rule.amount(improved), selected.catalog.balanceProfilesById.get(TRAIT.MECH_CORE_J_DRIVE)[field]);
    }

    const signet = selected.catalog.skillsById.get(ID.FORCE_SIGNET);
    assert.equal(
      overclockRechargeWork(context, signet, 100),
      100 * expected(ID.OVERCLOCK_SIGNET, 'rechargeMultiplier', 0.37)
    );
    assert.equal(overclockRechargeWork({ ...context, cooldownController: { readyAt: () => 10 } }, signet, 100), 100);
    assert.equal(
      selected.modifierRulesById.get('engineer.static-discharge-critical-damage').factor(context),
      expected(ID.STATIC_DISCHARGE_TRAIT_SKILL, 'criticalDamage', 1.7)
    );
    assert.ok(
      describeSimulationSkill(
        selected,
        selected.catalog.skillsById.get(ID.OVERCLOCK_SIGNET),
        engineerTooltips
      ).facts.some((fact) => fact.name === 'Signet recharge')
    );
  }
});

test('sword heat factors patch independently and missing selected fields never read Current', () => {
  const catalog = applySkillPatch(engineerCatalog, {
    skills: { [ID.SUN_EDGE]: { fields: { highStrikeFactor: 0.4 } } }
  });
  const context = { catalog, config: { selectedTraitIds: [] } };
  const snapshot = { heat: 70, enhancedCapacitySelected: false };
  assert.equal(holosmithSkillStrikeFactor(context, ID.SUN_EDGE, snapshot), 0.4);
  assert.equal(holosmithSkillStrikeFactor(context, ID.SUN_RIPPER, snapshot), 1.2);
  const missing = {
    catalog: { skillsById: new Map([[ID.SUN_EDGE, { id: ID.SUN_EDGE, name: 'Missing tuning' }]]) },
    helpers: engineerCatalog
  };
  assert.throws(
    () => skillNumberFromContext(missing, ID.SUN_EDGE, 'highStrikeFactor'),
    /skill=.*field=highStrikeFactor/
  );
  assert.throws(() => skillNumberFromContext(missing, ID.SUN_RIPPER, 'highStrikeFactor'), /missing required skill/);
});

test('removed spear payloads preserve Focused, patched charge limits, and release settlement', () => {
  const skills = {
    [ID.CONDUIT_SURGE]: {
      fields: { duration: 20 },
      sideEffects: {
        payload: {
          removeEffects: [
            { type: 'strike', all: true },
            { type: 'condition', all: true }
          ]
        }
      }
    },
    [ID.LIGHTNING_ROD]: {
      sideEffects: {
        payload: {
          removeEffects: [
            { type: 'strike', all: true },
            { type: 'condition', all: true }
          ]
        }
      }
    },
    [ID.ELECTRIC_ARTILLERY]: {
      fields: { maximumStacks: 3, focusedBurningDurationPerCharge: 2, focusedChargesPerVulnerability: 3 },
      sideEffects: { payload: { removeEffects: [{ type: 'strike', name: 'Focused Electric Artillery' }] } }
    }
  };
  const result = runEngineer(
    [
      { type: 'combat-start' },
      'Conduit Surge',
      'Lightning Rod',
      { type: 'wait', durationMs: 4400 },
      'Electric Artillery',
      { type: 'wait', durationMs: 1000 }
    ],
    {},
    { catalog: (catalog) => applySkillPatch(catalog, { skills }) }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage'),
    false
  );
  const focused = result.events.find((event) => event.kind === 'engineer-focused');
  assert.equal(focused.duration, 20);
  const burning = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === ID.ELECTRIC_ARTILLERY && event.condition === 'Burning'
  );
  assert.equal(burning.duration, 9);
  const vulnerability = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === ID.ELECTRIC_ARTILLERY && event.condition === 'Vulnerability'
  );
  assert.equal(
    vulnerability.reduce((sum, event) => sum + event.stacks, 0),
    1
  );
  assert.deepEqual(result.planningState.profession[STATE.LIGHTNING_ROD_CHARGE_EXPIRIES], []);
  assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.ELECTRIC_ARTILLERY], undefined);
});

test('heat-component removal is independent from ordinary packets and sibling conditions', () => {
  for (const [id, rotation, config] of [
    [ID.LASER_DISK, ['Laser Disk'], { selectedSkillIds: [ID.LASER_DISK] }],
    [ID.LAUNCH_WALL, ['Photon Wall', 'Launch Wall'], { selectedSkillIds: [ID.PHOTON_WALL] }],
    [ID.PRIME_LIGHT_BEAM, ['Prime Light Beam'], { selectedSkillIds: [ID.PRIME_LIGHT_BEAM] }],
    [ID.REFRACTION_CUTTER, [ID.REFRACTION_CUTTER], { primaryWeapon: 'Sword' }]
  ]) {
    const skill = engineerCatalog.skillsById.get(id);
    const action =
      id === ID.PRIME_LIGHT_BEAM
        ? { effects: skill.effects.filter((effect) => effect.metadata?.trigger === 'heat-field') }
        : requireSkillAction(skill, 'heat-payload');
    const condition = action.effects.find((effect) => effect.type === 'condition');
    const strike = action.effects.find((effect) => effect.type === 'strike');
    for (const removed of [condition, strike]) {
      const result = runEngineer(
        [...rotation, { type: 'wait', durationMs: 1500 }],
        { specialization: 'Holosmith', initialHeat: 80, ...config },
        {
          catalog: (catalog) => {
            const payload = {
              removeEffects: [{ type: removed.type, name: removed.name }],
              effects: [
                {
                  type: removed === condition ? 'strike' : 'condition',
                  name: removed === condition ? strike.name : condition.name,
                  ...(removed === condition ? { coefficient: 0.73 } : { duration: 13 })
                }
              ]
            };
            return applySkillPatch(catalog, {
              skills: { [id]: id === ID.PRIME_LIGHT_BEAM ? payload : { sideEffects: { 'heat-payload': payload } } }
            });
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const events = result.resolvedEvents.filter((event) => event.skillId === id);
      assert.equal(
        events.some((event) => event.type === 'damage' && event.coefficient === 0.73),
        removed === condition
      );
      assert.equal(
        events.some((event) => event.type === 'condition' && event.duration === 13),
        removed === strike
      );

      if (id === ID.PRIME_LIGHT_BEAM || id === ID.REFRACTION_CUTTER)
        assert.ok(events.some((event) => event.type === 'damage' && event.coefficient > 1));
    }
  }
});

test('Evolve and Silver Lining consume the selected protocol slot without leaking sibling edits', () => {
  const owner = ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103;
  const other = ID.OFFENSIVE_PROTOCOL_SHRED;
  const catalog = applySkillPatch(engineerCatalog, {
    skills: {
      [owner]: {
        sideEffects: {
          strain: {
            effects: [{ type: 'boon', name: 'Predator Strain', duration: 17 }],
            removeEffects: [{ type: 'buff', name: 'Predator Strain' }]
          }
        }
      }
    }
  });
  for (const [id, selectedMorphSkillIds, duration] of [
    [owner, [owner, 77203, 76954], 17],
    [other, [76927, 77203, other], 8]
  ]) {
    for (const silver of [false, true]) {
      const result = runEngineer(
        [silver ? id : ID.EVOLVE_BASE],
        { specialization: 'Amalgam', selectedMorphSkillIds, selectedTraitIds: silver ? [TRAIT.SILVER_LINING] : [] },
        { catalog: () => catalog }
      );
      assert.deepEqual(result.warnings, []);
      const quickness = result.events.find(
        (event) => event.type === 'buff' && event.sourceId === 'engineer.predator-strain' && event.kind === 'quickness'
      );
      assert.equal(quickness.duration, duration);
      assert.equal(result.planningState.profession[STATE.PREDATOR_UNTIL], quickness.at + duration);
      assert.equal(
        result.events.some((event) => event.kind === 'superspeed'),
        id === other
      );
    }
  }
});

test('Forge entry reads its selected kit lockout and primary beam damage precedes the captured field', () => {
  const result = runEngineer(
    ['Engage Photon Forge', 'Prime Light Beam', { type: 'wait', durationMs: 1000 }],
    {
      specialization: 'Holosmith',
      initialHeat: 70,
      selectedSkillIds: [ID.PRIME_LIGHT_BEAM],
      boons: { alacrity: true }
    },
    {
      catalog: (catalog) =>
        applySkillPatch(catalog, { skills: { [ID.ENGAGE_PHOTON_FORGE]: { fields: { kitLockoutDuration: 9 } } } })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.KIT_LOCKOUT_UNTIL], 9 / 1.25);
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.PRIME_LIGHT_BEAM
  );
  assert.ok(hits[0].name.includes('Packet 1'));
  assert.ok(hits.slice(1).some((event) => event.name === 'Field Damage'));
});

// Every slot reads shared Rapacious tuning; retained grants expire independently of later protocol selection.
for (const id of [
  ID.DEFENSIVE_PROTOCOL_THORNS,
  ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104,
  ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163
]) {
  test('Thorns ' + id + ' reads shared Rapacious cooldown, payload, expiry, and tooltip', () => {
    const baseline = engineerCatalog.skillsById.get(ID.DEFENSIVE_PROTOCOL_THORNS).rapaciousDuration;
    const family = preview({
      [ID.DEFENSIVE_PROTOCOL_THORNS]: {
        fields: { rapaciousDuration: 1.5, rapaciousInternalCooldown: 0.6 },
        sideEffects: { strain: { effects: [{ type: 'strike', name: 'Rapacious Strain', coefficient: 0.9 }] } }
      }
    });
    const result = runEngineer(
      [{ type: 'wait', durationMs: 2000 }],
      {
        specialization: 'Amalgam',
        patchId: 'engineer-ownership'
      },
      {
        profession: family,
        initialize(runtime) {
          const state = runtime.profession.specialization.state;
          state.evolvedUntil = 10;
          applyAmalgamStrain(runtime, runtime.helpers.skillsById.get(id), 0);
          for (const at of [0.25, 0.5, 1, 1.5])
            runtime.schedule('test.emit', at, {
              type: 'damage',
              at,
              source: 'fixture',
              sourceId: ID.OFFENSIVE_PROTOCOL_SHRED,
              actorType: 'player',
              skillId: ID.OFFENSIVE_PROTOCOL_SHRED,
              skillName: 'Trigger',
              coefficient: 1,
              weaponStrength: 1000
            });
        },
        probes: [
          [
            0.3,
            (runtime) => {
              runtime.profession.specialization.state.selectedMorphSkillIds = [];
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const procs = result.events.filter(
      (event) => event.type === 'damage' && event.sourceId === 'engineer.rapacious-strain'
    );
    assert.deepEqual(
      procs.map((event) => event.at),
      [0.25, 1]
    );
    assert.ok(procs.every((event) => event.coefficient === 0.9));
    const selected = family.resolvePatch({ id: 'engineer-ownership' }).balanceContext;
    const tooltip = describeSimulationSkill(selected, selected.catalog.skillsById.get(id), engineerTooltips);
    assert.equal(tooltip.facts.find((fact) => fact.name === 'Rapacious Strain duration').detail, '1.5s');
    assert.equal(engineerCatalog.skillsById.get(ID.DEFENSIVE_PROTOCOL_THORNS).rapaciousDuration, baseline);
  });
}

// Effect removal must suppress both the initial grant and future proc cooldown claims.
test('removed Rapacious payload cannot arm a strain through Evolve or Silver Lining', () => {
  const id = ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104;
  for (const silver of [false, true]) {
    const result = runEngineer(
      [silver ? id : ID.EVOLVE_BASE],
      {
        specialization: 'Amalgam',
        selectedMorphSkillIds: [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103, id, ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954],
        selectedTraitIds: silver ? [TRAIT.SILVER_LINING] : []
      },
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, {
            skills: {
              [ID.DEFENSIVE_PROTOCOL_THORNS]: {
                sideEffects: { strain: { removeEffects: [{ type: 'strike', name: 'Rapacious Strain' }] } }
              }
            }
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.specialization.state.rapaciousUntil, 0);
    assert.equal(runtime.procs.deadline('rapacious'), 0);
  }
});

// All Obliterate slots share Titanic scaling; expiry removes its contribution and live Might determines its size.
test('Obliterate owns Titanic scaling after protocol reselection and until strain expiry', () => {
  for (const id of [
    ID.OFFENSIVE_PROTOCOL_OBLITERATE,
    ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806,
    ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901
  ]) {
    const catalog = applySkillPatch(engineerCatalog, {
      skills: { [ID.OFFENSIVE_PROTOCOL_OBLITERATE]: { fields: { titanicAttributePerStack: 9 } } }
    });
    const result = runEngineer(
      [],
      { specialization: 'Amalgam' },
      {
        catalog: () => catalog,
        initialize(runtime) {
          applyAmalgamStrain(runtime, runtime.helpers.skillsById.get(id), 0);
          runtime.profession.specialization.state.selectedMorphSkillIds = [];
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const state = observedRuntime(result).profession.specialization.state;
    for (const [time, expected] of [
      [1, 1090],
      [state.titanicUntil, 1000]
    ]) {
      const actual = evaluateAttributeDeclarations(
        {
          catalog,
          time,
          config: { boons: { might: 10 } },
          runtime: { profession: { specialization: { kind: 'Amalgam', state } } }
        },
        { power: 1000, conditionDamage: 1000 },
        amalgamAttributes
      );
      assert.equal(actual.power, expected);
      assert.equal(actual.conditionDamage, expected);
    }
  }
});

// One edit must apply across grants from different slots without resetting the shared proc deadline.
test('Rapacious regrants from another slot retain the shared cooldown and canonical patch notes', () => {
  const owner = ID.DEFENSIVE_PROTOCOL_THORNS;
  const slots = [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163, ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104];
  const family = preview({ [owner]: { fields: { rapaciousInternalCooldown: 1 } } });
  const result = runEngineer(
    [{ type: 'wait', durationMs: 1500 }],
    { specialization: 'Amalgam', patchId: 'engineer-ownership' },
    {
      profession: family,
      initialize(runtime) {
        runtime.profession.specialization.state.evolvedUntil = 10;
        applyAmalgamStrain(runtime, runtime.helpers.skillsById.get(slots[0]), 0);
        for (const at of [0.1, 0.5, 1.2])
          runtime.schedule('test.emit', at, {
            type: 'damage',
            at,
            source: 'fixture',
            sourceId: ID.OFFENSIVE_PROTOCOL_SHRED,
            actorType: 'player',
            skillId: ID.OFFENSIVE_PROTOCOL_SHRED,
            skillName: 'Trigger',
            coefficient: 1,
            weaponStrength: 1000
          });
      },
      probes: [[0.3, (runtime) => applyAmalgamStrain(runtime, runtime.helpers.skillsById.get(slots[1]), runtime.time)]]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events
      .filter((event) => event.sourceId === 'engineer.rapacious-strain' && event.type === 'damage')
      .map((event) => event.at),
    [0.1, 1.2]
  );
  for (const id of slots) {
    assert.equal(engineerCatalog.skillsById.get(id).rapaciousInternalCooldown, undefined);
    const notes = family.patchOverviewFor(
      { specialization: 'Amalgam', selectedTraitIds: [], selectedMorphSkillIds: [id] },
      []
    );
    assert.ok(notes.some((note) => note.subject === engineerCatalog.skillsById.get(owner).name));
  }
});
