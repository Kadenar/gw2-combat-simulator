import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { engineerTooltips } from '#gw2/professions/engineer/app/tooltips.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  signetModifierRules,
  overclockRechargeWork
} from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { holosmithSkillStrikeFactor } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';

// Returning to Current must restore the canonical owner without retaining any preview mutations.
function preview(skills, balanceProfiles = {}) {
  return withPatchPreview(engineerProfession, {
    id: 'engineer-ownership',
    label: 'Engineer ownership',
    professions: { engineer: { skills, balanceProfiles } }
  });
}

test('Engineer rejects removed skill profiles and exposes no skill-variant catalog owners', () => {
  assert.equal(
    engineerCatalog.balanceProfiles.some((profile) => profile.profileKind === 'skill-variant'),
    false
  );
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
    'engineer.amalgam.morphs'
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
  assert.deepEqual(result.planningState.profession.lightningRodChargeExpiries, []);
  assert.equal(result.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY], undefined);
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
      assert.equal(result.planningState.profession.predatorUntil, quickness.at + duration);
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
  assert.equal(result.planningState.profession.kitLockoutUntil, 9 / 1.25);
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.PRIME_LIGHT_BEAM
  );
  assert.ok(hits[0].name.includes('Packet 1'));
  assert.ok(hits.slice(1).some((event) => event.name === 'Field Damage'));
});
